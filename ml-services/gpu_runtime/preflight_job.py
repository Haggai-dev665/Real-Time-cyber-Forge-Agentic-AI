"""Test the next Space image before deploying it: a Hugging Face Job on a T4 that repeats the
image's install steps, loads the chat model with the CUDA runtime and measures its speed
against the CPU wheel, and runs the file scanner on real files. Nothing is published.

    python preflight_job.py        needs HF_TOKEN (ml-services/.env) and huggingface_hub
"""
import base64
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ML = HERE.parent
sys.path.insert(0, str(ML))
from hf_env import get_hf_token  # noqa: E402
from huggingface_hub import HfApi  # noqa: E402

TEST = r'''
import ctypes, json, os, subprocess, sys, time, urllib.request
from huggingface_hub import hf_hub_download
out = {}
try:
    ctypes.CDLL("libcuda.so.1"); out["driver"] = True
except OSError as e:
    out["driver"] = str(e)
path = hf_hub_download("Che237/cyberforge-qwen3.5-2b-v2-GGUF", "cyberforge-qwen3.5-2b-Q4_K_M.gguf", revision="494483e9a85362b5d0bd596f9040bbc0848c860a", token=os.environ["HF_TOKEN"])
code = """
import sys, time, json
from llama_cpp import Llama
gpu = sys.argv[2] == 'gpu'
t = time.time(); m = Llama(model_path=sys.argv[1], n_ctx=4096, n_threads=4, n_threads_batch=4, n_gpu_layers=-1 if gpu else 0, verbose=gpu); load = time.time() - t
NL = chr(10)
p = '<|im_start|>system' + NL + 'You are a security assistant.<|im_end|>' + NL + '<|im_start|>user' + NL + 'Explain phishing and how to spot a phishing link in about 120 words.<|im_end|>' + NL + '<|im_start|>assistant' + NL + '<think>' + NL + NL + '</think>' + NL + NL
t = time.time(); r = m.create_completion(p, max_tokens=200, temperature=0.3); dt = time.time() - t
n = r['usage']['completion_tokens']
t2 = time.time(); r2 = m.create_completion(p, max_tokens=120, temperature=0.3); dt2 = time.time() - t2; n2 = r2['usage']['completion_tokens']
print(json.dumps({'load_s': round(load, 1), 'tokens': n, 'seconds': round(dt, 2), 'tokens_per_s': round(n / dt, 1), 'second_run_tokens_per_s': round(n2 / dt2, 1), 'prompt_tokens': r['usage']['prompt_tokens'], 'text': r['choices'][0]['text'][:160]}))
"""
LD = "/opt/cuda-pkgs/nvidia/cuda_runtime/lib:/opt/cuda-pkgs/nvidia/nccl/lib:/opt/cuda-pkgs/nvidia/cublas/lib"
import glob
missing = set()
for so in glob.glob("/opt/llama-cuda/llama_cpp/lib/*.so*"):
    r = subprocess.run(["ldd", so], capture_output=True, text=True, env={**os.environ, "LD_LIBRARY_PATH": LD})
    missing.update(l.split()[0] for l in r.stdout.splitlines() if "not found" in l)
out["missing_libraries"] = sorted(missing)
out["runtime_libs"] = sorted(os.path.basename(p) + ":" + str(os.path.getsize(p) // 1000000) + "MB" for p in glob.glob("/opt/llama-cuda/llama_cpp/lib/*"))
for mode in ("gpu", "cpu"):
    env = dict(os.environ)
    if mode == "gpu":
        env["PYTHONPATH"] = "/opt/llama-cuda"
        env["LD_LIBRARY_PATH"] = LD + ":" + env.get("LD_LIBRARY_PATH", "")
    r = subprocess.run([sys.executable, "-c", code, path, mode], capture_output=True, text=True, timeout=900, env=env)
    out[mode] = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 and r.stdout.strip() else {"error": (r.stderr or "")[-600:]}
    if mode == "gpu":
        keep = [l[:200] for l in (r.stderr or "").splitlines() if any(k in l.lower() for k in ("cuda", "offload", "gpu", "vram", "device", "backend", "avx", "system_info", "eval time"))]
        out["gpu_log"] = keep[:60]
        smi = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.used,memory.total,driver_version", "--format=csv,noheader"], capture_output=True, text=True)
        out["nvidia_smi"] = (smi.stdout or smi.stderr)[:300]
sys.path.insert(0, "/work")
from file_scan import file_malware
file_malware.load("Che237/cyberforge-models", os.environ["HF_TOKEN"])
out["file_model"] = file_malware.status()
samples = {"python_interpreter_elf": open(sys.executable, "rb").read()[:2_000_000], "mz_garbage": b"MZ" + os.urandom(4096), "text": b"hello world\n" * 50}
for name, url in (("7zr_exe", "https://www.7-zip.org/a/7zr.exe"), ("putty_exe", "https://the.earth.li/~sgtatham/putty/latest/w64/putty.exe")):
    try:
        samples[name] = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
    except Exception as e:
        out.setdefault("download_errors", {})[name] = str(e)[:120]
out["scans"] = {}
for name, data in samples.items():
    r = file_malware.scan(data)
    out["scans"][name] = {k: r.get(k) for k in ("size", "file_kind", "verdict", "score", "decision_threshold", "verdict_reason", "processing_time_ms")}
print("PREFLIGHT " + json.dumps(out))
'''


def main():
    docker = (ML / "hf_space_deploy" / "Dockerfile").read_text(encoding="utf-8")
    wheel = re.search(r"^ARG LLAMA_CUDA_WHEEL=(\S+)$", docker, re.M).group(1)
    if not wheel.startswith("https://"):
        sys.exit("the Dockerfile has no GPU wheel URL yet")
    gpu_step = re.search(r"^RUN (pip install --no-cache-dir --no-deps --target /opt/cuda-pkgs .*)$", docker, re.M).group(1).replace('"$LLAMA_CUDA_WHEEL"', f'"{wheel}"')
    b64 = lambda p: base64.b64encode(p if isinstance(p, bytes) else p.read_bytes()).decode()
    command = ("set -e; export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq git libgomp1 >/dev/null; mkdir -p /work && cd /work; "
               "echo \"$REQ\" | base64 -d > requirements.txt; echo \"$SCAN\" | base64 -d > file_scan.py; echo \"$TEST\" | base64 -d > test.py; "
               f"{gpu_step}; pip install -q --no-cache-dir -r requirements.txt 2>&1 | tail -3; python test.py")
    token = get_hf_token()
    api = HfApi(token=token)
    job = api.run_job(image="python:3.11-slim", command=["bash", "-c", command], secrets={"HF_TOKEN": token},
                      env={"REQ": b64(ML / "hf_space_deploy" / "requirements.txt"), "SCAN": b64(ML / "hf_space_deploy" / "file_scan.py"), "TEST": b64(TEST.encode())},
                      flavor="t4-small", timeout="40m", namespace="Che237", labels={"project": "cyberforge", "stage": "space-preflight"})
    receipt = {"id": job.id, "namespace": "Che237", "url": f"https://huggingface.co/jobs/Che237/{job.id}", "wheel": wheel, "created_at": datetime.now(timezone.utc).isoformat()}
    (HERE / "runs").mkdir(exist_ok=True)
    (HERE / "runs" / "preflight_job.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
