Add-Type -AssemblyName System.Drawing

$src = "C:\Users\rehan\.gemini\antigravity\brain\50185774-f110-491a-ae72-9cc9aa42e3c9\.user_uploaded\media_1794136045253_fc569d1e.jpg"
$baseImg = [System.Drawing.Bitmap]::FromFile($src)

function Resize-Image($source, $width, $height, $destPath, [bool]$padMaskable = $false) {
    $destBitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.FillRectangle($whiteBrush, 0, 0, $width, $height)

    if ($padMaskable) {
        # Safe zone is 80% (10% padding on each side)
        $padX = [int]($width * 0.1)
        $padY = [int]($height * 0.1)
        $drawW = [int]($width * 0.8)
        $drawH = [int]($height * 0.8)
        $graphics.DrawImage($source, $padX, $padY, $drawW, $drawH)
    } else {
        $graphics.DrawImage($source, 0, 0, $width, $height)
    }

    $destBitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $destBitmap.Dispose()
    $whiteBrush.Dispose()
    Write-Host "Generated: $destPath ($width x $height)"
}

# 1. public/logo.png & edutechlab-logo.png
Resize-Image $baseImg 1024 1024 "public\logo.png"
Resize-Image $baseImg 1024 1024 "public\edutechlab-logo.png"
Copy-Item $src "public\edutechlab-logo.jpg" -Force

# 2. public/icons
if (-not (Test-Path "public\icons")) { New-Item -ItemType Directory -Path "public\icons" }
Resize-Image $baseImg 512 512 "public\icons\icon-512.png"
Resize-Image $baseImg 512 512 "public\icons\icon-maskable-512.png" $true
Resize-Image $baseImg 192 192 "public\icons\icon-192.png"
Resize-Image $baseImg 180 180 "public\icons\apple-touch-icon.png"

# 3. favicon and app icons
Resize-Image $baseImg 48 48 "public\favicon.png"
Resize-Image $baseImg 32 32 "app\icon.png"
Resize-Image $baseImg 180 180 "app\apple-icon.png"

# Save favicon.ico
$icoBitmap = New-Object System.Drawing.Bitmap(32, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$icoG = [System.Drawing.Graphics]::FromImage($icoBitmap)
$icoG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$icoG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$icoG.DrawImage($baseImg, 0, 0, 32, 32)
$iconHandle = $icoBitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = [System.IO.File]::OpenWrite("public\favicon.ico")
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$icoG.Dispose()
$icoBitmap.Dispose()
Copy-Item "public\favicon.ico" "app\favicon.ico" -Force
Write-Host "Generated favicon.ico in public and app"

$baseImg.Dispose()
