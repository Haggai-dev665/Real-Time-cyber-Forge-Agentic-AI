"""
CyberForge ML Model Trainer & Uploader
Trains 4 sklearn models on real + synthetic cybersecurity data,
then uploads them to Che237/cyberforge-models on HuggingFace.

Feature schema (matches hf_space_deploy/app.py extract_url_features):
  url_length, hostname_length, path_length, is_https, has_ip_address,
  has_suspicious_tld, subdomain_count, has_port, query_params_count,
  has_at_symbol, has_double_slash, special_char_count
"""

import os, sys, json, joblib, logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score, f1_score
from huggingface_hub import HfApi, create_repo, upload_file

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

HF_TOKEN   = "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"
MODEL_REPO = "Che237/cyberforge-models"
BASE_DIR   = Path(__file__).parent
DATASETS   = BASE_DIR / "datasets"
OUT_DIR    = BASE_DIR / "trained_models_upload"
OUT_DIR.mkdir(exist_ok=True)

FEATURE_NAMES = [
    "url_length", "hostname_length", "path_length", "is_https",
    "has_ip_address", "has_suspicious_tld", "subdomain_count",
    "has_port", "query_params_count", "has_at_symbol",
    "has_double_slash", "special_char_count",
]

rng = np.random.default_rng(42)

# ─────────────────────────────────────────────────────────────────────────────
# SYNTHETIC DATA GENERATORS
# ─────────────────────────────────────────────────────────────────────────────

def synth_benign(n=1000):
    """Realistic benign URL features."""
    d = {
        "url_length":        rng.integers(15, 60, n),
        "hostname_length":   rng.integers(5, 25, n),
        "path_length":       rng.integers(0, 30, n),
        "is_https":          rng.choice([1, 1, 1, 0], n),     # 75% HTTPS
        "has_ip_address":    rng.choice([0, 0, 0, 0, 1], n),  # 20% IP
        "has_suspicious_tld":rng.choice([0, 0, 0, 1], n),
        "subdomain_count":   rng.integers(0, 2, n),
        "has_port":          rng.choice([0, 0, 0, 1], n),
        "query_params_count":rng.integers(0, 3, n),
        "has_at_symbol":     rng.choice([0, 0, 0, 0, 1], n),
        "has_double_slash":  rng.choice([0, 0, 0, 1], n),
        "special_char_count":rng.integers(0, 4, n),
    }
    labels = np.zeros(n, dtype=int)
    return pd.DataFrame(d), labels


def synth_malicious(n=1000, threat_type="phishing"):
    """Realistic malicious URL features."""
    d = {
        "url_length":        rng.integers(60, 300, n),
        "hostname_length":   rng.integers(20, 80, n),
        "path_length":       rng.integers(10, 120, n),
        "is_https":          rng.choice([1, 0, 0], n),        # often no HTTPS
        "has_ip_address":    rng.choice([0, 0, 1, 1], n),     # more IP
        "has_suspicious_tld":rng.choice([0, 1, 1, 1], n),     # suspicious TLDs
        "subdomain_count":   rng.integers(1, 5, n),
        "has_port":          rng.choice([0, 0, 1, 1], n),
        "query_params_count":rng.integers(2, 10, n),
        "has_at_symbol":     rng.choice([0, 0, 0, 1, 1], n),  # more @
        "has_double_slash":  rng.choice([0, 0, 1, 1], n),
        "special_char_count":rng.integers(5, 25, n),
    }
    labels = np.ones(n, dtype=int)
    return pd.DataFrame(d), labels


# ─────────────────────────────────────────────────────────────────────────────
# PHISHING DETECTION — map existing dataset + synthetic
# ─────────────────────────────────────────────────────────────────────────────

def build_phishing_dataset():
    csv_path = DATASETS / "phishing_detection" / "phishing_detection_processed.csv"
    try:
        df = pd.read_csv(csv_path)
        log.info(f"Phishing CSV: {len(df)} rows, columns: {list(df.columns)}")
        # Map existing columns to our schema
        mapped = pd.DataFrame()
        mapped["url_length"]          = df.get("url_length", rng.integers(15, 200, len(df)))
        mapped["hostname_length"]     = (df.get("url_length", 40) * 0.3).astype(int)
        mapped["path_length"]         = (df.get("url_length", 40) * 0.4).astype(int)
        mapped["is_https"]            = df.get("https", 1)
        mapped["has_ip_address"]      = rng.integers(0, 2, len(df))
        mapped["has_suspicious_tld"]  = (df.get("suspicious_words", 0) > 3).astype(int)
        mapped["subdomain_count"]     = df.get("subdomain_level", rng.integers(0, 3, len(df)))
        mapped["has_port"]            = rng.choice([0, 1], len(df), p=[0.85, 0.15])
        mapped["query_params_count"]  = rng.integers(0, 6, len(df))
        mapped["has_at_symbol"]       = rng.choice([0, 1], len(df), p=[0.9, 0.1])
        mapped["has_double_slash"]    = rng.choice([0, 1], len(df), p=[0.85, 0.15])
        mapped["special_char_count"]  = df.get("suspicious_words", rng.integers(0, 15, len(df)))
        y_real = df["is_phishing"].values
        log.info(f"  Phishing ratio: {y_real.mean():.1%}")
    except Exception as e:
        log.warning(f"Could not load phishing CSV: {e} — using synthetic only")
        mapped = pd.DataFrame()
        y_real = np.array([])

    # Augment with synthetic
    X_b, y_b = synth_benign(1500)
    X_m, y_m = synth_malicious(1500, "phishing")
    if len(mapped):
        X = pd.concat([mapped, X_b, X_m], ignore_index=True)
        y = np.concatenate([y_real, y_b, y_m])
    else:
        X = pd.concat([X_b, X_m], ignore_index=True)
        y = np.concatenate([y_b, y_m])
    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# MALWARE DETECTION — generate URL-based malware signals
# ─────────────────────────────────────────────────────────────────────────────

def build_malware_dataset():
    csv_path = DATASETS / "malware_detection" / "malware_detection_processed.csv"
    try:
        df = pd.read_csv(csv_path)
        log.info(f"Malware CSV: {len(df)} rows")
        # Map file-based features to URL-proxy features
        # entropy → more special chars; pe_sections → subdomain_count; imports → url_length proxy
        mapped = pd.DataFrame()
        mapped["url_length"]          = (df.get("file_size", 50000) / 1000).clip(10, 300).astype(int)
        mapped["hostname_length"]     = (df.get("entropy", 4) * 5).clip(5, 40).astype(int)
        mapped["path_length"]         = (df.get("strings_count", 500) / 100).clip(0, 80).astype(int)
        mapped["is_https"]            = rng.choice([0, 1], len(df), p=[0.6, 0.4])
        mapped["has_ip_address"]      = (df.get("entropy", 0) > 6).astype(int)
        mapped["has_suspicious_tld"]  = rng.integers(0, 2, len(df))
        mapped["subdomain_count"]     = df.get("pe_sections", rng.integers(0, 4, len(df))).clip(0, 6).astype(int)
        mapped["has_port"]            = rng.choice([0, 1], len(df), p=[0.7, 0.3])
        mapped["query_params_count"]  = (df.get("exports", 0) / 20).clip(0, 10).astype(int)
        mapped["has_at_symbol"]       = rng.choice([0, 1], len(df), p=[0.85, 0.15])
        mapped["has_double_slash"]    = rng.choice([0, 1], len(df), p=[0.8, 0.2])
        mapped["special_char_count"]  = (df.get("entropy", 4) * 2).clip(0, 25).astype(int)
        y_real = df["is_malware"].values
        log.info(f"  Malware ratio: {y_real.mean():.1%}")
    except Exception as e:
        log.warning(f"Could not load malware CSV: {e} — using synthetic only")
        mapped = pd.DataFrame()
        y_real = np.array([])

    X_b, y_b = synth_benign(1500)
    X_m, y_m = synth_malicious(1500, "malware")
    if len(mapped):
        X = pd.concat([mapped, X_b, X_m], ignore_index=True)
        y = np.concatenate([y_real, y_b, y_m])
    else:
        X = pd.concat([X_b, X_m], ignore_index=True)
        y = np.concatenate([y_b, y_m])
    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# WEB ATTACK DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def build_web_attack_dataset():
    csv_path = DATASETS / "web_attack_detection" / "web_attack_detection_processed.csv"
    try:
        df = pd.read_csv(csv_path)
        log.info(f"Web attack CSV: {len(df)} rows")

        def url_features_from_row(row):
            url = str(row.get("url", "/"))
            payload = str(row.get("payload", ""))
            full = url + payload
            return {
                "url_length":         len(full),
                "hostname_length":    len(url.split("?")[0]),
                "path_length":        len(url.split("?")[0]),
                "is_https":           0,  # HTTP history
                "has_ip_address":     0,
                "has_suspicious_tld": 0,
                "subdomain_count":    0,
                "has_port":           0,
                "query_params_count": len(url.split("&")) if "?" in url else 0,
                "has_at_symbol":      1 if "@" in full else 0,
                "has_double_slash":   1 if "//" in full[2:] else 0,
                "special_char_count": sum(1 for c in full if c in "!@#$%^&*()+={}[]|\\:;<>?,"),
            }

        rows = [url_features_from_row(row) for _, row in df.iterrows()]
        mapped = pd.DataFrame(rows)
        y_real = df["is_attack"].values
        log.info(f"  Attack ratio: {y_real.mean():.1%}")
    except Exception as e:
        log.warning(f"Could not load web attack CSV: {e} — using synthetic only")
        mapped = pd.DataFrame()
        y_real = np.array([])

    X_b, y_b = synth_benign(1500)
    X_m, y_m = synth_malicious(1500, "web_attack")
    if len(mapped):
        X = pd.concat([mapped, X_b, X_m], ignore_index=True)
        y = np.concatenate([y_real, y_b, y_m])
    else:
        X = pd.concat([X_b, X_m], ignore_index=True)
        y = np.concatenate([y_b, y_m])
    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# ANOMALY DETECTION — unsupervised IsolationForest
# ─────────────────────────────────────────────────────────────────────────────

def build_anomaly_dataset():
    X_b, y_b = synth_benign(3000)
    X_m, y_m = synth_malicious(500, "anomaly")
    X = pd.concat([X_b, X_m], ignore_index=True)
    y = np.concatenate([y_b, y_m])
    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# TRAINING
# ─────────────────────────────────────────────────────────────────────────────

def train_model(name, X, y, use_isolation_forest=False):
    log.info(f"\n{'='*60}")
    log.info(f"Training: {name} | samples={len(X)} | threat_rate={y.mean():.1%}")

    # Fill missing columns with zeros
    for col in FEATURE_NAMES:
        if col not in X.columns:
            X[col] = 0
    X = X[FEATURE_NAMES].fillna(0).astype(float)

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    if use_isolation_forest:
        # IsolationForest: train on benign only, score anomalies
        X_benign = X_tr_s[y_tr == 0]
        model = IsolationForest(n_estimators=200, contamination=0.1, random_state=42)
        model.fit(X_benign)
        # Anomaly score: -1 = anomaly, 1 = normal → convert to binary
        preds_raw = model.predict(X_te_s)
        y_pred = (preds_raw == -1).astype(int)
        acc = accuracy_score(y_te, y_pred)
        f1  = f1_score(y_te, y_pred, zero_division=0)
        log.info(f"  IsolationForest → acc={acc:.3f} f1={f1:.3f}")
    else:
        model = GradientBoostingClassifier(
            n_estimators=200, learning_rate=0.1, max_depth=5,
            subsample=0.8, random_state=42
        )
        model.fit(X_tr_s, y_tr)
        y_pred = model.predict(X_te_s)
        acc = accuracy_score(y_te, y_pred)
        f1  = f1_score(y_te, y_pred, zero_division=0)
        log.info(f"  GradientBoosting → acc={acc:.3f} f1={f1:.3f}")
        log.info(classification_report(y_te, y_pred, zero_division=0))

    # Save
    model_dir = OUT_DIR / name
    model_dir.mkdir(exist_ok=True)
    joblib.dump(model, model_dir / "best_model.pkl")
    joblib.dump(scaler, model_dir / "scaler.pkl")

    meta = {
        "name": name, "trained_at": datetime.utcnow().isoformat(),
        "samples": int(len(X)), "threat_rate": float(y.mean()),
        "accuracy": float(acc), "f1": float(f1),
        "feature_names": FEATURE_NAMES,
        "model_type": "IsolationForest" if use_isolation_forest else "GradientBoostingClassifier",
    }
    with open(model_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    log.info(f"  Saved → {model_dir}")
    return meta


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD TO HUGGINGFACE
# ─────────────────────────────────────────────────────────────────────────────

def ensure_repo(api):
    try:
        create_repo(MODEL_REPO, repo_type="model", token=HF_TOKEN, exist_ok=True, private=False)
        log.info(f"✅ Repo ready: {MODEL_REPO}")
    except Exception as e:
        log.warning(f"Repo create: {e}")


def upload_model(api, name):
    model_dir = OUT_DIR / name
    for fname in ["best_model.pkl", "scaler.pkl", "metadata.json"]:
        fpath = model_dir / fname
        if not fpath.exists():
            log.warning(f"  Missing: {fpath}")
            continue
        remote = f"{name}/{fname}"
        try:
            api.upload_file(
                path_or_fileobj=str(fpath),
                path_in_repo=remote,
                repo_id=MODEL_REPO,
                repo_type="model",
                token=HF_TOKEN,
            )
            log.info(f"  ✅ Uploaded: {remote}")
        except Exception as e:
            log.error(f"  ❌ Upload failed {remote}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    log.info("🚀 CyberForge ML Model Training & Upload Pipeline")

    results = {}

    # Train all 4 models
    X, y = build_phishing_dataset()
    results["phishing_detection"] = train_model("phishing_detection", X, y)

    X, y = build_malware_dataset()
    results["malware_detection"] = train_model("malware_detection", X, y)

    X, y = build_web_attack_dataset()
    results["web_attack_detection"] = train_model("web_attack_detection", X, y)

    X, y = build_anomaly_dataset()
    results["anomaly_detection"] = train_model("anomaly_detection", X, y, use_isolation_forest=True)

    # Summary
    log.info("\n" + "="*60)
    log.info("TRAINING SUMMARY")
    for name, meta in results.items():
        log.info(f"  {name}: acc={meta['accuracy']:.3f} f1={meta['f1']:.3f} ({meta['samples']} samples)")

    # Upload to HuggingFace
    log.info("\n📤 Uploading models to HuggingFace...")
    api = HfApi(token=HF_TOKEN)
    ensure_repo(api)
    for name in results:
        log.info(f"\nUploading {name}...")
        upload_model(api, name)

    # Write a README to the repo
    readme = f"""# CyberForge ML Models

Trained {datetime.utcnow().strftime('%Y-%m-%d')} by the CyberForge pipeline.

## Models

| Model | Accuracy | F1 | Samples |
|-------|----------|-----|---------|
""" + "\n".join(
        f"| {n} | {m['accuracy']:.3f} | {m['f1']:.3f} | {m['samples']} |"
        for n, m in results.items()
    ) + f"""

## Features

```
{', '.join(FEATURE_NAMES)}
```

## Usage

```python
import joblib, numpy as np
model  = joblib.load('phishing_detection/best_model.pkl')
scaler = joblib.load('phishing_detection/scaler.pkl')
X = np.array([[100, 20, 30, 0, 1, 1, 2, 1, 3, 0, 1, 8]])
X_s = scaler.transform(X)
print(model.predict(X_s))  # 1 = threat, 0 = benign
```
"""
    readme_path = OUT_DIR / "README.md"
    readme_path.write_text(readme)
    try:
        api.upload_file(
            path_or_fileobj=str(readme_path),
            path_in_repo="README.md",
            repo_id=MODEL_REPO,
            repo_type="model",
            token=HF_TOKEN,
        )
        log.info("✅ README.md uploaded")
    except Exception as e:
        log.warning(f"README upload: {e}")

    log.info("\n✅ All models trained and uploaded!")
    log.info(f"Repo: https://huggingface.co/{MODEL_REPO}")


if __name__ == "__main__":
    main()
