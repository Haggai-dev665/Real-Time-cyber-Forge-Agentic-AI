# CyberForge AI - Start All Services Script (Windows PowerShell)
# This script starts Backend, ML Services, and Desktop App

Write-Host "🚀 Starting CyberForge AI Platform..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to check if a command exists
function Test-Command {
    param($Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-Command "node")) {
    Write-Host "❌ Error: Node.js is not installed" -ForegroundColor Red
    Write-Host "   Install from: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

if (-not ((Test-Command "python") -or (Test-Command "python3"))) {
    Write-Host "❌ Error: Python is not installed" -ForegroundColor Red
    Write-Host "   Install from: https://www.python.org/" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Function to check if port is in use
function Test-Port {
    param($Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Start Backend
if (Test-Port 8000) {
    Write-Host "⚠️  Backend already running on port 8000" -ForegroundColor Yellow
} else {
    Write-Host "🔧 Starting Backend..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\backend'; Write-Host '🚀 Starting Backend...' -ForegroundColor Cyan; npm start"
    Start-Sleep -Seconds 2
}

# Start ML Services
if (Test-Port 8001) {
    Write-Host "⚠️  ML Services already running on port 8001" -ForegroundColor Yellow
} else {
    Write-Host "🔧 Starting ML Services..." -ForegroundColor Cyan
    if (Test-Command "python3") {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\ml-services'; Write-Host '🚀 Starting ML Services...' -ForegroundColor Cyan; python3 main.py"
    } else {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\ml-services'; Write-Host '🚀 Starting ML Services...' -ForegroundColor Cyan; python main.py"
    }
    Start-Sleep -Seconds 2
}

# Wait for services to initialize
Write-Host ""
Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check service health
Write-Host ""
Write-Host "🔍 Checking service health..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2
    Write-Host "✅ Backend is running (http://localhost:8000)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend may still be starting... (http://localhost:8000)" -ForegroundColor Yellow
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 2
    Write-Host "✅ ML Services is running (http://localhost:8001)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ML Services may still be starting... (http://localhost:8001)" -ForegroundColor Yellow
}

# Start Desktop App
Write-Host ""
Write-Host "🖥️  Starting Desktop App..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\desktop-app'; Write-Host '🚀 Starting Desktop App...' -ForegroundColor Cyan; npm start"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✨ CyberForge AI Platform Started!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Services:" -ForegroundColor White
Write-Host "   • Backend:     http://localhost:8000" -ForegroundColor Gray
Write-Host "   • ML Services: http://localhost:8001" -ForegroundColor Gray
Write-Host "   • Desktop App: Launching..." -ForegroundColor Gray
Write-Host ""
Write-Host "📚 API Documentation:" -ForegroundColor White
Write-Host "   • Backend:     http://localhost:8000/api-docs" -ForegroundColor Gray
Write-Host "   • ML Services: http://localhost:8001/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Need help? Check SETUP_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop services, close the individual PowerShell windows" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit this window (services will continue running)"
