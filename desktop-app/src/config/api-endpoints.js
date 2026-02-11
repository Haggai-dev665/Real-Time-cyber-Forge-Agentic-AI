// CyberForge API Configuration - Always connects to production
const HEROKU_URL = 'https://cyberforge-ddd97655464f.herokuapp.com';

const API_CONFIG = {
  // Backend API endpoints - Always use Heroku production
  backend: {
    base: HEROKU_URL,
    api: `${HEROKU_URL}/api`,
    websocket: 'wss://cyberforge-ddd97655464f.herokuapp.com/ws'
  },
  
  // ML Services (already on HuggingFace)
  ml: {
    base: 'https://che237-cyberforge-models.hf.space',
    predict: 'https://che237-cyberforge-models.hf.space/predict',
    health: 'https://che237-cyberforge-models.hf.space/health',
    models: 'https://che237-cyberforge-models.hf.space/models'
  },
  
  // External services
  services: {
    otx: 'https://otx.alienvault.com/api/v1',
    virustotal: 'https://www.virustotal.com/api/v3'
  }
};

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG };
} else {
  window.API_CONFIG = API_CONFIG;
}