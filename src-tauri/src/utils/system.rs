use std::path::Path;

/// Queries available free bytes on the disk partition containing the given path.
#[cfg(target_os = "windows")]
pub fn get_disk_free_space(path: &Path) -> Result<u64, String> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let mut path_buf = path.to_path_buf();
    if path_buf.is_file() {
        if let Some(parent) = path_buf.parent() {
            path_buf = parent.to_path_buf();
        }
    }

    let wpath: Vec<u16> = path_buf
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    let ret = unsafe {
        GetDiskFreeSpaceExW(
            wpath.as_ptr(),
            &mut free_bytes_available,
            &mut total_bytes,
            &mut total_free_bytes,
        )
    };

    if ret != 0 {
        Ok(free_bytes_available)
    } else {
        Err("Failed to query disk free space".to_string())
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_disk_free_space(_path: &Path) -> Result<u64, String> {
    Ok(u64::MAX)
}

/// Trims the working set of the current process and its child processes (WebView2 tree) on Windows.
/// Safely releases unreferenced physical memory pages back to the OS standby pool without breaking any app state.
#[cfg(target_os = "windows")]
pub fn trim_working_set() {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, SetProcessWorkingSetSize, PROCESS_QUERY_INFORMATION,
        PROCESS_SET_QUOTA,
    };

    unsafe {
        // 1. Trim host process working set
        let current_process = GetCurrentProcess();
        SetProcessWorkingSetSize(current_process, usize::MAX, usize::MAX);

        // 2. Discover children and grandchildren (WebView2 process tree)
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != INVALID_HANDLE_VALUE {
            let mut entry: PROCESSENTRY32 = std::mem::zeroed();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;

            let current_pid = std::process::id();
            let mut all_processes: Vec<(u32, u32)> = Vec::new();

            if Process32First(snapshot, &mut entry) != 0 {
                loop {
                    all_processes.push((entry.th32ProcessID, entry.th32ParentProcessID));
                    if Process32Next(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            let mut target_pids = std::collections::HashSet::new();
            let mut search_parents = vec![current_pid];

            while !search_parents.is_empty() {
                let mut next_parents = Vec::new();
                for (pid, parent_pid) in &all_processes {
                    if search_parents.contains(parent_pid) && !target_pids.contains(pid) {
                        target_pids.insert(*pid);
                        next_parents.push(*pid);
                    }
                }
                search_parents = next_parents;
            }

            for pid in target_pids {
                let handle = OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, 0, pid);
                if handle != 0 && handle != INVALID_HANDLE_VALUE {
                    SetProcessWorkingSetSize(handle, usize::MAX, usize::MAX);
                    CloseHandle(handle);
                }
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn trim_working_set() {}

/// Probes image width and height directly from image file header bytes without external tools.
pub fn get_image_dimensions<P: AsRef<std::path::Path>>(path: P) -> (u32, u32) {
    use std::io::{Read, Seek, SeekFrom};
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = std::io::BufReader::new(file);
    let mut header = [0u8; 32];
    if reader.read_exact(&mut header).is_err() {
        return (0, 0);
    }

    // PNG
    if header.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        let width = u32::from_be_bytes([header[16], header[17], header[18], header[19]]);
        let height = u32::from_be_bytes([header[20], header[21], header[22], header[23]]);
        return (width, height);
    }

    // GIF
    if header.starts_with(b"GIF87a") || header.starts_with(b"GIF89a") {
        let width = u16::from_le_bytes([header[6], header[7]]) as u32;
        let height = u16::from_le_bytes([header[8], header[9]]) as u32;
        return (width, height);
    }

    // BMP
    if header.starts_with(b"BM") {
        let width = u32::from_le_bytes([header[18], header[19], header[20], header[21]]);
        let height = u32::from_le_bytes([header[22], header[23], header[24], header[25]]);
        return (width, height);
    }

    // WEBP (RIFF .... WEBP)
    if header.starts_with(b"RIFF") && &header[8..12] == b"WEBP" {
        if &header[12..16] == b"VP8 " && header.len() >= 30 {
            let width = (u16::from_le_bytes([header[26], header[27]]) & 0x3FFF) as u32;
            let height = (u16::from_le_bytes([header[28], header[29]]) & 0x3FFF) as u32;
            return (width, height);
        } else if &header[12..16] == b"VP8L" && header.len() >= 25 {
            let b0 = header[21] as u32;
            let b1 = header[22] as u32;
            let b2 = header[23] as u32;
            let b3 = header[24] as u32;
            let width = 1 + (((b1 & 0x3F) << 8) | b0);
            let height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
            return (width, height);
        } else if &header[12..16] == b"VP8X" && header.len() >= 30 {
            let width = 1 + (header[24] as u32 | ((header[25] as u32) << 8) | ((header[26] as u32) << 16));
            let height = 1 + (header[27] as u32 | ((header[28] as u32) << 8) | ((header[29] as u32) << 16));
            return (width, height);
        }
    }

    // JPEG
    if header.starts_with(&[0xFF, 0xD8]) {
        let _ = reader.seek(SeekFrom::Start(2));
        let mut buf = [0u8; 4];
        while reader.read_exact(&mut buf[..2]).is_ok() {
            if buf[0] != 0xFF {
                break;
            }
            let marker = buf[1];
            if marker == 0xD9 || marker == 0xDA {
                break;
            }
            if reader.read_exact(&mut buf[2..4]).is_ok() {
                let len = u16::from_be_bytes([buf[2], buf[3]]) as usize;
                if (0xC0..=0xCF).contains(&marker) && marker != 0xC4 && marker != 0xC8 && marker != 0xCC {
                    let mut sof = vec![0u8; len - 2];
                    if reader.read_exact(&mut sof).is_ok() && sof.len() >= 5 {
                        let height = u16::from_be_bytes([sof[1], sof[2]]) as u32;
                        let width = u16::from_be_bytes([sof[3], sof[4]]) as u32;
                        return (width, height);
                    }
                    break;
                } else if len >= 2 {
                    let _ = reader.seek(SeekFrom::Current((len - 2) as i64));
                }
            } else {
                break;
            }
        }
    }

    // HEIC / HEIF / AVIF (ISOBMFF with ftyp)
    if header.len() >= 12 && &header[4..8] == b"ftyp" {
        let _ = reader.seek(SeekFrom::Start(0));
        let mut buf = vec![0u8; 65536];
        if let Ok(n) = reader.read(&mut buf) {
            let slice = &buf[..n];
            if let Some(pos) = slice.windows(4).position(|w| w == b"ispe") {
                if pos + 16 <= n {
                    let width = u32::from_be_bytes([slice[pos + 8], slice[pos + 9], slice[pos + 10], slice[pos + 11]]);
                    let height = u32::from_be_bytes([slice[pos + 12], slice[pos + 13], slice[pos + 14], slice[pos + 15]]);
                    if width > 0 && height > 0 && width <= 65536 && height <= 65536 {
                        return (width, height);
                    }
                }
            }
        }
    }

    (0, 0)
}
