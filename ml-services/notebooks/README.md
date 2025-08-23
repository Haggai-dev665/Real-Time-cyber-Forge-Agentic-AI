# ML Notebooks Execution Guide

This directory contains machine learning notebooks for the Cyber Forge AI platform. Follow this guide to run the notebooks in the correct order for optimal results.

## 📋 Prerequisites

Before running any notebooks, ensure you have:

1. **Python Environment**: Python 3.9+ installed
2. **Dependencies**: Install all required packages:
   ```bash
   cd ../
   pip install -r requirements.txt
   ```
3. **Jupyter**: Install Jupyter Notebook or JupyterLab:
   ```bash
   pip install jupyter jupyterlab
   ```

## 🎯 Execution Order

Run the notebooks in this specific order to ensure proper model training and dependencies:

### 1. **Basic AI Agent Training** 📚
**File**: `ai_agent_training.py`
**Purpose**: Initial AI agent setup and basic training
**Runtime**: ~10-15 minutes
**Description**: 
- Sets up the foundational AI agent
- Installs core dependencies programmatically
- Provides basic communication and cybersecurity skills
- **RUN THIS FIRST** - Required for other notebooks

```bash
cd ml-services/notebooks
python ai_agent_training.py
```

### 2. **Advanced Cybersecurity ML Training** 🛡️
**File**: `advanced_cybersecurity_ml_training.ipynb`
**Purpose**: Comprehensive ML model training for threat detection
**Runtime**: ~30-45 minutes
**Description**:
- Data preparation and feature engineering
- Multiple ML model training (Random Forest, XGBoost, Neural Networks)
- Model evaluation and comparison
- Production model deployment preparation

```bash
jupyter notebook advanced_cybersecurity_ml_training.ipynb
```

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