# Alitken Multi-Target Release Build Script
# Builds 4 Release Binaries:
#   1. GitHub Release (x86_64)   - Self-Updater Enabled
#   2. GitHub Release (ARM64)    - Self-Updater Enabled
#   3. MS Store Build (x86_64)   - Store Update Managed
#   4. MS Store Build (ARM64)    - Store Update Managed

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " ALITKEN MULTI-TARGET RELEASE BUILD ENGINE " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$RootPath = Resolve-Path "$PSScriptRoot\.."
Set-Location $RootPath

$PackageJsonPath = Join-Path $RootPath "package.json"
$AppVersion = if (Test-Path $PackageJsonPath) {
    (Get-Content $PackageJsonPath -Raw | ConvertFrom-Json).version
} else {
    "0.6.0"
}

Write-Host " Target Application Version: v$AppVersion" -ForegroundColor Yellow

$OutputDistFolder = Join-Path $RootPath "releases"
if (-not (Test-Path $OutputDistFolder)) {
    New-Item -ItemType Directory -Path $OutputDistFolder -Force | Out-Null
}

try {
    # Enable Ultra-Small LTO size optimization profile (~4.5MB - 6MB output binaries)
    Write-Host "[0/5] Enabling Ultra-Small LTO Size Optimization Profile..." -ForegroundColor Yellow
    $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "z"
    $env:CARGO_PROFILE_RELEASE_LTO = "true"
    $env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "1"
    $env:CARGO_PROFILE_RELEASE_PANIC = "abort"
    $env:CARGO_PROFILE_RELEASE_STRIP = "true"

    # Ensure frontend production dist is ready
    Write-Host "[1/5] Building Frontend Production Dist..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend build failed!" -ForegroundColor Red
        throw "Frontend build failed"
    }

    # Function to run Tauri release build and collect binaries into root releases/ folder
    function Invoke-TauriTarget {
        param(
            [string]$Target,
            [string]$FlavorName,
            [string]$OutputPrefix,
            [string]$Features = ""
        )

        Write-Host "----------------------------------------------------" -ForegroundColor Green
        Write-Host " Building: $FlavorName ($Target)..." -ForegroundColor Green
        Write-Host "----------------------------------------------------" -ForegroundColor Green

        Set-Location $RootPath

        if ($Features) {
            npx tauri build --target $Target --features $Features
        } else {
            npx tauri build --target $Target
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to build $FlavorName for $Target" -ForegroundColor Red
            throw "Failed to build $FlavorName for $Target"
        }

        # Locate built NSIS installer executable (sort by LastWriteTime descending to grab latest)
        $TargetBundleDir = Join-Path $RootPath "src-tauri\target\$Target\release\bundle\nsis"
        $InstallerExe = Get-ChildItem -Path $TargetBundleDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

        if ($InstallerExe) {
            $DestInstallerName = "${OutputPrefix}-Setup.exe"
            $DestPath = Join-Path $OutputDistFolder $DestInstallerName
            Copy-Item -Path $InstallerExe.FullName -Destination $DestPath -Force
            Write-Host " Saved Installer: $DestPath" -ForegroundColor Cyan
        }

        # Also copy standalone executable
        $TargetReleaseExe = Join-Path $RootPath "src-tauri\target\$Target\release\alitken-gui.exe"
        if (Test-Path $TargetReleaseExe) {
            $DestExeName = "${OutputPrefix}-Portable.exe"
            $DestExePath = Join-Path $OutputDistFolder $DestExeName
            Copy-Item -Path $TargetReleaseExe -Destination $DestExePath -Force
            Write-Host " Saved Portable:  $DestExePath" -ForegroundColor Cyan
        }

        return $true
    }

    # 1. GitHub Release (x86_64)
    Invoke-TauriTarget -Target "x86_64-pc-windows-msvc" -FlavorName "GitHub Release (x64)" -OutputPrefix "Alitken_v${AppVersion}_GitHub_x64"

    # 2. GitHub Release (ARM64)
    Invoke-TauriTarget -Target "aarch64-pc-windows-msvc" -FlavorName "GitHub Release (ARM64)" -OutputPrefix "Alitken_v${AppVersion}_GitHub_ARM64"

    # 3. MS Store Build (x86_64)
    Invoke-TauriTarget -Target "x86_64-pc-windows-msvc" -FlavorName "MS Store Release (x64)" -OutputPrefix "Alitken_v${AppVersion}_MSStore_x64" -Features "store-build"

    # 4. MS Store Build (ARM64)
    Invoke-TauriTarget -Target "aarch64-pc-windows-msvc" -FlavorName "MS Store Release (ARM64)" -OutputPrefix "Alitken_v${AppVersion}_MSStore_ARM64" -Features "store-build"

    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host " ALL 4 RELEASE BINARIES BUILT & ORGANIZED! " -ForegroundColor Green
    Write-Host " All files saved cleanly in: $OutputDistFolder" -ForegroundColor Yellow
    Write-Host "====================================================" -ForegroundColor Cyan

    # Auto-open releases folder in Windows Explorer
    Invoke-Item $OutputDistFolder
} catch {
    Write-Host ""
    Write-Host "ERROR ENCOUNTERED: $_" -ForegroundColor Red
} finally {
    Get-ChildItem Env:CARGO_PROFILE_RELEASE_* -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Press any key to close..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
