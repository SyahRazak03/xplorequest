/**
 * storageService.ts
 * Hardware-Backed Encrypted Local Storage Helper for XploreQuest.
 *
 * Implements Objective 1.4.2:
 *   - iOS: Encrypted using iOS Keychain Services (hardware-backed).
 *   - Android: Encrypted using Android KeyStore System (AES-256 GCM).
 *   - Web: Fallback to localStorage.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UserRole, EventConfig } from '../types';

const SESSION_KEY = 'xq_user_session_v1';
const TOKEN_KEY = 'xq_id_token_v1';

export async function saveUserSession(role: UserRole, user: UserProfile | null): Promise<void> {
  try {
    const data = JSON.stringify({ role, user });
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SESSION_KEY, data);
      }
    } else {
      await SecureStore.setItemAsync(SESSION_KEY, data);
    }
  } catch (err) {
    console.warn('saveUserSession SecureStore error:', err);
  }
}

export async function loadUserSession(): Promise<{ role: UserRole; user: UserProfile } | null> {
  try {
    let data: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        data = window.localStorage.getItem(SESSION_KEY);
      }
    } else {
      data = await SecureStore.getItemAsync(SESSION_KEY);
    }

    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('loadUserSession SecureStore error:', err);
  }
  return null;
}

export async function clearUserSession(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SESSION_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch (err) {
    console.warn('clearUserSession SecureStore error:', err);
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (err) {
    console.warn('saveAuthToken SecureStore error:', err);
  }
}

export async function loadAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(TOKEN_KEY);
      }
    } else {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('loadAuthToken SecureStore error:', err);
  }
  return null;
}

export async function clearAuthToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('clearAuthToken SecureStore error:', err);
  }
}

const EVENTS_KEY = 'xq_local_events_v1';

export async function saveLocalEvents(events: EventConfig[]): Promise<void> {
  try {
    const data = JSON.stringify(events);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(EVENTS_KEY, data);
      }
    } else {
      await AsyncStorage.setItem(EVENTS_KEY, data);
    }
  } catch (err) {
    console.warn('saveLocalEvents AsyncStorage error:', err);
  }
}

export async function loadLocalEvents(): Promise<EventConfig[]> {
  try {
    let data: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        data = window.localStorage.getItem(EVENTS_KEY);
      }
    } else {
      data = await AsyncStorage.getItem(EVENTS_KEY);
    }
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('loadLocalEvents AsyncStorage error:', err);
  }
  return [];
}

export async function clearLocalEvents(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(EVENTS_KEY);
      }
    } else {
      await AsyncStorage.removeItem(EVENTS_KEY);
    }
  } catch (err) {
    console.warn('clearLocalEvents AsyncStorage error:', err);
  }
}

