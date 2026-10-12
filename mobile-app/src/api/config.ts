import Constants from 'expo-constants';

/**
 * Backend base URL. The default is `extra.apiBaseUrl` in app.json (the deployed
 * backend); set EXPO_PUBLIC_API_BASE_URL to use another one. There is no third
 * copy of the address here: a build without either is misconfigured.
 */
const configuredBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;

if (!configuredBaseUrl) {
  throw new Error('Backend URL is not configured: set extra.apiBaseUrl in app.json or EXPO_PUBLIC_API_BASE_URL.');
}

export const API_BASE_URL: string = configuredBaseUrl.replace(/\/+$/, '');

/** Identifies this client in backend logs. It grants no access. */
export const USER_AGENT = 'cyberforge-mobile';
