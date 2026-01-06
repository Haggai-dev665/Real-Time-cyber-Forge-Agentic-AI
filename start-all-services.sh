#!/bin/bash

# CyberForge AI - Start All Services Script
# This script starts Backend, ML Services, and Desktop App

echo "🚀 Starting CyberForge AI Platform..."
echo "======================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Error: Node.js is not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

if ! command_exists python3 && ! command_exists python; then
    echo "❌ Error: Python is not installed"
    echo "   Install from: https://www.python.org/"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to start a service in a new terminal
start_service() {
    local service_name=$1
    local service_dir=$2
    local start_command=$3
    
    echo "🔧 Starting $service_name..."
    
    # Check if running on macOS or Linux
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use Terminal.app
        osascript <<EOF
tell application "Terminal"
    do script "cd '$SCRIPT_DIR/$service_dir' && echo '🚀 Starting $service_name...' && $start_command"
    activate
end tell
EOF
    elif command_exists gnome-terminal; then
        # Linux with GNOME Terminal
        gnome-terminal --tab --title="$service_name" -- bash -c "cd '$SCRIPT_DIR/$service_dir' && echo '🚀 Starting $service_name...' && $start_command; exec bash"
    elif command_exists xterm; then
        # Linux with xterm
        xterm -title "$service_name" -e "cd '$SCRIPT_DIR/$service_dir' && echo '🚀 Starting $service_name...' && $start_command; bash" &
    else
        # Fallback - run in background
        echo "⚠️  No terminal emulator found, starting $service_name in background..."
        (cd "$SCRIPT_DIR/$service_dir" && $start_command > "${service_name}.log" 2>&1 &)
    fi
    
    sleep 2
}

# Check if services are already running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Backend already running on port 8000"
else
    start_service "Backend" "backend" "npm start"
fi

if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  ML Services already running on port 8001"
else
    # Try python3 first, then python
    if command_exists python3; then
        start_service "ML Services" "ml-services" "python3 main.py"
    else
        start_service "ML Services" "ml-services" "python main.py"
    fi
fi

# Wait for services to initialize
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check if services are responding
echo ""
echo "🔍 Checking service health..."

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is running (http://localhost:8000)"
else
    echo "⚠️  Backend may still be starting... (http://localhost:8000)"
fi

if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ ML Services is running (http://localhost:8001)"
else
    echo "⚠️  ML Services may still be starting... (http://localhost:8001)"
fi

echo ""
echo "🖥️  Starting Desktop App..."
cd "$SCRIPT_DIR/desktop-app"
npm start &

echo ""
echo "======================================"
echo "✨ CyberForge AI Platform Started!"
echo "======================================"
echo ""
echo "📱 Services:"
echo "   • Backend:     http://localhost:8000"
echo "   • ML Services: http://localhost:8001"
echo "   • Desktop App: Launching..."
echo ""
echo "📚 API Documentation:"
echo "   • Backend:     http://localhost:8000/api-docs"
echo "   • ML Services: http://localhost:8001/docs"
echo ""
echo "📖 Need help? Check SETUP_GUIDE.md"
echo ""
echo "Press Ctrl+C to stop watching (services will continue running)"
echo "To stop all services, close the individual terminal windows"
echo ""

# Keep script running
wait
