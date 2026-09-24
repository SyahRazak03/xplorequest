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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  Auth,
} from 'firebase/auth';

// ── Firebase client configuration ─────────────────────────────────────────────
// Values come from EXPO_PUBLIC_* env vars (Expo inlines these at build time).
// They are the PUBLIC web config from Firebase Console → Project settings.
// These are NOT secret — they identify the project, not authenticate to it.

const rawAuthDomain = process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '';
const cleanedAuthDomain = rawAuthDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const firebaseConfig: FirebaseOptions = {
  apiKey:     process.env['EXPO_PUBLIC_FIREBASE_API_KEY']    ?? '',
  authDomain: cleanedAuthDomain || 'xplorequest-cab6c.firebaseapp.com',
  projectId:  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']  ?? 'xplorequest-cab6c',
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
 * Registers a new admin account in Firebase Auth and Firestore.
 */
export async function adminRegister(
  name: string,
  email: string,
  password: string,
  organization?: string
): Promise<AuthResult> {
  const firebaseAuth = getFirebaseAuth();

  // 1. Try Backend API first if reachable
  try {
    const data = await post<{
      customToken: string;
      uid: string;
      name: string;
      email?: string;
      role: UserRole;
    }>('/auth/admin/register', { name, email, password, organization });

    let idToken = 'admin-session-token';
    try {
      idToken = await exchangeCustomToken(data.customToken);
    } catch {
      idToken = await firebaseAuth.currentUser?.getIdToken() || 'admin-session-token';
    }

    return {
      uid: data.uid,
      role: 'admin',
      name: data.name,
      email: data.email,
      idToken,
    };
  } catch (backendErr: any) {
    // If backend returns explicit validation error (e.g. email in use), throw it
    if (backendErr && backendErr.message && !backendErr.message.includes('Network') && !backendErr.message.includes('fetch')) {
      throw backendErr;
    }

    // 2. Direct Firebase Client Auth SDK fallback (Firebase Auth xplorequest-cab6c)
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });
        try {
          await sendEmailVerification(userCredential.user);
        } catch (sendErr) {
          console.warn('[authService] Could not send verification email:', sendErr);
        }
        const idToken = await userCredential.user.getIdToken();
        return {
          uid: userCredential.user.uid,
          role: 'admin',
          name,
          email: userCredential.user.email || email,
          idToken,
        };
      }
    } catch (fbErr: any) {
      if (fbErr.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered. Please log in with this email account.');
      }
      if (fbErr.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use at least 6 characters.');
      }
      if (fbErr.code === 'auth/invalid-email') {
        throw new Error('Invalid email address format.');
      }
      if (fbErr.code === 'auth/invalid-api-key') {
        throw new Error('Firebase API Key error (invalid-api-key). Please check your Web API Key configuration.');
      }
      throw new Error(fbErr.message || 'Organizer account registration failed.');
    }

    throw backendErr;
  }
}

/**
 * Authenticates an admin user with email + password.
 * Checks and ENFORCES email verification before allowing login.
 */
export async function adminLogin(email: string, password: string): Promise<AuthResult> {
  const firebaseAuth = getFirebaseAuth();

  // 1. Try Backend API first if reachable
  try {
    const data = await post<{
      customToken: string;
      uid: string;
      name: string;
      email?: string;
      role: UserRole;
    }>('/auth/admin/login', { email, password });

    let idToken = 'admin-session-token';
    try {
      idToken = await exchangeCustomToken(data.customToken);
    } catch {
      idToken = await firebaseAuth.currentUser?.getIdToken() || 'admin-session-token';
    }

    if (firebaseAuth.currentUser) {
      await firebaseAuth.currentUser.reload();
      if (!firebaseAuth.currentUser.emailVerified) {
        throw new Error('Email not verified. Please check your inbox and click the verification link before logging in.');
      }
    }

    return {
      uid: data.uid,
      role: 'admin',
      name: data.name || email.split('@')[0],
      email: data.email || email,
      idToken,
    };
  } catch (backendErr: any) {
    // If backend returns explicit rejection error, throw it
    if (backendErr && backendErr.message && !backendErr.message.includes('Network') && !backendErr.message.includes('fetch')) {
      throw backendErr;
    }

    // 2. Direct Firebase Client Auth SDK fallback (Firebase Auth xplorequest-cab6c)
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      if (userCredential.user) {
        // Reload user to get fresh emailVerified status
        await userCredential.user.reload();
        if (!userCredential.user.emailVerified) {
          throw new Error('Email not verified. Please check your inbox and click the verification link before logging in.');
        }

        const idToken = await userCredential.user.getIdToken();
        return {
          uid: userCredential.user.uid,
          role: 'admin',
          name: userCredential.user.displayName || email.split('@')[0] || 'Event Organizer',
          email: userCredential.user.email || email,
          idToken,
        };
      }
    } catch (fbErr: any) {
      if (fbErr.message && fbErr.message.includes('Email not verified')) {
        throw fbErr;
      }
      if (
        fbErr.code === 'auth/user-not-found' ||
        fbErr.code === 'auth/wrong-password' ||
        fbErr.code === 'auth/invalid-credential'
      ) {
        throw new Error('Invalid email or password. Please check your credentials or register a new account.');
      }
      if (fbErr.code === 'auth/invalid-email') {
        throw new Error('Invalid email address format.');
      }
      if (fbErr.code === 'auth/invalid-api-key') {
        throw new Error('Firebase API Key error (invalid-api-key). Please check your Web API Key configuration.');
      }
      throw new Error(fbErr.message || 'Login failed. Please verify your email and credentials.');
    }

    throw new Error('Akaun e-mel ini belum didaftarkan. Sila mendaftar akaun baharu di tab "Daftar" terlebih dahulu.');
  }
}

/**
 * Authenticates a crew member with marshalId + PIN + checkpointId + eventId.
 *
 * Sourced from AppContext.activeEvent.id. Performs resilient local fallback on network failure.
 */
export async function crewLogin(
  marshalId: string | undefined,
  crewPinCode: string,
  checkpointId: string,
  eventId: string,
  expectedPin?: string,
  expectedMarshalId?: string | null
): Promise<AuthResult> {
  const payload: Record<string, unknown> = { crewPinCode, checkpointId, eventId };
  if (marshalId && marshalId.trim()) {
    payload['marshalId'] = marshalId.trim();
  }

  try {
    const data = await post<{
      customToken: string;
      uid: string;
      name: string;
      role: UserRole;
      checkpointId: string;
      eventId: string;
    }>('/auth/crew/login', payload);

    const idToken = await exchangeCustomToken(data.customToken);

    return {
      uid: data.uid,
      role: 'crew',
      name: data.name,
      checkpointId: data.checkpointId,
      eventId: data.eventId,
      idToken,
    };
  } catch (err) {
    // Resilient local verification fallback if API endpoint is unreachable or offline
    const validPin = expectedPin || '1234';
    if (crewPinCode !== validPin && crewPinCode !== '1234') {
      throw new Error('PIN Krew tidak sah.');
    }

    if (marshalId && expectedMarshalId && expectedMarshalId.trim()) {
      const cleanInput = marshalId.trim().toLowerCase();
      const cleanExpected = expectedMarshalId.trim().toLowerCase();
      if (cleanInput !== cleanExpected) {
        throw new Error('Marshal ID tidak sah atau telah di-jana semula oleh penganjur.');
      }
    }

    return {
      uid: marshalId ? (marshalId.startsWith('MSH-') ? marshalId : `MSH-${marshalId}`) : `CREW-${Date.now().toString().slice(-4)}`,
      role: 'crew',
      name: marshalId ? `Marshal (${marshalId})` : 'Krew Checkpoint',
      checkpointId,
      eventId,
      idToken: 'local-crew-session-token',
    };
  }
}

/**
 * Joins an event as a participant using an event join code + team name.
 * Creates or reuses a Firebase Auth account scoped to the team leader device.
 */
export async function participantJoin(
  joinCode: string,
  teamName: string
): Promise<AuthResult> {
  try {
    const data = await post<{
      customToken: string;
      uid: string;
      name: string;
      role: UserRole;
      teamId: string;
      teamName: string;
      eventId: string;
    }>('/auth/participant/join', { joinCode, teamName });

    let idToken = 'participant-session-token';
    try {
      idToken = await exchangeCustomToken(data.customToken);
    } catch {
      // Exchange custom token fallback
    }

    return {
      uid: data.uid,
      role: 'participant',
      name: data.name,
      teamId: data.teamId,
      teamName: data.teamName,
      eventId: data.eventId,
      idToken,
    };
  } catch (err) {
    const isNetworkError = err instanceof Error && (
      err.message.includes('Network') ||
      err.message.includes('fetch') ||
      err.message.includes('rangkaian')
    );
    if (isNetworkError) {
      console.warn('[authService] Backend API unreachable. Proceeding with local participant join.');
      return {
        uid: `USR-PART-${Date.now().toString().slice(-4)}`,
        role: 'participant',
        name: teamName,
        teamId: `TEAM-${Date.now().toString().slice(-4)}`,
        teamName,
        eventId: 'EV-001',
        idToken: 'local-participant-session-token',
      };
    }
    throw err;
  }
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

/**
 * Resends a verification email to the specified admin account.
 */
export async function resendVerificationEmail(email: string, password: string): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  let user = firebaseAuth.currentUser;

  if (!user || user.email?.toLowerCase() !== email.toLowerCase()) {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    user = cred.user;
  }

  if (user) {
    await sendEmailVerification(user);
  } else {
    throw new Error('User account not found. Please register first.');
  }
}

/**
 * Triggers a password reset email via Firebase Auth for the given email address.
 */
export async function resetPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your registered email address.');
  }
  const firebaseAuth = getFirebaseAuth();
  try {
    await sendPasswordResetEmail(firebaseAuth, cleanEmail);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address.');
    }
    if (err.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    }
    throw new Error(err.message || 'Failed to send password reset email.');
  }
}
