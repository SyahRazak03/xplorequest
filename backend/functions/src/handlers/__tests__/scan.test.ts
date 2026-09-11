/**
 * handlers/__tests__/scan.test.ts
 *
 * Integration test suite for Participant QR Scan Multi-Layer Verification Pipeline.
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { scanRouter } from '../scan';

// ── Mock Services ─────────────────────────────────────────────────────────────

const mockVerifyAndProcessScanService = jest.fn();

jest.mock('../../services/scan.service', () => ({
  verifyAndProcessScanService: (...args: unknown[]) => mockVerifyAndProcessScanService(...args),
}));

// ── Mock Firebase Config & Auth Middleware ────────────────────────────────────

jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
  getAuth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn().mockImplementation(async (token: string) => {
      if (token === 'participant-team1-token') {
        return { uid: 'user-p1', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      if (token === 'participant-team2-token') {
        return { uid: 'user-p2', role: 'participant', teamId: 'TEAM-002', eventId: 'EVT-001' };
      }
      if (token === 'participant-no-team-token') {
        return { uid: 'user-p3', role: 'participant', eventId: 'EVT-001' };
      }
      if (token === 'crew-token') {
        return { uid: 'crew-123', role: 'crew', checkpointId: 'CP-001', eventId: 'EVT-001' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', scanRouter);
app.use(errorHandler);

jest.setTimeout(15000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Participant QR Scan Multi-Layer Verification Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Authentication & Role Enforcement ───────────────────────────────────────

  describe('Auth & Role Guards', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-participant roles (e.g. crew)', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer crew-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(403);
    });

    it('returns 403 for participant without teamId custom claim', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-no-team-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(403);
    });
  });

  // ── Validation Pipeline Scenarios ───────────────────────────────────────────

  describe('Multi-Layer Validation Scenarios', () => {
    it('returns 400 for invalid/malformed QR payload', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.INVALID_PAYLOAD, 'Format payload kod QR tidak sah.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'invalid-malformed-qr-code',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYLOAD');
    });

    it('returns 400 for tampered cryptographic HMAC signature', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.INVALID_SIGNATURE, 'Tandatangan kriptografi kod QR tidak sah (Tampered).')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:tampered-signature',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('returns 422 for expired QR token (past TTL)', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.TOKEN_EXPIRED, 'Kod QR telah tamat tempoh. Sila minta kod QR baharu daripada kru.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:valid-sig-but-expired',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('returns 409 for replayed QR token (single-use re-scan)', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.REPLAY_ATTACK, 'Kod QR ini telah pun digunakan (Replay attack dikesan).')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:valid-sig-replayed',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REPLAY_ATTACK');
    });

    it('returns 403 for cross-team QR code scan (wrong team)', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.WRONG_TEAM, 'Kod QR ini dijana khusus untuk kumpulan TEAM-002, bukan kumpulan anda.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token') // Team 1 scanning Team 2's QR
        .send({
          payload: 'TEAM-002:CP-001:1780000000000:1:valid-team2-sig',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WRONG_TEAM');
    });

    it('returns 422 for out-of-sequence checkpoint scan', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.OUT_OF_SEQUENCE, 'Pos kawalan ini bukan giliran laluan semasa kumpulan anda. Pos semasa: CP-001.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-003/scan') // Team is at CP-001, scanning CP-003
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-003:1780000000000:1:sig-cp3',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUT_OF_SEQUENCE');
    });

    it('returns 422 for GPS outside event boundary polygon (OUT_OF_EVENT_BOUNDARY)', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.OUT_OF_EVENT_BOUNDARY, 'Lokasi GPS anda berada di luar kawasan sempadan acara.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:sig-cp1',
          latitude: 3.9999, // Outside event boundary
          longitude: 102.5000,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUT_OF_EVENT_BOUNDARY');
    });

    it('returns 422 for GPS outside checkpoint radius geofence (OUT_OF_CHECKPOINT_RADIUS)', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.OUT_OF_CHECKPOINT_RADIUS, 'Lokasi GPS anda (120m) berada di luar radius pos kawalan (50m).')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:sig-cp1',
          latitude: 3.1775, // 120m away from CP-001
          longitude: 101.7075,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUT_OF_CHECKPOINT_RADIUS');
    });

    it('returns 422 for GPS velocity spoofing (SUSPECTED_SPOOFING)', async () => {
      mockVerifyAndProcessScanService.mockRejectedValueOnce(
        new AppError(ErrorCode.SUSPECTED_SPOOFING, 'Kelajuan pergerakan tidak munasabah (180 km/j > had 40 km/j). Penipuan GPS disyaki.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-002:1780000000000:1:sig-cp2',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SUSPECTED_SPOOFING');
    });

    it('returns 200 on valid scan at intermediate checkpoint (advances sequence, awards points)', async () => {
      const mockResult = {
        teamId: 'TEAM-001',
        checkpointId: 'CP-001',
        nextCheckpointId: 'CP-002',
        isFinish: false,
        pointsEarned: 100,
        totalPoints: 100,
        completedCheckpointIds: ['CP-001'],
        scannedAt: '2026-08-26T10:00:00.000Z',
      };

      mockVerifyAndProcessScanService.mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:valid-sig',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.checkpointId).toBe('CP-001');
      expect(res.body.data.nextCheckpointId).toBe('CP-002');
      expect(res.body.data.isFinish).toBe(false);
      expect(res.body.data.pointsEarned).toBe(100);
    });

    it('returns 200 on valid scan at finish checkpoint (last in sequence, handles gracefully without throwing)', async () => {
      const mockFinishResult = {
        teamId: 'TEAM-001',
        checkpointId: 'CP-TAMAT',
        nextCheckpointId: 'CP-TAMAT', // Gracefully maintained
        isFinish: true,
        pointsEarned: 200,
        totalPoints: 500,
        completedCheckpointIds: ['CP-001', 'CP-002', 'CP-003', 'CP-TAMAT'],
        scannedAt: '2026-08-26T11:00:00.000Z',
      };

      mockVerifyAndProcessScanService.mockResolvedValueOnce(mockFinishResult);

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-TAMAT/scan')
        .set('Authorization', 'Bearer participant-team1-token')
        .send({
          payload: '*:CP-TAMAT:1780000000000:1:finish-sig',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.checkpointId).toBe('CP-TAMAT');
      expect(res.body.data.isFinish).toBe(true);
      expect(res.body.data.nextCheckpointId).toBe('CP-TAMAT');
    });
  });
});
