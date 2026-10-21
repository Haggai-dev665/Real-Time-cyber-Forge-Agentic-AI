"""Drive the ML Space's request gate (ServiceGate in
ml-services/hf_space_deploy/app.py) with fake ASGI calls, without importing
app.py: importing it would load the models. Only the gate's own definitions are
taken from the source and run. Prints one JSON object of results.

    python ml_gate_harness.py <app.py> <service key or ""> <max body bytes>
"""
import ast
import asyncio
import hmac
import json
import sys
from typing import Optional

GATE_NAMES = {"PUBLIC_PATHS", "OWNER_PATHS", "SERVICE_KEY_HEADER", "BodyTooLarge",
              "service_key_valid", "_reply", "ServiceGate"}


def load_gate(source_path, key, max_bytes):
    tree = ast.parse(open(source_path, encoding="utf-8").read())
    picked = []
    for node in tree.body:
        names = set()
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            names = {node.name}
        elif isinstance(node, ast.Assign):
            names = {t.id for t in node.targets if isinstance(t, ast.Name)}
        if names & GATE_NAMES:
            picked.append(node)
    found = {n.name if hasattr(n, "name") else n.targets[0].id for n in picked}
    missing = GATE_NAMES - found
    if missing:
        raise SystemExit(json.dumps({"error": f"not found in app.py: {sorted(missing)}"}))
    namespace = {"hmac": hmac, "json": json, "Optional": Optional,
                 "ML_SERVICE_KEY": key, "ML_MAX_BODY_BYTES": max_bytes}
    exec(compile(ast.Module(body=picked, type_ignores=[]), source_path, "exec"), namespace)
    return namespace


async def call(gate_class, method, path, headers=(), chunks=(b"",)):
    reached = {"value": False}

    async def downstream(scope, receive, send):
        reached["value"] = True
        size = 0
        while True:
            message = await receive()
            size += len(message.get("body", b""))
            if not message.get("more_body"):
                break
        body = json.dumps({"read": size}).encode()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": body})

    queue = list(chunks)

    async def receive():
        chunk = queue.pop(0) if queue else b""
        return {"type": "http.request", "body": chunk, "more_body": bool(queue)}

    sent = []

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "method": method, "path": path,
             "headers": [(k.lower().encode(), v.encode()) for k, v in headers]}
    await gate_class(downstream)(scope, receive, send)
    status = next(m["status"] for m in sent if m["type"] == "http.response.start")
    body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
    try:
        payload = json.loads(body or b"{}")
    except ValueError:
        payload = {}
    return {"status": status, "reached": reached["value"], "code": payload.get("code")}


async def main():
    source, key, max_bytes = sys.argv[1], sys.argv[2], int(sys.argv[3])
    gate = load_gate(source, key, max_bytes)["ServiceGate"]
    good = [("X-CyberForge-Service-Key", key)] if key else []
    big = b"x" * (max_bytes + 1)
    cases = {
        "health_without_key": ("GET", "/health", [], (b"",)),
        "landing_without_key": ("GET", "/", [], (b"",)),
        "inference_without_key": ("POST", "/analyze-url", [], (b"{}",)),
        "inference_with_wrong_key": ("POST", "/analyze-url", [("X-CyberForge-Service-Key", "wrong" * 8)], (b"{}",)),
        "inference_with_key": ("POST", "/analyze-url", good, (b"{}",)),
        "docs_without_key": ("GET", "/docs", [], (b"",)),
        "openapi_without_key": ("GET", "/openapi.json", [], (b"",)),
        "removed_gradio_api_without_key": ("POST", "/gradio_api/upload", [], (b"x",)),
        "admin_train_without_key": ("POST", "/api/admin/train", [], (b"",)),
        "preflight_without_key": ("OPTIONS", "/analyze-url", [], (b"",)),
        "stated_length_over_limit": ("POST", "/analyze-url", good + [("Content-Length", str(max_bytes + 1))], (big,)),
        "streamed_body_over_limit": ("POST", "/analyze-url", good, (big[: max_bytes // 2], big[max_bytes // 2:])),
        "body_at_limit": ("POST", "/analyze-url", good + [("Content-Length", str(max_bytes))], (b"x" * max_bytes,)),
        "bad_content_length": ("POST", "/analyze-url", good + [("Content-Length", "lots")], (b"{}",)),
    }
    results = {}
    for name, (method, path, headers, chunks) in cases.items():
        results[name] = await call(gate, method, path, headers, chunks)
    print(json.dumps(results))


asyncio.run(main())
