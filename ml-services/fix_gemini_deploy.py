#!/usr/bin/env python3
"""Push Gemini model fix + Gradio fix to HF Space and update secrets."""

from huggingface_hub import HfApi
import time

TOKEN = "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"
SPACE = "Che237/cyberforge"
api = HfApi(token=TOKEN)

# 1. Update the GEMINI_MODEL secret to use stable model name
print("1️⃣  Updating GEMINI_MODEL secret → gemini-2.0-flash ...")
api.add_space_secret(SPACE, "GEMINI_MODEL", "gemini-2.0-flash")
print("   ✅ Secret updated")

# 2. Upload fixed app.py
print("2️⃣  Uploading fixed app.py ...")
api.upload_file(
    path_or_fileobj="hf_space_deploy/app.py",
    path_in_repo="app.py",
    repo_id=SPACE,
    repo_type="space",
)
print("   ✅ app.py uploaded")

# 3. Upload fixed notebook_config.json
print("3️⃣  Uploading fixed notebook_config.json ...")
api.upload_file(
    path_or_fileobj="notebooks/notebook_config.json",
    path_in_repo="notebooks/notebook_config.json",
    repo_id=SPACE,
    repo_type="space",
)
print("   ✅ notebook_config.json uploaded")

# 4. Factory restart
print("4️⃣  Factory restarting Space ...")
api.restart_space(SPACE, factory_reboot=True)
print("   ✅ Restart initiated")

# 5. Wait and check
print("⏳ Waiting 75s for rebuild ...")
time.sleep(75)

import urllib.request, json
try:
    with urllib.request.urlopen("https://che237-cyberforge.hf.space/health") as r:
        data = json.loads(r.read())
        print(f"\n🏥 Health check: {json.dumps(data, indent=2)}")
        if data.get("services", {}).get("gemini"):
            print("\n🎉 GEMINI IS NOW WORKING!")
        else:
            print("\n⚠️  Gemini still not ready — Space may still be rebuilding.")
            print("   Check again in ~60s or review logs at:")
            print("   https://huggingface.co/spaces/Che237/cyberforge/logs")
except Exception as e:
    print(f"\n⚠️  Health check failed (Space may still be rebuilding): {e}")
    print("   Wait 1-2 minutes then check: https://che237-cyberforge.hf.space/health")

print("\n✅ All fixes deployed!")
