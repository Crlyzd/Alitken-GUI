# Alitken GUI One-Click PowerShell Build Script
[CmdletBinding()]
param (
    [switch]$Dev = $false,
    [ValidateSet("Standard", "Small")]
    [string]$Profile = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       Alitken Media Converter Build Tool" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we are in the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Function to clean up Cargo profile env overrides
function Reset-CargoProfileEnv {
    Get-ChildItem Env:CARGO_PROFILE_RELEASE_* -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
}

# 1. Check Node.js and NPM
Write-Host "[1/3] Checking environment..." -ForegroundColor Yellow
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js / NPM is not installed or not in PATH." -ForegroundColor Red
    Pause
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# 2. Interactive Menu (if no parameters supplied)
if (-not $Dev -and [string]::IsNullOrEmpty($Profile)) {
    Write-Host "Select Build Target:" -ForegroundColor Yellow
    Write-Host "  [1] Standard GitHub Release  (x64 setup installer + exe)" -ForegroundColor Cyan
    Write-Host "  [2] MS Store Release Build   (x64 with store-build features)" -ForegroundColor Blue
    Write-Host "  [3] GitHub Development Mode  (Live Reload, full dev update UI)" -ForegroundColor Magenta
    Write-Host "  [4] MS Store Dev Mode        (Live Reload, preview MS Store UI)" -ForegroundColor DarkCyan
    Write-Host "  [5] Small Release            (Full LLVM LTO ~2-4m build)" -ForegroundColor Green
    Write-Host ""
    $choice = Read-Host "Enter choice [1-5] (Default: 1)"
    switch ($choice) {
        "2" { $Profile = "Store" }
        "3" { $Dev = $true }
        "4" { $Dev = $true; $StoreDev = $true }
        "5" { $Profile = "Small" }
        default { $Profile = "Standard" }
    }
}

try {
    # 3. Execution
    if ($Dev) {
        if ($StoreDev) {
            Write-Host "[2/3] Launching Tauri Development Mode (MS Store Build Preview)..." -ForegroundColor DarkCyan
            npm run tauri dev -- --features store-build
        } else {
            Write-Host "[2/3] Launching Tauri Development Mode (GitHub Build)..." -ForegroundColor Green
            npm run tauri dev
        }
    } else {
        if ($Profile -eq "Small") {
            Write-Host "[2/2] Compiling Tauri Desktop Executable (Ultra-Small LTO Profile)..." -ForegroundColor Green
            Write-Host "NOTE: Full LLVM Link-Time Optimization enabled. Build will take 2-4 minutes." -ForegroundColor DarkYellow

            $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
            $env:CARGO_PROFILE_RELEASE_LTO = "true"
            $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
            $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
            $env:CARGO_PROFILE_RELEASE_STRIP = "true"
            npm run tauri build
        } elseif ($Profile -eq "Store") {
            Write-Host "[2/2] Compiling Tauri Desktop Executable (MS Store Release - Ultra-Small Profile)..." -ForegroundColor Blue
            $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
            $env:CARGO_PROFILE_RELEASE_LTO = "true"
            $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
            $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
            $env:CARGO_PROFILE_RELEASE_STRIP = "true"
            npm run tauri build -- --features store-build
        } else {
            Write-Host "[2/2] Compiling Tauri Desktop Executable (Standard Release Profile)..." -ForegroundColor Cyan
            Reset-CargoProfileEnv
            npm run tauri build
        }

        $ExePath = Join-Path $ScriptDir "src-tauri\target\release\alitken-gui.exe"
        $BundlePath = Join-Path $ScriptDir "src-tauri\target\release\bundle"
        $NsisDir = Join-Path $ScriptDir "src-tauri\target\release\bundle\nsis"
        $ReleasesDir = Join-Path $ScriptDir "releases"

        if (-not (Test-Path $ReleasesDir)) {
            New-Item -ItemType Directory -Path $ReleasesDir -Force | Out-Null
        }

        # Compute parent directory dynamically (e.g. E:\Default\DEVS\Alitken\)
        $ParentDir = Split-Path -Parent $ScriptDir
        $ParentExePath = Join-Path $ParentDir "Alitken.exe"

        # Fetch current application version from package.json
        $PackageJsonPath = Join-Path $ScriptDir "package.json"
        $AppVersion = if (Test-Path $PackageJsonPath) {
            (Get-Content $PackageJsonPath -Raw | ConvertFrom-Json).version
        } else {
            "0.6.0"
        }

        if (Test-Path $ExePath) {
            try {
                if (-not (Test-Path $ParentDir)) {
                    New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
                }
                Copy-Item -Path $ExePath -Destination $ParentExePath -Force

                # Copy to releases folder with descriptive name
                $PortableName = "Alitken_v${AppVersion}_${Profile}_x64-Portable.exe"
                Copy-Item -Path $ExePath -Destination (Join-Path $ReleasesDir $PortableName) -Force
            } catch {
                Write-Host "WARNING: Could not copy executable to parent/releases folder: $_" -ForegroundColor Yellow
            }
        }

        # Copy installer setup binary if present (sort by LastWriteTime descending to grab latest)
        $InstallerExe = Get-ChildItem -Path $NsisDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($InstallerExe) {
            $SetupName = "Alitken_v${AppVersion}_${Profile}_x64-Setup.exe"
            Copy-Item -Path $InstallerExe.FullName -Destination (Join-Path $ReleasesDir $SetupName) -Force
        }

        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host "               BUILD SUCCESSFUL!                 " -ForegroundColor Green
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host "Profile Used:                 $Profile" -ForegroundColor Yellow
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

        # Auto-open releases folder in Windows Explorer
        Invoke-Item $ReleasesDir
    }
} finally {
    Reset-CargoProfileEnv
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
