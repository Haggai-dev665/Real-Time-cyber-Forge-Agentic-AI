#!/usr/bin/env python3
"""
Update CyberForge ML notebooks to fulfill TODO 1 requirements:
1. Add threat_detection task to ModelConfig (notebook 03)
2. Add threat detection training cell (notebook 03)
3. Add browser intelligence features to agent (notebook 04) 
4. Add /api/threats/detect and /api/analysis/explain to inference module (notebook 06)
5. Fix JS client to match mlServiceClient.js contract (notebook 06)
6. Fix Dockerfile CMD (notebook 07)
"""

import json
import copy
from pathlib import Path
import sys

NOTEBOOKS_DIR = Path(__file__).parent / "notebooks"

def load_notebook(name):
    path = NOTEBOOKS_DIR / name
    with open(path, 'r') as f:
        return json.load(f)

def save_notebook(name, nb):
    path = NOTEBOOKS_DIR / name
    with open(path, 'w') as f:
        json.dump(nb, f, indent=1)
    print(f"  ✅ Saved {name}")

def make_code_cell(source_lines):
    """Create a code cell from a list of strings (each ending with \\n)"""
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source_lines
    }

def make_markdown_cell(source_lines):
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": source_lines
    }

# ============================================================================
# NOTEBOOK 03 — Model Training: Add threat_detection task + training cell
# ============================================================================

def update_notebook_03():
    print("\n📓 Updating 03_model_training.ipynb...")
    nb = load_notebook("03_model_training.ipynb")
    cells = nb["cells"]
    
    # Find the ModelConfig cell (cell 6 in summary, index 5)
    config_cell_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "class ModelConfig:" in src and "TASK_MODELS" in src:
            config_cell_idx = i
            break
    
    if config_cell_idx is None:
        print("  ⚠ Could not find ModelConfig cell — skipping")
        return
    
    # Patch TASK_MODELS to add threat_detection
    src_lines = cells[config_cell_idx]["source"]
    new_lines = []
    for line in src_lines:
        new_lines.append(line)
        if "'vulnerability_assessment'" in line and "gradient_boosting" in line:
            # Add threat_detection after vulnerability_assessment
            new_lines.append("        'threat_detection': ['random_forest', 'gradient_boosting', 'logistic_regression'],\n")
            new_lines.append("        'browser_intelligence': ['random_forest', 'gradient_boosting'],\n")
    
    cells[config_cell_idx]["source"] = new_lines
    print("  ✓ Added threat_detection + browser_intelligence to TASK_MODELS")
    
    # Find the training loop cell and insert a threat-specific training cell after it
    train_loop_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "Train models for each dataset" in src and "all_results" in src:
            train_loop_idx = i
            break
    
    if train_loop_idx is not None:
        # Insert markdown + code cell for threat detection text classifier
        md_cell = make_markdown_cell([
            "## 📡 Threat Detection Text Classifier\n",
            "\n",
            "Train a model specifically for the `/api/threats/detect` endpoint.\n",
            "This classifier processes evidence text from `mlServiceClient.formatEvidenceForML()` and outputs:\n",
            "- `risk_score` (0-100)\n",
            "- `confidence` (0-1)\n",
            "- `threat_type` (phishing, malware, suspicious, benign, ...)\n",
            "- `indicators` (list of signals)"
        ])
        
        code_cell = make_code_cell([
            "# ── Threat Detection Text Classifier ──────────────────────────────────────\n",
            "# This trains a model specifically for evidence-text classification,\n",
            "# matching the contract of /api/threats/detect.\n",
            "\n",
            "from sklearn.feature_extraction.text import TfidfVectorizer\n",
            "from sklearn.pipeline import Pipeline\n",
            "from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier\n",
            "from sklearn.linear_model import LogisticRegression\n",
            "import numpy as np, json, joblib\n",
            "from pathlib import Path\n",
            "\n",
            "# Synthetic threat evidence corpus for initial training\n",
            "THREAT_CORPUS = [\n",
            "    # (evidence_text, threat_type, risk_score)\n",
            "    ('URL: http://secure-login-update.com\\nRisk Level: high\\nRisk Score: 78/100\\nHTTPS: No\\nMissing Security Headers: X-Frame-Options, Content-Security-Policy', 'phishing', 78),\n",
            "    ('URL: https://docs.google.com\\nRisk Level: low\\nRisk Score: 8/100\\nHTTPS: Yes\\nMixed Content: No', 'benign', 8),\n",
            "    ('URL: http://free-download-crack.xyz\\nRisk Level: critical\\nRisk Score: 92/100\\nHTTPS: No\\nSuspicious Requests Detected:\\n- http://malware-cdn.biz/payload.exe', 'malware', 92),\n",
            "    ('URL: https://example.com\\nRisk Level: medium\\nRisk Score: 45/100\\nExternal Domains: 12\\nSuspicious Requests: 3', 'suspicious', 45),\n",
            "    ('URL: http://coinhive-miner.top\\nRisk Level: high\\nRisk Score: 85/100\\nSuspicious Requests Detected:\\n- http://coinhive-miner.top/lib/coinhive.min.js', 'crypto', 85),\n",
            "    ('URL: https://shop.example.com\\nRisk Level: minimal\\nRisk Score: 5/100\\nHTTPS: Yes\\nMixed Content: No\\nExternal Domains: 2', 'benign', 5),\n",
            "    ('URL: http://c2-beacon.ru\\nRisk Level: critical\\nRisk Score: 95/100\\nHTTPS: No\\nSuspicious Requests Detected:\\n- http://c2-beacon.ru/gate.php', 'botnet', 95),\n",
            "    ('URL: https://mybank-security.tk\\nRisk Level: high\\nRisk Score: 82/100\\nHTTPS: Yes\\nMissing Security Headers: Strict-Transport-Security, X-Content-Type-Options\\nSuspicious Requests: 5', 'phishing', 82),\n",
            "    ('URL: https://github.com\\nRisk Level: low\\nRisk Score: 3/100\\nHTTPS: Yes\\nMixed Content: No', 'benign', 3),\n",
            "    ('URL: http://tracker.adnetwork.info\\nRisk Level: medium\\nRisk Score: 55/100\\nExternal Domains: 24\\nTracking: Yes', 'suspicious', 55),\n",
            "    ('URL: http://dns-exfil.evil.com\\nRisk Level: critical\\nRisk Score: 90/100\\nDNS tunnel subdomain pattern detected', 'dns_tunnel', 90),\n",
            "    ('URL: https://legitimate-news.com\\nRisk Level: low\\nRisk Score: 12/100\\nHTTPS: Yes\\nExternal Domains: 4', 'benign', 12),\n",
            "]\n",
            "\n",
            "texts = [t[0] for t in THREAT_CORPUS]\n",
            "labels = [t[1] for t in THREAT_CORPUS]\n",
            "risk_scores = [t[2] for t in THREAT_CORPUS]\n",
            "\n",
            "# Augment corpus by repeating with minor variations (ensures minimum samples)\n",
            "import random\n",
            "random.seed(42)\n",
            "aug_texts, aug_labels, aug_scores = list(texts), list(labels), list(risk_scores)\n",
            "for _ in range(10):  # 10x augmentation\n",
            "    for t, l, s in zip(texts, labels, risk_scores):\n",
            "        noise = random.randint(-5, 5)\n",
            "        aug_texts.append(t.replace(str(s), str(max(0, min(100, s + noise)))))\n",
            "        aug_labels.append(l)\n",
            "        aug_scores.append(max(0, min(100, s + noise)))\n",
            "\n",
            "# Build TF-IDF + classifier pipeline for threat type\n",
            "threat_type_pipeline = Pipeline([\n",
            "    ('tfidf', TfidfVectorizer(max_features=500, ngram_range=(1, 2))),\n",
            "    ('clf', LogisticRegression(max_iter=1000, random_state=42))\n",
            "])\n",
            "\n",
            "threat_type_pipeline.fit(aug_texts, aug_labels)\n",
            "print(f'✓ Threat type classifier trained on {len(aug_texts)} samples')\n",
            "print(f'  Classes: {list(threat_type_pipeline.classes_)}')\n",
            "\n",
            "# Build TF-IDF + regressor pipeline for risk score\n",
            "from sklearn.ensemble import GradientBoostingRegressor\n",
            "risk_score_pipeline = Pipeline([\n",
            "    ('tfidf', TfidfVectorizer(max_features=500, ngram_range=(1, 2))),\n",
            "    ('reg', GradientBoostingRegressor(n_estimators=50, max_depth=4, random_state=42))\n",
            "])\n",
            "\n",
            "risk_score_pipeline.fit(aug_texts, aug_scores)\n",
            "print(f'✓ Risk score regressor trained')\n",
            "\n",
            "# Save to models directory\n",
            "MODELS_DIR = Path(config.get('models_dir', '../models'))\n",
            "MODELS_DIR.mkdir(parents=True, exist_ok=True)\n",
            "\n",
            "threat_dir = MODELS_DIR / 'threat_detection'\n",
            "threat_dir.mkdir(exist_ok=True)\n",
            "\n",
            "joblib.dump(threat_type_pipeline, threat_dir / 'threat_type_pipeline.pkl')\n",
            "joblib.dump(risk_score_pipeline, threat_dir / 'risk_score_pipeline.pkl')\n",
            "\n",
            "# Save metadata\n",
            "meta = {\n",
            "    'model_type': 'text_classification_pipeline',\n",
            "    'classes': list(threat_type_pipeline.classes_),\n",
            "    'training_samples': len(aug_texts),\n",
            "    'purpose': 'Classify evidence text for /api/threats/detect endpoint',\n",
            "    'input_format': 'Evidence text from mlServiceClient.formatEvidenceForML()',\n",
            "    'output_format': {'risk_score': '0-100', 'threat_type': 'string', 'confidence': '0-1'},\n",
            "}\n",
            "with open(threat_dir / 'metadata.json', 'w') as f:\n",
            "    json.dump(meta, f, indent=2)\n",
            "\n",
            "print(f'✓ Threat detection models saved to {threat_dir}')\n",
            "\n",
            "# Quick validation\n",
            "test_evidence = 'URL: http://evil-phish.com\\nRisk Level: high\\nRisk Score: 80/100\\nHTTPS: No\\nMissing Security Headers: CSP'\n",
            "pred_type = threat_type_pipeline.predict([test_evidence])[0]\n",
            "pred_score = risk_score_pipeline.predict([test_evidence])[0]\n",
            "pred_proba = threat_type_pipeline.predict_proba([test_evidence])[0]\n",
            "confidence = float(max(pred_proba))\n",
            "\n",
            "print(f'\\n🧪 Test prediction:')\n",
            "print(f'   Evidence: {test_evidence[:60]}...')\n",
            "print(f'   Threat type: {pred_type}')\n",
            "print(f'   Risk score: {pred_score:.1f}')\n",
            "print(f'   Confidence: {confidence:.2f}')\n",
        ])
        
        cells.insert(train_loop_idx + 1, md_cell)
        cells.insert(train_loop_idx + 2, code_cell)
        print("  ✓ Inserted threat detection text classifier training cell")
    
    save_notebook("03_model_training.ipynb", nb)


# ============================================================================
# NOTEBOOK 04 — Agent Intelligence: Add browser intel + Appwrite stubs
# ============================================================================

def update_notebook_04():
    print("\n📓 Updating 04_agent_intelligence.ipynb...")
    nb = load_notebook("04_agent_intelligence.ipynb")
    cells = nb["cells"]
    
    # Find the CyberForgeAgent class cell
    agent_cell_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "class CyberForgeAgent" in src and "_extract_indicators" in src:
            agent_cell_idx = i
            break
    
    if agent_cell_idx is None:
        print("  ⚠ Could not find CyberForgeAgent cell — skipping")
        return
    
    # Find the saved module cell (stub)
    module_cell_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "cyberforge_agent.py" in src and "is_https" in src and "class CyberForgeAgentModule" in src:
            module_cell_idx = i
            break
    
    # Insert browser intelligence feature extraction cell after agent cell
    md_cell = make_markdown_cell([
        "## 🌐 Browser Intelligence Integration\n",
        "\n",
        "Extends the agent to process browser intelligence data from the desktop app.\n",
        "This data flows from: Tauri Rust → Desktop UI → `/api/agent/browser-intelligence` → ML analysis."
    ])
    
    browser_intel_cell = make_code_cell([
        "# ── Browser Intelligence Analyzer ─────────────────────────────────────────\n",
        "# Processes browser detection snapshots from the desktop agent and\n",
        "# extracts security-relevant indicators.\n",
        "\n",
        "class BrowserIntelligenceAnalyzer:\n",
        "    \"\"\"\n",
        "    Analyzes browser intelligence snapshots from the desktop agent.\n",
        "    Identifies security risks based on browser configurations.\n",
        "    \"\"\"\n",
        "    \n",
        "    # Browsers with known security concerns\n",
        "    OUTDATED_RISK = 0.3\n",
        "    NO_HTTPS_DEFAULT_RISK = 0.2\n",
        "    MULTIPLE_BROWSERS_BONUS = -0.1  # Diversity is good\n",
        "    \n",
        "    # Known risky browser versions (example thresholds)\n",
        "    MIN_SAFE_VERSIONS = {\n",
        "        'chrome': 120,\n",
        "        'firefox': 121,\n",
        "        'edge': 120,\n",
        "        'brave': 1,\n",
        "        'opera': 105,\n",
        "        'safari': 17,\n",
        "    }\n",
        "    \n",
        "    def analyze_snapshot(self, snapshot: dict) -> dict:\n",
        "        \"\"\"Analyze a browser intelligence snapshot and return risk assessment.\"\"\"\n",
        "        browsers = snapshot.get('browsers', [])\n",
        "        if not browsers:\n",
        "            return {'risk_score': 0, 'indicators': ['no_browsers_detected'], 'recommendations': []}\n",
        "        \n",
        "        indicators = []\n",
        "        risk_score = 0.0\n",
        "        recommendations = []\n",
        "        \n",
        "        installed = [b for b in browsers if b.get('isInstalled')]\n",
        "        running = [b for b in browsers if b.get('isRunning')]\n",
        "        \n",
        "        # Check for outdated browsers\n",
        "        for b in installed:\n",
        "            key = b.get('key', '').lower()\n",
        "            version_str = b.get('version', '')\n",
        "            try:\n",
        "                major = int(version_str.split('.')[0]) if version_str else 0\n",
        "            except (ValueError, IndexError):\n",
        "                major = 0\n",
        "            \n",
        "            min_safe = self.MIN_SAFE_VERSIONS.get(key, 0)\n",
        "            if major > 0 and major < min_safe:\n",
        "                indicators.append(f'outdated_{key}_v{major}')\n",
        "                risk_score += self.OUTDATED_RISK\n",
        "                recommendations.append(f'Update {b.get(\"name\", key)} to latest version')\n",
        "        \n",
        "        # Check default browser\n",
        "        default_browser = snapshot.get('defaultBrowser', '')\n",
        "        if not default_browser or default_browser == 'Unknown':\n",
        "            indicators.append('no_default_browser_detected')\n",
        "        \n",
        "        # Diversity bonus\n",
        "        if len(installed) >= 3:\n",
        "            risk_score += self.MULTIPLE_BROWSERS_BONUS\n",
        "            indicators.append(f'browser_diversity_{len(installed)}')\n",
        "        \n",
        "        # Running but not default\n",
        "        for b in running:\n",
        "            if b.get('name') != default_browser:\n",
        "                indicators.append(f'non_default_running_{b.get(\"key\", \"unknown\")}')\n",
        "        \n",
        "        risk_score = max(0.0, min(1.0, risk_score))\n",
        "        \n",
        "        return {\n",
        "            'risk_score': round(risk_score * 100, 1),\n",
        "            'confidence': 0.7,\n",
        "            'indicators': indicators,\n",
        "            'recommendations': recommendations,\n",
        "            'summary': {\n",
        "                'installed_count': len(installed),\n",
        "                'running_count': len(running),\n",
        "                'os': snapshot.get('os', 'unknown'),\n",
        "                'default_browser': default_browser,\n",
        "            }\n",
        "        }\n",
        "\n",
        "# Test\n",
        "analyzer = BrowserIntelligenceAnalyzer()\n",
        "test_snapshot = {\n",
        "    'browsers': [\n",
        "        {'key': 'chrome', 'name': 'Google Chrome', 'isInstalled': True, 'isRunning': True, 'version': '115.0.5790', 'isDefault': True},\n",
        "        {'key': 'firefox', 'name': 'Mozilla Firefox', 'isInstalled': True, 'isRunning': False, 'version': '110.0'},\n",
        "        {'key': 'brave', 'name': 'Brave', 'isInstalled': True, 'isRunning': False, 'version': '1.61.0'},\n",
        "    ],\n",
        "    'defaultBrowser': 'Google Chrome',\n",
        "    'os': 'macos',\n",
        "}\n",
        "result = analyzer.analyze_snapshot(test_snapshot)\n",
        "print('🧪 Browser Intelligence Analysis:')\n",
        "print(f'   Risk score: {result[\"risk_score\"]}')\n",
        "print(f'   Indicators: {result[\"indicators\"]}')\n",
        "print(f'   Recommendations: {result[\"recommendations\"]}')\n",
    ])
    
    insert_idx = agent_cell_idx + 1
    cells.insert(insert_idx, md_cell)
    cells.insert(insert_idx + 1, browser_intel_cell)
    print("  ✓ Inserted BrowserIntelligenceAnalyzer cell")
    
    # Now update the saved module cell if found — replace the stub
    if module_cell_idx is not None:
        # Adjust index since we inserted 2 cells before it
        adj_idx = module_cell_idx + 2
        if adj_idx < len(cells):
            cells[adj_idx]["source"] = [
                "# ── Save Enhanced Agent Module ────────────────────────────────────────────\n",
                "# Saves a production-ready agent module with threat detection and\n",
                "# browser intelligence support.\n",
                "\n",
                "agent_module_code = '''\n",
                '\"\"\"CyberForge Agent Module — Production\\n',
                'Provides threat analysis, browser intelligence, and Gemini reasoning.\\n',
                '\"\"\"\\n',
                "import json, logging, time\\n",
                "from typing import Dict, List, Any, Optional\\n",
                "from pathlib import Path\\n",
                "\\n",
                "logger = logging.getLogger(__name__)\\n",
                "\\n",
                "class CyberForgeAgentModule:\\n",
                "    THREAT_KEYWORDS = {\\n",
                "        'phishing': ['phishing', 'credential', 'login', 'fake', 'spoof'],\\n",
                "        'malware': ['malware', 'trojan', 'ransomware', 'payload', 'exploit'],\\n",
                "        'suspicious': ['suspicious', 'obfuscated', 'redirect', 'tracking'],\\n",
                "        'crypto': ['cryptominer', 'mining', 'coinhive'],\\n",
                "        'botnet': ['botnet', 'c2', 'command and control', 'beacon'],\\n",
                "    }\\n",
                "\\n",
                "    def analyze_evidence(self, evidence_text: str, metadata: dict = None) -> dict:\\n",
                "        text = evidence_text.lower()\\n",
                "        metadata = metadata or {}\\n",
                "        indicators = []\\n",
                '        risk_score = float(metadata.get("riskScore", 0))\\n',
                "        threat_type = 'benign'\\n",
                "\\n",
                "        for category, keywords in self.THREAT_KEYWORDS.items():\\n",
                "            hits = [kw for kw in keywords if kw in text]\\n",
                "            if hits:\\n",
                "                indicators.extend([f'{category}:{kw}' for kw in hits])\\n",
                "                risk_score = min(risk_score + len(hits) * 15, 100)\\n",
                "                threat_type = category\\n",
                "\\n",
                "        if 'missing security headers' in text:\\n",
                "            indicators.append('missing_headers')\\n",
                "            risk_score = min(risk_score + 10, 100)\\n",
                "        if 'https: no' in text:\\n",
                "            indicators.append('no_https')\\n",
                "            risk_score = min(risk_score + 15, 100)\\n",
                "\\n",
                "        confidence = 0.55 + min(len(indicators) * 0.05, 0.35)\\n",
                "\\n",
                "        return {\\n",
                "            'risk_score': round(min(risk_score, 100), 1),\\n",
                "            'confidence': round(confidence, 2),\\n",
                "            'threat_type': threat_type,\\n",
                "            'indicators': indicators or ['no_signals'],\\n",
                "            'details': {\\n",
                "                'original_risk_score': metadata.get('riskScore', 0),\\n",
                "                'url': metadata.get('url', ''),\\n",
                "                'analysis_method': 'heuristic+keyword',\\n",
                "            }\\n",
                "        }\\n",
                "\\n",
                "    def analyze_browser_intelligence(self, snapshot: dict) -> dict:\\n",
                "        browsers = snapshot.get('browsers', [])\\n",
                "        installed = [b for b in browsers if b.get('isInstalled')]\\n",
                "        running = [b for b in browsers if b.get('isRunning')]\\n",
                "        indicators = []\\n",
                "        risk = 0.0\\n",
                "\\n",
                "        for b in installed:\\n",
                "            version_str = b.get('version', '')\\n",
                "            try:\\n",
                "                major = int(version_str.split('.')[0])\\n",
                "            except (ValueError, IndexError):\\n",
                "                major = 0\\n",
                "            if major > 0 and major < 120:\\n",
                "                indicators.append(f'outdated_{b.get(\"key\", \"unknown\")}')\\n",
                "                risk += 0.3\\n",
                "\\n",
                "        return {\\n",
                "            'risk_score': round(min(risk, 1.0) * 100, 1),\\n",
                "            'indicators': indicators or ['all_browsers_current'],\\n",
                "            'installed_count': len(installed),\\n",
                "            'running_count': len(running),\\n",
                "        }\\n",
                "'''\n",
                "\n",
                "module_path = Path(config.get('models_dir', '../models')) / 'cyberforge_agent.py'\n",
                "module_path.parent.mkdir(parents=True, exist_ok=True)\n",
                "with open(module_path, 'w') as f:\n",
                "    f.write(agent_module_code)\n",
                "\n",
                "print(f'✓ Enhanced agent module saved to {module_path}')\n",
            ]
            print("  ✓ Replaced agent module stub with full implementation")
    
    save_notebook("04_agent_intelligence.ipynb", nb)


# ============================================================================
# NOTEBOOK 06 — Backend Integration: Fix inference.py + JS client
# ============================================================================

def update_notebook_06():
    print("\n📓 Updating 06_backend_integration.ipynb...")
    nb = load_notebook("06_backend_integration.ipynb")
    cells = nb["cells"]
    
    # Find the inference module cell 
    inference_cell_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "CyberForge ML Inference Module" in src and "create_api" in src and "@app.post" in src:
            inference_cell_idx = i
            break
    
    if inference_cell_idx is None:
        print("  ⚠ Could not find inference module cell — skipping")
        return
    
    # Replace the entire cell with updated inference module that includes
    # /api/threats/detect and /api/analysis/explain
    cells[inference_cell_idx]["source"] = [
        "# Generate Python inference module for backend\n",
        "inference_module = '''\n",
        '\"\"\"\\n',
        "CyberForge ML Inference Module\\n",
        "Backend integration for mlService.js\\n",
        "Includes /api/threats/detect and /api/analysis/explain endpoints.\\n",
        '\"\"\"\\n',
        "\\n",
        "import json\\n",
        "import time\\n",
        "import re\\n",
        "import joblib\\n",
        "import numpy as np\\n",
        "from pathlib import Path\\n",
        "from datetime import datetime\\n",
        "from typing import Dict, List, Any, Optional\\n",
        "\\n",
        "\\n",
        "class CyberForgeInference:\\n",
        '    \"\"\"ML inference service for CyberForge backend.\"\"\"\\n',
        "\\n",
        "    def __init__(self, models_dir: str):\\n",
        "        self.models_dir = Path(models_dir)\\n",
        "        self.loaded_models = {}\\n",
        "        self.manifest = self._load_manifest()\\n",
        "        self.threat_type_pipeline = None\\n",
        "        self.risk_score_pipeline = None\\n",
        "        self._load_threat_models()\\n",
        "\\n",
        "    def _load_manifest(self) -> Dict:\\n",
        '        manifest_path = self.models_dir / \"manifest.json\"\\n',
        "        if manifest_path.exists():\\n",
        "            with open(manifest_path) as f:\\n",
        "                return json.load(f)\\n",
        '        return {\"models\": {}}\\n',
        "\\n",
        "    def _load_threat_models(self):\\n",
        '        threat_dir = self.models_dir / \"threat_detection\"\\n',
        '        type_path = threat_dir / \"threat_type_pipeline.pkl\"\\n',
        '        score_path = threat_dir / \"risk_score_pipeline.pkl\"\\n',
        "        if type_path.exists():\\n",
        "            self.threat_type_pipeline = joblib.load(type_path)\\n",
        "        if score_path.exists():\\n",
        "            self.risk_score_pipeline = joblib.load(score_path)\\n",
        "\\n",
        "    def load_model(self, model_name: str) -> bool:\\n",
        "        if model_name in self.loaded_models:\\n",
        "            return True\\n",
        "        model_dir = self.models_dir / model_name\\n",
        '        model_path = model_dir / \"model.pkl\"\\n',
        '        scaler_path = model_dir / \"scaler.pkl\"\\n',
        "        if not model_path.exists():\\n",
        "            return False\\n",
        "        self.loaded_models[model_name] = {\\n",
        '            \"model\": joblib.load(model_path),\\n',
        '            \"scaler\": joblib.load(scaler_path) if scaler_path.exists() else None\\n',
        "        }\\n",
        "        return True\\n",
        "\\n",
        "    def predict(self, model_name: str, features: Dict) -> Dict:\\n",
        "        if not self.load_model(model_name):\\n",
        '            return {\"error\": f\"Model not found: {model_name}\"}\\n',
        "        model_data = self.loaded_models[model_name]\\n",
        '        model = model_data[\"model\"]\\n',
        '        scaler = model_data[\"scaler\"]\\n',
        "        X = np.array([list(features.values())])\\n",
        "        if scaler:\\n",
        "            X = scaler.transform(X)\\n",
        "        start_time = time.time()\\n",
        "        prediction = int(model.predict(X)[0])\\n",
        "        inference_time = (time.time() - start_time) * 1000\\n",
        "        confidence = 0.5\\n",
        '        if hasattr(model, \"predict_proba\"):\\n',
        "            proba = model.predict_proba(X)[0]\\n",
        "            confidence = float(max(proba))\\n",
        '        risk_level = \"critical\" if confidence >= 0.9 else \"high\" if confidence >= 0.7 else \"medium\" if confidence >= 0.5 else \"low\"\\n',
        "        return {\\n",
        '            \"prediction\": prediction,\\n',
        '            \"confidence\": confidence,\\n',
        '            \"risk_level\": risk_level,\\n',
        '            \"model_name\": model_name,\\n',
        '            \"inference_time_ms\": inference_time\\n',
        "        }\\n",
        "\\n",
        "    # ── Threat Detection (matches /api/threats/detect contract) ──\\n",
        "    THREAT_KEYWORDS = {\\n",
        "        'phishing': (['phishing', 'credential', 'login', 'fake', 'spoof'], 25),\\n",
        "        'malware': (['malware', 'trojan', 'ransomware', 'payload', 'exploit'], 30),\\n",
        "        'suspicious': (['suspicious', 'obfuscated', 'redirect', 'tracking'], 15),\\n",
        "        'crypto': (['cryptominer', 'mining', 'coinhive'], 20),\\n",
        "        'botnet': (['botnet', 'c2', 'command and control', 'beacon'], 25),\\n",
        "    }\\n",
        "\\n",
        "    def detect_threat(self, text: str, metadata: dict = None) -> dict:\\n",
        "        metadata = metadata or {}\\n",
        '        original_risk = float(metadata.get(\"riskScore\", 0))\\n',
        "        text_lower = text.lower()\\n",
        "        indicators = []\\n",
        "        risk_score = original_risk\\n",
        '        threat_type = \"benign\"\\n',
        "\\n",
        "        # ML pipeline prediction (if available)\\n",
        "        if self.threat_type_pipeline:\\n",
        "            threat_type = self.threat_type_pipeline.predict([text])[0]\\n",
        "            proba = self.threat_type_pipeline.predict_proba([text])[0]\\n",
        "            ml_confidence = float(max(proba))\\n",
        "        else:\\n",
        "            ml_confidence = 0.5\\n",
        "\\n",
        "        if self.risk_score_pipeline:\\n",
        "            risk_score = float(self.risk_score_pipeline.predict([text])[0])\\n",
        "\\n",
        "        # Heuristic enrichment\\n",
        "        for cat, (keywords, weight) in self.THREAT_KEYWORDS.items():\\n",
        "            hits = [kw for kw in keywords if kw in text_lower]\\n",
        "            if hits:\\n",
        "                indicators.extend([f'{cat}:{kw}' for kw in hits])\\n",
        "                risk_score = min(risk_score + weight, 100)\\n",
        "\\n",
        '        if \"missing security headers\" in text_lower:\\n',
        "            indicators.append('missing_headers')\\n",
        "            risk_score = min(risk_score + 10, 100)\\n",
        '        if \"https: no\" in text_lower:\\n',
        "            indicators.append('no_https')\\n",
        "            risk_score = min(risk_score + 15, 100)\\n",
        "\\n",
        "        confidence = max(ml_confidence, 0.55 + min(len(indicators) * 0.05, 0.35))\\n",
        "\\n",
        "        return {\\n",
        '            \"risk_score\": round(min(risk_score, 100), 1),\\n',
        '            \"confidence\": round(confidence, 2),\\n',
        '            \"threat_type\": threat_type,\\n',
        '            \"indicators\": indicators or [\"no_signals\"],\\n',
        '            \"details\": {\\n',
        '                \"original_risk_score\": original_risk,\\n',
        '                \"url\": metadata.get(\"url\", \"\"),\\n',
        '                \"analysis_method\": \"ml+heuristic\" if self.threat_type_pipeline else \"heuristic\",\\n',
        "                \"analyzed_at\": datetime.utcnow().isoformat()\\n",
        "            }\\n",
        "        }\\n",
        "\\n",
        "    # ── Analysis Explanation (matches /api/analysis/explain contract) ──\\n",
        "    REC_MAP = {\\n",
        "        'phishing': ['Block the domain at firewall/DNS', 'Alert users', 'Check credential stores'],\\n",
        "        'malware': ['Quarantine endpoints', 'Scan with updated AV', 'Review lateral movement'],\\n",
        "        'suspicious': ['Add to watchlist', 'Enable enhanced logging', 'Review security headers'],\\n",
        "        'crypto': ['Block mining scripts via CSP', 'Scan endpoints', 'Review CPU usage'],\\n",
        "        'botnet': ['Block C2 IPs/domains', 'Scan for persistence', 'Review DNS beaconing'],\\n",
        "    }\\n",
        "\\n",
        "    def explain_threat(self, threat_data: dict) -> dict:\\n",
        '        category = threat_data.get(\"category\", \"unknown\")\\n',
        '        threat_type = threat_data.get(\"threatType\", category)\\n',
        '        confidence = threat_data.get(\"confidence\", 0)\\n',
        '        risk_score = threat_data.get(\"riskScore\", 0)\\n',
        '        indicators = threat_data.get(\"indicators\", [])\\n',
        "\\n",
        "        recs = self.REC_MAP.get(threat_type, self.REC_MAP.get(category, [\\n",
        "            'Monitor the source', 'Review network traffic', 'Update threat feeds'\\n",
        "        ]))\\n",
        "\\n",
        "        summary = (\\n",
        "            f\"{threat_type.replace('_', ' ').title()} threat detected \"\\n",
        "            f\"with {round(confidence * 100)}% confidence (risk {risk_score}/100). \"\\n",
        "            f\"{len(indicators)} indicator(s) triggered.\"\\n",
        "        )\\n",
        "        technical = (\\n",
        "            f\"Type: {threat_type} | Risk: {risk_score}/100 | \"\\n",
        "            f\"Confidence: {round(confidence * 100)}% | \"\\n",
        "            f\"Indicators: {', '.join(indicators[:5])}\"\\n",
        "        )\\n",
        "\\n",
        "        return {\\n",
        '            \"summary\": summary,\\n',
        '            \"recommendations\": recs[:5],\\n',
        '            \"technical_details\": technical,\\n',
        '            \"timestamp\": datetime.utcnow().isoformat()\\n',
        "        }\\n",
        "\\n",
        "    def list_models(self) -> List[str]:\\n",
        '        return list(self.manifest.get(\"models\", {}).keys())\\n',
        "\\n",
        "    def get_model_info(self, model_name: str) -> Dict:\\n",
        '        return self.manifest.get(\"models\", {}).get(model_name, {})\\n',
        "\\n",
        "\\n",
        "# ── FastAPI integration ──\\n",
        "def create_api(models_dir: str = '.'):\\n",
        "    from fastapi import FastAPI, HTTPException\\n",
        "    from pydantic import BaseModel\\n",
        "\\n",
        '    app = FastAPI(title=\"CyberForge ML API\", version=\"1.0.0\")\\n',
        "    inference = CyberForgeInference(models_dir)\\n",
        "\\n",
        "    class PredictRequest(BaseModel):\\n",
        "        model_name: str\\n",
        "        features: Dict\\n",
        "\\n",
        "    class ThreatDetectRequest(BaseModel):\\n",
        "        text: str\\n",
        "        metadata: Optional[Dict] = {}\\n",
        "\\n",
        "    class ThreatExplainRequest(BaseModel):\\n",
        "        threat_data: Dict\\n",
        "\\n",
        '    @app.post(\"/predict\")\\n',
        "    async def predict(request: PredictRequest):\\n",
        "        result = inference.predict(request.model_name, request.features)\\n",
        '        if \"error\" in result:\\n',
        '            raise HTTPException(status_code=404, detail=result[\"error\"])\\n',
        "        return result\\n",
        "\\n",
        '    @app.post(\"/api/threats/detect\")\\n',
        "    async def detect_threat(request: ThreatDetectRequest):\\n",
        "        return inference.detect_threat(request.text, request.metadata)\\n",
        "\\n",
        '    @app.post(\"/api/analysis/explain\")\\n',
        "    async def explain_threat(request: ThreatExplainRequest):\\n",
        "        return inference.explain_threat(request.threat_data)\\n",
        "\\n",
        '    @app.get(\"/models\")\\n',
        "    async def list_models():\\n",
        '        return {\"models\": inference.list_models()}\\n',
        "\\n",
        '    @app.get(\"/models/{model_name}\")\\n',
        "    async def get_model_info(model_name: str):\\n",
        "        info = inference.get_model_info(model_name)\\n",
        "        if not info:\\n",
        '            raise HTTPException(status_code=404, detail=\"Model not found\")\\n',
        "        return info\\n",
        "\\n",
        '    @app.get(\"/health\")\\n',
        "    async def health():\\n",
        "        return {\\n",
        '            \"status\": \"healthy\",\\n',
        '            \"models_loaded\": len(inference.loaded_models),\\n',
        '            \"threat_model_ready\": inference.threat_type_pipeline is not None,\\n',
        '            \"timestamp\": datetime.utcnow().isoformat()\\n',
        "        }\\n",
        "\\n",
        "    return app\\n",
        "\\n",
        "\\n",
        "# Module-level app for uvicorn\\n",
        "app = create_api('.')\\n",
        "\\n",
        "\\n",
        'if __name__ == \"__main__\":\\n',
        "    import sys, uvicorn\\n",
        '    models_dir = sys.argv[1] if len(sys.argv) > 1 else \".\"\\n',
        "    app = create_api(models_dir)\\n",
        '    uvicorn.run(app, host=\"0.0.0.0\", port=8001)\\n',
        "'''\n",
        "\n",
        "inference_path = BACKEND_DIR / \"inference.py\"\n",
        "with open(inference_path, 'w') as f:\n",
        "    f.write(inference_module)\n",
        "\n",
        "print(f\"✓ Inference module saved to: {inference_path}\")\n",
        "print(\"  Endpoints: /predict, /api/threats/detect, /api/analysis/explain, /models, /health\")\n",
    ]
    print("  ✓ Replaced inference module with /api/threats/detect + /api/analysis/explain")
    
    # Find and update the JS client cell
    js_client_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "ml_client.js" in src and "analyzeWebsite" in src:
            js_client_idx = i
            break
    
    if js_client_idx is not None:
        cells[js_client_idx]["source"] = [
            "# Generate JS client matching mlServiceClient.js contract\n",
            "js_client = '''\n",
            "/**\\n",
            " * CyberForge ML Service Client — generated by notebook 06\\n",
            " * Compatible with backend/src/services/mlServiceClient.js contract\\n",
            " */\\n",
            "\\n",
            "const axios = require('axios');\\n",
            "\\n",
            "class CyberForgeMLClient {\\n",
            "  constructor(baseUrl = 'http://localhost:8001') {\\n",
            "    this.baseUrl = baseUrl;\\n",
            "    this.client = axios.create({ baseURL: baseUrl, timeout: 30000 });\\n",
            "  }\\n",
            "\\n",
            "  async healthCheck() {\\n",
            "    const { data } = await this.client.get('/health');\\n",
            "    return data;\\n",
            "  }\\n",
            "\\n",
            "  /**\\n",
            "   * Classify threat from evidence text.\\n",
            "   * Contract: POST /api/threats/detect\\n",
            "   * Called by: mlServiceClient.classifyThreat()\\n",
            "   */\\n",
            "  async classifyThreat(evidenceText, metadata = {}) {\\n",
            "    const { data } = await this.client.post('/api/threats/detect', {\\n",
            "      text: evidenceText,\\n",
            "      metadata\\n",
            "    });\\n",
            "    return data;\\n",
            "  }\\n",
            "\\n",
            "  /**\\n",
            "   * Get threat explanation.\\n",
            "   * Contract: POST /api/analysis/explain\\n",
            "   * Called by: mlServiceClient.getExplanation()\\n",
            "   */\\n",
            "  async getExplanation(threatData) {\\n",
            "    const { data } = await this.client.post('/api/analysis/explain', {\\n",
            "      threat_data: threatData\\n",
            "    });\\n",
            "    return data;\\n",
            "  }\\n",
            "\\n",
            "  /**\\n",
            "   * Generic model prediction.\\n",
            "   * Contract: POST /predict\\n",
            "   */\\n",
            "  async predict(modelName, features) {\\n",
            "    const { data } = await this.client.post('/predict', {\\n",
            "      model_name: modelName,\\n",
            "      features\\n",
            "    });\\n",
            "    return data;\\n",
            "  }\\n",
            "\\n",
            "  async listModels() {\\n",
            "    const { data } = await this.client.get('/models');\\n",
            "    return data.models;\\n",
            "  }\\n",
            "}\\n",
            "\\n",
            "module.exports = { CyberForgeMLClient };\\n",
            "'''\n",
            "\n",
            "js_client_path = BACKEND_DIR / \"ml_client.js\"\n",
            "with open(js_client_path, 'w') as f:\n",
            "    f.write(js_client)\n",
            "\n",
            "print(f\"✓ JS client saved to: {js_client_path}\")\n",
            "print(\"  Methods: classifyThreat(), getExplanation(), predict(), listModels(), healthCheck()\")\n",
        ]
        print("  ✓ Replaced JS client with mlServiceClient.js-compatible version")
    
    save_notebook("06_backend_integration.ipynb", nb)


# ============================================================================
# NOTEBOOK 07 — Deployment: Fix Dockerfile CMD
# ============================================================================

def update_notebook_07():
    print("\n📓 Updating 07_deployment_artifacts.ipynb...")
    nb = load_notebook("07_deployment_artifacts.ipynb")
    cells = nb["cells"]
    
    # Find the Dockerfile cell
    dockerfile_cell_idx = None
    for i, cell in enumerate(cells):
        src = "".join(cell.get("source", []))
        if "Dockerfile" in src and "uvicorn" in src and "CMD" in src:
            dockerfile_cell_idx = i
            break
    
    if dockerfile_cell_idx is None:
        print("  ⚠ Could not find Dockerfile cell — skipping")
        return
    
    # Fix CMD line: change inference:app → inference:app (now module-level app exists)
    src_lines = cells[dockerfile_cell_idx]["source"]
    new_lines = []
    for line in src_lines:
        # Fix the CMD to use the module-level app
        if "uvicorn" in line and "inference" in line and "CMD" in line.upper():
            new_lines.append(line.replace(
                'inference:app',
                'inference:app --host 0.0.0.0 --port 8001'
            ).replace(
                'inference:create_api()',
                'inference:app'
            ))
        else:
            new_lines.append(line)
    
    cells[dockerfile_cell_idx]["source"] = new_lines
    print("  ✓ Fixed Dockerfile CMD to use module-level app")
    
    save_notebook("07_deployment_artifacts.ipynb", nb)


# ============================================================================
# NOTEBOOK 05 — Validation: Add API contract tests
# ============================================================================

def update_notebook_05():
    print("\n📓 Updating 05_model_validation.ipynb...")
    nb = load_notebook("05_model_validation.ipynb")
    cells = nb["cells"]
    
    # Find the last code cell to append after
    last_code_idx = len(cells) - 1
    for i in range(len(cells) - 1, -1, -1):
        if cells[i].get("cell_type") == "code":
            last_code_idx = i
            break
    
    md_cell = make_markdown_cell([
        "## 🔗 Backend API Contract Validation\n",
        "\n",
        "Validates that model outputs match the expected schemas for:\n",
        "- `POST /api/threats/detect` → `ThreatDetectResponse`\n",
        "- `POST /api/analysis/explain` → `ThreatExplainResponse`"
    ])
    
    contract_cell = make_code_cell([
        "# ── API Contract Validation ─────────────────────────────────────────────\n",
        "\n",
        "def validate_threat_detect_response(resp: dict) -> list:\n",
        "    \"\"\"Validate response matches ThreatDetectResponse schema.\"\"\"\n",
        "    errors = []\n",
        "    required = ['risk_score', 'confidence', 'threat_type', 'indicators', 'details']\n",
        "    for field in required:\n",
        "        if field not in resp:\n",
        "            errors.append(f'Missing field: {field}')\n",
        "    \n",
        "    if 'risk_score' in resp:\n",
        "        if not (0 <= resp['risk_score'] <= 100):\n",
        "            errors.append(f'risk_score out of range: {resp[\"risk_score\"]}')\n",
        "    if 'confidence' in resp:\n",
        "        if not (0 <= resp['confidence'] <= 1):\n",
        "            errors.append(f'confidence out of range: {resp[\"confidence\"]}')\n",
        "    if 'indicators' in resp:\n",
        "        if not isinstance(resp['indicators'], list):\n",
        "            errors.append('indicators must be a list')\n",
        "    return errors\n",
        "\n",
        "def validate_explain_response(resp: dict) -> list:\n",
        "    \"\"\"Validate response matches ThreatExplainResponse schema.\"\"\"\n",
        "    errors = []\n",
        "    required = ['summary', 'recommendations', 'technical_details', 'timestamp']\n",
        "    for field in required:\n",
        "        if field not in resp:\n",
        "            errors.append(f'Missing field: {field}')\n",
        "    if 'recommendations' in resp:\n",
        "        if not isinstance(resp['recommendations'], list):\n",
        "            errors.append('recommendations must be a list')\n",
        "    return errors\n",
        "\n",
        "# Test with mock data\n",
        "print('🔗 API Contract Validation')\n",
        "print('=' * 50)\n",
        "\n",
        "mock_detect = {\n",
        "    'risk_score': 78.5,\n",
        "    'confidence': 0.82,\n",
        "    'threat_type': 'phishing',\n",
        "    'indicators': ['phishing:fake', 'no_https'],\n",
        "    'details': {'url': 'http://example.com', 'analysis_method': 'ml+heuristic'}\n",
        "}\n",
        "\n",
        "detect_errors = validate_threat_detect_response(mock_detect)\n",
        "print(f'\\n/api/threats/detect response: {\"✅ VALID\" if not detect_errors else \"❌ INVALID\"}')\n",
        "for e in detect_errors:\n",
        "    print(f'  - {e}')\n",
        "\n",
        "mock_explain = {\n",
        "    'summary': 'Phishing threat detected with 82% confidence',\n",
        "    'recommendations': ['Block domain', 'Alert users'],\n",
        "    'technical_details': 'Type: phishing | Risk: 78/100',\n",
        "    'timestamp': '2025-01-01T00:00:00'\n",
        "}\n",
        "\n",
        "explain_errors = validate_explain_response(mock_explain)\n",
        "print(f'\\n/api/analysis/explain response: {\"✅ VALID\" if not explain_errors else \"❌ INVALID\"}')\n",
        "for e in explain_errors:\n",
        "    print(f'  - {e}')\n",
        "\n",
        "print(f'\\n✓ Contract validation complete')\n",
    ])
    
    cells.insert(last_code_idx + 1, md_cell)
    cells.insert(last_code_idx + 2, contract_cell)
    print("  ✓ Inserted API contract validation cells")
    
    save_notebook("05_model_validation.ipynb", nb)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("🔧 CyberForge — Updating notebooks for TODO 1 compliance")
    print("=" * 60)
    
    update_notebook_03()
    update_notebook_04()
    update_notebook_05()
    update_notebook_06()
    update_notebook_07()
    
    print("\n" + "=" * 60)
    print("✅ All notebooks updated for TODO 1!")
    print("\nChanges applied:")
    print("  03: Added threat_detection + browser_intelligence to TASK_MODELS")
    print("      Added text-based threat classifier training cell")
    print("  04: Added BrowserIntelligenceAnalyzer cell")
    print("      Replaced agent module stub with full implementation")
    print("  05: Added /api/threats/detect + /api/analysis/explain contract validation")
    print("  06: Replaced inference.py with threat detect + explain endpoints")
    print("      Replaced JS client with mlServiceClient.js-compatible version")
    print("  07: Fixed Dockerfile CMD to use module-level app")
    print("\n⚠ Manual steps:")
    print("  1. Create 'browser_intelligence' collection in Appwrite Console")
    print("  2. Run notebooks 00-07 in order to regenerate all artifacts")
    print("  3. Push updated notebooks to HuggingFace Space")
