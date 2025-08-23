"""
Memory Store for AI agent using ChromaDB (free vector database)
"""
import logging
import asyncio
from typing import Dict, List, Any, Optional
import chromadb
import numpy as np
from datetime import datetime

from ..core.config import settings

logger = logging.getLogger(__name__)

class MemoryStore:
    """Memory store for AI agent using free ChromaDB"""
    
    def __init__(self):
        self.client = None
        self.collection = None
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize ChromaDB client and collection"""
        try:
            # Use persistent client for local storage
            self.client = chromadb.PersistentClient(path="./data/chroma_db")
            
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name="cyber_forge_memory",
                metadata={"description": "AI agent memory storage"}
            )
            
            self.is_initialized = True
            logger.info("✅ Memory store initialized with ChromaDB")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize memory store: {e}")
            self.is_initialized = False
            raise
    
    def is_ready(self) -> bool:
        """Check if memory store is ready"""
        return self.is_initialized
    
    async def store_analysis(self, analysis_data: Dict[str, Any], result: Any):
        """Store analysis in memory"""
        try:
            if not self.is_ready():
                return False
            
            # Create a unique ID
            doc_id = f"analysis_{datetime.utcnow().timestamp()}"
            
            # Prepare document text
            document_text = f"Query: {analysis_data.get('query', '')}"
            if result and hasattr(result, 'response'):
                document_text += f" Response: {result.response}"
            
            # Store in ChromaDB
            self.collection.add(
                documents=[document_text],
                metadatas=[{
                    "type": "analysis",
                    "timestamp": datetime.utcnow().isoformat(),
                    "context": str(analysis_data.get('context', {}))
                }],
                ids=[doc_id]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to store analysis: {e}")
            return False
    
    async def query_similar(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Query for similar analyses"""
        try:
            if not self.is_ready():
                return []
            
            # Query ChromaDB
            results = self.collection.query(
                query_texts=[query],
                n_results=limit
            )
            
            # Format results
            similar_analyses = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    similar_analyses.append({
                        'summary': doc[:200] + "..." if len(doc) > 200 else doc,
                        'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                        'distance': results['distances'][0][i] if results['distances'] else 0
                    })
            
            return similar_analyses
            
        except Exception as e:
            logger.error(f"Failed to query similar analyses: {e}")
            return []
    
    async def cleanup(self):
        """Cleanup memory store"""
        try:
            if self.client:
                # ChromaDB doesn't need explicit cleanup
                pass
            logger.info("Memory store cleaned up")
        except Exception as e:
            logger.error(f"Memory store cleanup error: {e}")