//! Native Windows borderless window hit-test suppression and resize locking.
//!
//! On Windows, borderless windows require `WS_THICKFRAME` (`resizable: true` in Tauri)
//! to prevent Desktop Window Manager (DWM) from drawing an unwanted 1px border stroke.
//! This module locks the startup window geometry and suppresses edge resize cursors
//! across all borders (including the top edge handled by Tauri's child resize window).

#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "windows")]
pub static IS_STARTUP_RESIZE_LOCKED: AtomicBool = AtomicBool::new(true);

#[cfg(target_os = "windows")]
const SUBCLASS_ID: usize = 1001;

#[cfg(target_os = "windows")]
unsafe extern "system" fn startup_window_subclass_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
    _u_id_subclass: usize,
    _dw_ref_data: usize,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::Foundation::{LRESULT, RECT};
    use windows_sys::Win32::UI::Shell::DefSubclassProc;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    if IS_STARTUP_RESIZE_LOCKED.load(Ordering::Relaxed) {
        match msg {
            WM_NCHITTEST => {
                let hit = DefSubclassProc(hwnd, msg, wparam, lparam);
                match hit as u32 {
                    HTLEFT | HTRIGHT | HTTOP | HTBOTTOM | HTTOPLEFT | HTTOPRIGHT
                    | HTBOTTOMLEFT | HTBOTTOMRIGHT => {
                        return HTCLIENT as LRESULT;
                    }
                    _ => {}
                }

                // Explicit coordinate check against window boundaries to suppress top edge resize
                let mut rc: RECT = std::mem::zeroed();
                if GetWindowRect(hwnd, &mut rc) != 0 {
                    let x = (lparam & 0xFFFF) as i16 as i32;
                    let y = ((lparam >> 16) & 0xFFFF) as i16 as i32;
                    if y < rc.top + 8 || x < rc.left + 8 || x >= rc.right - 8 || y >= rc.bottom - 8 {
                        return HTCLIENT as LRESULT;
                    }
                }
                return hit;
            }
            WM_NCLBUTTONDOWN => {
                match wparam as u32 {
                    HTLEFT | HTRIGHT | HTTOP | HTBOTTOM | HTTOPLEFT | HTTOPRIGHT
                    | HTBOTTOMLEFT | HTBOTTOMRIGHT => {
                        return 0;
                    }
                    _ => {}
                }
            }
            WM_SYSCOMMAND => {
                // Block native modal resizing command
                if (wparam & 0xFFF0) == SC_SIZE as usize {
                    return 0;
                }
            }
            WM_WINDOWPOSCHANGING => {
                let pos = lparam as *mut WINDOWPOS;
                if !pos.is_null() {
                    (*pos).flags |= SWP_NOSIZE;
                    (*pos).cx = 500;
                    (*pos).cy = 500;
                }
            }
            _ => {}
        }
    }

    DefSubclassProc(hwnd, msg, wparam, lparam)
}

#[cfg(target_os = "windows")]
fn sync_tauri_resize_child(hwnd: windows_sys::Win32::Foundation::HWND, locked: bool) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, ShowWindow, SW_HIDE, SW_SHOW,
    };

    let class_name: [u16; 26] = [
        'T' as u16, 'A' as u16, 'U' as u16, 'R' as u16, 'I' as u16, '_' as u16,
        'D' as u16, 'R' as u16, 'A' as u16, 'G' as u16, '_' as u16, 'R' as u16,
        'E' as u16, 'S' as u16, 'I' as u16, 'Z' as u16, 'E' as u16, '_' as u16,
        'B' as u16, 'O' as u16, 'R' as u16, 'D' as u16, 'E' as u16, 'R' as u16,
        'S' as u16, 0,
    ];
    let window_name: [u16; 25] = [
        'T' as u16, 'A' as u16, 'U' as u16, 'R' as u16, 'I' as u16, '_' as u16,
        'D' as u16, 'R' as u16, 'A' as u16, 'G' as u16, '_' as u16, 'R' as u16,
        'E' as u16, 'S' as u16, 'I' as u16, 'Z' as u16, 'E' as u16, '_' as u16,
        'W' as u16, 'I' as u16, 'N' as u16, 'D' as u16, 'O' as u16, 'W' as u16,
        0,
    ];

    unsafe {
        let child = FindWindowExW(hwnd, 0, class_name.as_ptr(), window_name.as_ptr());
        if child != 0 {
            if locked {
                ShowWindow(child, SW_HIDE);
            } else {
                ShowWindow(child, SW_SHOW);
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn set_startup_resize_locked(window: &tauri::Window, locked: bool) {
    IS_STARTUP_RESIZE_LOCKED.store(locked, Ordering::Relaxed);
    if let Ok(hwnd) = window.hwnd() {
        sync_tauri_resize_child(hwnd.0 as windows_sys::Win32::Foundation::HWND, locked);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_startup_resize_locked(_window: &tauri::Window, _locked: bool) {}

#[cfg(target_os = "windows")]
pub fn install_window_subclass(window: &tauri::Window) {
    if let Ok(hwnd) = window.hwnd() {
        use windows_sys::Win32::UI::Shell::SetWindowSubclass;
        let win_hwnd = hwnd.0 as windows_sys::Win32::Foundation::HWND;
        unsafe {
            SetWindowSubclass(
                win_hwnd,
                Some(startup_window_subclass_proc),
                SUBCLASS_ID,
                0,
            );
        }
        sync_tauri_resize_child(win_hwnd, true);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn install_window_subclass(_window: &tauri::Window) {}
