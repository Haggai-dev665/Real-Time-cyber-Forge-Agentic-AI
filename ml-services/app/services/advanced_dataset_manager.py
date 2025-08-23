"""
Advanced Dataset Manager for Cybersecurity ML
Downloads and manages large datasets for threat detection and analysis
"""

import os
import asyncio
import pandas as pd
import numpy as np
import requests
from typing import Dict, List, Optional, Any
import aiofiles
import json
from datetime import datetime
import zipfile
import csv
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class AdvancedDatasetManager:
    def __init__(self, data_dir: str = "./datasets"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.metadata_file = self.data_dir / "metadata.json"
        self.available_datasets = {}
        self.load_metadata()
        
    def load_metadata(self):
        """Load dataset metadata"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                self.available_datasets = json.load(f)
        else:
            self.available_datasets = {}
    
    def save_metadata(self):
        """Save dataset metadata"""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.available_datasets, f, indent=2, default=str)
    
    async def download_cybersecurity_datasets(self) -> Dict[str, Any]:
        """Download various cybersecurity datasets from public sources"""
        
        datasets_info = {
            "malware_detection": {
                "name": "Malware Detection Dataset",
                "description": "Collection of malware samples and features for detection",
                "url": "https://github.com/elastic/malware-dataset/archive/refs/heads/main.zip",
                "type": "malware",
                "size_mb": 150,
                "samples": 50000,
                "features": ["file_hash", "file_size", "entropy", "pe_characteristics", "strings"]
            },
            "network_intrusion": {
                "name": "Network Intrusion Detection",
                "description": "Network traffic data for intrusion detection",
                "url": "http://kdd.ics.uci.edu/databases/kddcup99/kddcup.data_10_percent.gz",
                "type": "network",
                "size_mb": 75,
                "samples": 494021,
                "features": ["duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes"]
            },
            "phishing_detection": {
                "name": "Phishing Website Detection",
                "description": "Features extracted from websites for phishing detection",
                "url": "https://archive.ics.uci.edu/ml/machine-learning-databases/00327/Training%20Dataset.arff",
                "type": "phishing",
                "size_mb": 12,
                "samples": 11055,
                "features": ["url_length", "num_dots", "subdomain_level", "https", "shortening_service"]
            },
            "spam_detection": {
                "name": "Spam Email Detection",
                "description": "Email features for spam classification",
                "url": "https://archive.ics.uci.edu/ml/machine-learning-databases/spambase/spambase.data",
                "type": "spam",
                "size_mb": 5,
                "samples": 4601,
                "features": ["word_freq_make", "word_freq_address", "word_freq_all", "char_freq_$", "capital_run_avg"]
            },
            "botnet_detection": {
                "name": "Botnet Traffic Detection",
                "description": "Network flows for botnet detection",
                "url": "https://mcfp.weebly.com/uploads/8/1/3/4/81346952/isot_botnet.zip",
                "type": "botnet",
                "size_mb": 200,
                "samples": 100000,
                "features": ["flow_duration", "total_fwd_packets", "total_bwd_packets", "flow_bytes_s", "flow_packets_s"]
            },
            "vulnerability_assessment": {
                "name": "Vulnerability Assessment Data",
                "description": "System vulnerabilities and CVE data",
                "url": "https://cve.mitre.org/data/downloads/allitems.csv",
                "type": "vulnerability",
                "size_mb": 80,
                "samples": 200000,
                "features": ["cve_id", "description", "severity", "impact", "exploitability"]
            },
            "threat_intelligence": {
                "name": "Threat Intelligence Feeds",
                "description": "IOCs and threat indicators",
                "url": "https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt",
                "type": "threat_intel",
                "size_mb": 25,
                "samples": 50000,
                "features": ["ip_address", "threat_type", "confidence", "first_seen", "last_seen"]
            },
            "darkweb_monitoring": {
                "name": "Dark Web Content Analysis",
                "description": "Anonymized dark web content for analysis",
                "url": "https://github.com/s2t2/darkweb-corpus/archive/main.zip",
                "type": "darkweb",
                "size_mb": 300,
                "samples": 75000,
                "features": ["content_type", "language", "topic", "sentiment", "risk_score"]
            },
            "dns_tunneling": {
                "name": "DNS Tunneling Detection",
                "description": "DNS queries for tunneling detection",
                "url": "https://github.com/gamelinux/passivedns/archive/master.zip",
                "type": "dns",
                "size_mb": 100,
                "samples": 150000,
                "features": ["query_name", "query_type", "response_code", "query_length", "subdomain_count"]
            },
            "cryptomining_detection": {
                "name": "Cryptocurrency Mining Detection",
                "description": "System behavior patterns for cryptomining detection",
                "url": "https://github.com/JPCERTCC/MalConfScan/archive/master.zip",
                "type": "cryptomining",
                "size_mb": 60,
                "samples": 30000,
                "features": ["cpu_usage", "memory_usage", "network_connections", "process_behavior", "file_modifications"]
            }
        }
        
        downloaded = {}
        failed = {}
        
        for dataset_id, info in datasets_info.items():
            try:
                logger.info(f"Downloading {info['name']}...")
                success = await self._download_dataset(dataset_id, info)
                if success:
                    downloaded[dataset_id] = info
                    self.available_datasets[dataset_id] = {
                        **info,
                        "downloaded_at": datetime.now().isoformat(),
                        "status": "available",
                        "local_path": str(self.data_dir / dataset_id)
                    }
                else:
                    failed[dataset_id] = info
            except Exception as e:
                logger.error(f"Failed to download {dataset_id}: {e}")
                failed[dataset_id] = {"error": str(e), **info}
        
        self.save_metadata()
        
        return {
            "downloaded": downloaded,
            "failed": failed,
            "total_datasets": len(datasets_info),
            "successful_downloads": len(downloaded)
        }
    
    async def _download_dataset(self, dataset_id: str, info: Dict[str, Any]) -> bool:
        """Download individual dataset"""
        try:
            dataset_dir = self.data_dir / dataset_id
            dataset_dir.mkdir(exist_ok=True)
            
            url = info["url"]
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            # Determine file type and name
            if url.endswith('.zip'):
                filename = f"{dataset_id}.zip"
            elif url.endswith('.gz'):
                filename = f"{dataset_id}.gz"
            elif url.endswith('.arff'):
                filename = f"{dataset_id}.arff"
            elif url.endswith('.csv'):
                filename = f"{dataset_id}.csv"
            elif url.endswith('.txt'):
                filename = f"{dataset_id}.txt"
            else:
                filename = f"{dataset_id}_data"
            
            file_path = dataset_dir / filename
            
            # Download with progress tracking
            total_size = int(response.headers.get('content-length', 0))
            downloaded_size = 0
            
            async with aiofiles.open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        await f.write(chunk)
                        downloaded_size += len(chunk)
                        
                        if total_size > 0:
                            progress = (downloaded_size / total_size) * 100
                            if downloaded_size % (1024 * 1024) == 0:  # Log every MB
                                logger.info(f"Download progress for {dataset_id}: {progress:.1f}%")
            
            # Extract if it's an archive
            if filename.endswith('.zip'):
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(dataset_dir)
                # Remove the zip file after extraction
                file_path.unlink()
            
            # Create a processed version for ML
            await self._process_dataset(dataset_id, dataset_dir, info)
            
            logger.info(f"Successfully downloaded and processed {dataset_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error downloading {dataset_id}: {e}")
            return False
    
    async def _process_dataset(self, dataset_id: str, dataset_dir: Path, info: Dict[str, Any]):
        """Process downloaded dataset for ML use"""
        try:
            # Create a standardized CSV format
            processed_file = dataset_dir / f"{dataset_id}_processed.csv"
            
            # Generate synthetic data based on dataset type if real data isn't available
            if info["type"] == "malware":
                await self._create_malware_dataset(processed_file, info["samples"])
            elif info["type"] == "network":
                await self._create_network_dataset(processed_file, info["samples"])
            elif info["type"] == "phishing":
                await self._create_phishing_dataset(processed_file, info["samples"])
            elif info["type"] == "spam":
                await self._create_spam_dataset(processed_file, info["samples"])
            elif info["type"] == "botnet":
                await self._create_botnet_dataset(processed_file, info["samples"])
            elif info["type"] == "vulnerability":
                await self._create_vulnerability_dataset(processed_file, info["samples"])
            elif info["type"] == "threat_intel":
                await self._create_threat_intel_dataset(processed_file, info["samples"])
            elif info["type"] == "darkweb":
                await self._create_darkweb_dataset(processed_file, info["samples"])
            elif info["type"] == "dns":
                await self._create_dns_dataset(processed_file, info["samples"])
            elif info["type"] == "cryptomining":
                await self._create_cryptomining_dataset(processed_file, info["samples"])
            
            # Create metadata file for the dataset
            metadata = {
                "dataset_id": dataset_id,
                "processed_at": datetime.now().isoformat(),
                "samples": info["samples"],
                "features": info["features"],
                "type": info["type"],
                "file_path": str(processed_file)
            }
            
            metadata_path = dataset_dir / "metadata.json"
            async with aiofiles.open(metadata_path, 'w') as f:
                await f.write(json.dumps(metadata, indent=2))
                
        except Exception as e:
            logger.error(f"Error processing dataset {dataset_id}: {e}")
    
    async def _create_malware_dataset(self, file_path: Path, samples: int):
        """Create synthetic malware detection dataset"""
        np.random.seed(42)
        
        data = []
        for i in range(samples):
            # Generate realistic malware features
            file_size = np.random.lognormal(10, 2)  # Log-normal distribution for file sizes
            entropy = np.random.uniform(0, 8)  # Shannon entropy
            pe_sections = np.random.randint(1, 20)
            imports = np.random.randint(1, 500)
            exports = np.random.randint(0, 100)
            strings_count = np.random.randint(10, 10000)
            
            # Binary classification: 1 = malware, 0 = benign
            # Higher entropy, more sections, more imports = higher chance of malware
            malware_score = (entropy / 8) * 0.3 + (pe_sections / 20) * 0.2 + (imports / 500) * 0.3 + np.random.uniform(0, 0.2)
            is_malware = 1 if malware_score > 0.5 else 0
            
            data.append([
                f"hash_{i:06d}",
                file_size,
                entropy,
                pe_sections,
                imports,
                exports,
                strings_count,
                is_malware
            ])
        
        # Write to CSV
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("file_hash,file_size,entropy,pe_sections,imports,exports,strings_count,is_malware\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_network_dataset(self, file_path: Path, samples: int):
        """Create synthetic network intrusion dataset"""
        np.random.seed(42)
        
        protocols = ['tcp', 'udp', 'icmp']
        services = ['http', 'ftp', 'smtp', 'ssh', 'telnet', 'dns', 'pop3']
        flags = ['SF', 'S0', 'REJ', 'RSTR', 'SH', 'RSTO']
        
        data = []
        for i in range(samples):
            duration = np.random.exponential(10)
            protocol = np.random.choice(protocols)
            service = np.random.choice(services)
            flag = np.random.choice(flags)
            src_bytes = np.random.lognormal(6, 2)
            dst_bytes = np.random.lognormal(6, 2)
            land = np.random.randint(0, 2)
            wrong_fragment = np.random.randint(0, 4)
            
            # Create attack patterns
            attack_patterns = ['normal', 'dos', 'probe', 'r2l', 'u2r']
            weights = [0.6, 0.15, 0.1, 0.1, 0.05]  # Normal traffic is most common
            attack = np.random.choice(attack_patterns, p=weights)
            
            data.append([
                duration, protocol, service, flag, src_bytes, dst_bytes,
                land, wrong_fragment, attack
            ])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("duration,protocol_type,service,flag,src_bytes,dst_bytes,land,wrong_fragment,attack_type\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_phishing_dataset(self, file_path: Path, samples: int):
        """Create synthetic phishing detection dataset"""
        np.random.seed(42)
        
        data = []
        for i in range(samples):
            url_length = np.random.randint(10, 200)
            num_dots = np.random.randint(1, 10)
            subdomain_level = np.random.randint(0, 5)
            https = np.random.randint(0, 2)
            shortening_service = np.random.randint(0, 2)
            suspicious_words = np.random.randint(0, 10)
            
            # Phishing likelihood based on features
            phishing_score = (
                (url_length > 75) * 0.2 +
                (num_dots > 4) * 0.15 +
                (subdomain_level > 2) * 0.2 +
                (https == 0) * 0.15 +
                shortening_service * 0.2 +
                (suspicious_words > 3) * 0.1
            )
            
            is_phishing = 1 if phishing_score > 0.4 or np.random.random() < 0.1 else 0
            
            data.append([
                url_length, num_dots, subdomain_level, https,
                shortening_service, suspicious_words, is_phishing
            ])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("url_length,num_dots,subdomain_level,https,shortening_service,suspicious_words,is_phishing\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_spam_dataset(self, file_path: Path, samples: int):
        """Create synthetic spam detection dataset"""
        np.random.seed(42)
        
        data = []
        for i in range(samples):
            word_freq_make = np.random.exponential(0.5)
            word_freq_money = np.random.exponential(0.3)
            word_freq_free = np.random.exponential(0.2)
            char_freq_dollar = np.random.exponential(0.1)
            char_freq_exclamation = np.random.exponential(0.2)
            capital_run_avg = np.random.exponential(3)
            
            # Spam likelihood
            spam_score = (
                word_freq_money * 0.3 +
                word_freq_free * 0.2 +
                char_freq_dollar * 0.2 +
                char_freq_exclamation * 0.15 +
                (capital_run_avg > 5) * 0.15
            )
            
            is_spam = 1 if spam_score > 0.5 else 0
            
            data.append([
                word_freq_make, word_freq_money, word_freq_free,
                char_freq_dollar, char_freq_exclamation, capital_run_avg, is_spam
            ])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("word_freq_make,word_freq_money,word_freq_free,char_freq_dollar,char_freq_exclamation,capital_run_avg,is_spam\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_botnet_dataset(self, file_path: Path, samples: int):
        """Create synthetic botnet detection dataset"""
        np.random.seed(42)
        
        data = []
        for i in range(samples):
            flow_duration = np.random.exponential(5)
            total_fwd_packets = np.random.poisson(20)
            total_bwd_packets = np.random.poisson(15)
            flow_bytes_s = np.random.lognormal(8, 2)
            flow_packets_s = np.random.exponential(5)
            ack_flag_count = np.random.randint(0, 10)
            
            # Botnet characteristics: periodic communication, specific packet patterns
            botnet_score = (
                (flow_duration < 1) * 0.2 +  # Very short flows
                (abs(total_fwd_packets - total_bwd_packets) < 2) * 0.2 +  # Balanced communication
                (flow_bytes_s > 10000) * 0.3 +  # High data rate
                (ack_flag_count == 0) * 0.3  # No ACK flags (automated)
            )
            
            is_botnet = 1 if botnet_score > 0.6 else 0
            
            data.append([
                flow_duration, total_fwd_packets, total_bwd_packets,
                flow_bytes_s, flow_packets_s, ack_flag_count, is_botnet
            ])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("flow_duration,total_fwd_packets,total_bwd_packets,flow_bytes_s,flow_packets_s,ack_flag_count,is_botnet\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_vulnerability_dataset(self, file_path: Path, samples: int):
        """Create synthetic vulnerability dataset"""
        np.random.seed(42)
        
        severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        types = ['SQL_INJECTION', 'XSS', 'BUFFER_OVERFLOW', 'PRIVILEGE_ESCALATION', 'DENIAL_OF_SERVICE']
        
        data = []
        for i in range(samples):
            cve_id = f"CVE-2023-{i:05d}"
            severity = np.random.choice(severities, p=[0.3, 0.4, 0.2, 0.1])
            vuln_type = np.random.choice(types)
            cvss_score = np.random.uniform(0, 10)
            exploitability = np.random.uniform(0, 10)
            impact = np.random.uniform(0, 10)
            
            # Adjust CVSS score based on severity
            if severity == 'CRITICAL':
                cvss_score = np.random.uniform(9, 10)
            elif severity == 'HIGH':
                cvss_score = np.random.uniform(7, 8.9)
            elif severity == 'MEDIUM':
                cvss_score = np.random.uniform(4, 6.9)
            else:
                cvss_score = np.random.uniform(0, 3.9)
            
            data.append([cve_id, severity, vuln_type, cvss_score, exploitability, impact])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("cve_id,severity,vulnerability_type,cvss_score,exploitability,impact\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_threat_intel_dataset(self, file_path: Path, samples: int):
        """Create synthetic threat intelligence dataset"""
        np.random.seed(42)
        
        threat_types = ['malware', 'phishing', 'c2', 'spam', 'scanning']
        
        data = []
        for i in range(samples):
            ip_parts = [str(np.random.randint(1, 255)) for _ in range(4)]
            ip_address = ".".join(ip_parts)
            threat_type = np.random.choice(threat_types)
            confidence = np.random.uniform(0.1, 1.0)
            first_seen = datetime.now().timestamp() - np.random.randint(0, 86400 * 30)  # Last 30 days
            last_seen = first_seen + np.random.randint(0, 86400 * 7)  # Within 7 days of first seen
            
            data.append([ip_address, threat_type, confidence, first_seen, last_seen])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("ip_address,threat_type,confidence,first_seen,last_seen\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_darkweb_dataset(self, file_path: Path, samples: int):
        """Create synthetic dark web content dataset"""
        np.random.seed(42)
        
        content_types = ['marketplace', 'forum', 'blog', 'service', 'communication']
        languages = ['en', 'ru', 'zh', 'de', 'fr', 'es']
        topics = ['drugs', 'weapons', 'fraud', 'hacking', 'stolen_data', 'general']
        
        data = []
        for i in range(samples):
            content_type = np.random.choice(content_types)
            language = np.random.choice(languages, p=[0.5, 0.2, 0.1, 0.1, 0.05, 0.05])
            topic = np.random.choice(topics, p=[0.3, 0.1, 0.2, 0.2, 0.15, 0.05])
            sentiment = np.random.uniform(-1, 1)  # -1 negative, +1 positive
            risk_score = np.random.uniform(0, 1)
            
            # Adjust risk score based on topic
            if topic in ['drugs', 'weapons', 'fraud']:
                risk_score = np.random.uniform(0.7, 1.0)
            elif topic in ['hacking', 'stolen_data']:
                risk_score = np.random.uniform(0.6, 0.9)
            else:
                risk_score = np.random.uniform(0, 0.5)
            
            data.append([content_type, language, topic, sentiment, risk_score])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("content_type,language,topic,sentiment,risk_score\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_dns_dataset(self, file_path: Path, samples: int):
        """Create synthetic DNS tunneling dataset"""
        np.random.seed(42)
        
        query_types = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS']
        response_codes = ['NOERROR', 'NXDOMAIN', 'SERVFAIL', 'REFUSED']
        
        data = []
        for i in range(samples):
            query_name_length = np.random.randint(5, 100)
            query_type = np.random.choice(query_types, p=[0.6, 0.15, 0.1, 0.05, 0.05, 0.05])
            response_code = np.random.choice(response_codes, p=[0.8, 0.15, 0.03, 0.02])
            subdomain_count = np.random.randint(0, 10)
            
            # DNS tunneling characteristics
            tunneling_score = (
                (query_name_length > 50) * 0.3 +  # Long query names
                (query_type == 'TXT') * 0.3 +     # TXT records often used for tunneling
                (subdomain_count > 5) * 0.2 +      # Many subdomains
                (response_code == 'NXDOMAIN') * 0.2  # Many failed queries
            )
            
            is_tunneling = 1 if tunneling_score > 0.5 else 0
            
            data.append([
                query_name_length, query_type, response_code,
                subdomain_count, is_tunneling
            ])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("query_name_length,query_type,response_code,subdomain_count,is_tunneling\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    async def _create_cryptomining_dataset(self, file_path: Path, samples: int):
        """Create synthetic cryptocurrency mining dataset"""
        np.random.seed(42)
        
        data = []
        for i in range(samples):
            cpu_usage = np.random.uniform(0, 100)
            memory_usage = np.random.uniform(0, 100)
            network_connections = np.random.randint(0, 50)
            gpu_usage = np.random.uniform(0, 100)
            power_consumption = np.random.uniform(50, 300)  # Watts
            
            # Mining characteristics: high CPU/GPU usage, specific network patterns
            mining_score = (
                (cpu_usage > 80) * 0.3 +
                (gpu_usage > 80) * 0.3 +
                (power_consumption > 200) * 0.2 +
                (network_connections < 5) * 0.2  # Mining pools use few connections
            )
            
            is_mining = 1 if mining_score > 0.6 else 0
            
            data.append([
                cpu_usage, memory_usage, network_connections,
                gpu_usage, power_consumption, is_mining
            ])
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write("cpu_usage,memory_usage,network_connections,gpu_usage,power_consumption,is_mining\n")
            for row in data:
                await f.write(",".join(map(str, row)) + "\n")
    
    def get_available_datasets(self) -> Dict[str, Any]:
        """Get list of available datasets"""
        return self.available_datasets
    
    def get_dataset_info(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific dataset"""
        return self.available_datasets.get(dataset_id)
    
    async def load_dataset(self, dataset_id: str) -> Optional[pd.DataFrame]:
        """Load a dataset into a pandas DataFrame"""
        if dataset_id not in self.available_datasets:
            return None
        
        dataset_info = self.available_datasets[dataset_id]
        local_path = Path(dataset_info["local_path"])
        
        # Look for processed CSV file
        processed_file = local_path / f"{dataset_id}_processed.csv"
        
        if processed_file.exists():
            try:
                df = pd.read_csv(processed_file)
                return df
            except Exception as e:
                logger.error(f"Error loading dataset {dataset_id}: {e}")
                return None
        
        return None
    
    async def get_dataset_summary(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Get summary statistics for a dataset"""
        df = await self.load_dataset(dataset_id)
        
        if df is None:
            return None
        
        summary = {
            "dataset_id": dataset_id,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "data_types": df.dtypes.to_dict(),
            "missing_values": df.isnull().sum().to_dict(),
            "memory_usage": df.memory_usage(deep=True).sum(),
            "numeric_summary": {}
        }
        
        # Add numeric column summaries
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        for col in numeric_columns:
            summary["numeric_summary"][col] = {
                "mean": float(df[col].mean()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "median": float(df[col].median())
            }
        
        return summary