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
    
    # AI/ML Configuration
    HUGGINGFACE_API_TOKEN: Optional[str] = None
    TRANSFORMERS_CACHE_DIR: str = "./models/cache"
    
    # Free AI model configuration
    DEFAULT_TEXT_MODEL: str = "microsoft/DialoGPT-medium"
    THREAT_DETECTION_MODEL: str = "distilbert-base-uncased"
    SENTIMENT_MODEL: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    
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

settings = Settings()