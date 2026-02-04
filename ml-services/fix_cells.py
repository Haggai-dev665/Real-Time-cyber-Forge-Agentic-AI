import json

with open('notebooks/00_environment_setup.ipynb', 'r') as f:
    nb = json.load(f)

code_cells = [c for c in nb['cells'] if c['cell_type'] == 'code']

# Cell 6 (index 5) - Gemini test - needs config
code_cells[5]['source'] = '''import google.generativeai as genai
import json
import os
from pathlib import Path

# Load config (self-contained)
config_json_path = Path("notebook_config.json")
if config_json_path.exists():
    with open(config_json_path, "r") as f:
        loaded_config = json.load(f)
else:
    loaded_config = {}

GEMINI_API_KEY = loaded_config.get("gemini_api_key") or os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = loaded_config.get("gemini_model", "gemini-2.5-flash")

def test_gemini_connection():
    """Test Gemini API connectivity"""
    if not GEMINI_API_KEY:
        return False, "API key not configured"
    
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content("Respond with only: OK")
        return True, f"Model: {GEMINI_MODEL}, Response: {response.text.strip()}"
    except Exception as e:
        # Fallback to gemini-1.5-flash if 2.5 not available
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content("Respond with only: OK")
            return True, f"Model: gemini-1.5-flash (fallback), Response: {response.text.strip()}"
        except Exception as e2:
            return False, str(e2)

print("Testing Gemini API connection...")
success, message = test_gemini_connection()

if success:
    print(f"✓ Gemini API: {message}")
else:
    print(f"⚠ Gemini API: Connection failed - {message}")
'''

# Cell 7 (index 6) - WebScraper test - needs config
code_cells[6]['source'] = '''import httpx
import json
import os
from pathlib import Path

# Load config (self-contained)
config_json_path = Path("notebook_config.json")
if config_json_path.exists():
    with open(config_json_path, "r") as f:
        loaded_config = json.load(f)
else:
    loaded_config = {}

WEBSCRAPER_API_KEY = loaded_config.get("webscraper_api_key", "sk-fd14eaa7bceb478db7afc7256e514d2b")
WEBSCRAPER_API_URL = loaded_config.get("webscraper_api_url", "http://webscrapper.live/api/scrape")

def test_webscraper_connection_sync():
    """Test WebScrapper.live API connectivity (sync version)"""
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                WEBSCRAPER_API_URL,
                json={"url": "https://example.com"},
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": WEBSCRAPER_API_KEY
                }
            )
            if response.status_code == 200:
                return True, "Connected"
            else:
                return False, f"Status {response.status_code}: {response.text[:100]}"
    except Exception as e:
        return False, str(e)

print("Testing Web Scraper API connection...")
success, message = test_webscraper_connection_sync()

if success:
    print(f"✓ WebScraper API: Connected successfully")
else:
    print(f"⚠ WebScraper API: {message}")
'''

with open('notebooks/00_environment_setup.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)

print("✓ Fixed cells 6 and 7 to be self-contained")
