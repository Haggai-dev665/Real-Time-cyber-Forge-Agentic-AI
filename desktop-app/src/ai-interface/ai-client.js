const axios = require('axios');

class AIInterface {
  constructor() {
    this.apiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    this.isConnected = false;
    this.conversationHistory = [];
    this.checkConnection();
  }

  async checkConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`);
      this.isConnected = response.status === 200;
      console.log('AI service connection:', this.isConnected ? 'OK' : 'Failed');
    } catch (error) {
      this.isConnected = false;
      console.log('AI service unavailable:', error.message);
    }
  }

  async queryAI(query, context = {}) {
    if (!this.isConnected) {
      await this.checkConnection();
      if (!this.isConnected) {
        return 'AI service is currently unavailable. Please check the connection.';
      }
    }

    try {
      const payload = {
        query: query,
        context: context,
        conversation_history: this.conversationHistory.slice(-10), // Keep last 10 exchanges
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(`${this.apiUrl}/analyze`, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      
      // Store conversation for context
      this.conversationHistory.push({
        query: query,
        response: result.response,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error('AI query error:', error);
      this.isConnected = false;
      return {
        response: 'Failed to get AI analysis. Please try again.',
        error: error.message
      };
    }
  }

  async analyzeBrowsingPattern(pages) {
    const context = {
      type: 'browsing_analysis',
      pages: pages.slice(-50), // Analyze last 50 pages
      total_pages: pages.length
    };

    return this.queryAI(
      'Analyze this browsing pattern for security risks and provide insights.',
      context
    );
  }

  async evaluateThreat(threatData) {
    const context = {
      type: 'threat_evaluation',
      threat_data: threatData
    };

    return this.queryAI(
      'Evaluate this potential security threat and provide recommendations.',
      context
    );
  }

  async getSecurityRecommendations(analysisData) {
    const context = {
      type: 'security_recommendations',
      analysis: analysisData
    };

    return this.queryAI(
      'Based on the analysis data, provide security recommendations for the user.',
      context
    );
  }

  async summarizeDailyActivity(activityData) {
    const context = {
      type: 'daily_summary',
      activity: activityData,
      date: new Date().toDateString()
    };

    return this.queryAI(
      'Provide a summary of today\'s browsing activity and security status.',
      context
    );
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  clearConversationHistory() {
    this.conversationHistory = [];
  }
}

function setupAIInterface() {
  return new AIInterface();
}

module.exports = { setupAIInterface, AIInterface };