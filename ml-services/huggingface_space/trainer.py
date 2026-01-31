"""
Advanced Cybersecurity Model Trainer
Comprehensive training module for security ML models
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier, 
    AdaBoostClassifier,
    ExtraTreesClassifier,
    VotingClassifier,
    StackingClassifier
)
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder, MinMaxScaler
from sklearn.metrics import (
    classification_report, 
    confusion_matrix, 
    roc_auc_score,
    precision_recall_curve,
    f1_score,
    accuracy_score
)
from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif
from sklearn.decomposition import PCA
import joblib
import json
from datetime import datetime
from pathlib import Path
import logging
from typing import Dict, List, Any, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class CyberSecurityNeuralNet(nn.Module):
    """Deep Neural Network for Cybersecurity Classification"""
    
    def __init__(self, input_size: int, hidden_sizes: List[int], num_classes: int, dropout: float = 0.3):
        super().__init__()
        
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_sizes:
            layers.extend([
                nn.Linear(prev_size, hidden_size),
                nn.BatchNorm1d(hidden_size),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            prev_size = hidden_size
        
        layers.append(nn.Linear(prev_size, num_classes))
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, x):
        return self.network(x)


class AdvancedSecurityTrainer:
    """Advanced trainer for cybersecurity models with multiple algorithms"""
    
    def __init__(self, models_dir: str = "./trained_models"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.trained_models = {}
        self.training_history = []
        
    def preprocess_security_data(
        self, 
        df: pd.DataFrame, 
        target_col: str,
        feature_selection: bool = True,
        n_features: int = 50
    ) -> Tuple[np.ndarray, np.ndarray, StandardScaler, LabelEncoder, List[str]]:
        """Preprocess security data with advanced feature engineering"""
        
        # Separate features and target
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        # Store original feature names
        feature_names = list(X.columns)
        
        # Handle categorical features
        categorical_cols = X.select_dtypes(include=['object', 'category']).columns
        for col in categorical_cols:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
        
        # Handle missing values
        X = X.fillna(X.median())
        
        # Encode target if categorical
        label_encoder = LabelEncoder()
        if y.dtype == 'object' or y.dtype.name == 'category':
            y = label_encoder.fit_transform(y)
        else:
            y = y.values
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Feature selection
        if feature_selection and X_scaled.shape[1] > n_features:
            selector = SelectKBest(mutual_info_classif, k=min(n_features, X_scaled.shape[1]))
            X_scaled = selector.fit_transform(X_scaled, y)
            selected_indices = selector.get_support(indices=True)
            feature_names = [feature_names[i] for i in selected_indices]
        
        return X_scaled, y, scaler, label_encoder, feature_names
    
    def train_ensemble_model(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        model_name: str = "ensemble"
    ) -> Tuple[Any, Dict[str, float]]:
        """Train an ensemble of classifiers"""
        
        logger.info("Training ensemble model...")
        
        # Base estimators
        estimators = [
            ('rf', RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
            ('gb', GradientBoostingClassifier(n_estimators=100, random_state=42)),
            ('et', ExtraTreesClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
        ]
        
        # Voting classifier
        voting_clf = VotingClassifier(estimators=estimators, voting='soft')
        voting_clf.fit(X_train, y_train)
        
        # Evaluate
        y_pred = voting_clf.predict(X_test)
        y_proba = voting_clf.predict_proba(X_test)
        
        metrics = self._calculate_metrics(y_test, y_pred, y_proba)
        
        # Save model
        model_path = self.models_dir / f"{model_name}_ensemble.pkl"
        joblib.dump(voting_clf, model_path)
        
        logger.info(f"Ensemble model trained with accuracy: {metrics['accuracy']:.4f}")
        
        return voting_clf, metrics
    
    def train_stacking_model(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        model_name: str = "stacking"
    ) -> Tuple[Any, Dict[str, float]]:
        """Train a stacking classifier"""
        
        logger.info("Training stacking model...")
        
        # Base estimators
        estimators = [
            ('rf', RandomForestClassifier(n_estimators=50, random_state=42)),
            ('gb', GradientBoostingClassifier(n_estimators=50, random_state=42)),
            ('svm', SVC(probability=True, random_state=42)),
        ]
        
        # Stacking classifier with logistic regression meta-learner
        stacking_clf = StackingClassifier(
            estimators=estimators,
            final_estimator=LogisticRegression(random_state=42),
            cv=3
        )
        stacking_clf.fit(X_train, y_train)
        
        # Evaluate
        y_pred = stacking_clf.predict(X_test)
        y_proba = stacking_clf.predict_proba(X_test)
        
        metrics = self._calculate_metrics(y_test, y_pred, y_proba)
        
        # Save model
        model_path = self.models_dir / f"{model_name}_stacking.pkl"
        joblib.dump(stacking_clf, model_path)
        
        logger.info(f"Stacking model trained with accuracy: {metrics['accuracy']:.4f}")
        
        return stacking_clf, metrics
    
    def train_neural_network(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        hidden_sizes: List[int] = [256, 128, 64],
        epochs: int = 100,
        batch_size: int = 32,
        learning_rate: float = 0.001,
        model_name: str = "neural_net"
    ) -> Tuple[nn.Module, Dict[str, float]]:
        """Train a deep neural network"""
        
        logger.info(f"Training neural network on {self.device}...")
        
        # Convert to tensors
        X_train_tensor = torch.FloatTensor(X_train).to(self.device)
        y_train_tensor = torch.LongTensor(y_train).to(self.device)
        X_test_tensor = torch.FloatTensor(X_test).to(self.device)
        y_test_tensor = torch.LongTensor(y_test).to(self.device)
        
        # Create data loader
        train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        
        # Initialize model
        num_classes = len(np.unique(y_train))
        model = CyberSecurityNeuralNet(
            input_size=X_train.shape[1],
            hidden_sizes=hidden_sizes,
            num_classes=num_classes
        ).to(self.device)
        
        # Loss and optimizer
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(model.parameters(), lr=learning_rate)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10)
        
        # Training loop
        best_accuracy = 0
        for epoch in range(epochs):
            model.train()
            total_loss = 0
            
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
            
            # Validation
            model.eval()
            with torch.no_grad():
                test_outputs = model(X_test_tensor)
                test_loss = criterion(test_outputs, y_test_tensor)
                _, predicted = torch.max(test_outputs, 1)
                accuracy = (predicted == y_test_tensor).float().mean().item()
            
            scheduler.step(test_loss)
            
            if accuracy > best_accuracy:
                best_accuracy = accuracy
                torch.save(model.state_dict(), self.models_dir / f"{model_name}_nn_best.pt")
            
            if (epoch + 1) % 20 == 0:
                logger.info(f"Epoch [{epoch+1}/{epochs}], Loss: {total_loss/len(train_loader):.4f}, Accuracy: {accuracy:.4f}")
        
        # Final evaluation
        model.eval()
        with torch.no_grad():
            outputs = model(X_test_tensor)
            _, y_pred = torch.max(outputs, 1)
            y_pred = y_pred.cpu().numpy()
            y_proba = torch.softmax(outputs, dim=1).cpu().numpy()
        
        metrics = self._calculate_metrics(y_test, y_pred, y_proba)
        
        logger.info(f"Neural network trained with accuracy: {metrics['accuracy']:.4f}")
        
        return model, metrics
    
    def train_all_models(
        self,
        df: pd.DataFrame,
        target_col: str,
        model_name: str,
        test_size: float = 0.2
    ) -> Dict[str, Any]:
        """Train all available model types and return best performing"""
        
        logger.info(f"Starting comprehensive training for {model_name}...")
        
        # Preprocess data
        X, y, scaler, label_encoder, feature_names = self.preprocess_security_data(df, target_col)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        results = {}
        
        # Train individual models
        models_to_train = [
            ("random_forest", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
            ("gradient_boosting", GradientBoostingClassifier(n_estimators=100, random_state=42)),
            ("extra_trees", ExtraTreesClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
            ("logistic_regression", LogisticRegression(random_state=42, max_iter=1000)),
            ("mlp", MLPClassifier(hidden_layer_sizes=(128, 64), random_state=42, max_iter=500)),
        ]
        
        for name, model in models_to_train:
            try:
                logger.info(f"Training {name}...")
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                y_proba = model.predict_proba(X_test) if hasattr(model, 'predict_proba') else None
                
                metrics = self._calculate_metrics(y_test, y_pred, y_proba)
                results[name] = {
                    "model": model,
                    "metrics": metrics
                }
                
                # Save model
                model_path = self.models_dir / f"{model_name}_{name}.pkl"
                joblib.dump(model, model_path)
                
            except Exception as e:
                logger.error(f"Failed to train {name}: {e}")
                results[name] = {"error": str(e)}
        
        # Train ensemble
        try:
            ensemble_model, ensemble_metrics = self.train_ensemble_model(
                X_train, y_train, X_test, y_test, model_name
            )
            results["ensemble"] = {
                "model": ensemble_model,
                "metrics": ensemble_metrics
            }
        except Exception as e:
            logger.error(f"Failed to train ensemble: {e}")
        
        # Train stacking
        try:
            stacking_model, stacking_metrics = self.train_stacking_model(
                X_train, y_train, X_test, y_test, model_name
            )
            results["stacking"] = {
                "model": stacking_model,
                "metrics": stacking_metrics
            }
        except Exception as e:
            logger.error(f"Failed to train stacking: {e}")
        
        # Find best model
        best_model_name = None
        best_accuracy = 0
        for name, result in results.items():
            if "metrics" in result and result["metrics"]["accuracy"] > best_accuracy:
                best_accuracy = result["metrics"]["accuracy"]
                best_model_name = name
        
        # Save preprocessing artifacts
        joblib.dump(scaler, self.models_dir / f"{model_name}_scaler.pkl")
        joblib.dump(label_encoder, self.models_dir / f"{model_name}_label_encoder.pkl")
        
        # Save metadata
        metadata = {
            "model_name": model_name,
            "target_column": target_col,
            "feature_names": feature_names,
            "num_features": len(feature_names),
            "num_samples": len(df),
            "num_classes": len(np.unique(y)),
            "best_model": best_model_name,
            "best_accuracy": best_accuracy,
            "all_results": {
                name: result.get("metrics", {"error": result.get("error")})
                for name, result in results.items()
            },
            "created_at": datetime.now().isoformat()
        }
        
        with open(self.models_dir / f"{model_name}_metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Training complete. Best model: {best_model_name} with accuracy: {best_accuracy:.4f}")
        
        return {
            "results": results,
            "metadata": metadata,
            "scaler": scaler,
            "label_encoder": label_encoder,
            "feature_names": feature_names
        }
    
    def _calculate_metrics(
        self, 
        y_true: np.ndarray, 
        y_pred: np.ndarray, 
        y_proba: Optional[np.ndarray] = None
    ) -> Dict[str, float]:
        """Calculate comprehensive metrics"""
        
        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "f1_weighted": float(f1_score(y_true, y_pred, average='weighted')),
            "f1_macro": float(f1_score(y_true, y_pred, average='macro')),
        }
        
        # ROC AUC for binary or multi-class
        if y_proba is not None:
            try:
                if len(np.unique(y_true)) == 2:
                    metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba[:, 1]))
                else:
                    metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba, multi_class='ovr'))
            except:
                pass
        
        return metrics


# Convenience function for Gradio interface
def train_comprehensive_model(
    file_path: str,
    target_column: str,
    model_name: str,
    test_size: float = 0.2
) -> Dict[str, Any]:
    """Train comprehensive models from file path"""
    
    # Load dataset
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.json'):
        df = pd.read_json(file_path)
    elif file_path.endswith('.parquet'):
        df = pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")
    
    # Initialize trainer
    trainer = AdvancedSecurityTrainer()
    
    # Train all models
    results = trainer.train_all_models(df, target_column, model_name, test_size)
    
    return results
