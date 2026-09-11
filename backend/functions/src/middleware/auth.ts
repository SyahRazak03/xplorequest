/**
 * middleware/auth.ts
 *
 * Firebase Auth verification middleware and RBAC role guards.
 *
 * Stage 1: Structure and type signatures only — full implementation
 *           in Stage 2 when Auth custom claims are set up.
 *
 * Usage (Stage 2+):
 *   router.post('/events', verifyFirebaseToken, requireRole('admin'), handler)
 *   router.post('/checkpoints/:id/complete', verifyFirebaseToken, requireRole('crew', 'admin'), handler)
 */

import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../config/firebase';
import type { UserRole } from '../models';
import { AppError, ErrorCode } from '../utils/errors';

// ── Type Augmentation ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Decoded Firebase Auth token — populated by verifyFirebaseToken middleware.
       * Guaranteed to be present on routes that use verifyFirebaseToken.
       */
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  /** Firebase Auth UID */
  uid: string;
  email?: string;
  name?: string;
  /** Custom claim set by admin during registration/role-assignment */
  role?: UserRole;
  /** Event the user is scoped to (custom claim) */
  eventId?: string;
  /** Team the user belongs to (participant custom claim) */
  teamId?: string;
  /** Checkpoint assigned to crew (crew custom claim) */
  checkpointId?: string;
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Verifies the Firebase ID token supplied in the Authorization header.
 *
 * Expects:  Authorization: Bearer <firebase-id-token>
 *
 * On success: attaches decoded token to req.user and calls next().
 * On failure: responds with 401 UNAUTHORIZED.
 *
 * Stage 2 will add App Check enforcement here.
 */
export async function verifyFirebaseToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    next(
      new AppError(ErrorCode.UNAUTHORIZED, 'Missing or malformed Authorization header.')
    );
    return;
  }

  const idToken = authHeader.slice(7); // Strip "Bearer "

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, /* checkRevoked */ true);

    req.user = {
      uid: decoded['uid'],
      email: decoded['email'],
      name: decoded['name'] as string | undefined,
      role: decoded['role'] as UserRole | undefined,
      eventId: decoded['eventId'] as string | undefined,
      teamId: decoded['teamId'] as string | undefined,
      checkpointId: decoded['checkpointId'] as string | undefined,
    };

    next();
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };

    if (firebaseErr.code === 'auth/id-token-expired') {
      next(new AppError(ErrorCode.TOKEN_EXPIRED, 'Firebase ID token has expired.'));
    } else if (firebaseErr.code === 'auth/id-token-revoked') {
      next(new AppError(ErrorCode.INVALID_TOKEN, 'Firebase ID token has been revoked.'));
    } else {
      next(new AppError(ErrorCode.UNAUTHORIZED, 'Invalid Firebase ID token.'));
    }
  }
}

/**
 * Role-based access control guard factory.
 * Must be used AFTER verifyFirebaseToken (depends on req.user).
 *
 * @param allowedRoles - One or more roles permitted to access the route.
 *
 * @example
 * router.delete('/events/:id', verifyFirebaseToken, requireRole('admin'), handler)
 * router.post('/complete', verifyFirebaseToken, requireRole('crew', 'admin'), handler)
 */
export function requireRole(
  ...allowedRoles: UserRole[]
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      next(
        new AppError(
          ErrorCode.FORBIDDEN,
          'No role assigned. Contact an administrator.'
        )
      );
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      next(
        new AppError(
          ErrorCode.FORBIDDEN,
          `Access denied. Required role(s): ${allowedRoles.join(', ')}.`
        )
      );
      return;
    }

    next();
  };
}
