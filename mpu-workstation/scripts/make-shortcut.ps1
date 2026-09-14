<#
  Creates a Desktop shortcut that launches the workstation in an app window.
  Usage:  powershell -File scripts\make-shortcut.ps1 [-Url http://localhost:8085]
#>
param([string]$Url = "http://localhost:8085")

$root    = Split-Path -Parent $PSScriptRoot
$icon    = Join-Path $root "public\icon.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$link    = Join-Path $desktop "MPU Workstation.lnk"

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($link)

if ($browser) {
  $sc.TargetPath = $browser
  $sc.Arguments  = "--app=$Url"
} else {
  # No Chromium browser found: fall back to the default browser.
  $sc.TargetPath = "$env:SystemRoot\System32\rundll32.exe"
  $sc.Arguments  = "url.dll,FileProtocolHandler $Url"
}

$sc.Description      = "8085 / 8086 microprocessor workstation"
$sc.WorkingDirectory = $root
if (Test-Path $icon) { $sc.IconLocation = $icon }
$sc.Save()

Write-Host "Created '$link' pointing at $Url"
if (-not $browser) { Write-Host "Chrome or Edge was not found, so it opens in your default browser instead." }
