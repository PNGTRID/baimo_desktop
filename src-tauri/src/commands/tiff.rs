use crate::models::TiffMetadata;
use std::path::Path;
use std::io::{Read, Seek, SeekFrom};

/// 支持的图片格式扩展名
pub const SUPPORTED_IMAGE_EXTENSIONS: &[&str] = &[
    "tif", "tiff",  // TIFF
    "jpg", "jpeg",  // JPEG
    "png",          // PNG
    "webp",         // WebP
    "bmp",          // BMP
    "gif",          // GIF
    "psd",          // Photoshop (使用 ImageMagick)
];

/// 解析任意图片文件元数据（支持多种格式）
pub fn parse_image_file(file_path: &Path) -> Result<TiffMetadata, String> {
    // 验证文件存在
    if !file_path.exists() {
        return Err("文件不存在".to_string());
    }

    // 获取文件扩展名
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    // 根据扩展名选择解析方式
    match extension.as_str() {
        "tif" | "tiff" => {
            // TIFF 使用专用解析器（能读取准确的 DPI 信息）
            return parse_tiff_file_sync(file_path);
        }
        "psd" | "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif" => {
            // 其他格式使用 ImageMagick（能读取 DPI 信息）
            return parse_with_imagemagick(file_path);
        }
        _ => {
            return Err(format!("不支持的图片格式: {}", extension));
        }
    }
}

/// 使用 ImageMagick 解析图片文件元数据（支持所有格式，能读取 DPI）
fn parse_with_imagemagick(file_path: &Path) -> Result<TiffMetadata, String> {
    let file_path_str = file_path.to_string_lossy().to_string();

    // 获取文件名和大小
    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // 获取 ImageMagick 路径
    let magick_path = get_imagemagick_path()?;

    // 设置环境变量，确保 DLL 能被找到
    let mut cmd = std::process::Command::new(&magick_path);

    // 如果使用打包的 ImageMagick，添加 DLL 搜索路径
    if let Some(magick_dir) = magick_path.parent() {
        // Windows: 设置 PATH 环境变量包含 ImageMagick 目录
        if cfg!(target_os = "windows") {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let new_path = format!("{};{}", magick_dir.display(), current_path);
            cmd.env("PATH", new_path);
        }

        // 设置 MAGICK_HOME 环境变量
        cmd.env("MAGICK_HOME", magick_dir);
    }

    // 使用 -ping 选项只获取基础图像信息，不加载所有图层
    let output = cmd
        .args(["identify", "-ping", "-format", "%w\n%h\n%x", file_path.to_str().unwrap()])
        .output()
        .map_err(|e| format!("ImageMagick 执行失败: {}。路径: {}", e, magick_path.display()))?;

    if !output.status.success() {
        return Err(format!("ImageMagick 处理图片失败: {}",
            String::from_utf8_lossy(&output.stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // 按行分割，取前3行（宽度、高度、X分辨率）
    let lines: Vec<&str> = stdout.lines().collect();

    if lines.len() < 2 {
        return Err("无法解析图片尺寸".to_string());
    }

    let width: u32 = lines[0].trim().parse()
        .map_err(|_| "无效的宽度值".to_string())?;
    let height: u32 = lines[1].trim().parse()
        .map_err(|_| "无效的高度值".to_string())?;

    // 尝试解析 DPI（可能不存在或包含单位）
    // ImageMagick 的 %x 输出可能包含单位，如 "300" 或 "300/1" 或 "300 PixelsPerInch"
    // 对于多图层的 PSD 文件，可能有多行输出，尝试找到一个合理的 DPI 值
    let mut dpi = None;
    for line in lines.iter().skip(2) {
        let x_res_str = line.trim();
        if let Some(parsed_dpi) = x_res_str.split_whitespace().next().and_then(|s| {
            // 尝试提取数字部分
            let numeric_part = s.split('/')
                .next()
                .unwrap_or(s)
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>();

            numeric_part.parse::<u32>().ok()
        }) {
            // 检查 DPI 值是否合理（通常在 72-1200 之间）
            if parsed_dpi >= 72 && parsed_dpi <= 1200 {
                dpi = Some(parsed_dpi);
                break;
            }
        }
    }

    // 计算厘米高度
    let height_cm = if let Some(res) = dpi {
        // 使用图片中的 DPI
        (height as f64 / res as f64) * 2.54
    } else {
        // 没有DPI信息，使用默认 300 DPI
        (height as f64 / 300.0) * 2.54
    };

    Ok(TiffMetadata {
        file_path: file_path_str,
        file_name,
        width,
        height,
        height_cm,
        dpi,
        color_type: "RGB".to_string(),
        file_size,
    })
}

/// 获取 ImageMagick 可执行文件路径
fn get_imagemagick_path() -> Result<std::path::PathBuf, String> {
    println!("[ImageMagick] 开始查找 ImageMagick 可执行文件...");

    // 1. 优先查找打包的 ImageMagick（生产环境）
    if let Ok(exe_dir) = std::env::current_exe() {
        println!("[ImageMagick] 当前可执行文件路径: {}", exe_dir.display());
        if let Some(parent) = exe_dir.parent() {
            // Windows NSIS 打包路径：与 exe 同级的 resources 目录
            let bundled_path = parent.join("resources").join("imagemagick").join("magick.exe");
            println!("[ImageMagick] 检查打包路径: {}", bundled_path.display());
            if bundled_path.exists() {
                println!("[ImageMagick] ✓ 找到打包的 ImageMagick: {}", bundled_path.display());
                return Ok(bundled_path);
            }

            // macOS .app 打包路径
            let macos_bundled_path = parent.parent()
                .and_then(|p| Some(p.join("Resources").join("imagemagick").join("magick")));
            if let Some(path) = macos_bundled_path {
                if path.exists() {
                    println!("[ImageMagick] ✓ 找到 macOS 打包的 ImageMagick: {}", path.display());
                    return Ok(path);
                }
            }
        }
    }

    // 2. 开发环境：查找 src-tauri/resources/imagemagick
    if let Ok(current_dir) = std::env::current_dir() {
        println!("[ImageMagick] 当前工作目录: {}", current_dir.display());
        let dev_path = current_dir.join("src-tauri").join("resources").join("imagemagick").join("magick.exe");
        println!("[ImageMagick] 检查开发环境路径: {}", dev_path.display());
        if dev_path.exists() {
            println!("[ImageMagick] ✓ 找到开发环境的 ImageMagick: {}", dev_path.display());
            return Ok(dev_path);
        }
    }

    // 3. 查找系统 PATH 中的 magick 命令
    if let Ok(output) = std::process::Command::new("where")
        .args(["magick"])
        .output()
    {
        if output.status.success() {
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            let path = stdout_str.lines().next().unwrap_or("").trim();
            if !path.is_empty() && std::path::Path::new(path).exists() {
                return Ok(std::path::PathBuf::from(path));
            }
        }
    }

    // 4. Unix 系统使用 which 命令
    if let Ok(output) = std::process::Command::new("which")
        .args(["magick"])
        .output()
    {
        if output.status.success() {
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            let path = stdout_str.trim();
            if !path.is_empty() {
                return Ok(std::path::PathBuf::from(path));
            }
        }
    }

    Err("未找到 ImageMagick。请确保 ImageMagick 已正确打包或安装在系统中。".to_string())
}

/// 解析图片文件元数据（支持多种格式：TIFF/JPG/PNG/WEBP/BMP/GIF/PSD）
#[tauri::command]
pub async fn parse_tiff_file(file_path: String) -> Result<TiffMetadata, String> {
    let path = Path::new(&file_path);

    // 验证文件存在
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    // 使用 parse_image_file 支持多种格式
    parse_image_file(path)
}

// ============================================================
// 同步版本 TIFF 解析（供批量扫描使用）
// ============================================================

/// 解析 TIFF 文件元数据（同步版本，用于批量扫描）
pub fn parse_tiff_file_sync(file_path: &Path) -> Result<TiffMetadata, String> {
    let file_path_str = file_path.to_string_lossy().to_string();

    // 验证文件存在
    if !file_path.exists() {
        return Err("文件不存在".to_string());
    }

    // 获取文件名和大小
    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // 手动解析 TIFF 文件头获取元数据
    let mut file = std::fs::File::open(file_path).map_err(|e| e.to_string())?;

    // 读取 TIFF 头
    let mut header = [0u8; 8];
    file.read_exact(&mut header).map_err(|e| format!("读取文件头失败: {}", e))?;

    // 验证 TIFF 格式
    let is_little_endian = match &header[0..2] {
        [b'I', b'I'] => true,   // Little endian
        [b'M', b'M'] => false,  // Big endian
        _ => return Err("不是有效的 TIFF 文件".to_string()),
    };

    // 读取 IFD 偏移量（从字节 4-7）
    let ifd_offset = if is_little_endian {
        u32::from_le_bytes([header[4], header[5], header[6], header[7]])
    } else {
        u32::from_be_bytes([header[4], header[5], header[6], header[7]])
    };

    // 跳转到 IFD
    file.seek(SeekFrom::Start(ifd_offset as u64)).map_err(|e| format!("定位 IFD 失败: {}", e))?;

    // 读取条目数量（2 字节）
    let mut entry_count_bytes = [0u8; 2];
    file.read_exact(&mut entry_count_bytes).map_err(|e| format!("读取条目数量失败: {}", e))?;
    let entry_count = if is_little_endian {
        u16::from_le_bytes(entry_count_bytes)
    } else {
        u16::from_be_bytes(entry_count_bytes)
    } as usize;

    // TIFF 标签常量
    const TAG_IMAGE_WIDTH: u16 = 256;
    const TAG_IMAGE_LENGTH: u16 = 257;
    const TAG_X_RESOLUTION: u16 = 282;
    const TAG_Y_RESOLUTION: u16 = 283;
    const TAG_RESOLUTION_UNIT: u16 = 296;
    const TAG_SAMPLES_PER_PIXEL: u16 = 277;
    const TAG_BITS_PER_SAMPLE: u16 = 258;
    const TAG_PHOTOMETRIC_INTERPRETATION: u16 = 262;

    let mut width = 0u32;
    let mut height = 0u32;
    let mut x_resolution = None::<u32>;
    let mut y_resolution = None::<u32>;
    let mut resolution_unit = 2u16; // 默认为英寸
    let mut samples_per_pixel = 1u16;
    let mut _bits_per_sample = 8u16;
    let mut photometric_interpretation = 0u16;

    // 读取每个 IFD 条目（每个条目 12 字节）
    for _ in 0..entry_count {
        let mut entry = [0u8; 12];
        file.read_exact(&mut entry).map_err(|e| format!("读取 IFD 条目失败: {}", e))?;

        let tag = if is_little_endian {
            u16::from_le_bytes([entry[0], entry[1]])
        } else {
            u16::from_be_bytes([entry[0], entry[1]])
        };

        let field_type = if is_little_endian {
            u16::from_le_bytes([entry[2], entry[3]])
        } else {
            u16::from_be_bytes([entry[2], entry[3]])
        };

        let count = if is_little_endian {
            u32::from_le_bytes([entry[4], entry[5], entry[6], entry[7]])
        } else {
            u32::from_be_bytes([entry[4], entry[5], entry[6], entry[7]])
        };

        // 读取值（可能是偏移量或直接值）
        let value_offset = if is_little_endian {
            u32::from_le_bytes([entry[8], entry[9], entry[10], entry[11]])
        } else {
            u32::from_be_bytes([entry[8], entry[9], entry[10], entry[11]])
        };

        // 根据标签提取信息
        match tag {
            TAG_IMAGE_WIDTH => {
                width = if field_type == 3 && count == 1 {
                    // SHORT 类型，直接存储
                    value_offset
                } else if field_type == 4 {
                    // LONG 类型
                    if count == 1 {
                        value_offset
                    } else {
                        // 读取偏移量
                        read_u32_at_sync(&mut file, value_offset, is_little_endian)?
                    }
                } else {
                    return Err(format!("不支持的 ImageWidth 类型: {}", field_type));
                };
            }
            TAG_IMAGE_LENGTH => {
                height = if field_type == 3 && count == 1 {
                    value_offset
                } else if field_type == 4 {
                    if count == 1 {
                        value_offset
                    } else {
                        read_u32_at_sync(&mut file, value_offset, is_little_endian)?
                    }
                } else {
                    return Err(format!("不支持的 ImageLength 类型: {}", field_type));
                };
            }
            TAG_X_RESOLUTION => {
                // X_RESOLUTION 是一个有理数（分子/分母，各 4 字节）
                let num = read_u32_at_sync(&mut file, value_offset, is_little_endian)?;
                let den = read_u32_at_sync(&mut file, value_offset + 4, is_little_endian)?;
                if den > 0 {
                    x_resolution = Some(num / den);
                }
            }
            TAG_Y_RESOLUTION => {
                // Y_RESOLUTION 是一个有理数（分子/分母，各 4 字节）
                let num = read_u32_at_sync(&mut file, value_offset, is_little_endian)?;
                let den = read_u32_at_sync(&mut file, value_offset + 4, is_little_endian)?;
                if den > 0 {
                    y_resolution = Some(num / den);
                }
            }
            TAG_SAMPLES_PER_PIXEL => {
                samples_per_pixel = if count == 1 {
                    value_offset as u16
                } else {
                    read_u16_at_sync(&mut file, value_offset, is_little_endian)?
                };
            }
            TAG_BITS_PER_SAMPLE => {
                _bits_per_sample = if count == 1 {
                    value_offset as u16
                } else {
                    read_u16_at_sync(&mut file, value_offset, is_little_endian)?
                };
            }
            TAG_PHOTOMETRIC_INTERPRETATION => {
                photometric_interpretation = value_offset as u16;
            }
            TAG_RESOLUTION_UNIT => {
                resolution_unit = if count == 1 && field_type == 3 {
                    // SHORT 类型，值直接在 value_offset 中
                    value_offset as u16
                } else {
                    // 读取偏移量处的值
                    read_u16_at_sync(&mut file, value_offset, is_little_endian)?
                };
            }
            _ => {}
        }
    }

    // 确定颜色类型
    let color_type_str = match (samples_per_pixel, photometric_interpretation) {
        (1, 0 | 1) => "Grayscale",
        (1, _) => "Unknown",
        (3, 2) => "RGB",
        (4, 2) => "RGBA",
        (4, 5) => "CMYK",
        _ => {
            if samples_per_pixel == 4 {
                "CMYK (likely)"
            } else if samples_per_pixel == 3 {
                "RGB"
            } else {
                "Unknown"
            }
        }
    }.to_string();

    let dpi = x_resolution.or(y_resolution);

    // 计算厘米高度
    // resolution_unit: 1=无单位, 2=英寸, 3=厘米
    let height_cm = if let Some(res) = dpi {
        let resolution = res as f64;
        match resolution_unit {
            1 => {
                // 无单位，假设 300 DPI
                (height as f64 / 300.0) * 2.54
            }
            2 => {
                // 英寸：像素 / DPI × 2.54 = 厘米
                (height as f64 / resolution) * 2.54
            }
            3 => {
                // 厘米：直接像素 / 分辨率
                height as f64 / resolution
            }
            _ => {
                // 默认按英寸处理
                (height as f64 / resolution) * 2.54
            }
        }
    } else {
        // 没有分辨率信息，使用默认 300 DPI
        (height as f64 / 300.0) * 2.54
    };

    Ok(TiffMetadata {
        file_path: file_path_str,
        file_name,
        width,
        height,
        height_cm,
        dpi,
        color_type: color_type_str,
        file_size,
    })
}

/// 在指定偏移量处读取 u32（同步版本）
fn read_u32_at_sync(file: &mut std::fs::File, offset: u32, is_little_endian: bool) -> Result<u32, String> {
    let current_pos = file.stream_position().map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset as u64)).map_err(|e| e.to_string())?;
    let mut bytes = [0u8; 4];
    file.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(current_pos)).map_err(|e| e.to_string())?;
    Ok(if is_little_endian {
        u32::from_le_bytes(bytes)
    } else {
        u32::from_be_bytes(bytes)
    })
}

/// 在指定偏移量处读取 u16（同步版本）
fn read_u16_at_sync(file: &mut std::fs::File, offset: u32, is_little_endian: bool) -> Result<u16, String> {
    let current_pos = file.stream_position().map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset as u64)).map_err(|e| e.to_string())?;
    let mut bytes = [0u8; 2];
    file.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(current_pos)).map_err(|e| e.to_string())?;
    Ok(if is_little_endian {
        u16::from_le_bytes(bytes)
    } else {
        u16::from_be_bytes(bytes)
    })
}
