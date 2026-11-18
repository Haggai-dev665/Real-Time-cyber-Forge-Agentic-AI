"""Inspect a cloud-job receipt without printing environment or secret values."""
import argparse
import json
import os
from pathlib import Path
from huggingface_hub import HfApi


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--receipt", default=str(Path(__file__).parent / "runs/latest_job.json"))
    ap.add_argument("--tail", type=int, default=15)
    args = ap.parse_args()
    receipt = json.loads(Path(args.receipt).read_text(encoding="utf-8"))
    api = HfApi()
    job = api.inspect_job(job_id=receipt["id"], namespace=receipt["namespace"])
    print(json.dumps({"id": job.id, "stage": job.status.stage,
                      "message": job.status.message, "url": receipt["url"]}))
    secret = os.environ.get("HF_TOKEN")
    for line in api.fetch_job_logs(job_id=job.id, namespace=receipt["namespace"], tail=args.tail):
        print(line.replace(secret, "[REDACTED]") if secret else line)


if __name__ == "__main__":
    main()
