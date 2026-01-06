"""
Model Registry Service
Manages trained ML models, versioning, and deployment
"""
import json
import joblib
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import hashlib
import shutil

logger = logging.getLogger(__name__)

class ModelRegistry:
    """
    Central registry for managing trained ML models
    Handles model versioning, storage, and retrieval
    """
    
    def __init__(self, models_dir: str = "./models", registry_file: str = "model_registry.json"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        self.registry_file = self.models_dir / registry_file
        self.registry = self._load_registry()
        
    def _load_registry(self) -> Dict[str, Any]:
        """Load the model registry from file"""
        if self.registry_file.exists():
            try:
                with open(self.registry_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load model registry: {e}")
                return self._create_empty_registry()
        return self._create_empty_registry()
    
    def _create_empty_registry(self) -> Dict[str, Any]:
        """Create an empty registry structure"""
        return {
            "version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "models": {},
            "deployments": {},
            "training_history": []
        }
    
    def _save_registry(self):
        """Save the registry to file"""
        try:
            self.registry["updated_at"] = datetime.utcnow().isoformat()
            with open(self.registry_file, 'w') as f:
                json.dump(self.registry, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save model registry: {e}")
    
    def register_model(
        self,
        model_id: str,
        model_type: str,
        dataset_id: str,
        model_path: str,
        metrics: Dict[str, float],
        hyperparameters: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Register a trained model in the registry
        
        Args:
            model_id: Unique identifier for the model
            model_type: Type of model (random_forest, neural_network, etc.)
            dataset_id: ID of the dataset used for training
            model_path: Path to the saved model file
            metrics: Model performance metrics
            hyperparameters: Training hyperparameters
            metadata: Additional metadata
            
        Returns:
            Registered model information
        """
        # Generate version
        version = self._get_next_version(model_id)
        
        # Create model entry
        model_entry = {
            "model_id": model_id,
            "version": version,
            "model_type": model_type,
            "dataset_id": dataset_id,
            "model_path": model_path,
            "metrics": metrics,
            "hyperparameters": hyperparameters or {},
            "metadata": metadata or {},
            "registered_at": datetime.utcnow().isoformat(),
            "status": "registered",
            "is_active": True,
            "deployment_status": "not_deployed"
        }
        
        # Store in registry
        if model_id not in self.registry["models"]:
            self.registry["models"][model_id] = {
                "versions": {},
                "latest_version": version,
                "created_at": datetime.utcnow().isoformat()
            }
        
        self.registry["models"][model_id]["versions"][version] = model_entry
        self.registry["models"][model_id]["latest_version"] = version
        
        # Add to training history
        self.registry["training_history"].append({
            "model_id": model_id,
            "version": version,
            "dataset_id": dataset_id,
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        })
        
        self._save_registry()
        logger.info(f"Registered model {model_id} version {version}")
        
        return model_entry
    
    def _get_next_version(self, model_id: str) -> str:
        """Get the next version number for a model"""
        if model_id not in self.registry["models"]:
            return "1.0.0"
        
        latest = self.registry["models"][model_id].get("latest_version", "0.0.0")
        parts = latest.split(".")
        try:
            parts[-1] = str(int(parts[-1]) + 1)
            return ".".join(parts)
        except:
            return "1.0.0"
    
    def get_model(self, model_id: str, version: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get model information from the registry
        
        Args:
            model_id: Model identifier
            version: Specific version (uses latest if not specified)
            
        Returns:
            Model information or None if not found
        """
        if model_id not in self.registry["models"]:
            return None
        
        model_data = self.registry["models"][model_id]
        
        if version is None:
            version = model_data.get("latest_version")
        
        return model_data["versions"].get(version)
    
    def load_model(self, model_id: str, version: Optional[str] = None) -> Optional[Any]:
        """
        Load a trained model from disk
        
        Args:
            model_id: Model identifier
            version: Specific version (uses latest if not specified)
            
        Returns:
            Loaded model object or None
        """
        model_info = self.get_model(model_id, version)
        if not model_info:
            logger.error(f"Model {model_id} not found in registry")
            return None
        
        model_path = Path(model_info["model_path"])
        if not model_path.exists():
            logger.error(f"Model file not found: {model_path}")
            return None
        
        try:
            model = joblib.load(model_path)
            logger.info(f"Loaded model {model_id} version {model_info['version']}")
            return model
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {e}")
            return None
    
    def list_models(self, filter_type: Optional[str] = None, filter_dataset: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all registered models
        
        Args:
            filter_type: Filter by model type
            filter_dataset: Filter by dataset
            
        Returns:
            List of model summaries
        """
        models = []
        
        for model_id, model_data in self.registry["models"].items():
            latest_version = model_data.get("latest_version")
            if latest_version and latest_version in model_data["versions"]:
                model_info = model_data["versions"][latest_version]
                
                # Apply filters
                if filter_type and model_info.get("model_type") != filter_type:
                    continue
                if filter_dataset and model_info.get("dataset_id") != filter_dataset:
                    continue
                
                models.append({
                    "model_id": model_id,
                    "latest_version": latest_version,
                    "model_type": model_info.get("model_type"),
                    "dataset_id": model_info.get("dataset_id"),
                    "metrics": model_info.get("metrics", {}),
                    "registered_at": model_info.get("registered_at"),
                    "status": model_info.get("status"),
                    "deployment_status": model_info.get("deployment_status"),
                    "version_count": len(model_data["versions"])
                })
        
        return models
    
    def get_model_versions(self, model_id: str) -> List[Dict[str, Any]]:
        """Get all versions of a model"""
        if model_id not in self.registry["models"]:
            return []
        
        versions = []
        for version, info in self.registry["models"][model_id]["versions"].items():
            versions.append({
                "version": version,
                "metrics": info.get("metrics", {}),
                "registered_at": info.get("registered_at"),
                "status": info.get("status")
            })
        
        return sorted(versions, key=lambda x: x["version"], reverse=True)
    
    def deploy_model(self, model_id: str, version: Optional[str] = None, environment: str = "production") -> Dict[str, Any]:
        """
        Deploy a model for inference
        
        Args:
            model_id: Model identifier
            version: Version to deploy (uses latest if not specified)
            environment: Deployment environment
            
        Returns:
            Deployment information
        """
        model_info = self.get_model(model_id, version)
        if not model_info:
            raise ValueError(f"Model {model_id} not found")
        
        version = model_info["version"]
        deployment_id = f"{model_id}_{version}_{environment}"
        
        # Update model deployment status
        self.registry["models"][model_id]["versions"][version]["deployment_status"] = "deployed"
        self.registry["models"][model_id]["versions"][version]["deployed_at"] = datetime.utcnow().isoformat()
        self.registry["models"][model_id]["versions"][version]["deployment_environment"] = environment
        
        # Add to deployments
        self.registry["deployments"][deployment_id] = {
            "deployment_id": deployment_id,
            "model_id": model_id,
            "version": version,
            "environment": environment,
            "deployed_at": datetime.utcnow().isoformat(),
            "status": "active"
        }
        
        self._save_registry()
        logger.info(f"Deployed model {model_id} version {version} to {environment}")
        
        return self.registry["deployments"][deployment_id]
    
    def undeploy_model(self, model_id: str, version: Optional[str] = None, environment: str = "production") -> bool:
        """Undeploy a model from an environment"""
        model_info = self.get_model(model_id, version)
        if not model_info:
            return False
        
        version = model_info["version"]
        deployment_id = f"{model_id}_{version}_{environment}"
        
        if deployment_id in self.registry["deployments"]:
            self.registry["deployments"][deployment_id]["status"] = "inactive"
            self.registry["deployments"][deployment_id]["undeployed_at"] = datetime.utcnow().isoformat()
            
            self.registry["models"][model_id]["versions"][version]["deployment_status"] = "not_deployed"
            
            self._save_registry()
            return True
        
        return False
    
    def get_active_deployments(self) -> List[Dict[str, Any]]:
        """Get all active model deployments"""
        return [
            d for d in self.registry["deployments"].values()
            if d.get("status") == "active"
        ]
    
    def get_training_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent training history"""
        history = self.registry.get("training_history", [])
        return sorted(history, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    
    def delete_model(self, model_id: str, version: Optional[str] = None, delete_files: bool = False) -> bool:
        """
        Delete a model from the registry
        
        Args:
            model_id: Model identifier
            version: Specific version (deletes all versions if not specified)
            delete_files: Whether to delete model files from disk
            
        Returns:
            Success status
        """
        if model_id not in self.registry["models"]:
            return False
        
        if version:
            # Delete specific version
            if version in self.registry["models"][model_id]["versions"]:
                model_info = self.registry["models"][model_id]["versions"][version]
                
                if delete_files and "model_path" in model_info:
                    try:
                        Path(model_info["model_path"]).unlink(missing_ok=True)
                    except Exception as e:
                        logger.error(f"Failed to delete model file: {e}")
                
                del self.registry["models"][model_id]["versions"][version]
                
                # Update latest version if needed
                remaining_versions = list(self.registry["models"][model_id]["versions"].keys())
                if remaining_versions:
                    self.registry["models"][model_id]["latest_version"] = sorted(remaining_versions)[-1]
                else:
                    del self.registry["models"][model_id]
        else:
            # Delete all versions
            if delete_files:
                for ver, info in self.registry["models"][model_id]["versions"].items():
                    if "model_path" in info:
                        try:
                            Path(info["model_path"]).unlink(missing_ok=True)
                        except Exception as e:
                            logger.error(f"Failed to delete model file: {e}")
            
            del self.registry["models"][model_id]
        
        self._save_registry()
        return True
    
    def compare_models(self, model_ids: List[str]) -> Dict[str, Any]:
        """
        Compare multiple models' performance metrics
        
        Args:
            model_ids: List of model identifiers to compare
            
        Returns:
            Comparison results
        """
        comparison = {
            "models": [],
            "best_by_metric": {},
            "compared_at": datetime.utcnow().isoformat()
        }
        
        metrics_values = {}
        
        for model_id in model_ids:
            model_info = self.get_model(model_id)
            if model_info:
                comparison["models"].append({
                    "model_id": model_id,
                    "version": model_info["version"],
                    "model_type": model_info["model_type"],
                    "metrics": model_info.get("metrics", {})
                })
                
                for metric, value in model_info.get("metrics", {}).items():
                    if metric not in metrics_values:
                        metrics_values[metric] = []
                    metrics_values[metric].append((model_id, value))
        
        # Find best model for each metric
        for metric, values in metrics_values.items():
            best = max(values, key=lambda x: x[1])
            comparison["best_by_metric"][metric] = {
                "model_id": best[0],
                "value": best[1]
            }
        
        return comparison
    
    def get_model_scaler(self, model_id: str) -> Optional[Any]:
        """Load the scaler associated with a model"""
        scaler_path = self.models_dir / f"{model_id}_scaler.pkl"
        if scaler_path.exists():
            try:
                return joblib.load(scaler_path)
            except Exception as e:
                logger.error(f"Failed to load scaler for {model_id}: {e}")
        return None
    
    def export_model(self, model_id: str, export_path: str, version: Optional[str] = None) -> bool:
        """
        Export a model and its metadata to a specified path
        
        Args:
            model_id: Model identifier
            export_path: Path to export to
            version: Specific version to export
            
        Returns:
            Success status
        """
        model_info = self.get_model(model_id, version)
        if not model_info:
            return False
        
        export_dir = Path(export_path)
        export_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Copy model file
            src_path = Path(model_info["model_path"])
            if src_path.exists():
                shutil.copy(src_path, export_dir / src_path.name)
            
            # Copy scaler if exists
            scaler_path = self.models_dir / f"{model_id}_scaler.pkl"
            if scaler_path.exists():
                shutil.copy(scaler_path, export_dir / scaler_path.name)
            
            # Export metadata
            metadata = {
                "model_info": model_info,
                "exported_at": datetime.utcnow().isoformat()
            }
            with open(export_dir / "metadata.json", 'w') as f:
                json.dump(metadata, f, indent=2, default=str)
            
            return True
        except Exception as e:
            logger.error(f"Failed to export model {model_id}: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics"""
        total_models = len(self.registry["models"])
        total_versions = sum(
            len(m["versions"]) for m in self.registry["models"].values()
        )
        active_deployments = len(self.get_active_deployments())
        
        return {
            "total_models": total_models,
            "total_versions": total_versions,
            "active_deployments": active_deployments,
            "training_runs": len(self.registry.get("training_history", [])),
            "registry_created": self.registry.get("created_at"),
            "registry_updated": self.registry.get("updated_at")
        }


# Singleton instance
model_registry = ModelRegistry()
