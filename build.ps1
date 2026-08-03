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
    Write-Host "  [1] Standard Release  (Fast ~30s build, ~10-12 MB binary)" -ForegroundColor Cyan
    Write-Host "  [2] Small Release     (Full LLVM LTO ~2-4m build, ~4.5-6 MB binary)" -ForegroundColor Green
    Write-Host "  [3] Development Mode  (Live Reload, debug window)" -ForegroundColor Magenta
    Write-Host ""
    $choice = Read-Host "Enter choice [1-3] (Default: 1)"
    switch ($choice) {
        "2" { $Profile = "Small" }
        "3" { $Dev = $true }
        default { $Profile = "Standard" }
    }
}

try {
    # 3. Execution
    if ($Dev) {
        Write-Host "[2/3] Launching Tauri Development Mode..." -ForegroundColor Green
        npm run tauri dev
    } else {
        if ($Profile -eq "Small") {
            Write-Host "[2/2] Compiling Tauri Desktop Executable (Ultra-Small LTO Profile)..." -ForegroundColor Green
            Write-Host "NOTE: Full LLVM Link-Time Optimization enabled. Build will take 2-4 minutes." -ForegroundColor DarkYellow

            $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
            $env:CARGO_PROFILE_RELEASE_LTO = "true"
            $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
            $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
            $env:CARGO_PROFILE_RELEASE_STRIP = "true"
        } else {
            Write-Host "[2/2] Compiling Tauri Desktop Executable (Standard Release Profile)..." -ForegroundColor Cyan
            Reset-CargoProfileEnv
        }

        npm run tauri build

        $ExePath = Join-Path $ScriptDir "src-tauri\target\release\alitken-gui.exe"
        $BundlePath = Join-Path $ScriptDir "src-tauri\target\release\bundle"

        # Compute parent directory dynamically (e.g. E:\Default\DEVS\Alitken\)
        $ParentDir = Split-Path -Parent $ScriptDir
        $ParentExePath = Join-Path $ParentDir "Alitken.exe"

        if (Test-Path $ExePath) {
            try {
                if (-not (Test-Path $ParentDir)) {
                    New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
                }
                Copy-Item -Path $ExePath -Destination $ParentExePath -Force
            } catch {
                Write-Host "WARNING: Could not copy executable to parent folder: $_" -ForegroundColor Yellow
            }
        }

        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host "               BUILD SUCCESSFUL!                 " -ForegroundColor Green
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host "Profile Used:                 $Profile" -ForegroundColor Yellow
        Write-Host "Executable location:          $ExePath" -ForegroundColor Cyan
        
        if (Test-Path $ExePath) {
            $sizeBytes = (Get-Item $ExePath).Length
            $sizeMB = [math]::Round($sizeBytes / 1MB, 2)
            Write-Host "Executable Binary Size:       $sizeMB MB" -ForegroundColor White
        }

        if (Test-Path $ParentExePath) {
            Write-Host "Parent Folder Executable:     $ParentExePath" -ForegroundColor Green
        }
        if (Test-Path $BundlePath) {
            Write-Host "Installer package:             $BundlePath" -ForegroundColor Cyan
        }
    }
} finally {
    Reset-CargoProfileEnv
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
