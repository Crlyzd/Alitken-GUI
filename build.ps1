# Alitken GUI One-Click PowerShell Build Script
[CmdletBinding()]
param (
    [switch]$Dev = $false,
    [switch]$StoreDev = $false,
    [switch]$Fast = $false,
    [ValidateSet("Standard", "Small", "Store", "MSStore", "Fast")]
    [string]$BuildProfile = "",
    [switch]$NoPause = $false
)

$ErrorActionPreference = "Stop"

# Ensure we are in the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Fetch current application version from package.json
$PackageJsonPath = Join-Path $ScriptDir "package.json"
$AppVersion = if (Test-Path $PackageJsonPath) {
    try {
        (Get-Content $PackageJsonPath -Raw | ConvertFrom-Json).version
    } catch {
        "0.8.0"
    }
} else {
    "0.8.0"
}

# Normalize parameters
if ($Fast) {
    $BuildProfile = "Fast"
}
if ($StoreDev) {
    $Dev = $true
}
if ($BuildProfile -eq "MSStore") {
    $BuildProfile = "Store"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     Alitken Media Converter Build Tool (v$AppVersion)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Function to clean up Cargo profile env overrides
function Reset-CargoProfileEnv {
    Get-ChildItem Env:CARGO_PROFILE_RELEASE_* -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
}

# 1. Check Node.js, NPM, and Cargo
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

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed." -ForegroundColor Red
        if (-not $NoPause -and [Environment]::UserInteractive) { Pause }
        exit 1
    }
}

# 2. Interactive Menu (if no parameters supplied)
if (-not $Dev -and [string]::IsNullOrEmpty($BuildProfile)) {
    Write-Host "Select Build Target:" -ForegroundColor Yellow
    Write-Host "  [1] Standard GitHub Release  (x64 setup installer + exe)" -ForegroundColor Cyan
    Write-Host "  [2] MS Store Release Build   (x64 with store-build features)" -ForegroundColor Blue
    Write-Host "  [3] GitHub Development Mode  (Live Reload, full dev update UI)" -ForegroundColor Magenta
    Write-Host "  [4] MS Store Dev Mode        (Live Reload, preview MS Store UI)" -ForegroundColor DarkCyan
    Write-Host "  [5] Small Release            (Full LLVM LTO ~2-4m build)" -ForegroundColor Green
    Write-Host "  [6] Ultra-Fast Compile       (Fastest build: 256 codegen units, zero LTO)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Enter choice [1-6] (Default: 1)"
    switch ($choice) {
        "2" { $BuildProfile = "Store" }
        "3" { $Dev = $true }
        "4" { $Dev = $true; $StoreDev = $true }
        "5" { $BuildProfile = "Small" }
        "6" { $BuildProfile = "Fast" }
        default { $BuildProfile = "Standard" }
    }
}

$BuildFailed = $false

try {
    # 3. Execution
    if ($Dev) {
        if ($StoreDev) {
            Write-Host "[2/2] Launching Tauri Development Mode (MS Store Build Preview)..." -ForegroundColor DarkCyan
            npm run tauri dev -- --features store-build
        } else {
            Write-Host "[2/2] Launching Tauri Development Mode (GitHub Build)..." -ForegroundColor Green
            npm run tauri dev
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Tauri development server exited with code $LASTEXITCODE"
        }
    } else {
        if ($BuildProfile -eq "Fast") {
            Write-Host "[2/3] Compiling Tauri Desktop Executable (Ultra-Fast Compilation Profile)..." -ForegroundColor White
            Write-Host "NOTE: Compiling with zero LTO, 256 parallel codegen units, and opt-level 1 for maximum build speed." -ForegroundColor DarkGray

            $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "1"
            $env:CARGO_PROFILE_RELEASE_LTO = "off"
            $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "256"
            $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
            $env:CARGO_PROFILE_RELEASE_STRIP = "false"
            npm run tauri build
        } elseif ($BuildProfile -eq "Small") {
            Write-Host "[2/3] Compiling Tauri Desktop Executable (Ultra-Small LTO Profile)..." -ForegroundColor Green
            Write-Host "NOTE: Full LLVM Link-Time Optimization enabled. Build will take 2-4 minutes." -ForegroundColor DarkYellow

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
            if (Test-Path $AltExe) {
                $ExePath = $AltExe
            }
        }

        $NsisDir = Join-Path $ScriptDir "src-tauri\target\release\bundle\nsis"
        if (-not (Test-Path $NsisDir)) {
            $AltNsis = Join-Path $ScriptDir "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis"
            if (Test-Path $AltNsis) {
                $NsisDir = $AltNsis
            }
        }

        $ReleasesDir = Join-Path $ScriptDir "releases"
        if (-not (Test-Path $ReleasesDir)) {
            New-Item -ItemType Directory -Path $ReleasesDir -Force | Out-Null
        }

        # Compute parent directory dynamically (e.g. E:\Default\DEVS\Alitken\)
        $ParentDir = Split-Path -Parent $ScriptDir
        $ParentExePath = Join-Path $ParentDir "Alitken.exe"

        # Determine descriptive output name component
        $OutputProfile = if ($BuildProfile -eq "Store") { "MSStore" } else { $BuildProfile }

        if (Test-Path $ExePath) {
            # Copy to parent folder as primary local runnable
            try {
                if (-not (Test-Path $ParentDir)) {
                    New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
                }
                Copy-Item -Path $ExePath -Destination $ParentExePath -Force
                Write-Host " Copied Local Binary:  $ParentExePath" -ForegroundColor Green
            } catch {
                Write-Host " WARNING: Could not copy executable to parent folder: $_" -ForegroundColor Yellow
            }

            # Copy to releases folder with descriptive name
            try {
                $PortableName = "Alitken_v${AppVersion}_${OutputProfile}_64-Portable.exe"
                $DestPortable = Join-Path $ReleasesDir $PortableName
                Copy-Item -Path $ExePath -Destination $DestPortable -Force
                Write-Host " Saved Portable:       $DestPortable" -ForegroundColor Cyan
            } catch {
                Write-Host " WARNING: Could not copy portable executable to releases folder: $_" -ForegroundColor Yellow
            }
        } else {
            Write-Host " WARNING: Compiled binary not found at $ExePath" -ForegroundColor Yellow
        }

        # Copy installer setup binary if present (sort by LastWriteTime descending to grab latest)
        $InstallerExe = Get-ChildItem -Path $NsisDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($InstallerExe) {
            try {
                $SetupName = "Alitken_v${AppVersion}_${OutputProfile}_64-Setup.exe"
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

        # Auto-open releases folder in Windows Explorer if interactive
        if (-not $NoPause -and [Environment]::UserInteractive) {
            try {
                Invoke-Item $ReleasesDir
            } catch {}
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
    if (-not $NoPause -and [Environment]::UserInteractive) {
        Write-Host ""
        Write-Host "Press any key to close..." -ForegroundColor Gray
        try {
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        } catch {
            Read-Host | Out-Null
        }
    }
}

if ($BuildFailed) {
    exit 1
}
