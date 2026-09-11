/**
 * handlers/__tests__/events.test.ts
 *
 * Integration tests for the Event Management API handlers.
 * Uses Supertest against a real Express app with all dependencies mocked.
 *
 * Coverage:
 *   POST   /events
 *   GET    /events
 *   GET    /events/:id
 *   PATCH  /events/:id
 *   DELETE /events/:id
 *   GET    /events/:id/crew-pin
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { eventsRouter } from '../events';

// ── Shared test fixtures ──────────────────────────────────────────────────────

const ADMIN_EVENT: Record<string, unknown> = {
  id: 'EVT-001',
  name: 'Cabaran Rimba 2026',
  joinCode: 'XT2026',
  date: '27 Jun 2026',
  startTime: '08:00 AM',
  maxDurationSeconds: 14400,
  locationName: 'Taman Tasik Titiwangsa, KL',
  totalCheckpoints: 8,
  maxTeamSize: 4,
  isStarted: false,
  startedAt: null,
  isFinished: false,
  createdBy: 'admin-uid-001',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};


const PUBLIC_EVENT: Record<string, unknown> = {
  id: 'EVT-001',
  name: 'Cabaran Rimba 2026',
  date: '27 Jun 2026',
  startTime: '08:00 AM',
  locationName: 'Taman Tasik Titiwangsa, KL',
  totalCheckpoints: 8,
  maxTeamSize: 4,
  isStarted: false,
  isFinished: false,
  createdAt: '2026-06-01T00:00:00.000Z',
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
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'admin-uid-001',
      role: 'admin',
    }),
  }),
}));

// ── Mock: event service ───────────────────────────────────────────────────────

const mockCreateEventService = jest.fn();
const mockListEventsService = jest.fn();
const mockGetEventService = jest.fn();
const mockUpdateEventService = jest.fn();
const mockDeleteEventService = jest.fn();
const mockGetCrewPinService = jest.fn();

jest.mock('../../services/event.service', () => ({
  createEventService: (...args: unknown[]) => mockCreateEventService(...args),
  listEventsService: (...args: unknown[]) => mockListEventsService(...args),
  getEventService: (...args: unknown[]) => mockGetEventService(...args),
  updateEventService: (...args: unknown[]) => mockUpdateEventService(...args),
  deleteEventService: (...args: unknown[]) => mockDeleteEventService(...args),
  getCrewPinService: (...args: unknown[]) => mockGetCrewPinService(...args),
}));

// ── Mock: rate limiter (pass-through for unit tests) ──────────────────────────

jest.mock('../../middleware/rateLimiter', () => ({
  rateLimiter: () =>
    (_req: unknown, _res: unknown, next: () => void) => next(),
  clearRateLimit: jest.fn().mockResolvedValue(undefined),
}));

// ── Test App (admin-authenticated by default) ─────────────────────────────────

/**
 * Builds a test Express app with a configurable req.user payload injected
 * before the router so we can test different roles without real Firebase tokens.
 */
function buildApp(userOverride?: { uid?: string; role?: string }) {
  const app = express();
  app.use(express.json());

  // Inject mock user — replaces verifyFirebaseToken
  app.use((req, _res, next) => {
    req.user = {
      uid: userOverride?.uid ?? 'admin-uid-001',
      role: (userOverride?.role ?? 'admin') as 'admin' | 'crew' | 'participant',
      email: 'admin@xplorequest.com',
    };
    next();
  });

  app.use('/events', eventsRouter);
  app.use(errorHandler);
  return app;
}

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

describe('Events Handler', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /events ────────────────────────────────────────────────────────────

  describe('POST /events', () => {
    const validBody = {
      name: 'Cabaran Rimba 2026',
      date: '27 Jun 2026',
      startTime: '08:00 AM',
      maxDurationSeconds: 14400,
      locationName: 'Taman Tasik Titiwangsa, KL',
      totalCheckpoints: 8,
      maxTeamSize: 4,
    };

    it('returns 403 when called with crew role', async () => {
      const app = buildApp({ role: 'crew' });
      const res = await request(app).post('/events').send(validBody);

      expect(res.status).toBe(403);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 when called with participant role', async () => {
      const app = buildApp({ role: 'participant' });
      const res = await request(app).post('/events').send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 422 when name is missing', async () => {
      const app = buildApp();
      const { name: _n, ...bodyWithoutName } = validBody;
      const res = await request(app).post('/events').send(bodyWithoutName);

      expect(res.status).toBe(422);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 422 when maxDurationSeconds is 0', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/events')
        .send({ ...validBody, maxDurationSeconds: 0 });

      expect(res.status).toBe(422);
    });

    it('returns 422 when maxDurationSeconds is negative', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/events')
        .send({ ...validBody, maxDurationSeconds: -1 });

      expect(res.status).toBe(422);
    });

    it('returns 422 when totalCheckpoints is 0', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/events')
        .send({ ...validBody, totalCheckpoints: 0 });

      expect(res.status).toBe(422);
    });

    it('returns 422 when totalCheckpoints exceeds 50', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/events')
        .send({ ...validBody, totalCheckpoints: 51 });

      expect(res.status).toBe(422);
    });

    it('returns 422 when maxTeamSize exceeds 6', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/events')
        .send({ ...validBody, maxTeamSize: 7 });

      expect(res.status).toBe(422);
    });

    it('returns 422 when maxTeamSize is below 2', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/events')
        .send({ ...validBody, maxTeamSize: 1 });

      expect(res.status).toBe(422);
    });

    it('returns 409 when join code is already taken', async () => {
      const app = buildApp();
      mockCreateEventService.mockRejectedValueOnce(
        new AppError(ErrorCode.CONFLICT, "Kod penyertaan 'TAKEN1' sudah digunakan.")
      );

      const res = await request(app)
        .post('/events')
        .send({ ...validBody, joinCode: 'TAKEN1' });

      expect(res.status).toBe(409);
    });

    it('returns 201 with event document on valid creation', async () => {
      const app = buildApp();
      mockCreateEventService.mockResolvedValueOnce(ADMIN_EVENT);

      const res = await request(app).post('/events').send(validBody);

      expect(res.status).toBe(201);
      const body = res.body as ApiSuccess<typeof ADMIN_EVENT>;
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('EVT-001');
      expect(body.data.joinCode).toBe('XT2026');
      expect(mockCreateEventService).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Cabaran Rimba 2026' }),
        'admin-uid-001'
      );
    });

    it('returns 201 with auto-generated joinCode when not supplied', async () => {
      const app = buildApp();
      const autoEvent = { ...ADMIN_EVENT, joinCode: 'AUTOXQ' };
      mockCreateEventService.mockResolvedValueOnce(autoEvent);

      const { joinCode: _j, ...bodyWithoutCode } = { ...validBody, joinCode: undefined };
      const res = await request(app).post('/events').send(bodyWithoutCode);

      expect(res.status).toBe(201);
      const body = res.body as ApiSuccess<typeof autoEvent>;
      expect(body.data.joinCode).toBe('AUTOXQ');
    });
  });

  // ── GET /events ─────────────────────────────────────────────────────────────

  describe('GET /events', () => {
    it('returns 200 with full event list for admin', async () => {
      const app = buildApp({ role: 'admin' });
      mockListEventsService.mockResolvedValueOnce({
        role: 'admin',
        events: [ADMIN_EVENT],
      });

      const res = await request(app).get('/events');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<unknown[]>;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.meta?.['role']).toBe('admin');
      // Admin view includes joinCode
      expect((body.data[0] as typeof ADMIN_EVENT).joinCode).toBe('XT2026');
    });

    it('returns 200 with restricted fields for participant', async () => {
      const app = buildApp({ role: 'participant' });
      mockListEventsService.mockResolvedValueOnce({
        role: 'participant',
        events: [PUBLIC_EVENT],
      });

      const res = await request(app).get('/events');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<unknown[]>;
      expect(body.meta?.['role']).toBe('participant');
      // Public view must NOT include joinCode
      expect((body.data[0] as Record<string, unknown>)['joinCode']).toBeUndefined();
    });

    it('returns 200 with restricted fields for crew', async () => {
      const app = buildApp({ role: 'crew' });
      mockListEventsService.mockResolvedValueOnce({
        role: 'crew',
        events: [PUBLIC_EVENT],
      });

      const res = await request(app).get('/events');

      expect(res.status).toBe(200);
      expect(
        (res.body as ApiSuccess<unknown[]>).meta?.['role']
      ).toBe('crew');
    });
  });

  // ── GET /events/:id/crew-pin ─────────────────────────────────────────────────

  describe('GET /events/:id/crew-pin', () => {
    it('returns 403 for crew role', async () => {
      const app = buildApp({ role: 'crew' });
      const res = await request(app).get('/events/EVT-001/crew-pin');
      expect(res.status).toBe(403);
    });

    it('returns 403 for participant role', async () => {
      const app = buildApp({ role: 'participant' });
      const res = await request(app).get('/events/EVT-001/crew-pin');
      expect(res.status).toBe(403);
    });

    it('returns 404 when event does not exist', async () => {
      const app = buildApp({ role: 'admin' });
      mockGetCrewPinService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.')
      );

      const res = await request(app).get('/events/NONEXISTENT/crew-pin');
      expect(res.status).toBe(404);
    });

    it('returns 200 with crewPinCode for admin', async () => {
      const app = buildApp({ role: 'admin' });
      mockGetCrewPinService.mockResolvedValueOnce({ crewPinCode: '7842' });

      const res = await request(app).get('/events/EVT-001/crew-pin');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ crewPinCode: string }>;
      expect(body.success).toBe(true);
      expect(body.data.crewPinCode).toBe('7842');
      expect(mockGetCrewPinService).toHaveBeenCalledWith('EVT-001');
    });
  });

  // ── GET /events/:id ──────────────────────────────────────────────────────────

  describe('GET /events/:id', () => {
    it('returns 404 when event does not exist', async () => {
      const app = buildApp();
      mockGetEventService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.')
      );

      const res = await request(app).get('/events/NONEXISTENT');
      expect(res.status).toBe(404);
    });

    it('returns 200 with full event for admin', async () => {
      const app = buildApp({ role: 'admin' });
      mockGetEventService.mockResolvedValueOnce(ADMIN_EVENT);

      const res = await request(app).get('/events/EVT-001');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<typeof ADMIN_EVENT>;
      expect(body.data.joinCode).toBe('XT2026');
    });

    it('returns 200 with public view for participant', async () => {
      const app = buildApp({ role: 'participant' });
      mockGetEventService.mockResolvedValueOnce(PUBLIC_EVENT);

      const res = await request(app).get('/events/EVT-001');

      expect(res.status).toBe(200);
      expect(
        (res.body as ApiSuccess<Record<string, unknown>>).data['joinCode']
      ).toBeUndefined();
    });
  });

  // ── PATCH /events/:id ────────────────────────────────────────────────────────

  describe('PATCH /events/:id', () => {
    it('returns 403 for crew role', async () => {
      const app = buildApp({ role: 'crew' });
      const res = await request(app)
        .patch('/events/EVT-001')
        .send({ name: 'New Name' });
      expect(res.status).toBe(403);
    });

    it('returns 404 when event not found', async () => {
      const app = buildApp();
      mockUpdateEventService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.')
      );

      const res = await request(app)
        .patch('/events/NONEXISTENT')
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('returns 409 RACE_ALREADY_STARTED when changing maxDurationSeconds on started event', async () => {
      const app = buildApp();
      mockUpdateEventService.mockRejectedValueOnce(
        new AppError(ErrorCode.RACE_ALREADY_STARTED, 'Medan maxDurationSeconds tidak boleh diubah selepas lumba bermula.')
      );

      const res = await request(app)
        .patch('/events/EVT-STARTED')
        .send({ maxDurationSeconds: 7200 });

      expect(res.status).toBe(409);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('RACE_ALREADY_STARTED');
    });

    it('returns 200 on valid partial update', async () => {
      const app = buildApp();
      const updatedEvent = { ...ADMIN_EVENT, name: 'Updated Name' };
      mockUpdateEventService.mockResolvedValueOnce(updatedEvent);

      const res = await request(app)
        .patch('/events/EVT-001')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<typeof ADMIN_EVENT>;
      expect(body.data.name).toBe('Updated Name');
      expect(mockUpdateEventService).toHaveBeenCalledWith(
        'EVT-001',
        expect.objectContaining({ name: 'Updated Name' }),
        'admin-uid-001'
      );
    });

    it('returns 422 if patch body fails validation (totalCheckpoints > 50)', async () => {
      const app = buildApp();
      const res = await request(app)
        .patch('/events/EVT-001')
        .send({ totalCheckpoints: 51 });

      expect(res.status).toBe(422);
    });
  });

  // ── DELETE /events/:id ───────────────────────────────────────────────────────

  describe('DELETE /events/:id', () => {
    it('returns 403 for crew role', async () => {
      const app = buildApp({ role: 'crew' });
      const res = await request(app).delete('/events/EVT-001');
      expect(res.status).toBe(403);
    });

    it('returns 404 when event not found', async () => {
      const app = buildApp();
      mockDeleteEventService.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.')
      );

      const res = await request(app).delete('/events/NONEXISTENT');
      expect(res.status).toBe(404);
    });

    it('returns 409 when teams are attached', async () => {
      const app = buildApp();
      mockDeleteEventService.mockRejectedValueOnce(
        new AppError(ErrorCode.CONFLICT, 'Acara ini mempunyai kumpulan berdaftar.')
      );

      const res = await request(app).delete('/events/EVT-001');
      expect(res.status).toBe(409);
      const body = res.body as ApiError;
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 200 with archived=true when no teams attached', async () => {
      const app = buildApp();
      mockDeleteEventService.mockResolvedValueOnce(undefined);

      const res = await request(app).delete('/events/EVT-001');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ archived: boolean; eventId: string }>;
      expect(body.success).toBe(true);
      expect(body.data.archived).toBe(true);
      expect(body.data.eventId).toBe('EVT-001');
      expect(mockDeleteEventService).toHaveBeenCalledWith('EVT-001', 'admin-uid-001');
    });
  });

  // ── Validate: AppError propagation ──────────────────────────────────────────

  describe('AppError propagation', () => {
    it('forwards service errors to the global error handler', async () => {
      const app = buildApp();
      const { AppError: AE, ErrorCode: EC } = { AppError, ErrorCode };
      mockGetEventService.mockRejectedValueOnce(
        new AE(EC.INTERNAL_SERVER_ERROR, 'Unexpected failure')
      );

      const res = await request(app).get('/events/EVT-001');

      expect(res.status).toBe(500);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

});
