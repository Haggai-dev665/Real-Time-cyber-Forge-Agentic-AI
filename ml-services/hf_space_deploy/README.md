---
title: CyberForge AI
emoji: 🔐
colorFrom: blue
colorTo: purple
sdk: docker
app_file: app.py
pinned: false
license: mit
short_description: CyberForge AI - ML Training & Inference Platform
---

# 🔐 CyberForge AI - ML Training & Inference Platform

Gradio UI for notebook execution, model training, and inference + FastAPI REST API for the Heroku backend.

## REST API Endpoints (for backend mlService.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | AI chat (Gemini) |
| `/analyze-url` | POST | URL threat analysis |
| `/scan-threats` | POST | Threat scanning |
| `/api/insights/generate` | POST | AI insights |
| `/api/models/predict` | POST | ML model prediction |
| `/models` | GET | List available models |
| `/api/analysis/network` | POST | Network traffic analysis |
| `/api/ai/execute-task` | POST | AI task execution |

## Environment Secrets

Set these in your Space settings → Secrets:

- `GEMINI_API_KEY` - Google Gemini API key
- `HF_TOKEN` - HuggingFace token (for model downloads)
- `HF_MODEL_REPO` - Model repository (default: `Che237/cyberforge-models`)

## Backend Integration

Your Heroku backend connects to this Space:

```bash
heroku config:set AI_SERVICE_URL=https://che237-cyberforge.hf.space -a cyberforge
```
