# Alitken Multi-Target Release Build Script
# Builds Release Binaries for GitHub and Microsoft Store:
#   1. GitHub Release (64)       - Self-Updater Enabled
#   2. GitHub Release (ARM64)    - Self-Updater Enabled (Optional / Auto-Skipped if toolchain missing)
#   3. MS Store Build (64)       - Store Update Managed
#   4. MS Store Build (ARM64)    - Store Update Managed (Optional / Auto-Skipped if toolchain missing)

[CmdletBinding()]
param (
    [ValidateSet("all", "x64", "64", "arm64", "github", "store")]
    [string]$Scope = "all",
    [switch]$SkipArm64 = $false,
    [switch]$NoPause = $false
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "     ALITKEN MULTI-TARGET RELEASE BUILD ENGINE      " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$RootPath = Resolve-Path "$PSScriptRoot\.."
Set-Location $RootPath

$PackageJsonPath = Join-Path $RootPath "package.json"
$AppVersion = if (Test-Path $PackageJsonPath) {
    (Get-Content $PackageJsonPath -Raw | ConvertFrom-Json).version
} else {
    "0.7.0"
}

Write-Host " Target Application Version: v$AppVersion" -ForegroundColor Yellow
Write-Host " Selected Build Scope:       $Scope" -ForegroundColor Yellow
if ($SkipArm64) {
    Write-Host " ARM64 Target Building:      Disabled (-SkipArm64)" -ForegroundColor Gray
}

$OutputDistFolder = Join-Path $RootPath "releases"
if (-not (Test-Path $OutputDistFolder)) {
    New-Item -ItemType Directory -Path $OutputDistFolder -Force | Out-Null
}

# Check whether ARM64 C/C++ cross-compiler tools and Rust target are available
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
            if ($armCl) {
                return $true
            }
        }
    }
    return $false
}

function Test-Arm64ToolchainAvailable {
    $hasVsArmCl = Test-VsArm64ClAvailable
    $hasRustTarget = Test-RustArm64TargetAvailable

    if (-not $hasVsArmCl) {
        Write-Host ""
        Write-Host "[ADVISORY] Visual Studio ARM64 C++ Build Tools (cl.exe) not detected on this machine." -ForegroundColor Yellow
        Write-Host "           Skipping ARM64 targets. To enable ARM64, install 'MSVC v143 ARM64 build tools' in VS Installer." -ForegroundColor Gray
        return $false
    }

    if (-not $hasRustTarget) {
        Write-Host ""
        Write-Host "[ADVISORY] Rust ARM64 target (aarch64-pc-windows-msvc) is not installed." -ForegroundColor Yellow
        Write-Host "           Attempting to install 'aarch64-pc-windows-msvc' via rustup..." -ForegroundColor Cyan
        & rustup target add aarch64-pc-windows-msvc
        if ($LASTEXITCODE -eq 0) {
            Write-Host "           Successfully added Rust ARM64 target!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "           Failed to auto-install Rust ARM64 target. Run 'rustup target add aarch64-pc-windows-msvc' manually." -ForegroundColor Red
            return $false
        }
    }

    return $true
}

try {
    # 0. Enable Ultra-Small LTO size optimization profile (~4.5MB - 6MB output binaries)
    Write-Host ""
    Write-Host "[0/5] Enabling Ultra-Small LTO Size Optimization Profile..." -ForegroundColor Yellow
    $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
    $env:CARGO_PROFILE_RELEASE_LTO = "true"
    $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
    $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
    $env:CARGO_PROFILE_RELEASE_STRIP = "true"

    # 1. Ensure frontend production dist is ready
    Write-Host "[1/5] Building Frontend Production Dist..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend build failed!" -ForegroundColor Red
        throw "Frontend build failed"
    }

    # Helper function to execute Tauri release build and collect binaries into releases/ folder
    function Invoke-TauriTarget {
        param(
            [string]$Target,
            [string]$FlavorName,
            [string]$OutputPrefix,
            [string]$Features = ""
        )

        Write-Host ""
        Write-Host "----------------------------------------------------" -ForegroundColor Green
        Write-Host " Building: $FlavorName ($Target)..." -ForegroundColor Green
        Write-Host "----------------------------------------------------" -ForegroundColor Green

        Set-Location $RootPath

        $buildArgs = @("tauri", "build", "--target", $Target, "--bundles", "nsis")
        if ($Features) {
            $buildArgs += @("--features", $Features)
        }

        & npx $buildArgs

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to build $FlavorName for $Target" -ForegroundColor Red
            throw "Failed to build $FlavorName for $Target"
        }

        # Locate built NSIS installer executable
        $TargetBundleDir = Join-Path $RootPath "src-tauri\target\$Target\release\bundle\nsis"
        $InstallerExe = Get-ChildItem -Path $TargetBundleDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

        if ($InstallerExe) {
            $DestInstallerName = "${OutputPrefix}-Setup.exe"
            $DestPath = Join-Path $OutputDistFolder $DestInstallerName
            Copy-Item -Path $InstallerExe.FullName -Destination $DestPath -Force
            Write-Host " Saved Installer: $DestPath" -ForegroundColor Cyan
        }

        # Locate standalone/portable executable
        $TargetReleaseExe = Join-Path $RootPath "src-tauri\target\$Target\release\alitken-gui.exe"
        if (Test-Path $TargetReleaseExe) {
            $DestExeName = "${OutputPrefix}-Portable.exe"
            $DestExePath = Join-Path $OutputDistFolder $DestExeName
            Copy-Item -Path $TargetReleaseExe -Destination $DestExePath -Force
            Write-Host " Saved Portable:  $DestExePath" -ForegroundColor Cyan
        }

        return $true
    }

    $isArm64Supported = -not $SkipArm64 -and (Test-Arm64ToolchainAvailable)

    # 1. GitHub Release (64)
    if ($Scope -eq "all" -or $Scope -eq "x64" -or $Scope -eq "64" -or $Scope -eq "github") {
        Invoke-TauriTarget -Target "x86_64-pc-windows-msvc" -FlavorName "GitHub Release (64)" -OutputPrefix "Alitken_v${AppVersion}_GitHub_64"
    }

    # 2. GitHub Release (ARM64)
    if ($isArm64Supported -and ($Scope -eq "all" -or $Scope -eq "arm64" -or $Scope -eq "github")) {
        Invoke-TauriTarget -Target "aarch64-pc-windows-msvc" -FlavorName "GitHub Release (ARM64)" -OutputPrefix "Alitken_v${AppVersion}_GitHub_ARM64"
    }

    # 3. MS Store Build (64)
    if ($Scope -eq "all" -or $Scope -eq "x64" -or $Scope -eq "64" -or $Scope -eq "store") {
        Invoke-TauriTarget -Target "x86_64-pc-windows-msvc" -FlavorName "MS Store Release (64)" -OutputPrefix "Alitken_v${AppVersion}_MSStore_64" -Features "store-build"
    }

    # 4. MS Store Build (ARM64)
    if ($isArm64Supported -and ($Scope -eq "all" -or $Scope -eq "arm64" -or $Scope -eq "store")) {
        Invoke-TauriTarget -Target "aarch64-pc-windows-msvc" -FlavorName "MS Store Release (ARM64)" -OutputPrefix "Alitken_v${AppVersion}_MSStore_ARM64" -Features "store-build"
    }

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "        RELEASE BINARIES BUILT & ORGANIZED!         " -ForegroundColor Green
    Write-Host " All files saved cleanly in: $OutputDistFolder" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Cyan

    # Auto-open releases folder in Windows Explorer if interactive
    if ([Environment]::UserInteractive) {
        Invoke-Item $OutputDistFolder
    }
} catch {
    Write-Host ""
    Write-Host "ERROR ENCOUNTERED: $_" -ForegroundColor Red
} finally {
    Get-ChildItem Env:CARGO_PROFILE_RELEASE_* -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
    if (-not $NoPause -and [Environment]::UserInteractive) {
        Write-Host ""
        Write-Host "Press any key to close..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}
