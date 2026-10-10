# Forwarder to unified build.ps1 version bump workflow
[CmdletBinding()]
param (
    [ValidateSet("patch", "minor", "major", "custom", "")]
    [string]$Type = "",
    [string]$Version = "",
    [switch]$NoPause = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "build.ps1") -Bump $Type -Version $Version -NoPause:$NoPause
