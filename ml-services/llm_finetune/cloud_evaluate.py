"""Wait for training, evaluate immutable GGUF artifacts, upload actual answers."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from huggingface_hub import HfApi, hf_hub_download


def wait_for_training(api, job_id, namespace, deadline):
    while job_id:
        status = api.inspect_job(job_id=job_id, namespace=namespace).status.stage
        print(f"Training dependency: {status}", flush=True)
        if status == "COMPLETED":
            return
        if status not in ("SCHEDULING", "STARTING", "RUNNING"):
            raise RuntimeError(f"Training dependency failed: {status}")
        if time.monotonic() >= deadline:
            raise TimeoutError("Training dependency exceeded evaluation wait budget")
        time.sleep(30)


def main():
    api = HfApi()
    wait_for_training(api, os.environ.get("AFTER_JOB"), os.environ["JOB_NAMESPACE"],
                      time.monotonic() + 5400)
    repo = os.environ["MODEL_REPO"]
    revision = os.environ.get("CANDIDATE_REVISION") or api.model_info(repo).sha
    candidate = hf_hub_download(repo, "cyberforge-qwen3.5-2b-Q4_K_M.gguf", revision=revision)
    constrained = os.environ.get("STAGE") == "constrained"
    postreview = os.environ.get("STAGE") in ("groundcheck", "constrained")
    release = os.environ.get("STAGE") in ("release", "groundcheck", "constrained")
    baseline = (hf_hub_download("Che237/cyberforge-qwen3.5-2b-GGUF", "cyberforge-qwen3.5-2b-Q4_K_M.gguf",
                               revision="9fcfd481271b09218de9e1bd0c7e7b224c58dd41") if release else
                hf_hub_download("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q4_K_M.gguf",
                               revision=os.environ["BASE_GGUF_REVISION"]))
    out = Path("/tmp/cf/evaluation")
    out.mkdir(parents=True, exist_ok=True)
    provenance = {"candidate_repo": repo, "candidate_revision": revision,
                  "baseline_revision": os.environ["BASE_GGUF_REVISION"],
                  "bundle_revision": os.environ["BUNDLE_REVISION"],
                  "training_job": os.environ.get("AFTER_JOB"), "limit": 240,
                  "runtime": "llama-cpp-python==0.3.36", "seed": 0}
    (out / "provenance.json").write_text(json.dumps(provenance, indent=2))
    if release:
        provenance["previous_model_revision"] = "9fcfd481271b09218de9e1bd0c7e7b224c58dd41"
        (out / "provenance.json").write_text(json.dumps(provenance, indent=2))
    destination = f"{'release-constrained' if constrained else 'release-grounded' if postreview else 'release' if release else 'evaluation'}/{revision}"
    try:
        command = ([sys.executable, "postreview_evaluate.py" if postreview else "release_evaluate.py", "--previous", baseline, "--candidate", candidate,
                    "--out", str(out)] if release else
                   [sys.executable, "evaluate.py", "--data", "../data/test.jsonl",
                        "--model", f"base={baseline}", "--model", f"tuned={candidate}",
                        "--limit", "240", "--threads", "8", "--seed", "0", "--out", str(out)])
        subprocess.run(command, check=True)
    finally:
        api.upload_folder(repo_id=repo, folder_path=out, path_in_repo=destination,
                          commit_message="Held-out GGUF evaluation artifacts (review report completeness)")
    print(f"EVALUATION DONE: {repo}/{destination}; review responses before deployment", flush=True)


if __name__ == "__main__":
    main()
