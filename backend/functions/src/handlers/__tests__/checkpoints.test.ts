/**
 * handlers/__tests__/checkpoints.test.ts
 *
 * Integration tests for Boundary and Checkpoint Management endpoints.
 */

import express from 'express';
import request from 'supertest';

import { AppError, ErrorCode, errorHandler } from '../../utils/errors';
import { checkpointsRouter } from '../checkpoints';

// ── Shared Test Fixtures ──────────────────────────────────────────────────────

const MOCK_CHECKPOINT = {
  id: 'CP-001',
  name: 'Main Fountain',
  latitude: 3.1725,
  longitude: 101.7082,
  clueText: 'Cari air pancut utama berdekatan tasik.',
  taskDescription: 'Ambil gambar kumpulan bersama marshal.',
  scorePoints: 100,
  geofenceRadiusMeters: 50,
  isStart: false,
  isFinish: false,
  isHiddenInMap: false,
  orderIndex: 1,
  eventId: 'EVT-001',
  statusPerTeam: {},
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const MASKED_CHECKPOINT = {
  id: 'CP-002',
  name: 'Pos Rahsia',
  orderIndex: 2,
  isStart: false,
  isFinish: false,
  isLocked: true,
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
    batch: jest.fn().mockReturnValue({
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
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

// ── Mock: Checkpoint Service ──────────────────────────────────────────────────

const mockSaveBoundaryService = jest.fn();
const mockCreateCheckpointService = jest.fn();
const mockListCheckpointsService = jest.fn();
const mockGetCheckpointService = jest.fn();
const mockUpdateCheckpointService = jest.fn();
const mockReorderCheckpointsService = jest.fn();
const mockDeleteCheckpointService = jest.fn();

jest.mock('../../services/checkpoint.service', () => ({
  saveBoundaryService: (...args: unknown[]) => mockSaveBoundaryService(...args),
  createCheckpointService: (...args: unknown[]) => mockCreateCheckpointService(...args),
  listCheckpointsService: (...args: unknown[]) => mockListCheckpointsService(...args),
  getCheckpointService: (...args: unknown[]) => mockGetCheckpointService(...args),
  updateCheckpointService: (...args: unknown[]) => mockUpdateCheckpointService(...args),
  reorderCheckpointsService: (...args: unknown[]) => mockReorderCheckpointsService(...args),
  deleteCheckpointService: (...args: unknown[]) => mockDeleteCheckpointService(...args),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events', checkpointsRouter);
app.use(errorHandler);

// ── Tests ─────────────────────────────────────────────────────────────────────

jest.setTimeout(15000);

describe('Checkpoints Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── PUT /events/:eventId/boundary ───────────────────────────────────────────

  describe('PUT /events/:eventId/boundary', () => {
    const validBoundary = [
      { x: 15, y: 25 },
      { x: 50, y: 15 },
      { x: 85, y: 25 },
      { x: 80, y: 75 },
      { x: 20, y: 75 },
    ];

    it('returns 401 if unauthenticated', async () => {
      const res = await request(app)
        .put('/events/EVT-001/boundary')
        .send({ boundary: validBoundary });

      expect(res.status).toBe(401);
    });

    it('returns 403 for crew role', async () => {
      const res = await request(app)
        .put('/events/EVT-001/boundary')
        .set('Authorization', 'Bearer crew-token')
        .send({ boundary: validBoundary });

      expect(res.status).toBe(403);
    });

    it('returns 422 if boundary has fewer than 3 vertices', async () => {
      const res = await request(app)
        .put('/events/EVT-001/boundary')
        .set('Authorization', 'Bearer admin-token')
        .send({ boundary: [{ x: 10, y: 10 }, { x: 20, y: 20 }] });

      expect(res.status).toBe(422);
    });

    it('returns 409 RACE_ALREADY_STARTED if race already started', async () => {
      mockSaveBoundaryService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.RACE_ALREADY_STARTED,
          'Sempadan geofence tidak boleh diubah selepas perlumbaan bermula.'
        )
      );

      const res = await request(app)
        .put('/events/EVT-001/boundary')
        .set('Authorization', 'Bearer admin-token')
        .send({ boundary: validBoundary });

      expect(res.status).toBe(409);
    });

    it('returns 200 on valid boundary saving by admin', async () => {
      mockSaveBoundaryService.mockResolvedValueOnce({
        eventId: 'EVT-001',
        boundary: validBoundary,
      });

      const res = await request(app)
        .put('/events/EVT-001/boundary')
        .set('Authorization', 'Bearer admin-token')
        .send({ boundary: validBoundary });

      expect(res.status).toBe(200);
      expect(mockSaveBoundaryService).toHaveBeenCalledWith(
        'EVT-001',
        validBoundary,
        'admin-123'
      );
    });
  });

  // ── POST /events/:eventId/checkpoints ───────────────────────────────────────

  describe('POST /events/:eventId/checkpoints', () => {
    const validBody = {
      name: 'Main Fountain',
      latitude: 3.1725,
      longitude: 101.7082,
      clueText: 'Cari air pancut utama berdekatan tasik.',
      taskDescription: 'Ambil gambar kumpulan bersama marshal.',
      scorePoints: 100,
      geofenceRadiusMeters: 50,
    };

    it('returns 403 for participant', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer participant-token')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 422 if geofenceRadiusMeters is less than 10', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer admin-token')
        .send({ ...validBody, geofenceRadiusMeters: 5 });

      expect(res.status).toBe(422);
    });

    it('returns 422 if geofenceRadiusMeters exceeds 150', async () => {
      const res = await request(app)
        .post('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer admin-token')
        .send({ ...validBody, geofenceRadiusMeters: 200 });

      expect(res.status).toBe(422);
    });

    it('returns 201 with checkpoint document and boundary warning if applicable', async () => {
      mockCreateCheckpointService.mockResolvedValueOnce({
        checkpoint: MOCK_CHECKPOINT,
        warning: 'Koordinat pos kawalan terletak di luar sempadan geofence acara.',
      });

      const res = await request(app)
        .post('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer admin-token')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('CP-001');
      expect(res.body.meta.warning).toBeDefined();
    });

    it('passes isFinish: true and isStart: true flags correctly to service', async () => {
      const finishCheckpoint = { ...MOCK_CHECKPOINT, id: 'CP-TAMAT', isFinish: true };
      mockCreateCheckpointService.mockResolvedValueOnce({
        checkpoint: finishCheckpoint,
      });

      const res = await request(app)
        .post('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer admin-token')
        .send({ ...validBody, isFinish: true });

      expect(res.status).toBe(201);
      expect(mockCreateCheckpointService).toHaveBeenCalledWith(
        'EVT-001',
        expect.objectContaining({ isFinish: true }),
        'admin-123'
      );
    });
  });

  // ── GET /events/:eventId/checkpoints ────────────────────────────────────────

  describe('GET /events/:eventId/checkpoints', () => {
    it('returns 200 with full list for admin', async () => {
      mockListCheckpointsService.mockResolvedValueOnce([MOCK_CHECKPOINT]);

      const res = await request(app)
        .get('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].latitude).toBe(3.1725);
    });

    it('returns 200 with masked list for participant', async () => {
      mockListCheckpointsService.mockResolvedValueOnce([MOCK_CHECKPOINT, MASKED_CHECKPOINT]);

      const res = await request(app)
        .get('/events/EVT-001/checkpoints')
        .set('Authorization', 'Bearer participant-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[1].isLocked).toBe(true);
      expect(res.body.data[1].latitude).toBeUndefined();
    });
  });

  // ── PATCH /events/:eventId/checkpoints/reorder ──────────────────────────────

  describe('PATCH /events/:eventId/checkpoints/reorder', () => {
    it('returns 403 for crew', async () => {
      const res = await request(app)
        .patch('/events/EVT-001/checkpoints/reorder')
        .set('Authorization', 'Bearer crew-token')
        .send({ checkpointIds: ['CP-002', 'CP-001'] });

      expect(res.status).toBe(403);
    });

    it('returns 200 on valid reorder by admin', async () => {
      mockReorderCheckpointsService.mockResolvedValueOnce([
        { ...MOCK_CHECKPOINT, id: 'CP-002', orderIndex: 1 },
        { ...MOCK_CHECKPOINT, id: 'CP-001', orderIndex: 2 },
      ]);

      const res = await request(app)
        .patch('/events/EVT-001/checkpoints/reorder')
        .set('Authorization', 'Bearer admin-token')
        .send({ checkpointIds: ['CP-002', 'CP-001'] });

      expect(res.status).toBe(200);
      expect(mockReorderCheckpointsService).toHaveBeenCalledWith(
        'EVT-001',
        ['CP-002', 'CP-001'],
        'admin-123'
      );
    });
  });

  // ── DELETE /events/:eventId/checkpoints/:id ─────────────────────────────────

  describe('DELETE /events/:eventId/checkpoints/:id', () => {
    it('returns 409 CONFLICT when teams have progress on checkpoint', async () => {
      mockDeleteCheckpointService.mockRejectedValueOnce(
        new AppError(
          ErrorCode.CONFLICT,
          'Terdapat kumpulan peserta yang mempunyai rekod pada pos kawalan ini.'
        )
      );

      const res = await request(app)
        .delete('/events/EVT-001/checkpoints/CP-001')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 200 when deleted by admin', async () => {
      mockDeleteCheckpointService.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete('/events/EVT-001/checkpoints/CP-001')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});
