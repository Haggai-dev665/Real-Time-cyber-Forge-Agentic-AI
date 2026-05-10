"""
CyberForge AI - ML Training & Inference Platform
Hugging Face Spaces deployment with:
  1) Gradio UI for notebook execution, training, and inference
  2) FastAPI REST endpoints for the Heroku backend (mlService.js)
"""

import gradio as gr
import pandas as pd
import numpy as np
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urlparse

# ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
import joblib

# Hugging Face Hub
from huggingface_hub import HfApi, hf_hub_download, upload_file

# FastAPI for REST endpoints
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Gemini AI  (new SDK: google-genai)
try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

APP_DIR = Path(__file__).parent.absolute()
MODELS_DIR = APP_DIR / "trained_models"
MODELS_DIR.mkdir(exist_ok=True)
DATASETS_DIR = APP_DIR / "datasets"
DATASETS_DIR.mkdir(exist_ok=True)
NOTEBOOKS_DIR = APP_DIR / "notebooks"
KNOWLEDGE_BASE_DIR = APP_DIR / "knowledge_base"
KNOWLEDGE_BASE_DIR.mkdir(exist_ok=True)
TRAINING_DATA_DIR = APP_DIR / "training_data"
TRAINING_DATA_DIR.mkdir(exist_ok=True)

# Environment
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_MODEL_REPO = os.environ.get("HF_MODEL_REPO", "Che237/cyberforge-models")

logger.info(f"APP_DIR: {APP_DIR}")
logger.info(f"NOTEBOOKS_DIR: {NOTEBOOKS_DIR}")
logger.info(f"NOTEBOOKS_DIR exists: {NOTEBOOKS_DIR.exists()}")

# Model types available for training
MODEL_TYPES = {
    "Random Forest": RandomForestClassifier,
    "Gradient Boosting": GradientBoostingClassifier,
    "Logistic Regression": LogisticRegression,
    "Isolation Forest (Anomaly)": IsolationForest,
}

SECURITY_TASKS = [
    "Malware Detection", "Phishing Detection", "Network Intrusion Detection",
    "Anomaly Detection", "Botnet Detection", "Web Attack Detection",
    "Spam Detection", "Vulnerability Assessment", "DNS Tunneling Detection",
    "Cryptomining Detection",
]


# ============================================================================
# GEMINI SERVICE  (for REST API)
# ============================================================================

class GeminiService:
    """Google Gemini AI for cybersecurity chat and analysis"""

    SYSTEM_PROMPT = """You are CyberForge AI, an advanced cybersecurity expert. You specialize in:
- Real-time threat detection and analysis
- Malware and phishing identification
- Network security assessment
- Browser security monitoring
- Risk assessment and mitigation

When analyzing security queries, provide:
1. Risk Level (Critical/High/Medium/Low)
2. Threat Types identified
3. Confidence Score (0.0-1.0)
4. Detailed technical analysis
5. Specific actionable recommendations

Always be precise, professional, and actionable."""

    def __init__(self):
        self.client = None
        self.ready = False
        self.custom_knowledge = {}
        self.training_examples = []

    def initialize(self):
        if not GEMINI_AVAILABLE:
            logger.warning("google-genai not installed, Gemini unavailable")
            return
        if not GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not set, Gemini unavailable")
            return
        try:
            self.client = genai.Client(api_key=GEMINI_API_KEY)
            resp = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents="Test. Respond with OK."
            )
            if resp.text:
                self.ready = True
                logger.info(f"✅ Gemini initialized (model: {GEMINI_MODEL})")
            self._load_knowledge()
        except Exception as e:
            logger.error(f"❌ Gemini init failed: {e}")
            self.ready = False

    def _load_knowledge(self):
        try:
            for f in KNOWLEDGE_BASE_DIR.glob("*.json"):
                with open(f) as fh:
                    self.custom_knowledge[f.stem] = json.load(fh)
            logger.info(f"Loaded {len(self.custom_knowledge)} knowledge files")
        except Exception as e:
            logger.warning(f"Knowledge load error: {e}")
        try:
            for f in TRAINING_DATA_DIR.glob("*.json"):
                with open(f) as fh:
                    data = json.load(fh)
                    if isinstance(data, list):
                        self.training_examples.extend(data)
                    else:
                        self.training_examples.append(data)
            logger.info(f"Loaded {len(self.training_examples)} training examples")
        except Exception as e:
            logger.warning(f"Training data load error: {e}")

    def analyze(self, query: str, context: Dict = None, history: List = None) -> Dict:
        if not self.ready:
            return self._fallback(query)
        try:
            knowledge_str = json.dumps(self.custom_knowledge, indent=1)[:2000] if self.custom_knowledge else "None"
            examples_str = "\n".join(
                f"Q: {ex.get('input','')}\nA: {ex.get('output','')}"
                for ex in self.training_examples[-3:]
            ) if self.training_examples else "None"
            context_str = f"\nCONTEXT:\n{json.dumps(context, indent=1)[:3000]}\n" if context else ""

            prompt = f"""{self.SYSTEM_PROMPT}

KNOWLEDGE BASE (summary):
{knowledge_str}

TRAINING EXAMPLES:
{examples_str}
{context_str}
USER QUERY:
{query}

Provide a comprehensive cybersecurity analysis:"""

            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config={"temperature": 0.3, "max_output_tokens": 2048},
            )
            text = response.text if response.text else "No response generated"
            text_lower = text.lower()
            if "critical" in text_lower:
                risk_level, risk_score = "Critical", 9.0
            elif "high" in text_lower:
                risk_level, risk_score = "High", 7.0
            elif "medium" in text_lower:
                risk_level, risk_score = "Medium", 5.0
            else:
                risk_level, risk_score = "Low", 3.0

            return {
                "response": text,
                "confidence": 0.85,
                "risk_level": risk_level,
                "risk_score": risk_score,
                "insights": [f"Analysis performed by Gemini ({GEMINI_MODEL})"],
                "recommendations": [],
                "model_used": GEMINI_MODEL,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Gemini analysis error: {e}")
            return self._fallback(query)

    def _fallback(self, query: str) -> Dict:
        """ML-powered analysis when Gemini is unavailable"""
        import re
        global ml_loader

        url_pattern = re.compile(r'https?://[^\s"\'<>]+')
        urls = url_pattern.findall(query)

        risk_level = "Unknown"
        risk_score = 0.0
        insights = []
        response_lines = ["## CyberForge ML Security Analysis\n"]

        try:
            loader = ml_loader
            n_loaded = len(loader.models)
        except Exception:
            loader = None
            n_loaded = 0

        if urls and loader and n_loaded > 0:
            threat_models_fired = []
            all_scores = []

            for url in urls[:3]:
                features = extract_url_features(url)
                url_threats = []
                url_scores = []

                for model_name in ["phishing_detection", "malware_detection", "web_attack_detection"]:
                    pred = loader.predict(model_name, features)
                    if pred.get("prediction", 0) == 1:
                        label = model_name.replace("_detection", "").replace("_", " ").title()
                        url_threats.append(label)
                        url_scores.append(pred.get("confidence", 0.5))
                        threat_models_fired.append(model_name)

                avg = sum(url_scores) / len(url_scores) if url_scores else 0.15
                all_scores.append(avg)
                lvl = "HIGH" if avg > 0.6 else "MEDIUM" if avg > 0.35 else "LOW"
                threats_str = ", ".join(url_threats) if url_threats else "None detected"
                display_url = url if len(url) <= 70 else url[:67] + "..."
                response_lines.append(f"**URL:** `{display_url}`")
                response_lines.append(f"- Risk: **{lvl}** | Threats: {threats_str} | Score: {avg:.0%}\n")

            overall = sum(all_scores) / len(all_scores) if all_scores else 0.2
            if overall > 0.65:
                risk_level, risk_score = "High", 7.5
            elif overall > 0.4:
                risk_level, risk_score = "Medium", 5.0
            else:
                risk_level, risk_score = "Low", 2.5

            insights = [f"{n_loaded} ML models active"] + [
                f"Threat model triggered: {m.replace('_detection', '').replace('_', ' ').title()}"
                for m in set(threat_models_fired)
            ]

            if risk_level == "High":
                response_lines.append("### Recommendation\n⚠️ **Block immediately.** Phishing or malware indicators detected — do not visit this URL.")
            elif risk_level == "Medium":
                response_lines.append("### Recommendation\n⚡ **Exercise caution.** Validate with additional threat intelligence before accessing.")
            else:
                response_lines.append("### Recommendation\n✅ **URL appears structurally safe** based on ML analysis.")

        else:
            query_lower = query.lower()
            malware_kws = ["malware", "virus", "ransomware", "trojan", "spyware", "backdoor", "worm"]
            phishing_kws = ["phishing", "credential", "fake login", "spoof", "scam", "social engineering"]
            safe_kws = ["safe", "legitimate", "trusted", "secure", "verify"]

            if any(k in query_lower for k in malware_kws):
                risk_level, risk_score = "High", 7.0
                response_lines.append(
                    "**Malware indicators detected in your query.**\n\n"
                    "Recommended actions:\n"
                    "- Isolate the affected system immediately\n"
                    "- Run a full endpoint detection scan\n"
                    "- Review recently installed software and browser extensions\n"
                    "- Check startup processes and scheduled tasks for persistence\n"
                    "- Rotate credentials if any exposure is suspected"
                )
            elif any(k in query_lower for k in phishing_kws):
                risk_level, risk_score = "High", 7.0
                response_lines.append(
                    "**Phishing threat indicators detected.**\n\n"
                    "Recommended actions:\n"
                    "- Do not submit credentials to the suspected site\n"
                    "- Verify sender identity through a secondary channel\n"
                    "- Report to your IT security team immediately\n"
                    "- Enable MFA on all accounts that may be affected\n"
                    "- Review email headers for spoofing indicators"
                )
            elif any(k in query_lower for k in safe_kws):
                risk_level, risk_score = "Low", 2.0
                response_lines.append("No immediate threat indicators detected. Continue standard monitoring procedures.")
            else:
                response_lines.append(
                    f"CyberForge ML is operational with **{n_loaded}/4 models** loaded.\n\n"
                    "For best results, include a URL or specific threat indicators in your query.\n\n"
                    "**Available analysis capabilities:**\n"
                    "- URL threat analysis (phishing, malware, web attacks)\n"
                    "- Network anomaly detection\n"
                    "- Real-time threat event monitoring\n\n"
                    "*AI chat (Gemini) is currently unavailable. Provide a URL for full ML-based analysis.*"
                )
            insights = [f"{n_loaded} ML models active"]

        response_lines.append("\n---\n*Powered by CyberForge ML models — Gemini AI offline.*")

        return {
            "response": "\n".join(response_lines),
            "confidence": 0.65 if urls else 0.4,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "insights": insights,
            "recommendations": [],
            "model_used": "cyberforge-ml-fallback",
            "timestamp": datetime.utcnow().isoformat(),
        }


# Singleton
gemini_service = GeminiService()


# ============================================================================
# ML MODEL LOADER  (loads .pkl from HF Hub for REST predictions)
# ============================================================================

class MLModelLoader:
    MODEL_NAMES = [
        "phishing_detection", "malware_detection",
        "anomaly_detection", "web_attack_detection",
    ]

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, Any] = {}
        self.ready = False

    def initialize(self):
        loaded = 0
        # All directories where models might exist (notebooks save to ../models)
        search_dirs = [
            MODELS_DIR,                          # trained_models/
            APP_DIR / "models",                  # models/ (where notebooks output)
            APP_DIR.parent / "models",           # one level up fallback
        ]

        for name in self.MODEL_NAMES:
            if name in self.models:
                continue
            try:
                # 1. Try HuggingFace Hub first
                model_file = f"{name}/best_model.pkl"
                scaler_file = f"{name}/scaler.pkl"
                try:
                    model_path = hf_hub_download(
                        repo_id=HF_MODEL_REPO, filename=model_file,
                        token=HF_TOKEN or None, cache_dir=str(MODELS_DIR),
                    )
                    scaler_path = hf_hub_download(
                        repo_id=HF_MODEL_REPO, filename=scaler_file,
                        token=HF_TOKEN or None, cache_dir=str(MODELS_DIR),
                    )
                    self.models[name] = joblib.load(model_path)
                    self.scalers[name] = joblib.load(scaler_path)
                    loaded += 1
                    logger.info(f"✅ Loaded model from Hub: {name}")
                    continue
                except Exception:
                    pass

                # 2. Try all local search directories
                for sdir in search_dirs:
                    if name in self.models:
                        break
                    for model_fname in [f"{name}/best_model.pkl", f"{name}/model.pkl", f"{name}_model.pkl"]:
                        candidate = sdir / model_fname
                        if candidate.exists():
                            self.models[name] = joblib.load(candidate)
                            # Try to find matching scaler
                            for scaler_fname in [f"{name}/scaler.pkl", f"{name}_scaler.pkl"]:
                                sc = sdir / scaler_fname
                                if sc.exists():
                                    self.scalers[name] = joblib.load(sc)
                                    break
                            loaded += 1
                            logger.info(f"✅ Loaded model from {sdir.name}/{model_fname}: {name}")
                            break

            except Exception as e:
                logger.warning(f"Error loading model {name}: {e}")

        # Sweep all search dirs for any .pkl files not yet loaded
        for sdir in search_dirs:
            if not sdir.exists():
                continue
            for pkl in sdir.glob("*.pkl"):
                stem = pkl.stem.replace("_model", "").replace("_best", "")
                if stem not in self.models:
                    try:
                        self.models[stem] = joblib.load(pkl)
                        loaded += 1
                        logger.info(f"✅ Loaded model sweep: {stem} from {sdir.name}")
                    except Exception:
                        pass

        self.ready = loaded > 0
        logger.info(f"ML Models: {loaded} loaded — {list(self.models.keys())}")

    def predict(self, model_name: str, features: Dict) -> Dict:
        if model_name not in self.models:
            return self._heuristic_predict(model_name, features)
        try:
            model = self.models[model_name]
            scaler = self.scalers.get(model_name)
            X = np.array([list(features.values())])
            if scaler:
                X = scaler.transform(X)
            prediction = int(model.predict(X)[0])
            confidence = 0.5
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X)[0]
                confidence = float(max(proba))
            return {
                "model": model_name,
                "prediction": prediction,
                "prediction_label": "threat" if prediction == 1 else "benign",
                "confidence": confidence,
                "inference_source": "ml_model",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Prediction error {model_name}: {e}")
            return self._heuristic_predict(model_name, features)

    def _heuristic_predict(self, model_name: str, features: Dict) -> Dict:
        score = 0.0
        reasons = []
        is_https = features.get("is_https", features.get("has_https", 1))
        has_ip = features.get("has_ip_address", 0)
        suspicious_tld = features.get("has_suspicious_tld", 0)
        url_length = features.get("url_length", 0)
        special_chars = features.get("special_char_count", 0)
        if not is_https:
            score += 0.3; reasons.append("No HTTPS")
        if has_ip:
            score += 0.25; reasons.append("IP address in URL")
        if suspicious_tld:
            score += 0.2; reasons.append("Suspicious TLD")
        if url_length > 100:
            score += 0.15; reasons.append("Very long URL")
        if special_chars > 10:
            score += 0.1; reasons.append("Many special characters")
        is_threat = score >= 0.5
        return {
            "model": model_name,
            "prediction": 1 if is_threat else 0,
            "prediction_label": "threat" if is_threat else "benign",
            "confidence": min(score + 0.3, 0.95) if is_threat else max(0.6, 1.0 - score),
            "threat_score": score,
            "reasons": reasons,
            "inference_source": "heuristic",
            "timestamp": datetime.utcnow().isoformat(),
        }


ml_loader = MLModelLoader()


# ============================================================================
# URL FEATURE EXTRACTION
# ============================================================================

def extract_url_features(url: str) -> Dict:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    return {
        "url_length": len(url),
        "hostname_length": len(hostname),
        "path_length": len(parsed.path or ""),
        "is_https": 1 if parsed.scheme == "https" else 0,
        "has_ip_address": 1 if all(p.isdigit() for p in hostname.split(".")) and len(hostname.split(".")) == 4 else 0,
        "has_suspicious_tld": 1 if any(hostname.endswith(t) for t in [".xyz", ".tk", ".ml", ".ga", ".cf", ".top", ".buzz"]) else 0,
        "subdomain_count": max(0, len(hostname.split(".")) - 2),
        "has_port": 1 if parsed.port else 0,
        "query_params_count": len(parsed.query.split("&")) if parsed.query else 0,
        "has_at_symbol": 1 if "@" in url else 0,
        "has_double_slash": 1 if "//" in (parsed.path or "") else 0,
        "special_char_count": sum(1 for c in url if c in "!@#$%^&*()+={}[]|\\:;<>?,"),
    }


# ============================================================================
# TRANSFORMER MODEL LOADER  (Phase 3 — real HF transformer models)
# ============================================================================
#
# Loads pretrained BERT-based classifiers from the Hugging Face Hub.
# Models are loaded lazily on first request to keep cold-start fast.
# A 7B Security LLM is NOT loaded locally (too big for free tier) —
# it's accessed via the HF Inference API on demand.

class TransformerModelLoader:
    """Loads pretrained Transformer classifiers from the HF Hub on demand."""

    # Model registry — name → HF repo + task description
    # NOTE: DGA detector uses an inline entropy heuristic, not a transformer
    #       (YangYang-Research/dga-detection has a non-standard model config that
    #       isn't loadable via transformers.pipeline()).
    REGISTRY = {
        "url_phishing_bert": {
            "repo":  "elftsdmr/malware-url-detect",
            "task":  "text-classification",
            "labels": ["benign", "malicious"],
            "desc":  "BERT-based URL phishing/malware classifier",
        },
    }
    # Model used via HF Inference API. ZySec-AI/SecurityLLM isn't served on the
    # free Inference API tier (404). Mistral-7B-Instruct-v0.3 is widely available
    # and works well for cyber Q&A. Override via SECURITY_LLM_MODEL env var.
    SECURITY_LLM_REPO = os.environ.get("SECURITY_LLM_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")

    def __init__(self):
        self.pipelines = {}     # name → transformers.Pipeline (lazy-loaded)
        self.load_errors = {}   # name → last error message
        self.transformers_available = False
        try:
            import transformers  # noqa: F401
            import torch         # noqa: F401
            self.transformers_available = True
            logger.info("✅ transformers + torch available")
        except ImportError as e:
            logger.warning(f"⚠️ transformers/torch not installed: {e}")

    def _ensure(self, name: str):
        """Load a pipeline on first use. Returns the pipeline or None on failure."""
        if name in self.pipelines:
            return self.pipelines[name]
        if not self.transformers_available:
            self.load_errors[name] = "transformers/torch not installed"
            return None
        if name not in self.REGISTRY:
            self.load_errors[name] = f"Unknown model: {name}"
            return None
        spec = self.REGISTRY[name]
        try:
            from transformers import pipeline
            logger.info(f"⏳ Loading {name} from {spec['repo']}...")
            pipe = pipeline(spec["task"], model=spec["repo"], device=-1, top_k=None)
            self.pipelines[name] = pipe
            logger.info(f"✅ Loaded {name}")
            return pipe
        except Exception as e:
            err = f"{type(e).__name__}: {str(e)[:200]}"
            self.load_errors[name] = err
            logger.error(f"❌ Failed to load {name}: {err}")
            return None

    def predict_url_phishing(self, url: str) -> Dict:
        """Classify a URL as benign or malicious using elftsdmr/malware-url-detect."""
        pipe = self._ensure("url_phishing_bert")
        if pipe is None:
            return self._unavailable("url_phishing_bert")
        try:
            # Strip the protocol — model was trained on bare URLs
            text = url.replace("https://", "").replace("http://", "")[:512]
            result = pipe(text)
            scores = result[0] if isinstance(result[0], list) else result
            return self._format_classification(scores, "url_phishing_bert")
        except Exception as e:
            return self._error("url_phishing_bert", e)

    def predict_dga(self, domain: str) -> Dict:
        """Detect DGA-generated domains using a Shannon-entropy + character-pattern heuristic.
        Real DGA domains have high entropy, low pronounceability, no real word substrings."""
        import math
        d = domain.lower().strip().split('.')[0][:60]  # SLD only, ignore TLD
        if not d:
            return {"model": "dga_detector", "error": "empty domain"}
        # Shannon entropy of character distribution
        from collections import Counter
        freq = Counter(d)
        n = len(d)
        entropy = -sum((c / n) * math.log2(c / n) for c in freq.values())
        # Vowel ratio — DGAs typically have very few vowels
        vowels = sum(1 for c in d if c in 'aeiou')
        vowel_ratio = vowels / n if n else 0
        # Digit ratio — DGAs often mix digits in
        digits = sum(1 for c in d if c.isdigit())
        digit_ratio = digits / n if n else 0
        # Length signal — DGAs are usually 10-25 chars
        length_signal = 1.0 if 12 <= n <= 30 else 0.5 if 8 <= n <= 40 else 0.2
        # Consonant runs — DGAs often have 4+ consonants in a row
        max_consonant_run = 0
        run = 0
        for c in d:
            if c.isalpha() and c not in 'aeiou':
                run += 1
                max_consonant_run = max(max_consonant_run, run)
            else:
                run = 0
        # Score combination — empirically tuned thresholds
        score = 0.0
        if entropy > 3.5: score += 0.35
        if vowel_ratio < 0.25: score += 0.20
        if digit_ratio > 0.15: score += 0.15
        if max_consonant_run >= 4: score += 0.20
        score *= length_signal
        score = min(1.0, score)
        is_dga = score >= 0.45
        return {
            "model":           "dga_detector",
            "prediction":      "dga" if is_dga else "legit",
            "is_threat":       is_dga,
            "confidence":      round(score * 100, 2) if is_dga else round((1 - score) * 100, 2),
            "threat_score":    round(score, 4),
            "features": {
                "entropy":            round(entropy, 3),
                "vowel_ratio":        round(vowel_ratio, 3),
                "digit_ratio":        round(digit_ratio, 3),
                "max_consonant_run":  max_consonant_run,
                "length":             n,
            },
            "inference_source": "entropy-heuristic",
        }

    def security_chat(self, query: str, max_tokens: int = 512) -> Dict:
        """Cybersecurity Q&A via ZySec-AI/SecurityLLM hosted on HF Inference API.
        Falls back to Gemini when the LLM is rate-limited or HF token is missing."""
        if not HF_TOKEN:
            return {
                "model": "security-llm",
                "response": None,
                "error": "HF_TOKEN env var required to call ZySec-AI/SecurityLLM via Inference API",
                "fallback_available": gemini_service.ready,
            }
        try:
            import requests
            url = f"https://api-inference.huggingface.co/models/{self.SECURITY_LLM_REPO}"
            headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}
            payload = {
                "inputs": query[:2000],
                "parameters": {"max_new_tokens": max_tokens, "temperature": 0.3, "return_full_text": False},
                "options": {"wait_for_model": True},
            }
            r = requests.post(url, headers=headers, json=payload, timeout=45)
            if r.status_code == 200:
                data = r.json()
                text = data[0].get("generated_text") if isinstance(data, list) and data else (data.get("generated_text") if isinstance(data, dict) else str(data))
                return {
                    "model":    "security-llm",
                    "source":   "huggingface_inference_api",
                    "response": text,
                    "model_id": self.SECURITY_LLM_REPO,
                }
            return {
                "model":  "security-llm",
                "error":  f"HF Inference API HTTP {r.status_code}: {r.text[:200]}",
                "fallback_available": gemini_service.ready,
            }
        except Exception as e:
            return {
                "model":  "security-llm",
                "error":  f"{type(e).__name__}: {str(e)[:200]}",
                "fallback_available": gemini_service.ready,
            }

    def status(self) -> Dict:
        return {
            "transformers_available": self.transformers_available,
            "loaded": list(self.pipelines.keys()),
            "available": list(self.REGISTRY.keys()) + ["security_llm (via HF Inference API)"],
            "load_errors": self.load_errors,
        }

    @staticmethod
    def _format_classification(scores, model_name) -> Dict:
        """Normalize HF text-classification output to the cyberforge schema."""
        if not scores:
            return {"model": model_name, "error": "Empty scores"}
        # scores is a list of {label, score} dicts. Find the threat label.
        threat_labels = {"malicious", "phishing", "malware", "dga", "label_1", "1"}
        # Top prediction
        top = max(scores, key=lambda s: s["score"]) if isinstance(scores, list) else scores
        is_threat = str(top["label"]).lower() in threat_labels
        # Threat score: probability of the threat class (not just the top class)
        threat_score = top["score"] if is_threat else 1.0 - top["score"]
        return {
            "model":           model_name,
            "prediction":      top["label"],
            "is_threat":       is_threat,
            "confidence":      round(top["score"] * 100, 2),
            "threat_score":    round(threat_score, 4),
            "all_scores":      scores,
            "inference_source": "huggingface_transformer",
        }

    @staticmethod
    def _unavailable(model_name) -> Dict:
        return {"model": model_name, "error": "Model unavailable — see /api/v2/status"}

    @staticmethod
    def _error(model_name, e: Exception) -> Dict:
        return {"model": model_name, "error": f"{type(e).__name__}: {str(e)[:200]}"}


transformer_loader = TransformerModelLoader()


# ============================================================================
# NOTEBOOK EXECUTION  (existing Gradio functionality)
# ============================================================================

def get_available_notebooks() -> List[str]:
    if not NOTEBOOKS_DIR.exists():
        return []
    return sorted([f.name for f in NOTEBOOKS_DIR.glob("*.ipynb")])


def read_notebook_content(notebook_name: str) -> str:
    """Read and display notebook content as markdown"""
    notebook_path = NOTEBOOKS_DIR / notebook_name
    if not notebook_path.exists():
        return f"Notebook not found: {notebook_name}"
    try:
        with open(notebook_path, "r") as f:
            nb = json.load(f)
        output = f"# {notebook_name}\n\n"
        for i, cell in enumerate(nb.get("cells", []), 1):
            cell_type = cell.get("cell_type", "code")
            source = "".join(cell.get("source", []))
            if cell_type == "markdown":
                output += f"{source}\n\n"
            else:
                output += f"### Cell {i} (Python)\n```python\n{source}\n```\n\n"
        return output
    except Exception as e:
        return f"Error reading notebook: {str(e)}"


def execute_notebook(notebook_name: str, progress=gr.Progress()) -> Tuple[str, str]:
    """Execute a notebook and return output"""
    notebook_path = NOTEBOOKS_DIR / notebook_name
    output_path = NOTEBOOKS_DIR / f"output_{notebook_name}"
    if not notebook_path.exists():
        available = list(NOTEBOOKS_DIR.glob("*.ipynb")) if NOTEBOOKS_DIR.exists() else []
        return f"Error: Notebook not found: {notebook_path}\nAvailable: {available}", ""
    progress(0.1, desc="Starting notebook execution...")
    try:
        cmd = [
            sys.executable, "-m", "nbconvert",
            "--to", "notebook", "--execute",
            "--output", str(output_path.absolute()),
            "--ExecutePreprocessor.timeout=600",
            "--ExecutePreprocessor.kernel_name=python3",
            str(notebook_path.absolute()),
        ]
        progress(0.3, desc="Executing cells...")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(NOTEBOOKS_DIR), timeout=900)
        progress(0.8, desc="Processing output...")
        if result.returncode == 0:
            if output_path.exists():
                with open(output_path, "r") as f:
                    executed_nb = json.load(f)
                outputs = []
                for i, cell in enumerate(executed_nb.get("cells", []), 1):
                    if cell.get("cell_type") == "code":
                        for out in cell.get("outputs", []):
                            if "text" in out:
                                outputs.append(f"Cell {i}:\n{''.join(out['text'])}")
                            elif "data" in out and "text/plain" in out["data"]:
                                outputs.append(f"Cell {i}:\n{''.join(out['data']['text/plain'])}")
                progress(1.0, desc="Complete!")
                return "Notebook executed successfully!", "\n\n".join(outputs)
            else:
                return "Notebook executed but output file not found", result.stdout
        else:
            return f"Execution failed:\n{result.stderr}", result.stdout
    except subprocess.TimeoutExpired:
        return "Error: Notebook execution timed out (15 min limit)", ""
    except Exception as e:
        return f"Error executing notebook: {str(e)}", ""


def run_notebook_cell(notebook_name: str, cell_number: int) -> str:
    """Execute a single cell from a notebook"""
    notebook_path = NOTEBOOKS_DIR / notebook_name
    if not notebook_path.exists():
        return f"Error: Notebook not found at {notebook_path}"
    try:
        original_cwd = os.getcwd()
        os.chdir(NOTEBOOKS_DIR)
        with open(notebook_path, "r") as f:
            nb = json.load(f)
        cells = [c for c in nb.get("cells", []) if c.get("cell_type") == "code"]
        if cell_number < 1 or cell_number > len(cells):
            os.chdir(original_cwd)
            return f"Error: Cell {cell_number} not found. Available: 1-{len(cells)}"
        cell = cells[int(cell_number) - 1]
        source = "".join(cell.get("source", []))
        import io
        from contextlib import redirect_stdout, redirect_stderr

        namespace = {"__name__": "__main__", "__file__": str(notebook_path)}
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            try:
                exec(source, namespace)
            except Exception as e:
                os.chdir(original_cwd)
                return f"Error: {str(e)}"
        os.chdir(original_cwd)
        output = stdout_capture.getvalue()
        errors = stderr_capture.getvalue()
        result_text = f"### Cell {int(cell_number)} Output:\n"
        if output:
            result_text += f"```\n{output}\n```\n"
        if errors:
            result_text += f"\n**Warnings/Errors:**\n```\n{errors}\n```"
        if not output and not errors:
            result_text += "*(No output)*"
        return result_text
    except Exception as e:
        try:
            os.chdir(original_cwd)
        except Exception:
            pass
        return f"Error: {str(e)}"


# ============================================================================
# MODEL TRAINING  (existing Gradio functionality)
# ============================================================================

class SecurityModelTrainer:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()

    def prepare_data(self, df: pd.DataFrame, target_col: str = "label") -> Tuple:
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found")
        X = df.drop(columns=[target_col])
        y = df[target_col]
        X = X.select_dtypes(include=[np.number]).fillna(0)
        if y.dtype == "object":
            y = self.label_encoder.fit_transform(y)
        X_scaled = self.scaler.fit_transform(X)
        return train_test_split(X_scaled, y, test_size=0.2, random_state=42)

    def train_model(self, model_type: str, X_train, y_train):
        if model_type not in MODEL_TYPES:
            raise ValueError(f"Unknown model type: {model_type}")
        model_class = MODEL_TYPES[model_type]
        if model_type == "Isolation Forest (Anomaly)":
            model = model_class(contamination=0.1, random_state=42)
        else:
            model = model_class(random_state=42)
        model.fit(X_train, y_train)
        return model

    def evaluate_model(self, model, X_test, y_test) -> Dict:
        y_pred = model.predict(X_test)
        return {
            "accuracy": accuracy_score(y_test, y_pred),
            "f1_score": f1_score(y_test, y_pred, average="weighted", zero_division=0),
        }


trainer = SecurityModelTrainer()


def train_model_from_data(data_file, model_type: str, task: str, progress=gr.Progress()):
    """Train model from uploaded data"""
    if data_file is None:
        return "Please upload a CSV file", None, None
    progress(0.1, desc="Loading data...")
    try:
        df = pd.read_csv(data_file.name)
        progress(0.3, desc="Preparing data...")
        X_train, X_test, y_train, y_test = trainer.prepare_data(df)
        progress(0.5, desc=f"Training {model_type}...")
        model = trainer.train_model(model_type, X_train, y_train)
        progress(0.8, desc="Evaluating model...")
        metrics = trainer.evaluate_model(model, X_test, y_test)
        model_name = f"{task.lower().replace(' ', '_')}_{model_type.lower().replace(' ', '_')}"
        model_path = MODELS_DIR / f"{model_name}.pkl"
        joblib.dump(model, model_path)
        progress(1.0, desc="Complete!")
        result = f"""
## Training Complete!

**Task:** {task}
**Model:** {model_type}
**Samples:** {len(df)}

### Metrics
- Accuracy: {metrics['accuracy']:.4f}
- F1 Score: {metrics['f1_score']:.4f}

**Model saved to:** {model_path}
"""
        return result, str(model_path), json.dumps(metrics, indent=2)
    except Exception as e:
        return f"Error: {str(e)}", None, None


def run_inference(model_file, features_text: str):
    """Run inference with a trained model"""
    if model_file is None:
        return "Please upload a model file"
    try:
        model = joblib.load(model_file.name)
        features = json.loads(features_text)
        X = np.array([list(features.values())])
        prediction = model.predict(X)[0]
        result = {"prediction": int(prediction), "features_used": len(features)}
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X)[0]
            result["confidence"] = float(max(proba))
            result["probabilities"] = {str(i): float(p) for i, p in enumerate(proba)}
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Error: {str(e)}"


def list_trained_models():
    models = list(MODELS_DIR.glob("*.pkl"))
    if not models:
        return "No trained models found"
    output = "## Trained Models\n\n"
    for model_path in models:
        size_kb = model_path.stat().st_size / 1024
        output += f"- **{model_path.name}** ({size_kb:.1f} KB)\n"
    return output


# ============================================================================
# FASTAPI APP  (REST endpoints for Heroku backend mlService.js)
# ============================================================================

api = FastAPI(title="CyberForge AI API", version="1.0.0")

api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@api.get("/health")
async def api_health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "gemini": gemini_service.ready,
            "ml_models": ml_loader.ready,
            "models_loaded": list(ml_loader.models.keys()),
            "gradio_ui": True,
        },
        "version": "1.0.0",
    }


@api.post("/analyze")
async def api_analyze(request: Request):
    """Main analysis endpoint – called by backend mlService.chatWithAI()"""
    body = await request.json()
    query = body.get("query", "")
    context = body.get("context", {})
    history = body.get("conversation_history", [])
    result = gemini_service.analyze(query, context, history)
    return result


@api.post("/analyze-url")
async def api_analyze_url(request: Request):
    """URL analysis – called by backend mlService.analyzeWebsite()"""
    body = await request.json()
    url = body.get("url", "")
    if not url:
        return JSONResponse(status_code=400, content={"detail": "URL required"})
    features = extract_url_features(url)
    predictions = {}
    for model_name in ml_loader.MODEL_NAMES:
        predictions[model_name] = ml_loader.predict(model_name, features)
    scores = [
        p.get("threat_score", p.get("confidence", 0.5) if p.get("prediction", 0) == 1 else 0.2)
        for p in predictions.values()
    ]
    avg_score = sum(scores) / len(scores) if scores else 0
    return {
        "url": url,
        "aggregate": {
            "average_threat_score": round(avg_score, 3),
            "overall_risk_level": (
                "critical" if avg_score > 0.8
                else "high" if avg_score > 0.6
                else "medium" if avg_score > 0.4
                else "low"
            ),
        },
        "model_predictions": predictions,
        "features_analyzed": features,
        "timestamp": datetime.utcnow().isoformat(),
    }


@api.post("/scan-threats")
async def api_scan_threats(request: Request):
    """Threat scanning – called by backend mlService.scanForThreats()"""
    body = await request.json()
    query = json.dumps(body.get("data", body), indent=1)[:3000]
    result = gemini_service.analyze(f"Scan these indicators for threats:\n{query}")
    return result


@api.post("/api/insights/generate")
async def api_generate_insights(request: Request):
    """AI insights – called by backend mlService.getAIInsights()"""
    body = await request.json()
    query = body.get("query", "")
    context = body.get("context", {})
    result = gemini_service.analyze(query, context)
    return {
        "insights": result.get("response", ""),
        "confidence": result.get("confidence", 0),
        "timestamp": datetime.utcnow().isoformat(),
    }


@api.post("/api/models/predict")
async def api_model_predict(request: Request):
    """Model prediction – called by backend mlService.getModelPrediction()"""
    body = await request.json()
    model_type = body.get("model_type", "phishing_detection")
    input_data = body.get("input_data", {})
    result = ml_loader.predict(model_type, input_data)
    return result


@api.get("/api/models/list")
@api.get("/models")
async def api_list_models():
    result = []
    for name in ml_loader.MODEL_NAMES:
        result.append({
            "name": name,
            "loaded": name in ml_loader.models,
            "source": "ml_model" if name in ml_loader.models else "heuristic",
        })
    return {"models": result, "total": len(ml_loader.MODEL_NAMES), "loaded": len(ml_loader.models)}


# ============================================================================
# PHASE-3 ENDPOINTS — Real HF Transformer models
# ============================================================================

@api.post("/api/v2/url-classify")
async def api_v2_url_classify(request: Request):
    """URL phishing/malware classification using elftsdmr/malware-url-detect (BERT).
    Body: { "url": "https://..." }"""
    body = await request.json()
    url = body.get("url", "").strip()
    if not url:
        return JSONResponse(status_code=400, content={"detail": "url required"})
    return transformer_loader.predict_url_phishing(url)


@api.post("/api/v2/dga-detect")
async def api_v2_dga_detect(request: Request):
    """DGA-generated domain detection using YangYang-Research/dga-detection.
    Body: { "domain": "abc123xyz.com" }"""
    body = await request.json()
    domain = body.get("domain", "").strip()
    if not domain:
        return JSONResponse(status_code=400, content={"detail": "domain required"})
    return transformer_loader.predict_dga(domain)


@api.post("/api/v2/security-chat")
async def api_v2_security_chat(request: Request):
    """Cybersecurity Q&A via ZySec-AI/SecurityLLM (HF Inference API).
    Body: { "query": "...", "max_tokens": 512 }"""
    body = await request.json()
    query = body.get("query", "").strip()
    if not query:
        return JSONResponse(status_code=400, content={"detail": "query required"})
    max_tokens = int(body.get("max_tokens", 512))
    result = transformer_loader.security_chat(query, max_tokens=max_tokens)
    # Auto-fallback to Gemini when LLM unavailable
    if result.get("error") and gemini_service.ready:
        gemini_result = gemini_service.analyze(query)
        gemini_result["source"] = "gemini-fallback"
        gemini_result["llm_error"] = result["error"]
        return gemini_result
    return result


@api.get("/api/v2/status")
async def api_v2_status():
    """Status of phase-3 transformer models — what's loaded, what failed, what's available."""
    return transformer_loader.status()


@api.post("/api/analysis/network")
async def api_analyze_network(request: Request):
    """Network traffic analysis – called by backend mlService.analyzeNetworkTraffic()"""
    body = await request.json()
    traffic_data = body.get("traffic_data", {})
    result = gemini_service.analyze(
        f"Analyze this network traffic for security threats:\n{json.dumps(traffic_data, indent=1)[:3000]}"
    )
    return result


@api.post("/api/ai/execute-task")
async def api_execute_task(request: Request):
    """AI task execution – called by backend mlService.executeAITask()"""
    body = await request.json()
    task_type = body.get("task_type", "")
    task_data = body.get("task_data", {})
    result = gemini_service.analyze(
        f"Execute cybersecurity task '{task_type}':\n{json.dumps(task_data, indent=1)[:3000]}"
    )
    return result


@api.post("/api/browser/analyze")
async def api_analyze_browser(request: Request):
    """Browser session analysis"""
    body = await request.json()
    session = body.get("session_data", body)
    result = gemini_service.analyze(
        f"Analyze this browser session for security threats:\n{json.dumps(session, indent=1)[:3000]}"
    )
    return result


@api.post("/api/threat-feeds/analyze")
async def api_analyze_threat_feed(request: Request):
    """Threat feed analysis"""
    body = await request.json()
    result = gemini_service.analyze(
        f"Analyze this threat feed:\n{json.dumps(body, indent=1)[:3000]}"
    )
    return result


@api.post("/api/datasets/process")
async def api_process_dataset(request: Request):
    body = await request.json()
    return {
        "status": "processed",
        "dataset_name": body.get("dataset_name", ""),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# GRADIO INTERFACE  (UI tabs – notebooks, training, inference, models, API)
# ============================================================================

def create_interface():
    with gr.Blocks(title="CyberForge AI") as demo:
        gr.Markdown("""
        # 🔐 CyberForge AI - ML Training Platform

        Train cybersecurity ML models and run Jupyter notebooks on Hugging Face.
        """)

        with gr.Tabs():
            # ============ NOTEBOOKS TAB ============
            with gr.TabItem("📓 Notebooks"):
                gr.Markdown("### Run ML Pipeline Notebooks\nExecute the CyberForge ML notebooks directly in the cloud.")
                with gr.Row():
                    with gr.Column(scale=1):
                        notebook_dropdown = gr.Dropdown(
                            choices=get_available_notebooks(),
                            label="Select Notebook",
                            value=get_available_notebooks()[0] if get_available_notebooks() else None,
                        )
                        refresh_btn = gr.Button("🔄 Refresh List")
                        view_btn = gr.Button("👁 View Content", variant="secondary")
                        execute_btn = gr.Button("▶ Execute Notebook", variant="primary")
                        gr.Markdown("### Run Single Cell")
                        cell_number = gr.Number(label="Cell Number", value=1, minimum=1)
                        run_cell_btn = gr.Button("Run Cell")
                    with gr.Column(scale=2):
                        notebook_status = gr.Markdown("Select a notebook to view or execute.")
                        notebook_output = gr.Markdown("", label="Output")

                def refresh_notebooks():
                    notebooks = get_available_notebooks()
                    return gr.update(choices=notebooks, value=notebooks[0] if notebooks else None)

                refresh_btn.click(refresh_notebooks, outputs=notebook_dropdown)
                view_btn.click(read_notebook_content, inputs=notebook_dropdown, outputs=notebook_output)
                execute_btn.click(execute_notebook, inputs=notebook_dropdown, outputs=[notebook_status, notebook_output])
                run_cell_btn.click(run_notebook_cell, inputs=[notebook_dropdown, cell_number], outputs=notebook_output)

            # ============ TRAIN MODEL TAB ============
            with gr.TabItem("🎯 Train Model"):
                gr.Markdown("### Train a Security ML Model\nUpload your dataset and train a model for threat detection.")
                with gr.Row():
                    with gr.Column():
                        task_dropdown = gr.Dropdown(choices=SECURITY_TASKS, label="Security Task", value="Phishing Detection")
                        model_dropdown = gr.Dropdown(choices=list(MODEL_TYPES.keys()), label="Model Type", value="Random Forest")
                        data_upload = gr.File(label="Upload Training Data (CSV)", file_types=[".csv"])
                        train_btn = gr.Button("🚀 Train Model", variant="primary")
                    with gr.Column():
                        train_output = gr.Markdown("Upload data and click Train to begin.")
                        model_path_output = gr.Textbox(label="Model Path", visible=False)
                        metrics_output = gr.Textbox(label="Metrics JSON", visible=False)
                train_btn.click(train_model_from_data, inputs=[data_upload, model_dropdown, task_dropdown], outputs=[train_output, model_path_output, metrics_output])

            # ============ INFERENCE TAB ============
            with gr.TabItem("🔍 Inference"):
                gr.Markdown("### Run Model Inference\nLoad a trained model and make predictions.")
                with gr.Row():
                    with gr.Column():
                        model_upload = gr.File(label="Upload Model (.pkl)")
                        features_input = gr.Textbox(label="Features (JSON)", value='{"url_length": 50, "has_https": 1, "digit_count": 5}', lines=5)
                        predict_btn = gr.Button("🎯 Predict", variant="primary")
                    with gr.Column():
                        prediction_output = gr.Textbox(label="Prediction Result", lines=10)
                predict_btn.click(run_inference, inputs=[model_upload, features_input], outputs=prediction_output)

            # ============ MODELS TAB ============
            with gr.TabItem("📦 Models"):
                gr.Markdown("### Trained Models")
                models_list = gr.Markdown(list_trained_models())
                refresh_models_btn = gr.Button("🔄 Refresh")
                refresh_models_btn.click(list_trained_models, outputs=models_list)

            # ============ API TAB ============
            with gr.TabItem("🔌 API"):
                gr.Markdown("""
## API Integration

### REST Endpoints (for Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/analyze` | AI chat (Gemini) |
| POST | `/analyze-url` | URL threat analysis |
| POST | `/scan-threats` | Threat scanning |
| POST | `/api/insights/generate` | AI insights |
| POST | `/api/models/predict` | ML model prediction |
| GET | `/models` | List available models |

### Example

```bash
curl -X POST https://che237-cyberforge.hf.space/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Is this URL safe: http://example.com/login"}'
```

### Gradio API

The Gradio interface also exposes API endpoints for notebook execution and model training.
See the API tab at the bottom of this page.
                """)

        gr.Markdown("---\n**CyberForge AI** | [GitHub](https://github.com/Che237/cyberforge) | [Datasets](https://huggingface.co/datasets/Che237/cyberforge-datasets)")

    return demo


# ============================================================================
# MAIN – Mount Gradio on FastAPI
# ============================================================================

# Initialize services at startup
logger.info("🚀 Initializing CyberForge AI services...")
gemini_service.initialize()
ml_loader.initialize()
logger.info("✅ Services initialized")

# Create Gradio app and mount it on FastAPI
demo = create_interface()
app = gr.mount_gradio_app(api, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
