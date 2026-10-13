#!/usr/bin/env python3
"""
Deploy hf_space_deploy/ to the Hugging Face Space, with a backup and rollback.

    python deploy_space.py              back up what is live, push, wait for the build
    python deploy_space.py --rollback   push the most recent backup back
    python deploy_space.py --status     show the Space's current state
    python deploy_space.py --dry-run    list what would be pushed, change nothing

Uses only the standard library. The token comes from ml-services/.env (HF_TOKEN).
Backups of the live files are written to hf_space_clone/<commit>/ before a push.
"""

import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from hf_env import get_hf_token

SPACE = "Che237/cyberforge"
HUB = "https://huggingface.co"
BASE_DIR = Path(__file__).resolve().parent
SOURCE_DIR = BASE_DIR / "hf_space_deploy"
BACKUP_DIR = BASE_DIR / "hf_space_clone"
FILES = ["Dockerfile", "requirements.txt", "app.py", "url_features.py", "trainer.py"]
DONE_STAGES = {"RUNNING", "BUILD_ERROR", "RUNTIME_ERROR", "CONFIG_ERROR", "NO_APP_FILE", "PAUSED", "STOPPED"}


def request(method, url, token, body=None, content_type="application/json", timeout=120):
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, method=method, headers=headers, data=body)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def runtime(token):
    status, data = request("GET", f"{HUB}/api/spaces/{SPACE}/runtime", token)
    return json.loads(data) if status == 200 else {"stage": f"HTTP {status}", "error": data.decode("utf-8", "replace")[:200]}


def backup(token):
    """Save the files that are live right now, so a bad deploy can be undone."""
    sha = runtime(token).get("sha", "unknown")[:12]
    dest = BACKUP_DIR / sha
    dest.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        status, data = request("GET", f"{HUB}/spaces/{SPACE}/resolve/main/{name}", token)
        if status == 404:
            print(f"  {name} is not on the Space yet; nothing to back up")
            continue
        if status != 200:
            raise SystemExit(f"Could not back up {name} (HTTP {status}); nothing was pushed.")
        (dest / name).write_bytes(data)
    print(f"Backed up live commit {sha} to {dest}")
    return dest


def push(token, folder, message):
    lines = [json.dumps({"key": "header", "value": {"summary": message, "description": ""}})]
    for name in FILES:
        if not (folder / name).exists():
            # A backup taken before this file existed does not contain it.
            continue
        content = (folder / name).read_bytes().replace(b"\r\n", b"\n")
        if token.encode() in content:
            raise SystemExit(f"{name} contains the HF token; refusing to push.")
        lines.append(json.dumps({"key": "file", "value": {
            "path": name, "encoding": "base64", "content": base64.b64encode(content).decode()}}))
        print(f"  {name}: {len(content)} bytes")
    status, data = request("POST", f"{HUB}/api/spaces/{SPACE}/commit/main", token,
                           body="\n".join(lines).encode("utf-8"), content_type="application/x-ndjson")
    if status >= 300:
        raise SystemExit(f"Push failed (HTTP {status}): {data.decode('utf-8', 'replace')[:300]}")
    commit = json.loads(data)
    print(f"Pushed: {commit.get('commitUrl', 'ok')}")
    return commit.get("commitOid", "")


def build_log_tail(token, lines=40, seconds=10):
    """The build log is a server-sent-event stream; read it briefly."""
    req = urllib.request.Request(f"{HUB}/api/spaces/{SPACE}/logs/build", headers={"Authorization": f"Bearer {token}"})
    out = []
    try:
        with urllib.request.urlopen(req, timeout=seconds) as r:
            deadline = time.time() + seconds
            while time.time() < deadline:
                line = r.readline().decode("utf-8", "replace").strip()
                if line.startswith("data:"):
                    try:
                        out.append(json.loads(line[5:]).get("data", "").rstrip())
                    except ValueError:
                        out.append(line[5:].strip())
    except Exception:
        pass
    return out[-lines:]


def wait_for_build(token, commit, limit_s=1800):
    print("Waiting for the Space to rebuild (this usually takes 5-15 minutes)...")
    started, last = time.time(), None
    while time.time() - started < limit_s:
        rt = runtime(token)
        stage = rt.get("stage")
        # Until the new image is up, RUNNING still describes the old container
        if stage == "RUNNING" and commit and rt.get("sha") != commit:
            stage = "RUNNING (previous version, new build pending)"
        if stage != last:
            print(f"  [{int(time.time() - started):4d}s] {stage}")
            last = stage
        if stage in DONE_STAGES:
            break
        time.sleep(15)
    if last == "RUNNING":
        print(f"\n✓ Space is running: https://{SPACE.replace('/', '-').lower()}.hf.space/health")
        print("  The chat model loads in the background for another minute or two;")
        print("  check services.local_llm.loaded in /health.")
    else:
        print(f"\n✗ Space ended in stage {last}. Last build log lines:")
        print("\n".join(build_log_tail(token)))
        print("\nTo restore the previous version:  python deploy_space.py --rollback")
    return last


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--dry-run":
        print(f"Would push to {SPACE} from {SOURCE_DIR}:")
        for name in FILES:
            print(f"  {name}: {(SOURCE_DIR / name).stat().st_size} bytes")
        return
    token = get_hf_token()
    if arg == "--status":
        print(json.dumps(runtime(token), indent=2))
    elif arg == "--rollback":
        backups = sorted((d for d in BACKUP_DIR.iterdir() if d.is_dir()), key=lambda d: d.stat().st_mtime)
        if not backups:
            raise SystemExit(f"No backup found in {BACKUP_DIR}")
        print(f"Rolling {SPACE} back to backup {backups[-1].name}")
        wait_for_build(token, push(token, backups[-1], f"Roll back to {backups[-1].name}"))
    elif arg == "":
        backup(token)
        print(f"Pushing {SOURCE_DIR.name}/ to {SPACE}")
        commit = push(token, SOURCE_DIR, "Update the CyberForge ML service")
        wait_for_build(token, commit)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
