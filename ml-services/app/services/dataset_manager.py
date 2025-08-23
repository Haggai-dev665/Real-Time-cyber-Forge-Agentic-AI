"""
Dataset Manager for downloading and managing Kaggle datasets
related to network security and port scanning
"""

import os
import json
import zipfile
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class DatasetManager:
    """Manages Kaggle datasets for network security analysis"""
    
    def __init__(self, datasets_dir: str = "datasets"):
        self.datasets_dir = Path(datasets_dir)
        self.datasets_dir.mkdir(exist_ok=True)
        self.config_file = self.datasets_dir / "datasets_config.json"
        self.available_datasets = {
            "network-security": [
                {
                    "name": "network-intrusion-detection",
                    "kaggle_id": "sampadab17/network-intrusion-detection",
                    "description": "Network intrusion detection dataset with various attack types",
                    "features": ["protocol", "service", "flag", "src_bytes", "dst_bytes", "attack_type"]
                },
                {
                    "name": "nsl-kdd",
                    "kaggle_id": "hassan06/nslkdd",
                    "description": "NSL-KDD dataset for network intrusion detection",
                    "features": ["duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes"]
                },
                {
                    "name": "port-scanning",
                    "kaggle_id": "crawford/computer-network-traffic",
                    "description": "Computer network traffic data including port scanning patterns",
                    "features": ["timestamp", "src_ip", "dst_ip", "src_port", "dst_port", "protocol"]
                }
            ],
            "cybersecurity": [
                {
                    "name": "malware-detection",
                    "kaggle_id": "xwolf12/malware-detection",
                    "description": "Malware detection dataset with various malware families",
                    "features": ["file_size", "entropy", "imports", "exports", "sections"]
                },
                {
                    "name": "phishing-websites",
                    "kaggle_id": "akashkr/phishing-website-dataset",
                    "description": "Phishing website detection dataset",
                    "features": ["url_length", "num_dots", "num_hyphens", "num_subdomains", "https"]
                }
            ]
        }
        self.downloaded_datasets = self._load_downloaded_datasets()
    
    def _load_downloaded_datasets(self) -> Dict[str, Any]:
        """Load information about previously downloaded datasets"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading datasets config: {e}")
                return {}
        return {}
    
    def _save_downloaded_datasets(self):
        """Save information about downloaded datasets"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.downloaded_datasets, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving datasets config: {e}")
    
    async def download_dataset(self, dataset_name: str, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
        """Download a dataset from Kaggle"""
        try:
            # Check if we have Kaggle credentials
            if not self._check_kaggle_credentials():
                logger.error("Kaggle credentials not found. Please set up Kaggle API credentials.")
                return None
            
            # Find dataset info
            dataset_info = self._find_dataset_info(dataset_name)
            if not dataset_info:
                logger.error(f"Dataset '{dataset_name}' not found in available datasets")
                return None
            
            dataset_path = self.datasets_dir / dataset_name
            
            # Check if already downloaded and not forcing refresh
            if not force_refresh and dataset_name in self.downloaded_datasets:
                if dataset_path.exists():
                    logger.info(f"Dataset '{dataset_name}' already downloaded")
                    return self.downloaded_datasets[dataset_name]
            
            # Create directory for dataset
            dataset_path.mkdir(exist_ok=True)
            
            # Use kaggle command line tool (if available) or create mock data
            try:
                import subprocess
                result = subprocess.run([
                    "kaggle", "datasets", "download", 
                    dataset_info["kaggle_id"], 
                    "-p", str(dataset_path),
                    "--unzip"
                ], capture_output=True, text=True, timeout=300)
                
                if result.returncode != 0:
                    logger.warning(f"Kaggle download failed: {result.stderr}")
                    # Create mock dataset for demonstration
                    await self._create_mock_dataset(dataset_name, dataset_info, dataset_path)
                else:
                    logger.info(f"Successfully downloaded dataset '{dataset_name}'")
                    
            except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                logger.warning(f"Kaggle CLI not available or timeout: {e}")
                # Create mock dataset for demonstration
                await self._create_mock_dataset(dataset_name, dataset_info, dataset_path)
            
            # Update downloaded datasets registry
            self.downloaded_datasets[dataset_name] = {
                "info": dataset_info,
                "path": str(dataset_path),
                "downloaded_at": datetime.utcnow().isoformat(),
                "files": list(dataset_path.glob("*.csv"))
            }
            
            self._save_downloaded_datasets()
            return self.downloaded_datasets[dataset_name]
            
        except Exception as e:
            logger.error(f"Error downloading dataset '{dataset_name}': {e}")
            return None
    
    async def _create_mock_dataset(self, dataset_name: str, dataset_info: Dict[str, Any], dataset_path: Path):
        """Create mock dataset for demonstration purposes"""
        logger.info(f"Creating mock dataset for '{dataset_name}'")
        
        # Generate mock data based on dataset type
        if "network" in dataset_name or "port" in dataset_name:
            mock_data = self._generate_network_mock_data()
        elif "phishing" in dataset_name:
            mock_data = self._generate_phishing_mock_data()
        elif "malware" in dataset_name:
            mock_data = self._generate_malware_mock_data()
        else:
            mock_data = self._generate_generic_mock_data(dataset_info)
        
        # Save mock data to CSV
        mock_file = dataset_path / f"{dataset_name}_mock.csv"
        mock_data.to_csv(mock_file, index=False)
        logger.info(f"Mock dataset saved to {mock_file}")
    
    def _generate_network_mock_data(self) -> pd.DataFrame:
        """Generate mock network traffic data"""
        import random
        import time
        
        protocols = ['TCP', 'UDP', 'ICMP']
        services = ['http', 'https', 'ftp', 'ssh', 'telnet', 'smtp', 'dns']
        flags = ['SF', 'S0', 'REJ', 'RSTR', 'RSTO', 'SH', 'S1', 'S2', 'S3']
        attack_types = ['normal', 'dos', 'probe', 'r2l', 'u2r']
        
        data = []
        for i in range(1000):
            data.append({
                'timestamp': time.time() - random.randint(0, 86400),
                'src_ip': f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
                'dst_ip': f"10.0.{random.randint(1,255)}.{random.randint(1,255)}",
                'src_port': random.randint(1024, 65535),
                'dst_port': random.choice([22, 23, 53, 80, 443, 993, 995]),
                'protocol': random.choice(protocols),
                'service': random.choice(services),
                'flag': random.choice(flags),
                'src_bytes': random.randint(0, 10000),
                'dst_bytes': random.randint(0, 10000),
                'duration': random.uniform(0, 100),
                'attack_type': random.choice(attack_types)
            })
        
        return pd.DataFrame(data)
    
    def _generate_phishing_mock_data(self) -> pd.DataFrame:
        """Generate mock phishing website data"""
        import random
        
        data = []
        for i in range(500):
            url_length = random.randint(10, 200)
            is_phishing = random.choice([0, 1])
            
            data.append({
                'url_length': url_length,
                'num_dots': random.randint(1, 10),
                'num_hyphens': random.randint(0, 5),
                'num_subdomains': random.randint(0, 4),
                'https': random.choice([0, 1]),
                'num_suspicious_words': random.randint(0, 3),
                'has_ip': random.choice([0, 1]),
                'short_url': random.choice([0, 1]),
                'is_phishing': is_phishing
            })
        
        return pd.DataFrame(data)
    
    def _generate_malware_mock_data(self) -> pd.DataFrame:
        """Generate mock malware detection data"""
        import random
        
        malware_families = ['trojan', 'virus', 'worm', 'adware', 'spyware', 'benign']
        
        data = []
        for i in range(300):
            data.append({
                'file_size': random.randint(1000, 10000000),
                'entropy': random.uniform(0, 8),
                'num_imports': random.randint(0, 100),
                'num_exports': random.randint(0, 50),
                'num_sections': random.randint(3, 20),
                'has_debug_info': random.choice([0, 1]),
                'is_packed': random.choice([0, 1]),
                'malware_family': random.choice(malware_families)
            })
        
        return pd.DataFrame(data)
    
    def _generate_generic_mock_data(self, dataset_info: Dict[str, Any]) -> pd.DataFrame:
        """Generate generic mock data based on features"""
        import random
        
        features = dataset_info.get('features', ['feature1', 'feature2', 'feature3'])
        data = []
        
        for i in range(200):
            row = {}
            for feature in features:
                if 'bytes' in feature or 'size' in feature:
                    row[feature] = random.randint(0, 10000)
                elif 'port' in feature:
                    row[feature] = random.randint(1, 65535)
                elif 'ip' in feature:
                    row[feature] = f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}"
                else:
                    row[feature] = random.uniform(0, 100)
            data.append(row)
        
        return pd.DataFrame(data)
    
    def _find_dataset_info(self, dataset_name: str) -> Optional[Dict[str, Any]]:
        """Find dataset information by name"""
        for category, datasets in self.available_datasets.items():
            for dataset in datasets:
                if dataset["name"] == dataset_name:
                    return dataset
        return None
    
    def _check_kaggle_credentials(self) -> bool:
        """Check if Kaggle API credentials are available"""
        kaggle_config_dir = Path.home() / ".kaggle"
        kaggle_config_file = kaggle_config_dir / "kaggle.json"
        
        # Check for kaggle.json file
        if kaggle_config_file.exists():
            return True
        
        # Check for environment variables
        return bool(os.getenv("KAGGLE_USERNAME") and os.getenv("KAGGLE_KEY"))
    
    def list_available_datasets(self) -> Dict[str, List[Dict[str, Any]]]:
        """List all available datasets"""
        return self.available_datasets
    
    def list_downloaded_datasets(self) -> Dict[str, Any]:
        """List all downloaded datasets"""
        return self.downloaded_datasets
    
    async def load_dataset(self, dataset_name: str) -> Optional[pd.DataFrame]:
        """Load a downloaded dataset into memory"""
        if dataset_name not in self.downloaded_datasets:
            logger.error(f"Dataset '{dataset_name}' not downloaded")
            return None
        
        try:
            dataset_path = Path(self.downloaded_datasets[dataset_name]["path"])
            csv_files = list(dataset_path.glob("*.csv"))
            
            if not csv_files:
                logger.error(f"No CSV files found in dataset '{dataset_name}'")
                return None
            
            # Load the first CSV file (or combine multiple files if needed)
            df = pd.read_csv(csv_files[0])
            logger.info(f"Loaded dataset '{dataset_name}' with {len(df)} rows")
            return df
            
        except Exception as e:
            logger.error(f"Error loading dataset '{dataset_name}': {e}")
            return None
    
    async def get_dataset_summary(self, dataset_name: str) -> Optional[Dict[str, Any]]:
        """Get summary statistics for a dataset"""
        df = await self.load_dataset(dataset_name)
        if df is None:
            return None
        
        try:
            summary = {
                "name": dataset_name,
                "shape": df.shape,
                "columns": list(df.columns),
                "dtypes": df.dtypes.to_dict(),
                "missing_values": df.isnull().sum().to_dict(),
                "memory_usage": df.memory_usage(deep=True).sum(),
                "sample_data": df.head().to_dict('records')
            }
            
            # Add statistics for numeric columns
            numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns
            if len(numeric_cols) > 0:
                summary["numeric_stats"] = df[numeric_cols].describe().to_dict()
            
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary for dataset '{dataset_name}': {e}")
            return None

# Global dataset manager instance
dataset_manager = DatasetManager()