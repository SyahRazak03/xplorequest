/**
 * handlers/__tests__/qr.test.ts
 *
 * Integration and cryptographic unit tests for Dynamic HMAC-SHA256 QR Generation.
 */

import express from 'express';
import request from 'supertest';

import {
  buildAttendanceQrPayload,
  buildCheckpointQrPayload,
  signHmacSha256,
  verifyHmacSignature,
} from '../../utils/crypto';
import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { qrRouter } from '../qr';

// ── Mock Services ─────────────────────────────────────────────────────────────

const mockGenerateCheckpointQrService = jest.fn();
const mockGenerateAttendanceQrService = jest.fn();

jest.mock('../../services/qr.service', () => ({
  generateCheckpointQrService: (...args: unknown[]) => mockGenerateCheckpointQrService(...args),
  generateAttendanceQrService: (...args: unknown[]) => mockGenerateAttendanceQrService(...args),
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
      if (token === 'admin-token') {
        return { uid: 'admin-123', role: 'admin' };
      }
      if (token === 'crew-cp1-token') {
        return { uid: 'crew-123', role: 'crew', eventId: 'EVT-001', checkpointId: 'CP-001' };
      }
      if (token === 'crew-cp2-token') {
        return { uid: 'crew-456', role: 'crew', eventId: 'EVT-001', checkpointId: 'CP-002' };
      }
      if (token === 'participant-token') {
        return { uid: 'participant-123', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', qrRouter);
app.use(errorHandler);

jest.setTimeout(15000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dynamic HMAC QR Engine', () => {
  const TEST_SECRET = 'a3f89e21c7d4560b91e8432a1f65d78e90c21b34a5f6e7d8c9b0a1f2e3d4c5b6';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Cryptographic Unit Tests ────────────────────────────────────────────────

  describe('utils/crypto.ts', () => {
    it('generates consistent deterministic HMAC-SHA256 hex signatures', () => {
      const data = 'TEAM-001:CP-001:1780000000000:1';
      const sig1 = signHmacSha256(data, TEST_SECRET);
      const sig2 = signHmacSha256(data, TEST_SECRET);

      expect(sig1).toHaveLength(64); // 256 bits = 64 hex chars
      expect(sig1).toBe(sig2);
    });

    it('verifies valid HMAC signatures and rejects tampered data or wrong secrets', () => {
      const data = 'TEAM-001:CP-001:1780000000000:1';
      const signature = signHmacSha256(data, TEST_SECRET);

      expect(verifyHmacSignature(data, signature, TEST_SECRET)).toBe(true);
      expect(verifyHmacSignature(data, signature, 'wrong-secret-key-1234567890123456')).toBe(false);
      expect(verifyHmacSignature('TEAM-002:CP-001:1780000000000:1', signature, TEST_SECRET)).toBe(false);
    });

    it('builds checkpoint payload matching format {teamId}:{checkpointId}:{timestamp}:{keyId}:{signature}', () => {
      const { payload, signature, rawData } = buildCheckpointQrPayload(
        {
          teamId: 'TEAM-001',
          checkpointId: 'CP-002',
          timestamp: 1780000000000,
          keyId: 1,
        },
        TEST_SECRET
      );

      expect(rawData).toBe('TEAM-001:CP-002:1780000000000:1');
      expect(payload).toBe(`TEAM-001:CP-002:1780000000000:1:${signature}`);
      expect(payload.split(':')).toHaveLength(5);
    });

    it('builds attendance payload matching format {teamId}:{eventId}:attendance:{timestamp}:{keyId}:{signature}', () => {
      const { payload, signature, rawData } = buildAttendanceQrPayload(
        {
          teamId: '*',
          eventId: 'EVT-001',
          timestamp: 1780000000000,
          keyId: 1,
        },
        TEST_SECRET
      );

      expect(rawData).toBe('*:EVT-001:attendance:1780000000000:1');
      expect(payload).toBe(`*:EVT-001:attendance:1780000000000:1:${signature}`);
      expect(payload.split(':')).toHaveLength(6);
    });
  });

  // ── Multi-Team Concurrency & Replay Logic Verification ──────────────────────

  describe('Multi-Team Broadcast Redemption Simulation', () => {
    it('executes exact multi-team sequence: Team A succeeds, Team B succeeds, Team A fails on repeat', () => {
      // In-memory token representation matching Firestore QrTokenDocument
      const now = Date.now();
      const broadcastToken = {
        id: 'sig-broadcast-12345',
        teamId: '*',
        checkpointId: 'CP-TAMAT',
        expiresAt: now + 30000,
        redeemedByTeamIds: [] as string[],
        scanned: false,
      };

      // Helper simulating atomic redemption transaction
      function simulateRedeem(token: typeof broadcastToken, teamId: string, currentMs: number) {
        if (token.expiresAt !== null && token.expiresAt < currentMs) {
          throw new Error('TOKEN_EXPIRED');
        }
        if (token.teamId !== '*' && token.teamId !== teamId) {
          throw new Error('TEAM_MISMATCH');
        }
        if (token.redeemedByTeamIds.includes(teamId)) {
          throw new Error('ALREADY_REDEEMED');
        }
        token.redeemedByTeamIds.push(teamId);
        if (token.teamId !== '*') {
          token.scanned = true;
        }
        return { success: true, redeemedByTeamIds: [...token.redeemedByTeamIds] };
      }

      // Step 1: Team A redeems broadcast signature -> SUCCEEDS
      const resA1 = simulateRedeem(broadcastToken, 'TEAM-A', now + 5000);
      expect(resA1.success).toBe(true);
      expect(broadcastToken.redeemedByTeamIds).toEqual(['TEAM-A']);
      expect(broadcastToken.scanned).toBe(false); // Still broadcastable to other teams

      // Step 2: Team B redeems same broadcast signature -> SUCCEEDS
      const resB = simulateRedeem(broadcastToken, 'TEAM-B', now + 12000);
      expect(resB.success).toBe(true);
      expect(broadcastToken.redeemedByTeamIds).toEqual(['TEAM-A', 'TEAM-B']);

      // Step 3: Team A tries again on same signature -> FAILS with ALREADY_REDEEMED
      expect(() => simulateRedeem(broadcastToken, 'TEAM-A', now + 18000)).toThrow('ALREADY_REDEEMED');

      // Step 4: Any team after TTL -> FAILS with TOKEN_EXPIRED
      expect(() => simulateRedeem(broadcastToken, 'TEAM-C', now + 35000)).toThrow('TOKEN_EXPIRED');
    });

    it('applies redeemedByTeamIds identically to broadcast attendance tokens', () => {
      const attendanceToken = {
        id: 'sig-attendance-67890',
        teamId: '*',
        type: 'attendance',
        expiresAt: null, // no expiration for attendance
        redeemedByTeamIds: [] as string[],
        scanned: false,
      };

      function simulateAttendanceRedeem(token: typeof attendanceToken, teamId: string) {
        if (token.redeemedByTeamIds.includes(teamId)) {
          throw new Error('ALREADY_CHECKED_IN');
        }
        token.redeemedByTeamIds.push(teamId);
        return { success: true, count: token.redeemedByTeamIds.length };
      }

      // Team A checks in -> succeeds
      expect(simulateAttendanceRedeem(attendanceToken, 'TEAM-A').success).toBe(true);
      // Team B checks in on same counter QR -> succeeds
      expect(simulateAttendanceRedeem(attendanceToken, 'TEAM-B').success).toBe(true);
      // Team A tries again -> fails
      expect(() => simulateAttendanceRedeem(attendanceToken, 'TEAM-A')).toThrow('ALREADY_CHECKED_IN');
    });
  });

  // ── POST /events/:eventId/checkpoints/:cpId/qr ──────────────────────────────

  describe('POST /events/:eventId/checkpoints/:cpId/qr', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/qr')
        .send({});

      expect(res.status).toBe(401);
    });

    it('returns 403 for participant role', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/qr')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 403 if crew custom claim checkpointId does not match route :cpId', async () => {
      mockGenerateCheckpointQrService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.FORBIDDEN,
          'Akses ditolak: Kru hanya boleh menjana kod QR untuk pos kawalan yang ditugaskan.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/qr')
        .set('Authorization', 'Bearer crew-cp1-token') // Assigned to CP-001
        .send({ teamId: 'TEAM-001' });

      expect(res.status).toBe(403);
      expect(mockGenerateCheckpointQrService).toHaveBeenCalledWith(
        'EVT-001',
        'CP-002',
        expect.objectContaining({ uid: 'crew-123', checkpointId: 'CP-001' }),
        expect.objectContaining({ teamId: 'TEAM-001' })
      );
    });

    it('returns 422 if caller requests an unconfigured arbitrary TTL (e.g. 999s)', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/qr')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({ ttlSeconds: 999 });

      expect(res.status).toBe(422);
      expect(mockGenerateCheckpointQrService).not.toHaveBeenCalled();
    });

    it('returns 200 when crew generates QR with valid admin-configured TTL (e.g. 60s)', async () => {
      const qrResult = {
        payload: 'TEAM-001:CP-001:1780000000000:1:abcdef123456',
        checkpointId: 'CP-001',
        teamId: 'TEAM-001',
        ttlSeconds: 60,
        remainingTtlSeconds: 60,
        expiresAt: 1780000060000,
        keyId: 1,
      };

      mockGenerateCheckpointQrService.mockResolvedValueOnce(qrResult);

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/qr')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({ teamId: 'TEAM-001', ttlSeconds: 60, forceRefresh: false });

      expect(res.status).toBe(200);
      expect(res.body.data.payload).toBe(qrResult.payload);
      expect(res.body.data.ttlSeconds).toBe(60);
    });

    it('returns 200 when admin generates QR for any checkpoint in the event', async () => {
      const qrResult = {
        payload: '*:CP-002:1780000000000:1:fedcba654321',
        checkpointId: 'CP-002',
        teamId: '*',
        ttlSeconds: 30,
        remainingTtlSeconds: 30,
        expiresAt: 1780000030000,
        keyId: 1,
      };

      mockGenerateCheckpointQrService.mockResolvedValueOnce(qrResult);

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/qr')
        .set('Authorization', 'Bearer admin-token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.checkpointId).toBe('CP-002');
      expect(mockGenerateCheckpointQrService).toHaveBeenCalledWith(
        'EVT-001',
        'CP-002',
        expect.objectContaining({ uid: 'admin-123', role: 'admin' }),
        expect.objectContaining({ teamId: '*', forceRefresh: false })
      );
    });
  });

  // ── POST /events/:eventId/attendance/qr ─────────────────────────────────────

  describe('POST /events/:eventId/attendance/qr', () => {
    it('returns 403 for participant role', async () => {
      const res = await request(app)
        .post('/events/EVT-001/attendance/qr')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 200 for crew generating attendance check-in QR', async () => {
      const attendanceResult = {
        payload: '*:EVT-001:attendance:1780000000000:1:9876543210ab',
        eventId: 'EVT-001',
        teamId: '*',
        keyId: 1,
        timestamp: 1780000000000,
      };

      mockGenerateAttendanceQrService.mockResolvedValueOnce(attendanceResult);

      const res = await request(app)
        .post('/events/EVT-001/attendance/qr')
        .set('Authorization', 'Bearer crew-cp1-token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.payload).toBe(attendanceResult.payload);
      expect(res.body.data.eventId).toBe('EVT-001');
    });
  });
});
