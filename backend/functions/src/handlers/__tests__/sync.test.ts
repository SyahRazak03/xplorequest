/**
 * handlers/__tests__/sync.test.ts
 *
 * Test suite for Stage 13: Offline Sync Queue Batch Ingestion Engine (FR-06).
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { syncRouter } from '../sync';

// ── Mock Services ─────────────────────────────────────────────────────────────

const mockProcessBatchSync = jest.fn();

jest.mock('../../services/sync.service', () => ({
  processBatchSync: (...args: unknown[]) => mockProcessBatchSync(...args),
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
      if (token === 'crew-token') {
        return { uid: 'crew-001', role: 'crew', eventId: 'EVT-001', checkpointId: 'CP-001' };
      }
      if (token === 'participant-token') {
        return { uid: 'user-p1', role: 'participant', teamId: 'TEAM-001', eventId: 'EVT-001' };
      }
      throw new Error('Invalid token');
    }),
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/events', syncRouter);
app.use(errorHandler);

describe('POST /events/:eventId/sync (FR-06 Offline Sync Queue)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── TC-ST13-01: Unauthenticated request ────────────────────────────────────
  it('TC-ST13-01: should return 401 Unauthorized when authorization token is missing', async () => {
    const res = await request(app)
      .post('/events/EVT-001/sync')
      .send({
        items: [
          {
            idempotencyKey: 'IDEM-KEY-001001',
            operation: 'checkpoint_scan',
            clientTimestamp: new Date().toISOString(),
          },
        ],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // ── TC-ST13-02: Exceeding 100 items ─────────────────────────────────────────
  it('TC-ST13-02: should return 422 Unprocessable Entity when batch exceeds 100 items', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      idempotencyKey: `IDEM-KEY-EXTRA-${i.toString().padStart(3, '0')}`,
      operation: 'checkpoint_scan',
      clientTimestamp: new Date().toISOString(),
    }));

    const res = await request(app)
      .post('/events/EVT-001/sync')
      .set('Authorization', 'Bearer participant-token')
      .send({ items });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.message).toContain('Maksimum 100 item dibenarkan');
  });

  // ── TC-ST13-03: Chronological ordering & batch processing ───────────────────
  it('TC-ST13-03: should accept valid batch and delegate to processBatchSync service', async () => {
    const now = Date.now();
    const item1 = {
      idempotencyKey: 'IDEM-KEY-111111',
      operation: 'checkpoint_scan' as const,
      clientTimestamp: new Date(now - 10000).toISOString(),
      checkpointId: 'CP-001',
      teamId: 'TEAM-001',
      payload: { payload: 'TEAM-001:CP-001:123:1:sig' },
    };
    const item2 = {
      idempotencyKey: 'IDEM-KEY-222222',
      operation: 'checkpoint_skip' as const,
      clientTimestamp: new Date(now).toISOString(),
      checkpointId: 'CP-002',
      teamId: 'TEAM-001',
      payload: { reason: 'Traffic congestion' },
    };

    mockProcessBatchSync.mockResolvedValueOnce([
      {
        idempotencyKey: item1.idempotencyKey,
        operation: 'checkpoint_scan',
        status: 'accepted',
        processedAt: new Date().toISOString(),
      },
      {
        idempotencyKey: item2.idempotencyKey,
        operation: 'checkpoint_skip',
        status: 'accepted',
        processedAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .post('/events/EVT-001/sync')
      .set('Authorization', 'Bearer participant-token')
      .send({ items: [item2, item1] }); // Out of order in request payload

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(mockProcessBatchSync).toHaveBeenCalledTimes(1);
    expect(mockProcessBatchSync).toHaveBeenCalledWith(
      'EVT-001',
      expect.objectContaining({ uid: 'user-p1', role: 'participant' }),
      expect.objectContaining({ items: [item2, item1] })
    );
  });

  // ── TC-ST13-05: Already processed deduplication ───────────────────────────
  it('TC-ST13-05: should return already_processed status for duplicate idempotency key', async () => {
    const item = {
      idempotencyKey: 'IDEM-KEY-DUPLICATE-001',
      operation: 'checkpoint_scan' as const,
      clientTimestamp: new Date().toISOString(),
    };

    mockProcessBatchSync.mockResolvedValueOnce([
      {
        idempotencyKey: item.idempotencyKey,
        operation: 'checkpoint_scan',
        status: 'already_processed',
        processedAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .post('/events/EVT-001/sync')
      .set('Authorization', 'Bearer participant-token')
      .send({ items: [item] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].status).toBe('already_processed');
  });

  // ── TC-ST13-06: Rejected item with error ────────────────────────────────────
  it('TC-ST13-06: should return rejected status for invalid HMAC or geofence failure item', async () => {
    const item = {
      idempotencyKey: 'IDEM-KEY-INVALID-001',
      operation: 'checkpoint_scan' as const,
      clientTimestamp: new Date().toISOString(),
    };

    mockProcessBatchSync.mockResolvedValueOnce([
      {
        idempotencyKey: item.idempotencyKey,
        operation: 'checkpoint_scan',
        status: 'rejected',
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Tandatangan kriptografi kod QR tidak sah.',
        },
        processedAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .post('/events/EVT-001/sync')
      .set('Authorization', 'Bearer participant-token')
      .send({ items: [item] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].status).toBe('rejected');
    expect(res.body.data[0].error.code).toBe('INVALID_SIGNATURE');
  });

  // ── TC-ST13-07: Participant attempts unauthorized operation ──────────────
  it('TC-ST13-07: should reject manual_override submitted by participant with 403 FORBIDDEN error status', async () => {
    const item = {
      idempotencyKey: 'IDEM-KEY-UNAUTH-OVERRIDE',
      operation: 'manual_override' as const,
      checkpointId: 'CP-001',
      teamId: 'TEAM-001',
      clientTimestamp: new Date().toISOString(),
      payload: { reason: 'Sneaky participant override' },
    };

    mockProcessBatchSync.mockResolvedValueOnce([
      {
        idempotencyKey: item.idempotencyKey,
        operation: 'manual_override',
        status: 'rejected',
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak: Peserta tidak dibenarkan membuat pelepasan manual.',
        },
        processedAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .post('/events/EVT-001/sync')
      .set('Authorization', 'Bearer participant-token')
      .send({ items: [item] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].status).toBe('rejected');
    expect(res.body.data[0].error.code).toBe('FORBIDDEN');
  });
});
