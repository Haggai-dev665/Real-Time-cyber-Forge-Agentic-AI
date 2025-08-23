/**
 * Vector Database Service
 * Handles vector operations for AI/ML features using Pinecone and ChromaDB
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const { ChromaClient } = require('chromadb');

class VectorDatabaseService {
  constructor() {
    this.pinecone = null;
    this.chroma = null;
    this.pineconeIndex = null;
    this.isInitialized = false;
  }

  /**
   * Initialize vector databases
   */
  async initialize() {
    try {
      // Initialize Pinecone if API key is provided
      if (process.env.PINECONE_API_KEY) {
        this.pinecone = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY,
          environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp'
        });

        // Get or create index
        const indexName = process.env.PINECONE_INDEX_NAME || 'cyber-forge-threats';
        try {
          this.pineconeIndex = this.pinecone.Index(indexName);
          console.log('✅ Pinecone initialized successfully');
        } catch (error) {
          console.warn('⚠️ Pinecone index not found, vector search will be limited');
        }
      }

      // Initialize ChromaDB
      try {
        this.chroma = new ChromaClient({
          path: process.env.CHROMA_URL || 'http://localhost:8000'
        });
        console.log('✅ ChromaDB initialized successfully');
      } catch (error) {
        console.warn('⚠️ ChromaDB not available, using local vector storage');
      }

      this.isInitialized = true;
      console.log('✅ Vector Database Service initialized');

    } catch (error) {
      console.error('❌ Vector Database Service initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Store threat vector embeddings
   */
  async storeThreatVector(threatId, embedding, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    const results = {};

    try {
      // Store in Pinecone if available
      if (this.pineconeIndex) {
        await this.pineconeIndex.upsert([{
          id: threatId,
          values: embedding,
          metadata: {
            ...metadata,
            type: 'threat',
            timestamp: new Date().toISOString()
          }
        }]);
        results.pinecone = true;
      }

      // Store in ChromaDB if available
      if (this.chroma) {
        const collection = await this.getOrCreateCollection('threats');
        await collection.add({
          ids: [threatId],
          embeddings: [embedding],
          metadatas: [{
            ...metadata,
            type: 'threat',
            timestamp: new Date().toISOString()
          }]
        });
        results.chroma = true;
      }

      return results;

    } catch (error) {
      console.error('Error storing threat vector:', error);
      throw error;
    }
  }

  /**
   * Search for similar threats using vector similarity
   */
  async searchSimilarThreats(queryEmbedding, topK = 10, filter = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    try {
      let results = [];

      // Search in Pinecone if available
      if (this.pineconeIndex) {
        const pineconeResults = await this.pineconeIndex.query({
          vector: queryEmbedding,
          topK,
          filter: {
            type: 'threat',
            ...filter
          },
          includeMetadata: true
        });

        results = pineconeResults.matches.map(match => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata,
          source: 'pinecone'
        }));
      }

      // Search in ChromaDB if available and no Pinecone results
      if (this.chroma && results.length === 0) {
        const collection = await this.getOrCreateCollection('threats');
        const chromaResults = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topK,
          where: filter
        });

        if (chromaResults.ids && chromaResults.ids[0]) {
          results = chromaResults.ids[0].map((id, index) => ({
            id,
            score: chromaResults.distances ? 1 - chromaResults.distances[0][index] : 0.5,
            metadata: chromaResults.metadatas ? chromaResults.metadatas[0][index] : {},
            source: 'chroma'
          }));
        }
      }

      return results.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Error searching similar threats:', error);
      throw error;
    }
  }

  /**
   * Store analysis embeddings
   */
  async storeAnalysisVector(analysisId, embedding, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    const results = {};

    try {
      // Store in Pinecone if available
      if (this.pineconeIndex) {
        await this.pineconeIndex.upsert([{
          id: `analysis_${analysisId}`,
          values: embedding,
          metadata: {
            ...metadata,
            type: 'analysis',
            timestamp: new Date().toISOString()
          }
        }]);
        results.pinecone = true;
      }

      // Store in ChromaDB if available
      if (this.chroma) {
        const collection = await this.getOrCreateCollection('analyses');
        await collection.add({
          ids: [`analysis_${analysisId}`],
          embeddings: [embedding],
          metadatas: [{
            ...metadata,
            type: 'analysis',
            timestamp: new Date().toISOString()
          }]
        });
        results.chroma = true;
      }

      return results;

    } catch (error) {
      console.error('Error storing analysis vector:', error);
      throw error;
    }
  }

  /**
   * Search for similar analyses
   */
  async searchSimilarAnalyses(queryEmbedding, topK = 10, filter = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    try {
      let results = [];

      // Search in Pinecone if available
      if (this.pineconeIndex) {
        const pineconeResults = await this.pineconeIndex.query({
          vector: queryEmbedding,
          topK,
          filter: {
            type: 'analysis',
            ...filter
          },
          includeMetadata: true
        });

        results = pineconeResults.matches.map(match => ({
          id: match.id.replace('analysis_', ''),
          score: match.score,
          metadata: match.metadata,
          source: 'pinecone'
        }));
      }

      // Search in ChromaDB if available and no Pinecone results
      if (this.chroma && results.length === 0) {
        const collection = await this.getOrCreateCollection('analyses');
        const chromaResults = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topK,
          where: filter
        });

        if (chromaResults.ids && chromaResults.ids[0]) {
          results = chromaResults.ids[0].map((id, index) => ({
            id: id.replace('analysis_', ''),
            score: chromaResults.distances ? 1 - chromaResults.distances[0][index] : 0.5,
            metadata: chromaResults.metadatas ? chromaResults.metadatas[0][index] : {},
            source: 'chroma'
          }));
        }
      }

      return results.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Error searching similar analyses:', error);
      throw error;
    }
  }

  /**
   * Store knowledge base vectors
   */
  async storeKnowledgeVector(docId, embedding, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    const results = {};

    try {
      // Store in Pinecone if available
      if (this.pineconeIndex) {
        await this.pineconeIndex.upsert([{
          id: `knowledge_${docId}`,
          values: embedding,
          metadata: {
            ...metadata,
            type: 'knowledge',
            timestamp: new Date().toISOString()
          }
        }]);
        results.pinecone = true;
      }

      // Store in ChromaDB if available
      if (this.chroma) {
        const collection = await this.getOrCreateCollection('knowledge');
        await collection.add({
          ids: [`knowledge_${docId}`],
          embeddings: [embedding],
          metadatas: [{
            ...metadata,
            type: 'knowledge',
            timestamp: new Date().toISOString()
          }]
        });
        results.chroma = true;
      }

      return results;

    } catch (error) {
      console.error('Error storing knowledge vector:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base
   */
  async searchKnowledge(queryEmbedding, topK = 5, filter = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    try {
      let results = [];

      // Search in Pinecone if available
      if (this.pineconeIndex) {
        const pineconeResults = await this.pineconeIndex.query({
          vector: queryEmbedding,
          topK,
          filter: {
            type: 'knowledge',
            ...filter
          },
          includeMetadata: true
        });

        results = pineconeResults.matches.map(match => ({
          id: match.id.replace('knowledge_', ''),
          score: match.score,
          metadata: match.metadata,
          source: 'pinecone'
        }));
      }

      // Search in ChromaDB if available and no Pinecone results
      if (this.chroma && results.length === 0) {
        const collection = await this.getOrCreateCollection('knowledge');
        const chromaResults = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topK,
          where: filter
        });

        if (chromaResults.ids && chromaResults.ids[0]) {
          results = chromaResults.ids[0].map((id, index) => ({
            id: id.replace('knowledge_', ''),
            score: chromaResults.distances ? 1 - chromaResults.distances[0][index] : 0.5,
            metadata: chromaResults.metadatas ? chromaResults.metadatas[0][index] : {},
            source: 'chroma'
          }));
        }
      }

      return results.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Error searching knowledge base:', error);
      throw error;
    }
  }

  /**
   * Get or create ChromaDB collection
   */
  async getOrCreateCollection(name) {
    try {
      return await this.chroma.getCollection({ name });
    } catch (error) {
      // Collection doesn't exist, create it
      return await this.chroma.createCollection({ name });
    }
  }

  /**
   * Delete vector by ID
   */
  async deleteVector(id, type = 'threat') {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    const results = {};

    try {
      const vectorId = type === 'threat' ? id : `${type}_${id}`;

      // Delete from Pinecone if available
      if (this.pineconeIndex) {
        await this.pineconeIndex.deleteOne(vectorId);
        results.pinecone = true;
      }

      // Delete from ChromaDB if available
      if (this.chroma) {
        const collectionName = type === 'threat' ? 'threats' : 
                              type === 'analysis' ? 'analyses' : 'knowledge';
        const collection = await this.getOrCreateCollection(collectionName);
        await collection.delete({ ids: [vectorId] });
        results.chroma = true;
      }

      return results;

    } catch (error) {
      console.error('Error deleting vector:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.isInitialized) {
      throw new Error('Vector database service not initialized');
    }

    const stats = {
      pinecone: null,
      chroma: null,
      isInitialized: this.isInitialized
    };

    try {
      // Get Pinecone stats
      if (this.pineconeIndex) {
        const indexStats = await this.pineconeIndex.describeIndexStats();
        stats.pinecone = {
          totalVectors: indexStats.totalVectorCount || 0,
          indexFullness: indexStats.indexFullness || 0,
          dimension: indexStats.dimension || 0
        };
      }

      // Get ChromaDB stats (if available)
      if (this.chroma) {
        try {
          const collections = await this.chroma.listCollections();
          stats.chroma = {
            collections: collections.length,
            collectionNames: collections.map(c => c.name)
          };
        } catch (error) {
          stats.chroma = { error: 'Unable to get ChromaDB stats' };
        }
      }

      return stats;

    } catch (error) {
      console.error('Error getting vector database stats:', error);
      return stats;
    }
  }
}

// Create singleton instance
const vectorDb = new VectorDatabaseService();

module.exports = vectorDb;