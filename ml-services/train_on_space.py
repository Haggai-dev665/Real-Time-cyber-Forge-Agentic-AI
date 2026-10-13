#!/usr/bin/env python3
"""
Retrain the detection models on the Hugging Face Space, and follow the run.

    python train_on_space.py --dry-run   train and measure; upload nothing, change nothing in service
    python train_on_space.py             train; upload and put into service the models that pass their gate
    python train_on_space.py --status    show the current or last run
    python train_on_space.py --dry-run --models phishing_detection,malware_detection
    python train_on_space.py --set max_iter=400 --set benign_sample=150000
    python train_on_space.py --dry-run --drop bare_path_length,path_depth
    python train_on_space.py --accept phishing_detection="why this model is accepted despite its gate"

--accept records an owner decision to put a classifier into service although it
fails the well-known-legitimate-URLs rule. It only applies when the measured
rules (AUC, false-positive rate) passed, and the reason is stored with the model.

Nothing is trained on this machine: the request starts the run inside the Space
(hf_space_deploy/trainer.py) and this script only polls for the report. Uses
only the standard library. The token comes from ml-services/.env (HF_TOKEN) and
must belong to the account that owns the Space.
"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from hf_env import get_hf_token

SPACE_URL = "https://che237-cyberforge.hf.space"
REPORT_FILE = Path(__file__).resolve().parent / "last_training_report.json"


def call(method, path, token, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(SPACE_URL + path, method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            return error.code, json.loads(raw)
        except ValueError:
            return error.code, {"detail": raw[:300]}
    except Exception as error:  # a dropped connection while polling is not the end of the run
        return 0, {"detail": f"{type(error).__name__}: {error}"}


def summarise(status):
    print(f"\nstate: {status.get('state')}   started: {status.get('started_at')}   finished: {status.get('finished_at')}")
    if status.get("state") == "failed":
        print("error:", status.get("error"))
        print(status.get("traceback", ""))
        return
    for name, report in (status.get("reports") or {}).items():
        gate = report.get("gate", {})
        verdict = "PASSED" if gate.get("passed") else ("ACCEPTED BY OWNER DECISION, having failed" if gate.get("accepted_by_owner") else "REJECTED by")
        print(f"\n{name}: {verdict} its gate")
        if gate.get("override_refused"):
            print(f"   override refused: {gate['override_refused']}")
        for reason in gate.get("reasons", []):
            print(f"   - {reason}")
        holdout = report.get("holdout", {})
        if "auc" in holdout:
            print(f"   held-out sites: AUC {holdout['auc']}, precision {holdout['precision']}, recall {holdout['recall']}, "
                  f"false-positive rate {holdout['false_positive_rate']} ({holdout['samples']} URLs, {holdout.get('sites')} sites)")
        else:
            print(f"   held-out benign flagged: {holdout.get('benign_flagged')}   malicious flagged: {holdout.get('malicious_flagged')}")
        for label, other in (report.get("other_datasets") or {}).items():
            print(f"   {label}: AUC {other['auc']}, precision {other['precision']}, recall {other['recall']}, false-positive rate {other['false_positive_rate']}")
        for source, result in (holdout.get("by_source") or {}).items():
            value = result.get("recall", result.get("false_positive_rate"))
            print(f"      {'caught' if result['kind'] == 'positive' else 'wrongly flagged'} {value:<7} of {result['urls']:>6}  {source}")
        legitimate = report.get("known_legitimate", {})
        print(f"   well-known legitimate URLs flagged: {len(legitimate.get('flagged', []))} of {legitimate.get('checked')}")
        for entry in legitimate.get("flagged", []):
            print(f"      {entry.get('score', entry.get('margin'))}  {entry['url'][:90]}")
        for entry in report.get("known_hostile") or []:
            print(f"   hostile example {entry['score']}  {entry['url'][:80]}")
    if status.get("dry_run"):
        print("\nDry run: nothing was uploaded and the models in service are unchanged.")
    else:
        print("\nin service now:", ", ".join(status.get("in_service") or []) or "(no model passed; nothing changed)")
        print("uploaded:", json.dumps(status.get("uploaded") or {}))


def main():
    args = sys.argv[1:]
    token = get_hf_token()
    if "--status" in args:
        code, status = call("GET", "/api/admin/train/status", token)
        if code != 200:
            raise SystemExit(f"HTTP {code}: {status.get('detail')}")
        REPORT_FILE.write_text(json.dumps(status, indent=1), encoding="utf-8")
        summarise(status)
        return

    options = {"dry_run": "--dry-run" in args}
    for index, arg in enumerate(args):
        if arg == "--models" and index + 1 < len(args):
            options["models"] = [name.strip() for name in args[index + 1].split(",") if name.strip()]
        if arg == "--accept" and index + 1 < len(args):
            name, _, reason = args[index + 1].partition("=")
            options.setdefault("accept_despite_gate", {})[name.strip()] = reason.strip()
        if arg == "--drop" and index + 1 < len(args):
            options["drop_features"] = [name.strip() for name in args[index + 1].split(",") if name.strip()]
        if arg == "--set" and index + 1 < len(args):
            key, _, value = args[index + 1].partition("=")
            options[key] = float(value) if "." in value else int(value)

    code, started = call("POST", "/api/admin/train", token, options)
    if code != 202:
        raise SystemExit(f"Could not start training (HTTP {code}): {started.get('detail')}")
    print(f"Training started on the Space ({'dry run' if options['dry_run'] else 'models that pass will go into service'}).")

    last, begun = None, time.time()
    while time.time() - begun < 3600:
        time.sleep(15)
        code, status = call("GET", "/api/admin/train/status", token)
        if code != 200:
            print(f"  [{int(time.time() - begun):4d}s] status unavailable (HTTP {code}); retrying")
            continue
        if status.get("step") != last:
            last = status.get("step")
            print(f"  [{int(time.time() - begun):4d}s] {last}")
        if status.get("state") != "running":
            REPORT_FILE.write_text(json.dumps(status, indent=1), encoding="utf-8")
            summarise(status)
            print(f"\nFull report: {REPORT_FILE.name}")
            return
    raise SystemExit("The run did not finish within an hour; check --status.")


if __name__ == "__main__":
    main()
