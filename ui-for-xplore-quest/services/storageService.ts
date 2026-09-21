/**
 * storageService.ts
 * Cross-platform persistent storage helper for XploreQuest user sessions.
 */

import { UserProfile, UserRole } from '../types';

const SESSION_KEY = '@xplorequest_user_session';

export function saveUserSession(role: UserRole, user: UserProfile | null): void {
  try {
    const data = JSON.stringify({ role, user });
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SESSION_KEY, data);
    }
  } catch (err) {
    console.warn('saveUserSession error:', err);
  }
}

export function loadUserSession(): { role: UserRole; user: UserProfile } | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(SESSION_KEY);
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (err) {
    console.warn('loadUserSession error:', err);
  }
  return null;
}

export function clearUserSession(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch (err) {
    console.warn('clearUserSession error:', err);
  }
}
