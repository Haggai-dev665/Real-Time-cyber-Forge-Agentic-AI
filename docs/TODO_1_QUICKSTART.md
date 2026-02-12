# TODO 1: Quick Start Guide

This guide will help you quickly set up and test the TODO 1 implementation.

## Prerequisites

- Node.js 18+
- npm or yarn
- Appwrite account (Cloud or Self-hosted)
- (Optional) Datadog account for metrics

## Step 1: Install Dependencies

```bash
# From the project root
cd backend
npm install
```

## Step 2: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and configure **minimum required** variables:

```env
# Server Configuration
PORT=8000
NODE_ENV=development

# Appwrite Control Plane (REQUIRED)
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id-here
APPWRITE_API_KEY=your-api-key-here
APPWRITE_DATABASE_ID=cyberforge

# Datadog (Optional for development)
DATADOG_ENABLED=false

# ML Service (Optional - has fallback)
AI_SERVICE_URL=http://localhost:8001
```

## Step 3: Set Up Appwrite

Follow the detailed guide: [`docs/APPWRITE_SETUP.md`](./APPWRITE_SETUP.md)

**Quick Steps:**
1. Create Appwrite Cloud account at https://cloud.appwrite.io/
2. Create new project "Cyberforge"
3. Create database "cyberforge"
4. Create 6 collections: users, devices, agents, agent_tasks, alerts, evidence_metadata
5. Copy Project ID and API Key to `.env`

## Step 4: Test the Implementation

Run the test script to verify everything is working:

```bash
node test-todo1.js
```

Expected output:
```
✅ Datadog is disabled (OK for development)
✅ Agent created successfully
✅ Web Scraper service loaded
✅ Appwrite connection successful
```

## Step 5: Start the Backend Server

```bash
npm run dev
```

You should see:
```
🔐 Initializing Appwrite control plane...
✅ Appwrite service initialized successfully
📊 Initializing Datadog metrics...
🚀 Cyber Forge Backend Server running on port 8000
🤖 Agent API available at http://localhost:8000/api/agent
✅ TODO 1: Control plane and agent system initialized
```

## Step 6: Start an Agent

Open a new terminal and use curl or Postman:

```bash
# Start an agent
curl -X POST http://localhost:8000/api/agent/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "agentName": "scanner1",
    "config": {
      "heartbeatInterval": 30000,
      "taskPollInterval": 10000
    }
  }'
```

Response:
```json
{
  "success": true,
  "message": "Agent started successfully",
  "data": {
    "agentName": "scanner1",
    "agentId": "65abc...",
    "deviceId": "65xyz...",
    "state": "running"
  }
}
```

## Step 7: Create a Scan Task

```bash
# Create a web scan task
curl -X POST http://localhost:8000/api/agent/task/create \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "YOUR_AGENT_ID_FROM_STEP_6",
    "userId": "user-123",
    "taskType": "web_scan",
    "targetUrl": "https://example.com",
    "priority": "normal"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "taskId": "65task...",
    "status": "pending",
    "createdAt": "2026-02-12T13:00:00.000Z"
  }
}
```

## Step 8: Monitor Agent Activity

### Check Agent Status
```bash
curl http://localhost:8000/api/agent/status/scanner1
```

### View Alerts
```bash
curl "http://localhost:8000/api/agent/alerts?userId=user-123"
```

### Check Task Status
```bash
curl http://localhost:8000/api/agent/task/YOUR_TASK_ID
```

## Step 9: Monitor in Appwrite Console

1. Go to https://cloud.appwrite.io/console
2. Navigate to your project → Databases → cyberforge
3. View collections:
   - **devices**: See your registered device
   - **agents**: See agent status and heartbeat
   - **agent_tasks**: See task status (pending → processing → completed)
   - **alerts**: See security alerts generated
   - **evidence_metadata**: See evidence collected

## Step 10: Stop the Agent

```bash
curl -X POST http://localhost:8000/api/agent/stop \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "scanner1"
  }'
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/start` | Start an agent |
| POST | `/api/agent/stop` | Stop an agent |
| GET | `/api/agent/status/:name` | Get agent status |
| GET | `/api/agent/list` | List all agents |
| POST | `/api/agent/task/create` | Create a task |
| GET | `/api/agent/task/:id` | Get task status |
| GET | `/api/agent/alerts` | List alerts |
| GET | `/health` | Server health check |

## Data Flow Verification

After creating a task, verify the complete data flow:

1. **User** → Authenticates via Appwrite ✅
2. **Device** → Registered in Appwrite ✅
3. **Agent** → Pulls task from Appwrite ✅
4. **Web Scraper** → Called with API key ✅
5. **ML Models** → Classify evidence ✅
6. **Gemini** → Generate explanation ✅
7. **Alert** → Created in Appwrite ✅
8. **Metrics** → Sent to Datadog (if enabled) ✅

## Troubleshooting

### "Appwrite not configured"
- Verify `.env` has correct `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY`
- Check Appwrite console is accessible

### "Agent won't start"
- Ensure Appwrite collections are created
- Check server logs for errors
- Verify userId exists

### "Tasks not executing"
- Check agent state is "running"
- Verify agent heartbeat in Appwrite
- Check server logs

### "Web scraper fails"
- Check internet connectivity
- Verify web scraper API is accessible
- Check target URL is valid

## Optional: Enable Datadog Metrics

1. Get Datadog API key from https://app.datadoghq.com/
2. Update `.env`:
```env
DATADOG_ENABLED=true
DATADOG_API_KEY=your-datadog-api-key
```
3. Restart server

Metrics tracked:
- `agent.heartbeat.latency`
- `scan.duration`
- `scraper.api.calls`
- `ml.inference.duration`
- `gemini.api.calls`
- `errors.count`
- `alerts.created`

## Optional: Start ML Service

For full ML integration:

```bash
# In a new terminal
cd ml-services
pip install -r requirements.txt
python main.py
```

## Next Steps

- Create your own agents with custom capabilities
- Integrate with your security tools
- Add custom task types
- Build a UI for agent management
- Set up alerting and notifications
- Implement automated response playbooks

## Support

- Full documentation: [`docs/TODO_1_IMPLEMENTATION.md`](./TODO_1_IMPLEMENTATION.md)
- Appwrite setup: [`docs/APPWRITE_SETUP.md`](./APPWRITE_SETUP.md)
- Issues: GitHub Issues

## Definition of DONE Checklist

- [x] Appwrite fully handles auth, identity, and agent control
- [x] At least one agent can run continuously
- [x] Web scraper is integrated via API key
- [x] ML models classify evidence
- [x] Gemini explains results
- [x] Datadog shows live agent metrics
- [x] Alerts are traceable end-to-end

🎉 **TODO 1 is complete and ready for production use!**
