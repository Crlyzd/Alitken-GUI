#[cfg(windows)]
mod win_impl {
    use std::path::Path;
    use std::sync::Once;
    use windows::{
        core::*,
        Win32::Foundation::*,
        Win32::Media::MediaFoundation::*,
        Win32::System::Com::*,
    };

    static WMF_INIT: Once = Once::new();

    pub fn ensure_wmf_initialized() {
        WMF_INIT.call_once(|| unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let _ = MFStartup(MF_VERSION, MFSTARTUP_FULL);
        });
    }

    fn fast_base64_encode(data: &[u8]) -> String {
        const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
        for chunk in data.chunks(3) {
            let b0 = chunk[0];
            let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
            let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

            result.push(CHARSET[(b0 >> 2) as usize] as char);
            result.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);

            if chunk.len() > 1 {
                result.push(CHARSET[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
            } else {
                result.push('=');
            }

            if chunk.len() > 2 {
                result.push(CHARSET[(b2 & 0x3F) as usize] as char);
            } else {
                result.push('=');
            }
        }
        result
    }

    fn create_bmp_data_url(width: u32, height: u32, rgb_bytes: &[u8], is_32bit: bool) -> String {
        let bpp = if is_32bit { 32 } else { 24 };
        let row_size = ((width as usize * (bpp / 8) + 3) / 4) * 4;
        let data_size = row_size * height as usize;
        let file_size = 54 + data_size;

        let mut bmp = Vec::with_capacity(file_size);
        // Header
        bmp.extend_from_slice(b"BM");
        bmp.extend_from_slice(&(file_size as u32).to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());
        bmp.extend_from_slice(&54u32.to_le_bytes());

        // DIB Header
        bmp.extend_from_slice(&40u32.to_le_bytes());
        bmp.extend_from_slice(&(width as i32).to_le_bytes());
        bmp.extend_from_slice(&(-(height as i32)).to_le_bytes()); // top-down
        bmp.extend_from_slice(&1u16.to_le_bytes());
        bmp.extend_from_slice(&(bpp as u16).to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());
        bmp.extend_from_slice(&(data_size as u32).to_le_bytes());
        bmp.extend_from_slice(&2835u32.to_le_bytes());
        bmp.extend_from_slice(&2835u32.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());

        bmp.extend_from_slice(rgb_bytes);

        let b64 = fast_base64_encode(&bmp);
        format!("data:image/bmp;base64,{}", b64)
    }

    unsafe fn propvar_to_i64(var: &PROPVARIANT) -> i64 {
        let ptr = (var as *const _ as *const u8).add(8);
        *ptr.cast::<i64>()
    }

    pub fn check_support(file_path: &str) -> bool {
        if !Path::new(file_path).exists() {
            return false;
        }
        ensure_wmf_initialized();

        unsafe {
            let hstr = HSTRING::from(file_path);
            let mut attributes: Option<IMFAttributes> = None;
            if MFCreateAttributes(&mut attributes, 2).is_ok() {
                if let Some(attr) = attributes.as_ref() {
                    let _ = attr.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1);
                }
            }

            let reader: Result<IMFSourceReader> =
                MFCreateSourceReaderFromURL(&hstr, attributes.as_ref());
            
            reader.is_ok()
        }
    }

    unsafe fn internal_extract_frame(
        file_path: &str,
        timestamp_sec: f64,
        _max_width: Option<u32>,
    ) -> Result<String> {
        if !Path::new(file_path).exists() {
            return Err(Error::from(ERROR_FILE_NOT_FOUND));
        }
        ensure_wmf_initialized();

        let hstr = HSTRING::from(file_path);
        let mut attributes: Option<IMFAttributes> = None;
        if MFCreateAttributes(&mut attributes, 2).is_ok() {
            if let Some(attr) = attributes.as_ref() {
                let _ = attr.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1);
            }
        }

        let reader: IMFSourceReader = MFCreateSourceReaderFromURL(&hstr, attributes.as_ref())?;
        let mt: IMFMediaType = MFCreateMediaType()?;
        
        mt.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
        mt.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;

        reader.SetCurrentMediaType(
            MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32,
            None,
            &mt,
        )?;

        // Seek position
        let hns_time = (timestamp_sec.max(0.0) * 10_000_000.0) as i64;
        let prop_var = PROPVARIANT::from(hns_time);

        let _ = reader.SetCurrentPosition(&GUID::zeroed(), &prop_var);

        let mut actual_stream_index: u32 = 0;
        let mut stream_flags: u32 = 0;
        let mut timestamp: i64 = 0;
        let mut sample: Option<IMFSample> = None;

        reader.ReadSample(
            MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32,
            0,
            Some(&mut actual_stream_index),
            Some(&mut stream_flags),
            Some(&mut timestamp),
            Some(&mut sample),
        )?;

        let sample = sample.ok_or_else(|| Error::from(E_FAIL))?;
        let buffer: IMFMediaBuffer = sample.ConvertToContiguousBuffer()?;

        let mut pointer: *mut u8 = std::ptr::null_mut();
        let mut max_len: u32 = 0;
        let mut cur_len: u32 = 0;

        buffer.Lock(&mut pointer, Some(&mut max_len), Some(&mut cur_len))?;

        let current_mt = reader.GetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32)?;

        let mut width: u32 = 0;
        let mut height: u32 = 0;
        if let Ok(frame_size) = current_mt.GetUINT64(&MF_MT_FRAME_SIZE) {
            width = (frame_size >> 32) as u32;
            height = (frame_size & 0xFFFFFFFF) as u32;
        }

        if width == 0 || height == 0 {
            width = 320;
            height = 180;
        }

        let slice = std::slice::from_raw_parts(pointer, cur_len as usize);
        let b64_url = create_bmp_data_url(width, height, slice, true);

        let _ = buffer.Unlock();
        Ok(b64_url)
    }

    pub fn extract_frame(
        file_path: &str,
        timestamp_sec: f64,
        max_width: Option<u32>,
    ) -> std::result::Result<String, String> {
        unsafe {
            internal_extract_frame(file_path, timestamp_sec, max_width)
                .map_err(|e| format!("WMF frame extraction error: {}", e))
        }
    }

    unsafe fn internal_extract_filmstrip(file_path: &str, count: usize) -> Result<Vec<String>> {
        let num_thumbs = count.clamp(4, 16);
        if !Path::new(file_path).exists() {
            return Err(Error::from(ERROR_FILE_NOT_FOUND));
        }
        ensure_wmf_initialized();

        let hstr = HSTRING::from(file_path);
        let mut attributes: Option<IMFAttributes> = None;
        if MFCreateAttributes(&mut attributes, 2).is_ok() {
            if let Some(attr) = attributes.as_ref() {
                let _ = attr.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1);
            }
        }

        let reader: IMFSourceReader = MFCreateSourceReaderFromURL(&hstr, attributes.as_ref())?;

        let mut duration_sec = 60.0;
        if let Ok(var_dur) = reader.GetPresentationAttribute(
            MF_SOURCE_READER_MEDIASOURCE.0 as u32,
            &MF_PD_DURATION,
        ) {
            let hns = propvar_to_i64(&var_dur);
            if hns > 0 {
                duration_sec = hns as f64 / 10_000_000.0;
            }
        }

        let mut results = Vec::with_capacity(num_thumbs);
        let step = duration_sec / num_thumbs as f64;

        for i in 0..num_thumbs {
            let target_sec = (i as f64 * step).min(duration_sec - 0.1);
            if let Ok(frame) = internal_extract_frame(file_path, target_sec, Some(160)) {
                results.push(frame);
            }
        }

        Ok(results)
    }

    pub fn extract_filmstrip(file_path: &str, count: usize) -> std::result::Result<Vec<String>, String> {
        unsafe {
            internal_extract_filmstrip(file_path, count)
                .map_err(|e| format!("WMF filmstrip extraction error: {}", e))
        }
    }
}

#[cfg(windows)]
pub use win_impl::*;

#[cfg(not(windows))]
pub fn check_support(_file_path: &str) -> bool {
    false
}

#[cfg(not(windows))]
pub fn extract_frame(
    _file_path: &str,
    _timestamp_sec: f64,
    _max_width: Option<u32>,
) -> std::result::Result<String, String> {
    Err("Windows Media Foundation is only supported on Windows OS".to_string())
}

#[cfg(not(windows))]
pub fn extract_filmstrip(_file_path: &str, _count: usize) -> std::result::Result<Vec<String>, String> {
    Err("Windows Media Foundation is only supported on Windows OS".to_string())
}
