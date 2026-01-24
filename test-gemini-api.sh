#!/bin/bash

# Gemini API Test Script
# Tests your Gemini API key and checks quota status

GEMINI_API_KEY="AIzaSyA3HdWTLk_zJQ5P9G8Z8a8BEYSTPvLglhs"

echo "=========================================="
echo "Testing Gemini API Key"
echo "=========================================="
echo ""

# Test 1: Simple model list (least quota usage)
echo "Test 1: Listing available models..."
echo "URL: https://generativelanguage.googleapis.com/v1beta/models?key=***"
echo ""
curl -sS "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | python3 -m json.tool

echo ""
echo "=========================================="
echo "Test 2: Generate content (uses quota)"
echo "=========================================="
echo ""

# Test 2: Simple generation (minimal token usage)
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Say hello"
      }]
    }]
  }' | python3 -m json.tool

echo ""
echo "=========================================="
echo "Test 3: Check alternative model"
echo "=========================================="
echo ""

# Test 3: Try gemini-1.5-flash (stable model)
curl -sS "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello"
      }]
    }]
  }' | python3 -m json.tool

echo ""
echo "=========================================="
echo "Results Summary"
echo "=========================================="
echo ""
echo "✅ If Test 1 succeeded: API key is valid"
echo "❌ If Test 2/3 failed with 429: Quota exhausted"
echo "💡 Check your quota at: https://ai.google.dev/gemini-api/docs/rate-limits"
echo "💡 Monitor usage at: https://aistudio.google.com/app/apikey"
echo ""
