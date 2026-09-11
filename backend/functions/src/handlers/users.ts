/**
 * handlers/users.ts
 *
 * Express router for user profile and device push token registration endpoints.
 *
 * Routes:
 *   POST /users/me/push-token — register Expo push token for current authenticated user
 */

import type { Request } from 'express';
import { Router } from 'express';

import { verifyFirebaseToken } from '../middleware/auth';
import { registerPushToken } from '../services/notification.service';
import { AppError, ErrorCode, asyncHandler, sendSuccess } from '../utils/errors';
import { RegisterPushTokenSchema, validateBody } from '../validation';

export const usersRouter = Router();

function requireUid(req: Request): string {
  const uid = req.user?.uid;
  if (!uid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
  }
  return uid;
}

// Require Firebase Auth token for all user endpoints
usersRouter.use(verifyFirebaseToken);

/**
 * POST /users/me/push-token
 *
 * Registers the device's Expo push token on the user's document in Firestore.
 */
usersRouter.post(
  '/me/push-token',
  validateBody(RegisterPushTokenSchema),
  asyncHandler(async (req, res) => {
    const callerUid = requireUid(req);
    const { pushToken } = req.body as { pushToken: string };

    await registerPushToken(callerUid, pushToken);

    sendSuccess(res, { message: 'Token pemberitahuan berjaya didaftarkan.' });
  })
);
