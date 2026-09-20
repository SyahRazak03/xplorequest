/**
 * config/firebase.ts
 *
 * Firebase Admin SDK — lazy singleton initialisation.
 *
 * Initialisation strategy:
 *   1. Inside Firebase emulator  → ADC kicks in automatically via env vars
 *      set by `firebase emulators:start`; no explicit credential needed.
 *   2. Local dev (no emulator)   → loads service account from
 *      FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64.
 *   3. Production (GCP / Cloud Run) → Application Default Credentials (ADC)
 *      picked up automatically; no credential config required.
 *
 * NEVER pass hardcoded credentials here.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as admin from 'firebase-admin';

// ── Singleton guard ──────────────────────────────────────────────────────────
let _app: admin.app.App | undefined;

/**
 * Returns the initialised Firebase Admin app singleton.
 * Safe to call multiple times — only initialises once.
 */
export function getAdminApp(): admin.app.App {
  if (_app) {
    return _app;
  }

  if (admin.apps.length > 0) {
    _app = admin.apps[0] as admin.app.App;
    return _app;
  }

  const credential = resolveCredential();
  const projectId = process.env['XQ_PROJECT_ID'] || process.env['GCLOUD_PROJECT'] || 'xplorequest-cab6c';
  const storageBucket = process.env['XQ_STORAGE_BUCKET'] || process.env['STORAGE_BUCKET_NAME'] || `${projectId}.firebasestorage.app`;

  _app = admin.initializeApp({
    projectId,
    storageBucket,
    credential,
  });
  return _app;
}

// ── Service accessors ────────────────────────────────────────────────────────

/** Pre-initialised Firestore instance */
export function getFirestore(): admin.firestore.Firestore {
  return getAdminApp().firestore();
}

/** Pre-initialised Auth instance */
export function getAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

/** Pre-initialised Storage instance */
export function getStorage(): admin.storage.Storage {
  return getAdminApp().storage();
}

/** Pre-initialised Storage Bucket instance with guaranteed fallback bucket name */
export function getStorageBucket(): ReturnType<admin.storage.Storage['bucket']> {
  const projectId = process.env['XQ_PROJECT_ID'] || process.env['GCLOUD_PROJECT'] || 'xplorequest-cab6c';
  const bucketName = process.env['XQ_STORAGE_BUCKET'] || process.env['STORAGE_BUCKET_NAME'] || `${projectId}.firebasestorage.app`;
  return getAdminApp().storage().bucket(bucketName);
}

// ── Typed environment config ─────────────────────────────────────────────────

export interface AppConfig {
  /** Firebase project ID */
  projectId: string;
  /** Cloud Functions + Firestore region */
  region: string;
  /** Application version (from APP_VERSION env var) */
  version: string;
  /** Runtime environment */
  nodeEnv: 'development' | 'production' | 'test';
  /** HMAC signing secret */
  hmacSecret: string;
  /** Session cookie max-age in milliseconds */
  sessionMaxAgeMs: number;
}

/**
 * Returns validated application configuration from environment variables.
 * Throws at startup if any required variable is missing in production.
 */
export function getConfig(): AppConfig {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as AppConfig['nodeEnv'];

  const required = (key: string): string => {
    const val = process.env[key];
    if (!val && nodeEnv === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return val ?? '';
  };

  return {
    projectId: process.env['XQ_PROJECT_ID'] || process.env['GCLOUD_PROJECT'] || process.env['FIREBASE_PROJECT_ID'] || 'xplorequest-cab6c',
    region: process.env['XQ_REGION'] ?? process.env['FIREBASE_REGION'] ?? 'asia-southeast1',
    version: process.env['APP_VERSION'] ?? '1.0.0',
    nodeEnv,
    hmacSecret: required('HMAC_SECRET'),
    sessionMaxAgeMs: parseInt(
      process.env['SESSION_COOKIE_MAX_AGE_MS'] ?? '604800000',
      10
    ),
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolves the Admin SDK credential from environment context.
 * Priority: base64 env var → file path env var → ADC (default).
 */
function resolveCredential(): admin.credential.Credential {
  // Option A: Base64-encoded service account JSON (CI/CD friendly)
  const b64 = process.env['SERVICE_ACCOUNT_BASE64'] ?? process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(json) as admin.ServiceAccount;
    return admin.credential.cert(serviceAccount);
  }

  // Option B: Path to service account JSON file
  const filePath = process.env['SERVICE_ACCOUNT_PATH'] ?? process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolved)) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_PATH points to a non-existent file: ${resolved}`
      );
    }
    const serviceAccount = JSON.parse(
      fs.readFileSync(resolved, 'utf-8')
    ) as admin.ServiceAccount;
    return admin.credential.cert(serviceAccount);
  }

  // Option C: Application Default Credentials (emulator / GCP / Cloud Run)
  return admin.credential.applicationDefault();
}
