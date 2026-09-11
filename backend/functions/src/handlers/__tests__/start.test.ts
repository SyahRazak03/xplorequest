/**
 * handlers/__tests__/start.test.ts
 *
 * Integration tests for Staggered Start, Cyclical Assignment, Attendance Check-in, and Late Assignment.
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { startRouter } from '../start';

// ── Shared Fixtures ───────────────────────────────────────────────────────────

const MOCK_TEAM_1 = {
  id: 'TEAM-001',
  name: 'Pasukan Harimau',
  status: 'approved',
  memberCount: 4,
  startCheckpointId: 'CP-START',
  currentCheckpointId: 'CP-START',
  completedCheckpointIds: [],
  skippedCheckpointIds: [],
  totalPoints: 0,
  penaltiesMinutes: 0,
  penaltyPoints: 0,
  isDNF: false,
  isDisqualified: false,
  eventId: 'EVT-001',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const MOCK_START_RESULT = {
  eventId: 'EVT-001',
  isRaceStarted: true,
  raceStartTime: 1780000000000,
  startedAt: '2026-06-01T08:00:00.000Z',
  totalEligible: 2,
  totalAbsent: 1,
  assignments: [
    {
      teamId: 'TEAM-001',
      teamName: 'Pasukan Harimau',
      startCheckpointId: 'CP-001',
      startCheckpointName: 'Main Fountain',
      currentCheckpointId: 'CP-001',
    },
    {
      teamId: 'TEAM-002',
      teamName: 'Team Garuda',
      startCheckpointId: 'CP-002',
      startCheckpointName: 'Jambatan Gantung',
      currentCheckpointId: 'CP-002',
    },
  ],
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

// ── Mock: Start Service ───────────────────────────────────────────────────────

const mockCheckinAttendanceService = jest.fn();
const mockTriggerStaggeredStartService = jest.fn();
const mockAssignLateArrivalService = jest.fn();

jest.mock('../../services/start.service', () => ({
  checkinAttendanceService: (...args: unknown[]) => mockCheckinAttendanceService(...args),
  triggerStaggeredStartService: (...args: unknown[]) => mockTriggerStaggeredStartService(...args),
  assignLateArrivalService: (...args: unknown[]) => mockAssignLateArrivalService(...args),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', startRouter);
app.use(errorHandler);

jest.setTimeout(15000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Start & Attendance Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /events/:eventId/attendance/checkin ────────────────────────────────

  describe('POST /events/:eventId/attendance/checkin', () => {
    it('returns 401 for unauthenticated caller', async () => {
      const res = await request(app)
        .post('/events/EVT-001/attendance/checkin')
        .send({ teamId: 'TEAM-001' });

      expect(res.status).toBe(401);
    });

    it('returns 403 for participant role', async () => {
      const res = await request(app)
        .post('/events/EVT-001/attendance/checkin')
        .set('Authorization', 'Bearer participant-token')
        .send({ teamId: 'TEAM-001' });

      expect(res.status).toBe(403);
    });

    it('returns 422 if teamId is empty', async () => {
      const res = await request(app)
        .post('/events/EVT-001/attendance/checkin')
        .set('Authorization', 'Bearer crew-token')
        .send({ teamId: '' });

      expect(res.status).toBe(422);
    });

    it('returns 200 on successful checkin by crew', async () => {
      mockCheckinAttendanceService.mockResolvedValueOnce({
        ...MOCK_TEAM_1,
        isPresent: true,
        attendanceStatus: 'present',
      });

      const res = await request(app)
        .post('/events/EVT-001/attendance/checkin')
        .set('Authorization', 'Bearer crew-token')
        .send({ teamId: 'TEAM-001' });

      expect(res.status).toBe(200);
      expect(res.body.data.isPresent).toBe(true);
      expect(res.body.data.attendanceStatus).toBe('present');
      expect(mockCheckinAttendanceService).toHaveBeenCalledWith(
        'EVT-001',
        { teamId: 'TEAM-001' },
        'crew-123'
      );
    });
  });

  // ── POST /events/:eventId/start ─────────────────────────────────────────────

  describe('POST /events/:eventId/start', () => {
    it('returns 403 for participant', async () => {
      const res = await request(app)
        .post('/events/EVT-001/start')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 409 RACE_ALREADY_STARTED if already started (idempotency)', async () => {
      mockTriggerStaggeredStartService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RACE_ALREADY_STARTED,
          'Perlumbaan untuk acara ini telah pun dimulakan.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/start')
        .set('Authorization', 'Bearer admin-token')
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RACE_ALREADY_STARTED');
    });

    it('returns 400 BAD_REQUEST if no teams checked in and not forceStart', async () => {
      mockTriggerStaggeredStartService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.BAD_REQUEST,
          'Tiada kumpulan hadir untuk memulakan perlumbaan.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/start')
        .set('Authorization', 'Bearer admin-token')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 200 on successful race start and cyclical assignment', async () => {
      mockTriggerStaggeredStartService.mockResolvedValueOnce(MOCK_START_RESULT);

      const res = await request(app)
        .post('/events/EVT-001/start')
        .set('Authorization', 'Bearer admin-token')
        .send({ forceStart: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isRaceStarted).toBe(true);
      expect(res.body.data.assignments).toHaveLength(2);
      expect(mockTriggerStaggeredStartService).toHaveBeenCalledWith(
        'EVT-001',
        'admin-123',
        false
      );
    });
  });

  // ── POST /events/:eventId/teams/:teamId/late-assign ─────────────────────────

  describe('POST /events/:eventId/teams/:teamId/late-assign', () => {
    it('returns 403 for participant', async () => {
      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/late-assign')
        .set('Authorization', 'Bearer participant-token')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 409 RACE_NOT_STARTED if race has not started yet', async () => {
      mockAssignLateArrivalService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RACE_NOT_STARTED,
          'Perlumbaan belum bermula. Sila gunakan pelepasan mula biasa.'
        )
      );

      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/late-assign')
        .set('Authorization', 'Bearer crew-token')
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RACE_NOT_STARTED');
    });

    it('returns 200 on successful late assignment to least-crowded checkpoint', async () => {
      const lateResult = {
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        assignedCheckpointId: 'CP-003',
        assignedCheckpointName: 'Taman Laman Flora',
        currentCheckpointId: 'CP-003',
        activeTeamCountAtCheckpoint: 0,
        startedAt: '2026-06-01T08:30:00.000Z',
      };

      mockAssignLateArrivalService.mockResolvedValueOnce(lateResult);

      const res = await request(app)
        .post('/events/EVT-001/teams/TEAM-001/late-assign')
        .set('Authorization', 'Bearer crew-token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.assignedCheckpointId).toBe('CP-003');
      expect(mockAssignLateArrivalService).toHaveBeenCalledWith(
        'EVT-001',
        'TEAM-001',
        'crew-123',
        {}
      );
    });
  });
});
