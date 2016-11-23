Param(
  [Parameter(Mandatory=$True)]
  [string]$executablePath,
  [string]$filePath
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$invocation = (Get-Variable MyInvocation).Value
$directorypath = Split-Path $invocation.MyCommand.Path

$zipfile="$($directorypath)/loaderarchive.zip"
$outpath="c:\bees"

#Remove bees forlder if it already exists
If (Test-Path $outpath){
	Remove-Item $outpath -Recurse 
}

Write-Host unzipping archive 
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipfile, $outpath)

Write-Host starting bee executable
Start-Process -FilePath $executablePath -RedirectStandardError "$($outpath)\errors.txt" -RedirectStandardOutput  "$($outpath)\output.txt" -NoNewWindow 



