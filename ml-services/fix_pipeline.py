import json
from pathlib import Path

nb_path = Path("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/ml-services/notebooks/02_feature_engineering.ipynb")

with open(nb_path, 'r') as f:
    nb = json.load(f)

# Find cell 12 (index 11) which should have the CyberForgeFeaturePipeline class
pipeline_cell_content = '''class CyberForgeFeaturePipeline:
    """
    Unified feature extraction pipeline.
    Combines all extractors for complete feature engineering.
    """
    
    def __init__(self):
        self.url_extractor = url_extractor
        self.network_extractor = network_extractor
        self.header_extractor = header_extractor
        self.js_extractor = js_extractor
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_names = []
    
    def extract_website_features(self, scraped_data: Dict) -> Dict[str, Any]:
        """Extract all features from website scraped data"""
        features = {}
        
        # URL features
        url_features = self.url_extractor.extract(scraped_data.get('url', ''))
        features.update({f"url_{k}": v for k, v in url_features.items() if k != 'tld'})
        
        # Network features
        network_features = self.network_extractor.extract_from_requests(
            scraped_data.get('network_requests', [])
        )
        features.update({f"net_{k}": v for k, v in network_features.items()})
        
        # Security header features
        header_features = self.header_extractor.extract(
            scraped_data.get('response_headers', {}),
            scraped_data.get('security_report', {})
        )
        features.update({f"sec_{k}": v for k, v in header_features.items()})
        
        # JavaScript features
        js_features = self.js_extractor.extract_from_console_logs(
            scraped_data.get('console_logs', [])
        )
        features.update({f"js_{k}": v for k, v in js_features.items()})
        
        # Calculate risk score
        features['security_score'] = self.header_extractor.calculate_security_score(header_features)
        
        return features
    
    def process_dataset(self, df: pd.DataFrame, url_column: str = 'url') -> pd.DataFrame:
        """Process a dataset and extract URL features"""
        if url_column not in df.columns:
            print(f"  Warning: No '{url_column}' column found")
            return df
        
        try:
            # Extract URL features
            url_features = df[url_column].apply(lambda x: self.url_extractor.extract(x))
            url_df = pd.DataFrame(url_features.tolist())
            
            # Drop non-numeric 'tld' column before renaming
            if 'tld' in url_df.columns:
                url_df = url_df.drop(columns=['tld'])
            
            # Rename columns with url_ prefix
            url_df.columns = [f"url_{c}" for c in url_df.columns]
            
            # Combine with original features (drop original url column to avoid issues)
            result_df = df.drop(columns=[url_column]).reset_index(drop=True)
            result = pd.concat([result_df, url_df.reset_index(drop=True)], axis=1)
            
            return result
        except Exception as e:
            print(f"  Warning: URL feature extraction error: {e}")
            return df
    
    def prepare_for_training(self, df: pd.DataFrame, label_column: str = 'label') -> tuple:
        """Prepare features for model training"""
        df = df.copy()
        
        # Find label column (case insensitive, multiple names)
        label_candidates = ['label', 'target', 'class', 'is_malicious', 'attack_type', 
                           'attack', 'category', 'malware', 'phishing', 'threat', 'type', 'y']
        actual_label_col = None
        for col in df.columns:
            if col.lower() in [lc.lower() for lc in label_candidates]:
                actual_label_col = col
                break
        
        # Separate features and labels
        if actual_label_col:
            y = df[actual_label_col]
            X = df.drop(columns=[actual_label_col])
        else:
            y = None
            X = df
        
        # Select numeric columns only
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        bool_cols = X.select_dtypes(include=[bool]).columns.tolist()
        
        X_numeric = X[numeric_cols].fillna(0)
        
        # Convert boolean to int
        for col in bool_cols:
            if col in X.columns:
                X_numeric[col] = X[col].astype(int)
        
        self.feature_names = X_numeric.columns.tolist()
        
        # Encode labels if present
        if y is not None:
            if y.dtype == 'object':
                y = self.label_encoder.fit_transform(y)
            else:
                y = y.values
        
        return X_numeric, y

pipeline = CyberForgeFeaturePipeline()
print("Feature Pipeline initialized")'''

# Find the cell with the broken methods (cell index 11)
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'code':
        src = ''.join(cell['source'])
        if 'def process_dataset(self, df: pd.DataFrame, url_column:' in src and 'class CyberForgeFeaturePipeline' not in src:
            # This is the broken cell - replace it
            cell['source'] = [line + '\n' for line in pipeline_cell_content.split('\n')]
            print(f"Fixed cell {i}")
            break

with open(nb_path, 'w') as f:
    json.dump(nb, f, indent=1)

print("Notebook 02 fixed - CyberForgeFeaturePipeline class restored")

# Upload
from huggingface_hub import HfApi
api = HfApi(token='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')
api.upload_file(
    path_or_fileobj=str(nb_path),
    path_in_repo='notebooks/02_feature_engineering.ipynb',
    repo_id='Che237/cyberforge',
    repo_type='space',
    commit_message='Fix CyberForgeFeaturePipeline class definition'
)
print("Uploaded to HF Space")
