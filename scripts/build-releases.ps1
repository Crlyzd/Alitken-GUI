# Alitken Multi-Target Release Build Script
# Builds Release Binaries for GitHub and Microsoft Store:
#   1. GitHub Release (64)       - Self-Updater Enabled (NSIS Setup.exe + Portable.exe)
#   2. GitHub Release (ARM64)    - Self-Updater Enabled (Optional / Auto-Skipped if toolchain missing)
#   3. MS Store Build (64)       - Store Update Managed (.msix Windows App Package + Portable.exe)
#   4. MS Store Build (ARM64)    - Store Update Managed (.msix Windows App Package + Portable.exe)

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

    # Find MakeAppx.exe from Windows Kits 10/11 or PATH
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

    # Helper function to build MS Store target as an authentic Windows App Package (.msix)
    function Invoke-TauriMsixTarget {
        param(
            [string]$Target,
            [string]$FlavorName,
            [string]$OutputPrefix,
            [string]$Features = "store-build"
        )

        Write-Host ""
        Write-Host "----------------------------------------------------" -ForegroundColor Green
        Write-Host " Building MS Store Package: $FlavorName ($Target)..." -ForegroundColor Green
        Write-Host "----------------------------------------------------" -ForegroundColor Green

        $MakeAppxExe = Find-MakeAppxExe
        if (-not $MakeAppxExe) {
            Write-Host "[ERROR] 'makeappx.exe' from Windows Kits 10/11 SDK was not detected." -ForegroundColor Red
            Write-Host "        Install the Windows 10/11 SDK or ensure makeappx.exe is in PATH." -ForegroundColor Yellow
            throw "makeappx.exe not found"
        }
        Write-Host " Using Windows SDK MakeAppx: $MakeAppxExe" -ForegroundColor Gray

        Set-Location $RootPath

        # Compile Tauri binary with store-build feature, skipping NSIS packaging
        $buildArgs = @("tauri", "build", "--target", $Target, "--no-bundle")
        if ($Features) {
            $buildArgs += @("--features", $Features)
        }

        & npx $buildArgs

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to compile $FlavorName for $Target" -ForegroundColor Red
            throw "Failed to compile $FlavorName for $Target"
        }

        $TargetReleaseExe = Join-Path $RootPath "src-tauri\target\$Target\release\alitken-gui.exe"
        if (-not (Test-Path $TargetReleaseExe)) {
            throw "Compiled binary not found at $TargetReleaseExe"
        }

        # Setup staging directory for MSIX layout
        $StagingDir = Join-Path $RootPath "src-tauri\target\$Target\msix_staging"
        if (Test-Path $StagingDir) {
            Remove-Item -Path $StagingDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

        # 1. Copy application binary
        Copy-Item -Path $TargetReleaseExe -Destination (Join-Path $StagingDir "alitken-gui.exe") -Force

        # 2. Copy visual assets
        $AssetsDir = Join-Path $StagingDir "Assets"
        $SourceAssets = Join-Path $RootPath "src-tauri\msix\Assets"
        if (-not (Test-Path $SourceAssets)) {
            Write-Host " Generating missing MSIX visual assets..." -ForegroundColor Yellow
            & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RootPath "scripts\generate-msix-assets.ps1")
        }
        Copy-Item -Path $SourceAssets -Destination $AssetsDir -Recurse -Force

        # 3. Read MS Store Partner Center credentials
        $ConfigPath = Join-Path $RootPath "src-tauri\msix\msstore.config.json"
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

        # Format 4-part quad version (Major.Minor.Build.Revision)
        $cleanVersion = $AppVersion.Split("-")[0].Split("+")[0]
        $verParts = $cleanVersion.Split(".")
        $major = if ($verParts.Length -gt 0) { $verParts[0] } else { "0" }
        $minor = if ($verParts.Length -gt 1) { $verParts[1] } else { "0" }
        $patch = if ($verParts.Length -gt 2) { $verParts[2] } else { "0" }
        $quadVersion = "$major.$minor.$patch.0"

        # MSIX Processor Architecture: x64 or arm64
        $msixArch = if ($Target -like "*aarch64*") { "arm64" } else { "x64" }

        # 4. Generate AppxManifest.xml from template
        $TemplatePath = Join-Path $RootPath "src-tauri\msix\AppxManifest.template.xml"
        if (-not (Test-Path $TemplatePath)) {
            throw "MSIX manifest template not found at $TemplatePath"
        }
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

        # 5. Pack into .msix with MakeAppx.exe
        $DestMsixName = "${OutputPrefix}.msix"
        $DestMsixPath = Join-Path $OutputDistFolder $DestMsixName

        Write-Host " Packing Windows App Package (.msix)..." -ForegroundColor Yellow
        & "$MakeAppxExe" pack /d "$StagingDir" /p "$DestMsixPath" /o
        if ($LASTEXITCODE -ne 0) {
            throw "MakeAppx failed with exit code $LASTEXITCODE"
        }

        Write-Host " Saved MSIX Package:  $DestMsixPath" -ForegroundColor Green
        Write-Host "   -> Package Identity:  $pkgIdentity" -ForegroundColor DarkGray
        Write-Host "   -> Package Publisher: $publisher" -ForegroundColor DarkGray
        Write-Host "   -> Package Version:   $quadVersion ($msixArch)" -ForegroundColor DarkGray
        Write-Host "   -> Submission Status: Ready for Microsoft Store Partner Center (auto-signed upon ingestion)" -ForegroundColor DarkGray

        # Clean staging directory
        Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue

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

    # 3. MS Store Build (64) -> Outputs .msix Windows App Package
    if ($Scope -eq "all" -or $Scope -eq "x64" -or $Scope -eq "64" -or $Scope -eq "store") {
        Invoke-TauriMsixTarget -Target "x86_64-pc-windows-msvc" -FlavorName "MS Store Release (64)" -OutputPrefix "Alitken_v${AppVersion}_MSStore_64" -Features "store-build"
    }

    # 4. MS Store Build (ARM64) -> Outputs .msix Windows App Package
    if ($isArm64Supported -and ($Scope -eq "all" -or $Scope -eq "arm64" -or $Scope -eq "store")) {
        Invoke-TauriMsixTarget -Target "aarch64-pc-windows-msvc" -FlavorName "MS Store Release (ARM64)" -OutputPrefix "Alitken_v${AppVersion}_MSStore_ARM64" -Features "store-build"
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
