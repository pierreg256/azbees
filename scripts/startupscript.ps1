Param(
  [Parameter(Mandatory=$True)]
  [string]$executablePath,
  [Parameter(Mandatory=$True)]
  [int]$nbBees,
  [Parameter(Mandatory=$True)]
  [int]$beeIndex,
  [Parameter(Mandatory=$True)]
  [int]$stressLevel,
  [Parameter(Mandatory=$True)]
  [int]$waitTime,
  [Parameter(Mandatory=$True)]
  [int]$breath
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
$containerPath = Split-Path -Path $executablePath
Set-Location $containerPath
 
Start-Process -FilePath $executablePath -ArgumentList '-SimulatedDevicesNumber',$stressLevel, '-InstanceIndex', $beeIndex, '-NumberParallelInstances',$nbBees, '-WaitTimeBetweenFrames', $waitTime, '-Breath', $breath, '-SimulationMode','true' -RedirectStandardError "$($outpath)\errors.txt" -RedirectStandardOutput  "$($outpath)\output.txt"  



