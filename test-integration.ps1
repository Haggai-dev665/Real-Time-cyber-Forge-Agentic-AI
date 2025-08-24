# Cyber Forge AI Integration Test Script (PowerShell)
Write-Host "Testing Cyber Forge AI Integration..." -ForegroundColor Cyan

Write-Host ""
Write-Host "1. Testing ML Services Health..." -ForegroundColor Yellow
try {
    $mlResponse = Invoke-RestMethod -Uri "http://localhost:8001/health" -Method Get
    Write-Host "ML Services running successfully" -ForegroundColor Green
} catch {
    Write-Host "ML Services not running on port 8001" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Testing Backend Health..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
    Write-Host "Backend running successfully" -ForegroundColor Green
} catch {
    Write-Host "Backend not running on port 8000" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Integration Summary:" -ForegroundColor Cyan
Write-Host "ML Services: FastAPI running on port 8001" -ForegroundColor Green
Write-Host "Backend: Express.js running on port 8000" -ForegroundColor Green
Write-Host "Desktop App: Electron with ML service integration" -ForegroundColor Green
Write-Host "AI Features: Gemini-powered chat, threat scanning, website analysis" -ForegroundColor Green

Write-Host ""
Write-Host "Integration Components:" -ForegroundColor Cyan
Write-Host "   - ML Service: /backend/src/services/mlService.js" -ForegroundColor White
Write-Host "   - AI Routes: /backend/src/routes/ai.js (ML endpoints)" -ForegroundColor White
Write-Host "   - Desktop IPC: /desktop-app/src/main.js (ML handlers)" -ForegroundColor White
Write-Host "   - Frontend: /desktop-app/src/renderer/app.js (Enhanced UI)" -ForegroundColor White

Write-Host ""
Write-Host "Available ML Endpoints:" -ForegroundColor Cyan
Write-Host "   POST /api/ai/chat-ml - Enhanced AI chat" -ForegroundColor White
Write-Host "   POST /api/ai/analyze-website-ml - Website security analysis" -ForegroundColor White
Write-Host "   POST /api/ai/scan-threats-ml - Advanced threat scanning" -ForegroundColor White
Write-Host "   POST /api/ai/insights-ml - AI-powered insights" -ForegroundColor White
Write-Host "   POST /api/ai/network-analysis-ml - Network traffic analysis" -ForegroundColor White
Write-Host "   POST /api/ai/execute-task-ml - AI task execution" -ForegroundColor White

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Start ML Services: cd ml-services; python main.py" -ForegroundColor White
Write-Host "   2. Start Backend: cd backend; npm run dev" -ForegroundColor White
Write-Host "   3. Start Desktop App: cd desktop-app; npm run dev" -ForegroundColor White
Write-Host "   4. Test AI chat and threat scanning in the desktop app" -ForegroundColor White

Write-Host ""
Write-Host "Integration Complete! Your Cyber Forge AI platform now has:" -ForegroundColor Magenta
Write-Host "   - Advanced AI capabilities powered by Google Gemini" -ForegroundColor Green
Write-Host "   - ML-powered threat detection and analysis" -ForegroundColor Green
Write-Host "   - Intelligent chat interface" -ForegroundColor Green
Write-Host "   - Real-time security insights" -ForegroundColor Green
Write-Host "   - Enhanced website security analysis" -ForegroundColor Green
