/**
 * handlers/__tests__/security.test.ts
 *
 * Stage 16: Security Hardening & CIA Triad Audit Unit Tests.
 */

import express from 'express';
import request from 'supertest';

import { processGpsPurge } from '../../jobs/gpsPurgeJob';
import { verifyAppCheck } from '../../middleware/appCheck';
import { verifyFirebaseToken } from '../../middleware/auth';
import { processBatchSync } from '../../services/sync.service';
import { errorHandler } from '../../utils/errors';
import { eventsRouter } from '../events';

// ── Mock Auth Middleware ──────────────────────────────────────────────────────

let mockUserRole = 'admin';

jest.mock('../../middleware/auth', () => ({
  verifyFirebaseToken: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.user = {
      uid: 'ADMIN-001',
      role: mockUserRole as import('../../models').UserRole,
      eventId: 'EVT-001',
    };
    next();
  },
  requireRole: (...roles: string[]) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const userRole = req.user?.role ?? '';
    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Akses ditolak.' },
      });
      return;
    }
    next();
  },
}));

// ── Mock Firebase Config & Firestore ──────────────────────────────────────────

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();
const mockGetQuery = jest.fn();

jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getFirestore: jest.fn().mockReturnValue({
    collection: (collName: string) => ({
      doc: (docId: string) => ({
        get: () => mockGetDoc(collName, docId),
        set: (data: unknown, opts: unknown) => mockSet(collName, docId, data, opts),
        update: (data: unknown) => mockUpdate(collName, docId, data),
        collection: (subColl: string) => ({
          doc: (subDocId: string) => ({
            get: () => mockGetDoc(`${collName}/${docId}/${subColl}`, subDocId),
            set: (data: unknown, opts: unknown) => mockSet(`${collName}/${docId}/${subColl}`, subDocId, data, opts),
            update: (data: unknown) => mockUpdate(`${collName}/${docId}/${subColl}`, subDocId, data),
          }),
          where: () => ({
            get: () => mockGetQuery(`${collName}/${docId}/${subColl}`),
          }),
        }),
      }),
      where: () => ({
        get: () => mockGetQuery(collName),
      }),
    }),
    runTransaction: jest.fn().mockImplementation((cb) =>
      cb({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      })
    ),
  }),
}));

// ── Mock Event Repository ─────────────────────────────────────────────────────

jest.mock('../../repositories/event.repository', () => ({
  findEventById: jest.fn().mockResolvedValue({
    id: 'EVT-001',
    name: 'XploreQuest 2026',
    isStarted: false,
    isFinished: false,
  }),
  getEventSecrets: jest.fn().mockResolvedValue({
    crewPinCode: '1234',
    hmacSecret: 'old-secret-key-32-bytes-long-string-1234',
    hmacKeyId: 1,
  }),
  setEventSecrets: jest.fn().mockResolvedValue(undefined),
}));

// ── Mock Core Processing Functions for Multi-Team Sync ───────────────────────

jest.mock('../../services/scan.service', () => ({
  processScanCore: jest.fn().mockImplementation((_evt, teamId, _caller, input) => {
    return Promise.resolve({
      teamId,
      checkpointId: input.payload?.split(':')[1] || 'CP-001',
      nextCheckpointId: 'CP-002',
      isFinish: false,
      pointsEarned: 10,
      totalPoints: 10,
      completedCheckpointIds: ['CP-001'],
      scannedAt: input.clientTimestamp,
    });
  }),
  processSkipCore: jest.fn(),
  processFinishCore: jest.fn(),
}));

// ── Express App Setup ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// App Check Middleware
app.use(verifyAppCheck);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/events', verifyFirebaseToken, eventsRouter);
app.use(errorHandler);

// ── Test Suites ───────────────────────────────────────────────────────────────

describe('Stage 16 — Security Hardening & CIA Triad Audit', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRole = 'admin';
    process.env['NODE_ENV'] = 'test';
    delete process.env['APP_CHECK_ENFORCE'];
  });

  describe('Firebase App Check Verification Middleware', () => {
    it('TC-ST16-01: Exempts GET /health from App Check token verification', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['APP_CHECK_ENFORCE'] = 'true';

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Admin HMAC Key Rotation Trigger', () => {
    it('TC-ST16-02: Rotates HMAC secret, increments key ID, and retains grace window', async () => {
      const { setEventSecrets } = require('../../repositories/event.repository');

      const res = await request(app)
        .post('/events/EVT-001/rotate-hmac')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newHmacKeyId).toBe(2);
      expect(res.body.data.previousHmacKeyId).toBe(1);

      // Verify setEventSecrets call with grace window
      expect(setEventSecrets).toHaveBeenCalledWith(
        'EVT-001',
        expect.objectContaining({
          hmacKeyId: 2,
          previousHmacKeyId: 1,
          previousHmacSecret: 'old-secret-key-32-bytes-long-string-1234',
        })
      );
    });
  });

  describe('PDPA Ephemeral GPS Data Purge Job', () => {
    it('TC-ST16-03: Identifies finished events and purges ephemeral GPS fields from team documents', async () => {
      mockGetQuery.mockImplementation((collName: string) => {
        if (collName === 'events') {
          return Promise.resolve({
            empty: false,
            docs: [
              {
                id: 'EVT-001',
                data: () => ({ name: 'Finished Race', isFinished: true }),
                ref: {
                  collection: (_sub: string) => ({
                    get: () =>
                      Promise.resolve({
                        empty: false,
                        docs: [
                          {
                            id: 'TEAM-001',
                            data: () => ({
                              name: 'Team A',
                              lastScanLat: 3.139,
                              lastScanLng: 101.686,
                              lastScanAt: 1780000000000,
                            }),
                            ref: { update: mockUpdate },
                          },
                        ],
                      }),
                  }),
                },
              },
            ],
          });
        }
        return Promise.resolve({ empty: true, docs: [] });
      });

      const purgedCount = await processGpsPurge();

      expect(purgedCount).toBe(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          lastScanLat: expect.anything(),
          lastScanLng: expect.anything(),
          lastScanAt: expect.anything(),
          lastScanLocation: expect.anything(),
        })
      );
    });
  });

  describe('Multi-Team Offline Sync Concurrency (TC-ST13-08)', () => {
    it('TC-ST13-08: processBatchSync processes 2+ team groups concurrently via Promise.all preserving original index order', async () => {
      mockGetDoc.mockImplementation((_coll: string, docId: string) => {
        if (docId === 'IDEM-TEAM-A-1' || docId === 'IDEM-TEAM-B-1') {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: false });
      });

      const caller = {
        uid: 'PARTICIPANT-001',
        role: 'participant' as const,
        eventId: 'EVT-001',
        teamId: 'TEAM-A',
      };

      const batchInput = {
        items: [
          {
            idempotencyKey: 'IDEM-TEAM-A-1',
            operation: 'checkpoint_scan' as const,
            teamId: 'TEAM-A',
            clientTimestamp: '2026-06-01T08:00:00.000Z',
            payload: { payload: 'TEAM-A:CP-001:1780000000000:1:sig', latitude: 3.139, longitude: 101.6869 },
          },
          {
            idempotencyKey: 'IDEM-TEAM-B-1',
            operation: 'checkpoint_scan' as const,
            teamId: 'TEAM-B',
            clientTimestamp: '2026-06-01T08:01:00.000Z',
            payload: { payload: 'TEAM-B:CP-001:1780000000000:1:sig', latitude: 3.139, longitude: 101.6869 },
          },
        ],
      };

      const results = await processBatchSync('EVT-001', caller, batchInput);

      expect(results).toHaveLength(2);
      expect(results[0]?.idempotencyKey).toBe('IDEM-TEAM-A-1');
      expect(results[0]?.status).toBe('accepted');
      expect(results[1]?.idempotencyKey).toBe('IDEM-TEAM-B-1');
      expect(results[1]?.status).toBe('accepted');
    });
  });
});
