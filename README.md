# Alitken Media Converter

> **High-Performance Windows Media Converter, Video Splitter & Frame Extractor**  
> *A sleek, lightning-fast, borderless desktop app built with Rust & Tauri v2 for all your video, audio, and image processing needs.*

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

## 🌟 What is Alitken?

**Alitken** is a modern, lightweight, and super-fast Windows application designed to make media conversion, video trimming, video merging, and frame extraction effortless for everyone—from casual users saving clips for Discord and social media to gamers and content creators handling high-res screen recordings.

No complicated settings or confusing technical jargon required: simply drag and drop your files, pick your mode and format, and let Alitken handle the rest at maximum speed!

---

## 🚀 Key Features

### ⚡ Automatic Hardware Acceleration
Alitken automatically detects your graphics card—whether you have **NVIDIA** (NVENC), **AMD** (AMF), or **Intel** (QuickSync)—to encode videos at blazing-fast speeds while keeping your processor cool. If no GPU is available, it smoothly falls back to high-quality CPU encoding (`libx264`, `libx265`, `libaom-av1`).

### ✂️ Instant Lossless Video Cutting & Trimming
Need to snip out a clip from a long gameplay session or video recording? 
* **Lossless Cut Mode (`-c copy`)**: Extract specific parts of your video in milliseconds without re-encoding or losing a single pixel of visual quality.
* **Custom Re-encoding Mode**: Trim and convert simultaneously to any resolution, bitrate, or format.

### 📐 1:1 WYSIWYG Crop & Canvas Trimmer
Crop your video clips visually with an interactive on-canvas bounding box:
* **Aspect Ratio Presets**: 16:9 (Landscape), 9:16 (Shorts / TikTok / Reels), 1:1 (Square), 4:3 (Standard), 4:5 (Portrait), 21:9 (Ultrawide), and Freeform.
* **Smart Guides & Snapping**: Center magnet guide, container edge snapping (Alt), and axis locking (Shift/Ctrl).
* **Preset Memory**: Automatically saves your custom crop configurations across sessions.

### 🔗 Video Concatenation & Combine Engine
Merge multiple clips into a single video seamlessly:
* **Lossless Concat Demuxer (`-c copy`)**: Automatically detects matching streams (resolution, codec, framerate, audio layout) for instant, zero-loss merging.
* **Smart Hybrid Transcode Fallback**: Gracefully re-encodes mismatched clips with hardware acceleration while safeguarding system RAM.

### 🎞️ High-Speed Frame Burst Extraction
Extract high-resolution image sequences from any video:
* **Output Formats**: Save as **PNG**, **JPEG**, or **WebP** with custom quality sliders.
* **Sampling Cadences**: Extract *Every Frame*, *1 Frame/sec*, *0.5 Frames/sec*, *Keyframes Only (I-Frames)*, or a *Custom Interval*.
* **Built-in Safety Guard**: Disk space validation and large-batch safety prompts prevent accidental drive overflow.

### 🎵 Zero Audio Quality Loss
Keep your soundtrack pure! Alitken uses smart stream copying (`-c:a copy`) whenever possible, preserving the original audio fidelity without unneeded re-compression.

### 🎮 Smooth AV1 Game Clip Decoding
Recorded gaming highlights in AV1 format with ShadowPlay or OBS? Alitken integrates VideoLAN's high-speed `libdav1d` AV1 decoder engine to process high-framerate clips effortlessly at 700+ FPS without crashes or stutters.

### 🖼️ Batch Image Processing
More than just video! Alitken features an integrated image converter to batch convert, resize, adjust compression, and optimize image files (JPG, PNG, WebP, GIF, BMP, etc.) in one click.

### 🎨 Modern Frosted Glass UI & Fluid Ergonomics
Enjoy a sleek Windows 11-native desktop experience:
* **Dynamic Glass Backdrop**: Borderless acrylic / mica frosted glass aesthetic with full Dark & Light mode support.
* **Snappy Drag-and-Drop Queue**: Pointer-event drag-and-drop file rearranging with 60-120 FPS GPU displacement animations.
* **Vertical Sidebar Rail**: Ergonomic 42px navigation rail to switch between *Transcode*, *Split*, *Combine*, and *Extract* workflows.
* **Dual-Context Folder Memory**: Remembers your preferred import source and export destination directories independently.
* **Windows Context Menu Integration**: Right-click any file in Windows Explorer and select **"Send to → Alitken"** for instant processing.

---

<img width="1609" height="905" alt="7" src="https://github.com/user-attachments/assets/b047a729-cfc6-4278-b8ed-ad0fdb53e00c" />
<img width="1609" height="905" alt="6" src="https://github.com/user-attachments/assets/724e6365-0d75-4925-a093-c72ecb1086fc" />
<img width="1609" height="905" alt="4" src="https://github.com/user-attachments/assets/11f38012-9ad3-4b49-a922-7e14b89a4f06" />
<img width="1609" height="905" alt="1" src="https://github.com/user-attachments/assets/a44db6d1-5a0f-434d-9da0-f0456b50bf33" />

---

## 📖 Quick Start Guide

1. **Add Your Media**: Drag and drop single files, multiple clips, or entire folders into the Alitken window (or right-click files in Windows Explorer and select *Send to → Alitken*).
2. **Choose Action (Sidebar Rail)**:
   * **Transcode**: Select your target video/audio format (MP4, MKV, WebM, MP3, etc.) and hardware encoder.
   * **Split / Trim**: Set start/end timestamps or crop your video with aspect ratio presets.
   * **Combine**: Reorder clips in the queue and merge them into a single continuous video.
   * **Extract Frames**: Select sampling cadence and image format (PNG, JPG, WebP) to extract frame bursts.
   * **Images**: Switch to the Image tab to batch resize, convert, and optimize photos.
3. **Start Processing**: Click **Start Conversion**. Monitor real-time microsecond telemetry, encoding FPS, and estimated completion time (ETA).

---

## 📋 System Requirements & Supported Formats

* **Operating System**: Windows 10 / 11 (64-bit x86_64 & ARM64)
* **Supported Hardware Encoders**: NVIDIA NVENC, AMD AMF, Intel QuickSync, CPU (`libx264`, `libx265`, `libaom-av1`)
* **Video Formats**: `.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.ts`, `.flv`, `.m2ts`
* **Audio Formats**: `.mp3`, `.aac`, `.wav`, `.flac`, `.ogg`, `.m4a`
* **Image Formats**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`

---

## 🛠️ Built For Performance (Tech Stack)

* **Backend**: Rust + Tauri v2 (Tokio asynchronous runtime)
* **Preview Engine**: Native Windows Media Foundation (WMF) COM APIs for zero-lag seekbar filmstrip generation
* **Media Core**: Built-in FFmpeg & ImageMagick with VideoLAN `libdav1d` AV1 hardware-level decoding
* **Frontend**: React + TypeScript + Vite with custom glassmorphism design system

---

## ❤️ Support & Donate

Alitken is 100% free and developed with passion by **Kaleksanan Bagus**. If Alitken saved you time, saved your PC from bloatware, or made your video workflow smoother, consider buying me a coffee!

* ☕ **Saweria (Indonesia)**: [saweria.co/curlyzed](https://saweria.co/curlyzed)
* 💳 **PayPal (Global)**: [paypal.me/BagusMassani](https://paypal.me/BagusMassani)
