# ⚡ Alitken Media Converter

> **The fast, beautiful, zero-bullshit Windows media converter & video trimmer.**  
> *Convert videos, snip clips in milliseconds, crop for TikTok/Reels, combine clips with custom music, and extract photos — without annoying paywalls, watermarks, or complicated settings.*

[![Windows 10/11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=flat&logo=windows)](https://github.com/Crlyzd/Alitken-GUI/releases)
[![Release v0.8.1](https://img.shields.io/badge/Release-v0.8.1-blue?style=flat)](https://github.com/Crlyzd/Alitken-GUI/releases)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-green.svg)](file:///d:/ALitken/Alitken-GUI/LICENSE)
[![Portable](https://img.shields.io/badge/Setup-100%25%20Portable-orange?style=flat)](#-zero-install-no-clutter)

---

### 💬 Why I Built This (A Rant)

> **TL;DR:** I am so sick and tired of media converters on Windows. Seriously, why is this entire category of software such an absolute unmitigated disaster zone?
>
> * **The Ancient Boomer Tools:** Great underlying code, sure, but the interfaces look like they were compiled on Windows 95 by a backend developer who fundamentally hates human eyes. You are greeted with 4,000 cryptic dropdowns, nested tabs from hell, and a UI that requires a computer science degree in video engineering just to turn a 5-second `.mov` file into an `.mp4`. Why do I need to navigate a 50-page audio codec sub-menu just to trim a video clip for Discord?
> * **The Corporate Paywall Traps:** The shiny-looking converters that rank #1 on search engines spend all their budget on SEO and zero on actual software development. You install it, wait 15 minutes for your file to process, and right when it finishes, it slaps a massive ugly watermark over the center of your video and demands a $49/year recurring subscription just to unlock 1080p export. Absolute predatory garbage.
> * **The "Free" Bloatware Nightmares:** The rest of the "free" utilities out there are horrific. They install 40 background services you can't disable, write garbage to your registry, bundle 500MB of useless bloatware code for a task that should take 20MB, and demand a full administrative setup wizard just to run. And when you finally use them? They take 45 minutes to encode a 30-second video because they don't even use your graphics card, maxing out your CPU at 100% until your fans sound like a jet engine, before inevitably crashing on any modern AV1 or high-framerate clip.
> * **The Online Web Converters:** Don't even get me started on web converters. Uploading a 2GB raw gameplay clip over your home internet, waiting in a server queue for 20 minutes, having your resolution capped at 720p, and navigating through 15 fake "DOWNLOAD HERE" malware popups just to get your file back.
>
> I just wanted **one** normal tool:
> 1. Completely **free** with no paywalls or trial watermarks.
> 2. **Portable** with zero installation bloat or registry clutter.
> 3. **Blazing fast** using real GPU hardware acceleration.
> 4. Able to **losslessly snip clips in seconds** without re-encoding.
> 5. A **modern, sleek Windows 11 UI** that doesn't look like a crime against design.
>
> Nobody else seemed capable of making an app that wasn't either a relic from 2005 or a greedy cash-grab scam, so I built **Alitken**. No bullshit, no paywalls, no bloatware, no hassle.

---

## ✨ What You Can Do With Alitken

### ✂️ Cut Videos Instantly (Literally 1 Second)
Need to trim out a 10-second highlight from a 2-hour gameplay session or podcast?
* **Instant Cut Mode**: Snips your video in the blink of an eye without re-rendering or losing any image quality.
* **Smart Quality Protection**: If you change playback speed or apply a crop, Alitken automatically switches to high-quality re-encoding with a clear explanation—no cryptic errors.

### 📱 Crop for TikTok, YouTube Shorts & Instagram Reels
Stop guessing crop dimensions!
* **1-Click Presets**: Pick **9:16 (Shorts/TikTok/Reels)**, **1:1 (Square)**, **16:9 (Landscape)**, or freeform crop.
* **Smooth Visual Handles**: Drag corners freely with natural 1:1 mouse tracking and magnetic snapping to borders.
* **Instant Preview**: See exactly what your final crop looks like in real time.

### 🎵 Combine Multiple Clips & Add Your Own Music
Put clips together without opening a heavy, complicated video editor:
* **Drag to Reorder**: Drop in multiple clips and arrange them in the order you want.
* **Add Background Song / Music**: Attach any MP3 or audio track directly over your combined video.
* **Smooth Fades**: Dial in customizable **Fade In** and **Fade Out** audio transitions in seconds.

### ⚡ Blazing Fast GPU Conversion
Convert iPhone `.mov` files, screen recordings, or huge downloads into web-friendly `.mp4`, `.mkv`, or `.webm`.
* **Automatic Graphics Card Detection**: Detects your NVIDIA, AMD, or Intel graphics card automatically to convert videos at maximum speed while keeping your PC cool.
* **Pure Audio Quality**: Copies your original audio tracks directly without degrading quality.

### 🛡️ Crashproof Queue (No Broken Downloads)
Ever had a batch converter crash midway because one file was empty or half-downloaded?
* **Broken File Detection**: Alitken instantly spots corrupted or 0-byte files, highlights them with an alert badge, and stops errors before they happen.
* **1-Click Cleanup**: Hit **"Clear Invalid"** to sweep away broken or missing files from your queue in one tap.

### 📸 Extract Perfect High-Res Photos
Want a crystal-clear screenshot or thumbnail from a video?
* Extract full-quality **PNG**, **JPG**, or **WebP** photos at custom intervals (every frame, every second, or keyframes only).

---

## 📸 Screenshots

<img width="1928" height="1084" alt="Alitken Transcode Queue" src="https://github.com/user-attachments/assets/da1d85a4-2f0c-416d-8b5c-377da83e7fc1" />
<img width="1933" height="1087" alt="Alitken Video Trimmer and Crop Viewport" src="https://github.com/user-attachments/assets/88bdbbc6-c4f8-476d-b467-ce3a82184a57" />
<img width="2320" height="1305" alt="Alitken Custom Config Panel" src="https://github.com/user-attachments/assets/93c61b25-9c86-4f9e-bd3b-4886c0bbaf25" />
<img width="1880" height="1057" alt="Alitken Frame Burst Extractor" src="https://github.com/user-attachments/assets/3257cdaa-228e-4a31-8547-fbdf9bfc5229" />

---

## 🚀 How to Use (3 Easy Steps)

1. **Drop Your Files**: Drag videos, audio, or pictures straight into the Alitken window (or right-click files in Windows Explorer and choose **Send to → Alitken**).
2. **Pick Your Action**:
   * **Convert**: Choose your target format (MP4, MKV, WebM, MP3, etc.).
   * **Trim / Crop**: Set your start/end markers or crop to 9:16 for mobile.
   * **Combine**: Merge your clips and pick an optional background song.
   * **Extract Frames**: Export picture bursts from any video.
3. **Hit Start**: Watch the progress bar fly. Your finished files will be waiting in your output folder!

---

## 📦 Zero Install, No Clutter

* **100% Portable**: No installer wizards, no random registry entries, no background services. Download `Alitken_64-Portable.exe`, put it anywhere, and double-click to run.
* **Auto-Updates**: Check for new releases and update with 1 click directly inside the **About** window.
* **Windows Context Menu**: Optional right-click shortcut in Windows Explorer for instant conversion.

---

## 🤓 Under the Hood (For Geeks & Creators)

For those curious about the engineering under the glass UI:
* **Core Architecture**: Native Windows desktop application built with **Tauri v2** and **Rust** (Tokio async runtime) for minimal footprint (~5 MB binary).
* **Media Engines**: Custom subprocess pipeline wrapping modern **FFmpeg**, **FFprobe**, and **ImageMagick** with deterministic PID cleanup.
* **Hardware Acceleration**: Automatic runtime detection for **NVIDIA NVENC**, **AMD AMF**, **Intel QuickSync (QSV)**, with seamless fallback to multi-threaded CPU encoders (`libx264`, `libx265`, `libaom-av1`).
* **AV1 Decoding**: Integrated VideoLAN **`libdav1d`** engine delivering 700+ FPS decoding on high-framerate 4K clips without stuttering.
* **Memory Management**: Automatic Windows working-set compaction (`EmptyWorkingSet`) and strict WebView2 V8 heap bounds (capped at 128 MB) to prevent RAM bloat during long queue sessions.
* **Lossless Muxing Engine**: Smart stream-copy packet passthrough (`-c copy`) for both single-clip trims and multi-video concatenation whenever stream parameters match.

---

## 💻 Supported Formats & System Requirements

* **OS**: Windows 10 or Windows 11 (64-bit x86_64 & ARM64)
* **Video**: `.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.ts`, `.flv`, `.m2ts`
* **Audio**: `.mp3`, `.aac`, `.wav`, `.flac`, `.ogg`, `.m4a`
* **Images**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`

---

## ❤️ Support & Community

Alitken is 100% free and open-source, built with love by **Kaleksanan Bagus**. If Alitken saved you from subscription paywalls, watermarks, or jet-engine CPU fans, consider buying me a coffee!

* ☕ **Saweria (Indonesia)**: [saweria.co/curlyzed](https://saweria.co/curlyzed)
* 💳 **PayPal (Global)**: [paypal.me/BagusMassani](https://paypal.me/BagusMassani)
