# ✨ Alitken v0.4

> **High-Performance Windows Media Converter & Video Splitter**  
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

**Alitken** is a modern, lightweight, and super-fast Windows application designed to make media conversion and video trimming effortless for everyone—from casual users saving clips for Discord and social media to gamers and video editors handling high-res screen recordings.

No complicated settings or confusing technical jargon required: simply drag and drop your files, pick an output format or clip range, and let Alitken handle the rest at maximum speed!

---

## 🚀 Key Features

### ⚡ Automatic Hardware Acceleration
Alitken automatically detects your graphics card—whether you have **NVIDIA** (NVENC), **AMD** (AMF), or **Intel** (QuickSync)—to encode videos at blazing-fast speeds while keeping your processor cool. If no GPU is available, it smoothly falls back to high-quality CPU encoding.

### ✂️ Instant Lossless Video Cutting & Trimming
Need to snip out a clip from a long gameplay session or video recording? 
* **Lossless Cut Mode (`-c copy`)**: Cut and extract specific parts of your video in milliseconds without re-encoding or losing a single pixel of visual quality.
* **Custom Re-encoding Mode**: Trim and convert simultaneously to any format of your choice.

### 🎵 Zero Audio Quality Loss
Keep your soundtrack pure! Alitken uses smart stream copying (`-c:a copy`) whenever possible, preserving the full original audio fidelity without unneeded re-compression.

### 🎮 Smooth AV1 Game Clip Decoding
Recorded gaming highlights in AV1 format with ShadowPlay or OBS? Alitken incorporates VideoLAN's high-speed `libdav1d` AV1 decoder engine to process high-framerate clips effortlessly at 700+ FPS without crashes or stutters.

### 🖼️ Batch Image Processing
More than just video! Alitken features an integrated image converter tab to batch convert, resize, adjust quality, and optimize image files (JPG, PNG, WebM, GIF, etc.) in one click.

### 🎨 Modern Frosted Glass UI
Enjoy a sleek Windows 11-native aesthetic featuring:
* Borderless acrylic / mica frosted glass backdrop
* Dark & Light dynamic theme engine
* Drag-and-drop media zone
* Windows Explorer context menu integration (**"Send to"**) for instant right-click processing.

---

<img width="1609" height="905" alt="7" src="https://github.com/user-attachments/assets/b047a729-cfc6-4278-b8ed-ad0fdb53e00c" />
<img width="1609" height="905" alt="6" src="https://github.com/user-attachments/assets/724e6365-0d75-4925-a093-c72ecb1086fc" />
<img width="1609" height="905" alt="4" src="https://github.com/user-attachments/assets/11f38012-9ad3-4b49-a922-7e14b89a4f06" />
<img width="1609" height="905" alt="1" src="https://github.com/user-attachments/assets/a44db6d1-5a0f-434d-9da0-f0456b50bf33" />

---

## 📖 Quick Start Guide

1. **Add Your Media**: Drag and drop single files, multiple clips, or entire folders into the Alitken window (or right-click a file in Windows Explorer and select *Send to → Alitken*).
2. **Choose Action**:
   * **Convert**: Select your desired format (e.g., MP4, MKV, WebM, MP3).
   * **Trim / Split**: Enter start and end timestamps to extract your favorite clip.
   * **Images**: Switch to the Image tab to resize or convert photo batches.
3. **Start Processing**: Click **Start Conversion**. Track progress, speed, and real-time estimated time remaining (ETA).

---

## 📋 System Requirements & Supported Formats

* **Operating System**: Windows 10 / 11 (64-bit)
* **Supported Hardware Encoders**: NVIDIA NVENC, AMD AMF, Intel QuickSync, CPU (x264, x265, AV1)
* **Video Formats**: `.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.ts`, `.flv`, `.m2ts`
* **Audio Formats**: `.mp3`, `.aac`, `.wav`, `.flac`, `.ogg`, `.m4a`
* **Image Formats**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`

---

## 🛠️ Built For Performance (Tech Stack)

* **Backend**: Rust + Tauri v2 (Tokio asynchronous runtime)
* **Core Engine**: Built-in FFmpeg & ImageMagick integration with VideoLAN `libdav1d` AV1 decoding
* **Frontend**: React + TypeScript + Vite with custom glassmorphism design system

---

## ❤️ Support & Donate

Alitken is 100% free and developed with passion by **Kaleksanan Bagus**. If Alitken saved you time, saved your PC from bloatware, or made your video workflow smoother, consider buying me a coffee!

* ☕ **Saweria (Indonesia)**: [saweria.co/curlyzed](https://saweria.co/curlyzed)
* 💳 **PayPal (Global)**: [paypal.me/BagusMassani](https://paypal.me/BagusMassani)
