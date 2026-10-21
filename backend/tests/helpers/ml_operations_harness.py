"""Execute the production counters without loading models or starting the Space."""
import ast
import asyncio
import sys
import threading
import time
from types import SimpleNamespace

source = ast.parse(open(sys.argv[1], encoding="utf-8").read())
names = {"operational_report", "measure_requests"}
nodes = [node for node in source.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
assert len(nodes) == 2
for node in nodes:
    node.decorator_list = []
namespace = {"time": time, "OPS_LOCK": threading.Lock(), "OPS_STARTED": time.monotonic(), "OPS": {"active_requests": 0, "completed_requests": 0, "failed_requests": 0, "total_duration_ms": 0.0}, "Request": object}
exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), "app.py", "exec"), namespace)
report = namespace["operational_report"]
measure = namespace["measure_requests"]
assert report()["mean_request_ms"] is None

async def run():
    request = SimpleNamespace(method="POST", url=SimpleNamespace(path="/analyze-url"))
    async def success(_):
        assert report()["active_requests"] == 1
        return SimpleNamespace(status_code=200)
    async def refused(_):
        return SimpleNamespace(status_code=503)
    async def broken(_):
        raise RuntimeError("provider failed")
    await measure(request, success)
    await measure(request, refused)
    try:
        await measure(request, broken)
    except RuntimeError:
        pass
    else:
        raise AssertionError("middleware swallowed an exception")
    after = report()
    assert after["active_requests"] == 0
    assert after["completed_requests"] == 3
    assert after["failed_requests"] == 2
    assert after["mean_request_ms"] >= 0
    for method, path in [("GET", "/api/v2/capabilities"), ("POST", "/api/admin/train")]:
        await measure(SimpleNamespace(method=method, url=SimpleNamespace(path=path)), refused)
    assert report()["completed_requests"] == 3

asyncio.run(run())
print("ML operational counters passed")
