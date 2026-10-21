"""
CyberForge AI - ML inference service
Hugging Face Spaces deployment: FastAPI REST endpoints for the CyberForge
backend. Every route except / and /health needs the service key
(ML_SERVICE_KEY), which only the backend holds; the two training routes need
the Space owner's Hugging Face token instead. Nothing here runs uploaded code,
notebooks or uploaded models.
"""

import hmac
import numpy as np
import json
import os
import re
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urlparse

# URL feature extraction is shared with the trainer, so training and serving
# cannot drift apart.
from url_features import (extract_url_features, popular_domains_loaded, rescale_score,
                          set_popular_domains, split_url)

# Models are loaded only from the model repository (ml_loader below), never
# from a caller: loading a joblib/pickle file can run code.
import joblib

# Hugging Face Hub
from huggingface_hub import HfApi, hf_hub_download, upload_file

# FastAPI for REST endpoints
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

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
KNOWLEDGE_BASE_DIR = APP_DIR / "knowledge_base"
KNOWLEDGE_BASE_DIR.mkdir(exist_ok=True)
TRAINING_DATA_DIR = APP_DIR / "training_data"
TRAINING_DATA_DIR.mkdir(exist_ok=True)

# Environment
HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_MODEL_REPO = os.environ.get("HF_MODEL_REPO", "Che237/cyberforge-models")

# Open-source chat model that runs inside this Space on CPU (llama.cpp, GGUF).
# It replaces Gemini and needs no API key or credit. Any GGUF chat model can be
# set here; on the free cpu-basic tier (2 vCPU) stay around 2B parameters or the
# answers will not fit inside the callers' timeouts.
LOCAL_LLM_REPO = os.environ.get("LOCAL_LLM_REPO", "unsloth/Qwen3.5-2B-GGUF")
LOCAL_LLM_FILE = os.environ.get("LOCAL_LLM_FILE", "Qwen3.5-2B-Q4_K_M.gguf")
LOCAL_LLM_CTX = int(os.environ.get("LOCAL_LLM_CTX", "4096"))
LOCAL_LLM_THREADS = int(os.environ.get("LOCAL_LLM_THREADS", "2"))
LOCAL_LLM_MAX_TOKENS = int(os.environ.get("LOCAL_LLM_MAX_TOKENS", "320"))
LOCAL_LLM_TEMPERATURE = float(os.environ.get("LOCAL_LLM_TEMPERATURE", "0.3"))
LOCAL_LLM_MAX_INPUT_CHARS = int(os.environ.get("LOCAL_LLM_MAX_INPUT_CHARS", "2400"))
LOCAL_LLM_TIME_BUDGET_S = float(os.environ.get("LOCAL_LLM_TIME_BUDGET_S", "17"))
# A caller with a longer timeout of its own may ask for more time, up to this.
# Reading the prompt counts: on this CPU a 2,000-character prompt alone takes
# most of the default budget.
LOCAL_LLM_MAX_TIME_BUDGET_S = float(os.environ.get("LOCAL_LLM_MAX_TIME_BUDGET_S", "50"))
# How long a question someone is waiting for may wait for the model; the rest
# of its time budget is for answering. Background work never waits this long.
LOCAL_LLM_INTERACTIVE_WAIT_S = float(os.environ.get("LOCAL_LLM_INTERACTIVE_WAIT_S", "25"))
LOCAL_LLM_QUEUE_TIMEOUT_S = float(os.environ.get("LOCAL_LLM_QUEUE_TIMEOUT_S", "5"))

logger.info(f"APP_DIR: {APP_DIR}")
# Calls to every route except / and /health must carry this key in the
# X-CyberForge-Service-Key header. It is a Space secret; the backend holds the
# same value. Without it set, those routes answer 503 rather than run open.
ML_SERVICE_KEY = os.environ.get("ML_SERVICE_KEY", "").strip()
SERVICE_KEY_HEADER = "x-cyberforge-service-key"
# The largest request body accepted, in bytes. Larger ones get HTTP 413.
ML_MAX_BODY_BYTES = int(os.environ.get("ML_MAX_BODY_BYTES", str(256 * 1024)))

logger.info(f"APP_DIR: {APP_DIR}")
logger.info(f"Service key {'set' if ML_SERVICE_KEY else 'NOT set: inference routes will answer 503'}")


# ============================================================================
# REQUEST INPUT
# ============================================================================
#
# What a caller sends is checked here, so a wrong body is answered with
# HTTP 400 and a reason instead of an unhandled error (HTTP 500).

class BadRequest(ValueError):
    """Input the caller got wrong. Answered with HTTP 400 and this message."""


async def json_object(request) -> Dict:
    """The request body as a JSON object."""
    try:
        body = await request.json()
    except BodyTooLarge:
        # Raised by ServiceGate while the body streams in; it answers 413.
        raise
    except Exception:
        raise BadRequest("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise BadRequest("Request body must be a JSON object")
    return body


def text_field(body: Dict, name: str) -> str:
    """A string field, stripped. A missing or null field is the empty string."""
    value = body.get(name)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise BadRequest(f"'{name}' must be a string")
    return value.strip()


def object_field(body: Dict, name: str) -> Dict:
    """An object field. A missing or null field is an empty object."""
    value = body.get(name)
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise BadRequest(f"'{name}' must be an object")
    return value


def list_field(body: Dict, name: str) -> List:
    """An array field. A missing or null field is an empty array."""
    value = body.get(name)
    if value is None:
        return []
    if not isinstance(value, list):
        raise BadRequest(f"'{name}' must be an array")
    return value


def int_field(body: Dict, name: str, default: int, low: int, high: int) -> int:
    """A whole-number field, limited to low..high. Missing or null is the default."""
    value = body.get(name)
    if value is None:
        return default
    if isinstance(value, bool):
        raise BadRequest(f"'{name}' must be a whole number")
    try:
        number = int(value)
    except (TypeError, ValueError, OverflowError):
        raise BadRequest(f"'{name}' must be a whole number")
    return max(low, min(high, number))


def dicts_in(items: List) -> List[Dict]:
    """The objects in a list; entries of any other type are dropped."""
    return [item for item in items if isinstance(item, dict)]


# ============================================================================
# REASONING SERVICE  (LLM-backed analysis for the REST API)
# ============================================================================

# "Risk Level: High", "**Risk Level:** High", "Risk - **Critical**", ...
RISK_LINE = re.compile(r"risk(?:\s+level)?\W{0,6}(critical|high|medium|low)\b", re.IGNORECASE)


def stated_risk(text: str) -> Optional[str]:
    """The risk level an LLM answer states for itself: "critical", "high",
    "medium", "low", or None when it gives no risk line. The level word merely
    appearing in the prose does not count: the small model mentions "critical"
    far more often than it means it."""
    m = RISK_LINE.search(text)
    return m.group(1).lower() if m else None


class ReasoningService:
    """Structured cybersecurity analysis for the REST endpoints.

    The text comes from TransformerModelLoader.security_chat, which asks the
    open-source model running inside this Space. If it does not answer, the
    ML/keyword heuristic in _fallback is used."""

    def analyze(self, query: str, context: Dict = None, history: List = None) -> Dict:
        tl = globals().get("transformer_loader")
        if tl is None:
            return self._fallback(query)
        ctx = f"\n\nCONTEXT:\n{json.dumps(context, indent=1)[:2000]}" if context else ""
        llm = tl.security_chat(f"{query}{ctx}", max_tokens=700)
        text = llm.get("response")
        if not text or llm.get("error"):
            return self._fallback(query)
        level = stated_risk(text) or "low"
        risk_level, risk_score = {
            "critical": ("Critical", 9.0), "high": ("High", 7.0),
            "medium": ("Medium", 5.0), "low": ("Low", 3.0),
        }[level]
        model_id = llm.get("model_id", "llm")
        return {
            "response": text,
            "confidence": 0.82,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "insights": [f"Analysis by {model_id} via {llm.get('source', 'llm')}"],
            "recommendations": [],
            "model_used": model_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def _fallback(self, query: str) -> Dict:
        """ML-powered analysis when no LLM is available"""
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
                    "*The AI chat model is currently unavailable. Provide a URL for full ML-based analysis.*"
                )
            insights = [f"{n_loaded} ML models active"]

        response_lines.append("\n---\n*Powered by CyberForge ML models — AI chat model offline.*")

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
reasoning_service = ReasoningService()


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
        # metadata.json of each model: which features it takes, in which order,
        # whether it has a scaler, and how it did when it was trained.
        self.metadata: Dict[str, Dict] = {}
        self.ready = False

    def install(self, name: str, model, metadata: Optional[Dict] = None, scaler=None):
        """Put a model into service together with what describes it."""
        self.models[name] = model
        self.metadata[name] = metadata or {}
        if scaler is None:
            self.scalers.pop(name, None)
        else:
            self.scalers[name] = scaler
        self.ready = True

    def feature_names(self, name: str) -> List[str]:
        """The features a model takes, in order. Models trained before their
        metadata listed them take the original twelve."""
        names = self.metadata.get(name, {}).get("feature_names")
        return list(names) if isinstance(names, list) and names else list(self.FEATURE_ORDER)

    @staticmethod
    def _hub_metadata(name: str) -> Dict:
        try:
            path = hf_hub_download(repo_id=HF_MODEL_REPO, filename=f"{name}/metadata.json",
                                   token=HF_TOKEN or None, cache_dir=str(MODELS_DIR))
            with open(path, encoding="utf-8") as handle:
                metadata = json.load(handle)
            return metadata if isinstance(metadata, dict) else {}
        except Exception:
            return {}

    @staticmethod
    def load_reputation() -> int:
        """The most-visited-domains list that the retrained models' popularity
        feature was computed with. It is stored beside the models."""
        try:
            path = hf_hub_download(repo_id=HF_MODEL_REPO, filename="reputation/popular_domains.txt",
                                   token=HF_TOKEN or None, cache_dir=str(MODELS_DIR))
            with open(path, encoding="utf-8") as handle:
                set_popular_domains([line.strip() for line in handle if line.strip()])
            logger.info(f"✅ Domain popularity list loaded: {popular_domains_loaded()} domains")
        except Exception as e:
            logger.info(f"No domain popularity list in the model repository yet ({type(e).__name__})")
        return popular_domains_loaded()

    def needs_reputation(self, name: str) -> bool:
        return "domain_popularity" in self.feature_names(name)

    def initialize(self):
        loaded = 0
        self.load_reputation()
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
                    metadata = self._hub_metadata(name)
                    scaler = None
                    # A model says in its metadata when it has no scaler; the
                    # first models did not say, and always had one.
                    if metadata.get("uses_scaler", True):
                        scaler_path = hf_hub_download(
                            repo_id=HF_MODEL_REPO, filename=scaler_file,
                            token=HF_TOKEN or None, cache_dir=str(MODELS_DIR),
                        )
                        scaler = joblib.load(scaler_path)
                    self.install(name, joblib.load(model_path), metadata, scaler)
                    loaded += 1
                    logger.info(f"✅ Loaded model from Hub: {name}")
                    continue
                except Exception as e:
                    logger.warning(f"Could not load {name} from the Hub: {type(e).__name__}: {str(e)[:200]}")

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

    # The features the models were trained on, in training order
    # (train_and_upload_models.py). Values are matched by name, never by position.
    FEATURE_ORDER = [
        "url_length", "hostname_length", "path_length", "is_https",
        "has_ip_address", "has_suspicious_tld", "subdomain_count",
        "has_port", "query_params_count", "has_at_symbol",
        "has_double_slash", "special_char_count",
    ]

    @classmethod
    def feature_vector(cls, features: Dict, names: Optional[List[str]] = None) -> Tuple[List[float], List[str]]:
        """The named features as numbers in the model's training order, and the
        names that were not supplied (0 in the vector). Raises BadRequest for a
        value that is not a finite number."""
        if not isinstance(features, dict):
            raise BadRequest("input_data must be an object of feature names and numbers")
        row, missing = [], []
        for name in (names or cls.FEATURE_ORDER):
            value = features.get(name)
            if value is None:
                missing.append(name)
                row.append(0.0)
                continue
            if isinstance(value, bool):
                value = int(value)
            if not isinstance(value, (int, float)) or value != value or value in (float("inf"), float("-inf")):
                raise BadRequest(f"Feature '{name}' must be a number")
            row.append(float(value))
        return row, missing

    @staticmethod
    def is_outlier_detector(model) -> bool:
        """IsolationForest and the other scikit-learn outlier detectors: a
        decision margin around a fitted offset, and no class probabilities."""
        return (not hasattr(model, "predict_proba")
                and hasattr(model, "decision_function") and hasattr(model, "offset_"))

    def predict(self, model_name: str, features: Dict) -> Dict:
        row, missing = self.feature_vector(features, self.feature_names(model_name))
        # The rule-based estimate reads the twelve original features, whichever
        # features the model itself takes, so those are checked as well: a value
        # that is not a number is the caller's error wherever it would be used.
        self.feature_vector(features, self.FEATURE_ORDER)
        # A model is only asked about a complete feature set. With features
        # missing it would be scoring zeros it was never given, so the rule-based
        # estimate answers instead and says which features were absent.
        if model_name not in self.models or missing:
            result = self._heuristic_predict(model_name, features)
            if missing and model_name in self.models:
                result["missing_features"] = missing
            return result
        # A model trained with the popularity feature is not asked anything
        # while the list is missing: every site would look unknown to it.
        if self.needs_reputation(model_name) and not popular_domains_loaded():
            result = self._heuristic_predict(model_name, features)
            result["note"] = "the domain popularity list is not loaded, so the model was not used"
            return result
        try:
            model = self.models[model_name]
            scaler = self.scalers.get(model_name)
            # The retrained models were fitted to 32-bit feature tables. Given
            # 64-bit values, a ratio that sits on a split boundary can fall on
            # the other side, so they are served at the precision they learned.
            metadata = self.metadata.get(model_name, {})
            single = metadata.get("feature_dtype") == "float32" or "feature_set" in metadata
            X = np.array([row], dtype=np.float32) if single else np.array([row])
            if scaler is not None:
                X = scaler.transform(X)
            if self.is_outlier_detector(model):
                return {
                    "model": model_name,
                    **anomaly_verdict(float(model.decision_function(X)[0])),
                    "probabilities": {},
                    "inference_source": "ml_model",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            prediction = int(model.predict(X)[0])
            confidence = 0.5
            probabilities = {}
            if hasattr(model, "predict_proba"):
                proba = [float(p) for p in model.predict_proba(X)[0]]
                # A retrained classifier carries the decision point it was given
                # at training. Its score is rescaled so that point reads as 0.5.
                threshold = self.metadata.get(model_name, {}).get("decision_threshold")
                if isinstance(threshold, (int, float)) and len(proba) == 2 and 0.5 < threshold < 1.0:
                    threat = rescale_score(proba[1], float(threshold))
                    proba = [1.0 - threat, threat]
                    prediction = 1 if threat >= 0.5 else 0
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
        feature_names = self.feature_names(model_name)
        if model_name not in self.models:
            return {"error": f"Model '{model_name}' not loaded", "available": list(self.models.keys())}
        model = self.models[model_name]
        stored = self.metadata.get(model_name, {}).get("feature_importances")
        if isinstance(stored, dict) and stored:
            # Measured when the model was trained, by shuffling each feature on
            # held-out URLs and seeing how much the model's ranking suffers.
            pairs = sorted(stored.items(), key=lambda pair: -pair[1])
            return {
                "model": model_name,
                "method": "permutation_importance",
                "feature_importances": dict(pairs),
                "top_features": [name for name, _ in pairs[:5]],
                "trained_at": self.metadata[model_name].get("trained_at"),
            }
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


def anomaly_verdict(margin: float) -> Dict:
    """Read an outlier detector's decision margin as a threat verdict.

    scikit-learn outlier detectors (the anomaly model is an IsolationForest)
    answer +1 for normal and -1 for an anomaly. Their decision margin is
    positive for normal points, negative for anomalies and zero at the model's
    own boundary. They have no class probabilities, so threat_score is that
    margin re-centred on 0.5: below 0.5 the model calls the input normal, above
    it anomalous. It is not a probability, and score_kind says so."""
    is_threat = margin < 0
    threat_score = min(1.0, max(0.0, 0.5 - margin))
    return {
        "prediction": 1 if is_threat else 0,
        "prediction_label": "threat" if is_threat else "benign",
        "confidence": round(max(threat_score, 1.0 - threat_score), 4),
        "threat_score": round(threat_score, 4),
        "anomaly_margin": round(margin, 4),
        "score_kind": "anomaly_margin",
    }


ml_loader = MLModelLoader()


# ============================================================================
# URL FEATURE EXTRACTION
# ============================================================================

# split_url and extract_url_features live in url_features.py (imported above).


def describe_ip(value: str) -> Dict:
    """What can be said about an IP address without a reputation source: whether
    it is an address at all, and what kind of range it is in. It is not scored."""
    import ipaddress
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return {"value": value, "valid": False, "status": "not_scored", "note": "Not a valid IPv4 or IPv6 address."}
    if address.is_loopback:
        scope = "loopback"
    elif address.is_link_local:
        scope = "link-local"
    elif address.is_multicast:
        scope = "multicast"
    elif address.is_private:
        scope = "private"
    elif address.is_reserved or address.is_unspecified:
        scope = "reserved"
    else:
        scope = "public"
    return {
        "value": str(address), "valid": True, "version": address.version, "scope": scope,
        "status": "not_scored",
        "note": "This service has no IP reputation source, so the address is classified by range only.",
    }


HASH_TYPES = {32: "md5", 40: "sha1", 64: "sha256", 128: "sha512"}


def describe_hash(value: str) -> Dict:
    """What can be said about a file hash without a reputation source: which
    algorithm its length matches. It is not scored."""
    digest = value.lower()
    is_hex = bool(digest) and all(c in "0123456789abcdef" for c in digest)
    hash_type = HASH_TYPES.get(len(digest)) if is_hex else None
    return {
        "value": digest, "valid": hash_type is not None, "hash_type": hash_type,
        "status": "not_scored",
        "note": "This service has no file reputation source, so the hash is identified by length only."
        if hash_type else "Not an MD5, SHA-1, SHA-256 or SHA-512 hex digest.",
    }


# ============================================================================
# TRANSFORMER MODEL LOADER  (Phase 3 — real HF transformer models)
# ============================================================================
#
# Loads pretrained BERT-based classifiers from the Hugging Face Hub.
# Models are loaded lazily on first request to keep cold-start fast.
# The chat LLM is separate: see LocalLLM below (runs in this Space) and
# TransformerModelLoader.security_chat.

class LocalLLM:
    """Open-source chat model served from inside the Space with llama.cpp.

    The GGUF file is downloaded from the Hub once and kept in memory. Generation
    is serialized (a llama.cpp context is not thread-safe) and time-boxed, so a
    slow CPU cannot hold a request past the callers' timeouts.

    Interactive requests (a person waiting on the assistant) come first: one
    waits for the model longer, a background request (a scan's explanation)
    does not start while one is waiting, and a running background generation
    stops at its next chunk so the waiting question gets the model."""

    SOURCE = "space_local_llamacpp"

    def __init__(self):
        self.llm = None
        self.error: Optional[str] = None
        self._chatml = False
        self._prefill = ""
        self._load_lock = threading.Lock()
        self._gen_lock = threading.Lock()
        self._waiting_lock = threading.Lock()
        self._interactive_waiting = 0

    @property
    def ready(self) -> bool:
        return self.llm is not None

    def status(self) -> Dict:
        return {
            "repo": LOCAL_LLM_REPO,
            "file": LOCAL_LLM_FILE,
            "loaded": self.ready,
            "loading": self._load_lock.locked(),
            "error": self.error,
        }

    def load(self):
        """Download and load the model. Safe to call repeatedly."""
        with self._load_lock:
            if self.llm is not None or self.error:
                return self.llm
            try:
                from llama_cpp import Llama
                try:
                    path = hf_hub_download(repo_id=LOCAL_LLM_REPO, filename=LOCAL_LLM_FILE, token=HF_TOKEN or None)
                except Exception:
                    # A stale HF_TOKEN must not block the download of a public model
                    path = hf_hub_download(repo_id=LOCAL_LLM_REPO, filename=LOCAL_LLM_FILE, token=False)
                self._probe(path)
                # n_threads_batch (prompt processing) defaults to the host's core
                # count, which a Space container reports far above its 2 vCPUs.
                llm = Llama(model_path=path, n_ctx=LOCAL_LLM_CTX, n_threads=LOCAL_LLM_THREADS,
                            n_threads_batch=LOCAL_LLM_THREADS, verbose=False)
                template = str((llm.metadata or {}).get("tokenizer.chat_template", ""))
                self._chatml = "<|im_start|>" in template
                # Qwen3.5 answers directly when the assistant turn opens with an
                # empty think block; this is what its template emits for
                # enable_thinking=False.
                self._prefill = "<think>\n\n</think>\n\n" if "<think>" in template else ""
                self.llm = llm
                logger.info(f"✅ Local LLM loaded: {LOCAL_LLM_REPO}/{LOCAL_LLM_FILE}")
            except Exception as e:
                self.error = f"{type(e).__name__}: {str(e)[:300]}"
                logger.error(f"❌ Local LLM unavailable: {self.error}")
            return self.llm

    @staticmethod
    def _probe(path: str) -> None:
        """Load the model once in a child process. A native crash there (for
        example a CPU instruction the prebuilt wheel needs but this machine
        lacks) raises here instead of killing the API process."""
        code = (
            "import sys; from llama_cpp import Llama; "
            "m = Llama(model_path=sys.argv[1], n_ctx=256, n_threads=1, n_threads_batch=1, verbose=False); "
            "m.create_completion('Hi', max_tokens=1)"
        )
        r = subprocess.run([sys.executable, "-c", code, path], capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            raise RuntimeError(f"llama.cpp probe exited with {r.returncode}: {(r.stderr or '')[-200:]}")

    def _acquire(self, interactive: bool, budget: float) -> Optional[float]:
        """The time spent waiting for the model, or None when it was not given."""
        asked = time.monotonic()
        if not interactive:
            if self._interactive_waiting:
                return None
            got = self._gen_lock.acquire(timeout=LOCAL_LLM_QUEUE_TIMEOUT_S)
            return time.monotonic() - asked if got else None
        with self._waiting_lock:
            self._interactive_waiting += 1
        try:
            # leave at least 10 s of the budget for the answer itself
            wait = max(LOCAL_LLM_QUEUE_TIMEOUT_S, min(LOCAL_LLM_INTERACTIVE_WAIT_S, budget - 10))
            got = self._gen_lock.acquire(timeout=wait)
        finally:
            with self._waiting_lock:
                self._interactive_waiting -= 1
        return time.monotonic() - asked if got else None

    def chat(self, system: str, user: str, max_tokens: int = 512, time_budget_s: Optional[float] = None, interactive: bool = False) -> Dict:
        base = {"model": "local-llm", "source": self.SOURCE, "model_id": LOCAL_LLM_REPO}
        budget = LOCAL_LLM_TIME_BUDGET_S if time_budget_s is None else max(5.0, min(float(time_budget_s), LOCAL_LLM_MAX_TIME_BUDGET_S))
        if self.llm is None:
            if self._load_lock.locked():
                return {**base, "response": None, "error": "local LLM is still loading"}
            self.load()
        if self.llm is None:
            return {**base, "response": None, "error": self.error or "local LLM not loaded"}
        waited = self._acquire(interactive, budget)
        if waited is None:
            return {**base, "response": None, "error": "local LLM is busy with another request"}
        # The time spent waiting comes out of the budget: the caller is waiting too.
        budget = max(5.0, budget - waited)
        started = time.monotonic()
        stream = None
        try:
            max_tokens = max(16, min(int(max_tokens), LOCAL_LLM_MAX_TOKENS))
            # The chat markers are structural: drop them from untrusted text
            system = system.replace("<|im_start|>", "").replace("<|im_end|>", "")
            user = user.replace("<|im_start|>", "").replace("<|im_end|>", "")
            if len(user) > LOCAL_LLM_MAX_INPUT_CHARS:
                # Keep both ends: context sits at the start, the question at the end
                half = LOCAL_LLM_MAX_INPUT_CHARS // 2
                user = f"{user[:half]}\n[...]\n{user[-half:]}"
            if self._chatml:
                prompt = (
                    f"<|im_start|>system\n{system}<|im_end|>\n"
                    f"<|im_start|>user\n{user}<|im_end|>\n"
                    f"<|im_start|>assistant\n{self._prefill}"
                )
                stream = self.llm.create_completion(
                    prompt, max_tokens=max_tokens, temperature=LOCAL_LLM_TEMPERATURE, top_p=0.8, top_k=20,
                    presence_penalty=1.5, stop=["<|im_end|>", "<|endoftext|>"], stream=True,
                )
                read = lambda c: c["choices"][0].get("text") or ""
            else:
                stream = self.llm.create_chat_completion(
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                    max_tokens=max_tokens, temperature=LOCAL_LLM_TEMPERATURE, top_p=0.8, stream=True,
                )
                read = lambda c: c["choices"][0].get("delta", {}).get("content") or ""
            pieces: List[str] = []
            truncated = False
            for chunk in stream:
                pieces.append(read(chunk))
                if chunk["choices"][0].get("finish_reason") == "length":
                    truncated = True
                if time.monotonic() - started > budget:
                    truncated = True
                    break
                if not interactive and self._interactive_waiting:
                    # someone is waiting on the assistant: hand the model over
                    truncated = True
                    break
            text = re.sub(r"<think>.*?</think>", "", "".join(pieces), flags=re.S).strip()
            if truncated:
                # Out of time or tokens: end on the last complete sentence. A dot
                # after a digit is a list marker ("2."), not a sentence end.
                ends = [m.end() for m in re.finditer(r"(?<!\d)[.!?][*_`\")\]]*(?=\s|$)", text)]
                if ends and ends[-1] > len(text) * 0.4:
                    text = text[:ends[-1]].strip()
            if not text:
                return {**base, "response": None, "error": "local LLM returned no text"}
            return {
                **base,
                "response": text,
                "tokens": len(pieces),
                "elapsed_ms": round((time.monotonic() - started) * 1000),
                "truncated": truncated,
            }
        except Exception as e:
            return {**base, "response": None, "error": f"{type(e).__name__}: {str(e)[:200]}"}
        finally:
            if stream is not None and hasattr(stream, "close"):
                stream.close()
            self._gen_lock.release()


local_llm = LocalLLM()


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
        Real DGA domains have high entropy, low pronounceability, no real word substrings.

        Every label except the top-level one is scored and the most
        generated-looking one is reported. The registered name is not always the
        first label ("www.<generated>.com"), and without a public-suffix list it
        cannot be picked out by position."""
        labels = [label for label in domain.lower().strip().split('.') if label]
        if not labels:
            return {"model": "dga_detector", "error": "empty domain"}
        candidates = labels[:-1] if len(labels) > 1 else labels
        result = max((self._score_dga_label(label[:60]) for label in candidates),
                     key=lambda scored: scored["threat_score"])
        result["labels_scored"] = len(candidates)
        return result

    @staticmethod
    def _score_dga_label(d: str) -> Dict:
        import math
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
            "scored_label":    d,
            "features": {
                "entropy":            round(entropy, 3),
                "vowel_ratio":        round(vowel_ratio, 3),
                "digit_ratio":        round(digit_ratio, 3),
                "max_consonant_run":  max_consonant_run,
                "length":             n,
            },
            "inference_source": "entropy-heuristic",
        }

    # The in-Space model is small and slow: ask for a short answer it can finish
    # inside the time budget, and tell it not to fill gaps with invented detail.
    # A risk line is requested only for a concrete indicator, because the REST
    # risk fields are read from it (see stated_risk).
    SYSTEM_PROMPT = (
        "You are CyberForge AI, a cybersecurity analyst. Answer in at most 80 words, "
        "as short bullet points. If the user gives a specific URL, file, alert or "
        "incident to assess, begin with one line 'Risk Level: X', where X is Critical, "
        "High, Medium or Low, chosen from the evidence given. For general questions, "
        "do not include a risk level. Use only the information provided and "
        "well-established security knowledge. If something has not been checked, "
        "such as reputation, hashes or CVEs, say it is unverified instead of guessing."
    )

    # For a person talking to the assistant (interactive requests): a
    # conversation first. The analyst prompt above stays for background
    # explanations of scans, alerts and reports.
    ASSISTANT_PROMPT = (
        "You are the CyberForge assistant, a friendly, helpful chat assistant built into "
        "the CyberForge security app. Talk naturally, like a normal chat assistant: reply "
        "to greetings and small talk briefly and warmly, and offer to help. Answer security "
        "questions clearly and concisely, in plain sentences, using a short list only for "
        "steps. When the message includes the user's CyberForge memory, use it only if it "
        "helps answer. Never claim to have scanned, detected or checked anything that is "
        "not in the message; if something has not been checked, say so."
    )

    def security_chat(self, query: str, max_tokens: int = 512, time_budget_s: Optional[float] = None, interactive: bool = False) -> Dict:
        """Cybersecurity Q&A, answered by the open-source model running inside
        this Space (free, no API key). `interactive` when a person is waiting:
        then it is a conversation (ASSISTANT_PROMPT), not an analyst's report."""
        system = self.ASSISTANT_PROMPT if interactive else self.SYSTEM_PROMPT
        return local_llm.chat(system, query, max_tokens=max_tokens, time_budget_s=time_budget_s, interactive=interactive)

    def status(self) -> Dict:
        return {
            "transformers_available": self.transformers_available,
            "loaded": list(self.pipelines.keys()),
            "available": list(self.REGISTRY.keys()) + ["reasoning_llm"],
            "load_errors": self.load_errors,
            "reasoning_llm": {"local": local_llm.status()},
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


# Service-wide HTTP work measurements. No prompts, identities or addresses are retained.
OPS_STARTED = time.monotonic()
OPS = {"active_requests": 0, "completed_requests": 0, "failed_requests": 0, "total_duration_ms": 0.0}
OPS_LOCK = threading.Lock()


def operational_report():
    with OPS_LOCK:
        completed = OPS["completed_requests"]
        return {"scope": "service process since startup", "active_requests": OPS["active_requests"],
                "completed_requests": completed, "failed_requests": OPS["failed_requests"],
                "mean_request_ms": round(OPS["total_duration_ms"] / completed, 1) if completed else None,
                "uptime_seconds": round(time.monotonic() - OPS_STARTED, 1)}


@api.middleware("http")
async def measure_requests(request: Request, call_next):
    # Measure inference HTTP operations, excluding health/capability polling and admin training.
    measured = request.method == "POST" and not request.url.path.startswith("/api/admin/")
    if not measured:
        return await call_next(request)
    started = time.monotonic()
    with OPS_LOCK:
        OPS["active_requests"] += 1
    failed = True
    try:
        response = await call_next(request)
        failed = response.status_code >= 400
        return response
    finally:
        with OPS_LOCK:
            OPS["active_requests"] -= 1
            OPS["completed_requests"] += 1
            OPS["failed_requests"] += int(failed)
            OPS["total_duration_ms"] += (time.monotonic() - started) * 1000


PUBLIC_PATHS = {"/", "/health"}
# These check the owner's Hugging Face token themselves (owner_token below).
OWNER_PATHS = {"/api/admin/train", "/api/admin/train/status"}


class BodyTooLarge(Exception):
    pass


def service_key_valid(presented: Optional[bytes]) -> bool:
    if not ML_SERVICE_KEY or not presented:
        return False
    return hmac.compare_digest(presented, ML_SERVICE_KEY.encode("utf-8"))


async def _reply(send, status: int, detail: str, code: str):
    body = json.dumps({"detail": detail, "code": code}).encode("utf-8")
    await send({"type": "http.response.start", "status": status,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class ServiceGate:
    """Outermost middleware. It refuses a call without the service key before
    any route runs, and a body over ML_MAX_BODY_BYTES whether or not it states
    its length."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        headers = dict(scope.get("headers") or [])
        # A CORS preflight carries no credentials; the CORS middleware answers it.
        if scope.get("method") != "OPTIONS" and path not in PUBLIC_PATHS and path not in OWNER_PATHS:
            if not ML_SERVICE_KEY:
                return await _reply(send, 503, "This service has no service key configured", "SERVICE_KEY_NOT_CONFIGURED")
            if not service_key_valid(headers.get(SERVICE_KEY_HEADER.encode())):
                return await _reply(send, 401, "A valid service key is required", "SERVICE_KEY_REQUIRED")
        stated = headers.get(b"content-length")
        if stated is not None:
            try:
                if int(stated) > ML_MAX_BODY_BYTES:
                    return await _reply(send, 413, f"Request body is over {ML_MAX_BODY_BYTES} bytes", "BODY_TOO_LARGE")
            except ValueError:
                return await _reply(send, 400, "Content-Length must be a number", "BAD_CONTENT_LENGTH")
        received = 0
        started = False

        async def bounded_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > ML_MAX_BODY_BYTES:
                    raise BodyTooLarge()
            return message

        async def tracked_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, bounded_receive, tracked_send)
        except BodyTooLarge:
            if started:
                raise
            await _reply(send, 413, f"Request body is over {ML_MAX_BODY_BYTES} bytes", "BODY_TOO_LARGE")


# Added last, so it runs first: before CORS and every route.
api.add_middleware(ServiceGate)


@api.exception_handler(BadRequest)
async def bad_request(request: Request, error: BadRequest):
    return JSONResponse(status_code=400, content={"detail": str(error)})


# ---------------------------------------------------------------------------
# Model training. It runs here, in the Space, in a background thread. Only the
# Space's owner can start it or read its report.
# ---------------------------------------------------------------------------

TRAINING: Dict[str, Any] = {"state": "idle"}
training_lock = threading.Lock()


def owner_token(request: Request) -> Optional[str]:
    """The caller's Hugging Face token, if it belongs to the account that owns
    this Space. None otherwise."""
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer ") or len(header) < 20:
        return None
    token = header[7:].strip()
    owner = os.environ.get("SPACE_AUTHOR_NAME") or HF_MODEL_REPO.split("/")[0]
    try:
        return token if HfApi(token=token).whoami().get("name") == owner else None
    except Exception:
        return None


def _train_job(options: Dict, token: str):
    def progress(step: str):
        TRAINING["step"] = step
        logger.info(f"Training: {step}")
    try:
        # Imported here: it pulls in the training half of scikit-learn, which
        # serving requests never needs.
        from trainer import run_training
        result = run_training(options, token, HF_MODEL_REPO, progress)
        if result.get("popular_domains"):
            set_popular_domains(result["popular_domains"])
        for name, model in result["models"].items():
            ml_loader.install(name, model, result["reports"][name], None)
        TRAINING.update({
            "state": "finished", "finished_at": datetime.utcnow().isoformat() + "Z",
            "dry_run": result["dry_run"], "reports": result["reports"], "uploaded": result["uploaded"],
            "in_service": sorted(result["models"]),
        })
    except Exception as error:
        logger.error(f"Training failed: {type(error).__name__}: {error}")
        TRAINING.update({
            "state": "failed", "finished_at": datetime.utcnow().isoformat() + "Z",
            "error": f"{type(error).__name__}: {str(error)[:500]}",
            "traceback": "".join(__import__("traceback").format_exception(type(error), error, error.__traceback__))[-4000:],
        })


@api.post("/api/admin/train")
async def api_admin_train(request: Request):
    """Retrain the detection models from public labelled data, here in the Space.
    Owner only: send the owner's Hugging Face token as a bearer token.
    Body (all optional): { "dry_run": true, "models": [...], and any setting in
    trainer.DEFAULTS }. A dry run trains and measures but uploads nothing and
    leaves the models in service as they are."""
    token = await run_in_threadpool(owner_token, request)
    if not token:
        return JSONResponse(status_code=403, content={"detail": "Only the owner of this Space can train its models"})
    options = await json_object(request) if request.headers.get("content-length", "0") not in ("", "0") else {}
    with training_lock:
        if TRAINING.get("state") == "running":
            return JSONResponse(status_code=409, content={"detail": "A training run is already in progress", "step": TRAINING.get("step")})
        TRAINING.clear()
        TRAINING.update({"state": "running", "step": "starting", "started_at": datetime.utcnow().isoformat() + "Z",
                         "options": {key: value for key, value in options.items() if key != "token"}})
    threading.Thread(target=_train_job, args=(options, token), daemon=True).start()
    return JSONResponse(status_code=202, content={"state": "running", "status": "/api/admin/train/status"})


@api.get("/api/admin/train/status")
async def api_admin_train_status(request: Request):
    """Where the training run is, and its full report when it has finished. Owner only."""
    if not await run_in_threadpool(owner_token, request):
        return JSONResponse(status_code=403, content={"detail": "Only the owner of this Space can read the training report"})
    return TRAINING


@api.get("/health")
async def api_health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "reasoning_llm": "local" if local_llm.ready else None,
            "reasoning_model": LOCAL_LLM_REPO,
            "local_llm": local_llm.status(),
            "ml_models": ml_loader.ready,
            "models_loaded": list(ml_loader.models.keys()),
            "models_trained_at": {name: ml_loader.metadata.get(name, {}).get("trained_at") for name in ml_loader.models},
            "popular_domains_loaded": popular_domains_loaded(),
            "transformers": transformer_loader.transformers_available,
            "transformer_models_loaded": list(transformer_loader.pipelines.keys()),
            "service_key": "required" if ML_SERVICE_KEY else "not_configured",
            "max_body_bytes": ML_MAX_BODY_BYTES,
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
    body = await json_object(request)
    query = text_field(body, "query")
    # The context is only serialised into the prompt, so any JSON value is fine.
    context = body.get("context")
    history = body.get("conversation_history")
    result = await run_in_threadpool(reasoning_service.analyze, query, context, history)
    return as_reasoning_text(result)


ANALYSIS_SCHEMA = "cyberforge.ml.analysis.v1"
VERDICT_POLICY = "trained_models_v1"


def analysis_record(target: str, predictions: Dict, started: float) -> Dict:
    """The versioned record of one analysis (V2-ML02), beside the older fields.

    Verdict policy trained_models_v1: "threat" when any trained model answered
    and flagged the target, "benign" when trained models answered and none
    flagged it, "unknown" when no trained model answered (rule-based estimates
    only). Scores are each model's output rescaled at its decision threshold:
    raw scores, not calibrated probabilities, so no probability is given."""
    detectors, warnings = [], []
    for name, p in predictions.items():
        trained = p.get("inference_source") == "ml_model"
        meta = ml_loader.metadata.get(name, {}) if trained else {}
        if "error" in p:
            verdict = "unknown"
        else:
            verdict = "threat" if p.get("prediction") == 1 else "benign"
        detectors.append({
            "id": name,
            "engine": "trained_model" if trained else "heuristic",
            "verdict": verdict,
            "raw_score": p.get("threat_score"),
            "calibrated_probability": None,
            "trained_at": meta.get("trained_at"),
            "decision_threshold": meta.get("decision_threshold"),
            "feature_set": meta.get("feature_set"),
            "missing_features": p.get("missing_features"),
        })
        if not trained:
            why = p.get("note") or ("features were missing" if p.get("missing_features") else "the model is not loaded")
            warnings.append(f"{name}: rule-based estimate, not the trained model ({why})")
    answered = [d for d in detectors if d["engine"] == "trained_model" and d["verdict"] != "unknown"]
    if not answered:
        verdict, reason = "unknown", "no trained model answered; only rule-based estimates are available"
    elif any(d["verdict"] == "threat" for d in answered):
        flagged = [d["id"] for d in answered if d["verdict"] == "threat"]
        verdict, reason = "threat", f"flagged by {', '.join(flagged)}"
    else:
        verdict, reason = "benign", f"{len(answered)} trained model(s) answered and none flagged it"
    warnings.append("scores are model outputs rescaled at each decision threshold, not calibrated probabilities")
    return {
        "schema": ANALYSIS_SCHEMA,
        "analysis_id": uuid.uuid4().hex,
        "task": "url",
        "target": target,
        "verdict": verdict,
        "verdict_reason": reason,
        "policy": VERDICT_POLICY,
        "coverage": {
            "detectors": len(detectors),
            "trained_models_answered": len(answered),
            "heuristic_estimates": sum(1 for d in detectors if d["engine"] == "heuristic"),
            # popular_domains_loaded() is the number of domains in the list.
            "reputation_list_loaded": popular_domains_loaded() > 0,
            "reputation_list_size": popular_domains_loaded(),
        },
        "detectors": detectors,
        "service_version": SERVICE_VERSION,
        "duration_ms": round((time.perf_counter() - started) * 1000, 1),
        "warnings": warnings,
    }


@api.post("/analyze-url")
async def api_analyze_url(request: Request):
    """URL analysis – called by backend mlService.analyzeWebsite()
    Returns per-model predictions + unified aggregate with risk_score (0-100).
    All models now consistently include threat_score (probability of class-1).
    """
    started = time.perf_counter()
    body = await json_object(request)
    url = text_field(body, "url")
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
        "analysis": analysis_record(url, predictions, started),
    }


@api.post("/scan-threats")
async def api_scan_threats(request: Request):
    """Threat scanning – called by backend mlService.scanForThreats()"""
    body = await json_object(request)
    query = json.dumps(body.get("data", body), indent=1)[:3000]
    result = await run_in_threadpool(reasoning_service.analyze, f"Scan these indicators for threats:\n{query}")
    return as_reasoning_text(result)


@api.post("/api/insights/generate")
async def api_generate_insights(request: Request):
    """AI insights – called by backend mlService.getAIInsights()"""
    body = await json_object(request)
    query = text_field(body, "query")
    context = body.get("context")
    result = await run_in_threadpool(reasoning_service.analyze, query, context)
    labelled = as_reasoning_text(result)
    return {
        "insights": result.get("response", ""),
        "confidence": result.get("confidence", 0),
        "timestamp": datetime.utcnow().isoformat(),
        "result_kind": labelled["result_kind"],
        "engine": labelled["engine"],
    }


@api.post("/api/models/predict")
async def api_model_predict(request: Request):
    """Model prediction – called by backend mlService.getModelPrediction()"""
    body = await json_object(request)
    model_type = text_field(body, "model_type") or "phishing_detection"
    # Either the URL, from which the service computes the model's features
    # itself, or the features by name.
    url = text_field(body, "url")
    input_data = extract_url_features(url) if url else object_field(body, "input_data")
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
    body = await json_object(request)
    url = text_field(body, "url")
    if not url:
        return JSONResponse(status_code=400, content={"detail": "url required"})
    return transformer_loader.predict_url_phishing(url)


@api.post("/api/v2/dga-detect")
async def api_v2_dga_detect(request: Request):
    """DGA-generated domain detection using YangYang-Research/dga-detection.
    Body: { "domain": "abc123xyz.com" }"""
    body = await json_object(request)
    domain = text_field(body, "domain")
    if not domain:
        return JSONResponse(status_code=400, content={"detail": "domain required"})
    return transformer_loader.predict_dga(domain)


@api.post("/api/v2/security-chat")
async def api_v2_security_chat(request: Request):
    """Cybersecurity Q&A, answered by the open-source model running in this Space.
    Body: { "query": "...", "max_tokens": 512 }"""
    body = await json_object(request)
    query = text_field(body, "query")
    if not query:
        return JSONResponse(status_code=400, content={"detail": "query required"})
    max_tokens = int_field(body, "max_tokens", 512, 1, 2048)
    # A caller that waits longer may give the model more time (5-50 s).
    budget = int_field(body, "time_budget_s", int(LOCAL_LLM_TIME_BUDGET_S), 5, int(LOCAL_LLM_MAX_TIME_BUDGET_S))
    # "interactive" only when a person is waiting on the answer (the assistant);
    # anything else is background work and gives way to it.
    interactive = text_field(body, "priority") == "interactive"
    result = await run_in_threadpool(transformer_loader.security_chat, query, max_tokens, budget, interactive)
    if result.get("error"):
        # No made-up analysis in its place: the rule-based summary keyword-matches
        # the whole prompt (context included) and is not an answer to a question.
        return {**result, "response": None, "answered": False, "result_kind": "reasoning_text"}
    return {**result, "answered": True, "result_kind": "reasoning_text"}


CAPABILITIES_SCHEMA = "cyberforge.ml.capabilities.v1"
SERVICE_VERSION = "2.0.0"
BATCH_MAX_URLS = 20
REASONING_ROUTES = ["/analyze", "/scan-threats", "/api/insights/generate", "/api/analysis/network",
                    "/api/ai/execute-task", "/api/browser/analyze", "/api/threat-feeds/analyze"]


def capability_report() -> Dict:
    """What this service can do right now, each capability with its kind, its
    readiness and its limits (V2-ML02). Nothing here is a promise: a
    capability that is loading, failed or unavailable says so."""
    models = []
    for name in ml_loader.MODEL_NAMES:
        meta = ml_loader.metadata.get(name, {})
        loaded = name in ml_loader.models
        models.append({
            "id": name,
            "kind": "trained_model",
            "readiness": "ready" if loaded else "unavailable",
            "reason": None if loaded else "the model file did not load; answers come from rule-based estimates",
            "answers_without_model": "heuristic",
            "trained_at": meta.get("trained_at"),
            "feature_count": len(meta.get("feature_names") or []) or None,
            "decision_threshold": meta.get("decision_threshold"),
            "routes": ["/api/models/predict", "/analyze-url", "/api/v2/batch-analyze", "/api/v2/ioc-scan", "/api/v2/url-enrich"],
        })
    bert_error = transformer_loader.load_errors.get("url_phishing_bert")
    if "url_phishing_bert" in transformer_loader.pipelines:
        bert_state, bert_reason = "ready", None
    elif bert_error:
        bert_state, bert_reason = "failed", str(bert_error)[:300]
    elif transformer_loader.transformers_available:
        bert_state, bert_reason = "not_loaded", "loads on first use"
    else:
        bert_state, bert_reason = "unavailable", "transformers is not installed"
    llm = local_llm.status()
    if llm.get("loaded"):
        llm_state, llm_reason = "ready", None
    elif llm.get("error"):
        llm_state, llm_reason = "failed", str(llm["error"])[:300]
    elif llm.get("loading"):
        llm_state, llm_reason = "loading", None
    else:
        llm_state, llm_reason = "not_loaded", "loads in the background after start"
    return {
        "schema": CAPABILITIES_SCHEMA,
        "operational": operational_report(),
        "service_version": SERVICE_VERSION,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "capabilities": models + [
            {
                "id": "url_phishing_bert",
                "kind": "transformer",
                "readiness": bert_state,
                "reason": bert_reason,
                "model": transformer_loader.REGISTRY["url_phishing_bert"]["repo"],
                "routes": ["/api/v2/url-classify", "/api/v2/ioc-scan", "/api/v2/url-enrich"],
            },
            {
                "id": "dga_detector",
                "kind": "heuristic",
                "readiness": "ready",
                "reason": "an entropy rule, not a trained model",
                "routes": ["/api/v2/dga-detect", "/api/v2/ioc-scan"],
            },
            {
                "id": "url_reputation",
                "kind": "reference_list",
                "readiness": "ready" if popular_domains_loaded() else "unavailable",
                "reason": None if popular_domains_loaded() else "the popular-domain list did not load",
                "routes": ["/analyze-url", "/api/models/predict"],
            },
            {
                "id": "reasoning_llm",
                "kind": "language_model",
                "readiness": llm_state,
                "reason": llm_reason,
                "model": f"{llm.get('repo')}/{llm.get('file')}",
                "answers_without_model": "rule_based_summary",
                "result_kind": "reasoning_text",
                "routes": ["/api/v2/security-chat", "/api/v2/chat"] + REASONING_ROUTES,
                "limits": {
                    "max_input_chars": LOCAL_LLM_MAX_INPUT_CHARS,
                    "max_output_tokens": LOCAL_LLM_MAX_TOKENS,
                    "queue_wait_seconds": LOCAL_LLM_QUEUE_TIMEOUT_S,
                    "time_budget_seconds": LOCAL_LLM_TIME_BUDGET_S,
                    "max_time_budget_seconds": LOCAL_LLM_MAX_TIME_BUDGET_S,
                    "interactive_wait_seconds": LOCAL_LLM_INTERACTIVE_WAIT_S,
                    "concurrent_generations": 1,
                },
            },
        ],
        "limits": {"max_body_bytes": ML_MAX_BODY_BYTES, "batch_max_urls": BATCH_MAX_URLS},
        "not_offered": [
            {"what": "network intrusion detection", "note": "/api/analysis/network returns reasoning text, not a trained detector's verdict"},
            {"what": "task execution", "note": "/api/ai/execute-task returns reasoning text and carries nothing out (executed: false)"},
            {"what": "dataset processing", "note": "no dataset pipeline is served; /api/datasets/process was removed"},
        ],
        "training": {
            "who": "the Space owner only (Hugging Face token)",
            "routes": ["/api/admin/train", "/api/admin/train/status"],
            "separate_from_inference": False,
            "note": "training runs in this process for now (V2-ML03)",
        },
    }


@api.get("/api/v2/capabilities")
async def api_v2_capabilities():
    """The versioned capability and readiness report (cyberforge.ml.capabilities.v1)."""
    return capability_report()


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
    body = await json_object(request)
    urls = list_field(body, "urls")
    if not urls:
        return JSONResponse(status_code=400, content={"detail": "urls array required"})
    if len(urls) > 20:
        return JSONResponse(status_code=400, content={"detail": "Maximum 20 URLs per batch"})

    t0 = time.time()
    results = []
    for url in urls:
        if not isinstance(url, str):
            results.append({"url": url, "error": "url must be a string"})
            continue
        url = url.strip()
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
        "ip":     "1.2.3.4",              # optional, described but not scored
        "hash":   "abc123...",             # optional, described but not scored
      }

    Response: per-indicator results with unified risk summary. The summary is
    built from the URL and domain only: there is no reputation source here for
    IP addresses or file hashes, so they are reported under their own keys with
    status "not_scored" and listed in summary.indicators_not_scored.
    """
    body = await json_object(request)
    url     = text_field(body, "url")
    domain  = text_field(body, "domain")
    ip      = text_field(body, "ip")
    file_hash = text_field(body, "hash")

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
        effective_domain = split_url(url)["hostname"]

    if effective_domain:
        dga_result = transformer_loader.predict_dga(effective_domain)
        dga_score = dga_result.get("threat_score", 0.0)
        all_scores.append(dga_score)
        ioc_results["domain"] = {
            "value": effective_domain,
            "dga_detection": dga_result,
        }

    scored = len(ioc_results)

    # --- IP and hash: described, never scored ---
    if ip:
        ioc_results["ip"] = describe_ip(ip)
    if file_hash:
        ioc_results["hash"] = describe_hash(file_hash)

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

    # No LLM narrative: the in-Space model takes many seconds on CPU and this
    # endpoint is called with short timeouts. The key stays for API compatibility.
    ai_analysis = None

    return {
        "ioc_results": ioc_results,
        "summary": {
            "overall_risk_level": risk_level,
            "overall_threat_score": round(overall_score, 3),
            "risk_score": round(overall_score * 100, 1),
            "indicators_analyzed": scored,
            "indicators_not_scored": [kind for kind in ("ip", "hash") if kind in ioc_results],
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
    body = await json_object(request)
    url = text_field(body, "url")
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
    hostname = split_url(url)["hostname"]
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
      3. Uses the open-source model running in this Space, or the ML-powered
         heuristic analyzer when that model is unavailable.

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
    body = await json_object(request)
    message = text_field(body, "message")
    session_id = text_field(body, "session_id")
    history = dicts_in(list_field(body, "conversation_history"))
    context = object_field(body, "context")

    if not message:
        return JSONResponse(status_code=400, content={"detail": "message required"})

    # ── Build grounding context string and source citations ──────────────
    grounding_lines: List[str] = []
    sources: List[Dict] = []

    # System telemetry
    telemetry = object_field(context, "telemetry")
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
    recent_scans = dicts_in(list_field(context, "recent_scans"))
    if recent_scans:
        scan_summary = "; ".join(
            f"{s.get('url', 'unknown')} → {s.get('category', '?')} (score {s.get('risk_score', '?')}/100)"
            for s in recent_scans[:5]
        )
        grounding_lines.append(f"RECENT URL SCANS (last 5): {scan_summary}")
        sources.append({"type": "scan_history", "label": "Recent Scans", "value": f"{len(recent_scans)} scans"})

    # Active threats
    active_threats = dicts_in(list_field(context, "active_threats"))
    if active_threats:
        threat_summary = "; ".join(
            f"{t.get('type', '?')} [{t.get('severity', '?')}] from {t.get('source', '?')}"
            for t in active_threats[:5]
        )
        grounding_lines.append(f"ACTIVE THREATS: {threat_summary}")
        sources.append({"type": "threats", "label": "Active Threats", "value": f"{len(active_threats)} active"})

    # Behavioral alerts
    behavioral_alerts = dicts_in(list_field(context, "behavioral_alerts"))
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
            f"{str(h.get('role') or '?').upper()}: {str(h.get('content',''))[:300]}"
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

    # The open-source model in this Space answers; if it cannot, the ML
    # heuristic below does.
    llm_result = await run_in_threadpool(transformer_loader.security_chat, enriched_message, 600)
    if llm_result.get("response") and not llm_result.get("error"):
        text = llm_result["response"]
        risk_level = stated_risk(text) or "low"
        risk_score = {"critical": 85.0, "high": 70.0, "medium": 45.0, "low": 20.0}[risk_level]
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
            "model_used": llm_result.get("model_id", LOCAL_LLM_REPO),
            "session_id": session_id,
            "sources": sources,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Path 3: ML heuristic fallback (always available)
    fallback = reasoning_service._fallback(enriched_message)
    # Override with ML scan risk if available
    if detected_risk_score > 0:
        ml_score_100 = round(detected_risk_score * 100, 1)
        if ml_score_100 > fallback.get("risk_score", 0):
            fallback["risk_score"] = ml_score_100
            fallback["risk_level"] = detected_risk_level
    fallback["session_id"] = session_id
    fallback["sources"] = sources
    return fallback


def as_reasoning_text(result: Dict, executed: Optional[bool] = None) -> Dict:
    """Mark an answer as text from the language model, or from the rule-based
    summary written when it does not answer: not a trained detector's verdict,
    and not an action carried out (V2-ML02)."""
    out = dict(result)
    out["result_kind"] = "reasoning_text"
    out["engine"] = "rule_based_summary" if result.get("model_used") == "cyberforge-ml-fallback" else "language_model"
    if executed is not None:
        out["executed"] = executed
    return out


@api.post("/api/analysis/network")
async def api_analyze_network(request: Request):
    """Network traffic analysis – called by backend mlService.analyzeNetworkTraffic()"""
    body = await json_object(request)
    traffic_data = body.get("traffic_data", {})
    result = await run_in_threadpool(
        reasoning_service.analyze,
        f"Analyze this network traffic for security threats:\n{json.dumps(traffic_data, indent=1)[:3000]}",
    )
    # Text about the traffic, not a trained network-intrusion detector.
    return as_reasoning_text(result)


@api.post("/api/ai/execute-task")
async def api_execute_task(request: Request):
    """AI task execution – called by backend mlService.executeAITask()"""
    body = await json_object(request)
    task_type = text_field(body, "task_type")
    task_data = body.get("task_data", {})
    result = await run_in_threadpool(
        reasoning_service.analyze,
        f"Execute cybersecurity task '{task_type}':\n{json.dumps(task_data, indent=1)[:3000]}",
    )
    # Text about the task. Nothing is carried out here, so there is no receipt.
    return as_reasoning_text(result, executed=False)


@api.post("/api/browser/analyze")
async def api_analyze_browser(request: Request):
    """Browser session analysis"""
    body = await json_object(request)
    session = body.get("session_data", body)
    result = await run_in_threadpool(
        reasoning_service.analyze,
        f"Analyze this browser session for security threats:\n{json.dumps(session, indent=1)[:3000]}",
    )
    return as_reasoning_text(result)


@api.post("/api/threat-feeds/analyze")
async def api_analyze_threat_feed(request: Request):
    """Threat feed analysis"""
    body = await json_object(request)
    result = await run_in_threadpool(
        reasoning_service.analyze,
        f"Analyze this threat feed:\n{json.dumps(body, indent=1)[:3000]}",
    )
    return as_reasoning_text(result)


# ============================================================================
# LANDING PAGE  (static; the service has no interactive UI)
# ============================================================================

LANDING_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CyberForge ML service</title>
<style>body{font-family:system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#1b1f24;background:#fff}
code{background:#f1f3f5;padding:0 .25rem;border-radius:3px}</style></head>
<body><h1>CyberForge ML service</h1>
<p>This Space serves the detection models and the security chat model to the CyberForge backend.
It has no interactive interface: it does not run notebooks, train on uploaded data, or load uploaded models.</p>
<p><code>GET /health</code> is public. Every other route needs the service key held by the backend,
and model training needs the Space owner's token.</p>
<p>Source: <a href="https://github.com/Che237/cyberforge">github.com/Che237/cyberforge</a></p>
</body></html>"""


@api.get("/", response_class=HTMLResponse)
async def landing():
    return LANDING_HTML


# ============================================================================
# MAIN
# ============================================================================

# Initialize services at startup
logger.info("🚀 Initializing CyberForge AI services...")
ml_loader.initialize()
# Load the chat model in the background so the API answers health checks at once
threading.Thread(target=local_llm.load, name="local-llm-loader", daemon=True).start()
logger.info("✅ Services initialized")

app = api

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
