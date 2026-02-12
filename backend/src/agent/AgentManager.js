/**
 * Agent Manager
 * Manages the lifecycle of Cyberforge agents
 */

const { CyberforgeAgent } = require('./CyberforgeAgent');
const logger = require('../utils/logger');

class AgentManager {
  constructor() {
    this.agents = new Map();
  }

  /**
   * Create and start a new agent
   */
  async startAgent(config) {
    const { userId, agentName = 'default' } = config;

    if (this.agents.has(agentName)) {
      logger.warn(`⚠️  Agent '${agentName}' is already running`);
      return this.agents.get(agentName);
    }

    try {
      const agent = new CyberforgeAgent(config);
      await agent.start();

      this.agents.set(agentName, agent);

      logger.info(`✅ Agent '${agentName}' started and registered`);

      return agent;
    } catch (error) {
      logger.error(`❌ Failed to start agent '${agentName}':`, error);
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentName) {
    const agent = this.agents.get(agentName);

    if (!agent) {
      logger.warn(`⚠️  Agent '${agentName}' not found`);
      return;
    }

    try {
      await agent.stop();
      this.agents.delete(agentName);

      logger.info(`✅ Agent '${agentName}' stopped`);
    } catch (error) {
      logger.error(`❌ Failed to stop agent '${agentName}':`, error);
      throw error;
    }
  }

  /**
   * Stop all agents
   */
  async stopAllAgents() {
    const agentNames = Array.from(this.agents.keys());

    logger.info(`🛑 Stopping ${agentNames.length} agent(s)...`);

    for (const agentName of agentNames) {
      try {
        await this.stopAgent(agentName);
      } catch (error) {
        logger.error(`❌ Failed to stop agent '${agentName}':`, error);
      }
    }

    logger.info('✅ All agents stopped');
  }

  /**
   * Get agent by name
   */
  getAgent(agentName) {
    return this.agents.get(agentName);
  }

  /**
   * List all running agents
   */
  listAgents() {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      agentId: agent.agentId,
      deviceId: agent.deviceId,
      state: agent.state,
      isRunning: agent.isRunning,
      metadata: agent.metadata
    }));
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentName) {
    const agent = this.agents.get(agentName);

    if (!agent) {
      return { exists: false };
    }

    return {
      exists: true,
      agentId: agent.agentId,
      deviceId: agent.deviceId,
      state: agent.state,
      isRunning: agent.isRunning,
      metadata: agent.metadata
    };
  }
}

// Singleton instance
const agentManager = new AgentManager();

module.exports = { AgentManager, agentManager };
