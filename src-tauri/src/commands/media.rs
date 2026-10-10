use crate::dependencies;
use crate::ffmpeg::{
    self, ConversionConfig, ExtractFramesConfig, ImageToVideoConfig, MediaMetadata,
    StreamCompatibilityResult, TrimConfig,
};
use crate::gpu;
use crate::image::{self, ImageConversionConfig};
use crate::utils;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn probe_media_file(ffprobe_path: String, file_path: String) -> Result<MediaMetadata, String> {
    let path = if ffprobe_path.is_empty() {
        dependencies::check_dependencies().ffprobe_path
    } else {
        ffprobe_path
    };

    ffmpeg::probe_file(&path, &file_path).await
}

#[tauri::command]
pub async fn get_full_media_info(file_path: String) -> Result<ffmpeg::FullMediaInfoPayload, String> {
    let path = dependencies::check_dependencies().ffprobe_path;
    ffmpeg::probe_full_media_info(&path, &file_path).await
}

#[derive(Debug, Clone, Serialize)]
pub struct ProbeBatchProgress {
    pub loaded: usize,
    pub total: usize,
    pub current_file: String,
}

#[tauri::command]
pub async fn probe_video_batch<R: tauri::Runtime>(
    app: AppHandle<R>,
    ffprobe_path: String,
    file_paths: Vec<String>,
    progress_offset: Option<usize>,
    total_batch_count: Option<usize>,
) -> Vec<Option<MediaMetadata>> {
    let probe_path = if ffprobe_path.is_empty() {
        dependencies::check_dependencies().ffprobe_path
    } else {
        ffprobe_path
    };

    let count = file_paths.len();
    if count == 0 {
        return vec![];
    }

    let offset = progress_offset.unwrap_or(0);
    let total = total_batch_count.unwrap_or(count);

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(8));
    let probe_path_arc = std::sync::Arc::new(probe_path);
    let loaded_counter = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

    let mut set = tokio::task::JoinSet::new();

    for (index, file_path) in file_paths.into_iter().enumerate() {
        let sem = semaphore.clone();
        let p_path = probe_path_arc.clone();
        let app_handle = app.clone();
        let counter = loaded_counter.clone();

        set.spawn(async move {
            let _permit = sem.acquire().await;
            let result = ffmpeg::probe_file(&p_path, &file_path).await.ok();

            let finished = counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            let loaded = offset + finished;
            let current_file = std::path::Path::new(&file_path)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| file_path.clone());

            let _ = app_handle.emit(
                "file-probe-progress",
                ProbeBatchProgress {
                    loaded,
                    total,
                    current_file,
                },
            );

            (index, result)
        });
    }

    let mut results = vec![None; count];
    while let Some(res) = set.join_next().await {
        if let Ok((index, meta)) = res {
            results[index] = meta;
        }
    }

    results
}

#[tauri::command]
pub async fn probe_image_batch<R: tauri::Runtime>(
    app: AppHandle<R>,
    file_paths: Vec<String>,
    progress_offset: Option<usize>,
    total_batch_count: Option<usize>,
) -> Vec<MediaMetadata> {
    let count = file_paths.len();
    if count == 0 {
        return vec![];
    }

    let offset = progress_offset.unwrap_or(0);
    let total = total_batch_count.unwrap_or(count);

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(16));
    let loaded_counter = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let mut set = tokio::task::JoinSet::new();

    let magick_path = dependencies::check_dependencies().magick_path;
    let magick_path_arc = std::sync::Arc::new(magick_path);

    for (index, file_path) in file_paths.into_iter().enumerate() {
        let sem = semaphore.clone();
        let app_handle = app.clone();
        let counter = loaded_counter.clone();
        let m_path_arc = magick_path_arc.clone();

        set.spawn(async move {
            let _permit = sem.acquire().await;
            let path_for_io = file_path.clone();

            let path = std::path::Path::new(&path_for_io);
            let file_name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let size = std::fs::metadata(&path_for_io)
                .map(|m| m.len() as f64)
                .unwrap_or(0.0);

            let (width, height, is_corrupted, error_message) = if size == 0.0 {
                (0, 0, true, Some("0 Bytes (Empty File)".to_string()))
            } else {
                let (w, h) = utils::get_image_dimensions(&path_for_io);
                if w > 0 && h > 0 {
                    (w, h, false, None)
                } else {
                    let m_path = m_path_arc.as_str();
                    if !m_path.is_empty() && std::path::Path::new(m_path).exists() {
                        match crate::image::probe_image_dimensions_magick(m_path, &path_for_io).await {
                            Ok((mw, mh)) => (mw, mh, false, None),
                            Err(_) => (0, 0, true, Some("Corrupted or unreadable image".to_string())),
                        }
                    } else {
                        (0, 0, false, None)
                    }
                }
            };

            let meta = MediaMetadata {
                file_name,
                file_path: path_for_io,
                duration_sec: 0.0,
                total_frames: 0.0,
                codec_name: "image".to_string(),
                audio_codec: String::new(),
                width,
                height,
                file_size_mb: size / (1024.0 * 1024.0),
                is_video: false,
                is_corrupted,
                error_message,
                bitrate_kbps: None,
                ..Default::default()
            };

            let finished = counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            let loaded = offset + finished;
            let current_file = meta.file_name.clone();

            let _ = app_handle.emit(
                "file-probe-progress",
                ProbeBatchProgress {
                    loaded,
                    total,
                    current_file,
                },
            );

            (index, meta)
        });
    }

    let dummy_meta = MediaMetadata {
        codec_name: "image".to_string(),
        ..Default::default()
    };
    let mut results = vec![dummy_meta; count];
    while let Some(res) = set.join_next().await {
        if let Ok((index, meta)) = res {
            results[index] = meta;
        }
    }

    results
}

#[tauri::command]
pub async fn start_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ConversionConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_video_pipeline(&app, &deps.ffmpeg_path, &deps.ffprobe_path, config, gpu_caps).await
}

#[tauri::command]
pub async fn start_combine_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ConversionConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_combine_pipeline(&app, &deps.ffmpeg_path, &deps.ffprobe_path, config, gpu_caps).await
}

#[tauri::command]
pub async fn check_stream_compatibility(
    file_paths: Vec<String>,
) -> Result<StreamCompatibilityResult, String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffprobe_exists {
        return Err("FFprobe dependency not found.".to_string());
    }
    ffmpeg::check_stream_compatibility(&deps.ffprobe_path, &file_paths).await
}

#[tauri::command]
pub async fn start_extract_frames_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ExtractFramesConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    ffmpeg::run_extract_frames_pipeline(&app, &deps.ffmpeg_path, &deps.ffprobe_path, config).await
}

#[tauri::command]
pub async fn start_image_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ImageConversionConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.magick_exists {
        return Err("ImageMagick (magick.exe) binary not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.magick_valid {
        return Err(format!(
            "ImageMagick version ({}) is below the required version 7.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.magick_version
        ));
    }

    image::run_image_pipeline(&app, &deps.magick_path, config).await
}

#[tauri::command]
pub async fn start_image_to_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: ImageToVideoConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists {
        return Err("FFmpeg binary not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let mode = config.mode.as_deref().unwrap_or("SLIDESHOW");
    let needs_magick = mode != "SEQUENCE"
        && config
            .input_files
            .iter()
            .any(|p| !ffmpeg::is_ffmpeg_native_image_format(p));

    if needs_magick && !deps.magick_exists {
        return Err(
            "ImageMagick (magick.exe) binary not found and is required for non-standard image formats. Please install it in Settings."
                .to_string(),
        );
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_image_to_video_pipeline(
        &app,
        &deps.ffmpeg_path,
        &deps.ffprobe_path,
        &deps.magick_path,
        config,
        gpu_caps,
    )
    .await
}

#[tauri::command]
pub async fn start_trim_video_pipeline<R: tauri::Runtime>(
    app: AppHandle<R>,
    config: TrimConfig,
) -> Result<(), String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }
    if !deps.ffmpeg_valid {
        return Err(format!(
            "FFmpeg version ({}) is below the required version 5.0+. Please click 'Update Dependencies' in Settings to update.",
            deps.ffmpeg_version
        ));
    }

    let gpu_caps = gpu::get_gpu_encoder(&config.codec_choice, &deps.ffmpeg_path);
    ffmpeg::run_trim_video_pipeline(&app, &deps.ffmpeg_path, &deps.ffprobe_path, config, gpu_caps).await
}

#[tauri::command]
pub async fn prepare_video_preview(file_path: String) -> Result<String, String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists || !deps.ffprobe_exists {
        return Err("FFmpeg dependencies not found. Please click 'Install Dependencies' in Settings.".to_string());
    }

    ffmpeg::prepare_preview_video(&deps.ffmpeg_path, &deps.ffprobe_path, &file_path).await
}

#[tauri::command]
pub async fn cancel_preview_video(file_path: String) -> Result<(), String> {
    ffmpeg::cancel_preview_video(&file_path).await;
    Ok(())
}

#[tauri::command]
pub fn unregister_preview_video(file_path: String) -> Result<(), String> {
    ffmpeg::unregister_preview_video(&file_path);
    Ok(())
}

#[tauri::command]
pub async fn get_video_frame_preview(file_path: String, timestamp_sec: f64) -> Result<String, String> {
    let deps = dependencies::check_dependencies();
    if !deps.ffmpeg_exists {
        return Err("FFmpeg binary not found. Please click 'Install Dependencies' in Settings.".to_string());
    }

    ffmpeg::extract_frame_base64_hwaccel(&deps.ffmpeg_path, &file_path, timestamp_sec).await
}

#[tauri::command]
pub fn check_wmf_support(file_path: String) -> bool {
    crate::wmf::check_support(&file_path)
}

#[tauri::command]
pub async fn get_wmf_frame_preview(
    file_path: String,
    timestamp_sec: f64,
    max_width: Option<u32>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        crate::wmf::extract_frame(&file_path, timestamp_sec, max_width)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_wmf_filmstrip(
    file_path: String,
    count: Option<usize>,
) -> Result<Vec<String>, String> {
    let count_val = count.unwrap_or(8);
    let fp = file_path.clone();
    let wmf_res = tokio::task::spawn_blocking(move || {
        crate::wmf::extract_filmstrip(&fp, count_val)
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Ok(ref strip) = wmf_res {
        if !strip.is_empty() {
            return wmf_res;
        }
    }

    let deps = dependencies::check_dependencies();
    if deps.ffmpeg_exists && deps.ffprobe_exists {
        return ffmpeg::extract_ffmpeg_filmstrip(&deps.ffmpeg_path, &deps.ffprobe_path, &file_path, count_val).await;
    }

    Ok(Vec::new())
}
