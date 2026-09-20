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
    .string({ required_error: 'Token pemberitahuan (pushToken) diperlukan.' })
    .min(1, 'Token pemberitahuan (pushToken) tidak boleh kosong.')
    .refine((val) => Expo.isExpoPushToken(val), {
      message: 'Format Expo push token tidak sah. Token mesti dalam format ExponentPushToken[...].',
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
  .min(4, 'Kod penyertaan mestilah sekurang-kurangnya 4 aksara.')
  .max(10, 'Kod penyertaan tidak boleh melebihi 10 aksara.')
  .regex(/^[A-Z0-9]+$/, 'Kod penyertaan hanya boleh mengandungi huruf besar dan nombor.')
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
    .min(2, 'Nama acara mestilah sekurang-kurangnya 2 aksara.')
    .max(120, 'Nama acara tidak boleh melebihi 120 aksara.')
    .trim(),

  joinCode: joinCodeField.optional(),

  date: z
    .string()
    .min(3, 'Tarikh acara tidak sah.')
    .max(50, 'Tarikh acara terlalu panjang.')
    .trim(),

  startTime: z
    .string()
    .min(1, 'Masa mula tidak sah.')
    .max(20, 'Masa mula terlalu panjang.')
    .trim()
    .optional(),

  maxDurationSeconds: z
    .number({ invalid_type_error: 'maxDurationSeconds mestilah nombor.' })
    .int('maxDurationSeconds mestilah integer.')
    .min(60, 'Had masa mestilah sekurang-kurangnya 60 saat.')
    .max(86400, 'Had masa tidak boleh melebihi 86 400 saat (24 jam).'),

  locationName: z
    .string()
    .min(2, 'Nama lokasi mestilah sekurang-kurangnya 2 aksara.')
    .max(200, 'Nama lokasi tidak boleh melebihi 200 aksara.')
    .trim(),

  totalCheckpoints: z
    .number({ invalid_type_error: 'totalCheckpoints mestilah nombor.' })
    .int('totalCheckpoints mestilah integer.')
    .min(1, 'Acara mesti mempunyai sekurang-kurangnya 1 pos kawalan.')
    .max(50, 'Acara tidak boleh mempunyai lebih daripada 50 pos kawalan.'),

  maxTeamSize: z
    .number({ invalid_type_error: 'maxTeamSize mestilah nombor.' })
    .int('maxTeamSize mestilah integer.')
    .min(2, 'Saiz minimum kumpulan ialah 2 orang.')
    .max(6, 'Saiz maksimum kumpulan ialah 6 orang.')
    .optional()
    .default(4),

  urlSlug: z
    .string()
    .min(2, 'Slug URL mestilah sekurang-kurangnya 2 aksara.')
    .max(100, 'Slug URL tidak boleh melebihi 100 aksara.')
    .regex(/^[a-z0-9-]+$/, 'Slug URL hanya boleh mengandungi huruf kecil, nombor, dan sempang (-).')
    .optional(),

  entryFee: z
    .number({ invalid_type_error: 'Yuran pendaftaran mestilah nombor.' })
    .min(0, 'Yuran pendaftaran tidak boleh negatif.')
    .optional()
    .default(0),

  paymentBankDetails: z
    .string()
    .max(1000, 'Maklumat bank tidak boleh melebihi 1000 aksara.')
    .optional()
    .default(''),

  paymentQrImageUrl: z.string().url('URL gambar QR pembayaran tidak sah.').nullable().optional(),

  bannerImageUrl: z.string().url('URL gambar banner tidak sah.').nullable().optional(),

  paymentDetails: z.lazy(() => PaymentDetailsSchema).nullable().optional(),
});

// ── Payment Details Schemas (Feature 4C) ──────────────────────────────────────

export const PaymentDetailsSchema = z.object({
  bankName: z
    .string()
    .max(100, 'Nama bank tidak boleh melebihi 100 aksara.')
    .trim()
    .optional()
    .default(''),
  accountHolderName: z
    .string()
    .max(100, 'Nama pemegang akaun tidak boleh melebihi 100 aksara.')
    .trim()
    .optional()
    .default(''),
  accountNumber: z
    .string()
    .max(50, 'Nombor akaun tidak boleh melebihi 50 aksara.')
    .regex(/^[0-9\-\s]*$/, 'Nombor akaun hanya boleh mengandungi nombor, sempang, dan ruang.')
    .trim()
    .optional()
    .default(''),
  note: z
    .string()
    .max(500, 'Nota tidak boleh melebihi 500 aksara.')
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
    .min(1, 'Nama kumpulan diperlukan.')
    .max(100, 'Nama kumpulan tidak boleh melebihi 100 aksara.')
    .trim(),
  leaderName: z.string().max(100, 'Nama ketua tidak boleh melebihi 100 aksara.').trim().optional(),
  membersList: z.string().max(500, 'Senarai ahli tidak boleh melebihi 500 aksara.').trim().optional(),
  phone: z
    .string()
    .max(20, 'Nombor telefon tidak boleh melebihi 20 aksara.')
    .regex(/^[0-9+\-\s()]*$/, 'Nombor telefon tidak sah.')
    .optional(),
  memberCount: z
    .number({ invalid_type_error: 'memberCount mestilah nombor.' })
    .int('memberCount mestilah integer.')
    .min(1, 'Jumlah ahli mestilah sekurang-kurangnya 1 orang.')
    .max(6, 'Jumlah ahli tidak boleh melebihi 6 orang.'),
  joinCode: z.string().min(4, 'Kod penyertaan tidak sah.').max(10).optional(),
});

export const UpdateTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama kumpulan diperlukan.')
    .max(100, 'Nama kumpulan tidak boleh melebihi 100 aksara.')
    .trim()
    .optional(),
  leaderName: z.string().max(100, 'Nama ketua tidak boleh melebihi 100 aksara.').trim().optional(),
  membersList: z.string().max(500, 'Senarai ahli tidak boleh melebihi 500 aksara.').trim().optional(),
  phone: z
    .string()
    .max(20, 'Nombor telefon tidak boleh melebihi 20 aksara.')
    .regex(/^[0-9+\-\s()]*$/, 'Nombor telefon tidak sah.')
    .optional(),
  memberCount: z
    .number({ invalid_type_error: 'memberCount mestilah nombor.' })
    .int('memberCount mestilah integer.')
    .min(1, 'Jumlah ahli mestilah sekurang-kurangnya 1 orang.')
    .max(6, 'Jumlah ahli tidak boleh melebihi 6 orang.')
    .optional(),
});

export const TeamStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: "Status mestilah 'pending', 'approved', atau 'rejected'." }),
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
    .min(3, 'Poligon sempadan memerlukan sekurang-kurangnya 3 bucu.'),
});

export const CreateCheckpointSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama pos kawalan diperlukan.')
    .max(120, 'Nama pos kawalan tidak boleh melebihi 120 aksara.')
    .trim(),
  latitude: z.number().min(-90, 'Latitud tidak sah.').max(90, 'Latitud tidak sah.'),
  longitude: z.number().min(-180, 'Longitud tidak sah.').max(180, 'Longitud tidak sah.'),
  clueText: z.string().min(1, 'Klu diperlukan.').max(1000, 'Klu tidak boleh melebihi 1000 aksara.').trim(),
  taskDescription: z.string().min(1, 'Tugasan diperlukan.').max(2000, 'Tugasan tidak boleh melebihi 2000 aksara.').trim(),
  scorePoints: z
    .number({ invalid_type_error: 'scorePoints mestilah nombor.' })
    .int('scorePoints mestilah integer.')
    .nonnegative('Mata ganjaran tidak boleh negatif.')
    .max(10000, 'Mata ganjaran maksimum ialah 10,000.')
    .optional()
    .default(100),
  geofenceRadiusMeters: z
    .number({ invalid_type_error: 'geofenceRadiusMeters mestilah nombor.' })
    .int('geofenceRadiusMeters mestilah integer.')
    .min(10, 'Radius geofence mestilah sekurang-kurangnya 10 meter.')
    .max(150, 'Radius geofence tidak boleh melebihi 150 meter.')
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
    .array(z.string().min(1, 'ID pos kawalan tidak sah.'))
    .min(1, 'Sekurang-kurangnya satu ID pos kawalan diperlukan.'),
});

export const AttendanceCheckinSchema = z.object({
  teamId: z.string().min(1, 'ID kumpulan diperlukan.').trim(),
  note: z.string().max(200, 'Nota tidak boleh melebihi 200 aksara.').optional(),
});

export const StartRaceSchema = z.object({
  forceStart: z.boolean().optional().default(false),
});

export const LateAssignSchema = z.object({
  preferredCheckpointId: z.string().optional(),
  note: z.string().max(200, 'Nota tidak boleh melebihi 200 aksara.').optional(),
});

export const ALLOWED_QR_TTL_SECONDS = [10, 15, 30, 45, 60, 120] as const;

export const GenerateCheckpointQrSchema = z.object({
  teamId: z.string().min(1).max(50).trim().optional().default('*'),
  forceRefresh: z.boolean().optional().default(false),
  ttlSeconds: z
    .number()
    .int()
    .refine((val) => (ALLOWED_QR_TTL_SECONDS as readonly number[]).includes(val), {
      message: 'TTL mestilah salah satu daripada: 10, 15, 30, 45, 60, atau 120 saat.',
    })
    .optional()
    .default(30),
});

export const GenerateAttendanceQrSchema = z.object({
  teamId: z.string().min(1).max(50).trim().optional().default('*'),
  forceRefresh: z.boolean().optional().default(false),
});

export const ScanCheckpointQrSchema = z.object({
  payload: z.string().min(1, 'Payload kod QR diperlukan.').trim(),
  latitude: z.number().min(-90, 'Latitud tidak sah.').max(90, 'Latitud tidak sah.'),
  longitude: z.number().min(-180, 'Longitud tidak sah.').max(180, 'Longitud tidak sah.'),
  accuracy: z.number().optional(),
});

export const SkipCheckpointSchema = z.object({
  reason: z.string().max(250, 'Sebab langkau tidak boleh melebihi 250 aksara.').trim().optional(),
});

export const FinishRaceScanSchema = z.object({
  payload: z.string().min(1, 'Payload kod QR penamat diperlukan.').trim(),
  latitude: z.number().min(-90, 'Latitud tidak sah.').max(90, 'Latitud tidak sah.'),
  longitude: z.number().min(-180, 'Longitud tidak sah.').max(180, 'Longitud tidak sah.'),
  accuracy: z.number().optional(),
});

export const UploadPhotoProofSchema = z.object({
  imageBase64: z.string().min(1, 'Data imej base64 diperlukan.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Format imej mestilah image/jpeg, image/png, atau image/webp.' }),
  }),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const UploadEventAssetSchema = z.object({
  assetType: z.enum(['banner', 'payment_qr'], {
    errorMap: () => ({ message: "Jenis aset mestilah 'banner' atau 'payment_qr'." }),
  }),
  imageBase64: z.string().min(1, 'Data imej base64 diperlukan.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Format imej mestilah image/jpeg, image/png, atau image/webp.' }),
  }),
});

export const ManualOverrideSchema = z.object({
  reason: z.string().min(5, 'Sebab pelepasan manual sekurang-kurangnya 5 aksara.').max(250).trim(),
  crewLatitude: z.number().min(-90).max(90).optional(),
  crewLongitude: z.number().min(-180).max(180).optional(),
  skipGeofenceReason: z.string().max(250).trim().optional(),
  pointsAwarded: z.number().int().min(0).max(500).optional(),
});

export const ApplyPenaltySchema = z.object({
  penaltyType: z.enum(['points', 'time', 'both']),
  pointPenalty: z.number().int().min(0).max(1000).optional().default(0),
  timePenaltyMinutes: z.number().int().min(0).max(240).optional().default(0),
  reason: z.string().min(5, 'Sebab penalti sekurang-kurangnya 5 aksara.').max(250).trim(),
  checkpointId: z.string().max(50).trim().optional(),
});

export const UpdateRaceRulesSchema = z.object({
  maxRaceTime: z.number().int('Masa perlumbaan mestilah integer.').min(60, 'Masa perlumbaan sekurang-kurangnya 60 saat.').max(86400).optional(),
  taskTimeLimit: z.number().int('Masa tugasan mestilah integer.').min(30, 'Masa tugasan sekurang-kurangnya 30 saat.').max(7200).optional(),
  latePenaltyMin: z.number().int().min(0, 'Penalti masa tidak boleh negatif.').max(240).optional(),
  pointPenaltyPts: z.number().int().min(0, 'Penalti mata tidak boleh negatif.').max(1000).optional(),
  bonusPoints: z.number().int().min(0, 'Mata bonus tidak boleh negatif.').max(1000).optional(),
  pointsSystemEnabled: z.boolean().optional(),
  latePenaltyEnabled: z.boolean().optional(),
  taskTimeLimitEnabled: z.boolean().optional(),
  pointPenaltyEnabled: z.boolean().optional(),
  bonusPointsEnabled: z.boolean().optional(),
  maxVelocityKmh: z.number().min(5, 'Had kelajuan minimum ialah 5 km/j.').max(150, 'Had kelajuan maksimum ialah 150 km/j.').optional(),
  maxSkipsPerTeam: z.number().int().min(0).max(10).optional(),
  latePenaltyPerMinute: z.number().min(0).max(100).optional(),
});

export const RegisterUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email('E-mel tidak sah.').max(254),
  password: z.string().min(6, 'Kata laluan terlalu pendek.').max(128),
  role: UserRoleSchema,
});

export const JoinEventSchema = z.object({
  joinCode: joinCodeField,
});

export const SyncQueueItemSchema = z.object({
  idempotencyKey: z
    .string()
    .min(8, 'Key kebolehulangan sekurang-kurangnya 8 aksara.')
    .max(128, 'Key kebolehulangan tidak boleh melebihi 128 aksara.')
    .trim(),
  operation: z.enum([
    'checkpoint_scan',
    'checkpoint_skip',
    'photo_proof',
    'manual_override',
    'apply_penalty',
    'finish_scan',
  ], {
    errorMap: () => ({ message: 'Operasi sync tidak sah.' }),
  }),
  clientTimestamp: z.string().datetime({ message: 'Cap masa peranti tidak sah.' }),
  checkpointId: z.string().max(50).optional(),
  teamId: z.string().max(50).optional(),
  payload: z.record(z.unknown()).optional().default({}),
});

export const BatchSyncSchema = z.object({
  items: z
    .array(SyncQueueItemSchema)
    .min(1, 'Sekurang-kurangnya satu item senarai menunggu diperlukan.')
    .max(100, 'Maksimum 100 item dibenarkan dalam satu kelompok sync.'),
});

// ── Web Pre-Registration Schemas (Feature 4B) ─────────────────────────────────

export const MalaysianPhoneSchema = z
  .string({ required_error: 'Nombor WhatsApp ketua diperlukan.' })
  .trim()
  .regex(/^(\+?60|0)1[0-46-9][0-9]{7,8}$/, 'Nombor WhatsApp mestilah nombor telefon Malaysia yang sah (contoh: 0123456789 atau +60123456789).');

export const PreRegisterSchema = z.object({
  teamName: z
    .string({ required_error: 'Nama kumpulan diperlukan.' })
    .min(1, 'Nama kumpulan tidak boleh kosong.')
    .max(100, 'Nama kumpulan tidak boleh melebihi 100 aksara.')
    .trim(),
  leaderName: z
    .string({ required_error: 'Nama ketua kumpulan diperlukan.' })
    .min(1, 'Nama ketua kumpulan tidak boleh kosong.')
    .max(100, 'Nama ketua kumpulan tidak boleh melebihi 100 aksara.')
    .trim(),
  leaderWhatsApp: MalaysianPhoneSchema,
  memberNames: z
    .array(
      z
        .string()
        .min(1, 'Nama ahli tidak boleh kosong.')
        .max(100, 'Nama ahli tidak boleh melebihi 100 aksara.')
        .trim()
    )
    .max(5, 'Jumlah ahli tambahan tidak boleh melebihi 5 orang.'),
  imageBase64: z.string({ required_error: 'Resit pembayaran diperlukan.' }).min(1, 'Resit pembayaran tidak boleh kosong.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Format resit mestilah image/jpeg, image/png, atau image/webp.' }),
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
      const message = firstError?.message ?? 'Input tidak sah.';

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
