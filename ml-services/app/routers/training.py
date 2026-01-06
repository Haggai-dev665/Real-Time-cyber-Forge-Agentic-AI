"""
Training Router for ML Model Management
Provides endpoints for dataset management, model training, and predictions
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
import asyncio
import json
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response Models
class TrainRequest(BaseModel):
    dataset_id: str = Field(..., description="ID of the dataset to train on")
    model_type: str = Field(default="auto", description="Model type: auto, random_forest, neural_network, deep_learning, pytorch, ensemble")
    hyperparameters: Optional[Dict[str, Any]] = Field(default=None, description="Custom hyperparameters")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Training configuration")

class PredictRequest(BaseModel):
    model_id: str = Field(..., description="ID of the trained model to use")
    data: Dict[str, Any] = Field(..., description="Input data for prediction")
    format: Optional[str] = Field(default="json", description="Output format")

class BatchPredictRequest(BaseModel):
    model_id: str = Field(..., description="ID of the trained model")
    samples: List[Dict[str, Any]] = Field(..., description="List of samples to predict")

class MalwareAnalysisRequest(BaseModel):
    sample: Dict[str, Any] = Field(..., description="Sample to analyze for malware")
    file_hash: Optional[str] = Field(default=None, description="File hash for lookup")

class PhishingAnalysisRequest(BaseModel):
    url: str = Field(..., description="URL to analyze for phishing")
    email_content: Optional[str] = Field(default=None, description="Email content if applicable")

class IntrusionDetectionRequest(BaseModel):
    network_data: Dict[str, Any] = Field(..., description="Network traffic data")
    realtime: Optional[bool] = Field(default=False, description="Real-time detection mode")

class AnomalyDetectionRequest(BaseModel):
    data: Dict[str, Any] = Field(..., description="Data to analyze for anomalies")
    sensitivity: Optional[float] = Field(default=0.5, description="Detection sensitivity 0-1")

# Training state storage (in production, use database)
training_jobs = {}
trained_models = {}

# Available datasets configuration
AVAILABLE_DATASETS = {
    "malware_detection": {
        "id": "malware_detection",
        "name": "Malware Detection Dataset",
        "type": "malware",
        "samples": 50000,
        "features": 78,
        "status": "available",
        "description": "Comprehensive malware detection dataset with PE file features",
        "target": "is_malware"
    },
    "network_intrusion": {
        "id": "network_intrusion",
        "name": "Network Intrusion Detection (NSL-KDD)",
        "type": "network",
        "samples": 125973,
        "features": 41,
        "status": "available",
        "description": "Network intrusion detection dataset with various attack types",
        "target": "attack_type"
    },
    "phishing_detection": {
        "id": "phishing_detection",
        "name": "Phishing Website Detection",
        "type": "phishing",
        "samples": 11055,
        "features": 30,
        "status": "available",
        "description": "Phishing website classification dataset",
        "target": "is_phishing"
    },
    "spam_detection": {
        "id": "spam_detection",
        "name": "Spam Email Detection",
        "type": "spam",
        "samples": 5572,
        "features": 57,
        "status": "available",
        "description": "Email spam classification dataset",
        "target": "is_spam"
    },
    "botnet_detection": {
        "id": "botnet_detection",
        "name": "Botnet Traffic Detection",
        "type": "botnet",
        "samples": 72000,
        "features": 14,
        "status": "available",
        "description": "Botnet traffic patterns detection",
        "target": "is_botnet"
    },
    "vulnerability_assessment": {
        "id": "vulnerability_assessment",
        "name": "Vulnerability Assessment",
        "type": "vulnerability",
        "samples": 20000,
        "features": 25,
        "status": "available",
        "description": "CVE vulnerability severity prediction",
        "target": "severity"
    },
    "dns_tunneling": {
        "id": "dns_tunneling",
        "name": "DNS Tunneling Detection",
        "type": "dns",
        "samples": 30000,
        "features": 18,
        "status": "available",
        "description": "DNS tunneling and exfiltration detection",
        "target": "is_tunneling"
    },
    "cryptomining_detection": {
        "id": "cryptomining_detection",
        "name": "Cryptomining Detection",
        "type": "cryptomining",
        "samples": 15000,
        "features": 22,
        "status": "available",
        "description": "Cryptojacking and mining activity detection",
        "target": "is_mining"
    },
    "web_attack_detection": {
        "id": "web_attack_detection",
        "name": "Web Attack Detection",
        "type": "web_attack",
        "samples": 45000,
        "features": 35,
        "status": "available",
        "description": "SQL injection, XSS, and web attack detection",
        "target": "attack_type"
    },
    "threat_intelligence": {
        "id": "threat_intelligence",
        "name": "Threat Intelligence Feeds",
        "type": "threat_intel",
        "samples": 100000,
        "features": 20,
        "status": "available",
        "description": "Known threat indicators and IOCs",
        "target": "threat_type"
    },
    "anomaly_detection": {
        "id": "anomaly_detection",
        "name": "Network Anomaly Detection",
        "type": "anomaly",
        "samples": 80000,
        "features": 28,
        "status": "available",
        "description": "Unsupervised anomaly detection in network traffic",
        "target": "is_anomaly"
    }
}

# Available model types
AVAILABLE_MODELS = {
    "random_forest": {
        "id": "random_forest",
        "name": "Random Forest Classifier",
        "type": "ensemble",
        "framework": "sklearn",
        "status": "ready",
        "description": "Fast and accurate ensemble classifier"
    },
    "gradient_boosting": {
        "id": "gradient_boosting",
        "name": "Gradient Boosting Classifier",
        "type": "ensemble",
        "framework": "sklearn",
        "status": "ready",
        "description": "High accuracy gradient boosting model"
    },
    "neural_network": {
        "id": "neural_network",
        "name": "Neural Network (MLP)",
        "type": "neural_network",
        "framework": "sklearn",
        "status": "ready",
        "description": "Multi-layer perceptron classifier"
    },
    "deep_learning": {
        "id": "deep_learning",
        "name": "Deep Neural Network",
        "type": "deep_learning",
        "framework": "tensorflow",
        "status": "ready",
        "description": "TensorFlow deep learning model"
    },
    "pytorch_model": {
        "id": "pytorch_model",
        "name": "PyTorch Neural Network",
        "type": "deep_learning",
        "framework": "pytorch",
        "status": "ready",
        "description": "PyTorch-based neural network"
    },
    "svm": {
        "id": "svm",
        "name": "Support Vector Machine",
        "type": "classical",
        "framework": "sklearn",
        "status": "ready",
        "description": "SVM classifier for smaller datasets"
    },
    "ensemble": {
        "id": "ensemble",
        "name": "Ensemble Model",
        "type": "ensemble",
        "framework": "custom",
        "status": "ready",
        "description": "Combined predictions from multiple models"
    }
}

# ============== DATASET ENDPOINTS ==============

@router.get("/datasets")
async def get_datasets():
    """Get list of all available datasets"""
    datasets = []
    for dataset_id, info in AVAILABLE_DATASETS.items():
        datasets.append({
            **info,
            "downloadUrl": f"/api/training/datasets/{dataset_id}/download",
            "previewUrl": f"/api/training/datasets/{dataset_id}/preview"
        })
    return {
        "success": True,
        "datasets": datasets,
        "total": len(datasets),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/datasets/{dataset_id}")
async def get_dataset_details(dataset_id: str):
    """Get detailed information about a specific dataset"""
    if dataset_id not in AVAILABLE_DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    
    dataset = AVAILABLE_DATASETS[dataset_id]
    
    # Enhanced dataset details
    return {
        "success": True,
        "dataset": {
            **dataset,
            "schema": _get_dataset_schema(dataset_id),
            "statistics": _get_dataset_statistics(dataset_id),
            "sampleData": _get_sample_data(dataset_id, limit=5)
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/datasets/{dataset_id}/download")
async def download_dataset(dataset_id: str):
    """Download dataset or get download info"""
    if dataset_id not in AVAILABLE_DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    
    # In production, this would return actual file or presigned URL
    return {
        "success": True,
        "dataset_id": dataset_id,
        "status": "ready",
        "format": "csv",
        "size_mb": AVAILABLE_DATASETS[dataset_id]["samples"] * 0.001,  # Approximate
        "download_url": f"/data/{dataset_id}.csv",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/datasets/{dataset_id}/preview")
async def preview_dataset(dataset_id: str, limit: int = Query(default=10, le=100)):
    """Preview dataset samples"""
    if dataset_id not in AVAILABLE_DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    
    return {
        "success": True,
        "dataset_id": dataset_id,
        "samples": _get_sample_data(dataset_id, limit=limit),
        "schema": _get_dataset_schema(dataset_id),
        "timestamp": datetime.utcnow().isoformat()
    }

# ============== MODEL ENDPOINTS ==============

@router.get("/models")
async def get_models():
    """Get list of all available model types and trained models"""
    # Combine available model types with trained models
    all_models = []
    
    # Add base model types
    for model_id, info in AVAILABLE_MODELS.items():
        all_models.append({
            **info,
            "trained_instances": _get_trained_instances(model_id)
        })
    
    # Add trained models
    for job_id, job in trained_models.items():
        if job.get("status") == "completed":
            all_models.append({
                "id": job_id,
                "name": f"Trained {job.get('model_type', 'Unknown')}",
                "type": "trained",
                "dataset": job.get("dataset_id"),
                "status": "ready",
                "accuracy": job.get("metrics", {}).get("accuracy", 0),
                "trained_at": job.get("completed_at")
            })
    
    return {
        "success": True,
        "models": all_models,
        "total": len(all_models),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/models/{model_id}")
async def get_model_details(model_id: str):
    """Get detailed information about a specific model"""
    # Check if it's a base model type
    if model_id in AVAILABLE_MODELS:
        return {
            "success": True,
            "model": {
                **AVAILABLE_MODELS[model_id],
                "hyperparameters": _get_default_hyperparameters(model_id),
                "trained_instances": _get_trained_instances(model_id)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    # Check trained models
    if model_id in trained_models:
        return {
            "success": True,
            "model": trained_models[model_id],
            "timestamp": datetime.utcnow().isoformat()
        }
    
    raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

@router.get("/models/{model_id}/metrics")
async def get_model_metrics(model_id: str):
    """Get performance metrics for a trained model"""
    if model_id in trained_models:
        job = trained_models[model_id]
        return {
            "success": True,
            "model_id": model_id,
            "metrics": job.get("metrics", {}),
            "training_history": job.get("training_history", []),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    raise HTTPException(status_code=404, detail=f"Trained model '{model_id}' not found")

# ============== TRAINING ENDPOINTS ==============

@router.post("/train")
async def train_model(request: TrainRequest, background_tasks: BackgroundTasks):
    """Start training a model on a dataset"""
    if request.dataset_id not in AVAILABLE_DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found")
    
    # Generate training job ID
    job_id = f"train_{request.dataset_id}_{request.model_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    # Initialize training job
    training_jobs[job_id] = {
        "id": job_id,
        "dataset_id": request.dataset_id,
        "model_type": request.model_type,
        "hyperparameters": request.hyperparameters,
        "config": request.config,
        "status": "queued",
        "progress": 0,
        "started_at": datetime.utcnow().isoformat(),
        "logs": []
    }
    
    # Start training in background
    background_tasks.add_task(_run_training, job_id)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued",
        "message": f"Training job started for {request.dataset_id} with {request.model_type}",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/train/{job_id}/status")
async def get_training_status(job_id: str):
    """Get status of a training job"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' not found")
    
    return {
        "success": True,
        "job": training_jobs[job_id],
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/train/history")
async def get_training_history(limit: int = Query(default=20, le=100)):
    """Get training history for all jobs"""
    history = sorted(
        training_jobs.values(),
        key=lambda x: x.get("started_at", ""),
        reverse=True
    )[:limit]
    
    return {
        "success": True,
        "history": history,
        "total": len(training_jobs),
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/train/{job_id}/stop")
async def stop_training(job_id: str):
    """Stop a running training job"""
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' not found")
    
    job = training_jobs[job_id]
    if job["status"] in ["completed", "failed", "stopped"]:
        raise HTTPException(status_code=400, detail=f"Job is already {job['status']}")
    
    training_jobs[job_id]["status"] = "stopping"
    training_jobs[job_id]["logs"].append({
        "time": datetime.utcnow().isoformat(),
        "message": "Stop requested by user"
    })
    
    return {
        "success": True,
        "message": f"Stop requested for job {job_id}",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/evaluate/{model_id}")
async def evaluate_model(model_id: str, dataset_id: Optional[str] = None):
    """Evaluate a trained model on test data"""
    if model_id not in trained_models:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    
    model = trained_models[model_id]
    eval_dataset = dataset_id or model.get("dataset_id")
    
    # Simulate evaluation
    evaluation = {
        "model_id": model_id,
        "dataset_id": eval_dataset,
        "metrics": {
            "accuracy": model.get("metrics", {}).get("accuracy", 0.95),
            "precision": model.get("metrics", {}).get("precision", 0.94),
            "recall": model.get("metrics", {}).get("recall", 0.93),
            "f1_score": model.get("metrics", {}).get("f1_score", 0.935),
            "auc_roc": model.get("metrics", {}).get("auc_roc", 0.97)
        },
        "confusion_matrix": [[850, 50], [45, 855]],
        "evaluated_at": datetime.utcnow().isoformat()
    }
    
    return {
        "success": True,
        "evaluation": evaluation,
        "timestamp": datetime.utcnow().isoformat()
    }

# ============== PREDICTION ENDPOINTS ==============

@router.post("/predict")
async def predict(request: PredictRequest):
    """Make prediction using a trained model"""
    model_id = request.model_id
    
    # Find the model (either in trained_models or use default)
    if model_id not in trained_models and model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    
    # Simulate prediction
    prediction = _make_prediction(model_id, request.data)
    
    return {
        "success": True,
        "prediction": prediction,
        "model_id": model_id,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/predict/batch")
async def batch_predict(request: BatchPredictRequest):
    """Make batch predictions"""
    model_id = request.model_id
    
    if model_id not in trained_models and model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    
    predictions = []
    for sample in request.samples:
        pred = _make_prediction(model_id, sample)
        predictions.append(pred)
    
    return {
        "success": True,
        "predictions": predictions,
        "model_id": model_id,
        "count": len(predictions),
        "timestamp": datetime.utcnow().isoformat()
    }

# ============== THREAT DETECTION ENDPOINTS ==============

@router.post("/detect/malware")
async def detect_malware(request: MalwareAnalysisRequest):
    """Detect malware in a sample"""
    sample = request.sample
    
    # Simulate malware detection
    import random
    is_malware = random.random() > 0.7  # Demo purposes
    confidence = random.uniform(0.7, 0.99) if is_malware else random.uniform(0.8, 0.99)
    
    return {
        "success": True,
        "result": {
            "is_malware": is_malware,
            "confidence": confidence,
            "malware_type": "Trojan.Generic" if is_malware else None,
            "severity": "high" if is_malware else "none",
            "indicators": _get_malware_indicators(sample) if is_malware else [],
            "recommendations": _get_malware_recommendations(is_malware)
        },
        "sample_hash": request.file_hash,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/detect/phishing")
async def detect_phishing(request: PhishingAnalysisRequest):
    """Detect phishing attempts in URL or content"""
    url = request.url
    
    # Simulate phishing detection
    import random
    
    # Check for suspicious patterns
    suspicious_keywords = ["login", "verify", "update", "confirm", "bank", "paypal"]
    is_suspicious = any(kw in url.lower() for kw in suspicious_keywords)
    
    is_phishing = is_suspicious and random.random() > 0.4
    confidence = random.uniform(0.75, 0.98) if is_phishing else random.uniform(0.85, 0.99)
    
    return {
        "success": True,
        "result": {
            "is_phishing": is_phishing,
            "confidence": confidence,
            "risk_score": confidence if is_phishing else 1 - confidence,
            "indicators": _get_phishing_indicators(url) if is_phishing else [],
            "url_analysis": {
                "domain": _extract_domain(url),
                "suspicious_patterns": is_suspicious,
                "ssl_valid": "https" in url.lower()
            },
            "recommendations": _get_phishing_recommendations(is_phishing)
        },
        "url": url,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/detect/intrusion")
async def detect_intrusion(request: IntrusionDetectionRequest):
    """Detect network intrusions"""
    network_data = request.network_data
    
    # Simulate intrusion detection
    import random
    
    is_intrusion = random.random() > 0.6
    confidence = random.uniform(0.8, 0.99) if is_intrusion else random.uniform(0.85, 0.99)
    
    attack_types = ["DoS", "Probe", "R2L", "U2R", "DDoS", "PortScan"]
    detected_attack = random.choice(attack_types) if is_intrusion else None
    
    return {
        "success": True,
        "result": {
            "is_intrusion": is_intrusion,
            "confidence": confidence,
            "attack_type": detected_attack,
            "severity": _get_severity(confidence) if is_intrusion else "none",
            "source_ip": network_data.get("src_ip", "unknown"),
            "destination_ip": network_data.get("dst_ip", "unknown"),
            "indicators": _get_intrusion_indicators(network_data) if is_intrusion else [],
            "recommendations": _get_intrusion_recommendations(is_intrusion, detected_attack)
        },
        "realtime": request.realtime,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/detect/anomaly")
async def detect_anomaly(request: AnomalyDetectionRequest):
    """Detect anomalies in data"""
    data = request.data
    sensitivity = request.sensitivity
    
    # Simulate anomaly detection
    import random
    
    is_anomaly = random.random() > (1 - sensitivity)
    confidence = random.uniform(0.75, 0.98) if is_anomaly else random.uniform(0.8, 0.99)
    
    return {
        "success": True,
        "result": {
            "is_anomaly": is_anomaly,
            "confidence": confidence,
            "anomaly_score": confidence if is_anomaly else random.uniform(0.1, 0.3),
            "anomaly_type": "behavioral" if is_anomaly else None,
            "contributing_factors": _get_anomaly_factors(data) if is_anomaly else [],
            "baseline_deviation": random.uniform(2.5, 5.0) if is_anomaly else random.uniform(0.1, 0.5),
            "recommendations": _get_anomaly_recommendations(is_anomaly)
        },
        "sensitivity": sensitivity,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/detect/status")
async def get_detection_status():
    """Get status of all detection models"""
    return {
        "success": True,
        "detectors": {
            "malware": {"status": "active", "model": "random_forest", "accuracy": 0.96},
            "phishing": {"status": "active", "model": "gradient_boosting", "accuracy": 0.94},
            "intrusion": {"status": "active", "model": "deep_learning", "accuracy": 0.97},
            "anomaly": {"status": "active", "model": "autoencoder", "accuracy": 0.92},
            "botnet": {"status": "active", "model": "neural_network", "accuracy": 0.95},
            "dns_tunneling": {"status": "active", "model": "random_forest", "accuracy": 0.93}
        },
        "last_updated": datetime.utcnow().isoformat(),
        "timestamp": datetime.utcnow().isoformat()
    }

# ============== HELPER FUNCTIONS ==============

def _get_dataset_schema(dataset_id: str) -> Dict[str, str]:
    """Get schema for a dataset"""
    schemas = {
        "malware_detection": {
            "file_hash": "string",
            "file_size": "int",
            "entropy": "float",
            "imports_count": "int",
            "exports_count": "int",
            "sections_count": "int",
            "is_malware": "bool"
        },
        "network_intrusion": {
            "duration": "int",
            "protocol_type": "string",
            "service": "string",
            "flag": "string",
            "src_bytes": "int",
            "dst_bytes": "int",
            "attack_type": "string"
        },
        "phishing_detection": {
            "url_length": "int",
            "num_dots": "int",
            "has_https": "bool",
            "domain_age": "int",
            "is_phishing": "bool"
        }
    }
    return schemas.get(dataset_id, {"feature_1": "float", "feature_2": "float", "target": "bool"})

def _get_dataset_statistics(dataset_id: str) -> Dict[str, Any]:
    """Get statistics for a dataset"""
    dataset = AVAILABLE_DATASETS.get(dataset_id, {})
    return {
        "total_samples": dataset.get("samples", 0),
        "features": dataset.get("features", 0),
        "missing_values": 0,
        "class_distribution": {"positive": 0.45, "negative": 0.55}
    }

def _get_sample_data(dataset_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Get sample data from dataset"""
    import random
    samples = []
    for i in range(limit):
        samples.append({
            "id": i + 1,
            "feature_1": round(random.random(), 4),
            "feature_2": round(random.random(), 4),
            "feature_3": round(random.random(), 4),
            "label": random.choice([0, 1])
        })
    return samples

def _get_trained_instances(model_type: str) -> List[Dict[str, Any]]:
    """Get trained instances of a model type"""
    instances = []
    for job_id, job in trained_models.items():
        if job.get("model_type") == model_type:
            instances.append({
                "job_id": job_id,
                "dataset": job.get("dataset_id"),
                "accuracy": job.get("metrics", {}).get("accuracy", 0)
            })
    return instances

def _get_default_hyperparameters(model_type: str) -> Dict[str, Any]:
    """Get default hyperparameters for a model type"""
    hyperparams = {
        "random_forest": {
            "n_estimators": 100,
            "max_depth": 20,
            "min_samples_split": 2,
            "min_samples_leaf": 1
        },
        "gradient_boosting": {
            "n_estimators": 100,
            "learning_rate": 0.1,
            "max_depth": 5
        },
        "neural_network": {
            "hidden_layers": [100, 50],
            "activation": "relu",
            "learning_rate": 0.001
        },
        "deep_learning": {
            "layers": [128, 64, 32],
            "dropout": 0.3,
            "epochs": 50,
            "batch_size": 32
        }
    }
    return hyperparams.get(model_type, {})

async def _run_training(job_id: str):
    """Run training job in background"""
    job = training_jobs[job_id]
    job["status"] = "running"
    job["logs"].append({"time": datetime.utcnow().isoformat(), "message": "Training started"})
    
    try:
        # Simulate training progress
        for progress in range(0, 101, 10):
            if job["status"] == "stopping":
                job["status"] = "stopped"
                return
            
            job["progress"] = progress
            job["logs"].append({
                "time": datetime.utcnow().isoformat(),
                "message": f"Training progress: {progress}%"
            })
            await asyncio.sleep(0.5)  # Simulate work
        
        # Simulate training completion
        import random
        metrics = {
            "accuracy": round(random.uniform(0.92, 0.99), 4),
            "precision": round(random.uniform(0.90, 0.98), 4),
            "recall": round(random.uniform(0.89, 0.97), 4),
            "f1_score": round(random.uniform(0.90, 0.97), 4),
            "auc_roc": round(random.uniform(0.94, 0.99), 4)
        }
        
        job["status"] = "completed"
        job["progress"] = 100
        job["completed_at"] = datetime.utcnow().isoformat()
        job["metrics"] = metrics
        job["logs"].append({
            "time": datetime.utcnow().isoformat(),
            "message": f"Training completed. Accuracy: {metrics['accuracy']}"
        })
        
        # Store trained model
        trained_models[job_id] = job
        
    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["logs"].append({
            "time": datetime.utcnow().isoformat(),
            "message": f"Training failed: {e}"
        })

def _make_prediction(model_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Make a prediction using a model"""
    import random
    
    prediction = random.choice([0, 1])
    probability = random.uniform(0.7, 0.99) if prediction == 1 else random.uniform(0.7, 0.99)
    
    return {
        "prediction": prediction,
        "probability": round(probability, 4),
        "class": "positive" if prediction == 1 else "negative",
        "confidence": round(probability, 4)
    }

def _get_malware_indicators(sample: Dict[str, Any]) -> List[str]:
    """Get malware indicators"""
    return [
        "Suspicious entropy detected",
        "Known malicious import patterns",
        "Packed executable signature",
        "Anti-debugging techniques present"
    ]

def _get_malware_recommendations(is_malware: bool) -> List[str]:
    """Get malware recommendations"""
    if is_malware:
        return [
            "Quarantine the file immediately",
            "Run full system scan",
            "Check for lateral movement",
            "Update malware signatures"
        ]
    return ["File appears clean", "Continue monitoring"]

def _get_phishing_indicators(url: str) -> List[str]:
    """Get phishing indicators"""
    return [
        "Suspicious domain structure",
        "URL mimics legitimate service",
        "Recently registered domain",
        "Contains form submission"
    ]

def _get_phishing_recommendations(is_phishing: bool) -> List[str]:
    """Get phishing recommendations"""
    if is_phishing:
        return [
            "Block access to this URL",
            "Report to security team",
            "Alert affected users",
            "Update phishing filters"
        ]
    return ["URL appears legitimate", "Continue monitoring"]

def _get_intrusion_indicators(network_data: Dict[str, Any]) -> List[str]:
    """Get intrusion indicators"""
    return [
        "Unusual traffic pattern detected",
        "Connection from suspicious IP",
        "Port scan activity detected",
        "Abnormal packet sizes"
    ]

def _get_intrusion_recommendations(is_intrusion: bool, attack_type: Optional[str]) -> List[str]:
    """Get intrusion recommendations"""
    if is_intrusion:
        return [
            f"Block source IP for {attack_type or 'unknown'} attack",
            "Enable enhanced logging",
            "Review firewall rules",
            "Notify security operations"
        ]
    return ["Traffic appears normal", "Continue monitoring"]

def _get_anomaly_factors(data: Dict[str, Any]) -> List[str]:
    """Get anomaly contributing factors"""
    return [
        "Deviation from baseline behavior",
        "Unusual time of activity",
        "Abnormal resource usage",
        "Pattern inconsistency detected"
    ]

def _get_anomaly_recommendations(is_anomaly: bool) -> List[str]:
    """Get anomaly recommendations"""
    if is_anomaly:
        return [
            "Investigate anomalous behavior",
            "Check for compromised accounts",
            "Review recent changes",
            "Increase monitoring sensitivity"
        ]
    return ["Behavior within normal range", "Continue monitoring"]

def _get_severity(confidence: float) -> str:
    """Get severity based on confidence"""
    if confidence > 0.9:
        return "critical"
    elif confidence > 0.8:
        return "high"
    elif confidence > 0.6:
        return "medium"
    return "low"

def _extract_domain(url: str) -> str:
    """Extract domain from URL"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url if url.startswith("http") else f"http://{url}")
        return parsed.netloc or url.split("/")[0]
    except:
        return url
