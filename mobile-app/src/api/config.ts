import Constants from 'expo-constants';

/**
 * Backend base URL. Defaults to the deployed Heroku instance (same origin the
 * desktop app uses — see desktop/ui/scripts/cyberforge-shared.js). Override by
 * editing `extra.apiBaseUrl` in app.json, or set EXPO_PUBLIC_API_BASE_URL.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ||
  'https://cyberforge-ddd97655464f.herokuapp.com';

/** Identifies this client to the backend (some routes relax auth for known UAs). */
export const USER_AGENT = 'cyberforge-mobile';
