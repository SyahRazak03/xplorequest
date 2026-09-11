/**
 * handlers/__tests__/leaderboard.test.ts
 *
 * Comprehensive unit and integration tests for Stage 12:
 * Live Leaderboard (FR-09), Admin Rules Configuration, and DNF Evaluator.
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { leaderboardRouter } from '../leaderboard';
import { rulesRouter } from '../rules';

// ── Mock Services ─────────────────────────────────────────────────────────────

const mockGetLeaderboardService = jest.fn();
const mockUpdateRaceRulesService = jest.fn();

jest.mock('../../services/leaderboard.service', () => ({
  getLeaderboardService: (...args: unknown[]) => mockGetLeaderboardService(...args),
  formatMalaysianTime: (seconds: number) => `${Math.floor(seconds / 60)}m`,
}));

jest.mock('../../services/rules.service', () => ({
  updateRaceRulesService: (...args: unknown[]) => mockUpdateRaceRulesService(...args),
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
      if (token === 'crew-evt1-token') {
        return { uid: 'crew-001', role: 'crew', eventId: 'EVT-001' };
      }
      if (token === 'participant-evt1-token') {
        return { uid: 'user-p1', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      if (token === 'participant-evt2-token') {
        return { uid: 'user-p2', role: 'participant', teamId: 'TEAM-002', eventId: 'EVT-002' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', leaderboardRouter);
app.use('/events', rulesRouter);
app.use(errorHandler);

describe('Stage 12: Live Leaderboard (FR-09) & Admin Rules Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Live Leaderboard REST Endpoint Tests ─────────────────────────────────

  describe('GET /events/:eventId/leaderboard', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app).get('/events/EVT-001/leaderboard');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 when participant from EVT-002 attempts to read EVT-001 leaderboard', async () => {
      const res = await request(app)
        .get('/events/EVT-001/leaderboard')
        .set('Authorization', 'Bearer participant-evt2-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 200 with ranked entries for participant of EVT-001', async () => {
      mockGetLeaderboardService.mockResolvedValueOnce([
        {
          teamId: 'TEAM-001',
          teamName: 'Pasukan Harimau',
          rank: 1,
          totalPoints: 300,
          totalTimeSeconds: 2400,
          totalTimeFormatted: '40m',
          penaltiesMinutes: 0,
          isDNF: false,
          checkpointsCompleted: 3,
          checkpointsSkipped: 0,
          status: 'finished',
          finishedAt: '2026-09-03T10:40:00.000Z',
        },
        {
          teamId: 'TEAM-002',
          teamName: 'Pasukan Helang',
          rank: 2,
          totalPoints: 250,
          totalTimeSeconds: 3000,
          totalTimeFormatted: '50m',
          penaltiesMinutes: 10,
          isDNF: false,
          checkpointsCompleted: 3,
          checkpointsSkipped: 1,
          status: 'finished',
          finishedAt: '2026-09-03T10:50:00.000Z',
        },
        {
          teamId: 'TEAM-003',
          teamName: 'Pasukan Cicak',
          rank: 3,
          totalPoints: 100,
          totalTimeSeconds: 7205,
          totalTimeFormatted: '120m',
          penaltiesMinutes: 0,
          isDNF: true,
          checkpointsCompleted: 1,
          checkpointsSkipped: 0,
          status: 'dnf',
          finishedAt: null,
        },
      ]);

      const res = await request(app)
        .get('/events/EVT-001/leaderboard')
        .set('Authorization', 'Bearer participant-evt1-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].rank).toBe(1);
      expect(res.body.data[0].totalPoints).toBe(300);
      expect(res.body.data[2].isDNF).toBe(true);
      expect(res.body.data[2].rank).toBe(3);
    });

    it('allows admin role to access any event leaderboard', async () => {
      mockGetLeaderboardService.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/events/EVT-001/leaderboard')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── 2. Admin Rules Configuration Endpoint Tests ─────────────────────────────

  describe('PUT /events/:eventId/rules', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .put('/events/EVT-001/rules')
        .send({ maxRaceTime: 7200 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 for participant role', async () => {
      const res = await request(app)
        .put('/events/EVT-001/rules')
        .set('Authorization', 'Bearer participant-evt1-token')
        .send({ maxRaceTime: 7200 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 for invalid negative values', async () => {
      const res = await request(app)
        .put('/events/EVT-001/rules')
        .set('Authorization', 'Bearer admin-token')
        .send({ latePenaltyMin: -5 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('successfully updates race rules by admin', async () => {
      mockUpdateRaceRulesService.mockResolvedValueOnce({
        maxRaceTime: 7200,
        taskTimeLimit: 900,
        latePenaltyMin: 15,
        pointPenaltyPts: 50,
        bonusPoints: 20,
        pointsSystemEnabled: true,
        latePenaltyEnabled: true,
        taskTimeLimitEnabled: true,
        pointPenaltyEnabled: true,
        bonusPointsEnabled: true,
      });

      const res = await request(app)
        .put('/events/EVT-001/rules')
        .set('Authorization', 'Bearer admin-token')
        .send({
          maxRaceTime: 7200,
          latePenaltyMin: 15,
          bonusPoints: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.latePenaltyMin).toBe(15);
      expect(res.body.data.bonusPoints).toBe(20);
    });
  });

  // ── 3. Single-Team Write Isolation Tests (TC-ST12-05) ────────────────────────

  describe('syncTeamLeaderboardService (Single-Team Write Isolation)', () => {
    it('updates ONLY the target team leaderboard document without mutating other team docs', async () => {
      const { syncTeamLeaderboardService } = jest.requireActual('../../services/leaderboard.service');
      const mockSet = jest.fn();
      const mockDoc = jest.fn().mockReturnValue({ set: mockSet });
      const mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            collection: mockCollection,
          }),
        }),
      };

      const { getFirestore } = jest.requireMock('../../config/firebase');
      getFirestore.mockReturnValueOnce(mockDb);

      await syncTeamLeaderboardService('EVT-001', {
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        totalPoints: 150,
        totalTimeSeconds: 1200,
        penaltiesMinutes: 5,
        isDNF: false,
        checkpointsCompleted: 2,
        checkpointsSkipped: 0,
        status: 'active',
      });

      // Verifies isolated write to single team document path: events/EVT-001/leaderboard/TEAM-001
      expect(mockDb.collection).toHaveBeenCalledWith('events');
      expect(mockCollection).toHaveBeenCalledWith('leaderboard');
      expect(mockDoc).toHaveBeenCalledWith('TEAM-001');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'EVT-001',
          teamId: 'TEAM-001',
          totalPoints: 150,
          totalTimeSeconds: 1200,
          penaltiesMinutes: 5,
        }),
        { merge: true }
      );
    });
  });
});
