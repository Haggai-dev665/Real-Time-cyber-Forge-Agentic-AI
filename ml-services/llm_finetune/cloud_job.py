"""Launch bounded, revision-pinned private HF Jobs: data, smoke, then train.

Requires HF_TOKEN in the environment. PRO jobs consume compute credits.
"""
import argparse
import json
import os
import shlex
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from huggingface_hub import HfApi

HERE = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--stage", choices=["data", "smoke", "train", "refine", "evaluate", "release", "groundcheck", "constrained"], required=True)
    ap.add_argument("--after-job", help="training job to await before evaluation")
    ap.add_argument("--owner", default="Che237")
    ap.add_argument("--bundle-repo")
    ap.add_argument("--model-repo")
    ap.add_argument("--data", help="validated local dataset directory to bundle")
    ap.add_argument("--candidate-revision")
    ap.add_argument("--flavor")
    ap.add_argument("--timeout")
    ap.add_argument("--train-args", default="")
    args = ap.parse_args()
    token = os.environ["HF_TOKEN"]
    api = HfApi(token=token)
    if args.after_job and args.stage not in ("evaluate", "release", "groundcheck", "constrained"):
        ap.error("--after-job is only supported for evaluation")
    if args.after_job:
        dependency = api.inspect_job(job_id=args.after_job, namespace=args.owner)
        if dependency.status.stage not in ("SCHEDULING", "STARTING", "RUNNING", "COMPLETED"):
            raise ValueError(f"Training job is not viable: {dependency.status.stage}")
    bundle = args.bundle_repo or f"{args.owner}/cyberforge-llm-sft"
    model = args.model_repo or f"{args.owner}/cyberforge-qwen3.5-2b-GGUF"
    for repo, kind in [(bundle, "dataset"), (model, "model")]:
        api.create_repo(repo, repo_type=kind, private=True, exist_ok=True)
        if not api.repo_info(repo, repo_type=kind).private:
            raise ValueError(f"Training repository must be private: {repo}")
    if args.stage != "data" and not args.data:
        files = set(api.list_repo_files(bundle, repo_type="dataset"))
        required = {f"data/{n}" for n in ("train.jsonl", "val.jsonl", "test.jsonl", "stats.json")}
        if not required <= files:
            raise ValueError("Run the data job successfully before allocating a GPU")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "llm_finetune").mkdir()
        for path in HERE.iterdir():
            if path.is_file() and path.suffix in (".py", ".sh", ".md", ".txt"):
                shutil.copy(path, root / "llm_finetune" / path.name)
        (root / "hf_space_deploy").mkdir()
        for name in ("url_features.py", "trainer.py", "security_knowledge.py"):
            shutil.copy(HERE.parent / "hf_space_deploy" / name, root / "hf_space_deploy" / name)
        if args.data:
            from validate_data import validate
            validate(args.data)
            (root / "data").mkdir()
            for name in ("train.jsonl", "val.jsonl", "test.jsonl", "stats.json"):
                shutil.copy(Path(args.data) / name, root / "data" / name)
        (root / "training_data").mkdir()
        shutil.copy(HERE.parent / "training_data" / "cybersecurity_scenarios.json", root / "training_data")
        commit = api.upload_folder(folder_path=root, repo_id=bundle, repo_type="dataset",
                                   commit_message=f"CyberForge {args.stage} source bundle")
    revision = commit.oid
    base_revision = api.model_info("Qwen/Qwen3.5-2B").sha
    env = {"BUNDLE_REPO": bundle, "BUNDLE_REVISION": revision, "MODEL_REPO": model,
           "BASE_REVISION": base_revision, "STAGE": args.stage, "TRAIN_ARGS": args.train_args,
           "OWNER_DATA_REPO": f"{args.owner}/cyberforge-datasets"}
    if args.stage in ("evaluate", "release", "groundcheck", "constrained"):
        env.update(AFTER_JOB=args.after_job or "", JOB_NAMESPACE=args.owner,
                   BASE_GGUF_REVISION=api.model_info("unsloth/Qwen3.5-2B-GGUF").sha)
    if args.candidate_revision:
        api.model_info(model, revision=args.candidate_revision)
        env["CANDIDATE_REVISION"] = args.candidate_revision
    cpu = args.stage in ("data", "evaluate", "release", "groundcheck", "constrained")
    flavor = args.flavor or ("cpu-upgrade" if cpu else "l4x1")
    timeout = args.timeout or {"data": "1h", "smoke": "30m", "train": "3h", "refine": "2h", "evaluate": "3h", "release": "3h", "groundcheck": "2h", "constrained": "2h"}[args.stage]
    command = ("pip install -q huggingface_hub==2.2.0 && hf download "
               f"{shlex.quote(bundle)} llm_finetune/hf_job.sh --revision {revision} "
               "--repo-type dataset --local-dir /tmp/bootstrap && "
               "bash /tmp/bootstrap/llm_finetune/hf_job.sh")
    job = api.run_job(image="python:3.11-slim" if cpu else
                      "pytorch/pytorch:2.8.0-cuda12.8-cudnn9-devel",
                      command=["bash", "-c", command], env=env, secrets={"HF_TOKEN": token},
                      flavor=flavor, timeout=timeout, namespace=args.owner,
                      labels={"project": "cyberforge", "stage": args.stage})
    receipt = {"id": job.id, "stage": args.stage, "namespace": args.owner,
               "url": f"https://huggingface.co/jobs/{args.owner}/{job.id}",
               "bundle": bundle, "bundle_revision": revision, "base_revision": base_revision,
               "model": model, "flavor": flavor, "timeout": timeout,
               "after_job": args.after_job,
               "created_at": datetime.now(timezone.utc).isoformat()}
    dest = HERE / "runs"
    dest.mkdir(exist_ok=True)
    for name in ("latest_job.json", f"{args.stage}-{job.id}.json"):
        (dest / name).write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
