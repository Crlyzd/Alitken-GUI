// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    {
        // Configure Chromium / WebView2 switches to minimize RAM footprint:
        // 1. Terminate Crashpad background process (--disable-breakpad, --disable-crash-reporter)
        // 2. Bound V8 old-space and heap allocations (--js-flags="--optimize-for-size --max-old-space-size=128")
        // 3. Limit renderer process count to 1 (--renderer-process-limit=1)
        // 4. Cap internal media/disk caches (--disk-cache-size=1048576, --media-cache-size=1048576)
        // 5. Disable non-desktop browser features (Translate, Feed, MediaRouter, etc.)
        let args = [
            "--disable-breakpad",
            "--disable-crash-reporter",
            "--renderer-process-limit=1",
            "--js-flags=\"--optimize-for-size --max-old-space-size=128\"",
            "--disk-cache-size=1048576",
            "--media-cache-size=1048576",
            "--disable-features=Translate,InterestFeedContentSuggestions,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion",
        ]
        .join(" ");

        let existing = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let combined = if existing.trim().is_empty() {
            args
        } else {
            format!("{} {}", existing, args)
        };
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
    }

    alitken_gui::run();
}
