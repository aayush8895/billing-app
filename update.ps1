# Billing App (Beta) — updater/launcher for Windows.
# Downloads the latest build from the GitHub "main" branch into an "app"
# subfolder next to this script, keeps your app\data\ and app\config.json
# untouched across runs, then starts the server.
#
# Re-run this script any time to pick up the latest build.

$ErrorActionPreference = 'Stop'
$Repo   = 'aayush8895/billing-app'
$Branch = 'main'
$Root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$App    = Join-Path $Root 'app'
$Zip    = Join-Path $Root '_update.zip'
$Tmp    = Join-Path $Root '_update_tmp'

function Fail($msg) {
  Write-Host $msg -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

Write-Host '==> Checking for Node.js...'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host 'Node.js not found.' -ForegroundColor Yellow
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Host '==> Installing Node.js LTS via winget (this may take a minute)...'
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Write-Host ''
    Write-Host 'Node.js was just installed. Windows needs a fresh terminal to see the' -ForegroundColor Cyan
    Write-Host 'updated PATH — please re-run this script.' -ForegroundColor Cyan
    Read-Host 'Press Enter to exit'
    exit 0
  } else {
    Start-Process 'https://nodejs.org/en/download'
    Fail 'winget is not available. Install Node.js LTS from the page that just opened, then re-run this script.'
  }
}

Write-Host "==> Downloading latest build from $Repo@$Branch..."
$Url = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
try {
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Zip
} catch {
  Fail "Download failed: $($_.Exception.Message)`nCheck your internet connection and try again."
}

if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
Remove-Item $Zip -Force

$ExtractedDir = Get-ChildItem $Tmp | Select-Object -First 1
New-Item -ItemType Directory -Force -Path $App | Out-Null

Write-Host '==> Syncing app files (your app\data and app\config.json are kept as-is)...'
robocopy $ExtractedDir.FullName $App /MIR /XD 'data' '.git' /XF 'config.json' /NFL /NDL /NJH /NJS | Out-Null
Remove-Item $Tmp -Recurse -Force

if (-not (Test-Path (Join-Path $App 'config.json'))) {
  Copy-Item (Join-Path $App 'config.example.json') (Join-Path $App 'config.json')
  Write-Host '==> Created app\config.json from the template (add your own Gemini API key to enable AI receipt scanning — optional).' -ForegroundColor Cyan
}
New-Item -ItemType Directory -Force -Path (Join-Path $App 'data\bills') | Out-Null

Write-Host '==> Starting Billing App (Beta)...'
Push-Location $App
Start-Process 'http://localhost:3000'
node server.js
Pop-Location
