/**
 * services/authService.ts
 *
 * Frontend authentication service for XploreQuest (Expo Managed Workflow).
 *
 * Uses:
 *   • Firebase JS SDK (firebase/auth) for signInWithCustomToken
 *   • fetch() for backend API calls (POST /auth/*)
 *
 * All three flows share one pattern:
 *   1. POST to the backend with credentials
 *   2. Receive a Firebase custom token in the response
 *   3. Call signInWithCustomToken(firebaseAuth, token) — Firebase issues
 *      an ID token containing the custom claims set by the backend.
 *   4. Return a typed AuthResult for the caller to update AppContext.
 *
 * Token storage contract (caller's responsibility):
 *   const idToken = await firebaseAuth.currentUser?.getIdToken();
 *   await SecureStore.setItemAsync('xq_id_token', idToken);
 *   — Expo SecureStore is the recommended store; do NOT use AsyncStorage
 *     for tokens (unencrypted on Android).
 *
 * Firebase client initialisation:
 *   This file calls getFirebaseAuth() which returns the shared Firebase
 *   Auth instance. The app must initialise Firebase once at startup —
 *   see the comment block in getFirebaseAuth() below.
 *
 * Required Expo packages (install once):
 *   npx expo install firebase
 *   npx expo install expo-secure-store  (for token storage in callers)
 */

import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signOut,
  Auth,
} from 'firebase/auth';

// ── Firebase client configuration ─────────────────────────────────────────────
// Values come from EXPO_PUBLIC_* env vars (Expo inlines these at build time).
// They are the PUBLIC web config from Firebase Console → Project settings.
// These are NOT secret — they identify the project, not authenticate to it.

const firebaseConfig: FirebaseOptions = {
  apiKey:    process.env['EXPO_PUBLIC_FIREBASE_API_KEY']    ?? '',
  authDomain: process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '',
  projectId:  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']  ?? '',
  appId:      process.env['EXPO_PUBLIC_FIREBASE_APP_ID']      ?? '',
};

/** Returns the shared Firebase Auth instance, initialising the app if needed. */
function getFirebaseAuth(): Auth {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getAuth(app);
}

// ── Backend API base URL ──────────────────────────────────────────────────────
// For Expo Go / emulator: http://127.0.0.1:5001/<projectId>/asia-southeast1/api
// For production:         https://asia-southeast1-<projectId>.cloudfunctions.net/api

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

// ── Response types ────────────────────────────────────────────────────────────

export type UserRole = 'participant' | 'crew' | 'admin';

export interface AuthResult {
  uid: string;
  role: UserRole;
  name: string;
  email?: string;
  teamId?: string;
  teamName?: string;
  checkpointId?: string;
  eventId?: string;
  /** Firebase ID token — store in SecureStore, attach as Bearer on future API calls */
  idToken: string;
}

// ── Internal helper: POST to backend ─────────────────────────────────────────

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await resp.json() as { success: boolean; data?: T; error?: { code: string; message: string } };

  if (!resp.ok || !json.success) {
    const msg = json.error?.message ?? 'Ralat rangkaian. Sila cuba lagi.';
    throw new Error(msg);
  }

  return json.data as T;
}

// ── Sign in with custom token ─────────────────────────────────────────────────

async function exchangeCustomToken(customToken: string): Promise<string> {
  const firebaseAuth = getFirebaseAuth();
  const credential = await signInWithCustomToken(firebaseAuth, customToken);
  // Force-refresh to get a token that includes the just-set custom claims
  const idToken = await credential.user.getIdToken(/* forceRefresh */ true);
  return idToken;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Authenticates an admin user with email + password.
 *
 * The backend verifies credentials via Firebase Auth REST API (so rate limiting
 * applies), then mints a custom token with { role: 'admin' } claims.
 */
export async function adminLogin(email: string, password: string): Promise<AuthResult> {
  const data = await post<{
    customToken: string;
    uid: string;
    name: string;
    email?: string;
    role: UserRole;
  }>('/auth/admin/login', { email, password });

  const idToken = await exchangeCustomToken(data.customToken);

  return {
    uid: data.uid,
    role: 'admin',
    name: data.name,
    email: data.email,
    idToken,
  };
}

/**
 * Authenticates a crew member with marshalId + PIN + checkpointId + eventId.
 *
 * eventId is sourced from AppContext.activeEvent.id (passed by the caller).
 * This avoids adding a new input field to the UI.
 */
export async function crewLogin(
  marshalId: string,
  crewPinCode: string,
  checkpointId: string,
  eventId: string
): Promise<AuthResult> {
  const data = await post<{
    customToken: string;
    uid: string;
    name: string;
    role: UserRole;
    checkpointId: string;
    eventId: string;
  }>('/auth/crew/login', { marshalId, crewPinCode, checkpointId, eventId });

  const idToken = await exchangeCustomToken(data.customToken);

  return {
    uid: data.uid,
    role: 'crew',
    name: data.name,
    checkpointId: data.checkpointId,
    eventId: data.eventId,
    idToken,
  };
}

/**
 * Joins an event as a participant using an event join code + team name.
 * Creates or reuses a Firebase Auth account scoped to the team leader device.
 */
export async function participantJoin(
  joinCode: string,
  teamName: string
): Promise<AuthResult> {
  const data = await post<{
    customToken: string;
    uid: string;
    name: string;
    role: UserRole;
    teamId: string;
    teamName: string;
    eventId: string;
  }>('/auth/participant/join', { joinCode, teamName });

  const idToken = await exchangeCustomToken(data.customToken);

  return {
    uid: data.uid,
    role: 'participant',
    name: data.name,
    teamId: data.teamId,
    teamName: data.teamName,
    eventId: data.eventId,
    idToken,
  };
}

/**
 * Logs out the current user.
 * Calls backend to revoke refresh tokens, then signs out of Firebase client.
 *
 * @param idToken - The current ID token (from SecureStore)
 */
export async function authLogout(idToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
    });
  } catch {
    // Best-effort — always sign out locally even if backend call fails
  }
  const firebaseAuth = getFirebaseAuth();
  await signOut(firebaseAuth).catch(() => undefined);
}

/**
 * Fetches the role-scoped profile for an authenticated user.
 * Used for session recovery on app restart (after reading idToken from SecureStore).
 *
 * @param idToken - The stored ID token (from SecureStore)
 */
export async function getMe(idToken: string): Promise<AuthResult> {
  const resp = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${idToken}` },
  });

  const json = await resp.json() as {
    success: boolean;
    data?: {
      uid: string;
      role: UserRole;
      name: string;
      email?: string;
      teamId?: string;
      checkpointId?: string;
      eventId?: string;
    };
    error?: { message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? 'Sesi tamat. Sila log masuk semula.');
  }

  return { ...json.data, idToken };
}
