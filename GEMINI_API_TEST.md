# Gemini API Test Commands

## Your API Key
```
AIzaSyA3HdWTLk_zJQ5P9G8Z8a8BEYSTPvLglhs
```

## Test 1: List Models (No Quota Usage)
This checks if your API key is valid without using quota:

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA3HdWTLk_zJQ5P9G8Z8a8BEYSTPvLglhs"
```

**Expected Success Response:**
```json
{
  "models": [
    {
      "name": "models/gemini-2.0-flash-exp",
      "version": "...",
      "displayName": "Gemini 2.0 Flash"
    }
  ]
}
```

**Expected Failure (Invalid Key):**
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid"
  }
}
```

---

## Test 2: Generate Content with gemini-2.0-flash-exp (Uses Quota)
This tests if your quota is available:

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyA3HdWTLk_zJQ5P9G8Z8a8BEYSTPvLglhs" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Say hello in one word"
      }]
    }]
  }'
```

**Expected Success Response:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "Hello!"
      }]
    }
  }]
}
```

**Expected Quota Exhausted:**
```json
{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota...",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

---

## Test 3: Try Alternative Model (gemini-1.5-flash)
If gemini-2.0-flash-exp is exhausted, try the stable 1.5 model:

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyA3HdWTLk_zJQ5P9G8Z8a8BEYSTPvLglhs" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Test"
      }]
    }]
  }'
```

---

## Test 4: Check Gemini Pro Model
Try the more capable Pro model:

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=AIzaSyA3HdWTLk_zJQ5P9G8Z8a8BEYSTPvLglhs" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello"
      }]
    }]
  }'
```

---

## Understanding Your Error

Your error shows:
```
❌ Quota exceeded for metric: generate_content_free_tier_input_token_count, limit: 0
❌ Quota exceeded for metric: generate_content_free_tier_requests, limit: 0
```

This means:
1. **Your free tier quota is exhausted** for `gemini-2.0-flash-exp`
2. **Limit is 0** = No requests allowed until quota resets
3. **Retry in 52 seconds** = Wait time for rate limit

### Free Tier Limits (as of Jan 2026)
- **Requests**: 15 requests per minute, 1,500 per day
- **Tokens**: 1 million tokens per day for free tier
- **Model**: `gemini-2.0-flash-exp` is experimental with lower limits

---

## Solutions

### 1. Wait for Quota Reset
Free tier quotas reset:
- **Per minute**: Resets after 60 seconds
- **Per day**: Resets at midnight Pacific Time

Check reset time at: https://aistudio.google.com/app/apikey

### 2. Switch to Stable Model
Update `ml-services/.env`:
```bash
# From experimental model
GEMINI_MODEL=gemini-2.0-flash-exp

# To stable model (higher limits)
GEMINI_MODEL=gemini-1.5-flash
```

### 3. Get a Paid API Key
Upgrade to pay-as-you-go:
- Visit: https://aistudio.google.com/app/apikey
- Enable billing
- Get higher quotas (1,000 requests/min, unlimited tokens)

### 4. Use Alternative Free AI
If quota issues persist, switch to:
- **Ollama** (local, no quota): https://ollama.com
- **OpenAI free tier**: https://platform.openai.com
- **Anthropic Claude**: https://console.anthropic.com

---

## Quick Fix: Update Your Config

Run this to switch to stable model:

```bash
cd ml-services

# Update to stable model
sed -i '' 's/GEMINI_MODEL=gemini-2.0-flash-exp/GEMINI_MODEL=gemini-1.5-flash/' .env

# Restart ML services
source venv/bin/activate && python main.py
```

---

## Monitor Your Usage

Check current usage and quota:
1. Visit: https://aistudio.google.com/app/apikey
2. Click your API key
3. View "Usage" tab
4. See requests and tokens used

---

## Run All Tests

Make the script executable and run:

```bash
chmod +x test-gemini-api.sh
./test-gemini-api.sh
```

Or run tests manually one by one using the curl commands above.
