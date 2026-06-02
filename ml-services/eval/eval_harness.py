#!/usr/bin/env python3
"""
CyberForge ML evaluation harness (HF-native).

Smoke-tests and quality-checks the *deployed* Hugging Face Space — no local ML.
It exercises three things the DeepSeek migration cares about:

  1. /health            → which reasoning engine the Space reports (expect deepseek)
  2. /api/v2/security-chat → engine actually used per request (deepseek / mistral /
                            ml-fallback), latency, and loose answer-quality checks
  3. /api/v2/url-classify  → phishing/malware classification accuracy on labeled URLs

Design notes
------------
* The Space calls DeepSeek server-side using its *own* HF_TOKEN secret, so this
  client normally needs NO token. HF_TOKEN is read from the env only if you point
  it at a *private* Space (sent as a Bearer header). It is never hardcoded.
* Exits non-zero with the failure count, so it can gate CI.
* Stdlib + `requests` only.

Usage
-----
    export SPACE_URL=https://che237-cyberforge.hf.space      # or pass --space-url
    python eval_harness.py                                   # default testset.jsonl
    python eval_harness.py --testset my_cases.jsonl --json report.json
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    sys.exit("This harness needs `requests`  →  pip install requests")


DEFAULT_SPACE_URL = os.environ.get("SPACE_URL", "https://che237-cyberforge.hf.space")
HERE = Path(__file__).parent.resolve()


# ── engine attribution ──────────────────────────────────────────────────────
def engine_of(result: Dict[str, Any]) -> str:
    """Map a security-chat response to the engine that produced it."""
    src = (result.get("source") or "").lower()
    model = (result.get("model") or "").lower()
    if "providers" in src or model == "deepseek":
        return "deepseek"
    if "inference_api" in src or "security-llm" in model:
        return "mistral"
    if result.get("model_used") == "cyberforge-ml-fallback":
        return "ml-fallback"
    if result.get("error"):
        return "error"
    return "unknown"


def predicted_malicious(result: Dict[str, Any]) -> Optional[bool]:
    """Derive a boolean malicious/benign verdict from a url-classify response."""
    if "is_threat" in result and isinstance(result["is_threat"], bool):
        return result["is_threat"]
    pred = str(result.get("prediction", "")).lower()
    if pred in ("malicious", "phishing", "malware", "1"):
        return True
    if pred in ("benign", "legit", "legitimate", "safe", "0"):
        return False
    return None


# ── HTTP ────────────────────────────────────────────────────────────────────
class SpaceClient:
    def __init__(self, base_url: str, timeout: float = 60.0):
        self.base = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        token = os.environ.get("HF_TOKEN", "")
        if token:  # only for private Spaces; harmless for public ones
            self.session.headers["Authorization"] = f"Bearer {token}"

    def post(self, path: str, payload: Dict[str, Any]) -> tuple[Optional[Dict], float, Optional[str]]:
        t0 = time.perf_counter()
        try:
            r = self.session.post(f"{self.base}{path}", json=payload, timeout=self.timeout)
            dt = time.perf_counter() - t0
            if r.status_code != 200:
                return None, dt, f"HTTP {r.status_code}: {r.text[:160]}"
            return r.json(), dt, None
        except Exception as e:
            return None, time.perf_counter() - t0, f"{type(e).__name__}: {str(e)[:160]}"

    def get(self, path: str) -> tuple[Optional[Dict], float, Optional[str]]:
        t0 = time.perf_counter()
        try:
            r = self.session.get(f"{self.base}{path}", timeout=self.timeout)
            dt = time.perf_counter() - t0
            if r.status_code != 200:
                return None, dt, f"HTTP {r.status_code}: {r.text[:160]}"
            return r.json(), dt, None
        except Exception as e:
            return None, time.perf_counter() - t0, f"{type(e).__name__}: {str(e)[:160]}"


# ── case runners ────────────────────────────────────────────────────────────
def run_chat(client: SpaceClient, case: Dict) -> Dict:
    expect = case.get("expect", {})
    res, dt, err = client.post("/api/v2/security-chat",
                               {"query": case["input"], "max_tokens": expect.get("max_tokens", 400)})
    out = {"id": case["id"], "kind": "chat", "latency": dt, "engine": "error", "passed": False, "detail": ""}
    if err or not res:
        out["detail"] = err or "no response"
        return out
    out["engine"] = engine_of(res)
    text = (res.get("response") or "").strip()
    reasons: List[str] = []
    if not text:
        reasons.append("empty response")
    want_engine = expect.get("engine_any")
    if want_engine and out["engine"] not in want_engine:
        reasons.append(f"engine {out['engine']} not in {want_engine}")
    contains = [c.lower() for c in expect.get("contains_any", [])]
    if contains and not any(c in text.lower() for c in contains):
        reasons.append(f"none of {expect['contains_any']} present")
    out["passed"] = not reasons
    out["detail"] = "; ".join(reasons) or f"{len(text)} chars via {out['engine']}"
    return out


def run_url(client: SpaceClient, case: Dict) -> Dict:
    expect = case.get("expect", {})
    res, dt, err = client.post("/api/v2/url-classify", {"url": case["input"]})
    out = {"id": case["id"], "kind": "url", "latency": dt, "engine": "bert", "passed": False, "detail": ""}
    if err or not res:
        out["detail"] = err or "no response"
        return out
    pred = predicted_malicious(res)
    want_malicious = expect.get("label") == "malicious"
    if pred is None:
        out["detail"] = f"unparseable verdict: {json.dumps(res)[:120]}"
        return out
    out["passed"] = (pred == want_malicious)
    verdict = "malicious" if pred else "benign"
    conf = res.get("confidence")
    out["detail"] = f"predicted {verdict}" + (f" ({conf}%)" if conf is not None else "") + \
                    ("" if out["passed"] else f", expected {expect.get('label')}")
    return out


def run_health(client: SpaceClient, case: Dict) -> Dict:
    expect = case.get("expect", {})
    res, dt, err = client.get("/health")
    out = {"id": case["id"], "kind": "health", "latency": dt, "engine": "-", "passed": False, "detail": ""}
    if err or not res:
        out["detail"] = err or "no response"
        return out
    svc = res.get("services", {})
    reasons: List[str] = []
    want = expect.get("reasoning_llm")
    if want and svc.get("reasoning_llm") != want:
        reasons.append(f"reasoning_llm={svc.get('reasoning_llm')} (want {want})")
    out["passed"] = not reasons
    out["detail"] = "; ".join(reasons) or f"engine={svc.get('reasoning_llm')} model={svc.get('reasoning_model')}"
    return out


RUNNERS = {"chat": run_chat, "url": run_url, "health": run_health}


# ── main ────────────────────────────────────────────────────────────────────
def load_cases(path: Path) -> List[Dict]:
    cases = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            cases.append(json.loads(line))
        except json.JSONDecodeError as e:
            sys.exit(f"Bad JSON on {path.name}:{i}: {e}")
    return cases


def main() -> int:
    ap = argparse.ArgumentParser(description="CyberForge HF Space eval harness")
    ap.add_argument("--space-url", default=DEFAULT_SPACE_URL)
    ap.add_argument("--testset", default=str(HERE / "testset.jsonl"))
    ap.add_argument("--timeout", type=float, default=60.0)
    ap.add_argument("--json", default="", help="write a JSON report to this path")
    args = ap.parse_args()

    cases = load_cases(Path(args.testset))
    client = SpaceClient(args.space_url, timeout=args.timeout)

    print(f"\nCyberForge eval → {args.space_url}   ({len(cases)} cases)\n" + "─" * 72)
    results = []
    for case in cases:
        runner = RUNNERS.get(case.get("kind"))
        if not runner:
            print(f"  SKIP  {case.get('id','?'):28} unknown kind {case.get('kind')!r}")
            continue
        r = runner(client, case)
        results.append(r)
        mark = "PASS" if r["passed"] else "FAIL"
        print(f"  {mark}  {r['id']:28} {r['latency']*1000:7.0f}ms  {r['detail']}")

    print("─" * 72)
    passed = sum(1 for r in results if r["passed"])
    failed = len(results) - passed
    lat = [r["latency"] for r in results if r["latency"]]
    engines: Dict[str, int] = {}
    for r in results:
        if r["kind"] == "chat":
            engines[r["engine"]] = engines.get(r["engine"], 0) + 1

    print(f"  {passed}/{len(results)} passed   ({failed} failed)")
    if lat:
        lat_sorted = sorted(lat)
        p95 = lat_sorted[min(len(lat_sorted) - 1, int(round(0.95 * (len(lat_sorted) - 1))))]
        print(f"  latency  p50={statistics.median(lat)*1000:.0f}ms  "
              f"p95={p95*1000:.0f}ms  max={max(lat)*1000:.0f}ms")
    if engines:
        print("  chat engines: " + ", ".join(f"{k}={v}" for k, v in sorted(engines.items())))
        if engines.get("deepseek", 0) == 0:
            print("  ⚠️  No chat answered by DeepSeek — check HF_TOKEN secret + "
                  "REASONING_LLM_MODEL on the Space (it is falling back).")
    print()

    if args.json:
        Path(args.json).write_text(json.dumps(
            {"space_url": args.space_url, "passed": passed, "failed": failed,
             "engines": engines, "results": results}, indent=2))
        print(f"  report → {args.json}\n")

    return min(failed, 120)  # exit code = failures (capped to a valid range)


if __name__ == "__main__":
    sys.exit(main())
