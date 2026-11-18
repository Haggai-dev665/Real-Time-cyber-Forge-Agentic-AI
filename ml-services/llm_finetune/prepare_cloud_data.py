"""Download only the record files consumed by build_dataset, then build/upload."""
import json
import os
import subprocess
import sys
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download
from validate_data import validate

HERE = Path(__file__).resolve().parent
FILES = [
    "web_security/ssl_certificates/ssl_certificates_processed.csv",
    "dns_tunneling/dns_tunneling_processed.csv",
    "web_security/http_csic_requests/http_csic_requests_processed.csv",
    "web_security/system_logs_hdfs/system_logs_hdfs_processed.csv",
    "web_security/cryptomining_scripts/cryptomining_scripts_processed.csv",
    "web_security/malware_pe_features/malware_pe_features_processed.csv",
    "threat_intelligence/threat_intelligence.txt",
    "anomaly_detection/anomaly_detection.csv",
]


def main():
    api = HfApi()
    repo = os.environ["OWNER_DATA_REPO"]
    revision = api.dataset_info(repo).sha
    dest = HERE.parent / "datasets"
    snapshot_download(repo, repo_type="dataset", revision=revision,
                      allow_patterns=FILES, local_dir=dest)
    missing = [name for name in FILES if not (dest / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing owner records: {missing}")
    subprocess.run([sys.executable, str(HERE / "build_dataset.py"), "--out", str(HERE.parent / "data")], check=True)
    data = HERE.parent / "data"
    validate(data)
    (data / "provenance.json").write_text(json.dumps({"owner_repo": repo, "owner_revision": revision,
        "bundle_revision": os.environ["BUNDLE_REVISION"], "files": FILES}, indent=2))
    api.upload_folder(repo_id=os.environ["BUNDLE_REPO"], repo_type="dataset", folder_path=data,
                      path_in_repo="data", commit_message="Build CyberForge SFT dataset on HF CPU Job")
    print("DATA JOB DONE", flush=True)


if __name__ == "__main__":
    main()
