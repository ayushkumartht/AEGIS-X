# AEGIS-X Auto Commit & Push Script
# Usage: .\commit.ps1 ["optional message"]

param(
    [string]$Message = ""
)

# Generate a default message with timestamp if none provided
if (-not $Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Message = "Update: $timestamp"
}

Write-Host "`n Staging all changes..." -ForegroundColor Cyan
git add .

# Check if there is anything to commit
$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit - workspace is clean." -ForegroundColor Green
    exit 0
}

Write-Host "Committing: $Message" -ForegroundColor Yellow
git commit -m $Message

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin HEAD

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully committed and pushed to GitHub!" -ForegroundColor Green
    Write-Host "https://github.com/ayushkumartht/AEGIS-X" -ForegroundColor Blue
} else {
    Write-Host "Push failed. Check your connection or credentials." -ForegroundColor Red
}
