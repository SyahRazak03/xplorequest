/**
 * handlers/__tests__/verification.test.ts
 *
 * Comprehensive test suite for Stage 11: Crew Verification Wizard
 * (Photo Proof + Manual Override + Bounded Penalties).
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { verificationRouter } from '../verification';

// ── Mock Verification Services ────────────────────────────────────────────────

const mockUploadPhotoProofService = jest.fn();
const mockManualOverrideService = jest.fn();
const mockApplyPenaltyService = jest.fn();

jest.mock('../../services/verification.service', () => ({
  uploadPhotoProofService: (...args: unknown[]) => mockUploadPhotoProofService(...args),
  manualOverrideService: (...args: unknown[]) => mockManualOverrideService(...args),
  applyPenaltyService: (...args: unknown[]) => mockApplyPenaltyService(...args),
}));

// ── Mock Firebase Config & Auth Middleware ────────────────────────────────────

jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getFirestore: jest.fn().mockReturnValue({}),
  getStorage: jest.fn().mockReturnValue({}),
  getAuth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn().mockImplementation(async (token: string) => {
      if (token === 'admin-token') {
        return { uid: 'admin-001', role: 'admin' };
      }
      if (token === 'crew-cp1-token') {
        return { uid: 'crew-001', role: 'crew', eventId: 'EVT-001', checkpointId: 'CP-001' };
      }
      if (token === 'crew-cp2-token') {
        return { uid: 'crew-002', role: 'crew', eventId: 'EVT-001', checkpointId: 'CP-002' };
      }
      if (token === 'participant-token') {
        return { uid: 'user-p1', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/events', verificationRouter);
app.use(errorHandler);

// Valid 1x1 PNG base64
const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Stage 11: Crew Verification Wizard & Penalty Handler Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Photo Proof Upload Tests ─────────────────────────────────────────────

  describe('POST /events/:eventId/checkpoints/:cpId/teams/:teamId/photo-proof', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/photo-proof')
        .send({
          imageBase64: VALID_PNG_BASE64,
          contentType: 'image/png',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 for participant role', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/photo-proof')
        .set('Authorization', 'Bearer participant-token')
        .send({
          imageBase64: VALID_PNG_BASE64,
          contentType: 'image/png',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 for invalid content-type', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/photo-proof')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          imageBase64: VALID_PNG_BASE64,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('successfully uploads photo proof by assigned crew', async () => {
      mockUploadPhotoProofService.mockResolvedValueOnce({
        photoProofUrl: 'https://storage.googleapis.com/test-bucket/proofs/EVT-001/TEAM-001/CP-001/photo.png',
        storagePath: 'proofs/EVT-001/TEAM-001/CP-001/photo.png',
        sizeBytes: 85,
        uploadedAt: '2026-09-03T10:00:00.000Z',
      });

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/photo-proof')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          imageBase64: VALID_PNG_BASE64,
          contentType: 'image/png',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.photoProofUrl).toContain('proofs/EVT-001/TEAM-001/CP-001');
    });

    it('returns 403 if crew attempts to upload for a different checkpoint', async () => {
      mockUploadPhotoProofService.mockRejectedValueOnce(
        new AppError(ErrorCode.FORBIDDEN, 'Akses ditolak: Kru hanya boleh memuat naik bukti gambar untuk pos kawalan yang ditugaskan.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/teams/TEAM-001/photo-proof')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          imageBase64: VALID_PNG_BASE64,
          contentType: 'image/png',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ── 2. Manual Override Tests ────────────────────────────────────────────────

  describe('POST /events/:eventId/checkpoints/:cpId/teams/:teamId/manual-override', () => {
    it('returns 422 if reason is shorter than 5 characters', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/manual-override')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          reason: 'ok',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 if geofence is skipped without providing skipGeofenceReason', async () => {
      mockManualOverrideService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.UNPROCESSABLE_ENTITY,
          'Alasan pengecualian geofence (sekurang-kurangnya 5 aksara) diperlukan apabila kru berada di luar radius atau lokasi GPS tidak dibekalkan.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/manual-override')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          reason: 'Camera failure on participant device',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('successfully processes manual override with full audit compliance', async () => {
      mockManualOverrideService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        checkpointId: 'CP-001',
        nextCheckpointId: 'CP-002',
        completedCheckpointIds: ['CP-001'],
        pointsAwarded: 50,
        totalPoints: 50,
        verifiedBy: 'manual',
        crewUid: 'crew-001',
        reason: 'Physical task verified by station marshal, participant phone out of battery',
        geofenceAudited: true,
      });

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/manual-override')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          reason: 'Physical task verified by station marshal, participant phone out of battery',
          crewLatitude: 3.1764,
          crewLongitude: 101.7061,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verifiedBy).toBe('manual');
      expect(res.body.data.completedCheckpointIds).toContain('CP-001');
      expect(res.body.data.pointsAwarded).toBe(50);
    });

    it('returns 409 when checkpoint already completed', async () => {
      mockManualOverrideService.mockRejectedValueOnce(
        new AppError(ErrorCode.CHECKPOINT_ALREADY_COMPLETED, 'Pos kawalan ini telah pun diselesaikan oleh kumpulan ini.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/teams/TEAM-001/manual-override')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          reason: 'Duplicate completion test',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CHECKPOINT_ALREADY_COMPLETED');
    });

    it('returns 400 when manual override is requested out-of-sequence for non-skipped checkpoint', async () => {
      mockManualOverrideService.mockRejectedValueOnce(
        new AppError(ErrorCode.OUT_OF_SEQUENCE, 'Pos kawalan ini bukan giliran laluan semasa kumpulan dan belum dilangkau. Pos semasa: CP-001.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-003/teams/TEAM-001/manual-override')
        .set('Authorization', 'Bearer admin-token')
        .send({
          reason: 'Attempting to override CP-003 directly',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUT_OF_SEQUENCE');
    });
  });

  // ── 3. Manual Penalty Application Tests ──────────────────────────────────────

  describe('POST /events/:eventId/teams/:teamId/penalty', () => {
    it('returns 422 if crew applies point penalty exceeding RaceRules limit', async () => {
      mockApplyPenaltyService.mockRejectedValueOnce(
        new AppError(ErrorCode.UNPROCESSABLE_ENTITY, 'Had maksimum penalti mata oleh kru ialah 50 mata. Nilai diminta: 100.')
      );

      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/penalty')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          penaltyType: 'points',
          pointPenalty: 100,
          reason: 'Disruptive behavior during challenge',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 422 if crew applies time penalty exceeding RaceRules limit', async () => {
      mockApplyPenaltyService.mockRejectedValueOnce(
        new AppError(ErrorCode.UNPROCESSABLE_ENTITY, 'Had maksimum penalti masa oleh kru ialah 30 minit. Nilai diminta: 60.')
      );

      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/penalty')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          penaltyType: 'time',
          timePenaltyMinutes: 60,
          reason: 'Late arrival to station',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('successfully applies bounded penalty by crew member', async () => {
      mockApplyPenaltyService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        penaltyType: 'both',
        pointPenalty: 25,
        timePenaltyMinutes: 10,
        newTotalPoints: 75,
        newTotalPenaltiesMinutes: 10,
        appliedByUid: 'crew-001',
        reason: 'Incomplete team equipment at checkpoint',
      });

      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/penalty')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({
          penaltyType: 'both',
          pointPenalty: 25,
          timePenaltyMinutes: 10,
          reason: 'Incomplete team equipment at checkpoint',
          checkpointId: 'CP-001',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pointPenalty).toBe(25);
      expect(res.body.data.timePenaltyMinutes).toBe(10);
      expect(res.body.data.newTotalPoints).toBe(75);
    });

    it('allows admin role to apply custom penalties exceeding standard crew caps', async () => {
      mockApplyPenaltyService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        penaltyType: 'points',
        pointPenalty: 200,
        timePenaltyMinutes: 0,
        newTotalPoints: 0,
        newTotalPenaltiesMinutes: 0,
        appliedByUid: 'admin-001',
        reason: 'Severe rules violation approved by head organizer',
      });

      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/penalty')
        .set('Authorization', 'Bearer admin-token')
        .send({
          penaltyType: 'points',
          pointPenalty: 200,
          reason: 'Severe rules violation approved by head organizer',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pointPenalty).toBe(200);
      expect(res.body.data.appliedByUid).toBe('admin-001');
    });
  });
});
