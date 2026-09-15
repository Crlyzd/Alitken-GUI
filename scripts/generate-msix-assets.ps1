# Utility to generate standard MSIX visual assets from src-tauri/icons/icon.ico
param (
    [string]$IconPath = "$PSScriptRoot\..\src-tauri\icons\icon.ico",
    [string]$OutputDir = "$PSScriptRoot\..\src-tauri\msix\Assets"
)

Add-Type -AssemblyName PresentationCore, WindowsBase, PresentationFramework

if (-not (Test-Path $IconPath)) {
    Write-Error "Icon file not found at: $IconPath"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$iconUri = [System.Uri]::new((Resolve-Path $IconPath).Path)
$decoder = [System.Windows.Media.Imaging.IconBitmapDecoder]::new(
    $iconUri,
    [System.Windows.Media.Imaging.BitmapCreateOptions]::None,
    [System.Windows.Media.Imaging.BitmapCacheOption]::Default
)

# Pick largest available frame (256x256)
$sourceFrame = $decoder.Frames | Sort-Object PixelWidth -Descending | Select-Object -First 1

function Save-AssetPng {
    param(
        [int]$CanvasWidth,
        [int]$CanvasHeight,
        [int]$IconWidth,
        [int]$IconHeight,
        [string]$FileName
    )

    $group = [System.Windows.Media.DrawingGroup]::new()
    $dc = $group.Open()
    $x = ($CanvasWidth - $IconWidth) / 2
    $y = ($CanvasHeight - $IconHeight) / 2
    $rect = [System.Windows.Rect]::new($x, $y, $IconWidth, $IconHeight)
    $dc.DrawImage($sourceFrame, $rect)
    $dc.Close()

    $drawingVisual = [System.Windows.Media.DrawingVisual]::new()
    $context = $drawingVisual.RenderOpen()
    $context.DrawDrawing($group)
    $context.Close()

    $rtb = [System.Windows.Media.Imaging.RenderTargetBitmap]::new(
        $CanvasWidth,
        $CanvasHeight,
        96,
        96,
        [System.Windows.Media.PixelFormats]::Pbgra32
    )
    $rtb.Render($drawingVisual)

    $encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
    $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb))

    $outFilePath = Join-Path $OutputDir $FileName
    $fs = [System.IO.FileStream]::new($outFilePath, [System.IO.FileMode]::Create)
    $encoder.Save($fs)
    $fs.Close()

    Write-Host "Generated MSIX Asset: $FileName ($CanvasWidth x $CanvasHeight)" -ForegroundColor Green
}

Save-AssetPng 50 50 50 50 "StoreLogo.png"
Save-AssetPng 44 44 44 44 "Square44x44Logo.png"
Save-AssetPng 150 150 150 150 "Square150x150Logo.png"
Save-AssetPng 310 150 150 150 "Wide310x150Logo.png"
Save-AssetPng 620 300 200 200 "SplashScreen.png"
