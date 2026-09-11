/**
 * middleware/rateLimiter.ts
 *
 * Firestore-backed token-bucket rate limiter.
 *
 * Design:
 *   - Bucket key: SHA-256(ip + ":" + identifier)
 *     → never stores raw IP or marshal IDs in Firestore
 *   - Rolling window: MAX_ATTEMPTS per WINDOW_SECONDS
 *   - Lockout: LOCKOUT_SECONDS after MAX_ATTEMPTS failures
 *   - Atomic counter update via Firestore transaction
 *
 * Usage:
 *   router.post('/auth/crew/login',
 *     rateLimiter({ identifier: (req) => req.body.marshalId }),
 *     handler
 *   )
 */

import * as crypto from 'crypto';

import type { NextFunction, Request, Response } from 'express';

import { getFirestore } from '../config/firebase';
import { AppError, ErrorCode } from '../utils/errors';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900;   // 15-minute rolling window
const LOCKOUT_SECONDS = 1800; // 30-minute lockout after MAX_ATTEMPTS failures
const COLLECTION = 'rateLimits';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  windowStart: FirebaseFirestore.Timestamp;
  blockedUntil: FirebaseFirestore.Timestamp | null;
}

interface RateLimiterOptions {
  /**
   * Extracts a per-user identifier from the request (e.g. marshalId, email).
   * Combined with IP to build the bucket key — never stored raw.
   */
  identifier: (req: Request) => string;
}

// ── Middleware factory ────────────────────────────────────────────────────────

export function rateLimiter(options: RateLimiterOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const db = getFirestore();
    const now = Date.now();

    // Build a hashed, opaque bucket key — no raw data stored in Firestore
    const ip = (
      req.headers['x-forwarded-for'] as string | undefined ??
      req.socket.remoteAddress ??
      'unknown'
    ).split(',')[0].trim();

    const id = options.identifier(req);
    const rawKey = `${ip}:${id}`;
    const bucketId = crypto.createHash('sha256').update(rawKey).digest('hex');
    const docRef = db.collection(COLLECTION).doc(bucketId);

    try {
      const blocked = await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const admin = await import('firebase-admin');
        const Timestamp = admin.firestore.Timestamp;

        if (!snap.exists) {
          // First request — initialise bucket
          const bucket: RateLimitBucket = {
            count: 1,
            windowStart: Timestamp.fromMillis(now),
            blockedUntil: null,
          };
          tx.set(docRef, bucket);
          return false;
        }

        const data = snap.data() as RateLimitBucket;

        // Check active lockout
        if (data.blockedUntil !== null) {
          const unblockMs = data.blockedUntil.toMillis();
          if (now < unblockMs) {
            return true; // still locked out
          }
          // Lockout expired — reset bucket
          tx.set(docRef, {
            count: 1,
            windowStart: Timestamp.fromMillis(now),
            blockedUntil: null,
          });
          return false;
        }

        const windowStartMs = data.windowStart.toMillis();
        const windowExpiredMs = windowStartMs + WINDOW_SECONDS * 1000;

        if (now > windowExpiredMs) {
          // Window expired — reset counter
          tx.update(docRef, {
            count: 1,
            windowStart: Timestamp.fromMillis(now),
          });
          return false;
        }

        const newCount = data.count + 1;

        if (newCount > MAX_ATTEMPTS) {
          // Exceeded — apply lockout
          tx.update(docRef, {
            count: newCount,
            blockedUntil: Timestamp.fromMillis(now + LOCKOUT_SECONDS * 1000),
          });
          return true;
        }

        tx.update(docRef, { count: newCount });
        return false;
      });

      if (blocked) {
        next(
          new AppError(
            ErrorCode.TOO_MANY_REQUESTS,
            'Terlalu banyak percubaan. Sila cuba lagi dalam 30 minit.'
          )
        );
        return;
      }

      next();
    } catch (err) {
      // On rate-limiter failure, fail open — log and allow the request
      // so a Firestore blip doesn't lock out legitimate users.
      console.error('[rateLimiter] Firestore error — failing open:', err);
      next();
    }
  };
}

/**
 * Resets the rate-limit bucket for a given identifier.
 * Call after a SUCCESSFUL login to clear the counter.
 */
export async function clearRateLimit(ip: string, identifier: string): Promise<void> {
  const db = getFirestore();
  const rawKey = `${ip}:${identifier}`;
  const bucketId = crypto.createHash('sha256').update(rawKey).digest('hex');
  try {
    await db.collection(COLLECTION).doc(bucketId).delete();
  } catch {
    // Ignore — bucket may not exist
  }
}
