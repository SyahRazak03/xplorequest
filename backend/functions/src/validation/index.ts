/**
 * validation/index.ts
 *
 * Zod validation schemas for XploreQuest API payloads.
 *
 * Stage 4: Full schemas with refinements, field-level error messages,
 *           and a working validateBody() middleware.
 *
 * Usage:
 *   router.post('/events', validateBody(CreateEventSchema), handler)
 */

import type { NextFunction, Request, Response } from 'express';
import { Expo } from 'expo-server-sdk';
import { z } from 'zod';

import { AppError, ErrorCode } from '../utils/errors';

// ── PUSH NOTIFICATION SCHEMAS (FR-15) ──────────────────────────────────────────

export const RegisterPushTokenSchema = z.object({
  pushToken: z
    .string({ required_error: 'Push notification token (pushToken) is required.' })
    .min(1, 'Push notification token (pushToken) cannot be empty.')
    .refine((val) => Expo.isExpoPushToken(val), {
      message: 'Invalid Expo push token format. Token must be in ExponentPushToken[...] format.',
    }),
});

export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;

// ── Reusable Field Schemas ────────────────────────────────────────────────────

export const UserRoleSchema = z.enum(['participant', 'crew', 'admin']);

export const CheckpointStatusSchema = z.enum([
  'locked',
  'active',
  'pending',
  'completed',
]);

export const TeamStatusSchema = z.enum(['pending', 'approved', 'rejected']);

// ── Join Code ─────────────────────────────────────────────────────────────────

/**
 * 4–10 uppercase alphanumeric characters.
 * Auto-generated as 6 chars when omitted on POST /events.
 * Must match what participantJoin() in auth.service.ts queries: toUpperCase().
 */
const joinCodeField = z
  .string()
  .min(4, 'Join code must be at least 4 characters.')
  .max(10, 'Join code cannot exceed 10 characters.')
  .regex(/^[A-Z0-9]+$/, 'Join code can only contain uppercase letters and numbers.')
  .transform((v) => v.toUpperCase());

// ── Event Schemas ─────────────────────────────────────────────────────────────

/**
 * Full creation payload expected from AdminCreateEventScreen.
 *
 * Bounds rationale:
 *   maxDurationSeconds: 60s minimum (sane lower bound) — 86 400s (24 h) maximum
 *   totalCheckpoints:   1–50 (matches UI constraint comment in PRD)
 *   maxTeamSize:        2–6  (matches AdminCreateEventScreen stepper limits)
 */
export const CreateEventSchema = z.object({
  name: z
    .string()
    .min(2, 'Event name must be at least 2 characters.')
    .max(120, 'Event name cannot exceed 120 characters.')
    .trim(),

  joinCode: joinCodeField.optional(),

  date: z
    .string()
    .min(3, 'Invalid event date.')
    .max(50, 'Event date is too long.')
    .trim(),

  startTime: z
    .string()
    .min(1, 'Invalid start time.')
    .max(20, 'Start time is too long.')
    .trim()
    .optional(),

  maxDurationSeconds: z
    .number({ invalid_type_error: 'maxDurationSeconds must be a number.' })
    .int('maxDurationSeconds must be an integer.')
    .min(60, 'Time limit must be at least 60 seconds.')
    .max(86400, 'Time limit cannot exceed 86,400 seconds (24 hours).'),

  locationName: z
    .string()
    .min(2, 'Location name must be at least 2 characters.')
    .max(200, 'Location name cannot exceed 200 characters.')
    .trim(),

  totalCheckpoints: z
    .number({ invalid_type_error: 'totalCheckpoints must be a number.' })
    .int('totalCheckpoints must be an integer.')
    .min(1, 'Event must have at least 1 checkpoint.')
    .max(50, 'Event cannot have more than 50 checkpoints.'),

  maxTeamSize: z
    .number({ invalid_type_error: 'maxTeamSize must be a number.' })
    .int('maxTeamSize must be an integer.')
    .min(2, 'Minimum team size is 2 members.')
    .max(6, 'Maximum team size is 6 members.')
    .optional()
    .default(4),

  urlSlug: z
    .string()
    .min(2, 'URL slug must be at least 2 characters.')
    .max(100, 'URL slug cannot exceed 100 characters.')
    .regex(/^[a-z0-9-]+$/, 'URL slug can only contain lowercase letters, numbers, and hyphens (-).')
    .optional(),

  entryFee: z
    .number({ invalid_type_error: 'Entry fee must be a number.' })
    .min(0, 'Entry fee cannot be negative.')
    .optional()
    .default(0),

  paymentBankDetails: z
    .string()
    .max(1000, 'Bank details cannot exceed 1000 characters.')
    .optional()
    .default(''),

  paymentQrImageUrl: z.string().nullable().optional(),

  bannerImageUrl: z.string().nullable().optional(),

  paymentDetails: z.lazy(() => PaymentDetailsSchema).nullable().optional(),
});

// ── Payment Details Schemas (Feature 4C) ──────────────────────────────────────

export const PaymentDetailsSchema = z.object({
  bankName: z
    .string()
    .max(100, 'Bank name cannot exceed 100 characters.')
    .trim()
    .optional()
    .default(''),
  accountHolderName: z
    .string()
    .max(100, 'Account holder name cannot exceed 100 characters.')
    .trim()
    .optional()
    .default(''),
  accountNumber: z
    .string()
    .max(50, 'Account number cannot exceed 50 characters.')
    .regex(/^[0-9\-\s]*$/, 'Account number can only contain numbers, hyphens, and spaces.')
    .trim()
    .optional()
    .default(''),
  note: z
    .string()
    .max(500, 'Note cannot exceed 500 characters.')
    .trim()
    .optional()
    .default(''),
});

export const UpdatePaymentDetailsSchema = z.object({
  paymentDetails: PaymentDetailsSchema,
});

/**
 * PATCH payload — every field is optional.
 * maxDurationSeconds and totalCheckpoints can be sent but will be rejected
 * at the service layer if isStarted === true (race integrity guard).
 */
export const UpdateEventSchema = CreateEventSchema.partial();

export const CreateTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required.')
    .max(100, 'Team name cannot exceed 100 characters.')
    .trim(),
  leaderName: z.string().max(100, 'Leader name cannot exceed 100 characters.').trim().optional(),
  membersList: z.string().max(500, 'Members list cannot exceed 500 characters.').trim().optional(),
  phone: z
    .string()
    .max(20, 'Phone number cannot exceed 20 characters.')
    .regex(/^[0-9+\-\s()]*$/, 'Invalid phone number.')
    .optional(),
  memberCount: z
    .number({ invalid_type_error: 'memberCount must be a number.' })
    .int('memberCount must be an integer.')
    .min(1, 'Member count must be at least 1.')
    .max(6, 'Member count cannot exceed 6.'),
  joinCode: z.string().min(4, 'Invalid join code.').max(10).optional(),
});

export const UpdateTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required.')
    .max(100, 'Team name cannot exceed 100 characters.')
    .trim()
    .optional(),
  leaderName: z.string().max(100, 'Leader name cannot exceed 100 characters.').trim().optional(),
  membersList: z.string().max(500, 'Members list cannot exceed 500 characters.').trim().optional(),
  phone: z
    .string()
    .max(20, 'Phone number cannot exceed 20 characters.')
    .regex(/^[0-9+\-\s()]*$/, 'Invalid phone number.')
    .optional(),
  memberCount: z
    .number({ invalid_type_error: 'memberCount must be a number.' })
    .int('memberCount must be an integer.')
    .min(1, 'Member count must be at least 1.')
    .max(6, 'Member count cannot exceed 6.')
    .optional(),
});

export const TeamStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: "Status must be 'pending', 'approved', or 'rejected'." }),
  }),
});

export const BoundaryVertexSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const SaveBoundarySchema = z.object({
  boundary: z
    .array(BoundaryVertexSchema)
    .min(3, 'Boundary polygon requires at least 3 vertices.'),
});

export const CreateCheckpointSchema = z.object({
  name: z
    .string()
    .min(1, 'Checkpoint name is required.')
    .max(120, 'Checkpoint name cannot exceed 120 characters.')
    .trim(),
  latitude: z.number().min(-90, 'Invalid latitude.').max(90, 'Invalid latitude.'),
  longitude: z.number().min(-180, 'Invalid longitude.').max(180, 'Invalid longitude.'),
  clueText: z.string().min(1, 'Clue text is required.').max(1000, 'Clue text cannot exceed 1000 characters.').trim(),
  taskDescription: z.string().min(1, 'Task description is required.').max(2000, 'Task description cannot exceed 2000 characters.').trim(),
  scorePoints: z
    .number({ invalid_type_error: 'scorePoints must be a number.' })
    .int('scorePoints must be an integer.')
    .nonnegative('Score points cannot be negative.')
    .max(10000, 'Maximum score points is 10,000.')
    .optional()
    .default(100),
  geofenceRadiusMeters: z
    .number({ invalid_type_error: 'geofenceRadiusMeters must be a number.' })
    .int('geofenceRadiusMeters must be an integer.')
    .min(10, 'Geofence radius must be at least 10 meters.')
    .max(150, 'Geofence radius cannot exceed 150 meters.')
    .optional()
    .default(50),
  isStart: z.boolean().optional().default(false),
  isFinish: z.boolean().optional().default(false),
  isAttendanceStation: z.boolean().optional().default(false),
  isHiddenInMap: z.boolean().optional().default(false),
  orderIndex: z.number().int().optional(),
});

export const UpdateCheckpointSchema = CreateCheckpointSchema.partial();

export const ReorderCheckpointsSchema = z.object({
  checkpointIds: z
    .array(z.string().min(1, 'Invalid checkpoint ID.'))
    .min(1, 'At least one checkpoint ID is required.'),
});

export const AttendanceCheckinSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required.').trim(),
  note: z.string().max(200, 'Note cannot exceed 200 characters.').optional(),
});

export const StartRaceSchema = z.object({
  forceStart: z.boolean().optional().default(false),
});

export const LateAssignSchema = z.object({
  preferredCheckpointId: z.string().optional(),
  note: z.string().max(200, 'Note cannot exceed 200 characters.').optional(),
});

export const ALLOWED_QR_TTL_SECONDS = [10, 15, 30, 45, 60, 120] as const;

export const GenerateCheckpointQrSchema = z.object({
  teamId: z.string().min(1).max(50).trim().optional().default('*'),
  forceRefresh: z.boolean().optional().default(false),
  ttlSeconds: z
    .number()
    .int()
    .refine((val) => (ALLOWED_QR_TTL_SECONDS as readonly number[]).includes(val), {
      message: 'TTL must be one of: 10, 15, 30, 45, 60, or 120 seconds.',
    })
    .optional()
    .default(30),
});

export const GenerateAttendanceQrSchema = z.object({
  teamId: z.string().min(1).max(50).trim().optional().default('*'),
  forceRefresh: z.boolean().optional().default(false),
});

export const ScanCheckpointQrSchema = z.object({
  payload: z.string().min(1, 'QR code payload is required.').trim(),
  latitude: z.number().min(-90, 'Invalid latitude.').max(90, 'Invalid latitude.'),
  longitude: z.number().min(-180, 'Invalid longitude.').max(180, 'Invalid longitude.'),
  accuracy: z.number().optional(),
});

export const SkipCheckpointSchema = z.object({
  reason: z.string().max(250, 'Skip reason cannot exceed 250 characters.').trim().optional(),
});

export const FinishRaceScanSchema = z.object({
  payload: z.string().min(1, 'Finish QR code payload is required.').trim(),
  latitude: z.number().min(-90, 'Invalid latitude.').max(90, 'Invalid latitude.'),
  longitude: z.number().min(-180, 'Invalid longitude.').max(180, 'Invalid longitude.'),
  accuracy: z.number().optional(),
});

export const UploadPhotoProofSchema = z.object({
  imageBase64: z.string().min(1, 'Base64 image data is required.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Image format must be image/jpeg, image/png, or image/webp.' }),
  }),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const UploadEventAssetSchema = z.object({
  assetType: z.enum(['banner', 'payment_qr'], {
    errorMap: () => ({ message: "Asset type must be 'banner' or 'payment_qr'." }),
  }),
  imageBase64: z.string().min(1, 'Base64 image data is required.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Image format must be image/jpeg, image/png, or image/webp.' }),
  }),
});

export const ManualOverrideSchema = z.object({
  reason: z.string().min(5, 'Manual release reason must be at least 5 characters.').max(250).trim(),
  crewLatitude: z.number().min(-90).max(90).optional(),
  crewLongitude: z.number().min(-180).max(180).optional(),
  skipGeofenceReason: z.string().max(250).trim().optional(),
  pointsAwarded: z.number().int().min(0).max(500).optional(),
});

export const ApplyPenaltySchema = z.object({
  penaltyType: z.enum(['points', 'time', 'both']),
  pointPenalty: z.number().int().min(0).max(1000).optional().default(0),
  timePenaltyMinutes: z.number().int().min(0).max(240).optional().default(0),
  reason: z.string().min(5, 'Penalty reason must be at least 5 characters.').max(250).trim(),
  checkpointId: z.string().max(50).trim().optional(),
});

export const UpdateRaceRulesSchema = z.object({
  maxRaceTime: z.number().int('Race duration must be an integer.').min(60, 'Race duration must be at least 60 seconds.').max(86400).optional(),
  taskTimeLimit: z.number().int('Task time limit must be an integer.').min(30, 'Task time limit must be at least 30 seconds.').max(7200).optional(),
  latePenaltyMin: z.number().int().min(0, 'Time penalty cannot be negative.').max(240).optional(),
  pointPenaltyPts: z.number().int().min(0, 'Point penalty cannot be negative.').max(1000).optional(),
  bonusPoints: z.number().int().min(0, 'Bonus points cannot be negative.').max(1000).optional(),
  pointsSystemEnabled: z.boolean().optional(),
  latePenaltyEnabled: z.boolean().optional(),
  taskTimeLimitEnabled: z.boolean().optional(),
  pointPenaltyEnabled: z.boolean().optional(),
  bonusPointsEnabled: z.boolean().optional(),
  maxVelocityKmh: z.number().min(5, 'Minimum velocity limit is 5 km/h.').max(150, 'Maximum velocity limit is 150 km/h.').optional(),
  maxSkipsPerTeam: z.number().int().min(0).max(10).optional(),
  latePenaltyPerMinute: z.number().min(0).max(100).optional(),
});

export const RegisterUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email('Invalid email address.').max(254),
  password: z.string().min(6, 'Password is too short.').max(128),
  role: UserRoleSchema,
});

export const JoinEventSchema = z.object({
  joinCode: joinCodeField,
});

export const SyncQueueItemSchema = z.object({
  idempotencyKey: z
    .string()
    .min(8, 'Idempotency key must be at least 8 characters.')
    .max(128, 'Idempotency key cannot exceed 128 characters.')
    .trim(),
  operation: z.enum([
    'checkpoint_scan',
    'checkpoint_skip',
    'photo_proof',
    'manual_override',
    'apply_penalty',
    'finish_scan',
  ], {
    errorMap: () => ({ message: 'Invalid sync operation.' }),
  }),
  clientTimestamp: z.string().datetime({ message: 'Invalid client timestamp.' }),
  checkpointId: z.string().max(50).optional(),
  teamId: z.string().max(50).optional(),
  payload: z.record(z.unknown()).optional().default({}),
});

export const BatchSyncSchema = z.object({
  items: z
    .array(SyncQueueItemSchema)
    .min(1, 'At least one queue item is required.')
    .max(100, 'Maximum 100 items allowed per sync batch.'),
});

// ── Web Pre-Registration Schemas (Feature 4B) ─────────────────────────────────

export const MalaysianPhoneSchema = z
  .string({ required_error: 'Leader WhatsApp number is required.' })
  .trim()
  .regex(/^(\+?60|0)1[0-46-9][0-9]{7,8}$/, 'WhatsApp number must be a valid Malaysian phone number (e.g. 0123456789 or +60123456789).');

export const PreRegisterSchema = z.object({
  teamName: z
    .string({ required_error: 'Team name is required.' })
    .min(1, 'Team name cannot be empty.')
    .max(100, 'Team name cannot exceed 100 characters.')
    .trim(),
  leaderName: z
    .string({ required_error: 'Team leader name is required.' })
    .min(1, 'Team leader name cannot be empty.')
    .max(100, 'Team leader name cannot exceed 100 characters.')
    .trim(),
  leaderWhatsApp: MalaysianPhoneSchema,
  memberNames: z
    .array(
      z
        .string()
        .min(1, 'Member name cannot be empty.')
        .max(100, 'Member name cannot exceed 100 characters.')
        .trim()
    )
    .max(5, 'Total additional members cannot exceed 5.'),
  imageBase64: z.string({ required_error: 'Payment receipt is required.' }).min(1, 'Payment receipt cannot be empty.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Receipt format must be image/jpeg, image/png, or image/webp.' }),
  }),
});

// ── Inferred Types ────────────────────────────────────────────────────────────

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;
export type TeamStatusUpdateInput = z.infer<typeof TeamStatusUpdateSchema>;
export type SaveBoundaryInput = z.infer<typeof SaveBoundarySchema>;
export type CreateCheckpointInput = z.infer<typeof CreateCheckpointSchema>;
export type UpdateCheckpointInput = z.infer<typeof UpdateCheckpointSchema>;
export type ReorderCheckpointsInput = z.infer<typeof ReorderCheckpointsSchema>;
export type AttendanceCheckinInput = z.infer<typeof AttendanceCheckinSchema>;
export type StartRaceInput = z.infer<typeof StartRaceSchema>;
export type LateAssignInput = z.infer<typeof LateAssignSchema>;
export type GenerateCheckpointQrInput = z.infer<typeof GenerateCheckpointQrSchema>;
export type GenerateAttendanceQrInput = z.infer<typeof GenerateAttendanceQrSchema>;
export type ScanCheckpointQrInput = z.infer<typeof ScanCheckpointQrSchema>;
export type SkipCheckpointInput = z.infer<typeof SkipCheckpointSchema>;
export type FinishRaceScanInput = z.infer<typeof FinishRaceScanSchema>;
export type UploadPhotoProofInput = z.infer<typeof UploadPhotoProofSchema>;
export type UploadEventAssetInput = z.infer<typeof UploadEventAssetSchema>;
export type ManualOverrideInput = z.infer<typeof ManualOverrideSchema>;
export type ApplyPenaltyInput = z.infer<typeof ApplyPenaltySchema>;
export type UpdateRaceRulesInput = z.infer<typeof UpdateRaceRulesSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type JoinEventInput = z.infer<typeof JoinEventSchema>;
export type SyncQueueItemInput = z.infer<typeof SyncQueueItemSchema>;
export type BatchSyncInput = z.infer<typeof BatchSyncSchema>;
export type PreRegisterInput = z.infer<typeof PreRegisterSchema>;
export type UpdatePaymentDetailsInput = z.infer<typeof UpdatePaymentDetailsSchema>;

// ── Validation Middleware Factory ─────────────────────────────────────────────

/**
 * Express middleware factory that validates req.body against a Zod schema.
 *
 * On success  → calls next(), req.body is replaced with the parsed (and
 *               transformed) value so handlers receive clean data.
 * On failure  → throws AppError(UNPROCESSABLE_ENTITY, 422) with a
 *               structured { field, message } array embedded in the message.
 *
 * @example
 * router.post('/events', validateBody(CreateEventSchema), createEventHandler)
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Collapse ZodError into a readable first message for the client
      const firstError = result.error.errors[0];
      const fieldPath = firstError?.path.join('.') ?? 'body';
      const message = firstError?.message ?? 'Invalid input.';

      next(
        new AppError(
          ErrorCode.UNPROCESSABLE_ENTITY,
          `[${fieldPath}] ${message}`
        )
      );
      return;
    }

    // Replace req.body with the sanitised, coerced value
    req.body = result.data as unknown;
    next();
  };
}
