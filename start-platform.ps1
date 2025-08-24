#!/usr/bin/env powershell

# Cyber Forge AI - Comprehensive Startup Script
# Launches all services in the correct order with health checks

Write-Host "🚀 Starting Cyber Forge AI Platform..." -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Function to wait for service to be ready
function Wait-ForService {
    param([string]$ServiceName, [int]$Port, [int]$MaxAttempts = 30)
    
    Write-Host "⏳ Waiting for $ServiceName to start on port $Port..." -ForegroundColor Yellow
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        if (Test-Port -Port $Port) {
            Write-Host "✅ $ServiceName is ready!" -ForegroundColor Green
            return $true
        }
        Write-Host "   Attempt $i/$MaxAttempts..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
    
    Write-Host "❌ $ServiceName failed to start within timeout" -ForegroundColor Red
    return $false
}

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

# Check Python
try {
    $pythonVersion = python --version 2>$null
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python" -ForegroundColor Red
    exit 1
}

# Check MongoDB
try {
    $mongoVersion = mongod --version 2>$null | Select-String "db version"
    Write-Host "✅ MongoDB: $mongoVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  MongoDB not found in PATH. Make sure it's running manually" -ForegroundColor Yellow
}

Write-Host "`n🎯 Starting services..." -ForegroundColor Cyan

# Step 1: Start ML Services
Write-Host "`n📊 Step 1: Starting ML Services..." -ForegroundColor Magenta
Set-Location "ml-services"

# Check if virtual environment exists
if (!(Test-Path "venv")) {
    Write-Host "📦 Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment and install requirements
Write-Host "🔧 Setting up Python environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
pip install -r requirements.txt --quiet

# Start ML Services in background
Write-Host "🚀 Launching ML Services..." -ForegroundColor Green
$mlProcess = Start-Process python -ArgumentList "main.py" -PassThru -WindowStyle Hidden

# Wait for ML Services to be ready
if (Wait-ForService -ServiceName "ML Services" -Port 8001) {
    Write-Host "✅ ML Services running on http://localhost:8001" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start ML Services" -ForegroundColor Red
    exit 1
}

Set-Location ".."

# Step 2: Start Backend
Write-Host "`n⚙️  Step 2: Starting Backend..." -ForegroundColor Magenta
Set-Location "backend"

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    npm install --silent
}

# Start Backend in background
Write-Host "🚀 Launching Backend..." -ForegroundColor Green
$backendProcess = Start-Process npm -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden

# Wait for Backend to be ready
if (Wait-ForService -ServiceName "Backend" -Port 8000) {
    Write-Host "✅ Backend running on http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start Backend" -ForegroundColor Red
    exit 1
}

Set-Location ".."

# Step 3: Start Desktop Application
Write-Host "`n🖥️  Step 3: Starting Desktop Application..." -ForegroundColor Magenta
Set-Location "desktop-app"

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing desktop app dependencies..." -ForegroundColor Yellow
    npm install --silent
}

# Start Desktop App
Write-Host "🚀 Launching Desktop Application..." -ForegroundColor Green
Start-Process npm -ArgumentList "run", "dev" -Wait

Set-Location ".."

# Cleanup function
function Stop-Services {
    Write-Host "`n🛑 Stopping services..." -ForegroundColor Yellow
    
    try {
        if ($mlProcess -and !$mlProcess.HasExited) {
            $mlProcess.Kill()
            Write-Host "✅ ML Services stopped" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not stop ML Services cleanly" -ForegroundColor Yellow
    }
    
    try {
        if ($backendProcess -and !$backendProcess.HasExited) {
            $backendProcess.Kill()
            Write-Host "✅ Backend stopped" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not stop Backend cleanly" -ForegroundColor Yellow
    }
    
    Write-Host "👋 Cyber Forge AI Platform stopped" -ForegroundColor Cyan
}

# Register cleanup on script exit
Register-EngineEvent PowerShell.Exiting -Action { Stop-Services }

Write-Host "`n🎉 All services started successfully!" -ForegroundColor Green
Write-Host "🌐 Access points:" -ForegroundColor Cyan
Write-Host "   • Desktop App: Running in Electron window" -ForegroundColor White
Write-Host "   • Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "   • ML Services: http://localhost:8001" -ForegroundColor White
Write-Host "   • API Docs: http://localhost:8001/docs" -ForegroundColor White

Write-Host "`n💡 Press Ctrl+C to stop all services" -ForegroundColor Yellow
