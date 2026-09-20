/**
 * handlers/__tests__/teams.test.ts
 *
 * Integration tests for the Team Registration and Team Management API handlers.
 * Uses Supertest against an Express app with all dependencies mocked.
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { teamsRouter } from '../teams';

// ── Shared Test Fixtures ──────────────────────────────────────────────────────

const MOCK_TEAM = {
  id: 'TEAM-001',
  name: 'Pasukan Harimau',
  status: 'pending',
  memberCount: 4,
  leaderName: 'Ali bin Abu',
  membersList: 'Abu, Ahmad, Amin',
  phone: '+60123456789',
  eventId: 'EVT-001',
  startCheckpointId: 'CP-START',
  currentCheckpointId: 'CP-START',
  completedCheckpointIds: [],
  skippedCheckpointIds: [],
  totalPoints: 0,
  penaltiesMinutes: 0,
  penaltyPoints: 0,
  isDNF: false,
  isDisqualified: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const APPROVED_TEAM = {
  ...MOCK_TEAM,
  status: 'approved',
};

// ── Mock: Firebase config ─────────────────────────────────────────────────────

interface MockTx {
  get: jest.Mock;
  set: jest.Mock;
  update: jest.Mock;
}

jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      }),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    }),
    runTransaction: jest.fn().mockImplementation(
      async (cb: (tx: MockTx) => Promise<unknown>) => {
        const tx: MockTx = {
          get: jest.fn().mockResolvedValue({ exists: false }),
          set: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
        };
        return cb(tx);
      }
    ),
  }),
  getAuth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn().mockImplementation(async (token: string) => {
      if (token === 'admin-token') {
        return { uid: 'admin-123', role: 'admin' };
      }
      if (token === 'crew-token') {
        return { uid: 'crew-123', role: 'crew', eventId: 'EVT-001' };
      }
      if (token === 'participant-token') {
        return { uid: 'participant-123', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Mock: Team Service ────────────────────────────────────────────────────────

const mockRegisterTeamService = jest.fn();
const mockListTeamsService = jest.fn();
const mockGetTeamService = jest.fn();
const mockUpdateTeamService = jest.fn();
const mockSetTeamStatusService = jest.fn();
const mockDeleteTeamService = jest.fn();

jest.mock('../../services/team.service', () => ({
  registerTeamService: (...args: unknown[]) => mockRegisterTeamService(...args),
  listTeamsService: (...args: unknown[]) => mockListTeamsService(...args),
  getTeamService: (...args: unknown[]) => mockGetTeamService(...args),
  updateTeamService: (...args: unknown[]) => mockUpdateTeamService(...args),
  setTeamStatusService: (...args: unknown[]) => mockSetTeamStatusService(...args),
  deleteTeamService: (...args: unknown[]) => mockDeleteTeamService(...args),
}));

// ── Mock: Rate limiter ────────────────────────────────────────────────────────

jest.mock('../../middleware/rateLimiter', () => ({
  rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  clearRateLimit: jest.fn().mockResolvedValue(undefined),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', teamsRouter);
app.use(errorHandler);

// ── Response type helpers ─────────────────────────────────────────────────────

interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiError {
  success: false;
  error: { code: string; message: string };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Teams Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /events/:eventId/teams ─────────────────────────────────────────────

  describe('POST /events/:eventId/teams', () => {
    const validBody = {
      name: 'Pasukan Harimau',
      leaderName: 'Ali bin Abu',
      memberCount: 4,
      membersList: 'Abu, Ahmad, Amin',
      phone: '+60123456789',
      joinCode: 'XT2026',
    };

    it('returns 422 if team name is missing', async () => {
      const res = await request(app)
        .post('/events/EVT-001/teams')
        .send({ ...validBody, name: '' });

      expect(res.status).toBe(422);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 422 if memberCount exceeds 6', async () => {
      const res = await request(app)
        .post('/events/EVT-001/teams')
        .send({ ...validBody, memberCount: 7 });

      expect(res.status).toBe(422);
    });

    it('returns 404 if event is not found', async () => {
      mockRegisterTeamService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui atau kod penyertaan tidak sah.')
      );

      const res = await request(app)
        .post('/events/INVALID_EVENT/teams')
        .send(validBody);

      expect(res.status).toBe(404);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 if team name is already taken in this event', async () => {
      mockRegisterTeamService.mockRejectedValueOnce(
        new AppError(ErrorCode.CONFLICT, "Nama kumpulan 'Pasukan Harimau' sudah didaftarkan untuk acara ini.")
      );

      const res = await request(app)
        .post('/events/EVT-001/teams')
        .send(validBody);

      expect(res.status).toBe(409);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 201 and creates team with pending status on valid registration', async () => {
      mockRegisterTeamService.mockResolvedValueOnce(MOCK_TEAM);

      const res = await request(app)
        .post('/events/EVT-001/teams')
        .send(validBody);

      expect(res.status).toBe(201);
      const body = res.body as ApiSuccess<typeof MOCK_TEAM>;
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('TEAM-001');
      expect(body.data.status).toBe('pending');
      expect(mockRegisterTeamService).toHaveBeenCalledWith(
        'EVT-001',
        expect.objectContaining({ name: 'Pasukan Harimau' })
      );
    });
  });

  // ── GET /events/:eventId/teams ──────────────────────────────────────────────

  describe('GET /events/:eventId/teams', () => {
    it('returns 401 if missing Authorization header', async () => {
      const res = await request(app).get('/events/EVT-001/teams');
      expect(res.status).toBe(401);
    });

    it('returns 200 with all teams for admin', async () => {
      mockListTeamsService.mockResolvedValueOnce([MOCK_TEAM, APPROVED_TEAM]);

      const res = await request(app)
        .get('/events/EVT-001/teams')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<typeof MOCK_TEAM[]>;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(mockListTeamsService).toHaveBeenCalledWith(
        'EVT-001',
        'admin',
        'admin-123',
        undefined,
        undefined
      );
    });

    it('returns 200 for crew', async () => {
      mockListTeamsService.mockResolvedValueOnce([MOCK_TEAM]);

      const res = await request(app)
        .get('/events/EVT-001/teams')
        .set('Authorization', 'Bearer crew-token');

      expect(res.status).toBe(200);
      expect(mockListTeamsService).toHaveBeenCalledWith(
        'EVT-001',
        'crew',
        'crew-123',
        undefined,
        'EVT-001'
      );
    });
  });

  // ── GET /events/:eventId/teams/:teamId ───────────────────────────────────────

  describe('GET /events/:eventId/teams/:teamId', () => {
    it('returns 404 when team does not exist', async () => {
      mockGetTeamService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.')
      );

      const res = await request(app)
        .get('/events/EVT-001/teams/NONEXISTENT')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(404);
    });

    it('returns 200 with team details for admin', async () => {
      mockGetTeamService.mockResolvedValueOnce(MOCK_TEAM);

      const res = await request(app)
        .get('/events/EVT-001/teams/TEAM-001')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<typeof MOCK_TEAM>;
      expect(body.data.id).toBe('TEAM-001');
    });
  });

  // ── PATCH /events/:eventId/teams/:teamId ────────────────────────────────────

  describe('PATCH /events/:eventId/teams/:teamId', () => {
    it('returns 403 for participant', async () => {
      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001')
        .set('Authorization', 'Bearer participant-token')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(403);
    });

    it('returns 200 on valid update by admin', async () => {
      const updated = { ...MOCK_TEAM, name: 'Harimau Malaya' };
      mockUpdateTeamService.mockResolvedValueOnce(updated);

      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Harimau Malaya' });

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<typeof MOCK_TEAM>;
      expect(body.data.name).toBe('Harimau Malaya');
      expect(mockUpdateTeamService).toHaveBeenCalledWith(
        'EVT-001',
        'TEAM-001',
        expect.objectContaining({ name: 'Harimau Malaya' }),
        'admin-123',
        'admin',
        undefined
      );
    });
  });

  // ── PATCH /events/:eventId/teams/:teamId/status ─────────────────────────────

  describe('PATCH /events/:eventId/teams/:teamId/status', () => {
    it('returns 403 for participant', async () => {
      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001/status')
        .set('Authorization', 'Bearer participant-token')
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
    });

    it('returns 422 if status is invalid', async () => {
      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(422);
    });

    it('returns 200 and updates status to approved by admin', async () => {
      mockSetTeamStatusService.mockResolvedValueOnce(APPROVED_TEAM);

      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<typeof APPROVED_TEAM>;
      expect(body.data.status).toBe('approved');
      expect(mockSetTeamStatusService).toHaveBeenCalledWith(
        'EVT-001',
        'TEAM-001',
        'approved',
        'admin-123',
        'admin',
        undefined
      );
    });

    it('returns 409 RACE_ALREADY_STARTED when setting status after race start', async () => {
      mockSetTeamStatusService.mockRejectedValueOnce(
        new AppError(ErrorCode.RACE_ALREADY_STARTED, 'Status kumpulan tidak boleh diubah selepas lumba bermula.')
      );

      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'rejected' });

      expect(res.status).toBe(409);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('RACE_ALREADY_STARTED');
    });

    it('returns 409 CONFLICT when reverting active authenticated team back to pending', async () => {
      mockSetTeamStatusService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.CONFLICT,
          'Kumpulan ini telah mempunyai sesi aktif / telah log masuk. Tidak boleh ditukar kembali kepada status tertunda.'
        )
      );

      const res = await request(app)
        .patch('/events/EVT-001/teams/TEAM-001/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'pending' });

      expect(res.status).toBe(409);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('CONFLICT');
    });
  });

  // ── DELETE /events/:eventId/teams/:teamId ───────────────────────────────────

  describe('DELETE /events/:eventId/teams/:teamId', () => {
    it('returns 403 for crew', async () => {
      const res = await request(app)
        .delete('/events/EVT-001/teams/TEAM-001')
        .set('Authorization', 'Bearer crew-token');

      expect(res.status).toBe(403);
    });

    it('returns 404 if team not found', async () => {
      mockDeleteTeamService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.')
      );

      const res = await request(app)
        .delete('/events/EVT-001/teams/NONEXISTENT')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(404);
    });

    it('returns 409 RACE_ALREADY_STARTED if trying to delete team after race started', async () => {
      mockDeleteTeamService.mockRejectedValueOnce(
        new AppError(ErrorCode.RACE_ALREADY_STARTED, 'Kumpulan tidak boleh dipadam selepas lumba bermula.')
      );

      const res = await request(app)
        .delete('/events/EVT-001/teams/TEAM-001')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(409);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('RACE_ALREADY_STARTED');
    });

    it('returns 200 when deleted by admin', async () => {
      mockDeleteTeamService.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete('/events/EVT-001/teams/TEAM-001')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ deleted: boolean; eventId: string; teamId: string }>;
      expect(body.data.deleted).toBe(true);
      expect(mockDeleteTeamService).toHaveBeenCalledWith('EVT-001', 'TEAM-001', 'admin-123', 'admin', undefined);
    });
  });
});
