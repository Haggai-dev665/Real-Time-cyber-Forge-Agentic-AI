"""The four URL detectors in service, scored the way the Space scores them.

Training prompts carry detector results; they are computed here with the
models from Che237/cyberforge-models and hf_space_deploy/url_features.py, so a
prompt shows the numbers the app would really show for that URL. Mirrors
MLModelLoader.predict in app.py (rescaled thresholds, IsolationForest margin).
"""

import json
import sys
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
from huggingface_hub import hf_hub_download

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hf_space_deploy"))
from url_features import (CREDENTIAL_WORDS, bare_url, extract_url_features, feature_row,  # noqa: E402
                          rescale_score, set_popular_domains)

MODEL_REPO = "Che237/cyberforge-models"
MODEL_NAMES = ["phishing_detection", "malware_detection", "anomaly_detection", "web_attack_detection"]


class Detectors:
    def __init__(self, token=None, repo: str = MODEL_REPO):
        self.models, self.metadata = {}, {}
        for name in MODEL_NAMES:
            # The service's own pickles, from the owner's repository
            # (joblib, as app.py loads them; only the owner's repository is read)
            self.models[name] = joblib.load(hf_hub_download(repo, f"{name}/best_model.pkl", token=token))
            with open(hf_hub_download(repo, f"{name}/metadata.json", token=token), encoding="utf-8") as f:
                self.metadata[name] = json.load(f)
        with open(hf_hub_download(repo, "reputation/popular_domains.txt", token=token), encoding="utf-8") as f:
            set_popular_domains([line.strip() for line in f if line.strip()])

    def score(self, url: str) -> Dict[str, float]:
        """{model: threat_score}; 0.5 or more reads as a threat, as in the Space."""
        features = extract_url_features(url)
        out = {}
        for name, model in self.models.items():
            meta = self.metadata[name]
            X = np.array([feature_row(features, meta["feature_names"])], dtype=np.float32)
            if not hasattr(model, "predict_proba"):
                margin = float(model.decision_function(X)[0])
                out[name] = round(min(1.0, max(0.0, 0.5 - margin)), 4)
                continue
            p = float(model.predict_proba(X)[0][1])
            t = meta.get("decision_threshold")
            if isinstance(t, (int, float)) and 0.5 < t < 1.0:
                p = rescale_score(p, float(t))
            out[name] = round(p, 4)
        return out

    def score_many(self, urls: List[str]) -> List[Dict[str, float]]:
        return [self.score(u) for u in urls]


def red_flags(url: str) -> List[str]:
    """Plain-language lexical signals in a URL, from the same features the
    detectors read. Only what the URL text itself shows."""
    f = extract_url_features(url)
    flags = []
    if f["host_is_ip"]:
        flags.append("the host is a bare IP address, not a domain name")
    if f["host_suspicious_tld"]:
        flags.append("it uses a top-level domain often abused for throwaway sites")
    if f["has_punycode"]:
        flags.append("the host uses punycode (xn--), which can hide look-alike characters")
    if f["bare_at_symbol"]:
        flags.append("it contains an @ sign, which can hide the real destination")
    found = [w for w in CREDENTIAL_WORDS if w in bare_url(url).lower()]
    if len(found) >= 2:
        flags.append(f"the address is full of account words ({', '.join(found[:3])})")
    elif found:
        flags.append(f"the address contains the account word \"{found[0]}\"")
    if f["host_subdomains"] >= 3:
        flags.append(f"the host has {f['host_subdomains']} subdomain levels")
    if f["host_hyphens"] >= 2:
        flags.append("the host name is stitched together with hyphens")
    if f["has_executable_extension"]:
        flags.append("it points straight at an executable file")
    elif f["has_script_extension"]:
        flags.append("it points straight at a script file")
    elif f["has_archive_extension"]:
        flags.append("it points at an archive download")
    if f["is_shortener"]:
        flags.append("it is a link shortener, so the final destination is hidden")
    if f["has_embedded_url"]:
        flags.append("another URL is embedded inside it (a redirect pattern)")
    if f["host_has_port"]:
        flags.append("it uses a non-standard port")
    if f["payload_sql_keywords"] >= 2 or f["payload_comment_markers"]:
        flags.append("the query carries SQL syntax (keywords, quotes or comment markers)")
    if f["payload_script_tokens"] or f["payload_angle_brackets"] >= 2:
        flags.append("the query carries HTML/JavaScript markup")
    if f["payload_traversal"]:
        flags.append("the path contains ../ directory traversal")
    if not f["is_https"] and f["url_length"] and url.lower().startswith("http://"):
        flags.append("it is plain HTTP, so traffic is not encrypted")
    return flags


def popularity(url: str) -> float:
    return extract_url_features(url)["domain_popularity"]
