// CyberForge API Configuration — Production (Heroku)
const PRODUCTION_URL = 'https://cyberforge-ddd97655464f.herokuapp.com';
const LOCAL_URL      = 'http://localhost:8000';

// Resolve: use saved preference → production → local fallback
const savedUrl = (typeof localStorage !== 'undefined') && localStorage.getItem('cyberforge_backend_url');
const BACKEND_URL = savedUrl || PRODUCTION_URL;
const WS_PROTOCOL = BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
const WS_URL = `${WS_PROTOCOL}://${BACKEND_URL.replace(/^https?:\/\//, '')}/ws`;

const API_CONFIG = {
  backend: {
    base: BACKEND_URL,
    api: `${BACKEND_URL}/api`,
    websocket: WS_URL,
    production: PRODUCTION_URL,
    local: LOCAL_URL
  },
  
  // ML Services — routed via Heroku proxy /api/cyberforge-ml (preferred)
  // Direct HF Space: https://che237-cyberforge.hf.space
  ml: {
    base: 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml',
    predict: 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml/predict',
    health: 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml/health',
    models: 'https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml/models'
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