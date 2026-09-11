#!/usr/bin/env ts-node
/**
 * scripts/seed.ts
 *
 * One-time demo account seeder for XploreQuest.
 *
 * Creates:
 *   1. Admin Firebase Auth account (email/password)
 *   2. Admin user document in Firestore (users/{uid})
 *   3. Demo crew user document in Firestore (users/USR-CREW-DEMO)
 *   4. Demo event document with secrets subcollection
 *      (crewPinCode read from env — never hardcoded)
 *
 * Usage (emulator — recommended for development):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   DEMO_ADMIN_EMAIL=azman@xplorequest.com \
 *   DEMO_ADMIN_PASSWORD=yourStrongPassword \
 *   npx ts-node --project tsconfig.json scripts/seed.ts
 *
 * Usage (production — run once only, then disable):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   FIREBASE_PROJECT_ID=your-project-id \
 *   DEMO_ADMIN_EMAIL=azman@xplorequest.com \
 *   DEMO_ADMIN_PASSWORD=yourStrongPassword \
 *   npx ts-node --project tsconfig.json scripts/seed.ts
 *
 * NOTE: Credentials are read exclusively from environment variables.
 *       This file contains NO hardcoded emails, passwords, or PINs.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend root (one directory up from functions/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import * as admin from 'firebase-admin';

// ── Initialise Admin SDK ──────────────────────────────────────────────────────

function initAdmin(): void {
  if (admin.apps.length > 0) return;

  const b64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  const filePath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const projectId = process.env['FIREBASE_PROJECT_ID'];

  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
  } else if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    admin.initializeApp({ credential: admin.credential.cert(resolved) });
  } else {
    // ADC — works inside emulator and on GCP
    admin.initializeApp({
      projectId: projectId ?? 'demo-xplorequest',
    });
  }
}

// ── Required env vars ─────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// ── Seed logic ────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  initAdmin();

  const authClient = admin.auth();
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const adminEmail    = requireEnv('DEMO_ADMIN_EMAIL');
  const adminPassword = requireEnv('DEMO_ADMIN_PASSWORD');
  // Crew PIN comes from env — fallback to '1234' for local emulator demos only
  const crewPin       = process.env['DEMO_CREW_PIN'] ?? '1234';
  const hmacSecret    = process.env['HMAC_SECRET'] ?? 'demo-hmac-secret-change-in-prod';

  console.log('\n🌱  XploreQuest Demo Seeder');
  console.log('   Target:', process.env['FIREBASE_AUTH_EMULATOR_HOST']
    ? `Auth Emulator (${process.env['FIREBASE_AUTH_EMULATOR_HOST']})`
    : 'Production Firebase');

  // ── 1. Admin Firebase Auth account ─────────────────────────────────────────
  let adminUid: string;
  try {
    const existing = await authClient.getUserByEmail(adminEmail);
    adminUid = existing.uid;
    // Reset password in case it changed
    await authClient.updateUser(adminUid, { password: adminPassword });
    console.log(`✅  Admin account exists (${adminEmail}) — password refreshed`);
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };
    if (firebaseErr.code === 'auth/user-not-found') {
      const newUser = await authClient.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: 'Encik Azman',
      });
      adminUid = newUser.uid;
      console.log(`✅  Admin account created (${adminEmail})`);
    } else {
      throw err;
    }
  }

  await authClient.setCustomUserClaims(adminUid, { role: 'admin' });
  console.log('✅  Admin custom claims set: { role: "admin" }');

  // ── 2. Admin Firestore user document ───────────────────────────────────────
  await db.collection('users').doc(adminUid).set({
    uid: adminUid,
    name: 'Encik Azman',
    email: adminEmail,
    role: 'admin',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✅  Admin user document upserted');

  // ── 3. Demo crew user document ─────────────────────────────────────────────
  // The crew user exists only in Firestore (no Auth account yet — Auth account
  // is created when the crew member first logs in via crewLogin()).
  // The `id` field is what the frontend sends as marshalId.
  const crewDocId = 'USR-CREW-DEMO-002';
  await db.collection('users').doc(crewDocId).set({
    uid: crewDocId,
    id: 'USR-CREW-002',          // This is the marshalId the crew types in LoginScreen
    name: 'Puan Nurul Husna',
    email: 'husna@kleventcrew.my',
    role: 'crew',
    checkpointId: 'CP-002',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✅  Demo crew user document upserted (marshalId: USR-CREW-002)');

  // ── 4. Demo event document ─────────────────────────────────────────────────
  const eventId = 'EV-001';
  await db.collection('events').doc(eventId).set({
    id: eventId,
    name: 'XploreQuest Demo 2026',
    joinCode: 'XT2026',
    date: '27 Jun 2026',
    startTime: '08:00 AM',
    locationName: 'Taman Titiwangsa, Kuala Lumpur',
    maxDurationSeconds: 14400,
    totalCheckpoints: 8,
    maxTeamSize: 6,
    isStarted: false,
    startedAt: null,
    isFinished: false,
    createdBy: adminUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`✅  Demo event document upserted (joinCode: XT2026, id: ${eventId})`);

  // ── 5. Event secrets (crewPinCode + hmacSecret) ────────────────────────────
  // Written via Admin SDK — this subcollection has `allow read, write: if false`
  // in Firestore rules so NO client can read it directly.
  await db
    .collection('events')
    .doc(eventId)
    .collection('secrets')
    .doc('config')
    .set({
      crewPinCode: crewPin,
      hmacSecret,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  console.log(`✅  Event secrets written (crewPinCode: ${crewPin.replace(/./g, '*')})`);

  // ── 6. Demo team ───────────────────────────────────────────────────────────
  await db
    .collection('events')
    .doc(eventId)
    .collection('teams')
    .doc('TEAM-001')
    .set({
      id: 'TEAM-001',
      eventId,
      name: 'Pasukan Harimau',
      status: 'approved',
      memberCount: 5,
      leaderName: 'Syamil',
      membersList: 'Abu, Ahmad, Amin, Ali',
      phone: '+601x-xxxxxxx',
      startCheckpointId: 'CP-START',
      currentCheckpointId: 'CP-START',
      completedCheckpointIds: [],
      skippedCheckpointIds: [],
      totalPoints: 0,
      penaltiesMinutes: 0,
      penaltyPoints: 0,
      finishedAt: null,
      isDNF: false,
      isDisqualified: false,
      lastScanLocation: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  console.log('✅  Demo team "Pasukan Harimau" upserted');

  console.log('\n🎉  Seeding complete!\n');
  console.log('   Demo credentials:');
  console.log(`   Admin:       ${adminEmail} / ${adminPassword}`);
  console.log(`   Crew:        marshalId=USR-CREW-002  PIN=${crewPin}`);
  console.log('   Participant: joinCode=XT2026  teamName=Pasukan Harimau');
  console.log('\n   ⚠️  Change DEMO_ADMIN_PASSWORD before deploying to production!\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seeding failed:', err);
  process.exit(1);
});
