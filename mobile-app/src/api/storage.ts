/**
 * Token persistence. Uses expo-secure-store on native (keychain / keystore) and
 * falls back to AsyncStorage on web where SecureStore is unavailable.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

export const TOKEN_KEY = 'cf_token';
export const USER_KEY = 'cf_user';
