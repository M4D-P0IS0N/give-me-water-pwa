param(
    [string]$ProjectRoot = ".",
    [int]$CanvasWidth = 1024,
    [int]$CanvasHeight = 1024,
    [int]$BackgroundThreshold = 245
)

Add-Type -AssemblyName System.Drawing

function Get-TransparentBounds {
    param([System.Drawing.Bitmap]$Bitmap)
    $minX = $Bitmap.Width
    $minY = $Bitmap.Height
    $maxX = 0
    $maxY = 0
    $hasPixel = $false

    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
        for ($y = 0; $y -lt $Bitmap.Height; $y++) {
            $pixel = $Bitmap.GetPixel($x, $y)
            if ($pixel.A -gt 0) {
                $hasPixel = $true
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if (-not $hasPixel) {
        return [System.Drawing.Rectangle]::new(0, 0, $Bitmap.Width, $Bitmap.Height)
    }

    return [System.Drawing.Rectangle]::new($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
}

function Remove-Light-Background {
    param([System.Drawing.Bitmap]$Bitmap, [int]$Threshold)

    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
        for ($y = 0; $y -lt $Bitmap.Height; $y++) {
            $pixel = $Bitmap.GetPixel($x, $y)
            $isNearWhite = ($pixel.R -ge $Threshold -and $pixel.G -ge $Threshold -and $pixel.B -ge $Threshold)
            if ($isNearWhite) {
                $Bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
            }
        }
    }
}

function Normalize-Png {
    param(
        [string]$SourcePath,
        [string]$TargetPath,
        [double]$TargetFillRatio
    )

    $sourceBitmap = [System.Drawing.Bitmap]::FromFile($SourcePath)
    try {
        Remove-Light-Background -Bitmap $sourceBitmap -Threshold $BackgroundThreshold
        $bounds = Get-TransparentBounds -Bitmap $sourceBitmap
        $croppedBitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
        $graphicsCropped = [System.Drawing.Graphics]::FromImage($croppedBitmap)
        $graphicsCropped.DrawImage($sourceBitmap, 0, 0, $bounds, [System.Drawing.GraphicsUnit]::Pixel)
        $graphicsCropped.Dispose()

        $normalizedBitmap = New-Object System.Drawing.Bitmap($CanvasWidth, $CanvasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($normalizedBitmap)
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $scaleX = ($CanvasWidth * $TargetFillRatio) / $croppedBitmap.Width
        $scaleY = ($CanvasHeight * $TargetFillRatio) / $croppedBitmap.Height
        $scale = [Math]::Min($scaleX, $scaleY)
        $targetWidth = [int]($croppedBitmap.Width * $scale)
        $targetHeight = [int]($croppedBitmap.Height * $scale)

        $targetX = [int](($CanvasWidth - $targetWidth) / 2)
        $targetY = [int]($CanvasHeight - $targetHeight - 20)
        if ($targetY -lt 0) { $targetY = 0 }

        $graphics.DrawImage($croppedBitmap, $targetX, $targetY, $targetWidth, $targetHeight)
        $graphics.Dispose()

        $targetDirectory = Split-Path -Parent $TargetPath
        if (-not (Test-Path $targetDirectory)) {
            New-Item -Path $targetDirectory -ItemType Directory | Out-Null
        }

        $normalizedBitmap.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $normalizedBitmap.Dispose()
        $croppedBitmap.Dispose()
    }
    finally {
        $sourceBitmap.Dispose()
    }
}

$robotSource = Join-Path $ProjectRoot "Imagens\Robo"
$oilSource = Join-Path $ProjectRoot "Imagens\Oleo"
$robotTarget = Join-Path $ProjectRoot "Imagens\Processed\Robo"
$oilTarget = Join-Path $ProjectRoot "Imagens\Processed\Oleo"

if (-not (Test-Path $robotSource) -or -not (Test-Path $oilSource)) {
    Write-Error "Pastas de origem nao encontradas. Verifique Imagens\Robo e Imagens\Oleo."
    exit 1
}

Get-ChildItem $robotSource -Filter "*.png" | ForEach-Object {
    $outFile = Join-Path $robotTarget $_.Name
    Normalize-Png -SourcePath $_.FullName -TargetPath $outFile -TargetFillRatio 0.92
    Write-Output "Normalizado robo: $($_.Name)"
}

Get-ChildItem $oilSource -Filter "*.png" | ForEach-Object {
    $outFile = Join-Path $oilTarget $_.Name
    Normalize-Png -SourcePath $_.FullName -TargetPath $outFile -TargetFillRatio 0.76
    Write-Output "Normalizado oleo: $($_.Name)"
}

Write-Output "Normalizacao concluida."
