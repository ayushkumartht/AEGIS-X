# Starts the backend (port 8000) and the frontend (port 5173) together.
# Usage: .\scripts\dev.ps1
$root = Split-Path -Parent $PSScriptRoot

$api = Start-Process powershell -PassThru -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\backend'; & '$root\.venv\Scripts\python.exe' -m uvicorn aegis.api.main:app --port 8000 --reload"
)
$web = Start-Process powershell -PassThru -ArgumentList @(
    "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
)
Write-Host "Backend:  http://127.0.0.1:8000/docs  (pid $($api.Id))"
Write-Host "Frontend: http://localhost:5173       (pid $($web.Id))"
