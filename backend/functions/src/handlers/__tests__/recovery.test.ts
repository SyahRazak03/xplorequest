/**
 * handlers/__tests__/recovery.test.ts
 *
 * Comprehensive test suite for Stage 14: FR-10 Session Recovery Engine.
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { authRouter } from '../auth';
import { teamsRouter } from '../teams';

// ── Mock Services ─────────────────────────────────────────────────────────────

const mockGetMe = jest.fn();
const mockGetTeamStateService = jest.fn();

jest.mock('../../services/auth.service', () => ({
  ...jest.requireActual('../../services/auth.service'),
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

jest.mock('../../services/recovery.service', () => ({
  ...jest.requireActual('../../services/recovery.service'),
  getTeamStateService: (...args: unknown[]) => mockGetTeamStateService(...args),
}));

// ── Mock Firebase Auth & Config ───────────────────────────────────────────────

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
        return { uid: 'crew-001', role: 'crew', eventId: 'EVT-001', checkpointId: 'CP-001' };
      }
      if (token === 'participant-team1-token') {
        return { uid: 'user-p1', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      if (token === 'participant-team2-token') {
        return { uid: 'user-p2', role: 'participant', teamId: 'TEAM-002', eventId: 'EVT-001' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Test App Setup ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use('/events', teamsRouter);
app.use(errorHandler);

describe('FR-10 Session Recovery Engine (Stage 14)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /auth/me Extended Endpoint', () => {
    // ── TC-ST14-01: Participant session getMe returns teamName & eventName ────
    it('TC-ST14-01: should return teamName and eventName for participant sessions', async () => {
      mockGetMe.mockResolvedValueOnce({
        uid: 'user-p1',
        role: 'participant',
        name: 'Pasukan Harimau',
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        eventId: 'EVT-001',
        eventName: 'XploreQuest 2026',
      });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer participant-team1-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        uid: 'user-p1',
        role: 'participant',
        name: 'Pasukan Harimau',
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        eventId: 'EVT-001',
        eventName: 'XploreQuest 2026',
      });
    });
  });

  describe('GET /events/:eventId/teams/:teamId/state Recovery Endpoint', () => {
    // ── TC-ST14-02: Unauthenticated request ────────────────────────────────────
    it('TC-ST14-02: should return 401 Unauthorized when Bearer token is missing', async () => {
      const res = await request(app).get('/events/EVT-001/teams/TEAM-001/state');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    // ── TC-ST14-03: Participant attempts reading another team state ──────────
    it('TC-ST14-03: should return 403 FORBIDDEN when participant attempts accessing another team state', async () => {
      mockGetTeamStateService.mockRejectedValueOnce(
        new (jest.requireActual('../../utils/errors').AppError)(
          jest.requireActual('../../utils/errors').ErrorCode.FORBIDDEN,
          'Akses ditolak: Anda hanya boleh mengakses status kumpulan anda sendiri.'
        )
      );

      const res = await request(app)
        .get('/events/EVT-001/teams/TEAM-001/state')
        .set('Authorization', 'Bearer participant-team2-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    // ── TC-ST14-04: Participant reads own team state ──────────────────────────
    it('TC-ST14-04: should return full TeamStateResponse for valid participant team leader', async () => {
      const mockState = {
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        eventId: 'EVT-001',
        eventName: 'XploreQuest 2026',
        status: 'approved',
        currentCheckpointId: 'CP-002',
        currentCheckpoint: {
          id: 'CP-002',
          name: 'Stesen 2 - Jambatan',
          clueText: 'Cari struktur kayu lama',
          taskDescription: 'Selesaikan teka-teki',
          scorePoints: 100,
          latitude: 3.139,
          longitude: 101.686,
          geofenceRadiusMeters: 50,
          isStart: false,
          isFinish: false,
        },
        completedCheckpointIds: ['CP-001'],
        skippedCheckpointIds: [],
        assignedSequence: ['CP-001', 'CP-002', 'CP-003', 'CP-TAMAT'],
        totalPoints: 100,
        penaltiesMinutes: 0,
        penaltyPoints: 0,
        isStarted: true,
        isFinished: false,
        finishedAt: null,
        startedAt: '2026-06-01T08:00:00.000Z',
        maxDurationSeconds: 7200,
        elapsedSeconds: 1800,
        remainingSeconds: 5400,
        isDNF: false,
        isDisqualified: false,
      };

      mockGetTeamStateService.mockResolvedValueOnce(mockState);

      const res = await request(app)
        .get('/events/EVT-001/teams/TEAM-001/state')
        .set('Authorization', 'Bearer participant-team1-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockState);
      expect(mockGetTeamStateService).toHaveBeenCalledWith(
        'EVT-001',
        'TEAM-001',
        expect.objectContaining({ uid: 'user-p1', role: 'participant', teamId: 'TEAM-001' })
      );
    });

    // ── TC-ST14-05: Admin or assigned crew reads team state ───────────────────
    it('TC-ST14-05: should allow admin or assigned crew to retrieve team state', async () => {
      mockGetTeamStateService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        eventId: 'EVT-001',
        eventName: 'XploreQuest 2026',
        status: 'approved',
        currentCheckpointId: 'CP-001',
        currentCheckpoint: null,
        completedCheckpointIds: [],
        skippedCheckpointIds: [],
        assignedSequence: ['CP-001', 'CP-002'],
        totalPoints: 0,
        penaltiesMinutes: 0,
        penaltyPoints: 0,
        isStarted: true,
        isFinished: false,
        finishedAt: null,
        startedAt: '2026-06-01T08:00:00.000Z',
        maxDurationSeconds: 7200,
        elapsedSeconds: 300,
        remainingSeconds: 6900,
        isDNF: false,
        isDisqualified: false,
      });

      const res = await request(app)
        .get('/events/EVT-001/teams/TEAM-001/state')
        .set('Authorization', 'Bearer crew-evt1-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockGetTeamStateService).toHaveBeenCalledWith(
        'EVT-001',
        'TEAM-001',
        expect.objectContaining({ uid: 'crew-001', role: 'crew' })
      );
    });

    // ── TC-ST14-06: Finished team state recovery ─────────────────────────────
    it('TC-ST14-06: should return remainingSeconds 0 and fixed elapsedSeconds for finished team', async () => {
      mockGetTeamStateService.mockResolvedValueOnce({
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        eventId: 'EVT-001',
        eventName: 'XploreQuest 2026',
        status: 'approved',
        currentCheckpointId: 'CP-TAMAT',
        currentCheckpoint: null,
        completedCheckpointIds: ['CP-001', 'CP-002', 'CP-TAMAT'],
        skippedCheckpointIds: [],
        assignedSequence: ['CP-001', 'CP-002', 'CP-TAMAT'],
        totalPoints: 300,
        penaltiesMinutes: 0,
        penaltyPoints: 0,
        isStarted: true,
        isFinished: true,
        finishedAt: '2026-06-01T09:30:00.000Z',
        startedAt: '2026-06-01T08:00:00.000Z',
        maxDurationSeconds: 7200,
        elapsedSeconds: 5400,
        remainingSeconds: 0,
        isDNF: false,
        isDisqualified: false,
      });

      const res = await request(app)
        .get('/events/EVT-001/teams/TEAM-001/state')
        .set('Authorization', 'Bearer participant-team1-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFinished).toBe(true);
      expect(res.body.data.remainingSeconds).toBe(0);
      expect(res.body.data.elapsedSeconds).toBe(5400);
    });
  });
});
