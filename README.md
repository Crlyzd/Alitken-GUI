<div align="center">

  # ⚡ ALITKEN

  ### High-Performance Media Converter, Video Trimmer & Social Clip Studio for Windows 11
  
  *A sleek, borderless, GPU-accelerated desktop utility built with Rust and Tauri v2.*  
  *Lossless cuts in milliseconds • 1-click TikTok/Reels framing • Custom soundtrack muxing • Zero paywalls, zero bloat.*

  <br />

  <p align="center">
    <a href="https://github.com/Crlyzd/Alitken-GUI/releases/latest">
      <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(64--bit%20%26%20ARM64)-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Platform" />
    </a>
    <a href="https://github.com/Crlyzd/Alitken-GUI/releases/latest">
      <img src="https://img.shields.io/badge/Release-v0.8.1-6366f1?style=for-the-badge&logo=tag&logoColor=white" alt="Release" />
    </a>
    <a href="file:///d:/ALitken/Alitken-GUI/LICENSE">
      <img src="https://img.shields.io/badge/License-GPL--3.0-22c55e?style=for-the-badge" alt="License" />
    </a>
    <a href="#-the-manifesto-a-rant">
      <img src="https://img.shields.io/badge/Why%20Alitken-The%20Rant-f59e0b?style=for-the-badge" alt="The Rant" />
    </a>
  </p>

  <p align="center">
    <a href="https://github.com/Crlyzd/Alitken-GUI/releases/latest"><b>Download Latest Portable Exe</b></a> •
    <a href="#-feature-matrix-alitken-vs-the-rest"><b>Comparison Matrix</b></a> •
    <a href="#-core-capabilities"><b>Features</b></a> •
    <a href="#-quick-start"><b>Quick Start</b></a> •
    <a href="#-under-the-hood-for-geeks"><b>Tech Specs</b></a> •
    <a href="#-support--donations"><b>Support</b></a>
  </p>

  <br />

  <img width="1928" height="1084" alt="Alitken Transcode Queue" src="https://github.com/user-attachments/assets/da1d85a4-2f0c-416d-8b5c-377da83e7fc1" />

</div>

---

### 💬 The Manifesto: Why I Built This (A Rant)

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

## 📊 Feature Matrix: Alitken vs. The Rest

| Feature | 👴 Traditional "Boomer" Tools | 💸 SEO Paywall Converters | 🌐 Online Web Converters | ⚡ **Alitken** |
| :--- | :---: | :---: | :---: | :---: |
| **Pricing & Watermarks** | Free | $49/yr + Center Watermark | Free with 720p / 100MB cap | **100% Free & Clean** |
| **Installation Footprint** | Clunky MSI installer | 500 MB+ Background Services | Popups & tracking cookies | **~5 MB Portable Single-File Exe** |
| **Video Cutting Speed** | Re-encodes slowly | Re-encodes slowly | Cloud queue upload delay | **Instant Lossless (`< 1 sec`)** |
| **UI Design & Ergonomics** | Nested 90s tabs & dialogs | Aggressive upgrade ads | Malware-laden banner ads | **Sleek Mica / Acrylic Glass UI** |
| **Mobile Crop (Shorts/TikTok)** | Manual pixel math | Locked behind subscription | Unsupported | **1-Click 9:16 / 1:1 Presets** |
| **Custom Audio & Fade** | Complex multi-pass setup | Paid feature | Unsupported | **Built-in Song Track + Fades** |
| **Hardware Acceleration** | Requires manual setup | Watermarked on free tier | Server-side throttled | **Auto NVIDIA / AMD / Intel** |
| **Queue Error Resilience** | Crashes on bad files | Silent failure | Upload timeout | **Pre-flight 0B / Corrupt Filter** |

---

## 🌟 Core Capabilities

### ✂️ Instant Lossless Trimmer & Smart Transcode Guard
* **Sub-Second Cutting**: Snip highlights from multi-hour screen recordings or movies instantly without touching video packets or dropping visual quality.
* **Smart Auto-Protection**: If you tweak playback speed or apply a crop, Alitken automatically enables high-quality encoding and informs you via a glass banner—eliminating cryptic FFmpeg failures.

### 📱 1-Click Social Media Framing (Shorts, Reels, TikTok)
* **Visual Aspect Presets**: Switch instantly between **9:16 (Shorts / TikTok)**, **1:1 (Square)**, **4:5 (Portrait)**, **16:9 (Landscape)**, or **Freeform**.
* **Fluid Corner Handles**: Drag handles with normalized 1:1 cursor response and polar vector math that prevents handle locking.
* **Magnetic Edge Snapping**: Snaps precisely to video edges and center axes for pixel-perfect framing.

### 🎵 Clip Combiner & Soundtrack Muxer
* **Multi-Clip Concatenation**: Merge disparate video clips into one continuous high-definition output.
* **Audio Track Replacement**: Overlay background songs, music, or voiceovers onto merged videos.
* **Studio Audio Fades**: Smooth configurable **Fade In** and **Fade Out** curves applied cleanly via AAC 192k encoding.

### ⚡ Automatic GPU Acceleration (NVENC • AMF • QuickSync)
* **Zero Config Setup**: Automatically queries and leverages your graphics card hardware encoder (**NVIDIA NVENC**, **AMD AMF**, or **Intel QSV**).
* **Cool CPU Temps**: Offloads demanding video encoding tasks from your processor to your GPU for near-instant exports.
* **High-Fidelity Audio Preservation**: Passthrough original high-res audio streams (`copy`) whenever codec formats permit.

### 🛡️ Crashproof Queue & Corrupted File Guardrails
* **Instant 0-Byte Detection**: Identifies corrupt, unreadable, or empty media files before starting any conversion pass.
* **1-Click "Clear Invalid"**: Purge missing or broken files with a single click to ensure seamless, unattended batch processing.

### 📸 High-Speed Frame Burst Extraction
* Export high-res **PNG**, **JPG**, or **WebP** image sequences from any video format.
* Choose between *Every Frame*, *1 Frame/sec*, *0.5 Frames/sec*, or *Keyframes Only*.
* Integrated disk-space verification prevents accidental drive saturation.

---

## 🖼️ Application Showcase

<div align="center">

| Transcode Queue & Batch Conversion | Precision Video Trimmer & WYSIWYG Crop |
| :---: | :---: |
| <img width="900" alt="Queue" src="https://github.com/user-attachments/assets/da1d85a4-2f0c-416d-8b5c-377da83e7fc1" /> | <img width="900" alt="Trimmer" src="https://github.com/user-attachments/assets/88bdbbc6-c4f8-476d-b467-ce3a82184a57" /> |

| Fine-Grained Transcode & Audio Controls | High-Speed Frame Burst Extraction |
| :---: | :---: |
| <img width="900" alt="Settings" src="https://github.com/user-attachments/assets/93c61b25-9c86-4f9e-bd3b-4886c0bbaf25" /> | <img width="900" alt="Burst Extractor" src="https://github.com/user-attachments/assets/3257cdaa-228e-4a31-8547-fbdf9bfc5229" /> |

</div>

---

## 🚀 Quick Start

1. **Download**: Grab `Alitken_64-Portable.exe` from the [Latest Releases](https://github.com/Crlyzd/Alitken-GUI/releases/latest).
2. **Drop Your Media**: Drag video, audio, or image files directly into the window (or right-click any file in Windows Explorer and select **Send to → Alitken**).
3. **Choose Mode**:
   * **Transcode**: Pick output format (`.mp4`, `.mkv`, `.webm`, `.mp3`) and encoder.
   * **Split / Trim**: Mark start/end cuts or crop to 9:16 for mobile.
   * **Combine**: Merge ordered clips and attach a soundtrack.
   * **Extract Frames**: Select sampling interval and image format.
4. **Convert**: Click **Start Conversion**. Watch real-time encoding FPS and live progress!

---

## 🤓 Under the Hood (For Geeks)

```
+-------------------------------------------------------------------------+
|                       ALITKEN ARCHITECTURE                              |
+-------------------------------------------------------------------------+
|  Frontend UI          React 18 • TypeScript • Tailwind/CSS Glass Tokens |
|  Desktop Runtime      Tauri v2 • Windows DWM Mica/Acrylic Windowing     |
|  Native Core          Rust (2021 Edition) • Tokio Asynchronous Runtime  |
|  Subprocess Engines   FFmpeg (GPLv3) • FFprobe • ImageMagick 7          |
|  Hardware Decoders    VideoLAN libdav1d AV1 Engine (700+ FPS Decoding)  |
|  Hardware Encoders    NVIDIA NVENC • AMD AMF • Intel QuickSync (QSV)    |
|  Memory Optimization  Windows Working-Set Compaction • V8 Heap Limiting |
+-------------------------------------------------------------------------+
```

* **Zero-Leak Memory Profile**: Working-set memory compaction (`EmptyWorkingSet`) executes automatically post-launch and following heavy batch pipelines, holding RAM footprints tight.
* **Blink/V8 Guardrails**: Strict 128 MB V8 heap boundaries and explicit HTML5 video DOM unmount cleanup eliminate media player memory leaks.
* **Subprocess Safety**: All background child process trees (FFmpeg/Magick) are attached to cancellation tokens for clean, zero-zombie shutdown on exit or cancel.

---

## 💻 System Requirements & Supported Media

* **Operating System**: Windows 10 or Windows 11 (64-bit x86_64 or ARM64)
* **Video Formats**: `.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.ts`, `.flv`, `.m2ts`
* **Audio Formats**: `.mp3`, `.aac`, `.wav`, `.flac`, `.ogg`, `.m4a`
* **Image Formats**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`

---

## ❤️ Support & Donations

Alitken is completely free, open source, and built with love by **Kaleksanan Bagus**. If this tool saved you from subscription scams, watermarked videos, or jet-engine CPU fans, consider buying me a coffee:

<p align="center">
  <a href="https://saweria.co/curlyzed">
    <img src="https://img.shields.io/badge/Saweria%20(Indonesia)-Support%20Creator-ff4757?style=for-the-badge&logo=coffee" alt="Saweria Donate" />
  </a>
  &nbsp;&nbsp;
  <a href="https://paypal.me/BagusMassani">
    <img src="https://img.shields.io/badge/PayPal%20(Global)-Donate-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="PayPal Donate" />
  </a>
</p>

---

<div align="center">
  <sub>Licensed under <a href="file:///d:/ALitken/Alitken-GUI/LICENSE">GNU General Public License v3.0</a>. Built for creators, gamers, and humans.</sub>
</div>
