/**
 * handlers/__tests__/ownership.test.ts
 *
 * System-Wide Per-Event Ownership Enforcement Tests.
 * Tests assertEventOwner logic and authorization behavior across all event-scoped routers.
 */

import express from 'express';
import request from 'supertest';

// ── Mock Firebase Config & Repositories BEFORE Handler Imports ───────────────

jest.mock('../../config/firebase', () => {
  const docMock = {
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'EVT-OWN-100',
        createdBy: 'admin-owner-001',
        isStarted: false,
        isFinished: false,
      }),
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn().mockImplementation(() => collectionMock),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  const collectionMock = {
    doc: jest.fn().mockReturnValue(docMock),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
  };

  return {
    getAdminApp: jest.fn(),
    getFirestore: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue(collectionMock),
      runTransaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: 'EVT-OWN-100',
              createdBy: 'admin-owner-001',
              isStarted: false,
              isFinished: false,
            }),
          }),
          set: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
        });
      }),
    }),
    getAuth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'other-admin-token') {
          return { uid: 'admin-intruder-999', role: 'admin' };
        }
        if (token === 'crew-other-token') {
          return { uid: 'crew-001', role: 'crew', eventId: 'EVT-OTHER-200' };
        }
        if (token === 'crew-owned-token') {
          return { uid: 'crew-001', role: 'crew', eventId: 'EVT-OWN-100' };
        }
        return { uid: 'admin-owner-001', role: 'admin' };
      }),
    }),
    getStorage: jest.fn().mockReturnValue({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue(undefined),
          getSignedUrl: jest.fn().mockResolvedValue(['https://storage.example.com/asset.png']),
        }),
      }),
    }),
  };
});

jest.mock('../../repositories/event.repository', () => ({
  findEventById: jest.fn().mockImplementation(async (id: string) => {
    if (id === 'EVT-OWN-100') {
      return {
        id: 'EVT-OWN-100',
        name: 'Master Race 2026',
        joinCode: 'MR2026',
        date: '2026-09-20',
        startTime: '08:00 AM',
        maxDurationSeconds: 14400,
        locationName: 'Kuala Lumpur',
        totalCheckpoints: 5,
        maxTeamSize: 4,
        isStarted: false,
        startedAt: null,
        isFinished: false,
        createdBy: 'admin-owner-001',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
    }
    if (id === 'EVT-NO-OWNER') {
      return {
        id: 'EVT-NO-OWNER',
        name: 'Legacy Event',
        joinCode: 'LEGACY',
        date: '2026-09-20',
        startTime: '08:00 AM',
        maxDurationSeconds: 14400,
        locationName: 'Kuala Lumpur',
        totalCheckpoints: 5,
        maxTeamSize: 4,
        isStarted: false,
        startedAt: null,
        isFinished: false,
        createdBy: undefined,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
    }
    return null;
  }),
  findEventsByOwner: jest.fn().mockImplementation(async (ownerUid: string) => {
    if (ownerUid === 'admin-owner-001') {
      return [{
        id: 'EVT-OWN-100',
        name: 'Master Race 2026',
        createdBy: 'admin-owner-001',
      }];
    }
    return [];
  }),
  findAllEvents: jest.fn().mockResolvedValue([{ id: 'EVT-OWN-100', createdBy: 'admin-owner-001' }]),
  findActiveEvents: jest.fn().mockResolvedValue([]),
  getEventSecrets: jest.fn().mockResolvedValue({ crewPinCode: '1234', hmacSecret: 'secret' }),
  updateEvent: jest.fn().mockResolvedValue({ id: 'EVT-OWN-100', createdBy: 'admin-owner-001' }),
  archiveEvent: jest.fn().mockResolvedValue(undefined),
  eventHasTeams: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../repositories/checkpoint.repository', () => ({
  findCheckpointsByEvent: jest.fn().mockResolvedValue([]),
  findCheckpointById: jest.fn().mockResolvedValue({ id: 'CP-001', name: 'CP 1' }),
}));

jest.mock('../../repositories/team.repository', () => ({
  findTeamsByEvent: jest.fn().mockResolvedValue([]),
  findTeamById: jest.fn().mockResolvedValue(null),
}));

// ── Handler Imports ───────────────────────────────────────────────────────────

import type { EventDocument } from '../../models';
import { assertEventOwner } from '../../services/event.service';
import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { verifyFirebaseToken } from '../../middleware/auth';
import { checkpointsRouter } from '../checkpoints';
import { eventsRouter } from '../events';
import { leaderboardRouter } from '../leaderboard';
import { qrRouter } from '../qr';
import { rulesRouter } from '../rules';
import { startRouter } from '../start';
import { teamsRouter } from '../teams';
import { verificationRouter } from '../verification';

// ── Mock Event Document Helper ────────────────────────────────────────────────

function getTestEventDoc(override?: Partial<EventDocument>): EventDocument {
  return {
    id: 'EVT-OWN-100',
    name: 'Master Race 2026',
    joinCode: 'MR2026',
    date: '2026-09-20',
    startTime: '08:00 AM',
    maxDurationSeconds: 14400,
    locationName: 'Kuala Lumpur',
    totalCheckpoints: 5,
    maxTeamSize: 4,
    isStarted: false,
    startedAt: null,
    isFinished: false,
    createdBy: 'admin-owner-001',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...override,
  };
}

// ── App Setup ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', verifyFirebaseToken, checkpointsRouter);
app.use('/events', verifyFirebaseToken, teamsRouter);
app.use('/events', verifyFirebaseToken, rulesRouter);
app.use('/events', verifyFirebaseToken, qrRouter);
app.use('/events', verifyFirebaseToken, startRouter);
app.use('/events', verifyFirebaseToken, verificationRouter);
app.use('/events', verifyFirebaseToken, leaderboardRouter);
app.use('/events', verifyFirebaseToken, eventsRouter);
app.use(errorHandler);

// ── Direct assertEventOwner Helper Unit Tests ─────────────────────────────────

describe('assertEventOwner Helper', () => {
  it('allows access when admin is the event creator', () => {
    const doc = getTestEventDoc();
    expect(() => assertEventOwner(doc, 'admin-owner-001', 'admin')).not.toThrow();
  });

  it('rejects mismatched admin owner with 403 FORBIDDEN', () => {
    const doc = getTestEventDoc();
    expect(() => assertEventOwner(doc, 'admin-intruder-999', 'admin')).toThrow(
      'Anda tidak mempunyai kebenaran untuk menguruskan acara ini.'
    );

    try {
      assertEventOwner(doc, 'admin-intruder-999', 'admin');
    } catch (err) {
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('emits console.warn warning and permits access for unowned legacy event documents', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const unownedEvent = getTestEventDoc({ createdBy: undefined as unknown as string });

    expect(() => assertEventOwner(unownedEvent, 'admin-intruder-999', 'admin')).not.toThrow();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SECURITY WARNING] Event 'EVT-OWN-100' lacks 'createdBy' owner field.")
    );

    consoleWarnSpy.mockRestore();
  });

  it('allows access when crew is assigned to the matching eventId', () => {
    const doc = getTestEventDoc();
    expect(() => assertEventOwner(doc, 'crew-001', 'crew', 'EVT-OWN-100')).not.toThrow();
  });

  it('throws 403 FORBIDDEN when crew is assigned to a different eventId', () => {
    const doc = getTestEventDoc();
    expect(() => assertEventOwner(doc, 'crew-001', 'crew', 'EVT-OTHER-200')).toThrow(AppError);
  });
});

// ── Integration Router Tests ──────────────────────────────────────────────────

describe('System-Wide Per-Event Ownership Enforcement Endpoints', () => {
  describe('events.ts Router', () => {
    it('GET /events/:id returns 200 for owner admin', async () => {
      const res = await request(app)
        .get('/events/EVT-OWN-100')
        .set('Authorization', 'Bearer owner-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('EVT-OWN-100');
    });

    it('GET /events/:id returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .get('/events/EVT-OWN-100')
        .set('Authorization', 'Bearer other-admin-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('GET /events lists only events created by the caller admin', async () => {
      const res = await request(app)
        .get('/events')
        .set('Authorization', 'Bearer owner-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('PATCH /events/:id returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .patch('/events/EVT-OWN-100')
        .set('Authorization', 'Bearer other-admin-token')
        .send({ name: 'New Location' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('DELETE /events/:id returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .delete('/events/EVT-OWN-100')
        .set('Authorization', 'Bearer other-admin-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('GET /events/:id/crew-pin returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .get('/events/EVT-OWN-100/crew-pin')
        .set('Authorization', 'Bearer other-admin-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('checkpoints.ts Router', () => {
    it('GET /events/:eventId/checkpoints returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .get('/events/EVT-OWN-100/checkpoints')
        .set('Authorization', 'Bearer other-admin-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('POST /events/:eventId/checkpoints returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .post('/events/EVT-OWN-100/checkpoints')
        .set('Authorization', 'Bearer other-admin-token')
        .send({
          name: 'CP Check',
          latitude: 3.14,
          longitude: 101.69,
          clueText: 'Search under bridge',
          taskDescription: 'Solve math puzzle at station',
          scorePoints: 100,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('teams.ts Router', () => {
    it('GET /events/:eventId/teams returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .get('/events/EVT-OWN-100/teams')
        .set('Authorization', 'Bearer other-admin-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('PATCH /events/:eventId/teams/:teamId/status returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .patch('/events/EVT-OWN-100/teams/TEAM-1/status')
        .set('Authorization', 'Bearer other-admin-token')
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('rules.ts Router', () => {
    it('PUT /events/:eventId/rules returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .put('/events/EVT-OWN-100/rules')
        .set('Authorization', 'Bearer other-admin-token')
        .send({ latePenaltyMin: 15 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('qr.ts Router', () => {
    it('POST /events/:eventId/checkpoints/:cpId/qr returns 403 for wrong eventId crew', async () => {
      const res = await request(app)
        .post('/events/EVT-OWN-100/checkpoints/CP-001/qr')
        .set('Authorization', 'Bearer crew-other-token')
        .send({ forceRefresh: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('start.ts Router', () => {
    it('POST /events/:eventId/start returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .post('/events/EVT-OWN-100/start')
        .set('Authorization', 'Bearer other-admin-token')
        .send({ forceStart: false });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('verification.ts Router', () => {
    it('POST /events/:eventId/teams/:teamId/penalty returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .post('/events/EVT-OWN-100/teams/TEAM-1/penalty')
        .set('Authorization', 'Bearer other-admin-token')
        .send({ penaltyType: 'points', pointPenalty: 50, reason: 'Late show for brief' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('leaderboard.ts Router', () => {
    it('GET /events/:eventId/leaderboard returns 403 for non-owner admin', async () => {
      const res = await request(app)
        .get('/events/EVT-OWN-100/leaderboard')
        .set('Authorization', 'Bearer other-admin-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });
});
