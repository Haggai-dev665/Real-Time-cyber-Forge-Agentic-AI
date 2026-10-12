const { selectConfig } = require('../../scripts/push-heroku-config');

const env = {
  PORT: '8000',
  NODE_ENV: 'development',
  DATABASE_URL: 'mongodb+srv://user:p%40ss&word@cluster.example.net/app?retryWrites=true',
  REDIS_URL: 'rediss://default:secret@redis.example.net:6380',
  JWT_SECRET: 'your-super-secure-jwt-secret-key-here-make-it-long-and-random',
  GEMINI_API_KEY: 'your-gemini-api-key',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
  ML_SERVICE_URL: 'http://localhost:8001',
  ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:19006',
  DATADOG_AGENT_HOST: 'localhost',
  APPWRITE_ENDPOINT: 'https://nyc.cloud.appwrite.io/v1',
  APPWRITE_API_KEY: 'standard_0123456789abcdef',
  EMPTY_VALUE: ''
};

test('usable values are pushed unchanged; placeholders, local addresses, PORT and a local NODE_ENV are not', () => {
  const { push, skip } = selectConfig(env);
  expect(push).toEqual({
    DATABASE_URL: env.DATABASE_URL,
    REDIS_URL: env.REDIS_URL,
    APPWRITE_ENDPOINT: env.APPWRITE_ENDPOINT,
    APPWRITE_API_KEY: env.APPWRITE_API_KEY
  });
  expect(Object.keys(skip).sort()).toEqual([
    'ALLOWED_ORIGINS', 'DATADOG_AGENT_HOST', 'EMPTY_VALUE', 'FIREBASE_PRIVATE_KEY', 'GEMINI_API_KEY',
    'JWT_SECRET', 'ML_SERVICE_URL', 'NODE_ENV', 'PORT'
  ]);
});

test('skip reasons never contain a secret value', () => {
  const { skip } = selectConfig(env);
  const reasons = Object.values(skip).join(' ');
  for (const secret of [env.JWT_SECRET, env.GEMINI_API_KEY, 'BEGIN PRIVATE KEY', env.ML_SERVICE_URL]) {
    expect(reasons).not.toContain(secret);
  }
});

test('--all pushes everything except PORT and empty values', () => {
  const { push, skip } = selectConfig(env, { all: true });
  expect(Object.keys(skip).sort()).toEqual(['EMPTY_VALUE', 'PORT']);
  expect(push.JWT_SECRET).toBe(env.JWT_SECRET);
  expect(push.NODE_ENV).toBe('development');
});

test('a production NODE_ENV and remote hosts containing "localhost" as a substring are kept', () => {
  const { push } = selectConfig({ NODE_ENV: 'production', API_URL: 'https://notlocalhost.example.com/v1' });
  expect(push).toEqual({ NODE_ENV: 'production', API_URL: 'https://notlocalhost.example.com/v1' });
});
