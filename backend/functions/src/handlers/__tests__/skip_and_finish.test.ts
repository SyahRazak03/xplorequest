/**
 * handlers/__tests__/skip_and_finish.test.ts
 *
 * Comprehensive test suite for Checkpoint Skip Logic (FR-02) and Finish Line Gatekeeper (FR-03).
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { finishRouter } from '../finish';
import { scanRouter } from '../scan';

// ── Mock Services for Handler-level Integration Tests ─────────────────────────

const mockSkipCheckpointService = jest.fn();
const mockFinishRaceService = jest.fn();
const mockVerifyAndProcessScanService = jest.fn();

jest.mock('../../services/scan.service', () => ({
  skipCheckpointService: (...args: unknown[]) => mockSkipCheckpointService(...args),
  finishRaceService: (...args: unknown[]) => mockFinishRaceService(...args),
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
      if (token === 'participant-token') {
        return { uid: 'user-p1', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      if (token === 'participant-no-team-token') {
        return { uid: 'user-p2', role: 'participant', eventId: 'EVT-001' };
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
app.use('/events', finishRouter);
app.use(errorHandler);

jest.setTimeout(15000);

describe('FR-02 (Skip Logic) & FR-03 (Finish Gatekeeper) Route Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── FR-02: Checkpoint Skip Route Tests ──────────────────────────────────────

  describe('POST /events/:eventId/checkpoints/:cpId/skip', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/skip')
        .send({ reason: 'Station congested' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 for non-participant roles (crew)', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/skip')
        .set('Authorization', 'Bearer crew-token')
        .send({ reason: 'Station congested' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 for participant without teamId', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/skip')
        .set('Authorization', 'Bearer participant-no-team-token')
        .send({ reason: 'Station congested' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('successfully skips active checkpoint and advances sequence', async () => {
      mockSkipCheckpointService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        skippedCheckpointId: 'CP-002',
        nextCheckpointId: 'CP-003',
        skippedCheckpointIds: ['CP-002'],
        remainingSkips: 1,
      });

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-002/skip')
        .set('Authorization', 'Bearer participant-token')
        .send({ reason: 'Queue too long (> 5 teams)' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.skippedCheckpointId).toBe('CP-002');
      expect(res.body.data.nextCheckpointId).toBe('CP-003');
      expect(res.body.data.remainingSkips).toBe(1);
    });

    it('returns 422 SKIP_LIMIT_EXCEEDED when team exceeds allowed skips', async () => {
      mockSkipCheckpointService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.SKIP_LIMIT_EXCEEDED,
          'Had maksimum melangkau (2) telah dicapai oleh kumpulan anda.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-003/skip')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SKIP_LIMIT_EXCEEDED');
    });

    it('returns 400 CANNOT_SKIP_FINISH when attempting to skip finish station', async () => {
      mockSkipCheckpointService.mockRejectedValueOnce(
        new AppError(ErrorCode.CANNOT_SKIP_FINISH, 'Pos penamat tidak boleh dilangkau.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-TAMAT/skip')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_SKIP_FINISH');
    });

    it('returns 422 OUT_OF_SEQUENCE if checkpoint is not current sequence checkpoint', async () => {
      mockSkipCheckpointService.mockRejectedValueOnce(
        new AppError(ErrorCode.OUT_OF_SEQUENCE, 'Hanya pos semasa boleh dilangkau.')
      );

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-004/skip')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('OUT_OF_SEQUENCE');
    });
  });

  // ── FR-03: Finish Line Gatekeeper Route Tests ───────────────────────────────

  describe('POST /events/:eventId/finish', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/events/EVT-001/finish')
        .send({
          payload: '*:CP-TAMAT:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(401);
    });

    it('returns 422 INCOMPLETE_CHECKPOINTS with detailed pending and locked stations list', async () => {
      mockFinishRaceService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.INCOMPLETE_CHECKPOINTS,
          'Terdapat 2 pos kawalan yang belum diselesaikan sepenuhnya.',
          true,
          {
            uncompletedCheckpoints: [
              { id: 'CP-002', name: 'Tasik Titiwangsa', status: 'pending' },
              { id: 'CP-004', name: 'Astaka Seni', status: 'locked' },
            ],
          }
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/finish')
        .set('Authorization', 'Bearer participant-token')
        .send({
          payload: '*:CP-TAMAT:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INCOMPLETE_CHECKPOINTS');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details.uncompletedCheckpoints).toHaveLength(2);
      expect(res.body.error.details.uncompletedCheckpoints[0].status).toBe('pending');
      expect(res.body.error.details.uncompletedCheckpoints[1].status).toBe('locked');
    });

    it('returns 409 RACE_ALREADY_FINISHED on duplicate finish attempt', async () => {
      mockFinishRaceService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RACE_ALREADY_FINISHED,
          'Kumpulan anda telah pun menamatkan perlumbaan.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/finish')
        .set('Authorization', 'Bearer participant-token')
        .send({
          payload: '*:CP-TAMAT:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RACE_ALREADY_FINISHED');
    });

    it('successfully processes finish scan when all checkpoints are completed', async () => {
      mockFinishRaceService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        isFinished: true,
        finishedAt: '2026-09-03T10:30:00.000Z',
        elapsedSeconds: 5400,
        totalPoints: 350,
        penaltyPointsApplied: 0,
        completedCheckpointIds: ['CP-001', 'CP-002', 'CP-003', 'CP-TAMAT'],
      });

      const res = await request(app)
        .post('/events/EVT-001/finish')
        .set('Authorization', 'Bearer participant-token')
        .send({
          payload: '*:CP-TAMAT:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFinished).toBe(true);
      expect(res.body.data.elapsedSeconds).toBe(5400);
      expect(res.body.data.totalPoints).toBe(350);
      expect(res.body.data.penaltyPointsApplied).toBe(0);
    });

    it('applies late penalty points when race exceeds maxDurationSeconds', async () => {
      mockFinishRaceService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        isFinished: true,
        finishedAt: '2026-09-03T11:15:00.000Z',
        elapsedSeconds: 8100, // 900s (15 min) late
        totalPoints: 275, // 350 - (15 * 5) = 275
        penaltyPointsApplied: 75,
        completedCheckpointIds: ['CP-001', 'CP-002', 'CP-003', 'CP-TAMAT'],
      });

      const res = await request(app)
        .post('/events/EVT-001/finish')
        .set('Authorization', 'Bearer participant-token')
        .send({
          payload: '*:CP-TAMAT:1780000000000:1:abcdef',
          latitude: 3.1764,
          longitude: 101.7061,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.penaltyPointsApplied).toBe(75);
      expect(res.body.data.totalPoints).toBe(275);
    });
  });
});
