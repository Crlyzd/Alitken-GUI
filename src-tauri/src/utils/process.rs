#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicBool, Ordering};

pub const CREATE_NO_WINDOW: u32 = 0x08000000;

pub static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn reset_cancel_flag() {
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);
}

pub fn check_cancel_flag() -> bool {
    CANCEL_REQUESTED.load(Ordering::SeqCst)
}

/// Creates a std::process::Command with CREATE_NO_WINDOW flag on Windows
pub fn create_hidden_cmd(program: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Creates a tokio::process::Command with CREATE_NO_WINDOW flag on Windows
pub fn create_tokio_hidden_cmd(program: &str) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}
