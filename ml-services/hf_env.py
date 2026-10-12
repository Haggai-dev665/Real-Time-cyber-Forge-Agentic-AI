"""
Hugging Face credentials for the ml-services scripts.

The token is never written in source. It is read from the HF_TOKEN environment
variable, which comes from:
  - ml-services/.env when a script is run from a developer machine
    (git-ignored; copy .env.example to .env and fill in HF_TOKEN), or
  - the HF_TOKEN secret when the code runs on a Hugging Face Space.
"""

import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent / ".env"


def load_env() -> None:
    """Load ml-services/.env into os.environ without overriding existing values."""
    if not ENV_FILE.exists():
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(ENV_FILE, override=False)
    except ImportError:
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_hf_token() -> str:
    """Return the Hugging Face token, or exit with instructions if it is missing."""
    load_env()
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "HF_TOKEN is not set. Add HF_TOKEN=hf_... to ml-services/.env "
            "(see .env.example) or export it in your shell."
        )
    return token
