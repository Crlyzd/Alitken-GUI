# Alitken GUI One-Click PowerShell Version Bump Script
[CmdletBinding()]
param (
    [ValidateSet("patch", "minor", "major", "custom", "")]
    [string]$Type = "",
    [string]$Version = "",
    [switch]$NoPause = $false
)

$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       Alitken Media Converter Version Tool" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure working directory is the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Check Node.js / NPM environment
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js / NPM is not installed or not available in PATH." -ForegroundColor Red
    if (-not $NoPause) {
        Write-Host "Press any key to close..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    exit 1
}

# 2. Read current version from package.json
$PackageJsonPath = Join-Path $ScriptDir "package.json"
if (-not (Test-Path $PackageJsonPath)) {
    Write-Host "ERROR: package.json not found at $PackageJsonPath" -ForegroundColor Red
    if (-not $NoPause) {
        Write-Host "Press any key to close..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    exit 1
}

$packageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
$oldVersion = $packageJson.version

Write-Host "Current Application Version: " -NoNewline
Write-Host "v$oldVersion" -ForegroundColor Yellow
Write-Host ""

# Parse semver for dynamic example calculation
$semverClean = $oldVersion.Split('-')[0]
$parts = $semverClean.Split('.')
$major = if ($parts.Length -gt 0) { [int]$parts[0] } else { 0 }
$minor = if ($parts.Length -gt 1) { [int]$parts[1] } else { 0 }
$patch = if ($parts.Length -gt 2) { [int]$parts[2] } else { 0 }

$exPatch = "$major.$minor.$($patch + 1)"
$exMinor = "$major.$($minor + 1).0"
$exMajor = "$($major + 1).0.0"

# 3. Interactive Menu (if parameters not specified)
$targetArg = ""

if ([string]::IsNullOrEmpty($Type) -and [string]::IsNullOrEmpty($Version)) {
    Write-Host "Select Version Increment Type:" -ForegroundColor Yellow
    Write-Host "  [1] Patch  (Bug fixes / minor tweaks, e.g. v$oldVersion -> v$exPatch)" -ForegroundColor Cyan
    Write-Host "  [2] Minor  (New features / functionality, e.g. v$oldVersion -> v$exMinor)" -ForegroundColor Green
    Write-Host "  [3] Major  (Breaking changes / major overhaul, e.g. v$oldVersion -> v$exMajor)" -ForegroundColor Red
    Write-Host "  [4] Custom (Specify exact version string)" -ForegroundColor Magenta
    Write-Host ""
    $choice = Read-Host "Enter choice [1-4] (Default: 1 - Patch)"
    switch ($choice) {
        "2" { $targetArg = "minor" }
        "3" { $targetArg = "major" }
        "4" {
            $customVal = Read-Host "Enter custom version (e.g. 0.5.0-beta.1)"
            if ([string]::IsNullOrWhitespace($customVal)) {
                Write-Host "ERROR: Custom version string cannot be empty." -ForegroundColor Red
                if (-not $NoPause) {
                    Write-Host "Press any key to close..." -ForegroundColor Gray
                    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                }
                exit 1
            }
            $targetArg = $customVal.Trim()
        }
        default { $targetArg = "patch" }
    }
} elseif (-not [string]::IsNullOrEmpty($Version)) {
    $targetArg = $Version.Trim()
} elseif (-not [string]::IsNullOrEmpty($Type)) {
    if ($Type -eq "custom") {
        if ([string]::IsNullOrWhitespace($Version)) {
            Write-Host "ERROR: -Version parameter must be provided when -Type is 'custom'." -ForegroundColor Red
            exit 1
        }
        $targetArg = $Version.Trim()
    } else {
        $targetArg = $Type
    }
}

# 4. Execute version bump & Single Source of Truth propagation
Write-Host ""
Write-Host "Running single-source version propagation..." -ForegroundColor Yellow

# Execute npm version
npm version $targetArg --no-git-tag-version

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Version bump failed (npm exit code: $LASTEXITCODE)." -ForegroundColor Red
    if (-not $NoPause) {
        Write-Host "Press any key to close..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    exit $LASTEXITCODE
}

# Read updated version from package.json
$updatedPackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
$newVersion = $updatedPackageJson.version

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "           VERSION BUMP SUCCESSFUL!               " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Previous Version:             v$oldVersion" -ForegroundColor Gray
Write-Host "New Application Version:      v$newVersion" -ForegroundColor Green
Write-Host ""
Write-Host "Synchronized files:" -ForegroundColor Cyan
Write-Host "  [+] package.json             -> v$newVersion" -ForegroundColor White
Write-Host "  [+] src-tauri/tauri.conf.json -> v$newVersion" -ForegroundColor White
Write-Host "  [+] src-tauri/Cargo.toml     -> v$newVersion" -ForegroundColor White
Write-Host ""

# 5. Pause for 1-click execution in Explorer
if (-not $NoPause) {
    Write-Host "Press any key to close..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
