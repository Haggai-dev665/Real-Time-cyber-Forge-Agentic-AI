// Environment-specific API configuration
const isDev = process.env.NODE_ENV === 'development';

const API_CONFIG = {
  // Backend API endpoints
  backend: {
    base: isDev ? 'http://localhost:8000' : 'https://cyberforge-ddd97655464f.herokuapp.com',
    api: isDev ? 'http://localhost:8000/api' : 'https://cyberforge-ddd97655464f.herokuapp.com/api',
    websocket: isDev ? 'ws://localhost:8000/ws' : 'wss://cyberforge-ddd97655464f.herokuapp.com/ws'
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