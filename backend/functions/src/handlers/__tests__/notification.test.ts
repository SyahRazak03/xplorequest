/**
 * handlers/__tests__/notification.test.ts
 *
 * Unit and integration tests for Stage 15: Push Notifications Engine (FR-15).
 */

import express from 'express';
import request from 'supertest';

import { processAttendanceReminders } from '../../jobs/attendanceReminderJob';
import { expo, sendPushNotifications } from '../../services/notification.service';
import { errorHandler } from '../../utils/errors';
import { scanRouter } from '../scan';
import { startRouter } from '../start';
import { usersRouter } from '../users';

// ── Mock Auth Middleware ──────────────────────────────────────────────────────

let mockUser = {
  uid: 'UID-LEADER-001',
  role: 'participant',
  eventId: 'EVT-001',
  teamId: 'TEAM-001',
};

jest.mock('../../middleware/auth', () => ({
  verifyFirebaseToken: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.user = mockUser as unknown as import('../../middleware/auth').AuthenticatedUser;
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
const mockCollection = jest.fn();

jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getFirestore: jest.fn().mockReturnValue({
    collection: (collName: string) => {
      mockCollection(collName);
      return {
        doc: (docId: string) => {
          return {
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
          };
        },
        where: () => ({
          where: () => ({
            get: () => mockGetQuery(collName),
          }),
          get: () => mockGetQuery(collName),
        }),
      };
    },
    runTransaction: jest.fn(),
  }),
}));

// ── Mock Service Calls for Triggers ───────────────────────────────────────────

jest.mock('../../services/start.service', () => ({
  triggerStaggeredStartService: jest.fn().mockResolvedValue({
    eventId: 'EVT-001',
    isRaceStarted: true,
    raceStartTime: 1780000000000,
    startedAt: '2026-06-01T08:00:00.000Z',
    totalEligible: 1,
    totalAbsent: 0,
    assignments: [
      {
        teamId: 'TEAM-001',
        teamName: 'Pasukan Harimau',
        startCheckpointId: 'CP-001',
        startCheckpointName: 'Main Fountain',
        currentCheckpointId: 'CP-001',
      },
    ],
  }),
  checkinAttendanceService: jest.fn(),
  assignLateArrivalService: jest.fn(),
}));

jest.mock('../../services/scan.service', () => ({
  verifyAndProcessScanService: jest.fn().mockResolvedValue({
    teamId: 'TEAM-001',
    checkpointId: 'CP-001',
    nextCheckpointId: 'CP-002',
    isFinish: false,
    pointsEarned: 10,
    totalPoints: 10,
    completedCheckpointIds: ['CP-001'],
    scannedAt: '2026-06-01T08:15:00.000Z',
  }),
  skipCheckpointService: jest.fn(),
}));

jest.mock('../../repositories/team.repository', () => ({
  findTeamById: jest.fn().mockResolvedValue({
    id: 'TEAM-001',
    name: 'Pasukan Harimau',
    leaderUid: 'UID-LEADER-001',
    eventId: 'EVT-001',
  }),
}));

jest.mock('../../repositories/checkpoint.repository', () => ({
  findCheckpointById: jest.fn().mockImplementation((_evtId: string, cpId: string) => {
    if (cpId === 'CP-002') {
      return Promise.resolve({
        id: 'CP-002',
        name: 'Jambatan Gantung',
        clueText: 'Cari jambatan berhampiran sungai',
        isFinish: false,
      });
    }
    return Promise.resolve(null);
  }),
}));

// ── Express App Setup ─────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/users', usersRouter);
app.use('/events', startRouter);
app.use('/events', scanRouter);
app.use(errorHandler);

// ── Test Suites ───────────────────────────────────────────────────────────────

describe('Stage 15 — Push Notifications Engine', () => {

  let sendPushSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    sendPushSpy = jest
      .spyOn(expo, 'sendPushNotificationsAsync')
      .mockResolvedValue([
        { status: 'ok', id: 'TICK-001' } as unknown as import('expo-server-sdk').ExpoPushSuccessTicket,
      ]);
  });

  afterEach(() => {
    sendPushSpy.mockRestore();
  });

  describe('POST /users/me/push-token (Token Registration)', () => {
    it('TC-ST15-01: Registers a valid Expo push token successfully', async () => {
      mockUser = {
        uid: 'UID-LEADER-001',
        role: 'participant',
        eventId: 'EVT-001',
        teamId: 'TEAM-001',
      };

      const res = await request(app)
        .post('/users/me/push-token')
        .send({ pushToken: 'ExponentPushToken[valid-expo-push-token-123]' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/Token pemberitahuan berjaya didaftarkan/);

      // Verify Firestore write
      expect(mockSet).toHaveBeenCalledWith(
        'users',
        'UID-LEADER-001',
        expect.objectContaining({
          pushToken: 'ExponentPushToken[valid-expo-push-token-123]',
        }),
        { merge: true }
      );
    });

    it('TC-ST15-02: Rejects invalid Expo push token format', async () => {
      const res = await request(app)
        .post('/users/me/push-token')
        .send({ pushToken: 'invalid-token-format' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Format Expo push token tidak sah/);
    });
  });

  describe('sendPushNotifications Service Unit Tests', () => {
    it('TC-ST15-03: Correctly chunks and dispatches push notifications via expo-server-sdk', async () => {
      const chunkSpy = jest.spyOn(expo, 'chunkPushNotifications');

      const messages = Array.from({ length: 150 }, (_, i) => ({
        to: `ExponentPushToken[token-${i}]`,
        title: 'Pemberitahuan Ujian',
        body: `Mesej ${i}`,
        data: { index: i },
      }));

      await sendPushNotifications(messages);

      expect(chunkSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ to: 'ExponentPushToken[token-0]' }),
        ])
      );

      expect(sendPushSpy).toHaveBeenCalled();

      chunkSpy.mockRestore();
    });
  });

  describe('Event Triggers Integration', () => {
    it('TC-ST15-04: Race start trigger dispatches push notification to team leader token', async () => {
      mockUser = {
        uid: 'ADMIN-001',
        role: 'admin',
        eventId: 'EVT-001',
        teamId: '',
      };

      mockGetDoc.mockImplementation((collPath: string, docId: string) => {
        if (collPath === 'users' && docId === 'UID-LEADER-001') {
          return Promise.resolve({
            exists: true,
            data: () => ({
              uid: 'UID-LEADER-001',
              pushToken: 'ExponentPushToken[leader-token-001]',
            }),
          });
        }
        return Promise.resolve({ exists: false });
      });

      mockGetQuery.mockResolvedValue({ docs: [] });

      const res = await request(app)
        .post('/events/EVT-001/start')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Wait brief tick for async fire-and-forget promise to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Strict recipient & payload assertion
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            to: 'ExponentPushToken[leader-token-001]',
            title: 'Tugasan Pos Kawalan Permulaan',
            body: expect.stringContaining('Main Fountain'),
            data: expect.objectContaining({
              type: 'pre_race_assignment',
              startCheckpointId: 'CP-001',
            }),
          }),
        ])
      );
    });

    it('TC-ST15-05: Checkpoint scan completion dispatches next-clue push notification', async () => {
      mockUser = {
        uid: 'UID-LEADER-001',
        role: 'participant',
        eventId: 'EVT-001',
        teamId: 'TEAM-001',
      };

      mockGetDoc.mockImplementation((collPath: string, docId: string) => {
        if (collPath === 'users' && docId === 'UID-LEADER-001') {
          return Promise.resolve({
            exists: true,
            data: () => ({
              uid: 'UID-LEADER-001',
              pushToken: 'ExponentPushToken[leader-token-001]',
            }),
          });
        }
        return Promise.resolve({ exists: false });
      });

      mockGetQuery.mockResolvedValue({ docs: [] });

      const res = await request(app)
        .post('/events/EVT-001/checkpoints/CP-001/scan')
        .send({
          payload: 'TEAM-001:CP-001:1780000000000:1:sig',
          latitude: 3.139,
          longitude: 101.6869,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Wait brief tick for async fire-and-forget promise to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Strict recipient & payload assertion
      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            to: 'ExponentPushToken[leader-token-001]',
            title: 'Petunjuk Baharu Dibuka!',
            body: expect.stringContaining('Jambatan Gantung'),
            data: expect.objectContaining({
              type: 'checkpoint_complete',
              checkpointId: 'CP-001',
              nextCheckpointId: 'CP-002',
            }),
          }),
        ])
      );
    });
  });

  describe('Scheduled Attendance Reminder Job', () => {
    it('TC-ST15-06: Identifies absent teams and dispatches attendance reminder push notifications', async () => {
      mockGetQuery.mockImplementation((collPath: string) => {
        if (collPath === 'events') {
          return Promise.resolve({
            empty: false,
            docs: [
              {
                id: 'EVT-001',
                data: () => ({ name: 'XploreQuest 2026', isStarted: false, isFinished: false }),
                ref: {
                  collection: (_sub: string) => ({
                    where: () => ({
                      get: () =>
                        Promise.resolve({
                          empty: false,
                          docs: [
                            {
                              id: 'TEAM-001',
                              data: () => ({
                                name: 'Pasukan Harimau',
                                status: 'approved',
                                isPresent: false,
                                attendanceStatus: 'absent',
                                isExcluded: false,
                              }),
                            },
                          ],
                        }),
                    }),
                  }),
                },
              },
            ],
          });
        }
        return Promise.resolve({ empty: true, docs: [] });
      });

      mockGetDoc.mockImplementation((collPath: string, docId: string) => {
        if (collPath === 'users' && docId === 'UID-LEADER-001') {
          return Promise.resolve({
            exists: true,
            data: () => ({
              uid: 'UID-LEADER-001',
              pushToken: 'ExponentPushToken[leader-token-001]',
            }),
          });
        }
        return Promise.resolve({ exists: false });
      });

      // Execute scheduled job handler directly
      await processAttendanceReminders();

      expect(sendPushSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            to: 'ExponentPushToken[leader-token-001]',
            title: 'Peringatan Pendaftaran Kehadiran',
            body: expect.stringContaining('Pasukan Harimau'),
            data: expect.objectContaining({
              type: 'attendance_reminder',
              teamId: 'TEAM-001',
            }),
          }),
        ])
      );
    });
  });
});
