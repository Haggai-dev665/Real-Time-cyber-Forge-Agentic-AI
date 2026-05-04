/**
 * CyberForge Global API Configuration
 * Single source of truth for all backend and ML service URLs.
 * Loaded FIRST before any screen scripts.
 */

(function () {
    const HEROKU    = 'https://cyberforge-ddd97655464f.herokuapp.com';
    const HF_SPACE  = 'https://che237-cyberforge-models.hf.space';

    // Allow runtime override via settings (stored in localStorage by settings.js)
    const savedBackend = localStorage.getItem('cf-backend-url');
    const savedML      = localStorage.getItem('cf-ml-url');

    window.CF_API = {
        BACKEND: (savedBackend || HEROKU).replace(/\/$/, ''),
        ML:      (savedML || HF_SPACE).replace(/\/$/, ''),
        get API()     { return this.BACKEND + '/api'; },
        get WS()      {
            const b = this.BACKEND;
            return b.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws';
        },
        AUTH_TOKEN: () => localStorage.getItem('authToken'),
        headers() {
            const h = { 'Content-Type': 'application/json' };
            const t = this.AUTH_TOKEN();
            if (t) h['Authorization'] = 'Bearer ' + t;
            return h;
        },
    };

    // Listen for settings changes at runtime
    window.addEventListener('cf-theme-change', () => {
        window.CF_API.BACKEND = (localStorage.getItem('cf-backend-url') || HEROKU).replace(/\/$/, '');
        window.CF_API.ML      = (localStorage.getItem('cf-ml-url') || HF_SPACE).replace(/\/$/, '');
    });

    console.log('[CF] API config loaded — Backend:', window.CF_API.BACKEND, '| ML:', window.CF_API.ML);
})();
