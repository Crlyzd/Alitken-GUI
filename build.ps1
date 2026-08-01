# Alitken GUI One-Click PowerShell Build Script
[CmdletBinding()]
param (
    [switch]$Dev = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       Alitken Media Converter Build Tool" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we are in the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

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

# 2. Build Mode Selection
if ($Dev) {
    Write-Host "[2/3] Launching Tauri Development Mode..." -ForegroundColor Green
    npm run tauri dev
} else {
    Write-Host "[2/3] Building Web Frontend (TypeScript + Vite)..." -ForegroundColor Yellow
    npm run build

    Write-Host "[3/3] Compiling Tauri Desktop Executable (Rust Release)..." -ForegroundColor Yellow
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
    Write-Host "Executable location (Release): $ExePath" -ForegroundColor Cyan
    if (Test-Path $ParentExePath) {
        Write-Host "Parent Folder Executable:     $ParentExePath" -ForegroundColor Green
    }
    if (Test-Path $BundlePath) {
        Write-Host "Installer package:             $BundlePath" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
