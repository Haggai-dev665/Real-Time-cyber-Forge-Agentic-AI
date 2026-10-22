"""Start the fine-tuning run as a Hugging Face Job.

1. uploads this folder, url_features.py, trainer.py and the built dataset to a
   private dataset repository (the job's input bundle)
2. creates the private model repository the job uploads its results to
3. runs hf_job.sh on the chosen GPU flavour, with HF_TOKEN passed as a secret

The account needs Jobs credit (huggingface.co/settings/billing). An L4 or A10G
finishes the default run in well under an hour.

  python launch_hf_job.py --data data --flavor l4x1
  hf jobs logs <job id>          # follow it
"""

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

HERE = Path(__file__).resolve().parent
IMAGE = "pytorch/pytorch:2.8.0-cuda12.8-cudnn9-devel"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(HERE / "data"))
    ap.add_argument("--owner", default="Che237")
    ap.add_argument("--bundle-repo", default=None)
    ap.add_argument("--model-repo", default=None)
    ap.add_argument("--flavor", default="l4x1")
    ap.add_argument("--timeout", default="3h")
    ap.add_argument("--train-args", default="", help="extra train_lora.py arguments")
    args = ap.parse_args()
    token = os.environ["HF_TOKEN"]
    bundle = args.bundle_repo or f"{args.owner}/cyberforge-llm-sft"
    model = args.model_repo or f"{args.owner}/cyberforge-qwen3.5-2b-GGUF"
    api = HfApi(token=token)

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        shutil.copytree(HERE, root / "llm_finetune", ignore=shutil.ignore_patterns("data", "runs", "eval*", "__pycache__", "*.gguf"))
        shutil.copytree(args.data, root / "data")
        dep = HERE.parent / "hf_space_deploy"
        (root / "hf_space_deploy").mkdir()
        for name in ("url_features.py", "trainer.py"):
            shutil.copy(dep / name, root / "hf_space_deploy" / name)
        api.create_repo(bundle, repo_type="dataset", private=True, exist_ok=True)
        api.upload_folder(folder_path=str(root), repo_id=bundle, repo_type="dataset",
                          commit_message="Fine-tuning bundle: code and SFT dataset")
    api.create_repo(model, repo_type="model", private=True, exist_ok=True)

    cmd = ["hf", "jobs", "run", "--detach", "--flavor", args.flavor, "--timeout", args.timeout,
           "--secrets", "HF_TOKEN", "-e", f"BUNDLE_REPO={bundle}", "-e", f"MODEL_REPO={model}",
           "-e", f"TRAIN_ARGS={args.train_args}", IMAGE, "bash", "-c",
           f"pip install -q 'huggingface_hub>=1.0' && hf download {bundle} llm_finetune/hf_job.sh --repo-type dataset "
           f"--local-dir /tmp/b && bash /tmp/b/llm_finetune/hf_job.sh"]
    print(" ".join(cmd[:12]), "...")
    subprocess.run(cmd, check=True, env={**os.environ, "HF_TOKEN": token})


if __name__ == "__main__":
    main()
