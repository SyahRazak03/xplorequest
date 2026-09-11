/**
 * utils/errors.ts
 *
 * Centralised error handling utilities for XploreQuest Cloud Functions.
 *
 * Error response shape (always JSON):
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable description"
 *   }
 * }
 *
 * Success response shape:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": { ... }   // optional pagination / timestamp info
 * }
 */

import type { NextFunction, Request, Response } from 'express';

// ── Error Codes ───────────────────────────────────────────────────────────────

export enum ErrorCode {
  // 4xx
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // 5xx
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Domain-specific
  INVALID_JOIN_CODE = 'INVALID_JOIN_CODE',
  RACE_ALREADY_STARTED = 'RACE_ALREADY_STARTED',
  RACE_NOT_STARTED = 'RACE_NOT_STARTED',
  CHECKPOINT_ALREADY_COMPLETED = 'CHECKPOINT_ALREADY_COMPLETED',
  TEAM_REGISTRATION_CLOSED = 'TEAM_REGISTRATION_CLOSED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  REPLAY_ATTACK = 'REPLAY_ATTACK',
  WRONG_TEAM = 'WRONG_TEAM',
  OUT_OF_SEQUENCE = 'OUT_OF_SEQUENCE',
  OUT_OF_EVENT_BOUNDARY = 'OUT_OF_EVENT_BOUNDARY',
  OUT_OF_CHECKPOINT_RADIUS = 'OUT_OF_CHECKPOINT_RADIUS',
  SUSPECTED_SPOOFING = 'SUSPECTED_SPOOFING',
  INCOMPLETE_CHECKPOINTS = 'INCOMPLETE_CHECKPOINTS',
  SKIP_LIMIT_EXCEEDED = 'SKIP_LIMIT_EXCEEDED',
  CANNOT_SKIP_FINISH = 'CANNOT_SKIP_FINISH',
  ALREADY_SKIPPED = 'ALREADY_SKIPPED',
  RACE_ALREADY_FINISHED = 'RACE_ALREADY_FINISHED',
}

// ── HTTP Status Mapping ───────────────────────────────────────────────────────

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  // Domain codes → mapped to appropriate HTTP status
  [ErrorCode.INVALID_JOIN_CODE]: 400,
  [ErrorCode.RACE_ALREADY_STARTED]: 409,
  [ErrorCode.RACE_NOT_STARTED]: 409,
  [ErrorCode.CHECKPOINT_ALREADY_COMPLETED]: 409,
  [ErrorCode.TEAM_REGISTRATION_CLOSED]: 403,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 422,
  [ErrorCode.INVALID_PAYLOAD]: 400,
  [ErrorCode.INVALID_SIGNATURE]: 400,
  [ErrorCode.REPLAY_ATTACK]: 409,
  [ErrorCode.WRONG_TEAM]: 403,
  [ErrorCode.OUT_OF_SEQUENCE]: 422,
  [ErrorCode.OUT_OF_EVENT_BOUNDARY]: 422,
  [ErrorCode.OUT_OF_CHECKPOINT_RADIUS]: 422,
  [ErrorCode.SUSPECTED_SPOOFING]: 422,
  [ErrorCode.INCOMPLETE_CHECKPOINTS]: 422,
  [ErrorCode.SKIP_LIMIT_EXCEEDED]: 422,
  [ErrorCode.CANNOT_SKIP_FINISH]: 400,
  [ErrorCode.ALREADY_SKIPPED]: 409,
  [ErrorCode.RACE_ALREADY_FINISHED]: 409,
};

// ── AppError Class ────────────────────────────────────────────────────────────

/**
 * Structured application error that maps cleanly to HTTP responses.
 * Throw this anywhere in handlers/services/repositories; the global
 * `errorHandler` middleware will catch it and format the JSON response.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    /** Pass false for programmer errors that should alert on-call */
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = HTTP_STATUS_MAP[code] ?? 500;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ── Response Shapes ───────────────────────────────────────────────────────────

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

// ── Response Helpers ──────────────────────────────────────────────────────────

/**
 * Sends a standardised success JSON response.
 *
 * @example
 * sendSuccess(res, { teamId: 'TEAM-001' }, 201);
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  const body: SuccessResponse<T> = { success: true, data };
  if (meta) {
    body.meta = meta;
  }
  res.status(statusCode).json(body);
}

/**
 * Sends a standardised error JSON response directly (use sparingly —
 * prefer throwing AppError and letting the middleware handle it).
 */
export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode?: number,
  details?: unknown
): void {
  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  res.status(statusCode ?? (HTTP_STATUS_MAP[code] ?? 500)).json(body);
}

// ── Global Express Error Handler Middleware ───────────────────────────────────

/**
 * Attach as the LAST middleware in the Express app:
 *   app.use(errorHandler);
 *
 * Catches both AppError instances and unexpected errors, normalising
 * them to the consistent { success, error } JSON shape.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    // Operational errors — expected, log at info level
    console.info(`[AppError] ${err.code}: ${err.message}`);

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    } satisfies ErrorResponse);
    return;
  }

  // Unexpected / programmer errors — log full stack
  console.error('[UnhandledError]', err);

  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      // Never expose internal error details to the client in production
      message:
        process.env['NODE_ENV'] === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : (err.message ?? 'Internal server error'),
    },
  } satisfies ErrorResponse);
}

// ── Async Handler Wrapper ─────────────────────────────────────────────────────

/**
 * Wraps an async Express route handler to automatically forward
 * thrown errors to the next() error middleware, eliminating
 * try/catch boilerplate in every handler.
 *
 * @example
 * router.get('/events', asyncHandler(async (req, res) => {
 *   const events = await eventService.list();
 *   sendSuccess(res, events);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next): void => {
    fn(req, res, next).catch(next);
  };
}
