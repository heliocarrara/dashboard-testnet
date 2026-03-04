# ==============================================================================
# STELLAR NODE FIREWALL SETUP (Windows)
# ==============================================================================
# This script opens the necessary ports for the Stellar Node in Windows Firewall
# ==============================================================================

# Check for Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "⚠️  Script is not running as Administrator." -ForegroundColor Yellow
    Write-Host "🔄 Restarting with elevated privileges..." -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "🛡️ Configuring Windows Firewall for Stellar Node..." -ForegroundColor Cyan

# Function to create firewall rule safely
function Add-StellarFirewallRule {
    param (
        [string]$Name,
        [int]$Port
    )
    
    $rule = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
    if ($rule) {
        Write-Host "✅ Port $Port ($Name) is already open." -ForegroundColor Green
    } else {
        try {
            New-NetFirewallRule -DisplayName $Name -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction Stop | Out-Null
            Write-Host "✅ Port $Port ($Name) opened successfully." -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to open port $Port ($Name): $_" -ForegroundColor Red
        }
    }
}

# 1. Stellar P2P (11625)
Add-StellarFirewallRule -Name "Stellar Node P2P (11625)" -Port 11625

# 2. Stellar HTTP/RPC (11626)
Add-StellarFirewallRule -Name "Stellar Node HTTP (11626)" -Port 11626

# 3. Stellar Horizon (8000)
Add-StellarFirewallRule -Name "Stellar Horizon (8000)" -Port 8000

# 4. Custom Port (10050) - Requested for IP 200.129.247.55
Add-StellarFirewallRule -Name "Custom Port (10050)" -Port 10050

Write-Host "`n🎉 Firewall configuration complete!" -ForegroundColor Cyan
Read-Host "Press Enter to exit..."
