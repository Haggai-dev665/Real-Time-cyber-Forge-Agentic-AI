"""Static malware scoring of Windows programs (PE files).

The model is the EMBER2024 benchmark PE classifier (LightGBM, Apache-2.0), trained by the
dataset's authors, with the `thrember` feature extractor. The file is parsed, never run, and
is not kept. The model and its measured decision threshold are loaded from the model repo
(file_malware/EMBER2024_PE.model and file_malware/metadata.json, written by
ml-services/file_malware/evaluate_job.py). Without a measured threshold no verdict is given.
"""
import hashlib
import json
import os
import threading
import time
from typing import Dict, Optional

FILE_SCAN_SCHEMA = "cyberforge.ml.file_scan.v1"
FILE_SCAN_MAX_BYTES = int(os.environ.get("FILE_SCAN_MAX_BYTES", str(26 * 1024 * 1024)))
MODEL_FILE = "file_malware/EMBER2024_PE.model"
METADATA_FILE = "file_malware/metadata.json"


class FileMalwareModel:
    def __init__(self):
        self.booster = None
        self.extractor = None
        self.metadata: Dict = {}
        self.error: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self.booster is not None and self.threshold is not None

    @property
    def threshold(self) -> Optional[float]:
        value = self.metadata.get("decision_threshold")
        return float(value) if isinstance(value, (int, float)) else None

    def load(self, repo: str, token: Optional[str] = None):
        """Load the model once. Safe to call repeatedly; a failure is kept and reported."""
        with self._lock:
            if self.booster is not None or self.error:
                return
            try:
                import lightgbm as lgb
                import thrember
                from huggingface_hub import hf_hub_download
                meta_path = hf_hub_download(repo_id=repo, filename=METADATA_FILE, token=token or None)
                with open(meta_path, encoding="utf-8") as f:
                    metadata = json.load(f)
                model_path = hf_hub_download(repo_id=repo, filename=MODEL_FILE, token=token or None)
                booster = lgb.Booster(model_file=model_path)
                extractor = thrember.PEFeatureExtractor()
                if booster.num_feature() != extractor.dim:
                    raise ValueError(f"model expects {booster.num_feature()} features, the extractor gives {extractor.dim}")
                self.metadata, self.extractor, self.booster = metadata, extractor, booster
            except Exception as e:
                self.error = f"{type(e).__name__}: {str(e)[:300]}"

    def status(self) -> Dict:
        holdout = (self.metadata.get("holdout") or {}).get("overall") or {}
        return {
            "loaded": self.booster is not None,
            "error": self.error,
            "decision_threshold": self.threshold,
            "source": self.metadata.get("source"),
            "evaluated_at": self.metadata.get("evaluated_at"),
            "holdout": {k: holdout.get(k) for k in ("samples", "recall", "false_positive_rate", "precision")} if holdout else None,
        }

    @staticmethod
    def _parses(data: bytes) -> bool:
        """Whether the bytes are a well-formed PE file (headers only; nothing is run)."""
        try:
            import pefile
            pefile.PE(data=data, fast_load=True).close()
            return True
        except Exception:
            return False

    def scan(self, data: bytes) -> Dict:
        """Score one file. Verdicts: threat, benign, unsupported (not a Windows program),
        unknown (the model is unavailable or the file could not be parsed)."""
        started = time.perf_counter()
        out = {
            "schema": FILE_SCAN_SCHEMA,
            "sha256": hashlib.sha256(data).hexdigest(),
            "size": len(data),
            "file_kind": "pe" if data[:2] == b"MZ" else "other",
            "verdict": "unknown", "verdict_reason": None, "score": None, "decision_threshold": self.threshold,
            "score_kind": "model score, not a calibrated probability",
            "engine": "trained_model", "model": "EMBER2024 benchmark PE classifier (LightGBM)",
            "analysis": "static: the file was parsed, not run",
        }
        if out["file_kind"] != "pe":
            out.update(verdict="unsupported", verdict_reason="not a Windows program (no MZ header); this model covers .exe, .dll and other PE files only", engine=None, model=None)
        elif not self.ready:
            out["verdict_reason"] = self.error or "the file malware model is not loaded"
        elif not self._parses(data):
            out["verdict_reason"] = "the file starts like a Windows program but is not a valid one; it was not scored"
        else:
            try:
                import numpy as np
                features = np.asarray(self.extractor.feature_vector(data), dtype=np.float32)
                score = float(self.booster.predict(features.reshape(1, -1))[0])
                out["score"] = round(score, 6)
                out["verdict"] = "threat" if score >= self.threshold else "benign"
                out["verdict_reason"] = ("the score is at or above the measured decision threshold" if out["verdict"] == "threat"
                                         else "the score is below the measured decision threshold; this is not proof the file is safe")
            except Exception as e:
                out["verdict_reason"] = f"the file could not be analysed: {type(e).__name__}: {str(e)[:200]}"
        out["processing_time_ms"] = round((time.perf_counter() - started) * 1000, 1)
        return out


file_malware = FileMalwareModel()
