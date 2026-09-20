/**
 * index.ts
 *
 * XploreQuest — Cloud Functions entry point.
 *
 * Architecture:
 *   • Express app handles all HTTP routing
 *   • Exported as a Firebase Functions 2nd-gen HTTPS callable
 *     (onRequest from firebase-functions/v2/https) pinned to asia-southeast1
 *   • All future routes are registered via sub-routers in their own handler files
 *
 * 2nd-gen benefits used in later stages:
 *   • onSchedule() for leaderboard recalculation / race timer jobs
 *   • Concurrency control (min/max instances)
 *   • Secrets Manager integration via runWith({ secrets: [...] })
 */

import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { authRouter } from './handlers/auth';
import { checkpointsRouter } from './handlers/checkpoints';
import { eventsRouter } from './handlers/events';
import { finishRouter } from './handlers/finish';
import { healthHandler } from './handlers/health';
import { leaderboardRouter } from './handlers/leaderboard';
import { preregistrationAdminRouter } from './handlers/preregistration_admin';
import { publicRouter } from './handlers/public';
import { qrRouter } from './handlers/qr';
import { rulesRouter } from './handlers/rules';
import { scanRouter } from './handlers/scan';
import { startRouter } from './handlers/start';
import { syncRouter } from './handlers/sync';
import { teamsRouter } from './handlers/teams';
import { usersRouter } from './handlers/users';
import { verificationRouter } from './handlers/verification';
import { sendAttendanceReminders } from './jobs/attendanceReminderJob';
import { purgeEphemeralGpsData } from './jobs/gpsPurgeJob';
import { evaluateRaceTimeouts } from './jobs/timeoutEvaluator';
import { verifyAppCheck } from './middleware/appCheck';
import { verifyFirebaseToken } from './middleware/auth';
import { errorHandler } from './utils/errors';

// ── Eagerly initialise Admin SDK on cold start ───────────────────────────────
// getAdminApp() is called on demand inside request handlers

// ── Express Application ──────────────────────────────────────────────────────
const app = express();

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Explicit CORS allowlist middleware
const ALLOWED_ORIGINS = [
  'https://xplorequest-cab6c.web.app',
  'https://xplorequest-cab6c.firebaseapp.com',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin && process.env['NODE_ENV'] !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Firebase App Check Bot/Script Protection Middleware
app.use(verifyAppCheck);

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check — public, no auth required
app.get('/health', healthHandler);

// Public unauthenticated Web Pre-Registration Form endpoints (direct & Firebase Hosting rewrite paths)
app.use('/public', publicRouter);
app.use('/api/public', publicRouter);

// Auth routes
app.use('/auth', authRouter);

// User push token registration & profile
app.use('/users', usersRouter);

// Team management & registration
app.use('/events', teamsRouter);

// Checkpoints & geofence boundary configuration
app.use('/events', checkpointsRouter);

// Staggered race start, cyclical assignment, and attendance check-in
app.use('/events', startRouter);

// Dynamic HMAC QR generation
app.use('/events', qrRouter);

// Multi-layer participant QR scan verification & skip logic
app.use('/events', scanRouter);

// Participant finish line gatekeeper
app.use('/events', finishRouter);

// Crew verification wizard (photo proof, manual override, penalty)
app.use('/events', verificationRouter);

// Offline sync queue batch ingestion engine (FR-06)
app.use('/events', syncRouter);

// Live leaderboard read path
app.use('/events', leaderboardRouter);

// Admin race rules configuration
app.use('/events', rulesRouter);

// Admin pre-registration review & approval
app.use('/events/:eventId/pre-registrations', preregistrationAdminRouter);

// Event management
app.use('/events', verifyFirebaseToken, eventsRouter);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist.',
    },
  });
});

// ── Global Error Handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

// ── Firebase Cloud Function Exports ──────────────────────────────────────────
export const api = onRequest(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  app
);

// Scheduled Cloud Functions
export { evaluateRaceTimeouts, purgeEphemeralGpsData, sendAttendanceReminders };
