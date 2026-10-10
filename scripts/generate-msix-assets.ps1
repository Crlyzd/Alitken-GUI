# Forwarder to unified build.ps1 MSIX visual assets generator
param (
    [string]$IconPath = "$PSScriptRoot\..\src-tauri\icons\icon.ico",
    [string]$OutputDir = "$PSScriptRoot\..\src-tauri\msix\Assets"
)

$RootPath = Resolve-Path "$PSScriptRoot\.."
& (Join-Path $RootPath "build.ps1") -GenerateAssets
