# Forwarder to unified build.ps1 release distribution pipeline
[CmdletBinding()]
param (
    [ValidateSet("all", "x64", "64", "arm64", "github", "store", "")]
    [string]$Scope = "all",
    [switch]$SkipArm64 = $false,
    [switch]$NoPause = $false
)

$RootPath = Resolve-Path "$PSScriptRoot\.."
& (Join-Path $RootPath "build.ps1") -ReleaseScope $Scope -SkipArm64:$SkipArm64 -NoPause:$NoPause
