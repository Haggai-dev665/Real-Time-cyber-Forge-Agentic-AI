/**
 * What the phone keeps for the signed-in account: the last data each screen
 * loaded (shown, marked stale, when the backend cannot be reached), saved
 * assistant conversations and the capture outbox.
 *
 * Every key carries the account's ID, so one account never reads another's
 * data on a shared phone, and signing out removes the account's data
 * (clearAccount). Guests keep nothing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cf_u:';

const keyOf = (userId: string, name: string) => `${PREFIX}${userId}:${name}`;

export async function readJson<T>(userId: string | null | undefined, name: string): Promise<T | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyOf(userId, name));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(userId: string | null | undefined, name: string, value: unknown): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyOf(userId, name), JSON.stringify(value));
  } catch {
    // a full or unavailable store loses the cache, never the app
  }
}

export async function removeKey(userId: string | null | undefined, name: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(keyOf(userId, name));
  } catch {
    /* nothing to remove */
  }
}

/** Remove everything kept for one account (on sign-out), or for every account when no ID is given. */
export async function clearAccount(userId?: string | null): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = userId ? `${PREFIX}${userId}:` : PREFIX;
    const mine = keys.filter((k) => k.startsWith(prefix));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    /* best effort */
  }
}

/** A cached response with the time it was loaded. */
export interface Cached<T> {
  at: number;
  data: T;
}

export const cacheName = (key: string) => `cache:${key}`;
