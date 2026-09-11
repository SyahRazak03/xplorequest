/**
 * services/auth.service.ts
 *
 * Authentication business logic for all three XploreQuest roles.
 *
 * All three flows share the same output shape: a Firebase custom token
 * signed with the correct custom claims so the client can call
 * `signInWithCustomToken(auth, token)` from the Firebase JS SDK.
 *
 * Custom claims set per role:
 *   admin:       { role: 'admin' }
 *   crew:        { role: 'crew',        eventId, checkpointId }
 *   participant: { role: 'participant', eventId, teamId }
 *
 * SECURITY NOTES:
 *   - Error messages are deliberately generic — never reveal whether an
 *     identifier exists vs. a credential is wrong (anti-enumeration).
 *   - Admin password verification uses the Firebase Auth REST API because
 *     the Admin SDK cannot verify passwords; it only manages users.
 *   - crewPinCode is read from events/{eventId}/secrets/config which has
 *     allow read, write: if false in Firestore rules — Admin SDK bypasses
 *     rules and is the only allowed reader.
 *   - Participant GPS coordinates are NEVER stored — only boolean results.
 */

import * as crypto from 'crypto';

import * as admin from 'firebase-admin';

import { getAuth, getFirestore } from '../config/firebase';
import type { EventDocument, TeamDocument, UserDocument, UserRole } from '../models';
import { AppError, ErrorCode } from '../utils/errors';


// ── Generic auth error — never leak whether identifier exists ────────────────
const AUTH_ERROR = new AppError(
  ErrorCode.UNAUTHORIZED,
  'ID atau kelayakan tidak sah.'
);

// ── Return shapes ─────────────────────────────────────────────────────────────

export interface AuthResult {
  customToken: string;
  uid: string;
  role: UserRole;
  name: string;
  email?: string;
  teamId?: string;
  teamName?: string;
  checkpointId?: string;
  eventId?: string;
}

export interface MeResult {
  uid: string;
  role: UserRole;
  name: string;
  email?: string;
  teamId?: string;
  teamName?: string;
  checkpointId?: string;
  eventId?: string;
  eventName?: string;
}

// ── Admin Login ───────────────────────────────────────────────────────────────

/**
 * Verifies admin email + password via the Firebase Auth REST API, then
 * mints a custom token with { role: 'admin' } claims.
 *
 * We use the REST API because the Admin SDK intentionally cannot verify
 * passwords — that is a client-side operation. By routing it through our
 * backend we keep brute-force rate limiting in one place.
 */
export async function adminLogin(email: string, password: string): Promise<AuthResult> {
  const apiKey = process.env['FIREBASE_WEB_API_KEY'];
  if (!apiKey && process.env['NODE_ENV'] === 'production') {
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, 'Auth config error.');
  }

  // Resolve REST endpoint — point to emulator when running locally
  const authEmulator = process.env['FIREBASE_AUTH_EMULATOR_HOST'];
  const restUrl = authEmulator
    ? `http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`
    : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey ?? ''}`;

  let uid: string;
  try {
    const resp = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    if (!resp.ok) {
      throw AUTH_ERROR;
    }

    const json = await resp.json() as { localId?: string };
    if (!json.localId) {
      throw AUTH_ERROR;
    }
    uid = json.localId;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw AUTH_ERROR;
  }

  const authInstance = getAuth();

  // Verify the UID has admin role (either existing claim or we set it now)
  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await authInstance.getUser(uid);
  } catch {
    throw AUTH_ERROR;
  }

  const existingClaims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
  if (existingClaims['role'] && existingClaims['role'] !== 'admin') {
    // User exists but is not an admin — deny
    throw AUTH_ERROR;
  }

  // Set/refresh admin claim
  await authInstance.setCustomUserClaims(uid, { role: 'admin' });

  // Upsert user document
  const db = getFirestore();
  await db.collection('users').doc(uid).set(
    {
      uid,
      name: userRecord.displayName ?? email.split('@')[0],
      email: userRecord.email ?? email,
      role: 'admin' as UserRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const customToken = await authInstance.createCustomToken(uid, { role: 'admin' });

  return {
    customToken,
    uid,
    role: 'admin',
    name: userRecord.displayName ?? email.split('@')[0],
    email: userRecord.email ?? email,
  };
}

// ── Crew Login ────────────────────────────────────────────────────────────────

/**
 * Validates marshalId + crewPinCode against Firestore, then mints a custom
 * token with { role: 'crew', eventId, checkpointId } claims.
 *
 * crewPinCode is read from events/{eventId}/secrets/config — a subcollection
 * with `allow read, write: if false` in Firestore rules. Only the Admin SDK
 * can read it (rules are bypassed).
 *
 * eventId is sourced from the app's active event context (passed in request).
 */
export async function crewLogin(
  marshalId: string,
  pinCode: string,
  checkpointId: string,
  eventId: string
): Promise<AuthResult> {
  const db = getFirestore();
  const authInstance = getAuth();

  // 1. Fetch the crew member's user record from Firestore by marshalId
  //    (marshalId is stored as the `id` field on user documents)
  const usersSnap = await db
    .collection('users')
    .where('id', '==', marshalId)
    .where('role', '==', 'crew')
    .limit(1)
    .get();

  if (usersSnap.empty) {
    // Do NOT reveal that the marshalId doesn't exist — use generic error
    throw AUTH_ERROR;
  }

  // 2. Read crewPinCode from secrets subcollection (Admin SDK bypasses rules)
  const secretsDoc = await db
    .collection('events')
    .doc(eventId)
    .collection('secrets')
    .doc('config')
    .get();

  if (!secretsDoc.exists) {
    throw AUTH_ERROR;
  }

  const secrets = secretsDoc.data() as { crewPinCode: string };

  // 3. Constant-time PIN comparison to prevent timing attacks
  if (!timingSafeEqual(pinCode, secrets.crewPinCode)) {
    throw AUTH_ERROR;
  }

  // 4. Set custom claims and mint token
  const userDoc = usersSnap.docs[0];
  const userData = userDoc.data() as UserDocument;
  const uid = userData.uid;

  const claims = { role: 'crew' as UserRole, eventId, checkpointId };
  await authInstance.setCustomUserClaims(uid, claims);

  // Upsert user document with latest checkpoint assignment
  await db.collection('users').doc(uid).set(
    {
      checkpointId,
      eventId,
      role: 'crew' as UserRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const customToken = await authInstance.createCustomToken(uid, claims);

  return {
    customToken,
    uid,
    role: 'crew',
    name: userData.name,
    checkpointId,
    eventId,
  };
}

// ── Participant Join ──────────────────────────────────────────────────────────

/**
 * Validates a participant's joinCode + teamName:
 *   1. Finds the active event by joinCode.
 *   2. Finds an approved team matching teamName (case-insensitive).
 *   3. Creates or reuses a Firebase Auth user for the team leader.
 *   4. Sets custom claims { role: 'participant', eventId, teamId }.
 *   5. Mints and returns a custom token.
 *
 * Single-tracker architecture: one Firebase Auth account per TEAM
 * (the team leader's device), not per team member.
 */
export async function participantJoin(
  joinCode: string,
  teamName: string
): Promise<AuthResult> {
  const db = getFirestore();
  const authInstance = getAuth();

  // 1. Find event by joinCode
  const eventsSnap = await db
    .collection('events')
    .where('joinCode', '==', joinCode.toUpperCase())
    .limit(1)
    .get();

  if (eventsSnap.empty) {
    throw AUTH_ERROR;
  }

  const eventDoc = eventsSnap.docs[0];
  const eventId = eventDoc.id;
  const eventData = eventDoc.data();

  if (eventData['isFinished']) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Acara ini telah tamat.');
  }

  // 2. Find team by name (case-insensitive) within this event
  const teamsSnap = await db
    .collection('events')
    .doc(eventId)
    .collection('teams')
    .where('status', '==', 'approved')
    .get();

  const normalised = teamName.trim().toLowerCase();
  const matchingTeam = teamsSnap.docs.find(
    (d) => (d.data()['name'] as string).toLowerCase() === normalised
  );

  if (!matchingTeam) {
    // Team not found or not yet approved — use same generic error
    throw AUTH_ERROR;
  }

  const teamId = matchingTeam.id;
  const teamData = matchingTeam.data() as TeamDocument;

  // 3. Reuse existing leaderUid if the team already has one, else create a user
  let uid: string;
  if (teamData.leaderUid) {
    uid = teamData.leaderUid;
    // Verify the Auth account still exists
    try {
      await authInstance.getUser(uid);
    } catch {
      uid = await createAnonymousFirebaseUser(teamName, eventId, teamId);
    }
  } else {
    uid = await createAnonymousFirebaseUser(teamName, eventId, teamId);
    // Write leaderUid back to the team document
    await db
      .collection('events')
      .doc(eventId)
      .collection('teams')
      .doc(teamId)
      .update({
        leaderUid: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  }

  // 4. Set custom claims and mint token
  const claims = { role: 'participant' as UserRole, eventId, teamId };
  await authInstance.setCustomUserClaims(uid, claims);

  // Upsert user doc
  await db.collection('users').doc(uid).set(
    {
      uid,
      name: teamData.leaderName ?? teamName,
      role: 'participant' as UserRole,
      teamId,
      eventId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const customToken = await authInstance.createCustomToken(uid, claims);

  return {
    customToken,
    uid,
    role: 'participant',
    name: teamData.leaderName ?? teamName,
    teamId,
    teamName: teamData.name,
    eventId,
  };
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Revokes all refresh tokens for the given UID.
 * The client must also call `auth().signOut()` locally.
 * After revocation, the current ID token remains valid until its 1-hour expiry
 * (Firebase limitation). To enforce immediate invalidation, enable
 * `checkRevoked: true` in verifyFirebaseToken middleware (already done in Stage 1).
 */
export async function logout(uid: string): Promise<void> {
  const authInstance = getAuth();
  await authInstance.revokeRefreshTokens(uid);
}

// ── Get Me ────────────────────────────────────────────────────────────────────

/**
 * Returns the role-scoped profile for a verified UID.
 * Used for session recovery on app re-open.
 */
export async function getMe(uid: string): Promise<MeResult> {
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Profil pengguna tidak ditemui.');
  }

  const data = snap.data() as UserDocument;
  let teamName: string | undefined = undefined;
  let eventName: string | undefined = undefined;

  if (data.role === 'participant' && data.eventId && data.teamId) {
    const [teamSnap, eventSnap] = await Promise.all([
      db
        .collection('events')
        .doc(data.eventId)
        .collection('teams')
        .doc(data.teamId)
        .get(),
      db.collection('events').doc(data.eventId).get(),
    ]);

    if (teamSnap.exists) {
      teamName = (teamSnap.data() as TeamDocument).name;
    }

    if (eventSnap.exists) {
      eventName = (eventSnap.data() as EventDocument).name;
    }
  }

  return {
    uid: data.uid,
    role: data.role,
    name: data.name,
    email: data.email,
    teamId: data.teamId,
    teamName,
    checkpointId: data.checkpointId,
    eventId: data.eventId,
    eventName,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Creates a new Firebase Auth user representing a team's lead device.
 * No email/password — the account is identified solely by the custom token.
 */
async function createAnonymousFirebaseUser(
  teamName: string,
  eventId: string,
  teamId: string
): Promise<string> {
  const authInstance = getAuth();
  const userRecord = await authInstance.createUser({
    displayName: teamName,
    // uid hint: deterministic but unique per event+team
    // Firebase allows custom UIDs up to 128 chars
    uid: `participant_${eventId}_${teamId}`.slice(0, 128),
  });
  return userRecord.uid;
}

/**
 * Constant-time string comparison to prevent timing-based side-channel attacks.
 * Falls back to simple comparison if strings differ in length (timing-safe
 * requires equal-length buffers).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

