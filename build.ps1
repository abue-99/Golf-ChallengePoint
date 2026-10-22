$steps = @(
    "git pull origin main",
    "docker-compose down",
    "docker-compose up --build -d"
)

for ($i = 0; $i -lt $steps.Count; $i++) {
    $cmd = $steps[$i]

    Write-Host ""
    Write-Host "[$($i+1)/$($steps.Count)] $cmd" -ForegroundColor Yellow

    Invoke-Expression $cmd

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "FEHLER in Schritt $($i+1): $cmd" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "✅ Erfolgreich" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Alle Schritte erfolgreich abgeschlossen." -ForegroundColor Green