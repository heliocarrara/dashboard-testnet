# ==============================================================================
# STELLAR NODE FIREWALL SETUP (Windows)
# ==============================================================================
# This script opens the necessary ports for the Stellar Node in Windows Firewall
# Run as Administrator!
# ==============================================================================

Write-Host "🛡️ Configuring Windows Firewall for Stellar Node..." -ForegroundColor Cyan

# 1. Stellar P2P (11625)
$p2pRule = Get-NetFirewallRule -DisplayName "Stellar Node P2P (11625)" -ErrorAction SilentlyContinue
if ($p2pRule) {
    Write-Host "✅ Port 11625 (P2P) is already open." -ForegroundColor Green
} else {
    New-NetFirewallRule -DisplayName "Stellar Node P2P (11625)" -Direction Inbound -LocalPort 11625 -Protocol TCP -Action Allow
    Write-Host "✅ Port 11625 (P2P) opened successfully." -ForegroundColor Green
}

# 2. Stellar HTTP/RPC (11626)
$httpRule = Get-NetFirewallRule -DisplayName "Stellar Node HTTP (11626)" -ErrorAction SilentlyContinue
if ($httpRule) {
    Write-Host "✅ Port 11626 (HTTP) is already open." -ForegroundColor Green
} else {
    New-NetFirewallRule -DisplayName "Stellar Node HTTP (11626)" -Direction Inbound -LocalPort 11626 -Protocol TCP -Action Allow
    Write-Host "✅ Port 11626 (HTTP) opened successfully." -ForegroundColor Green
}

# 3. Stellar Horizon (8000)
$horizonRule = Get-NetFirewallRule -DisplayName "Stellar Horizon (8000)" -ErrorAction SilentlyContinue
if ($horizonRule) {
    Write-Host "✅ Port 8000 (Horizon) is already open." -ForegroundColor Green
} else {
    New-NetFirewallRule -DisplayName "Stellar Horizon (8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
    Write-Host "✅ Port 8000 (Horizon) opened successfully." -ForegroundColor Green
}

Write-Host "`n🎉 Firewall configuration complete!" -ForegroundColor Cyan
