"""Compile llama-cpp-python with CUDA once, as a Hugging Face Job, and publish the wheel.

The Space's image build has a time limit that a CUDA compile exceeds, and no prebuilt CUDA
wheel exists for the pinned version. This job builds it against CUDA 12.4 (GGML_NATIVE off,
so it carries no instructions specific to the build machine) and uploads it to the model
repo under runtime/. The Space image then only downloads it.

    python build_job.py            needs HF_TOKEN (ml-services/.env) and huggingface_hub
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from hf_env import get_hf_token  # noqa: E402
from huggingface_hub import HfApi  # noqa: E402

VERSION = "0.3.36"
REPO = "Che237/cyberforge-models"
COMMAND = f"""set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq python3 python3-pip cmake git build-essential >/dev/null
export CMAKE_ARGS="-DGGML_CUDA=on -DGGML_NATIVE=off" FORCE_CMAKE=1 CMAKE_BUILD_PARALLEL_LEVEL=$(nproc)
pip wheel --no-deps --no-binary llama-cpp-python -w /out llama-cpp-python=={VERSION}
ls -la /out
pip install -q huggingface_hub
python3 - <<'PY'
import glob, os
from huggingface_hub import HfApi
wheel = glob.glob('/out/*.whl')[0]
api = HfApi(token=os.environ['HF_TOKEN'])
c = api.upload_file(path_or_fileobj=wheel, path_in_repo='runtime/llama_cpp_python-{VERSION}-cuda124-linux_x86_64.whl', repo_id='{REPO}',
                    commit_message='llama-cpp-python {VERSION} built with CUDA 12.4 for the Space GPU runtime')
print('PUBLISHED', os.path.basename(wheel), os.path.getsize(wheel), getattr(c, 'oid', c))
PY
"""


def main():
    token = get_hf_token()
    api = HfApi(token=token)
    job = api.run_job(image="nvidia/cuda:12.4.1-devel-ubuntu22.04", command=["bash", "-c", COMMAND], secrets={"HF_TOKEN": token},
                      flavor="cpu-upgrade", timeout="90m", namespace="Che237", labels={"project": "cyberforge", "stage": "gpu-runtime-build"})
    receipt = {"id": job.id, "namespace": "Che237", "url": f"https://huggingface.co/jobs/Che237/{job.id}", "version": VERSION,
               "created_at": datetime.now(timezone.utc).isoformat()}
    (HERE / "runs").mkdir(exist_ok=True)
    (HERE / "runs" / "latest_job.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
