"""
Advanced ML Model Trainer for Cybersecurity
Trains and manages multiple ML models for threat detection
"""

import numpy as np
import pandas as pd
import tensorflow as tf
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib
import json
import asyncio
from datetime import datetime
from pathlib import Path
import logging
from typing import Dict, List, Any, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class CyberSecurityMLTrainer:
    def __init__(self, models_dir: str = "./models"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        self.trained_models = {}
        self.scalers = {}
        self.label_encoders = {}
        
    async def train_comprehensive_models(self, dataset_manager) -> Dict[str, Any]:
        """Train comprehensive ML models for all available datasets"""
        results = {}
        available_datasets = dataset_manager.get_available_datasets()
        
        for dataset_id, dataset_info in available_datasets.items():
            if dataset_info.get("status") == "available":
                logger.info(f"Training models for dataset: {dataset_id}")
                try:
                    dataset_results = await self._train_dataset_models(
                        dataset_manager, dataset_id, dataset_info
                    )
                    results[dataset_id] = dataset_results
                except Exception as e:
                    logger.error(f"Failed to train models for {dataset_id}: {e}")
                    results[dataset_id] = {"error": str(e)}
        
        return results
    
    async def _train_dataset_models(self, dataset_manager, dataset_id: str, dataset_info: Dict) -> Dict[str, Any]:
        """Train multiple models for a specific dataset"""
        # Load dataset
        df = await dataset_manager.load_dataset(dataset_id)
        if df is None:
            raise ValueError(f"Could not load dataset {dataset_id}")
        
        # Prepare data based on dataset type
        X, y = self._prepare_data(df, dataset_info["type"])
        
        if X is None or y is None:
            raise ValueError(f"Could not prepare data for {dataset_id}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Store scaler
        scaler_path = self.models_dir / f"{dataset_id}_scaler.pkl"
        joblib.dump(scaler, scaler_path)
        self.scalers[dataset_id] = scaler
        
        # Train multiple models
        models_results = {}
        
        # 1. Random Forest
        logger.info(f"Training Random Forest for {dataset_id}")
        rf_results = await self._train_random_forest(
            X_train_scaled, X_test_scaled, y_train, y_test, dataset_id
        )
        models_results["random_forest"] = rf_results
        
        # 2. Gradient Boosting
        logger.info(f"Training Gradient Boosting for {dataset_id}")
        gb_results = await self._train_gradient_boosting(
            X_train_scaled, X_test_scaled, y_train, y_test, dataset_id
        )
        models_results["gradient_boosting"] = gb_results
        
        # 3. Neural Network (sklearn)
        logger.info(f"Training Neural Network for {dataset_id}")
        nn_results = await self._train_neural_network(
            X_train_scaled, X_test_scaled, y_train, y_test, dataset_id
        )
        models_results["neural_network"] = nn_results
        
        # 4. Deep Learning (TensorFlow)
        logger.info(f"Training Deep Learning model for {dataset_id}")
        dl_results = await self._train_deep_learning(
            X_train_scaled, X_test_scaled, y_train, y_test, dataset_id
        )
        models_results["deep_learning"] = dl_results
        
        # 5. PyTorch Neural Network
        logger.info(f"Training PyTorch model for {dataset_id}")
        torch_results = await self._train_pytorch_model(
            X_train_scaled, X_test_scaled, y_train, y_test, dataset_id
        )
        models_results["pytorch_model"] = torch_results
        
        # 6. Support Vector Machine (for smaller datasets)
        if len(X_train) < 10000:
            logger.info(f"Training SVM for {dataset_id}")
            svm_results = await self._train_svm(
                X_train_scaled, X_test_scaled, y_train, y_test, dataset_id
            )
            models_results["svm"] = svm_results
        
        # Create ensemble model
        logger.info(f"Creating ensemble model for {dataset_id}")
        ensemble_results = await self._create_ensemble_model(
            models_results, X_test_scaled, y_test, dataset_id
        )
        models_results["ensemble"] = ensemble_results
        
        # Save model metadata
        metadata = {
            "dataset_id": dataset_id,
            "dataset_type": dataset_info["type"],
            "trained_at": datetime.now().isoformat(),
            "samples": len(df),
            "features": X.shape[1],
            "models": list(models_results.keys()),
            "feature_names": X.columns.tolist() if hasattr(X, 'columns') else None
        }
        
        metadata_path = self.models_dir / f"{dataset_id}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        
        return {
            "dataset_info": metadata,
            "models": models_results,
            "best_model": self._find_best_model(models_results)
        }
    
    def _prepare_data(self, df: pd.DataFrame, dataset_type: str) -> Tuple[Optional[pd.DataFrame], Optional[pd.Series]]:
        """Prepare data for training based on dataset type"""
        try:
            if dataset_type == "malware":
                feature_cols = [col for col in df.columns if col not in ['file_hash', 'is_malware']]
                X = df[feature_cols]
                y = df['is_malware']
                
            elif dataset_type == "network":
                # Encode categorical features
                df_encoded = df.copy()
                categorical_cols = ['protocol_type', 'service', 'flag']
                
                for col in categorical_cols:
                    if col in df.columns:
                        le = LabelEncoder()
                        df_encoded[col] = le.fit_transform(df[col].astype(str))
                
                feature_cols = [col for col in df_encoded.columns if col != 'attack_type']
                X = df_encoded[feature_cols]
                
                # Binary classification: normal vs attack
                y = (df['attack_type'] != 'normal').astype(int)
                
            elif dataset_type == "phishing":
                feature_cols = [col for col in df.columns if col != 'is_phishing']
                X = df[feature_cols]
                y = df['is_phishing']
                
            elif dataset_type == "spam":
                feature_cols = [col for col in df.columns if col != 'is_spam']
                X = df[feature_cols]
                y = df['is_spam']
                
            elif dataset_type == "botnet":
                feature_cols = [col for col in df.columns if col != 'is_botnet']
                X = df[feature_cols]
                y = df['is_botnet']
                
            elif dataset_type == "vulnerability":
                # Convert severity to binary (HIGH/CRITICAL vs others)
                feature_cols = [col for col in df.columns if col not in ['cve_id', 'severity', 'vulnerability_type']]
                X = df[feature_cols]
                y = df['severity'].isin(['HIGH', 'CRITICAL']).astype(int)
                
            elif dataset_type == "threat_intel":
                # Predict high confidence threats
                feature_cols = [col for col in df.columns if col not in ['ip_address', 'threat_type', 'confidence']]
                X = df[feature_cols]
                y = (df['confidence'] > 0.7).astype(int)
                
            elif dataset_type == "darkweb":
                # Predict high risk content
                feature_cols = [col for col in df.columns if col not in ['content_type', 'language', 'topic', 'risk_score']]
                
                # Encode categorical features
                df_encoded = df.copy()
                categorical_cols = ['content_type', 'language', 'topic']
                
                for col in categorical_cols:
                    if col in df.columns:
                        le = LabelEncoder()
                        df_encoded[col] = le.fit_transform(df[col].astype(str))
                
                X = df_encoded[['content_type', 'language', 'topic', 'sentiment']]
                y = (df['risk_score'] > 0.7).astype(int)
                
            elif dataset_type == "dns":
                # Encode categorical features
                df_encoded = df.copy()
                le = LabelEncoder()
                df_encoded['query_type'] = le.fit_transform(df['query_type'])
                df_encoded['response_code'] = le.fit_transform(df['response_code'])
                
                feature_cols = [col for col in df_encoded.columns if col != 'is_tunneling']
                X = df_encoded[feature_cols]
                y = df['is_tunneling']
                
            elif dataset_type == "cryptomining":
                feature_cols = [col for col in df.columns if col != 'is_mining']
                X = df[feature_cols]
                y = df['is_mining']
                
            else:
                # Default: use all numeric columns as features, last column as target
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                X = df[numeric_cols[:-1]]
                y = df[numeric_cols[-1]]
                
                # Convert to binary classification if needed
                if y.nunique() > 2:
                    y = (y > y.median()).astype(int)
            
            # Remove any remaining non-numeric columns from X
            X = X.select_dtypes(include=[np.number])
            
            # Handle missing values
            X = X.fillna(X.mean())
            
            return X, y
            
        except Exception as e:
            logger.error(f"Error preparing data for {dataset_type}: {e}")
            return None, None
    
    async def _train_random_forest(self, X_train, X_test, y_train, y_test, dataset_id: str) -> Dict[str, Any]:
        """Train Random Forest model"""
        try:
            # Hyperparameter tuning
            param_grid = {
                'n_estimators': [100, 200],
                'max_depth': [10, 20, None],
                'min_samples_split': [2, 5],
                'min_samples_leaf': [1, 2]
            }
            
            rf = RandomForestClassifier(random_state=42)
            
            # Use a subset for grid search if dataset is large
            if len(X_train) > 5000:
                grid_search = GridSearchCV(rf, param_grid, cv=3, scoring='f1', n_jobs=-1)
                grid_search.fit(X_train[:5000], y_train[:5000])
                best_rf = grid_search.best_estimator_
            else:
                grid_search = GridSearchCV(rf, param_grid, cv=3, scoring='f1', n_jobs=-1)
                grid_search.fit(X_train, y_train)
                best_rf = grid_search.best_estimator_
            
            # Train on full dataset
            best_rf.fit(X_train, y_train)
            
            # Predictions
            y_pred = best_rf.predict(X_test)
            y_prob = best_rf.predict_proba(X_test)[:, 1]
            
            # Metrics
            metrics = self._calculate_metrics(y_test, y_pred, y_prob)
            
            # Save model
            model_path = self.models_dir / f"{dataset_id}_random_forest.pkl"
            joblib.dump(best_rf, model_path)
            
            return {
                "model_type": "random_forest",
                "model_path": str(model_path),
                "metrics": metrics,
                "feature_importance": dict(zip(
                    [f"feature_{i}" for i in range(len(best_rf.feature_importances_))],
                    best_rf.feature_importances_.tolist()
                )),
                "best_params": grid_search.best_params_ if 'grid_search' in locals() else {}
            }
            
        except Exception as e:
            logger.error(f"Error training Random Forest for {dataset_id}: {e}")
            return {"error": str(e)}
    
    async def _train_gradient_boosting(self, X_train, X_test, y_train, y_test, dataset_id: str) -> Dict[str, Any]:
        """Train Gradient Boosting model"""
        try:
            param_grid = {
                'n_estimators': [100, 200],
                'learning_rate': [0.1, 0.05],
                'max_depth': [3, 5]
            }
            
            gb = GradientBoostingClassifier(random_state=42)
            
            if len(X_train) > 5000:
                grid_search = GridSearchCV(gb, param_grid, cv=3, scoring='f1', n_jobs=-1)
                grid_search.fit(X_train[:5000], y_train[:5000])
                best_gb = grid_search.best_estimator_
            else:
                grid_search = GridSearchCV(gb, param_grid, cv=3, scoring='f1', n_jobs=-1)
                grid_search.fit(X_train, y_train)
                best_gb = grid_search.best_estimator_
            
            best_gb.fit(X_train, y_train)
            
            y_pred = best_gb.predict(X_test)
            y_prob = best_gb.predict_proba(X_test)[:, 1]
            
            metrics = self._calculate_metrics(y_test, y_pred, y_prob)
            
            model_path = self.models_dir / f"{dataset_id}_gradient_boosting.pkl"
            joblib.dump(best_gb, model_path)
            
            return {
                "model_type": "gradient_boosting",
                "model_path": str(model_path),
                "metrics": metrics,
                "feature_importance": dict(zip(
                    [f"feature_{i}" for i in range(len(best_gb.feature_importances_))],
                    best_gb.feature_importances_.tolist()
                )),
                "best_params": grid_search.best_params_ if 'grid_search' in locals() else {}
            }
            
        except Exception as e:
            logger.error(f"Error training Gradient Boosting for {dataset_id}: {e}")
            return {"error": str(e)}
    
    async def _train_neural_network(self, X_train, X_test, y_train, y_test, dataset_id: str) -> Dict[str, Any]:
        """Train Neural Network (sklearn)"""
        try:
            param_grid = {
                'hidden_layer_sizes': [(100,), (100, 50), (200, 100, 50)],
                'learning_rate_init': [0.001, 0.01],
                'alpha': [0.0001, 0.001]
            }
            
            nn = MLPClassifier(random_state=42, max_iter=1000)
            
            if len(X_train) > 5000:
                grid_search = GridSearchCV(nn, param_grid, cv=3, scoring='f1', n_jobs=-1)
                grid_search.fit(X_train[:5000], y_train[:5000])
                best_nn = grid_search.best_estimator_
            else:
                grid_search = GridSearchCV(nn, param_grid, cv=3, scoring='f1', n_jobs=-1)
                grid_search.fit(X_train, y_train)
                best_nn = grid_search.best_estimator_
            
            best_nn.fit(X_train, y_train)
            
            y_pred = best_nn.predict(X_test)
            y_prob = best_nn.predict_proba(X_test)[:, 1]
            
            metrics = self._calculate_metrics(y_test, y_pred, y_prob)
            
            model_path = self.models_dir / f"{dataset_id}_neural_network.pkl"
            joblib.dump(best_nn, model_path)
            
            return {
                "model_type": "neural_network",
                "model_path": str(model_path),
                "metrics": metrics,
                "best_params": grid_search.best_params_ if 'grid_search' in locals() else {}
            }
            
        except Exception as e:
            logger.error(f"Error training Neural Network for {dataset_id}: {e}")
            return {"error": str(e)}
    
    async def _train_deep_learning(self, X_train, X_test, y_train, y_test, dataset_id: str) -> Dict[str, Any]:
        """Train Deep Learning model with TensorFlow"""
        try:
            # Build model architecture
            model = tf.keras.Sequential([
                tf.keras.layers.Dense(128, activation='relu', input_shape=(X_train.shape[1],)),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(64, activation='relu'),
                tf.keras.layers.Dropout(0.3),
                tf.keras.layers.Dense(32, activation='relu'),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(1, activation='sigmoid')
            ])
            
            model.compile(
                optimizer='adam',
                loss='binary_crossentropy',
                metrics=['accuracy', 'precision', 'recall']
            )
            
            # Early stopping
            early_stopping = tf.keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True
            )
            
            # Train model
            history = model.fit(
                X_train, y_train,
                epochs=100,
                batch_size=32,
                validation_split=0.2,
                callbacks=[early_stopping],
                verbose=0
            )
            
            # Predictions
            y_prob = model.predict(X_test).flatten()
            y_pred = (y_prob > 0.5).astype(int)
            
            metrics = self._calculate_metrics(y_test, y_pred, y_prob)
            
            # Save model
            model_path = self.models_dir / f"{dataset_id}_deep_learning.h5"
            model.save(model_path)
            
            return {
                "model_type": "deep_learning",
                "model_path": str(model_path),
                "metrics": metrics,
                "training_history": {
                    "loss": history.history['loss'][-10:],  # Last 10 epochs
                    "val_loss": history.history['val_loss'][-10:],
                    "accuracy": history.history['accuracy'][-10:],
                    "val_accuracy": history.history['val_accuracy'][-10:]
                }
            }
            
        except Exception as e:
            logger.error(f"Error training Deep Learning model for {dataset_id}: {e}")
            return {"error": str(e)}
    
    async def _train_pytorch_model(self, X_train, X_test, y_train, y_test, dataset_id: str) -> Dict[str, Any]:
        """Train PyTorch Neural Network"""
        try:
            # Define model architecture
            class CyberSecurityNet(nn.Module):
                def __init__(self, input_size):
                    super(CyberSecurityNet, self).__init__()
                    self.fc1 = nn.Linear(input_size, 128)
                    self.fc2 = nn.Linear(128, 64)
                    self.fc3 = nn.Linear(64, 32)
                    self.fc4 = nn.Linear(32, 1)
                    self.dropout = nn.Dropout(0.3)
                    self.relu = nn.ReLU()
                    self.sigmoid = nn.Sigmoid()
                    
                def forward(self, x):
                    x = self.relu(self.fc1(x))
                    x = self.dropout(x)
                    x = self.relu(self.fc2(x))
                    x = self.dropout(x)
                    x = self.relu(self.fc3(x))
                    x = self.sigmoid(self.fc4(x))
                    return x
            
            # Convert to tensors
            X_train_tensor = torch.FloatTensor(X_train)
            X_test_tensor = torch.FloatTensor(X_test)
            y_train_tensor = torch.FloatTensor(y_train.values.reshape(-1, 1))
            y_test_tensor = torch.FloatTensor(y_test.values.reshape(-1, 1))
            
            # Initialize model
            model = CyberSecurityNet(X_train.shape[1])
            criterion = nn.BCELoss()
            optimizer = optim.Adam(model.parameters(), lr=0.001)
            
            # Training loop
            model.train()
            losses = []
            
            for epoch in range(100):
                optimizer.zero_grad()
                outputs = model(X_train_tensor)
                loss = criterion(outputs, y_train_tensor)
                loss.backward()
                optimizer.step()
                losses.append(loss.item())
                
                if epoch % 20 == 0:
                    logger.info(f"Epoch {epoch}, Loss: {loss.item():.4f}")
            
            # Evaluation
            model.eval()
            with torch.no_grad():
                y_prob = model(X_test_tensor).numpy().flatten()
                y_pred = (y_prob > 0.5).astype(int)
            
            metrics = self._calculate_metrics(y_test, y_pred, y_prob)
            
            # Save model
            model_path = self.models_dir / f"{dataset_id}_pytorch_model.pth"
            torch.save(model.state_dict(), model_path)
            
            return {
                "model_type": "pytorch_model",
                "model_path": str(model_path),
                "metrics": metrics,
                "training_losses": losses[-10:]  # Last 10 losses
            }
            
        except Exception as e:
            logger.error(f"Error training PyTorch model for {dataset_id}: {e}")
            return {"error": str(e)}
    
    async def _train_svm(self, X_train, X_test, y_train, y_test, dataset_id: str) -> Dict[str, Any]:
        """Train Support Vector Machine"""
        try:
            param_grid = {
                'C': [1, 10],
                'kernel': ['rbf', 'linear'],
                'gamma': ['scale', 'auto']
            }
            
            svm = SVC(probability=True, random_state=42)
            grid_search = GridSearchCV(svm, param_grid, cv=3, scoring='f1', n_jobs=-1)
            grid_search.fit(X_train, y_train)
            
            best_svm = grid_search.best_estimator_
            
            y_pred = best_svm.predict(X_test)
            y_prob = best_svm.predict_proba(X_test)[:, 1]
            
            metrics = self._calculate_metrics(y_test, y_pred, y_prob)
            
            model_path = self.models_dir / f"{dataset_id}_svm.pkl"
            joblib.dump(best_svm, model_path)
            
            return {
                "model_type": "svm",
                "model_path": str(model_path),
                "metrics": metrics,
                "best_params": grid_search.best_params_
            }
            
        except Exception as e:
            logger.error(f"Error training SVM for {dataset_id}: {e}")
            return {"error": str(e)}
    
    async def _create_ensemble_model(self, models_results: Dict, X_test, y_test, dataset_id: str) -> Dict[str, Any]:
        """Create ensemble model from trained models"""
        try:
            # Collect predictions from all successful models
            predictions = []
            model_weights = []
            
            for model_name, results in models_results.items():
                if "error" not in results:
                    # Load model and make predictions
                    model_path = results["model_path"]
                    
                    if model_name == "deep_learning":
                        model = tf.keras.models.load_model(model_path)
                        y_prob = model.predict(X_test).flatten()
                    elif model_name == "pytorch_model":
                        # Skip PyTorch for ensemble to avoid complexity
                        continue
                    else:
                        model = joblib.load(model_path)
                        y_prob = model.predict_proba(X_test)[:, 1]
                    
                    predictions.append(y_prob)
                    
                    # Weight by F1 score
                    f1_score = results["metrics"]["f1_score"]
                    model_weights.append(f1_score)
            
            if len(predictions) == 0:
                return {"error": "No successful models for ensemble"}
            
            # Weighted average ensemble
            predictions = np.array(predictions)
            model_weights = np.array(model_weights)
            model_weights = model_weights / model_weights.sum()  # Normalize weights
            
            ensemble_prob = np.average(predictions, axis=0, weights=model_weights)
            ensemble_pred = (ensemble_prob > 0.5).astype(int)
            
            metrics = self._calculate_metrics(y_test, ensemble_pred, ensemble_prob)
            
            # Save ensemble configuration
            ensemble_config = {
                "models": list(models_results.keys()),
                "weights": model_weights.tolist(),
                "threshold": 0.5
            }
            
            config_path = self.models_dir / f"{dataset_id}_ensemble_config.json"
            with open(config_path, 'w') as f:
                json.dump(ensemble_config, f, indent=2)
            
            return {
                "model_type": "ensemble",
                "config_path": str(config_path),
                "metrics": metrics,
                "ensemble_config": ensemble_config
            }
            
        except Exception as e:
            logger.error(f"Error creating ensemble for {dataset_id}: {e}")
            return {"error": str(e)}
    
    def _calculate_metrics(self, y_true, y_pred, y_prob) -> Dict[str, float]:
        """Calculate comprehensive metrics"""
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
        
        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "precision": float(precision_score(y_true, y_pred, zero_division=0)),
            "recall": float(recall_score(y_true, y_pred, zero_division=0)),
            "f1_score": float(f1_score(y_true, y_pred, zero_division=0))
        }
        
        try:
            metrics["auc_roc"] = float(roc_auc_score(y_true, y_prob))
        except:
            metrics["auc_roc"] = 0.0
        
        return metrics
    
    def _find_best_model(self, models_results: Dict) -> Dict[str, Any]:
        """Find the best performing model"""
        best_model = None
        best_f1 = 0.0
        
        for model_name, results in models_results.items():
            if "error" not in results:
                f1_score = results["metrics"]["f1_score"]
                if f1_score > best_f1:
                    best_f1 = f1_score
                    best_model = {
                        "model_name": model_name,
                        "f1_score": f1_score,
                        "metrics": results["metrics"]
                    }
        
        return best_model
    
    async def predict_with_model(self, dataset_id: str, model_name: str, X: np.ndarray) -> Dict[str, Any]:
        """Make predictions with a specific model"""
        try:
            # Load scaler
            scaler_path = self.models_dir / f"{dataset_id}_scaler.pkl"
            if scaler_path.exists():
                scaler = joblib.load(scaler_path)
                X_scaled = scaler.transform(X)
            else:
                X_scaled = X
            
            if model_name == "ensemble":
                # Load ensemble configuration
                config_path = self.models_dir / f"{dataset_id}_ensemble_config.json"
                with open(config_path, 'r') as f:
                    config = json.load(f)
                
                # Get predictions from each model
                predictions = []
                for model in config["models"]:
                    if model != "pytorch_model":  # Skip PyTorch for simplicity
                        model_path = self.models_dir / f"{dataset_id}_{model}.pkl"
                        if model_path.exists():
                            model_obj = joblib.load(model_path)
                            y_prob = model_obj.predict_proba(X_scaled)[:, 1]
                            predictions.append(y_prob)
                
                if predictions:
                    predictions = np.array(predictions)
                    weights = np.array(config["weights"][:len(predictions)])
                    weights = weights / weights.sum()
                    
                    ensemble_prob = np.average(predictions, axis=0, weights=weights)
                    ensemble_pred = (ensemble_prob > config["threshold"]).astype(int)
                    
                    return {
                        "predictions": ensemble_pred.tolist(),
                        "probabilities": ensemble_prob.tolist(),
                        "model_type": "ensemble"
                    }
            
            else:
                # Load specific model
                if model_name == "deep_learning":
                    model_path = self.models_dir / f"{dataset_id}_deep_learning.h5"
                    model = tf.keras.models.load_model(model_path)
                    y_prob = model.predict(X_scaled).flatten()
                    y_pred = (y_prob > 0.5).astype(int)
                else:
                    model_path = self.models_dir / f"{dataset_id}_{model_name}.pkl"
                    model = joblib.load(model_path)
                    y_pred = model.predict(X_scaled)
                    y_prob = model.predict_proba(X_scaled)[:, 1]
                
                return {
                    "predictions": y_pred.tolist(),
                    "probabilities": y_prob.tolist(),
                    "model_type": model_name
                }
            
        except Exception as e:
            logger.error(f"Error making predictions with {model_name} for {dataset_id}: {e}")
            return {"error": str(e)}
    
    def get_available_models(self, dataset_id: str) -> List[str]:
        """Get list of available trained models for a dataset"""
        models = []
        
        # Check for each model type
        model_types = [
            "random_forest", "gradient_boosting", "neural_network", 
            "deep_learning", "pytorch_model", "svm", "ensemble"
        ]
        
        for model_type in model_types:
            if model_type == "deep_learning":
                model_path = self.models_dir / f"{dataset_id}_deep_learning.h5"
            elif model_type == "ensemble":
                model_path = self.models_dir / f"{dataset_id}_ensemble_config.json"
            else:
                model_path = self.models_dir / f"{dataset_id}_{model_type}.pkl"
            
            if model_path.exists():
                models.append(model_type)
        
        return models