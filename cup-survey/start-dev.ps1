# Cup Survey - local dev server
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host " Cup Survey - local server"
Write-Host " ========================="
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Node.js not found. Install Node.js 20.9+" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "[1/5] npm install..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    Read-Host "Press Enter to exit"
    exit 1
  }
} else {
  Write-Host "[1/5] Dependencies OK."
}

Write-Host "[2/5] Preparing .env..."
node scripts/bootstrap-env.mjs
if ($LASTEXITCODE -ne 0) {
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "[3/5] PostgreSQL (Docker)..."
$dockerOk = $false
try {
  docker info 2>$null | Out-Null
  $dockerOk = $LASTEXITCODE -eq 0
} catch {
  $dockerOk = $false
}

if (-not $dockerOk) {
  Write-Host "       Docker is not running. UI will open, DB features may fail." -ForegroundColor Yellow
} else {
  docker compose up -d
  if ($LASTEXITCODE -ne 0) {
    Write-Host "       Failed to start PostgreSQL." -ForegroundColor Yellow
  } else {
    Write-Host "       Waiting for database..."
    Start-Sleep -Seconds 3
    npm run db:generate
    if ($LASTEXITCODE -ne 0) {
      Write-Host "       [WARN] prisma generate failed (often: file locked by running Node)." -ForegroundColor Yellow
    }
    npm run db:deploy
    if ($LASTEXITCODE -ne 0) {
      Write-Host "       [WARN] Migrations failed." -ForegroundColor Yellow
    } else {
      npm run seed:clubs
    }
  }
}

function Stop-LocalCupSurveyProcesses {
  $root = $PSScriptRoot
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and $_.CommandLine.Contains($root) -and
      ($_.CommandLine -match 'announcer-worker|local-tts-server|next dev|next\\dist')
    } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "[4/5] Checking port 3000..."
$portConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$nextLock = Join-Path $PSScriptRoot ".next\dev\lock"
$devAlreadyRunning = $portConn -or (Test-Path $nextLock)

Stop-LocalCupSurveyProcesses
if ($portConn) {
  Stop-Process -Id $portConn.OwningProcess -Force -ErrorAction SilentlyContinue
}
if ($devAlreadyRunning) {
  Write-Host "       Stopped previous dev server / announcer worker." -ForegroundColor Yellow
  Start-Sleep -Seconds 2
  npm run db:generate
  if ($LASTEXITCODE -ne 0) {
    Write-Host "       [WARN] prisma generate failed." -ForegroundColor Yellow
  }
} else {
  npm run db:generate
  if ($LASTEXITCODE -ne 0) {
    Write-Host "       [WARN] prisma generate failed." -ForegroundColor Yellow
  }
}

Write-Host "[5/7] Announcer assets..."
node scripts/install-announcer-cue-sounds.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host "       [WARN] Failed to generate announcer cue sounds." -ForegroundColor Yellow
}

Write-Host "[6/7] Local TTS server..."
$ttsConn = Get-NetTCPConnection -LocalPort 5500 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ttsConn) {
  Stop-Process -Id $ttsConn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}
$ttsCmd = "Set-Location '$PSScriptRoot'; node scripts/local-tts-server.mjs"
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", $ttsCmd
) -WindowStyle Minimized | Out-Null
Start-Sleep -Seconds 2
npx tsx scripts/setup-local-announcer.ts
if ($LASTEXITCODE -ne 0) {
  Write-Host "       [WARN] Local announcer setup failed." -ForegroundColor Yellow
}

Write-Host "[7/7] Starting Next.js + announcer worker..."
Write-Host ""
Write-Host " Site:  http://localhost:3000"
Write-Host " Admin: http://localhost:3000/admin  (password: admin)"
Write-Host ""
Write-Host " Stop: Ctrl+C"
Write-Host ""

$workerCmd = "Set-Location '$PSScriptRoot'; npm run announcer:worker"
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", $workerCmd
) -WindowStyle Minimized | Out-Null

Start-Process "http://localhost:3000"
npm run dev

Write-Host ""
Write-Host "Server stopped."
Read-Host "Press Enter to exit"
