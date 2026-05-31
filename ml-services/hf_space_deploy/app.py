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
            # Primary engine is DeepSeek (HF Inference Providers) now; Gemini retired.
            return self._reasoning_analyze(query, context)
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
            return self._reasoning_analyze(query, context)

    def _reasoning_analyze(self, query: str, context: Dict = None) -> Dict:
        """DeepSeek-backed structured analysis — the primary reasoning path now that
        Gemini is retired. Delegates to TransformerLoader.security_chat (DeepSeek via
        HF Inference Providers, Mistral fallback) and wraps the text into the
        structured shape the REST endpoints expect. Falls back to the ML heuristic
        (_fallback) only if the LLM is entirely unavailable."""
        tl = globals().get("transformer_loader")
        if tl is None:
            return self._fallback(query)
        ctx = f"\n\nCONTEXT:\n{json.dumps(context, indent=1)[:2000]}" if context else ""
        llm = tl.security_chat(f"{query}{ctx}", max_tokens=700)
        text = llm.get("response")
        if not text or llm.get("error"):
            return self._fallback(query)
        tlow = text.lower()
        if "critical" in tlow:
            risk_level, risk_score = "Critical", 9.0
        elif "high" in tlow:
            risk_level, risk_score = "High", 7.0
        elif "medium" in tlow:
            risk_level, risk_score = "Medium", 5.0
        else:
            risk_level, risk_score = "Low", 3.0
        model_id = llm.get("model_id", "deepseek")
        return {
            "response": text,
            "confidence": 0.82,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "insights": [f"Analysis by {model_id} via {llm.get('source', 'hf_inference_providers')}"],
            "recommendations": [],
            "model_used": model_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

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
            probabilities = {}
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X)[0]
                confidence = float(max(proba))
                probabilities = {str(i): round(float(p), 4) for i, p in enumerate(proba)}
            # Derive a consistent threat_score: probability of class-1 (threat)
            # so that the /analyze-url aggregation has a uniform field across all models
            if "1" in probabilities:
                threat_score = probabilities["1"]
            elif prediction == 1:
                threat_score = confidence
            else:
                threat_score = 1.0 - confidence
            return {
                "model": model_name,
                "prediction": prediction,
                "prediction_label": "threat" if prediction == 1 else "benign",
                "confidence": round(confidence, 4),
                "threat_score": round(threat_score, 4),
                "probabilities": probabilities,
                "inference_source": "ml_model",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Prediction error {model_name}: {e}")
            return self._heuristic_predict(model_name, features)

    def feature_importance(self, model_name: str) -> Dict:
        """Return feature importances for tree-based models (explainability)."""
        feature_names = [
            "url_length", "hostname_length", "path_length", "is_https",
            "has_ip_address", "has_suspicious_tld", "subdomain_count",
            "has_port", "query_params_count", "has_at_symbol",
            "has_double_slash", "special_char_count",
        ]
        if model_name not in self.models:
            return {"error": f"Model '{model_name}' not loaded", "available": list(self.models.keys())}
        model = self.models[model_name]
        try:
            if hasattr(model, "feature_importances_"):
                importances = model.feature_importances_
                pairs = sorted(
                    zip(feature_names, [round(float(v), 4) for v in importances]),
                    key=lambda x: x[1], reverse=True,
                )
                return {
                    "model": model_name,
                    "method": "gini_importance",
                    "feature_importances": dict(pairs),
                    "top_features": [p[0] for p in pairs[:5]],
                }
            elif hasattr(model, "coef_"):
                coefs = model.coef_[0] if model.coef_.ndim > 1 else model.coef_
                pairs = sorted(
                    zip(feature_names, [round(float(v), 4) for v in coefs]),
                    key=lambda x: abs(x[1]), reverse=True,
                )
                return {
                    "model": model_name,
                    "method": "logistic_coefficients",
                    "feature_importances": dict(pairs),
                    "top_features": [p[0] for p in pairs[:5]],
                }
            else:
                return {
                    "model": model_name,
                    "method": "not_available",
                    "note": f"Model type {type(model).__name__} does not expose feature importances",
                }
        except Exception as e:
            return {"model": model_name, "error": str(e)}

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
    # Primary reasoning engine: DeepSeek via HF Inference Providers (OpenAI-compatible
    # router at router.huggingface.co/v1). Replaces Gemini. Override via REASONING_LLM_MODEL.
    # Use DeepSeek-R1 for deep reasoning; DeepSeek-V3 for fast assist.
    REASONING_LLM_REPO = os.environ.get("REASONING_LLM_MODEL", "deepseek-ai/DeepSeek-V3-0324")
    # Fallback LLM via the free HF Inference API. Mistral-7B-Instruct-v0.3 is widely
    # available and works well for cyber Q&A. Override via SECURITY_LLM_MODEL env var.
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

    SYSTEM_PROMPT = (
        "You are CyberForge AI, a precise, professional cybersecurity analyst. "
        "Give concise, technical, actionable answers. State a Risk Level "
        "(Critical/High/Medium/Low) when assessing a threat, and cite CVE / MITRE "
        "ATT&CK IDs where relevant."
    )

    def security_chat(self, query: str, max_tokens: int = 512) -> Dict:
        """Cybersecurity Q&A. Primary: DeepSeek via HF Inference Providers
        (OpenAI-compatible router). Fallback: Mistral-7B via the free HF
        Inference API. Both require HF_TOKEN."""
        if not HF_TOKEN:
            return {
                "model": "security-llm",
                "response": None,
                "error": "HF_TOKEN env var required to call the reasoning LLM",
            }
        import requests

        # ── Path 1: DeepSeek via HF Inference Providers (OpenAI-compatible) ──
        try:
            r = requests.post(
                "https://router.huggingface.co/v1/chat/completions",
                headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"},
                json={
                    "model": self.REASONING_LLM_REPO,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": query[:6000]},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
                timeout=60,
            )
            if r.status_code == 200:
                data = r.json()
                text = data["choices"][0]["message"]["content"]
                return {
                    "model":    "deepseek",
                    "source":   "hf_inference_providers",
                    "response": text,
                    "model_id": self.REASONING_LLM_REPO,
                }
            logger.warning(
                f"DeepSeek provider HTTP {r.status_code}: {r.text[:160]} — falling back to Mistral"
            )
        except Exception as e:
            logger.warning(f"DeepSeek provider error: {type(e).__name__}: {str(e)[:160]} — falling back to Mistral")

        # ── Path 2 (fallback): Mistral-7B via the free HF Inference API ──
        try:
            url = f"https://api-inference.huggingface.co/models/{self.SECURITY_LLM_REPO}"
            headers = {"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"}
            payload = {
                "inputs": f"{self.SYSTEM_PROMPT}\n\n{query[:2000]}",
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
            }
        except Exception as e:
            return {
                "model":  "security-llm",
                "error":  f"{type(e).__name__}: {str(e)[:200]}",
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
            "reasoning_llm": "deepseek" if HF_TOKEN else None,
            "reasoning_model": transformer_loader.REASONING_LLM_REPO if HF_TOKEN else None,
            "fallback_llm": transformer_loader.SECURITY_LLM_REPO if HF_TOKEN else None,
            "gemini": gemini_service.ready,  # retired — DeepSeek is the engine now (kept for backward-compat)
            "ml_models": ml_loader.ready,
            "models_loaded": list(ml_loader.models.keys()),
            "transformers": transformer_loader.transformers_available,
            "transformer_models_loaded": list(transformer_loader.pipelines.keys()),
            "gradio_ui": True,
        },
        "version": "2.0.0",
        "new_endpoints": [
            "POST /api/v2/batch-analyze",
            "GET  /api/v2/explain/{model_name}",
            "POST /api/v2/ioc-scan",
            "POST /api/v2/url-enrich",
            "POST /api/v2/chat (context-grounded security chatbot, Wave 2)",
            "POST /api/v2/security-chat",
        ],
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
    """URL analysis – called by backend mlService.analyzeWebsite()
    Returns per-model predictions + unified aggregate with risk_score (0-100).
    All models now consistently include threat_score (probability of class-1).
    """
    body = await request.json()
    url = body.get("url", "")
    if not url:
        return JSONResponse(status_code=400, content={"detail": "URL required"})
    features = extract_url_features(url)
    predictions = {}
    for model_name in ml_loader.MODEL_NAMES:
        predictions[model_name] = ml_loader.predict(model_name, features)

    # threat_score is now always present on every prediction (ml_model + heuristic)
    scores = [p.get("threat_score", 0.2) for p in predictions.values()]
    avg_score = sum(scores) / len(scores) if scores else 0
    max_score = max(scores) if scores else 0

    # Heuristic risk factors derived from URL features
    risk_factors = []
    if not features.get("is_https"):
        risk_factors.append("no_https")
    if features.get("has_ip_address"):
        risk_factors.append("ip_in_url")
    if features.get("has_suspicious_tld"):
        risk_factors.append("suspicious_tld")
    if features.get("url_length", 0) > 100:
        risk_factors.append("long_url")
    if features.get("has_at_symbol"):
        risk_factors.append("at_symbol_in_url")
    if features.get("subdomain_count", 0) > 2:
        risk_factors.append("excessive_subdomains")
    if features.get("special_char_count", 0) > 10:
        risk_factors.append("high_special_chars")
    if features.get("has_double_slash"):
        risk_factors.append("double_slash_in_path")

    # Overall risk level using the max score (conservative)
    if max_score > 0.8:
        overall_risk = "critical"
    elif max_score > 0.6:
        overall_risk = "high"
    elif max_score > 0.4:
        overall_risk = "medium"
    else:
        overall_risk = "low"

    # risk_score 0-100 for the Heroku backend (used in riskScore field)
    risk_score_100 = round(max_score * 100, 1)

    return {
        "url": url,
        "aggregate": {
            "average_threat_score": round(avg_score, 3),
            "max_threat_score": round(max_score, 3),
            "risk_score": risk_score_100,
            "overall_risk_level": overall_risk,
            "risk_factors": risk_factors,
            "models_flagged": sum(1 for p in predictions.values() if p.get("prediction", 0) == 1),
            "models_total": len(predictions),
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
    """Cybersecurity Q&A via DeepSeek (HF Inference Providers), Mistral fallback.
    Body: { "query": "...", "max_tokens": 512 }"""
    body = await request.json()
    query = body.get("query", "").strip()
    if not query:
        return JSONResponse(status_code=400, content={"detail": "query required"})
    max_tokens = int(body.get("max_tokens", 512))
    result = transformer_loader.security_chat(query, max_tokens=max_tokens)
    # Last-resort: ML heuristic if both DeepSeek and Mistral are unavailable
    if result.get("error"):
        return gemini_service._fallback(query)
    return result


@api.get("/api/v2/status")
async def api_v2_status():
    """Status of phase-3 transformer models — what's loaded, what failed, what's available."""
    return transformer_loader.status()


@api.post("/api/v2/batch-analyze")
async def api_v2_batch_analyze(request: Request):
    """Batch URL analysis for the distributed agent system.
    Accepts up to 20 URLs in one call — avoids the per-URL HTTP overhead
    when multiple agents run concurrent scans.

    Body:
      { "urls": ["https://...", "https://...", ...] }

    Response:
      { "results": [ { ...same shape as /analyze-url... }, ... ], "total": N, "elapsed_ms": N }
    """
    import time
    body = await request.json()
    urls = body.get("urls", [])
    if not urls:
        return JSONResponse(status_code=400, content={"detail": "urls array required"})
    if len(urls) > 20:
        return JSONResponse(status_code=400, content={"detail": "Maximum 20 URLs per batch"})

    t0 = time.time()
    results = []
    for url in urls:
        url = str(url).strip()
        if not url:
            results.append({"url": url, "error": "empty url"})
            continue
        features = extract_url_features(url)
        predictions = {}
        for model_name in ml_loader.MODEL_NAMES:
            predictions[model_name] = ml_loader.predict(model_name, features)
        scores = [p.get("threat_score", 0.2) for p in predictions.values()]
        avg_score = sum(scores) / len(scores) if scores else 0
        max_score = max(scores) if scores else 0
        risk_factors = []
        if not features.get("is_https"):
            risk_factors.append("no_https")
        if features.get("has_ip_address"):
            risk_factors.append("ip_in_url")
        if features.get("has_suspicious_tld"):
            risk_factors.append("suspicious_tld")
        if features.get("url_length", 0) > 100:
            risk_factors.append("long_url")
        if features.get("has_at_symbol"):
            risk_factors.append("at_symbol_in_url")
        if features.get("subdomain_count", 0) > 2:
            risk_factors.append("excessive_subdomains")
        if max_score > 0.8:
            overall_risk = "critical"
        elif max_score > 0.6:
            overall_risk = "high"
        elif max_score > 0.4:
            overall_risk = "medium"
        else:
            overall_risk = "low"
        results.append({
            "url": url,
            "aggregate": {
                "average_threat_score": round(avg_score, 3),
                "max_threat_score": round(max_score, 3),
                "risk_score": round(max_score * 100, 1),
                "overall_risk_level": overall_risk,
                "risk_factors": risk_factors,
                "models_flagged": sum(1 for p in predictions.values() if p.get("prediction", 0) == 1),
            },
            "model_predictions": predictions,
            "features_analyzed": features,
        })

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return {
        "results": results,
        "total": len(results),
        "elapsed_ms": elapsed_ms,
        "timestamp": datetime.utcnow().isoformat(),
    }


@api.get("/api/v2/explain/{model_name}")
async def api_v2_explain(model_name: str):
    """Feature importance / explainability for a loaded ML model.
    Supports RandomForest, GradientBoosting (gini importance) and LogisticRegression (coefficients).

    Path param: model_name — one of phishing_detection | malware_detection |
                              anomaly_detection | web_attack_detection
    """
    return ml_loader.feature_importance(model_name)


@api.post("/api/v2/ioc-scan")
async def api_v2_ioc_scan(request: Request):
    """Multi-field Indicator of Compromise scanner.
    Runs all available ML models + DGA detector + BERT classifier against
    multiple IOC types in a single call.

    Body:
      {
        "url":    "https://...",           # optional
        "domain": "example.com",           # optional
        "ip":     "1.2.3.4",              # optional
        "hash":   "abc123...",             # optional (future use)
        "context": { ... }                 # optional — passed to Gemini if available
      }

    Response: per-indicator results with unified risk summary.
    """
    body = await request.json()
    url     = body.get("url", "").strip()
    domain  = body.get("domain", "").strip()
    context = body.get("context", {})

    ioc_results: Dict[str, Any] = {}
    all_scores: List[float] = []

    # --- URL analysis ---
    if url:
        features = extract_url_features(url)
        url_preds = {name: ml_loader.predict(name, features) for name in ml_loader.MODEL_NAMES}
        url_scores = [p.get("threat_score", 0.2) for p in url_preds.values()]
        url_max = max(url_scores) if url_scores else 0
        all_scores.append(url_max)

        # BERT-based URL classifier (lazy-loaded)
        bert_result = transformer_loader.predict_url_phishing(url)
        ioc_results["url"] = {
            "value": url,
            "ml_predictions": url_preds,
            "bert_classification": bert_result,
            "max_threat_score": round(url_max, 3),
        }

    # --- Domain analysis ---
    effective_domain = domain
    if not effective_domain and url:
        from urllib.parse import urlparse as _urlparse
        effective_domain = _urlparse(url).hostname or ""

    if effective_domain:
        dga_result = transformer_loader.predict_dga(effective_domain)
        dga_score = dga_result.get("threat_score", 0.0)
        all_scores.append(dga_score)
        ioc_results["domain"] = {
            "value": effective_domain,
            "dga_detection": dga_result,
        }

    # --- Overall risk summary ---
    overall_score = max(all_scores) if all_scores else 0.0
    if overall_score > 0.8:
        risk_level = "critical"
    elif overall_score > 0.6:
        risk_level = "high"
    elif overall_score > 0.4:
        risk_level = "medium"
    elif overall_score > 0.0:
        risk_level = "low"
    else:
        risk_level = "unknown"

    # Optional LLM enrichment (DeepSeek via HF Inference Providers) when HF_TOKEN is set
    ai_analysis = None
    if HF_TOKEN and (url or domain):
        target = url or domain
        ai_analysis = gemini_service.analyze(
            f"Scan these IOC indicators for threats: url={target}, domain={effective_domain}",
            context=context,
        )

    return {
        "ioc_results": ioc_results,
        "summary": {
            "overall_risk_level": risk_level,
            "overall_threat_score": round(overall_score, 3),
            "risk_score": round(overall_score * 100, 1),
            "indicators_analyzed": len(ioc_results),
        },
        "ai_analysis": ai_analysis,
        "timestamp": datetime.utcnow().isoformat(),
    }


@api.post("/api/v2/url-enrich")
async def api_v2_url_enrich(request: Request):
    """Enriched URL analysis: combines heuristic + ML models + BERT transformer
    into a single scored response with explanations.
    This is the richer alternative to /analyze-url for the AI Deep Scan mode.

    Body: { "url": "https://..." }
    """
    body = await request.json()
    url = body.get("url", "").strip()
    if not url:
        return JSONResponse(status_code=400, content={"detail": "url required"})

    features = extract_url_features(url)

    # Core ML predictions
    ml_predictions = {name: ml_loader.predict(name, features) for name in ml_loader.MODEL_NAMES}
    ml_scores = [p.get("threat_score", 0.2) for p in ml_predictions.values()]
    ml_max = max(ml_scores) if ml_scores else 0

    # BERT transformer
    bert_result = transformer_loader.predict_url_phishing(url)
    bert_score = bert_result.get("threat_score", 0.0) if not bert_result.get("error") else None

    # DGA check on hostname
    from urllib.parse import urlparse as _urlparse
    hostname = _urlparse(url).hostname or ""
    dga_result = transformer_loader.predict_dga(hostname) if hostname else None
    dga_score = dga_result.get("threat_score", 0.0) if dga_result and not dga_result.get("error") else 0.0

    # Feature importances for top model
    top_model = ml_loader.MODEL_NAMES[0]
    top_score = ml_scores[0]
    for i, score in enumerate(ml_scores):
        if score > top_score:
            top_score = score
            top_model = ml_loader.MODEL_NAMES[i]
    explainability = ml_loader.feature_importance(top_model)

    # Fuse scores: weighted average of ML (60%), BERT (30% if available), DGA (10%)
    if bert_score is not None:
        fused_score = 0.60 * ml_max + 0.30 * bert_score + 0.10 * dga_score
    else:
        fused_score = 0.80 * ml_max + 0.20 * dga_score

    if fused_score > 0.8:
        risk_level = "critical"
    elif fused_score > 0.6:
        risk_level = "high"
    elif fused_score > 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"

    risk_factors = []
    if not features.get("is_https"):
        risk_factors.append("no_https")
    if features.get("has_ip_address"):
        risk_factors.append("ip_in_url")
    if features.get("has_suspicious_tld"):
        risk_factors.append("suspicious_tld")
    if features.get("url_length", 0) > 100:
        risk_factors.append("long_url")
    if features.get("has_at_symbol"):
        risk_factors.append("at_symbol_in_url")
    if features.get("subdomain_count", 0) > 2:
        risk_factors.append("excessive_subdomains")
    if dga_result and dga_result.get("is_threat"):
        risk_factors.append("dga_domain")
    if bert_result and bert_result.get("is_threat"):
        risk_factors.append("bert_flagged_malicious")

    return {
        "url": url,
        "risk_level": risk_level,
        "risk_score": round(fused_score * 100, 1),
        "fused_threat_score": round(fused_score, 4),
        "components": {
            "ml_max_threat_score": round(ml_max, 4),
            "bert_threat_score": round(bert_score, 4) if bert_score is not None else None,
            "dga_threat_score": round(dga_score, 4),
        },
        "ml_predictions": ml_predictions,
        "bert_classification": bert_result,
        "dga_detection": dga_result,
        "explainability": explainability,
        "risk_factors": risk_factors,
        "features_analyzed": features,
        "timestamp": datetime.utcnow().isoformat(),
    }


@api.post("/api/v2/chat")
async def api_v2_chat(request: Request):
    """Security Chatbot — Wave 2 implementation.

    Context-grounded security assistant that:
      1. Accepts a live context blob (telemetry, scan history, IOCs) and
         grounds every answer in it (RAG-lite over the current request — no
         persistent vector store, which requires paid GPU on free tier).
      2. Translates raw ML signals / IOCs into plain human language when the
         user includes raw data and asks for an explanation.
      3. Falls back to the Security LLM (Mistral-7B via HF Inference API)
         or the ML-powered heuristic analyzer when Gemini is offline.

    NOTE ON REAL-TIME "LEARNING": HuggingFace Spaces cpu-basic does NOT
    support fine-tuning or persistent model updates at runtime. What this
    endpoint does instead is context injection — every turn receives the
    latest system telemetry + scan history in the prompt, so the chatbot's
    answers are grounded in live data without weight updates. This is the
    correct RAG-lite pattern for free-tier inference.

    Request body (stable contract):
      {
        "message": "What is the risk of this domain: evil.xyz?",
        "session_id": "optional-uuid-for-conversation-continuity",
        "conversation_history": [ {"role": "user", "content": "..."}, ... ],
        "context": {
          "telemetry": { "cpu": 42, "ram": 67, "net_in_kbps": 120, ... },
          "recent_scans": [ { "url": "...", "risk_score": 78, "category": "phishing" }, ... ],
          "active_threats": [ { "type": "phishing", "severity": "high", "source": "..." } ],
          "behavioral_alerts": [ { "pattern": "...", "score": 0.9 } ],
          "translate": true   # if true → force plain-language IOC translation mode
        }
      }

    Response contract (preserved from Wave 1):
      {
        "response": "...",          # natural language answer grounded in context
        "confidence": 0.0-1.0,
        "risk_level": "low|medium|high|critical",
        "risk_score": 0-100,
        "model_used": "...",
        "session_id": "...",
        "sources": [ { "type": "...", "label": "...", "value": "..." } ],
        "timestamp": "..."
      }
    """
    body = await request.json()
    message = body.get("message", "").strip()
    session_id = body.get("session_id", "")
    history = body.get("conversation_history", [])
    context = body.get("context", {})

    if not message:
        return JSONResponse(status_code=400, content={"detail": "message required"})

    # ── Build grounding context string and source citations ──────────────
    grounding_lines: List[str] = []
    sources: List[Dict] = []

    # System telemetry
    telemetry = context.get("telemetry", {})
    if telemetry:
        cpu = telemetry.get("cpu", telemetry.get("cpu_percent"))
        ram = telemetry.get("ram", telemetry.get("ram_percent"))
        net_in = telemetry.get("net_in_kbps", telemetry.get("net_in"))
        telem_parts = []
        if cpu is not None:
            telem_parts.append(f"CPU {cpu}%")
        if ram is not None:
            telem_parts.append(f"RAM {ram}%")
        if net_in is not None:
            telem_parts.append(f"Net↓ {net_in} kbps")
        if telem_parts:
            grounding_lines.append(f"SYSTEM TELEMETRY (live, last 5s): {', '.join(telem_parts)}")
            sources.append({"type": "telemetry", "label": "System Telemetry", "value": ", ".join(telem_parts)})

    # Recent scan history
    recent_scans = context.get("recent_scans", [])
    if recent_scans:
        scan_summary = "; ".join(
            f"{s.get('url', 'unknown')} → {s.get('category', '?')} (score {s.get('risk_score', '?')}/100)"
            for s in recent_scans[:5]
        )
        grounding_lines.append(f"RECENT URL SCANS (last 5): {scan_summary}")
        sources.append({"type": "scan_history", "label": "Recent Scans", "value": f"{len(recent_scans)} scans"})

    # Active threats
    active_threats = context.get("active_threats", [])
    if active_threats:
        threat_summary = "; ".join(
            f"{t.get('type', '?')} [{t.get('severity', '?')}] from {t.get('source', '?')}"
            for t in active_threats[:5]
        )
        grounding_lines.append(f"ACTIVE THREATS: {threat_summary}")
        sources.append({"type": "threats", "label": "Active Threats", "value": f"{len(active_threats)} active"})

    # Behavioral alerts
    behavioral_alerts = context.get("behavioral_alerts", [])
    if behavioral_alerts:
        alert_summary = "; ".join(
            f"'{a.get('pattern', a.get('type', '?'))}' (score {a.get('score', '?')})"
            for a in behavioral_alerts[:3]
        )
        grounding_lines.append(f"BEHAVIORAL ALERTS: {alert_summary}")
        sources.append({"type": "behavioral", "label": "Behavioral Alerts", "value": f"{len(behavioral_alerts)} alerts"})

    # Machine→Human translation mode
    translate_mode = context.get("translate", False)
    raw_data = context.get("raw_data", "")
    if translate_mode and raw_data:
        grounding_lines.append(
            f"RAW DATA TO TRANSLATE INTO PLAIN LANGUAGE:\n{str(raw_data)[:1500]}"
        )
        sources.append({"type": "raw_translation", "label": "Raw Signal", "value": str(raw_data)[:100]})

    # Construct enriched prompt
    grounding_block = "\n".join(grounding_lines)
    translate_instruction = (
        "\n\nIMPORTANT: The user has requested plain-language translation of raw machine data. "
        "Explain all technical signals, scores, and IOCs in simple, non-technical language first, "
        "then give actionable security advice." if translate_mode else ""
    )

    conversation_instruction = ""
    if history:
        conversation_instruction = "\n\nCONVERSATION CONTEXT (recent turns):\n" + "\n".join(
            f"{h.get('role','?').upper()}: {str(h.get('content',''))[:300]}"
            for h in history[-6:]
        )

    enriched_message = message
    if grounding_block:
        enriched_message = (
            f"[LIVE SYSTEM CONTEXT — use this to ground your answer]\n"
            f"{grounding_block}\n"
            f"{translate_instruction}"
            f"{conversation_instruction}\n\n"
            f"[USER MESSAGE]\n{message}"
        )

    # ── Run ML analysis on any URLs in the message (always available) ──
    import re as _re
    url_matches = _re.findall(r'https?://[^\s"\'<>]+', message)
    ml_url_context: List[str] = []
    detected_risk_score = 0.0
    detected_risk_level = "unknown"

    if url_matches and ml_loader.ready:
        for url in url_matches[:3]:
            features = extract_url_features(url)
            preds = {name: ml_loader.predict(name, features) for name in ml_loader.MODEL_NAMES}
            scores = [p.get("threat_score", 0.2) for p in preds.values()]
            mx = max(scores) if scores else 0
            if mx > detected_risk_score:
                detected_risk_score = mx
            flagged = [n for n, p in preds.items() if p.get("prediction", 0) == 1]
            ml_url_context.append(
                f"ML scan of {url[:60]}: max_threat={mx:.2%}, flagged_by={flagged or 'none'}"
            )
            sources.append({"type": "ml_scan", "label": f"ML scan: {url[:50]}", "value": f"risk {mx:.0%}"})

        if ml_url_context:
            enriched_message += "\n\n[ML PRE-SCAN RESULTS]\n" + "\n".join(ml_url_context)

    if detected_risk_score > 0.8:
        detected_risk_level = "critical"
    elif detected_risk_score > 0.6:
        detected_risk_level = "high"
    elif detected_risk_score > 0.4:
        detected_risk_level = "medium"
    elif detected_risk_score > 0.0:
        detected_risk_level = "low"

    # ── Grounding: add ML model state to context ──────────────────────
    if ml_loader.ready:
        n_models = len(ml_loader.models)
        sources.append({"type": "ml_models", "label": "ML Models", "value": f"{n_models}/4 loaded"})

    # ── LLM cascade: DeepSeek (HF Inference Providers) → Mistral → ML heuristic ──
    # Path 1: DeepSeek is the primary reasoning engine. security_chat() calls
    #         DeepSeek via the HF Inference Providers router, then transparently
    #         falls back to Mistral-7B on the free HF Inference API. Gemini retired.
    llm_result = transformer_loader.security_chat(enriched_message, max_tokens=600)
    if llm_result.get("response") and not llm_result.get("error"):
        text = llm_result["response"]
        text_lower = text.lower()
        if "critical" in text_lower:
            risk_level, risk_score = "critical", 85.0
        elif "high" in text_lower:
            risk_level, risk_score = "high", 70.0
        elif "medium" in text_lower:
            risk_level, risk_score = "medium", 45.0
        else:
            risk_level, risk_score = "low", 20.0
        # Override with ML scan if stronger
        if detected_risk_score > 0:
            ml_score_100 = round(detected_risk_score * 100, 1)
            if ml_score_100 > risk_score:
                risk_score = ml_score_100
                risk_level = detected_risk_level
        return {
            "response": text,
            "confidence": 0.72,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "model_used": llm_result.get("model_id", transformer_loader.SECURITY_LLM_REPO),
            "session_id": session_id,
            "sources": sources,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Path 3: ML heuristic fallback (always available)
    fallback = gemini_service._fallback(enriched_message)
    # Override with ML scan risk if available
    if detected_risk_score > 0:
        ml_score_100 = round(detected_risk_score * 100, 1)
        if ml_score_100 > fallback.get("risk_score", 0):
            fallback["risk_score"] = ml_score_100
            fallback["risk_level"] = detected_risk_level
    fallback["session_id"] = session_id
    fallback["sources"] = sources
    return fallback


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
## API Integration — v2.0

### Core Endpoints (stable, used by Heroku backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check — version, models, services |
| POST | `/analyze` | AI chat / general analysis (Gemini or ML fallback) |
| POST | `/analyze-url` | URL threat analysis — 4 ML models + risk factors |
| POST | `/scan-threats` | Deep threat scan (Gemini or ML fallback) |
| POST | `/api/insights/generate` | AI-generated security insights |
| POST | `/api/models/predict` | Direct ML model prediction |
| GET | `/models` | List loaded models with source info |

### v2 Endpoints (new — for distributed agents + AI Deep Scan)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/batch-analyze` | Batch analyze up to 20 URLs (for multi-agent) |
| GET | `/api/v2/explain/{model_name}` | Feature importances / explainability |
| POST | `/api/v2/url-classify` | BERT-based URL phishing classifier |
| POST | `/api/v2/dga-detect` | DGA domain detection (entropy heuristic) |
| POST | `/api/v2/ioc-scan` | Multi-IOC scanner: URL + domain + DGA + BERT |
| POST | `/api/v2/url-enrich` | Enriched analysis: ML + BERT + DGA + explainability |
| POST | `/api/v2/chat` | Security chatbot — context-grounded, RAG-lite, machine→human translation |
| POST | `/api/v2/security-chat` | Security LLM Q&A (Mistral-7B via HF Inference API) |
| GET | `/api/v2/status` | Transformer model load status |

### Quick Examples

```bash
# Batch analyze URLs (for distributed agents)
curl -X POST https://che237-cyberforge.hf.space/api/v2/batch-analyze \\
  -H "Content-Type: application/json" \\
  -d '{"urls": ["https://example.com", "http://evil.xyz/login?id=1"]}'

# Enriched URL analysis (Deep Scan mode)
curl -X POST https://che237-cyberforge.hf.space/api/v2/url-enrich \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'

# Feature explainability
curl https://che237-cyberforge.hf.space/api/v2/explain/phishing_detection

# IOC multi-field scan
curl -X POST https://che237-cyberforge.hf.space/api/v2/ioc-scan \\
  -H "Content-Type: application/json" \\
  -d '{"url": "http://192.168.1.1/login", "domain": "192.168.1.1"}'

# Chatbot (Wave 2 extension point)
curl -X POST https://che237-cyberforge.hf.space/api/v2/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Is this URL suspicious: http://login.g00gle.com.xyz/verify"}'
```
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
