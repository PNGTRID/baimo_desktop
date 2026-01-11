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
                localFilePath, customerId, isActive, createdAt, updatedAt
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
                is_active: row.get(9)?,
                created_at: row.get::<_, i64>(10)?.to_string(),
                updated_at: row.get::<_, i64>(11)?.to_string(),
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
                localFilePath, customerId, isActive, createdAt, updatedAt
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
                is_active: row.get(9)?,
                created_at: row.get::<_, i64>(10)?.to_string(),
                updated_at: row.get::<_, i64>(11)?.to_string(),
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

    db.sqlite().execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                               localFilePath, customerId, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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

    db.sqlite().execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                               localFilePath, customerId, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        &[
            &id as &dyn rusqlite::ToSql,
            &request.name,
            &code,
            &request.actual_height,
            &20.0, // 默认出血高度
            &10,   // 默认每行个数
            &10,   // 默认行数
            &Some(request.local_file_path.clone()),
            &request.customer_id,
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
pub async fn update_pattern(
    id: String,
    name: Option<String>,
    actual_height: Option<f64>,
    bleed_height: Option<f64>,
    units_per_row: Option<i32>,
    row_count: Option<i32>,
    is_active: Option<bool>,
    db: State<'_, Database>,
) -> Result<Option<Pattern>, String> {
    // 构建动态 UPDATE 语句
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(ref n) = name {
        updates.push("name = ?");
        params.push(n.clone());
    }
    if let Some(h) = actual_height {
        updates.push("actualHeight = ?");
        params.push(h.to_string());
    }
    if let Some(h) = bleed_height {
        updates.push("bleedHeight = ?");
        params.push(h.to_string());
    }
    if let Some(u) = units_per_row {
        updates.push("unitsPerRow = ?");
        params.push(u.to_string());
    }
    if let Some(r) = row_count {
        updates.push("rowCount = ?");
        params.push(r.to_string());
    }
    if let Some(a) = is_active {
        updates.push("isActive = ?");
        params.push(if a { "1" } else { "0" }.to_string());
    }

    if updates.is_empty() {
        return Ok(None);
    }

    updates.push("updatedAt = ?");
    params.push(chrono::Utc::now().timestamp().to_string());

    let sql = format!("UPDATE patterns SET {} WHERE id = ?", updates.join(", "));

    // 执行更新
    db.sqlite().execute(
        &sql,
        &params.iter().map(|s| s as &dyn rusqlite::ToSql).chain(std::iter::once(&id as &dyn rusqlite::ToSql)).collect::<Vec<_>>(),
    ).map_err(|e| format!("Failed to update pattern: {:?}", e))?;

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

    // 方法2：尝试使用 tiff crate 读取并手动处理 CMYK
    // 创建 Cursor
    let cursor = Cursor::new(data);

    // 尝试使用 tiff::decoder::Decoder
    match tiff::decoder::Decoder::new(cursor) {
        Ok(mut decoder) => {
            let dimensions = decoder.dimensions()
                .map_err(|e| format!("无法获取尺寸: {}", e))?;
            let width = dimensions.0;
            let height = dimensions.1;

            let color_type = decoder.colortype()
                .map_err(|e| format!("无法获取颜色类型: {}", e))?;

            // 读取图像数据
            let img_data = decoder.read_image()
                .map_err(|e| format!("无法读取图像: {}", e))?;

            // 根据颜色类型转换为 RGB
            let rgb_data = match color_type {
                tiff::ColorType::RGB(8) => {
                    if let tiff::decoder::DecodingResult::U8(data) = img_data {
                        data
                    } else {
                        return Err("RGB 数据格式错误".to_string());
                    }
                }
                tiff::ColorType::RGBA(8) => {
                    if let tiff::decoder::DecodingResult::U8(data) = img_data {
                        // RGBA -> RGB
                        let mut rgb = Vec::with_capacity((width * height) as usize * 3);
                        for chunk in data.chunks(4) {
                            rgb.extend_from_slice(&chunk[0..3]);
                        }
                        rgb
                    } else {
                        return Err("RGBA 数据格式错误".to_string());
                    }
                }
                tiff::ColorType::Gray(8) => {
                    if let tiff::decoder::DecodingResult::U8(data) = img_data {
                        // 灰度 -> RGB
                        let mut rgb = Vec::with_capacity((width * height) as usize * 3);
                        for &gray in &data {
                            rgb.extend(&[gray, gray, gray]);
                        }
                        rgb
                    } else {
                        return Err("灰度数据格式错误".to_string());
                    }
                }
                tiff::ColorType::CMYK(8) => {
                    if let tiff::decoder::DecodingResult::U8(data) = img_data {
                        // CMYK -> RGB
                        let mut rgb = Vec::with_capacity((width * height) as usize * 3);
                        for chunk in data.chunks(4) {
                            let c = chunk[0] as f32;
                            let m = chunk[1] as f32;
                            let y = chunk[2] as f32;
                            let k = chunk[3] as f32;

                            let r = ((255.0 - c) * (255.0 - k) / 255.0).max(0.0).min(255.0) as u8;
                            let g = ((255.0 - m) * (255.0 - k) / 255.0).max(0.0).min(255.0) as u8;
                            let b = ((255.0 - y) * (255.0 - k) / 255.0).max(0.0).min(255.0) as u8;

                            rgb.extend(&[r, g, b]);
                        }
                        rgb
                    } else {
                        return Err("CMYK 数据格式错误".to_string());
                    }
                }
                _ => {
                    return Err(format!("不支持的颜色类型: {:?}", color_type));
                }
            };

            // 创建 RGB 图像
            let img = image::RgbImage::from_raw(width, height, rgb_data)
                .ok_or("无法创建 RGB 图像")?;

            // 编码为 PNG
            let mut png_bytes = Vec::new();
            let mut cursor = Cursor::new(&mut png_bytes);
            img.write_to(&mut cursor, image::ImageFormat::Png)
                .map_err(|e| format!("PNG 编码失败: {}", e))?;

            Ok(png_bytes)
        }
        Err(e) => {
            Err(format!("TIFF 解析失败（可能包含不支持的专色通道）: {}", e))
        }
    }
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

    for entry in WalkDir::new(&base_path)
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
            &base_path,
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

    db.sqlite().execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount,
                               localFilePath, customerId, folderId, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        &[
            &id as &dyn rusqlite::ToSql,
            &pattern_name,
            &code,
            &(metadata.height_cm * 10.0),  // 转换为毫米
            &20.0,  // 默认出血高度
            &10,    // 默认每行个数
            &10,    // 默认行数
            &Some(file_path_str),
            &request.customer_id,
            &Some(folder_id),
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
