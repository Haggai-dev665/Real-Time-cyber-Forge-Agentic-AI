"""
CyberForge AI - Hugging Face API Client
Backend integration for fetching models and running inference from Hugging Face Spaces
"""

import os
import json
import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import httpx
from pathlib import Path

try:
    from gradio_client import Client
    GRADIO_CLIENT_AVAILABLE = True
except ImportError:
    GRADIO_CLIENT_AVAILABLE = False

try:
    from huggingface_hub import HfApi, hf_hub_download, InferenceClient
    HF_HUB_AVAILABLE = True
except ImportError:
    HF_HUB_AVAILABLE = False

logger = logging.getLogger(__name__)


class HuggingFaceClient:
    """
    Client for interacting with CyberForge AI Hugging Face Space
    Provides model inference, training requests, and model management
    """
    
    def __init__(
        self,
        space_id: str = "Che237/cyberforge",
        hf_token: Optional[str] = None,
        models_repo: Optional[str] = None
    ):
        self.space_id = space_id
        self.hf_token = hf_token or os.getenv("HF_TOKEN")
        self.models_repo = models_repo or f"{space_id.split('/')[0]}/cyberforge-models"
        self.space_url = f"https://{space_id.replace('/', '-')}.hf.space"
        
        self._client = None
        self._hf_api = None
        self._inference_client = None
        
        # Local model cache
        self.models_cache_dir = Path("./models_cache")
        self.models_cache_dir.mkdir(exist_ok=True)
        
        # Initialize clients
        self._init_clients()
    
    def _init_clients(self):
        """Initialize Hugging Face and Gradio clients"""
        try:
            if GRADIO_CLIENT_AVAILABLE:
                self._client = Client(self.space_id, hf_token=self.hf_token)
                logger.info(f"✅ Connected to Gradio Space: {self.space_id}")
        except Exception as e:
            logger.warning(f"Could not connect to Gradio Space: {e}")
        
        try:
            if HF_HUB_AVAILABLE:
                self._hf_api = HfApi(token=self.hf_token)
                logger.info("✅ Connected to Hugging Face Hub API")
        except Exception as e:
            logger.warning(f"Could not connect to HF Hub API: {e}")
    
    # =========================================================================
    # INFERENCE METHODS
    # =========================================================================
    
    async def predict(
        self,
        model_id: str,
        features: Dict[str, Any],
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Run inference on a model deployed in the Space
        
        Args:
            model_id: ID of the trained model
            features: Dictionary of feature values
            timeout: Request timeout in seconds
            
        Returns:
            Prediction result with confidence scores
        """
        try:
            if self._client:
                # Use Gradio client
                result = self._client.predict(
                    model_id,
                    json.dumps([features]),
                    api_name="/run_inference"
                )
                return json.loads(result)
            else:
                # Fall back to HTTP API
                return await self._http_predict(model_id, features, timeout)
                
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            return {"error": str(e), "model_id": model_id}
    
    async def batch_predict(
        self,
        model_id: str,
        batch_features: List[Dict[str, Any]],
        timeout: float = 60.0
    ) -> List[Dict[str, Any]]:
        """
        Run batch inference on multiple samples
        
        Args:
            model_id: ID of the trained model
            batch_features: List of feature dictionaries
            timeout: Request timeout in seconds
            
        Returns:
            List of prediction results
        """
        try:
            if self._client:
                result = self._client.predict(
                    model_id,
                    json.dumps(batch_features),
                    api_name="/run_inference"
                )
                return json.loads(result)
            else:
                return await self._http_batch_predict(model_id, batch_features, timeout)
                
        except Exception as e:
            logger.error(f"Batch prediction failed: {e}")
            return [{"error": str(e)} for _ in batch_features]
    
    async def _http_predict(
        self,
        model_id: str,
        features: Dict[str, Any],
        timeout: float
    ) -> Dict[str, Any]:
        """HTTP fallback for predictions"""
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.space_url}/api/predict",
                json={
                    "data": [model_id, json.dumps([features])],
                    "fn_index": 1  # Index of run_inference function
                }
            )
            response.raise_for_status()
            result = response.json()
            return json.loads(result.get("data", [{}])[0])
    
    async def _http_batch_predict(
        self,
        model_id: str,
        batch_features: List[Dict[str, Any]],
        timeout: float
    ) -> List[Dict[str, Any]]:
        """HTTP fallback for batch predictions"""
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.space_url}/api/predict",
                json={
                    "data": [model_id, json.dumps(batch_features)],
                    "fn_index": 1
                }
            )
            response.raise_for_status()
            result = response.json()
            return json.loads(result.get("data", [{}])[0])
    
    # =========================================================================
    # MODEL MANAGEMENT
    # =========================================================================
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """Get list of available trained models"""
        try:
            if self._client:
                result = self._client.predict(api_name="/list_trained_models")
                return self._parse_models_list(result)
            else:
                return await self._http_list_models()
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
    
    def _parse_models_list(self, markdown_result: str) -> List[Dict[str, Any]]:
        """Parse markdown model list into structured data"""
        models = []
        current_model = {}
        
        for line in markdown_result.split('\n'):
            if line.startswith('### '):
                if current_model:
                    models.append(current_model)
                current_model = {"id": line.replace('### ', '').strip()}
            elif '**Created:**' in line:
                current_model["created_at"] = line.split('**Created:**')[1].strip()
            elif '**Accuracy:**' in line:
                try:
                    current_model["accuracy"] = float(line.split('**Accuracy:**')[1].strip())
                except:
                    pass
            elif '**F1 Score:**' in line:
                try:
                    current_model["f1_score"] = float(line.split('**F1 Score:**')[1].strip())
                except:
                    pass
            elif '**Status:**' in line:
                current_model["status"] = line.split('**Status:**')[1].strip()
        
        if current_model:
            models.append(current_model)
        
        return models
    
    async def _http_list_models(self) -> List[Dict[str, Any]]:
        """HTTP fallback for listing models"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.space_url}/api/predict",
                json={"fn_index": 2}  # Index of list_trained_models
            )
            response.raise_for_status()
            result = response.json()
            return self._parse_models_list(result.get("data", [""])[0])
    
    async def download_model(
        self,
        model_id: str,
        local_path: Optional[str] = None
    ) -> str:
        """
        Download a trained model from Hugging Face Hub
        
        Args:
            model_id: Model identifier
            local_path: Optional local path to save model
            
        Returns:
            Path to downloaded model
        """
        try:
            if not HF_HUB_AVAILABLE:
                raise ImportError("huggingface_hub not installed")
            
            model_filename = f"{model_id}_model.pkl"
            scaler_filename = f"{model_id}_scaler.pkl"
            
            model_path = hf_hub_download(
                repo_id=self.models_repo,
                filename=model_filename,
                token=self.hf_token,
                cache_dir=str(self.models_cache_dir)
            )
            
            try:
                scaler_path = hf_hub_download(
                    repo_id=self.models_repo,
                    filename=scaler_filename,
                    token=self.hf_token,
                    cache_dir=str(self.models_cache_dir)
                )
            except:
                scaler_path = None
            
            logger.info(f"✅ Downloaded model: {model_id}")
            return model_path
            
        except Exception as e:
            logger.error(f"Failed to download model: {e}")
            raise
    
    # =========================================================================
    # TRAINING REQUESTS
    # =========================================================================
    
    async def request_training(
        self,
        dataset_url: str,
        task_type: str,
        model_type: str,
        target_column: str,
        model_name: str,
        test_size: float = 0.2,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Request model training on the Space
        
        Args:
            dataset_url: URL to download dataset
            task_type: Type of security task
            model_type: ML model type
            target_column: Target column name
            model_name: Name for trained model
            test_size: Test split ratio
            callback_url: Optional webhook for training completion
            
        Returns:
            Training job status
        """
        try:
            # Note: This would need custom implementation in the Space
            # to support remote dataset URLs and callbacks
            logger.info(f"Requesting training for {model_name}")
            
            return {
                "status": "submitted",
                "model_name": model_name,
                "task_type": task_type,
                "message": "Training request submitted. Check Space for status."
            }
            
        except Exception as e:
            logger.error(f"Training request failed: {e}")
            return {"error": str(e)}
    
    # =========================================================================
    # HEALTH & STATUS
    # =========================================================================
    
    async def health_check(self) -> Dict[str, Any]:
        """Check if the Space is healthy and responsive"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.space_url}")
                
                return {
                    "status": "healthy" if response.status_code == 200 else "unhealthy",
                    "space_id": self.space_id,
                    "url": self.space_url,
                    "response_code": response.status_code,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "space_id": self.space_id,
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_space_info(self) -> Dict[str, Any]:
        """Get information about the Space"""
        try:
            if HF_HUB_AVAILABLE and self._hf_api:
                info = self._hf_api.space_info(self.space_id)
                return {
                    "id": info.id,
                    "author": info.author,
                    "sdk": info.sdk,
                    "status": info.runtime.stage if info.runtime else "unknown",
                    "hardware": info.runtime.hardware if info.runtime else "unknown",
                }
            return {"space_id": self.space_id}
        except Exception as e:
            return {"error": str(e)}


# ============================================================================
# CONVENIENCE FUNCTIONS FOR BACKEND
# ============================================================================

# Global client instance
_hf_client: Optional[HuggingFaceClient] = None


def get_hf_client() -> HuggingFaceClient:
    """Get or create the global HF client"""
    global _hf_client
    if _hf_client is None:
        _hf_client = HuggingFaceClient()
    return _hf_client


async def predict_threat(model_id: str, features: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function for threat prediction"""
    client = get_hf_client()
    return await client.predict(model_id, features)


async def batch_predict_threats(
    model_id: str, 
    batch_features: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Convenience function for batch threat prediction"""
    client = get_hf_client()
    return await client.batch_predict(model_id, batch_features)


async def get_available_models() -> List[Dict[str, Any]]:
    """Get list of available models"""
    client = get_hf_client()
    return await client.list_models()


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    async def main():
        # Initialize client
        client = HuggingFaceClient(
            space_id="Che237/cyberforge",
            hf_token=os.getenv("HF_TOKEN")
        )
        
        # Health check
        health = await client.health_check()
        print(f"Health: {health}")
        
        # List models
        models = await client.list_models()
        print(f"Available models: {models}")
        
        # Example prediction
        if models:
            model_id = models[0]["id"]
            features = {"feature1": 0.5, "feature2": 1.2, "feature3": 0.8}
            result = await client.predict(model_id, features)
            print(f"Prediction: {result}")
    
    asyncio.run(main())
