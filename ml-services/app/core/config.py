"""
Configuration settings for ML/AI Services
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Server configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    DEBUG: bool = False
    
    # CORS settings
    ALLOWED_HOSTS: List[str] = ["*"]
    
    # AI/ML Configuration - reasoning LLM (DeepSeek via HF Inference Providers).
    # Gemini has been retired; the GEMINI_* fields below are kept only as harmless
    # backward-compat aliases for any code/env that still references them.
    HF_TOKEN: Optional[str] = None
    REASONING_LLM_MODEL: str = "deepseek-ai/DeepSeek-V3-0324"
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 2048
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "deepseek-ai/DeepSeek-V3-0324"
    GEMINI_TEMPERATURE: float = 0.3
    GEMINI_MAX_TOKENS: int = 2048
    
    # Custom training data configuration
    TRAINING_DATA_PATH: str = "./training_data"
    CUSTOM_KNOWLEDGE_BASE: str = "./knowledge_base"
    
    # Deprecated Hugging Face settings (kept for backward compatibility)
    HUGGINGFACE_API_TOKEN: Optional[str] = None
    TRANSFORMERS_CACHE_DIR: str = "./models/cache"
    
    # Database configuration
    DATABASE_URL: str = "sqlite:///./cyber_forge.db"
    REDIS_URL: str = "redis://localhost:6379"
    
    # Memory and storage
    MEMORY_STORE_SIZE: int = 1000
    ANALYSIS_CACHE_TTL: int = 3600
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env file

settings = Settings()