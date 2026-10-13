/**
 * Agent Manager
 * Manages the lifecycle of Cyberforge agents
 */

const { CyberforgeAgent } = require('./CyberforgeAgent');
const logger = require('../utils/logger');

class AgentManager {
  constructor() {
    // Agents are held per owning account: owner ID -> (agent name -> agent).
    // Two accounts can each run an agent called 'default' without seeing,
    // reusing or stopping the other's.
    this.agents = new Map();
  }

  _ownedBy(userId) {
    return this.agents.get(String(userId)) || new Map();
  }

  /**
   * Create and start a new agent
   */
  async startAgent(config) {
    const { userId, agentName = 'default' } = config;
    if (!userId) throw new Error('An agent needs an owning user');

    const running = this.getAgent(agentName, userId);
    if (running) {
      logger.warn(`⚠️  Agent '${agentName}' is already running`);
      return running;
    }

    try {
      const agent = new CyberforgeAgent(config);
      await agent.start();

      const owner = String(userId);
      if (!this.agents.has(owner)) this.agents.set(owner, new Map());
      this.agents.get(owner).set(agentName, agent);

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
  async stopAgent(agentName, userId) {
    const agent = this.getAgent(agentName, userId);

    if (!agent) {
      logger.warn(`⚠️  Agent '${agentName}' not found`);
      return;
    }

    try {
      await agent.stop();
      const owned = this._ownedBy(userId);
      owned.delete(agentName);
      if (owned.size === 0) this.agents.delete(String(userId));

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
    const running = [];
    for (const [owner, owned] of this.agents) {
      for (const agentName of owned.keys()) running.push([agentName, owner]);
    }

    logger.info(`🛑 Stopping ${running.length} agent(s)...`);

    for (const [agentName, owner] of running) {
      try {
        await this.stopAgent(agentName, owner);
      } catch (error) {
        logger.error(`❌ Failed to stop agent '${agentName}':`, error);
      }
    }

    logger.info('✅ All agents stopped');
  }

  /**
   * Get one of an account's agents by name
   */
  getAgent(agentName, userId) {
    return this._ownedBy(userId).get(agentName);
  }

  /**
   * List an account's running agents
   */
  listAgents(userId) {
    return Array.from(this._ownedBy(userId).entries()).map(([name, agent]) => ({
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
  getAgentStatus(agentName, userId) {
    const agent = this.getAgent(agentName, userId);

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
