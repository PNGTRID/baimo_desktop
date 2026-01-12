use crate::models::TiffMetadata;
use std::path::Path;
use std::io::{Read, Seek, SeekFrom};

/// 解析 TIFF 文件元数据
#[tauri::command]
pub async fn parse_tiff_file(file_path: String) -> Result<TiffMetadata, String> {
    let path = Path::new(&file_path);

    // 验证文件存在
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    // 获取文件名和大小
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(&file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // 手动解析 TIFF 文件头获取元数据
    let mut file = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;

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
                        read_u32_at(&mut file, value_offset, is_little_endian)?
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
                        read_u32_at(&mut file, value_offset, is_little_endian)?
                    }
                } else {
                    return Err(format!("不支持的 ImageLength 类型: {}", field_type));
                };
            }
            TAG_X_RESOLUTION => {
                // X_RESOLUTION 是一个有理数（分子/分母，各 4 字节）
                let num = read_u32_at(&mut file, value_offset, is_little_endian)?;
                let den = read_u32_at(&mut file, value_offset + 4, is_little_endian)?;
                if den > 0 {
                    x_resolution = Some(num / den);
                }
            }
            TAG_Y_RESOLUTION => {
                // Y_RESOLUTION 是一个有理数（分子/分母，各 4 字节）
                let num = read_u32_at(&mut file, value_offset, is_little_endian)?;
                let den = read_u32_at(&mut file, value_offset + 4, is_little_endian)?;
                if den > 0 {
                    y_resolution = Some(num / den);
                }
            }
            TAG_SAMPLES_PER_PIXEL => {
                samples_per_pixel = if count == 1 {
                    value_offset as u16
                } else {
                    read_u16_at(&mut file, value_offset, is_little_endian)?
                };
            }
            TAG_BITS_PER_SAMPLE => {
                _bits_per_sample = if count == 1 {
                    value_offset as u16
                } else {
                    read_u16_at(&mut file, value_offset, is_little_endian)?
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
                    read_u16_at(&mut file, value_offset, is_little_endian)?
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
        file_path,
        file_name,
        width,
        height,
        height_cm,
        dpi,
        color_type: color_type_str,
        file_size,
    })
}

/// 在指定偏移量处读取 u32
fn read_u32_at(file: &mut std::fs::File, offset: u32, is_little_endian: bool) -> Result<u32, String> {
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

/// 在指定偏移量处读取 u16
fn read_u16_at(file: &mut std::fs::File, offset: u32, is_little_endian: bool) -> Result<u16, String> {
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
