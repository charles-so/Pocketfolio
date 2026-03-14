param([string]$publishPath, [string]$zipPath)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fullPublish = (Resolve-Path $publishPath).Path
if (Test-Path $zipPath) { Remove-Item $zipPath }
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$files = Get-ChildItem -Path $fullPublish -Recurse -File
foreach ($f in $files) {
    $rel = $f.FullName.Substring($fullPublish.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel) | Out-Null
}
$zip.Dispose()
Write-Host "Created zip with $($files.Count) files"
