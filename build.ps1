# ==============================================================================
# Alitken Media Converter - Unified All-In-One PowerShell Developer Tool
# ==============================================================================
# Consolidates all build, dev, release packaging, version bumping, and asset
# generation pipelines into a single master script with an interactive menu.
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$Dev = $false,
    [switch]$StoreDev = $false,
    [switch]$Fast = $false,
    [ValidateSet("Standard", "Small", "Store", "MSStore", "Fast", "")]
    [string]$BuildProfile = "",
    [ValidateSet("all", "x64", "64", "arm64", "github", "store", "")]
    [string]$ReleaseScope = "",
    [switch]$SkipArm64 = $false,
    [ValidateSet("patch", "minor", "major", "custom", "")]
    [string]$Bump = "",
    [string]$Version = "",
    [switch]$GenerateAssets = $false,
    [switch]$Clean = $false,
    [switch]$NoPause = $false
)

$ErrorActionPreference = "Stop"

# Ensure we operate from repository root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Fetch current application version from package.json
function Get-AppVersion {
    $PackageJsonPath = Join-Path $ScriptDir "package.json"
    if (Test-Path $PackageJsonPath) {
        try {
            (Get-Content $PackageJsonPath -Raw | ConvertFrom-Json).version
        } catch {
            "0.8.4"
        }
    } else {
        "0.8.4"
    }
}

# Clean up any residual Cargo release profile environment overrides
function Reset-CargoProfileEnv {
    Get-ChildItem Env:CARGO_PROFILE_RELEASE_* -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------------------------
# 1. Environment & Prerequisites Verification
# ------------------------------------------------------------------------------
function Assert-Environment {
    Write-Host "[1/3] Checking environment..." -ForegroundColor Yellow
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Node.js / NPM is not installed or not in PATH." -ForegroundColor Red
        if (-not $NoPause -and [Environment]::UserInteractive) { Pause }
        exit 1
    }

    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Rust / Cargo is not installed or not in PATH." -ForegroundColor Red
        if (-not $NoPause -and [Environment]::UserInteractive) { Pause }
        exit 1
    }

    if (-not (Test-Path (Join-Path $ScriptDir "node_modules"))) {
        Write-Host "node_modules not found. Installing dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: npm install failed." -ForegroundColor Red
            if (-not $NoPause -and [Environment]::UserInteractive) { Pause }
            exit 1
        }
    }
}

# ------------------------------------------------------------------------------
# 2. Toolchain Probing (ARM64 & Windows SDK)
# ------------------------------------------------------------------------------
function Test-RustArm64TargetAvailable {
    $rustTargets = rustup target list --installed 2>$null
    return ($rustTargets -contains "aarch64-pc-windows-msvc")
}

function Test-VsArm64ClAvailable {
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsPath = & $vsWhere -latest -products * -property installationPath 2>$null
        if ($vsPath) {
            $armCl = Get-ChildItem -Path "$vsPath\VC\Tools\MSVC\*\bin\*\arm64\cl.exe" -ErrorAction SilentlyContinue
            if ($armCl) { return $true }
        }
    }
    return $false
}

function Test-Arm64ToolchainAvailable {
    $hasVsArmCl = Test-VsArm64ClAvailable
    $hasRustTarget = Test-RustArm64TargetAvailable

    if (-not $hasVsArmCl) {
        Write-Host "[ADVISORY] Visual Studio ARM64 C++ Build Tools (cl.exe) not detected on this system." -ForegroundColor Yellow
        Write-Host "           Skipping ARM64 targets. Install 'MSVC v143 ARM64 build tools' in VS Installer if needed." -ForegroundColor DarkGray
        return $false
    }

    if (-not $hasRustTarget) {
        Write-Host "[ADVISORY] Rust ARM64 target (aarch64-pc-windows-msvc) is not installed." -ForegroundColor Yellow
        Write-Host "           Attempting to install 'aarch64-pc-windows-msvc' via rustup..." -ForegroundColor Cyan
        & rustup target add aarch64-pc-windows-msvc
        if ($LASTEXITCODE -eq 0) {
            Write-Host "           Successfully added Rust ARM64 target!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "           Failed to auto-install Rust ARM64 target." -ForegroundColor Red
            return $false
        }
    }

    return $true
}

function Find-MakeAppxExe {
    $cmd = Get-Command "makeappx.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $kitsDir = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path $kitsDir) {
        $makeAppx = Get-ChildItem -Path $kitsDir -Filter "makeappx.exe" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -like "*\x64\makeappx.exe" } |
            Select-Object -First 1
        if ($makeAppx) { return $makeAppx.FullName }
    }

    $fallback = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits" -Filter "makeappx.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($fallback) { return $fallback.FullName }

    return $null
}

# ------------------------------------------------------------------------------
# 3. MSIX Visual Asset Generator
# ------------------------------------------------------------------------------
function Invoke-GenerateMsixAssets {
    param (
        [string]$IconPath = (Join-Path $ScriptDir "src-tauri\icons\icon.ico"),
        [string]$OutputDir = (Join-Path $ScriptDir "src-tauri\msix\Assets")
    )

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "         MSIX Visual Asset Generator              " -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan

    if (-not (Test-Path $IconPath)) {
        Write-Host "ERROR: Icon file not found at: $IconPath" -ForegroundColor Red
        return $false
    }

    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    try {
        Add-Type -AssemblyName PresentationCore, WindowsBase, PresentationFramework -ErrorAction Stop

        $iconUri = [System.Uri]::new((Resolve-Path $IconPath).Path)
        $decoder = [System.Windows.Media.Imaging.IconBitmapDecoder]::new(
            $iconUri,
            [System.Windows.Media.Imaging.BitmapCreateOptions]::None,
            [System.Windows.Media.Imaging.BitmapCacheOption]::Default
        )

        $sourceFrame = $decoder.Frames | Sort-Object PixelWidth -Descending | Select-Object -First 1

        function Save-VisualAsset {
            param($CWidth, $CHeight, $IWidth, $IHeight, $FName)
            $group = [System.Windows.Media.DrawingGroup]::new()
            $dc = $group.Open()
            $x = ($CWidth - $IWidth) / 2
            $y = ($CHeight - $IHeight) / 2
            $rect = [System.Windows.Rect]::new($x, $y, $IWidth, $IHeight)
            $dc.DrawImage($sourceFrame, $rect)
            $dc.Close()

            $dv = [System.Windows.Media.DrawingVisual]::new()
            $ctx = $dv.RenderOpen()
            $ctx.DrawDrawing($group)
            $ctx.Close()

            $rtb = [System.Windows.Media.Imaging.RenderTargetBitmap]::new($CWidth, $CHeight, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
            $rtb.Render($dv)

            $encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
            $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))

            $outPath = Join-Path $OutputDir $FName
            $fs = [System.IO.FileStream]::new($outPath, [System.IO.FileMode]::Create)
            $encoder.Save($fs)
            $fs.Close()

            Write-Host "  [+] Generated: $FName ($CWidth x $CHeight)" -ForegroundColor Green
        }

        Save-VisualAsset 50 50 50 50 "StoreLogo.png"
        Save-VisualAsset 44 44 44 44 "Square44x44Logo.png"
        Save-VisualAsset 150 150 150 150 "Square150x150Logo.png"
        Save-VisualAsset 310 150 150 150 "Wide310x150Logo.png"
        Save-VisualAsset 620 300 200 200 "SplashScreen.png"

        Write-Host ""
        Write-Host "[OK] All MSIX Visual Assets generated successfully in: $OutputDir" -ForegroundColor Green
        return
    } catch {
        Write-Host "ERROR generating MSIX assets: $_" -ForegroundColor Red
        return
    }
}

# ------------------------------------------------------------------------------
# 4. Version Bump & Single Source of Truth Synchronization
# ------------------------------------------------------------------------------
function Invoke-VersionSync {
    param (
        [string]$TargetVersion
    )

    $TauriConfPath = Join-Path $ScriptDir "src-tauri\tauri.conf.json"
    $CargoTomlPath = Join-Path $ScriptDir "src-tauri\Cargo.toml"
    $IndexHtmlPath = Join-Path $ScriptDir "index.html"

    $SyncScript = Join-Path $ScriptDir "scripts\sync-version.cjs"
    if (Test-Path $SyncScript) {
        & node $SyncScript
        return
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)

    # 1. Update src-tauri/tauri.conf.json
    if (Test-Path $TauriConfPath) {
        $tauriConf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
        $tauriConf.version = $TargetVersion
        if ($tauriConf.app -and $tauriConf.app.windows -and $tauriConf.app.windows[0]) {
            $tauriConf.app.windows[0].title = "ALITKEN v$TargetVersion"
        }
        $jsonStr = $tauriConf | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($TauriConfPath, ($jsonStr + "`n"), $utf8NoBom)
        Write-Host "  [+] Updated src-tauri/tauri.conf.json -> v$TargetVersion" -ForegroundColor Green
    }

    # 2. Update src-tauri/Cargo.toml
    if (Test-Path $CargoTomlPath) {
        $cargoContent = Get-Content $CargoTomlPath -Raw
        $updatedCargo = [regex]::Replace($cargoContent, '(?m)^version\s*=\s*"[^"]+"', "version = `"$TargetVersion`"")
        [System.IO.File]::WriteAllText($CargoTomlPath, $updatedCargo, $utf8NoBom)
        Write-Host "  [+] Updated src-tauri/Cargo.toml     -> v$TargetVersion" -ForegroundColor Green
    }

    # 3. Update index.html
    if (Test-Path $IndexHtmlPath) {
        $htmlContent = Get-Content $IndexHtmlPath -Raw
        $updatedHtml = [regex]::Replace($htmlContent, '(?i)<title>ALITKEN[^<]*</title>', "<title>ALITKEN v$TargetVersion</title>")
        [System.IO.File]::WriteAllText($IndexHtmlPath, $updatedHtml, $utf8NoBom)
        Write-Host "  [+] Updated index.html               -> v$TargetVersion" -ForegroundColor Green
    }
}

function Invoke-VersionBumpWorkflow {
    param (
        [string]$BumpType = "",
        [string]$SpecificVersion = ""
    )

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "       Alitken Version Bump & Sync Engine         " -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan

    $currentVer = Get-AppVersion
    Write-Host "Current Application Version: v$currentVer" -ForegroundColor Yellow

    # Semver calculation for dynamic examples
    $cleanVer = $currentVer.Split('-')[0]
    $parts = $cleanVer.Split('.')
    $maj = if ($parts.Length -gt 0) { [int]$parts[0] } else { 0 }
    $min = if ($parts.Length -gt 1) { [int]$parts[1] } else { 0 }
    $pat = if ($parts.Length -gt 2) { [int]$parts[2] } else { 0 }

    $exPatch = "$maj.$min.$($pat + 1)"
    $exMinor = "$maj.$($min + 1).0"
    $exMajor = "$($maj + 1).0.0"

    $targetArg = ""

    if ([string]::IsNullOrEmpty($BumpType) -and [string]::IsNullOrEmpty($SpecificVersion)) {
        Write-Host ""
        Write-Host "Select Version Increment Type:" -ForegroundColor Yellow
        Write-Host "  [1] Patch  (Bug fixes / tweaks, e.g. v$currentVer -> v$exPatch)" -ForegroundColor Cyan
        Write-Host "  [2] Minor  (New features, e.g. v$currentVer -> v$exMinor)" -ForegroundColor Green
        Write-Host "  [3] Major  (Major overhaul, e.g. v$currentVer -> v$exMajor)" -ForegroundColor Red
        Write-Host "  [4] Custom (Specify exact version string)" -ForegroundColor Magenta
        Write-Host "  [B] Back to Main Menu" -ForegroundColor Gray
        Write-Host ""
        $c = Read-Host "Enter choice [1-4, B] (Default: 1 - Patch)"
        switch ($c) {
            "2" { $targetArg = "minor" }
            "3" { $targetArg = "major" }
            "4" {
                $customVal = Read-Host "Enter custom version (e.g. 0.9.0 or 1.0.0-beta.1)"
                if ([string]::IsNullOrWhitespace($customVal)) {
                    Write-Host "ERROR: Custom version string cannot be empty." -ForegroundColor Red
                    return
                }
                $targetArg = $customVal.Trim()
            }
            "B" { return }
            "b" { return }
            default { $targetArg = "patch" }
        }
    } elseif (-not [string]::IsNullOrEmpty($SpecificVersion)) {
        $targetArg = $SpecificVersion.Trim()
    } else {
        $targetArg = $BumpType.Trim()
    }

    Write-Host ""
    Write-Host "Updating Single Source of Truth version ($targetArg)..." -ForegroundColor Yellow

    # Run npm version
    npm version $targetArg --no-git-tag-version

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm version failed with exit code $LASTEXITCODE" -ForegroundColor Red
        return
    }

    $newVer = Get-AppVersion

    # Synchronize all targets
    Invoke-VersionSync -TargetVersion $newVer

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "           VERSION BUMP SUCCESSFUL!               " -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Previous Version:             v$currentVer" -ForegroundColor Gray
    Write-Host "New Application Version:      v$newVer" -ForegroundColor Green
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 5. Core Build & Development Session Execution
# ------------------------------------------------------------------------------
function Invoke-BuildOrDev {
    param (
        [bool]$IsDev,
        [bool]$IsStoreDev,
        [string]$BuildProfile,
        [bool]$Interactive = $false
    )

    $BuildFailed = $false
    $curVer = Get-AppVersion

    try {
        if ($IsDev) {
            Write-Host ""
            if ($IsStoreDev) {
                Write-Host "[2/2] Launching Tauri Development Mode (MS Store Build Preview)..." -ForegroundColor DarkCyan
                Write-Host "NOTE: When the application is closed or killed, this script remains active." -ForegroundColor DarkGray
                try {
                    npm run tauri dev -- --features store-build
                } catch {
                    Write-Host "Dev server stopped: $_" -ForegroundColor Yellow
                }
            } else {
                Write-Host "[2/2] Launching Tauri Development Mode (GitHub Build)..." -ForegroundColor Green
                Write-Host "NOTE: When the application is closed or killed, this script remains active." -ForegroundColor DarkGray
                try {
                    npm run tauri dev
                } catch {
                    Write-Host "Dev server stopped: $_" -ForegroundColor Yellow
                }
            }

            # Suppress non-zero exit codes from killing/closing the dev app
            $global:LASTEXITCODE = 0
            Write-Host ""
            Write-Host "[OK] Tauri development session ended." -ForegroundColor Cyan
        } else {
            if ($BuildProfile -eq "Fast") {
                Write-Host "[2/3] Compiling Tauri Desktop Executable (Ultra-Fast Compilation Profile)..." -ForegroundColor White
                Write-Host "NOTE: Zero LTO, 256 parallel codegen units, opt-level 1 for maximum build speed." -ForegroundColor DarkGray

                $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "1"
                $env:CARGO_PROFILE_RELEASE_LTO = "off"
                $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "256"
                $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
                $env:CARGO_PROFILE_RELEASE_STRIP = "false"
                npm run tauri build
            } elseif ($BuildProfile -eq "Small") {
                Write-Host "[2/3] Compiling Tauri Desktop Executable (Ultra-Small LTO Profile)..." -ForegroundColor Green
                Write-Host "NOTE: Full LLVM Link-Time Optimization enabled (~2-4 minute build)." -ForegroundColor DarkYellow

                $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
                $env:CARGO_PROFILE_RELEASE_LTO = "true"
                $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
                $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
                $env:CARGO_PROFILE_RELEASE_STRIP = "true"
                npm run tauri build
            } elseif ($BuildProfile -eq "Store") {
                Write-Host "[2/3] Compiling Tauri Desktop Executable (MS Store Release - Ultra-Small Profile)..." -ForegroundColor Blue
                $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
                $env:CARGO_PROFILE_RELEASE_LTO = "true"
                $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
                $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
                $env:CARGO_PROFILE_RELEASE_STRIP = "true"
                npm run tauri build -- --features store-build
            } else {
                Write-Host "[2/3] Compiling Tauri Desktop Executable (Standard Release Profile)..." -ForegroundColor Cyan
                Reset-CargoProfileEnv
                npm run tauri build
            }

            if ($LASTEXITCODE -ne 0) {
                throw "Tauri build failed with exit code $LASTEXITCODE"
            }

            Write-Host "[3/3] Packaging and organizing release binaries..." -ForegroundColor Yellow

            $ExePath = Join-Path $ScriptDir "src-tauri\target\release\alitken-gui.exe"
            if (-not (Test-Path $ExePath)) {
                $AltExe = Join-Path $ScriptDir "src-tauri\target\x86_64-pc-windows-msvc\release\alitken-gui.exe"
                if (Test-Path $AltExe) { $ExePath = $AltExe }
            }

            $NsisDir = Join-Path $ScriptDir "src-tauri\target\release\bundle\nsis"
            if (-not (Test-Path $NsisDir)) {
                $AltNsis = Join-Path $ScriptDir "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis"
                if (Test-Path $AltNsis) { $NsisDir = $AltNsis }
            }

            $ReleasesDir = Join-Path $ScriptDir "releases"
            if (-not (Test-Path $ReleasesDir)) {
                New-Item -ItemType Directory -Path $ReleasesDir -Force | Out-Null
            }

            $ParentDir = Split-Path -Parent $ScriptDir
            $ParentExePath = Join-Path $ParentDir "Alitken.exe"

            $OutputProfile = if ($BuildProfile -eq "Store") { "MSStore" } else { $BuildProfile }

            if (Test-Path $ExePath) {
                try {
                    if (-not (Test-Path $ParentDir)) {
                        New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
                    }
                    Copy-Item -Path $ExePath -Destination $ParentExePath -Force
                    Write-Host " Copied Local Binary:  $ParentExePath" -ForegroundColor Green
                } catch {
                    Write-Host " WARNING: Could not copy executable to parent folder: $_" -ForegroundColor Yellow
                }

                try {
                    $PortableName = "Alitken_v${curVer}_${OutputProfile}_64-Portable.exe"
                    $DestPortable = Join-Path $ReleasesDir $PortableName
                    Copy-Item -Path $ExePath -Destination $DestPortable -Force
                    Write-Host " Saved Portable:       $DestPortable" -ForegroundColor Cyan
                } catch {
                    Write-Host " WARNING: Could not copy portable executable to releases folder: $_" -ForegroundColor Yellow
                }
            } else {
                Write-Host " WARNING: Compiled binary not found at $ExePath" -ForegroundColor Yellow
            }

            $InstallerExe = Get-ChildItem -Path $NsisDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($InstallerExe) {
                try {
                    $SetupName = "Alitken_v${curVer}_${OutputProfile}_64-Setup.exe"
                    $DestSetup = Join-Path $ReleasesDir $SetupName
                    Copy-Item -Path $InstallerExe.FullName -Destination $DestSetup -Force
                    Write-Host " Saved Installer:      $DestSetup" -ForegroundColor Cyan
                } catch {
                    Write-Host " WARNING: Could not copy setup installer to releases folder: $_" -ForegroundColor Yellow
                }
            }

            Write-Host ""
            Write-Host "==================================================" -ForegroundColor Green
            Write-Host "               BUILD SUCCESSFUL!                 " -ForegroundColor Green
            Write-Host "==================================================" -ForegroundColor Green
            Write-Host "Profile Used:                 $BuildProfile ($OutputProfile)" -ForegroundColor Yellow
            Write-Host "Releases Output Folder:       $ReleasesDir" -ForegroundColor Green
            Write-Host "Executable Location:          $ExePath" -ForegroundColor Cyan

            if (Test-Path $ExePath) {
                $sizeBytes = (Get-Item $ExePath).Length
                $sizeMB = [math]::Round($sizeBytes / 1MB, 2)
                Write-Host "Executable Binary Size:       $sizeMB MB" -ForegroundColor White
            }

            if (Test-Path $ParentExePath) {
                Write-Host "Parent Folder Executable:     $ParentExePath" -ForegroundColor Green
            }

            if (-not $NoPause -and [Environment]::UserInteractive -and -not $Interactive) {
                try { Invoke-Item $ReleasesDir } catch {}
            }
        }
    } catch {
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Red
        Write-Host "                BUILD FAILED!                     " -ForegroundColor Red
        Write-Host "==================================================" -ForegroundColor Red
        Write-Host "Error details: $_" -ForegroundColor Red
        $BuildFailed = $true
    } finally {
        Reset-CargoProfileEnv
    }

    if ($Interactive) {
        Write-Host ""
        Write-Host "Press Enter to return to menu..." -ForegroundColor Gray
        Read-Host | Out-Null
    } else {
        if (-not $NoPause -and [Environment]::UserInteractive) {
            Write-Host ""
            Write-Host "Press any key to close..." -ForegroundColor Gray
            try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch { Read-Host | Out-Null }
        }
        if ($BuildFailed) {
            if ([Environment]::UserInteractive -and ($Host.Name -match "ConsoleHost|Visual Studio Code")) {
                return
            }
            exit 1
        }
    }
}

# ------------------------------------------------------------------------------
# 6. Multi-Target Release Distribution Pipeline (GitHub + MS Store MSIX)
# ------------------------------------------------------------------------------
function Invoke-ReleasePipeline {
    param (
        [string]$Scope = "all",
        [bool]$SkipArm = $false,
        [bool]$Interactive = $false
    )

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "     ALITKEN MULTI-TARGET RELEASE BUILD ENGINE      " -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan

    $curVer = Get-AppVersion
    Write-Host " Target Application Version: v$curVer" -ForegroundColor Yellow
    Write-Host " Selected Build Scope:       $Scope" -ForegroundColor Yellow

    $OutputDistFolder = Join-Path $ScriptDir "releases"
    if (-not (Test-Path $OutputDistFolder)) {
        New-Item -ItemType Directory -Path $OutputDistFolder -Force | Out-Null
    }

    try {
        # Enable Ultra-Small LTO size optimization profile (~4.5MB - 6MB output binaries)
        Write-Host ""
        Write-Host "[1/4] Enabling Ultra-Small LTO Size Optimization Profile..." -ForegroundColor Yellow
        $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
        $env:CARGO_PROFILE_RELEASE_LTO = "true"
        $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
        $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
        $env:CARGO_PROFILE_RELEASE_STRIP = "true"

        Write-Host "[2/4] Building Frontend Production Dist..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend build failed"
        }

        # Helper to build NSIS target
        function Invoke-BuildNsisTarget {
            param($Target, $FlavorName, $OutputPrefix, $Features = "")
            Write-Host ""
            Write-Host "----------------------------------------------------" -ForegroundColor Green
            Write-Host " Building: $FlavorName ($Target)..." -ForegroundColor Green
            Write-Host "----------------------------------------------------" -ForegroundColor Green

            $buildArgs = @("tauri", "build", "--target", $Target, "--bundles", "nsis")
            if ($Features) { $buildArgs += @("--features", $Features) }

            & npx $buildArgs
            if ($LASTEXITCODE -ne 0) { throw "Failed to build $FlavorName for $Target" }

            $TargetBundleDir = Join-Path $ScriptDir "src-tauri\target\$Target\release\bundle\nsis"
            $InstallerExe = Get-ChildItem -Path $TargetBundleDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

            if ($InstallerExe) {
                $DestPath = Join-Path $OutputDistFolder "${OutputPrefix}-Setup.exe"
                Copy-Item -Path $InstallerExe.FullName -Destination $DestPath -Force
                Write-Host " Saved Installer: $DestPath" -ForegroundColor Cyan
            }

            $TargetReleaseExe = Join-Path $ScriptDir "src-tauri\target\$Target\release\alitken-gui.exe"
            if (Test-Path $TargetReleaseExe) {
                $DestExePath = Join-Path $OutputDistFolder "${OutputPrefix}-Portable.exe"
                Copy-Item -Path $TargetReleaseExe -Destination $DestExePath -Force
                Write-Host " Saved Portable:  $DestExePath" -ForegroundColor Cyan
            }
        }

        # Helper to build MSIX Store target
        function Invoke-BuildMsixTarget {
            param($Target, $FlavorName, $OutputPrefix, $Features = "store-build")
            Write-Host ""
            Write-Host "----------------------------------------------------" -ForegroundColor Green
            Write-Host " Building MS Store Package: $FlavorName ($Target)..." -ForegroundColor Green
            Write-Host "----------------------------------------------------" -ForegroundColor Green

            $MakeAppxExe = Find-MakeAppxExe
            if (-not $MakeAppxExe) {
                throw "'makeappx.exe' from Windows Kits 10/11 SDK was not detected in PATH or Windows Kits directory."
            }

            $buildArgs = @("tauri", "build", "--target", $Target, "--no-bundle")
            if ($Features) { $buildArgs += @("--features", $Features) }

            & npx $buildArgs
            if ($LASTEXITCODE -ne 0) { throw "Failed to compile $FlavorName for $Target" }

            $TargetReleaseExe = Join-Path $ScriptDir "src-tauri\target\$Target\release\alitken-gui.exe"
            if (-not (Test-Path $TargetReleaseExe)) { throw "Compiled binary not found at $TargetReleaseExe" }

            $StagingDir = Join-Path $ScriptDir "src-tauri\target\$Target\msix_staging"
            if (Test-Path $StagingDir) { Remove-Item -Path $StagingDir -Recurse -Force }
            New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

            Copy-Item -Path $TargetReleaseExe -Destination (Join-Path $StagingDir "alitken-gui.exe") -Force

            $AssetsDir = Join-Path $StagingDir "Assets"
            $SourceAssets = Join-Path $ScriptDir "src-tauri\msix\Assets"
            if (-not (Test-Path $SourceAssets)) {
                Write-Host " Generating missing MSIX visual assets..." -ForegroundColor Yellow
                Invoke-GenerateMsixAssets
            }
            Copy-Item -Path $SourceAssets -Destination $AssetsDir -Recurse -Force

            $ConfigPath = Join-Path $ScriptDir "src-tauri\msix\msstore.config.json"
            $storeConfig = if (Test-Path $ConfigPath) {
                Get-Content $ConfigPath -Raw | ConvertFrom-Json
            } else {
                [PSCustomObject]@{
                    packageIdentityName = "curlyzed.Alitken"
                    publisher = "CN=6DDD7CD9-2258-47A2-B61F-0E60DE9FFBAE"
                    publisherDisplayName = "curlyzed"
                    packageDisplayName = "Alitken"
                    description = "High-performance Windows media converter, video trimmer and video splitter."
                }
            }

            $pkgIdentity = if ($env:MSSTORE_PACKAGE_NAME) { $env:MSSTORE_PACKAGE_NAME } else { $storeConfig.packageIdentityName }
            $publisher = if ($env:MSSTORE_PUBLISHER) { $env:MSSTORE_PUBLISHER } else { $storeConfig.publisher }
            $pubDisplayName = if ($env:MSSTORE_PUBLISHER_DISPLAY_NAME) { $env:MSSTORE_PUBLISHER_DISPLAY_NAME } else { $storeConfig.publisherDisplayName }
            $pkgDisplayName = if ($env:MSSTORE_PACKAGE_DISPLAY_NAME) { $env:MSSTORE_PACKAGE_DISPLAY_NAME } else { $storeConfig.packageDisplayName }
            $description = if ($storeConfig.description) { $storeConfig.description } else { "Alitken Media Converter" }

            $cleanVer = $curVer.Split("-")[0].Split("+")[0]
            $verParts = $cleanVer.Split(".")
            $major = if ($verParts.Length -gt 0) { $verParts[0] } else { "0" }
            $minor = if ($verParts.Length -gt 1) { $verParts[1] } else { "0" }
            $patch = if ($verParts.Length -gt 2) { $verParts[2] } else { "0" }
            $quadVersion = "$major.$minor.$patch.0"

            $msixArch = if ($Target -like "*aarch64*") { "arm64" } else { "x64" }

            $TemplatePath = Join-Path $ScriptDir "src-tauri\msix\AppxManifest.template.xml"
            if (-not (Test-Path $TemplatePath)) { throw "MSIX manifest template not found at $TemplatePath" }

            $manifestContent = Get-Content $TemplatePath -Raw
            $manifestContent = $manifestContent.Replace("{{PACKAGE_IDENTITY_NAME}}", $pkgIdentity)
            $manifestContent = $manifestContent.Replace("{{PUBLISHER}}", $publisher)
            $manifestContent = $manifestContent.Replace("{{PUBLISHER_DISPLAY_NAME}}", $pubDisplayName)
            $manifestContent = $manifestContent.Replace("{{PACKAGE_DISPLAY_NAME}}", $pkgDisplayName)
            $manifestContent = $manifestContent.Replace("{{DESCRIPTION}}", $description)
            $manifestContent = $manifestContent.Replace("{{VERSION}}", $quadVersion)
            $manifestContent = $manifestContent.Replace("{{PROCESSOR_ARCHITECTURE}}", $msixArch)
            $manifestContent = $manifestContent.Replace("{{EXECUTABLE}}", "alitken-gui.exe")

            $ManifestDest = Join-Path $StagingDir "AppxManifest.xml"
            [System.IO.File]::WriteAllText($ManifestDest, $manifestContent, [System.Text.Encoding]::UTF8)

            $DestMsixPath = Join-Path $OutputDistFolder "${OutputPrefix}.msix"
            Write-Host " Packing Windows App Package (.msix)..." -ForegroundColor Yellow
            & "$MakeAppxExe" pack /d "$StagingDir" /p "$DestMsixPath" /o
            if ($LASTEXITCODE -ne 0) { throw "MakeAppx failed with exit code $LASTEXITCODE" }

            Write-Host " Saved MSIX Package:  $DestMsixPath" -ForegroundColor Green
            Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
        }

        $isArm64 = -not $SkipArm -and (Test-Arm64ToolchainAvailable)

        # 1. GitHub Release (64)
        if ($Scope -eq "all" -or $Scope -eq "x64" -or $Scope -eq "64" -or $Scope -eq "github") {
            Invoke-BuildNsisTarget -Target "x86_64-pc-windows-msvc" -FlavorName "GitHub Release (64)" -OutputPrefix "Alitken_v${curVer}_GitHub_64"
        }

        # 2. GitHub Release (ARM64)
        if ($isArm64 -and ($Scope -eq "all" -or $Scope -eq "arm64" -or $Scope -eq "github")) {
            Invoke-BuildNsisTarget -Target "aarch64-pc-windows-msvc" -FlavorName "GitHub Release (ARM64)" -OutputPrefix "Alitken_v${curVer}_GitHub_ARM64"
        }

        # 3. MS Store Build (64) -> .msix
        if ($Scope -eq "all" -or $Scope -eq "x64" -or $Scope -eq "64" -or $Scope -eq "store") {
            Invoke-BuildMsixTarget -Target "x86_64-pc-windows-msvc" -FlavorName "MS Store Release (64)" -OutputPrefix "Alitken_v${curVer}_MSStore_64" -Features "store-build"
        }

        # 4. MS Store Build (ARM64) -> .msix
        if ($isArm64 -and ($Scope -eq "all" -or $Scope -eq "arm64" -or $Scope -eq "store")) {
            Invoke-BuildMsixTarget -Target "aarch64-pc-windows-msvc" -FlavorName "MS Store Release (ARM64)" -OutputPrefix "Alitken_v${curVer}_MSStore_ARM64" -Features "store-build"
        }

        Write-Host ""
        Write-Host "====================================================" -ForegroundColor Cyan
        Write-Host "        RELEASE BINARIES BUILT & ORGANIZED!         " -ForegroundColor Green
        Write-Host " All files saved cleanly in: $OutputDistFolder" -ForegroundColor Yellow
        Write-Host "====================================================" -ForegroundColor Cyan

        if ([Environment]::UserInteractive -and -not $Interactive) {
            Invoke-Item $OutputDistFolder
        }
    } catch {
        Write-Host ""
        Write-Host "ERROR ENCOUNTERED IN RELEASE PIPELINE: $_" -ForegroundColor Red
    } finally {
        Reset-CargoProfileEnv
    }

    if ($Interactive) {
        Write-Host ""
        Write-Host "Press Enter to return to menu..." -ForegroundColor Gray
        Read-Host | Out-Null
    }
}

# ------------------------------------------------------------------------------
# 7. Clean Build Artifacts & Staging Caches
# ------------------------------------------------------------------------------
function Invoke-CleanCaches {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Yellow
    Write-Host "          Cleaning Caches & Staging Data          " -ForegroundColor Yellow
    Write-Host "==================================================" -ForegroundColor Yellow

    $stagingPaths = @(
        (Join-Path $ScriptDir "src-tauri\target\x86_64-pc-windows-msvc\msix_staging"),
        (Join-Path $ScriptDir "src-tauri\target\aarch64-pc-windows-msvc\msix_staging"),
        (Join-Path $ScriptDir "dist"),
        (Join-Path $ScriptDir "node_modules\.vite")
    )

    foreach ($p in $stagingPaths) {
        if (Test-Path $p) {
            try {
                Remove-Item -Path $p -Recurse -Force
                Write-Host "  [-] Removed: $p" -ForegroundColor Gray
            } catch {
                Write-Host "  [!] Could not remove: $p" -ForegroundColor DarkGray
            }
        }
    }

    Reset-CargoProfileEnv
    Write-Host "[OK] Clean complete." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 8. Execution Router (Interactive Menu vs Non-Interactive CLI)
# ------------------------------------------------------------------------------
Assert-Environment

# Normalize parameters
if ($Fast) { $BuildProfile = "Fast" }
if ($StoreDev) { $Dev = $true }
if ($BuildProfile -eq "MSStore") { $BuildProfile = "Store" }

$IsInteractive = (-not $Dev -and -not $StoreDev -and -not $Fast `
    -and [string]::IsNullOrEmpty($BuildProfile) `
    -and [string]::IsNullOrEmpty($ReleaseScope) `
    -and [string]::IsNullOrEmpty($Bump) `
    -and [string]::IsNullOrEmpty($Version) `
    -and -not $GenerateAssets `
    -and -not $Clean)

if ($IsInteractive) {
    # --------------------------------------------------------------------------
    # Interactive Unified Menu Loop
    # --------------------------------------------------------------------------
    while ($true) {
        $curVer = Get-AppVersion
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host "     Alitken All-In-One Developer Tool (v$curVer) " -ForegroundColor Cyan
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "--- Development & Live Reload ---" -ForegroundColor DarkGray
        Write-Host "  [1] GitHub Dev Mode        (Live Reload, full dev update UI)" -ForegroundColor Magenta
        Write-Host "  [2] MS Store Dev Mode      (Live Reload, preview MS Store UI)" -ForegroundColor DarkCyan
        Write-Host ""
        Write-Host "--- Quick Compilation ---" -ForegroundColor DarkGray
        Write-Host "  [3] Ultra-Fast Compile     (Opt-level 1, 256 codegen units, zero LTO)" -ForegroundColor White
        Write-Host "  [4] Standard Build         (Standard x64 setup + portable exe)" -ForegroundColor Cyan
        Write-Host "  [5] Ultra-Small LTO Build  (Full LLVM LTO ~4-6 MB binary)" -ForegroundColor Green
        Write-Host ""
        Write-Host "--- Multi-Target Distribution Pipeline ---" -ForegroundColor DarkGray
        Write-Host "  [6] Full Release Pipeline  (GitHub x64+ARM64, MS Store x64+ARM64 MSIX)" -ForegroundColor Blue
        Write-Host "  [7] GitHub Releases Only   (x64 + ARM64 setup installers & portables)" -ForegroundColor DarkGreen
        Write-Host "  [8] MS Store MSIX Only     (Generate .msix packages for Store Center)" -ForegroundColor DarkYellow
        Write-Host ""
        Write-Host "--- Versioning & Utilities ---" -ForegroundColor DarkGray
        Write-Host "  [9] Bump App Version       (Patch, Minor, Major, or Custom semver sync)" -ForegroundColor Yellow
        Write-Host "  [10] Generate MSIX Assets  (StoreLogo, Splash & Square logos from icon.ico)" -ForegroundColor DarkMagenta
        Write-Host "  [11] Clean Build Caches    (Reset staging caches and dist folders)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  [Q] Exit / Close Tool" -ForegroundColor Gray
        Write-Host ""
        $choice = Read-Host "Select option [1-11, Q] (Default: 1)"

        if ($choice -match '^[Qq]$') {
            Write-Host "Exiting Alitken developer tool. Goodbye!" -ForegroundColor Gray
            break
        }

        switch ($choice) {
            "1" { Invoke-BuildOrDev -IsDev $true -IsStoreDev $false -BuildProfile "Standard" -Interactive $true }
            "2" { Invoke-BuildOrDev -IsDev $true -IsStoreDev $true -BuildProfile "Store" -Interactive $true }
            "3" { Invoke-BuildOrDev -IsDev $false -IsStoreDev $false -BuildProfile "Fast" -Interactive $true }
            "4" { Invoke-BuildOrDev -IsDev $false -IsStoreDev $false -BuildProfile "Standard" -Interactive $true }
            "5" { Invoke-BuildOrDev -IsDev $false -IsStoreDev $false -BuildProfile "Small" -Interactive $true }
            "6" { Invoke-ReleasePipeline -Scope "all" -SkipArm $SkipArm64 -Interactive $true }
            "7" { Invoke-ReleasePipeline -Scope "github" -SkipArm $SkipArm64 -Interactive $true }
            "8" { Invoke-ReleasePipeline -Scope "store" -SkipArm $SkipArm64 -Interactive $true }
            "9" {
                Invoke-VersionBumpWorkflow
                Write-Host "Press Enter to return to menu..." -ForegroundColor Gray
                Read-Host | Out-Null
            }
            "10" {
                Invoke-GenerateMsixAssets
                Write-Host ""
                Write-Host "Press Enter to return to menu..." -ForegroundColor Gray
                Read-Host | Out-Null
            }
            "11" {
                Invoke-CleanCaches
                Write-Host ""
                Write-Host "Press Enter to return to menu..." -ForegroundColor Gray
                Read-Host | Out-Null
            }
            default {
                Invoke-BuildOrDev -IsDev $true -IsStoreDev $false -BuildProfile "Standard" -Interactive $true
            }
        }
    }
} else {
    # --------------------------------------------------------------------------
    # Direct Non-Interactive CLI Invocations
    # --------------------------------------------------------------------------
    if ($Clean) {
        Invoke-CleanCaches
    } elseif ($GenerateAssets) {
        Invoke-GenerateMsixAssets
    } elseif (-not [string]::IsNullOrEmpty($Bump) -or -not [string]::IsNullOrEmpty($Version)) {
        Invoke-VersionBumpWorkflow -BumpType $Bump -SpecificVersion $Version
    } elseif (-not [string]::IsNullOrEmpty($ReleaseScope)) {
        Invoke-ReleasePipeline -Scope $ReleaseScope -SkipArm $SkipArm64 -Interactive $false
    } else {
        Invoke-BuildOrDev -IsDev $Dev -IsStoreDev $StoreDev -BuildProfile $BuildProfile -Interactive $false
    }
}
