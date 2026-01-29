"""
Agent Memory - Short-term session memory and long-term knowledge storage
Production-ready memory system with vector search capabilities.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
import json
import hashlib

logger = logging.getLogger(__name__)


class MemoryType(Enum):
    """Types of memory storage"""
    SHORT_TERM = "short_term"      # Session-based, volatile
    LONG_TERM = "long_term"        # Persistent, searchable
    EPISODIC = "episodic"          # Event/action history
    SEMANTIC = "semantic"          # Knowledge/facts
    WORKING = "working"            # Current context


@dataclass
class MemoryEntry:
    """Represents a single memory entry"""
    id: str
    memory_type: MemoryType
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    accessed_at: datetime = field(default_factory=datetime.utcnow)
    access_count: int = 0
    importance: float = 0.5
    ttl_seconds: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'memory_type': self.memory_type.value,
            'content': self.content,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat(),
            'accessed_at': self.accessed_at.isoformat(),
            'access_count': self.access_count,
            'importance': self.importance,
        }


class AgentMemory:
    """
    Production-Ready Agent Memory System
    
    Features:
    - Short-term session memory
    - Long-term persistent storage
    - Vector similarity search
    - Memory consolidation
    - Automatic cleanup
    """
    
    def __init__(self, chroma_path: str = "./data/agent_memory"):
        self.chroma_path = chroma_path
        self.chroma_client = None
        self.collections: Dict[str, Any] = {}
        
        # In-memory short-term storage
        self.short_term: Dict[str, MemoryEntry] = {}
        self.working_memory: Dict[str, Any] = {}
        
        # Configuration
        self.max_short_term_entries = 1000
        self.short_term_ttl = 3600  # 1 hour
        self.consolidation_threshold = 0.8
        
        self._is_initialized = False
        self._cleanup_task: Optional[asyncio.Task] = None
        
        logger.info("🧠 Agent Memory initialized")
    
    async def initialize(self):
        """Initialize memory storage"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Initialize ChromaDB for vector storage
            self.chroma_client = chromadb.PersistentClient(
                path=self.chroma_path,
                settings=Settings(anonymized_telemetry=False)
            )
            
            # Create collections for different memory types
            self.collections['long_term'] = self.chroma_client.get_or_create_collection(
                name="agent_long_term_memory",
                metadata={"description": "Long-term persistent memory"}
            )
            
            self.collections['episodic'] = self.chroma_client.get_or_create_collection(
                name="agent_episodic_memory",
                metadata={"description": "Action and event history"}
            )
            
            self.collections['semantic'] = self.chroma_client.get_or_create_collection(
                name="agent_semantic_memory",
                metadata={"description": "Knowledge and facts"}
            )
            
            # Start cleanup task
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            
            self._is_initialized = True
            logger.info("✅ Agent Memory storage initialized")
            
        except ImportError:
            logger.warning("⚠️ ChromaDB not installed, using in-memory only")
            self._is_initialized = True
        except Exception as e:
            logger.error(f"❌ Failed to initialize memory: {e}")
            self._is_initialized = True  # Continue with in-memory only
    
    def is_ready(self) -> bool:
        """Check if memory is ready"""
        return self._is_initialized
    
    async def cleanup(self):
        """Cleanup memory resources"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        logger.info("🧹 Agent Memory cleaned up")
    
    async def _cleanup_loop(self):
        """Periodic cleanup of expired memories"""
        while True:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                await self._cleanup_expired()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Memory cleanup error: {e}")
    
    async def _cleanup_expired(self):
        """Remove expired short-term memories"""
        now = datetime.utcnow()
        expired = []
        
        for entry_id, entry in self.short_term.items():
            if entry.ttl_seconds:
                age = (now - entry.created_at).total_seconds()
                if age > entry.ttl_seconds:
                    expired.append(entry_id)
            elif (now - entry.accessed_at).total_seconds() > self.short_term_ttl:
                expired.append(entry_id)
        
        for entry_id in expired:
            del self.short_term[entry_id]
        
        if expired:
            logger.info(f"🧹 Cleaned up {len(expired)} expired memories")
    
    def _generate_id(self, content: str) -> str:
        """Generate a unique ID for content"""
        hash_input = f"{content}{datetime.utcnow().isoformat()}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]
    
    # =========================================
    # STORE OPERATIONS
    # =========================================
    
    async def store(
        self,
        content: str,
        memory_type: MemoryType = MemoryType.SHORT_TERM,
        metadata: Optional[Dict[str, Any]] = None,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
    ) -> str:
        """Store a memory entry"""
        
        entry_id = self._generate_id(content)
        
        entry = MemoryEntry(
            id=entry_id,
            memory_type=memory_type,
            content=content,
            metadata=metadata or {},
            importance=importance,
            ttl_seconds=ttl_seconds,
        )
        
        if memory_type == MemoryType.SHORT_TERM:
            # Check capacity
            if len(self.short_term) >= self.max_short_term_entries:
                await self._evict_short_term()
            
            self.short_term[entry_id] = entry
            
        elif memory_type == MemoryType.WORKING:
            self.working_memory[entry_id] = entry
            
        else:
            # Store in vector database
            await self._store_vector(entry, memory_type)
        
        logger.debug(f"📝 Stored memory: {entry_id} ({memory_type.value})")
        return entry_id
    
    async def _store_vector(self, entry: MemoryEntry, memory_type: MemoryType):
        """Store entry in vector database"""
        if not self.chroma_client:
            # Fallback to short-term
            self.short_term[entry.id] = entry
            return
        
        collection_name = memory_type.value
        if collection_name not in self.collections:
            collection_name = 'long_term'
        
        collection = self.collections.get(collection_name)
        if collection:
            try:
                collection.add(
                    documents=[entry.content],
                    metadatas=[{
                        **entry.metadata,
                        'importance': entry.importance,
                        'created_at': entry.created_at.isoformat(),
                    }],
                    ids=[entry.id]
                )
            except Exception as e:
                logger.error(f"Failed to store in vector DB: {e}")
                self.short_term[entry.id] = entry
    
    async def _evict_short_term(self):
        """Evict least important/oldest entries from short-term memory"""
        if not self.short_term:
            return
        
        # Sort by importance and access time
        sorted_entries = sorted(
            self.short_term.items(),
            key=lambda x: (x[1].importance, x[1].accessed_at)
        )
        
        # Remove bottom 10%
        num_to_remove = max(1, len(sorted_entries) // 10)
        for entry_id, entry in sorted_entries[:num_to_remove]:
            # Consolidate to long-term if important enough
            if entry.importance >= self.consolidation_threshold:
                await self._consolidate_to_long_term(entry)
            del self.short_term[entry_id]
        
        logger.info(f"🔄 Evicted {num_to_remove} short-term memories")
    
    async def _consolidate_to_long_term(self, entry: MemoryEntry):
        """Consolidate important short-term memory to long-term"""
        entry.memory_type = MemoryType.LONG_TERM
        await self._store_vector(entry, MemoryType.LONG_TERM)
        logger.debug(f"📦 Consolidated memory to long-term: {entry.id}")
    
    # =========================================
    # RETRIEVE OPERATIONS
    # =========================================
    
    async def retrieve(self, entry_id: str) -> Optional[MemoryEntry]:
        """Retrieve a specific memory entry"""
        
        # Check short-term
        if entry_id in self.short_term:
            entry = self.short_term[entry_id]
            entry.accessed_at = datetime.utcnow()
            entry.access_count += 1
            return entry
        
        # Check working memory
        if entry_id in self.working_memory:
            return self.working_memory[entry_id]
        
        # Search vector stores
        if self.chroma_client:
            for collection in self.collections.values():
                try:
                    result = collection.get(ids=[entry_id])
                    if result['documents']:
                        return MemoryEntry(
                            id=entry_id,
                            memory_type=MemoryType.LONG_TERM,
                            content=result['documents'][0],
                            metadata=result['metadatas'][0] if result['metadatas'] else {},
                        )
                except:
                    pass
        
        return None
    
    async def search(
        self,
        query: str,
        memory_types: Optional[List[MemoryType]] = None,
        limit: int = 10,
        min_relevance: float = 0.0,
    ) -> List[MemoryEntry]:
        """Search memories by semantic similarity"""
        
        results = []
        
        # Search short-term (simple text matching for now)
        for entry in self.short_term.values():
            if memory_types and entry.memory_type not in memory_types:
                continue
            if query.lower() in entry.content.lower():
                entry.accessed_at = datetime.utcnow()
                entry.access_count += 1
                results.append(entry)
        
        # Search vector stores
        if self.chroma_client:
            search_collections = []
            if memory_types:
                for mt in memory_types:
                    if mt.value in self.collections:
                        search_collections.append(self.collections[mt.value])
            else:
                search_collections = list(self.collections.values())
            
            for collection in search_collections:
                try:
                    search_results = collection.query(
                        query_texts=[query],
                        n_results=limit
                    )
                    
                    if search_results['documents'] and search_results['documents'][0]:
                        for i, doc in enumerate(search_results['documents'][0]):
                            distance = search_results['distances'][0][i] if search_results['distances'] else 0
                            relevance = 1.0 - min(distance, 1.0)
                            
                            if relevance >= min_relevance:
                                results.append(MemoryEntry(
                                    id=search_results['ids'][0][i],
                                    memory_type=MemoryType.LONG_TERM,
                                    content=doc,
                                    metadata={
                                        **(search_results['metadatas'][0][i] if search_results['metadatas'] else {}),
                                        'relevance': relevance,
                                    },
                                ))
                except Exception as e:
                    logger.error(f"Vector search error: {e}")
        
        # Sort by relevance/importance and limit
        results.sort(key=lambda x: x.metadata.get('relevance', x.importance), reverse=True)
        return results[:limit]
    
    async def get_recent(
        self,
        memory_type: Optional[MemoryType] = None,
        limit: int = 20,
    ) -> List[MemoryEntry]:
        """Get recent memories"""
        
        results = []
        
        # Get from short-term
        for entry in self.short_term.values():
            if memory_type and entry.memory_type != memory_type:
                continue
            results.append(entry)
        
        # Sort by creation time
        results.sort(key=lambda x: x.created_at, reverse=True)
        return results[:limit]
    
    # =========================================
    # WORKING MEMORY
    # =========================================
    
    def set_working(self, key: str, value: Any):
        """Set a working memory value"""
        self.working_memory[key] = value
    
    def get_working(self, key: str, default: Any = None) -> Any:
        """Get a working memory value"""
        return self.working_memory.get(key, default)
    
    def clear_working(self):
        """Clear all working memory"""
        self.working_memory.clear()
    
    # =========================================
    # CONTEXT MANAGEMENT
    # =========================================
    
    async def get_context(
        self,
        query: str,
        include_recent: bool = True,
        include_relevant: bool = True,
        max_tokens: int = 2000,
    ) -> str:
        """Get relevant context for a query"""
        
        context_parts = []
        
        if include_recent:
            recent = await self.get_recent(limit=5)
            if recent:
                context_parts.append("Recent memories:")
                for entry in recent:
                    context_parts.append(f"- {entry.content[:200]}")
        
        if include_relevant:
            relevant = await self.search(query, limit=5)
            if relevant:
                context_parts.append("\nRelevant knowledge:")
                for entry in relevant:
                    context_parts.append(f"- {entry.content[:200]}")
        
        context = "\n".join(context_parts)
        
        # Truncate if needed
        if len(context) > max_tokens * 4:  # Rough char to token estimate
            context = context[:max_tokens * 4] + "..."
        
        return context
    
    async def store_conversation(
        self,
        role: str,
        content: str,
        conversation_id: Optional[str] = None,
    ) -> str:
        """Store a conversation turn"""
        return await self.store(
            content=content,
            memory_type=MemoryType.EPISODIC,
            metadata={
                'role': role,
                'conversation_id': conversation_id or 'default',
                'timestamp': datetime.utcnow().isoformat(),
            },
            importance=0.6,
        )
    
    async def store_knowledge(
        self,
        fact: str,
        source: Optional[str] = None,
        confidence: float = 0.8,
    ) -> str:
        """Store a knowledge fact"""
        return await self.store(
            content=fact,
            memory_type=MemoryType.SEMANTIC,
            metadata={
                'source': source or 'learned',
                'confidence': confidence,
            },
            importance=confidence,
        )
    
    async def store_action(
        self,
        action: str,
        result: Any,
        success: bool = True,
    ) -> str:
        """Store an action and its result"""
        return await self.store(
            content=f"Action: {action}\nResult: {result}\nSuccess: {success}",
            memory_type=MemoryType.EPISODIC,
            metadata={
                'action': action,
                'success': success,
            },
            importance=0.7 if success else 0.8,  # Failures are more important to remember
        )
    
    # =========================================
    # STATUS
    # =========================================
    
    def get_status(self) -> Dict[str, Any]:
        """Get memory status"""
        return {
            'is_initialized': self._is_initialized,
            'short_term_count': len(self.short_term),
            'working_memory_count': len(self.working_memory),
            'vector_collections': list(self.collections.keys()) if self.chroma_client else [],
            'max_short_term': self.max_short_term_entries,
        }
