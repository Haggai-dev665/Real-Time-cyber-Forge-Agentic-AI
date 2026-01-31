# CyberForge ML Notebooks

Production-ready ML pipeline for CyberForge cybersecurity AI system.

## Notebook Structure

| # | Notebook | Purpose | Key Outputs |
|---|----------|---------|-------------|
| 00 | [environment_setup](00_environment_setup.ipynb) | Environment validation, dependencies | System readiness report |
| 01 | [data_acquisition](01_data_acquisition.ipynb) | Data collection from WebScraper API, HF | Normalized datasets |
| 02 | [feature_engineering](02_feature_engineering.ipynb) | URL, network, security feature extraction | Feature-engineered data |
| 03 | [model_training](03_model_training.ipynb) | Train detection models | Trained .pkl models |
| 04 | [agent_intelligence](04_agent_intelligence.ipynb) | Decision scoring, Gemini integration | Agent module |
| 05 | [model_validation](05_model_validation.ipynb) | Performance, edge case testing | Validation report |
| 06 | [backend_integration](06_backend_integration.ipynb) | API packaging, serialization | Backend package |
| 07 | [deployment_artifacts](07_deployment_artifacts.ipynb) | Docker, HF upload, documentation | Deployment package |

## Quick Start

1. **Configure environment:**
   ```bash
   cd ml-services
   # Ensure notebook_config.json has your API keys
   ```

2. **Run notebooks in order:**
   ```bash
   jupyter notebook notebooks/00_environment_setup.ipynb
   ```

3. **Or run all:**
   ```bash
   jupyter nbconvert --execute --to notebook notebooks/*.ipynb
   ```

## Configuration

All notebooks use `../notebook_config.json` for configuration:

```json
{
  "datasets_dir": "../datasets",
  "hf_repo": "Che237/cyberforge-models",
  "gemini_api_key": "",
  "webscraper_api_key": "your_key"
}
```

## Output Directories

After running all notebooks:

```
ml-services/
├── datasets/
│   ├── processed/       # Cleaned datasets
│   └── features/        # Feature-engineered data
├── models/              # Trained models
│   ├── phishing_detection/
│   ├── malware_detection/
│   └── model_registry.json
├── agent/               # Agent intelligence module
├── validation/          # Validation reports
├── backend_package/     # Backend integration files
└── deployment/          # Deployment artifacts
```

## Integration Points

### Backend (mlService.js)
- Use `backend_package/inference.py` or `backend_package/ml_client.js`
- Prediction endpoint: `POST /predict`

### Desktop App (caido-app.js)
- Agent module: `agent/cyberforge_agent.py`
- Real-time analysis via backend API

### Hugging Face
- Models: `huggingface.co/Che237/cyberforge-models`
- Datasets: `huggingface.co/datasets/Che237/cyberforge-datasets`
- Space: `huggingface.co/spaces/Che237/cyberforge`

## Requirements

- Python 3.11+
- scikit-learn >= 1.3.0
- pandas >= 2.0.0
- huggingface_hub >= 0.19.0
- google-generativeai >= 0.3.0

## License

MIT

### 3. **Network Security Analysis** 🌐
**File**: `network_security_analysis.ipynb`
**Purpose**: Network-specific security analysis and monitoring
**Runtime**: ~20-30 minutes
**Description**:
- Network traffic analysis
- Intrusion detection model training
- Port scanning detection
- Network anomaly detection

```bash
jupyter notebook network_security_analysis.ipynb
```

### 4. **Comprehensive AI Agent Training** 🤖
**File**: `ai_agent_comprehensive_training.ipynb`
**Purpose**: Advanced AI agent with full capabilities
**Runtime**: ~45-60 minutes
**Description**:
- Enhanced communication skills
- Web scraping and threat intelligence
- Real-time monitoring capabilities
- Natural language processing for security analysis
- **RUN LAST** - Integrates all previous models

```bash
jupyter notebook ai_agent_comprehensive_training.ipynb
```

## 📊 Expected Outputs

After running all notebooks, you should have:

1. **Trained Models**: Saved in `../models/` directory
2. **Performance Metrics**: Evaluation reports and visualizations
3. **AI Agent**: Fully trained agent ready for deployment
4. **Configuration Files**: Model configs for production use

## 🔧 Troubleshooting

### Common Issues:

**Memory Errors**: 
- Reduce batch size in deep learning models
- Close other applications to free RAM
- Consider using smaller datasets for testing

**Package Installation Failures**:
- Update pip: `pip install --upgrade pip`
- Use conda if pip fails: `conda install <package>`
- Check Python version compatibility

**CUDA/GPU Issues**:
- For TensorFlow GPU: Install CUDA 11.8+ and cuDNN
- For CPU-only: Models will run slower but still work
- Check GPU availability: `tensorflow.test.is_gpu_available()`

**Data Download Issues**:
- Ensure internet connection for Kaggle datasets
- Set up Kaggle API credentials if needed
- Some notebooks include fallback synthetic data generation

## 📝 Notes

- **First Run**: Initial execution takes longer due to package installation and data downloads
- **Subsequent Runs**: Much faster as dependencies are cached
- **Customization**: Modify hyperparameters in notebooks for different results
- **Production**: Use the saved models in the main application

## 🎯 Next Steps

After completing all notebooks:

1. **Deploy Models**: Copy trained models to production environment
2. **Integration**: Connect models with the desktop application
3. **Monitoring**: Set up model performance monitoring
4. **Updates**: Retrain models with new data periodically

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Review notebook outputs for specific error messages
4. Create an issue in the repository with error details

---

**Happy Training! 🚀**