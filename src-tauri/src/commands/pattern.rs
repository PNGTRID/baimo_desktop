use crate::models::{
    CreatePatternFromTiffRequest, CreatePatternRequest, Pattern,
    ScanFolderRequest, FolderScanResult, ScanError,
};
use crate::services::Database;
use crate::commands::tiff::parse_tiff_file_sync;
use tauri::State;
use walkdir::WalkDir;
use std::path::{Path, PathBuf};
use std::collections::HashMap;

// 生成图案编号
fn generate_code() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    format!("PAT{:08}", timestamp % 100000000)
}

// 获取所有图案
#[tauri::command]
pub async fn get_patterns(db: State<'_, Database>) -> Result<Vec<Pattern>, String> {
    db.sqlite().query_map(
        "SELECT id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                localFilePath, customerId, folder_id, preview_image, color_type, isActive, createdAt, updatedAt
         FROM patterns ORDER BY createdAt DESC",
        &[],
        |row: &rusqlite::Row| {
            Ok(Pattern {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                actual_height: row.get(3)?,
                bleed_height: row.get(4)?,
                units_per_row: row.get(5)?,
                row_count: row.get(6)?,
                local_file_path: row.get(7)?,
                customer_id: row.get(8)?,
                folder_id: row.get(9)?,
                preview_image: row.get(10)?,
                color_type: row.get(11)?,
                is_active: row.get(12)?,
                created_at: row.get::<_, i64>(13)?.to_string(),
                updated_at: row.get::<_, i64>(14)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch patterns: {:?}", e))
}

// 根据 ID 获取图案
#[tauri::command]
pub async fn get_pattern_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<Pattern>, String> {
    let result = db.sqlite().query_row(
        "SELECT id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                localFilePath, customerId, folder_id, preview_image, color_type, isActive, createdAt, updatedAt
         FROM patterns WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row: &rusqlite::Row| {
            Ok(Pattern {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                actual_height: row.get(3)?,
                bleed_height: row.get(4)?,
                units_per_row: row.get(5)?,
                row_count: row.get(6)?,
                local_file_path: row.get(7)?,
                customer_id: row.get(8)?,
                folder_id: row.get(9)?,
                preview_image: row.get(10)?,
                color_type: row.get(11)?,
                is_active: row.get(12)?,
                created_at: row.get::<_, i64>(13)?.to_string(),
                updated_at: row.get::<_, i64>(14)?.to_string(),
            })
        },
    );

    match result {
        Ok(pattern) => Ok(pattern),
        Err(e) => Err(format!("Failed to fetch pattern: {:?}", e)),
    }
}

// 创建图案
#[tauri::command]
pub async fn create_pattern(
    request: CreatePatternRequest,
    db: State<'_, Database>,
) -> Result<Pattern, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let code = request.code.unwrap_or_else(generate_code);
    let now = chrono::Utc::now().timestamp();

    // 如果提供了 customer_id，自动查找该客户的根文件夹
    let folder_id: Option<String> = if let Some(ref customer_id) = request.customer_id {
        db.sqlite().query_row(
            "SELECT id FROM pattern_folders WHERE customer_id = ?1 AND parent_id IS NULL",
            &[customer_id as &dyn rusqlite::ToSql],
            |row| row.get::<_, String>(0),
        ).ok().flatten()
    } else {
        None
    };

    db.sqlite().execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                               localFilePath, customerId, folder_id, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        &[
            &id as &dyn rusqlite::ToSql,
            &request.name,
            &code,
            &(request.actual_height.unwrap_or(100.0)),
            &(request.bleed_height.unwrap_or(20.0)),
            &(request.units_per_row.unwrap_or(10)),
            &(request.row_count.unwrap_or(10)),
            &request.local_file_path,
            &request.customer_id,
            &folder_id,
            &true, // isActive
            &now,
            &now,
        ],
    ).map_err(|e| format!("Failed to create pattern: {:?}", e))?;

    // 获取刚创建的图案
    get_pattern_by_id(id, db).await.map(|p| p.unwrap())
}

// 从 TIFF 文件创建图案
#[tauri::command]
pub async fn create_pattern_from_tiff(
    request: CreatePatternFromTiffRequest,
    db: State<'_, Database>,
) -> Result<Pattern, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let code = generate_code();
    let now = chrono::Utc::now().timestamp();

    // 尝试生成缩略图（200px 最大边）
    let preview_image = generate_thumbnail_from_file(&request.local_file_path, 200).ok();

    // 如果提供了 customer_id，自动查找该客户的根文件夹
    let folder_id: Option<String> = if let Some(ref customer_id) = request.customer_id {
        db.sqlite().query_row(
            "SELECT id FROM pattern_folders WHERE customer_id = ?1 AND parent_id IS NULL",
            &[customer_id as &dyn rusqlite::ToSql],
            |row| row.get::<_, String>(0),
        ).ok().flatten()
    } else {
        None
    };

    db.sqlite().execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                               localFilePath, customerId, folder_id, preview_image, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        &[
            &id as &dyn rusqlite::ToSql,
            &request.name,
            &code,
            &request.actual_height,
            &2.0,  // 默认出血高度 (cm)
            &10,   // 默认每行个数
            &10,   // 默认行数
            &Some(request.local_file_path.clone()),
            &request.customer_id,
            &folder_id,
            &preview_image,
            &true, // isActive
            &now,
            &now,
        ],
    ).map_err(|e| format!("Failed to create pattern from tiff: {:?}", e))?;

    // 获取刚创建的图案
    get_pattern_by_id(id, db).await.map(|p| p.unwrap())
}

// 更新图案
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_pattern(
    id: String,
    name: Option<String>,
    actual_height: Option<f64>,
    bleed_height: Option<f64>,
    units_per_row: Option<i32>,
    row_count: Option<i32>,
    is_active: Option<bool>,
    customer_id: Option<String>,  // 空字符串表示清除客户，Some(id) 表示设置，None 表示不更新
    db: State<'_, Database>,
) -> Result<Option<Pattern>, String> {
    // 在块作用域内执行更新，确保 params_refs 不跨越 await
    {
        // 构建动态 UPDATE 语句
        let mut updates = vec![];
        let mut params: Vec<Box<dyn rusqlite::ToSql + Send + Sync>> = vec![];

        if let Some(ref n) = name {
            updates.push("name = ?");
            params.push(Box::new(n.clone()));
        }
        if let Some(h) = actual_height {
            updates.push("actualHeight = ?");
            params.push(Box::new(h));
        }
        if let Some(h) = bleed_height {
            updates.push("bleedHeight = ?");
            params.push(Box::new(h));
        }
        if let Some(u) = units_per_row {
            updates.push("unitsPerRow = ?");
            params.push(Box::new(u));
        }
        if let Some(r) = row_count {
            updates.push("rowCount = ?");
            params.push(Box::new(r));
        }
        if let Some(a) = is_active {
            updates.push("isActive = ?");
            params.push(Box::new(a));
        }
        // 处理 customer_id: 空字符串表示清除，非空表示设置
        // 同时自动同步 folder_id（客户的根文件夹）
        if let Some(ref cid) = customer_id {
            updates.push("customerId = ?");
            if cid.is_empty() {
                // 清除客户时，同时清除 folder_id
                params.push(Box::new(Option::<String>::None));
                updates.push("folder_id = ?");
                params.push(Box::new(Option::<String>::None));
            } else {
                // 设置客户时，查找并设置该客户的根文件夹
                params.push(Box::new(cid.clone()));

                // 查找该客户的根文件夹（parent_id IS NULL）
                let folder_id: Option<String> = db.sqlite().query_row(
                    "SELECT id FROM pattern_folders WHERE customer_id = ?1 AND parent_id IS NULL",
                    &[cid as &dyn rusqlite::ToSql],
                    |row| row.get::<_, String>(0),
                ).ok().flatten();

                if let Some(ref fid) = folder_id {
                    updates.push("folder_id = ?");
                    params.push(Box::new(fid.clone()));
                }
            }
        }

        if updates.is_empty() {
            return Ok(None);
        }

        updates.push("updatedAt = ?");
        params.push(Box::new(chrono::Utc::now().timestamp()));

        let sql = format!("UPDATE patterns SET {} WHERE id = ?", updates.join(", "));

        // 执行更新
        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter()
            .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
            .chain(std::iter::once(&id as &dyn rusqlite::ToSql))
            .collect();

        db.sqlite().execute(&sql, &params_refs)
            .map_err(|e| format!("Failed to update pattern: {:?}", e))?;
    }

    // 返回更新后的图案
    get_pattern_by_id(id, db).await
}

// 删除图案
#[tauri::command]
pub async fn delete_pattern(
    id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    db.sqlite().execute(
        "DELETE FROM patterns WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to delete pattern: {:?}", e))?;

    Ok(true)
}

// 获取图案图片（从本地文件读取并转换为可显示的格式）
#[tauri::command]
pub async fn get_pattern_image(file_path: String) -> Result<String, String> {
    use std::fs;
    use std::io::Cursor;
    use base64::{Engine as _, engine::general_purpose};

    // 读取文件
    let contents = fs::read(&file_path)
        .map_err(|e| format!("无法读取图片文件: {}", e))?;

    // 检查文件扩展名
    let is_tiff = file_path.to_lowercase().ends_with(".tif") ||
                  file_path.to_lowercase().ends_with(".tiff");

    let png_bytes = if is_tiff {
        // 对于 TIFF 文件，尝试使用 tiff crate 读取
        convert_tiff_to_png(&contents)?
    } else {
        // 其他格式，尝试用 image crate 直接加载
        let img = image::load_from_memory_with_format(&contents, image::ImageFormat::Tiff)
            .or_else(|_| image::load_from_memory_with_format(&contents, image::ImageFormat::Png))
            .or_else(|_| image::load_from_memory_with_format(&contents, image::ImageFormat::Jpeg))
            .map_err(|e| format!("无法识别的图片格式: {}", e))?;

        // 转换为 RGB
        let rgb_img = img.to_rgb8();

        // 编码为 PNG
        let mut bytes = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);
        rgb_img.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
        bytes
    };

    let base64_string = general_purpose::STANDARD.encode(&png_bytes);
    Ok(format!("data:image/png;base64,{}", base64_string))
}

// 辅助函数：将 TIFF 数据转换为 PNG
fn convert_tiff_to_png(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    // 方法1：尝试使用 image crate（支持 RGB/RGBA TIFF）
    if let Ok(img) = image::load_from_memory_with_format(data, image::ImageFormat::Tiff) {
        let rgb_img = img.to_rgb8();
        let mut png_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut png_bytes);
        rgb_img.write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
        return Ok(png_bytes);
    }

    // 方法2：尝试使用 tiff crate 读取
    let cursor = Cursor::new(data);

    match tiff::decoder::Decoder::new(cursor) {
        Ok(mut decoder) => {
            let dimensions = decoder.dimensions()
                .map_err(|e| format!("无法获取尺寸: {}", e))?;
            let width = dimensions.0;
            let height = dimensions.1;

            // 尝试读取图像数据
            match decoder.read_image() {
                Ok(img_data) => {
                    // tiff crate 成功读取并解压了数据
                    if let tiff::decoder::DecodingResult::U8(data) = img_data {
                        // 检测通道数并转换为 RGB
                        let samples_per_pixel = (data.len() / ((width * height) as usize)).max(1);
                        let rgb_data = convert_multi_channel_to_rgb(&data, width, height, samples_per_pixel);
                        encode_rgb_to_png(width, height, rgb_data)
                    } else {
                        return Err("不支持的数据格式".to_string());
                    }
                }
                Err(e) => {
                    // tiff crate 无法读取（可能是 5 通道 CMYK 等不支持的格式）
                    // 尝试手动解析，让 tiff crate 处理 LZW 解压
                    let error_str = e.to_string();

                    // 如果错误是"不支持的颜色类型"，尝试使用手动解析
                    if error_str.contains("unsupported") || error_str.contains("is unsupported") {
                        match convert_multi_channel_cmyk_to_png(data) {
                            Ok(png) => return Ok(png),
                            Err(manual_err) => {
                                // 手动解析失败，尝试 ImageMagick
                                match convert_tiff_with_imagemagick(data) {
                                    Ok(png) => return Ok(png),
                                    Err(imagick_err) => {
                                        return Err(format!("tiff crate 不支持此格式: {} (手动解析失败: {}, ImageMagick 失败: {})", e, manual_err, imagick_err));
                                    }
                                }
                            }
                        }
                    } else {
                        Err(format!("无法读取图像: {}", e))
                    }
                }
            }
        }
        Err(e) => {
            // 最后尝试手动解析多通道 CMYK，如果失败则尝试 ImageMagick
            match convert_multi_channel_cmyk_to_png(data) {
                Ok(png) => return Ok(png),
                Err(manual_err) => {
                    match convert_tiff_with_imagemagick(data) {
                        Ok(png) => return Ok(png),
                        Err(imagick_err) => {
                            return Err(format!("TIFF 解析失败: {} (手动解析失败: {}, ImageMagick 失败: {})", e, manual_err, imagick_err));
                        }
                    }
                }
            }
        }
    }
}

// 将任意通道的数据转换为 RGB（支持 CMYK, RGB, 灰度等）
fn convert_multi_channel_to_rgb(data: &[u8], width: u32, height: u32, samples_per_pixel: usize) -> Vec<u8> {
    let mut rgb = Vec::with_capacity((width * height) as usize * 3);

    match samples_per_pixel {
        1 => {
            // 灰度 -> RGB
            for &gray in data {
                rgb.extend(&[gray, gray, gray]);
            }
        }
        3 => {
            // RGB -> RGB (直接复制)
            rgb.extend_from_slice(data);
        }
        4 => {
            // CMYK -> RGB
            for chunk in data.chunks(4) {
                let c = chunk[0] as f32;
                let m = chunk[1] as f32;
                let y = chunk[2] as f32;
                let k = chunk[3] as f32;

                let r = ((255.0 - c) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;
                let g = ((255.0 - m) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;
                let b = ((255.0 - y) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;

                rgb.extend(&[r, g, b]);
            }
        }
        _ => {
            // 5+ 通道（CMYK + 专色），只使用前 4 个通道
            for chunk in data.chunks(samples_per_pixel) {
                if chunk.len() >= 4 {
                    let c = chunk[0] as f32;
                    let m = chunk[1] as f32;
                    let y = chunk[2] as f32;
                    let k = chunk[3] as f32;

                    let r = ((255.0 - c) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;
                    let g = ((255.0 - m) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;
                    let b = ((255.0 - y) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;

                    rgb.extend(&[r, g, b]);
                }
            }
        }
    }

    rgb
}

// 编码 RGB 数据为 PNG
fn encode_rgb_to_png(width: u32, height: u32, rgb_data: Vec<u8>) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    let img = image::RgbImage::from_raw(width, height, rgb_data)
        .ok_or("无法创建 RGB 图像")?;

    let mut png_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut png_bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("PNG 编码失败: {}", e))?;

    Ok(png_bytes)
}

// 手动解析多通道 CMYK TIFF（支持 5+ 通道，如 CMYK + 专色）
fn convert_multi_channel_cmyk_to_png(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::io::{Cursor, Read, Seek, SeekFrom};

    let mut cursor = Cursor::new(data);

    // 读取 TIFF 头
    let mut header = [0u8; 8];
    cursor.read_exact(&mut header).map_err(|e| format!("读取头失败: {}", e))?;

    let is_little_endian = match &header[0..2] {
        [b'I', b'I'] => true,
        [b'M', b'M'] => false,
        _ => return Err("不是有效的 TIFF 文件".to_string()),
    };

    let read_u16 = |bytes: &[u8]| -> u16 {
        if is_little_endian {
            u16::from_le_bytes([bytes[0], bytes[1]])
        } else {
            u16::from_be_bytes([bytes[0], bytes[1]])
        }
    };

    let read_u32 = |bytes: &[u8]| -> u32 {
        if is_little_endian {
            u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
        } else {
            u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
        }
    };

    let ifd_offset = read_u32(&header[4..8]);
    cursor.seek(SeekFrom::Start(ifd_offset as u64)).map_err(|e| e.to_string())?;

    let mut entry_count_bytes = [0u8; 2];
    cursor.read_exact(&mut entry_count_bytes).map_err(|e| e.to_string())?;
    let entry_count = read_u16(&entry_count_bytes) as usize;

    // TIFF 标签
    const TAG_IMAGE_WIDTH: u16 = 256;
    const TAG_IMAGE_LENGTH: u16 = 257;
    const TAG_COMPRESSION: u16 = 259;
    const TAG_PHOTOMETRIC: u16 = 262;
    const TAG_PREDICTOR: u16 = 317; // 水平预测器（常用于 LZW 压缩）
    const TAG_STRIP_OFFSETS: u16 = 273;
    const TAG_SAMPLES_PER_PIXEL: u16 = 277;
    const TAG_STRIP_BYTE_COUNTS: u16 = 279;

    let mut width = 0u32;
    let mut height = 0u32;
    let mut samples_per_pixel = 4u16;
    let mut compression = 1u16;
    let mut _photometric = 5u16; // CMYK
    let mut predictor = 1u16; // 1 = 无预测器, 2 = 水平预测器
    let mut strip_offsets: Vec<u32> = Vec::new();
    let mut strip_byte_counts: Vec<u32> = Vec::new();

    // 解析 IFD 条目
    for _ in 0..entry_count {
        let mut entry = [0u8; 12];
        cursor.read_exact(&mut entry).map_err(|e| e.to_string())?;

        let tag = read_u16(&entry[0..2]);
        let field_type = read_u16(&entry[2..4]);
        let count = read_u32(&entry[4..8]);
        let value_offset = read_u32(&entry[8..12]);

        match tag {
            TAG_IMAGE_WIDTH => width = value_offset,
            TAG_IMAGE_LENGTH => height = value_offset,
            TAG_SAMPLES_PER_PIXEL => samples_per_pixel = value_offset as u16,
            TAG_COMPRESSION => compression = value_offset as u16,
            TAG_PHOTOMETRIC => _photometric = value_offset as u16,
            TAG_PREDICTOR => predictor = value_offset as u16,
            TAG_STRIP_OFFSETS => {
                strip_offsets = read_offset_array(&mut cursor, value_offset, count, field_type, is_little_endian)?;
            }
            TAG_STRIP_BYTE_COUNTS => {
                strip_byte_counts = read_offset_array(&mut cursor, value_offset, count, field_type, is_little_endian)?;
            }
            _ => {}
        }
    }

    if width == 0 || height == 0 {
        return Err("无法获取图像尺寸".to_string());
    }

    // 支持无压缩(1) 和 LZW(5) 压缩
    if compression != 1 && compression != 5 {
        return Err(format!("不支持的压缩格式: {} (仅支持无压缩和LZW)", compression));
    }

    // 读取图像数据
    let pixel_count = (width * height) as usize;
    let bytes_per_pixel = samples_per_pixel as usize;
    let expected_size = pixel_count * bytes_per_pixel;
    let mut raw_data = Vec::with_capacity(expected_size);

    for (i, &offset) in strip_offsets.iter().enumerate() {
        let byte_count = strip_byte_counts.get(i).copied().unwrap_or(0) as usize;
        if byte_count == 0 {
            continue;
        }

        cursor.seek(SeekFrom::Start(offset as u64)).map_err(|e| e.to_string())?;
        let mut strip_data = vec![0u8; byte_count];
        cursor.read_exact(&mut strip_data).map_err(|e| e.to_string())?;

        if compression == 5 {
            // LZW 解压缩
            match decompress_lzw(&strip_data) {
                Ok(decompressed) => raw_data.extend(decompressed),
                Err(lzw_err) => {
                    // LZW 解压失败，尝试使用 ImageMagick 转换整个 TIFF
                    return convert_tiff_with_imagemagick(data)
                        .map_err(|e| format!("LZW 解压失败，尝试 ImageMagick 也失败: {} (LZW 错误: {})", e, lzw_err));
                }
            }
        } else {
            raw_data.extend(strip_data);
        }
    }

    // 如果使用水平预测器（Predictor = 2），需要应用逆变换
    // 水平预测器：每行第一个像素不变，后续像素 = 当前值 + 前一个像素
    if predictor == 2 {
        apply_horizontal_predictor(&mut raw_data, width as usize, bytes_per_pixel);
    }

    // 转换为 RGB（只使用前 4 个通道：CMYK，忽略专色）
    let mut rgb = Vec::with_capacity(pixel_count * 3);
    for chunk in raw_data.chunks(bytes_per_pixel) {
        if chunk.len() >= 4 {
            let c = chunk[0] as f32;
            let m = chunk[1] as f32;
            let y = chunk[2] as f32;
            let k = chunk[3] as f32;

            let r = ((255.0 - c) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;
            let g = ((255.0 - m) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;
            let b = ((255.0 - y) * (255.0 - k) / 255.0).clamp(0.0, 255.0) as u8;

            rgb.extend(&[r, g, b]);
        }
    }

    encode_rgb_to_png(width, height, rgb)
}

// 读取偏移量数组
fn read_offset_array(
    cursor: &mut std::io::Cursor<&[u8]>,
    value_offset: u32,
    count: u32,
    field_type: u16,
    is_little_endian: bool,
) -> Result<Vec<u32>, String> {
    use std::io::{Read, Seek, SeekFrom};

    let current_pos = cursor.position();

    let result = if count == 1 {
        vec![value_offset]
    } else {
        cursor.seek(SeekFrom::Start(value_offset as u64)).map_err(|e| e.to_string())?;

        let mut values = Vec::with_capacity(count as usize);
        for _ in 0..count {
            let value = if field_type == 3 {
                // SHORT
                let mut bytes = [0u8; 2];
                cursor.read_exact(&mut bytes).map_err(|e| e.to_string())?;
                if is_little_endian {
                    u16::from_le_bytes(bytes) as u32
                } else {
                    u16::from_be_bytes(bytes) as u32
                }
            } else {
                // LONG
                let mut bytes = [0u8; 4];
                cursor.read_exact(&mut bytes).map_err(|e| e.to_string())?;
                if is_little_endian {
                    u32::from_le_bytes(bytes)
                } else {
                    u32::from_be_bytes(bytes)
                }
            };
            values.push(value);
        }
        values
    };

    cursor.seek(SeekFrom::Start(current_pos)).map_err(|e| e.to_string())?;
    Ok(result)
}

// LZW 解压缩（TIFF 使用 MSB-first, 初始码长 9）
// TIFF 6.0 规范：LZW 压缩的每个 strip 前可能有 1 字节的"改变码长"标记
fn decompress_lzw(data: &[u8]) -> Result<Vec<u8>, String> {
    use weezl::{decode::Decoder, BitOrder};

    if data.is_empty() {
        return Ok(Vec::new());
    }

    // TIFF LZW 标准要求初始码长为 9（不是 8！）
    // 参考 TIFF 6.0 规范：LZW 压缩使用 9 位初始码长
    const TIFF_LZW_MIN_CODE_SIZE: u8 = 9;

    // 检查是否需要跳过 TIFF LZW 前导字节
    // TIFF 规范允许每个压缩 strip 前有一个 1 字节的值，指示初始 LZW 码长
    // 通常这个值是 0x00 (无变化) 或 0x09 (初始码长为 9)
    let should_skip = data.len() > 1 && (data[0] == 0x00 || data[0] == 0x09 || data[0] == 0x08);

    // 方式1: 尝试跳过前导字节（TIFF LZW 常见格式）
    if should_skip {
        let mut decoder = Decoder::new(BitOrder::Msb, TIFF_LZW_MIN_CODE_SIZE);
        let mut output = Vec::new();
        let result = decoder.into_vec(&mut output).decode_all(&data[1..]);

        if result.status.is_ok() && !output.is_empty() {
            return Ok(output);
        }
    }

    // 方式2: 不跳过前导字节，直接解压
    let mut decoder = Decoder::new(BitOrder::Msb, TIFF_LZW_MIN_CODE_SIZE);
    let mut output = Vec::new();
    let result = decoder.into_vec(&mut output).decode_all(data);

    if result.status.is_ok() && !output.is_empty() {
        return Ok(output);
    }

    // 方式3: 尝试使用 8 位初始码长（某些非标准 TIFF 可能使用）
    let mut decoder = Decoder::new(BitOrder::Msb, 8);
    let mut output_alt = Vec::new();
    let result_alt = decoder.into_vec(&mut output_alt).decode_all(data);

    if result_alt.status.is_ok() && !output_alt.is_empty() {
        return Ok(output_alt);
    }

    // 所有方式都失败，返回详细的错误信息
    Err(format!(
        "LZW 解压失败。数据长度: {}, 首字节: 0x{:02X}, 错误(码长9): {:?}, 错误(码长8): {:?}",
        data.len(),
        data.first().unwrap_or(&0),
        result.status,
        result_alt.status
    ))
}

// 应用水平预测器逆变换（TIFF Predictor = 2）
// 水平预测器：每行第一个像素不变，后续像素 = 当前值 + 前一个像素（mod 256）
fn apply_horizontal_predictor(data: &mut [u8], width: usize, bytes_per_pixel: usize) {
    let row_size = width * bytes_per_pixel;

    for row_start in (0..data.len()).step_by(row_size) {
        let row_end = (row_start + row_size).min(data.len());

        // 处理每一行
        for i in (row_start + 1)..row_end {
            data[i] = data[i].wrapping_add(data[i - 1]);
        }
    }
}

// 生成缩略图（返回 base64 编码的 PNG）
fn generate_thumbnail(data: &[u8], max_size: u32) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::io::Cursor;

    // 先转换为 PNG
    let png_data = convert_tiff_to_png(data)?;

    // 加载 PNG 并缩放
    let img = image::load_from_memory(&png_data)
        .map_err(|e| format!("加载图片失败: {}", e))?;

    // 计算缩放后的尺寸（保持宽高比）
    let (orig_w, orig_h) = (img.width(), img.height());
    let scale = (max_size as f32 / orig_w.max(orig_h) as f32).min(1.0);
    let new_w = (orig_w as f32 * scale) as u32;
    let new_h = (orig_h as f32 * scale) as u32;

    // 缩放图片
    let thumbnail = img.thumbnail(new_w, new_h);

    // 编码为 PNG
    let mut thumb_bytes = Vec::new();
    let mut cursor = Cursor::new(&mut thumb_bytes);
    thumbnail.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("缩略图编码失败: {}", e))?;

    // 返回 base64 数据 URL
    let base64_str = general_purpose::STANDARD.encode(&thumb_bytes);
    Ok(format!("data:image/png;base64,{}", base64_str))
}

// 从文件路径生成缩略图
pub fn generate_thumbnail_from_file(file_path: &str, max_size: u32) -> Result<String, String> {
    let contents = std::fs::read(file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    generate_thumbnail(&contents, max_size)
}

// ============================================================
// 批量扫描功能
// ============================================================

/// 批量扫描文件夹中的 TIFF 文件
#[tauri::command]
pub async fn scan_folder_for_patterns(
    request: ScanFolderRequest,
    db: State<'_, Database>,
) -> Result<FolderScanResult, String> {
    let base_path = Path::new(&request.folder_path);

    // 验证文件夹存在
    if !base_path.exists() {
        return Err("文件夹不存在".to_string());
    }

    if !base_path.is_dir() {
        return Err("提供的路径不是文件夹".to_string());
    }

    let mut total_found = 0i32;
    let mut imported = 0i32;
    let mut skipped = 0i32;
    let mut failed = 0i32;
    let mut errors = Vec::new();

    // 用于缓存已创建的文件夹，避免重复创建
    let mut folder_cache: HashMap<String, String> = HashMap::new();

    // 第一步：遍历所有 TIFF 文件
    let mut tiff_files: Vec<PathBuf> = Vec::new();

    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            if ext == "tif" || ext == "tiff" {
                tiff_files.push(path.to_path_buf());
                total_found += 1;
            }
        }
    }

    // 第二步：批量处理文件
    for tiff_path in tiff_files {
        match process_single_tiff(
            &tiff_path,
            base_path,
            &request,
            &db,
            &mut folder_cache,
        ).await {
            Ok(ProcessResult::Imported) => imported += 1,
            Ok(ProcessResult::Skipped) => skipped += 1,
            Err(e) => {
                failed += 1;
                errors.push(ScanError {
                    file_path: tiff_path.to_string_lossy().to_string(),
                    error: e,
                });
            }
        }
    }

    Ok(FolderScanResult {
        total_found,
        imported,
        skipped,
        failed,
        errors,
    })
}

/// 处理结果
enum ProcessResult {
    Imported,
    Skipped,
}

/// 处理单个 TIFF 文件
async fn process_single_tiff(
    tiff_path: &Path,
    base_path: &Path,
    request: &ScanFolderRequest,
    db: &Database,
    folder_cache: &mut HashMap<String, String>,
) -> Result<ProcessResult, String> {
    let file_path_str = tiff_path.to_string_lossy().to_string();

    // 检查是否已存在
    let existing_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM patterns WHERE localFilePath = ?1",
        &[&file_path_str as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("查询失败: {:?}", e))?.unwrap_or(0);

    if existing_count > 0 {
        return Ok(ProcessResult::Skipped);
    }

    // 解析 TIFF 元数据
    let metadata = parse_tiff_file_sync(tiff_path)?;

    // 获取或创建文件夹
    let folder_id = get_or_create_folder(
        tiff_path.parent(),
        base_path,
        request,
        db,
        folder_cache,
    ).await?;

    // 创建图案
    let pattern_name = tiff_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let id = uuid::Uuid::new_v4().to_string();
    let code = generate_code();
    let now = chrono::Utc::now().timestamp();

    // 尝试生成缩略图（200px 最大边，批量导入时忽略失败）
    let preview_image = generate_thumbnail_from_file(&file_path_str, 200).ok();

    db.sqlite().execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                               localFilePath, customerId, folder_id, preview_image, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        &[
            &id as &dyn rusqlite::ToSql,
            &pattern_name,
            &code,
            &metadata.height_cm,  // 高度(cm)
            &2.0,   // 默认出血高度 (cm)
            &10,    // 默认每行个数
            &10,    // 默认行数
            &Some(file_path_str),
            &request.customer_id,
            &Some(folder_id),
            &preview_image,
            &true,
            &now,
            &now,
        ],
    ).map_err(|e| format!("插入图案失败: {:?}", e))?;

    Ok(ProcessResult::Imported)
}

/// 获取或创建文件夹
async fn get_or_create_folder(
    dir_path: Option<&Path>,
    base_path: &Path,
    request: &ScanFolderRequest,
    db: &Database,
    folder_cache: &mut HashMap<String, String>,
) -> Result<String, String> {
    let dir = dir_path.unwrap_or(base_path);
    let dir_str = dir.to_string_lossy().to_string();

    // 检查缓存
    if let Some(cached_id) = folder_cache.get(&dir_str) {
        return Ok(cached_id.clone());
    }

    // 如果是根目录，使用 parent_folder_id 或创建根文件夹
    if dir == base_path {
        if let Some(ref parent_id) = request.parent_folder_id {
            folder_cache.insert(dir_str, parent_id.clone());
            return Ok(parent_id.clone());
        }

        // 创建根文件夹
        let folder_name = dir
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("导入的图案")
            .to_string();

        let folder_id = create_folder_if_not_exists(
            &folder_name,
            &request.parent_folder_id,
            &request.customer_id,
            db,
        ).await?;

        folder_cache.insert(dir_str, folder_id.clone());
        return Ok(folder_id);
    }

    // 收集所有需要创建的父路径（从根到当前目录）
    let mut path_stack: Vec<PathBuf> = Vec::new();
    let mut current = Some(dir);
    while let Some(p) = current {
        if p == base_path {
            break;
        }
        path_stack.push(p.to_path_buf());
        current = p.parent();
    }

    // 从根到子创建文件夹
    let mut parent_id = request.parent_folder_id.clone();
    path_stack.reverse();

    for path in path_stack {
        let path_str = path.to_string_lossy().to_string();

        // 检查缓存
        if let Some(cached_id) = folder_cache.get(&path_str) {
            parent_id = Some(cached_id.clone());
            continue;
        }

        let folder_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        let folder_id = create_folder_if_not_exists(
            &folder_name,
            &parent_id,
            &request.customer_id,
            db,
        ).await?;

        folder_cache.insert(path_str, folder_id.clone());
        parent_id = Some(folder_id);
    }

    Ok(parent_id.unwrap_or_else(|| {
        folder_cache.get(&dir_str).cloned().unwrap_or_default()
    }))
}

/// 创建文件夹（如果不存在）
async fn create_folder_if_not_exists(
    name: &str,
    parent_id: &Option<String>,
    customer_id: &Option<String>,
    db: &Database,
) -> Result<String, String> {
    // 检查是否已存在同名文件夹
    let existing_id: Option<String> = db.sqlite().query_row(
        "SELECT id FROM pattern_folders WHERE name = ?1 AND parent_id IS ?2",
        &[
            &name as &dyn rusqlite::ToSql,
            parent_id,
        ],
        |row| row.get::<_, String>(0),
    ).ok().flatten();

    if let Some(id) = existing_id {
        return Ok(id);
    }

    // 创建新文件夹
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 计算 level 和 path
    let (level, path) = if let Some(ref pid) = parent_id {
        let parent = db.sqlite().query_row(
            "SELECT level, path FROM pattern_folders WHERE id = ?1",
            &[&pid as &dyn rusqlite::ToSql],
            |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?)),
        ).map_err(|e| format!("查询父文件夹失败: {:?}", e))?
            .ok_or_else(|| format!("找不到父文件夹: {}", pid))?;

        (parent.0 + 1, format!("{}/{}", parent.1, name))
    } else {
        (0, format!("/{}", name))
    };

    // 获取最大排序号
    let max_sort: i32 = db.sqlite().query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM pattern_folders",
        &[],
        |row| row.get(0),
    ).map_err(|e| format!("获取排序号失败: {:?}", e))?.unwrap_or(-1);

    db.sqlite().execute(
        "INSERT INTO pattern_folders (id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        &[
            &id as &dyn rusqlite::ToSql,
            &name,
            parent_id,
            &level,
            &path,
            &(max_sort + 1),
            customer_id,
            &false,
            &true,
            &now,
            &now,
        ],
    ).map_err(|e| format!("创建文件夹失败: {:?}", e))?;

    Ok(id)
}

// ============================================================
// ImageMagick 辅助函数（用于处理不支持的 TIFF 格式）
// ============================================================

/// 检查 ImageMagick 是否可用
fn check_imagemagick_available() -> bool {
    use std::process::Command;

    // macOS 上尝试 magick 或 convert
    let result = Command::new("magick")
        .arg("-version")
        .output();

    if result.is_ok() {
        return true;
    }

    // 尝试 convert 命令（旧版 ImageMagick）
    let result = Command::new("convert")
        .arg("-version")
        .output();

    result.is_ok()
}

/// 使用 ImageMagick 将 TIFF 转换为 PNG（内存操作）
fn convert_tiff_with_imagemagick(tiff_data: &[u8]) -> Result<Vec<u8>, String> {
    use std::process::Command;

    // 检查 ImageMagick 是否可用
    if !check_imagemagick_available() {
        return Err("ImageMagick 未安装。请运行: brew install imagemagick".to_string());
    }

    // 创建临时文件
    let temp_dir = std::env::temp_dir();
    let temp_tiff = temp_dir.join(format!("baimo_temp_{}.tif", uuid::Uuid::new_v4()));
    let temp_png = temp_dir.join(format!("baimo_temp_{}.png", uuid::Uuid::new_v4()));

    // 写入 TIFF 数据到临时文件
    std::fs::write(&temp_tiff, tiff_data)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 使用 ImageMagick 转换（尝试 magick 和 convert）
    let mut result = Command::new("magick")
        .arg(&temp_tiff)
        .args(["-depth", "8"])
        .args(["-colorspace", "RGB"])
        .arg(&temp_png)
        .output();

    // 如果 magick 失败，尝试 convert
    if result.is_err() {
        result = Command::new("convert")
            .arg(&temp_tiff)
            .args(["-depth", "8"])
            .args(["-colorspace", "RGB"])
            .arg(&temp_png)
            .output();
    }

    // 清理临时 TIFF 文件
    let _ = std::fs::remove_file(&temp_tiff);

    let output = result.map_err(|e| format!("ImageMagick 命令执行失败: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        return Err(format!("ImageMagick 转换失败: stderr={}, stdout={}", error_msg, stdout_msg));
    }

    // 检查 PNG 文件是否真的创建了
    if !temp_png.exists() {
        return Err(format!("ImageMagick 执行成功但未生成 PNG 文件。请检查 TIFF 文件格式是否有效。"));
    }

    // 读取生成的 PNG 文件
    let png_data = std::fs::read(&temp_png)
        .map_err(|e| format!("读取转换后的 PNG 失败: {} (文件路径: {:?})", e, temp_png))?;

    // 清理临时 PNG 文件
    let _ = std::fs::remove_file(&temp_png);

    if png_data.is_empty() {
        return Err("生成的 PNG 文件为空".to_string());
    }

    Ok(png_data)
}
