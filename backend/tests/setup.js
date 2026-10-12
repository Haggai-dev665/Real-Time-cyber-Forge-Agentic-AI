// Tests do not load .env or contact live providers. No fixed production fallback.
process.env.JWT_SECRET = require('crypto').randomBytes(48).toString('base64');
process.env.DATADOG_ENABLED = 'false';
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.ML_SERVICE_URL;
delete process.env.AI_SERVICE_URL;
delete process.env.HF_SPACE_URL;
