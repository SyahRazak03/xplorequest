/**
 * handlers/__tests__/preregistration_admin.test.ts
 *
 * Unit & Integration tests for Feature 5: Admin Review & Approval of Pre-Registrations.
 * Tests listing, detail fetching with signed URLs, approval with team creation,
 * idempotency, team-name conflict handling, rejection, 409 conflict rules, and 403 ownership isolation.
 */

import express from 'express';
import request from 'supertest';

import { preregistrationAdminRouter } from '../preregistration_admin';

// ── Mock Repositories & Services ─────────────────────────────────────────────

const mockEvent = {
  id: 'EVT-001',
  createdBy: 'admin-owner-001',
  title: 'Kejohanan Explorace',
  maxTeamSize: 4,
};

const mockPreRegPending = {
  id: 'PREREG-001',
  eventId: 'EVT-001',
  teamName: 'Harimau Malaya',
  leaderName: 'Ahmad bin Ali',
  leaderWhatsApp: '0123456789',
  memberNames: ['Budi', 'Chandra', 'Dewi'],
  paymentReceiptUrl: 'https://storage.googleapis.com/test-bucket/receipt.jpg',
  paymentReceiptStoragePath: 'pre_registrations/EVT-001/receipt.jpg',
  status: 'pending' as const,
  submittedAt: '2026-09-16T10:00:00.000Z',
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
};

const mockPreRegRejected = {
  ...mockPreRegPending,
  id: 'PREREG-002',
  teamName: 'Helang Terbang',
  status: 'rejected' as const,
};

const mockPreRegApproved = {
  ...mockPreRegPending,
  id: 'PREREG-003',
  teamName: 'Singa Utara',
  status: 'approved' as const,
  teamId: 'TEAM-300',
};

const mockExistingTeam = {
  id: 'TEAM-300',
  eventId: 'EVT-001',
  name: 'Singa Utara',
  status: 'approved' as const,
  memberCount: 4,
  leaderName: 'Ahmad bin Ali',
  membersList: 'Budi, Chandra, Dewi',
  phone: '0123456789',
  startCheckpointId: 'CP-START',
  currentCheckpointId: 'CP-START',
  completedCheckpointIds: [],
  skippedCheckpointIds: [],
  totalPoints: 0,
  penaltiesMinutes: 0,
  penaltyPoints: 0,
  finishedAt: null,
  isDNF: false,
  isDisqualified: false,
  createdAt: '2026-09-16T10:05:00.000Z',
  updatedAt: '2026-09-16T10:05:00.000Z',
};

jest.mock('../../config/firebase', () => {
  return {
    getAdminApp: jest.fn(),
    getFirestore: jest.fn().mockReturnValue({}),
    getStorage: jest.fn().mockReturnValue({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          getSignedUrl: jest.fn().mockResolvedValue(['https://signed-storage-url.com/receipt.jpg']),
        }),
      }),
    }),
    getAuth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'admin-owner-token') {
          return { uid: 'admin-owner-001', role: 'admin' };
        }
        if (token === 'admin-other-token') {
          return { uid: 'admin-other-999', role: 'admin' };
        }
        throw new Error('Invalid token');
      }),
    }),
  };
});

jest.mock('../../repositories/event.repository', () => ({
  findEventById: jest.fn().mockImplementation(async (id: string) => {
    if (id === 'EVT-001') return mockEvent;
    return null;
  }),
}));

const mockFindPreRegistrationById = jest.fn();
const mockListPreRegistrations = jest.fn();
const mockUpdatePreRegistration = jest.fn();

jest.mock('../../repositories/preregistration.repository', () => ({
  findPreRegistrationById: (...args: unknown[]) => mockFindPreRegistrationById(...args),
  listPreRegistrations: (...args: unknown[]) => mockListPreRegistrations(...args),
  updatePreRegistration: (...args: unknown[]) => mockUpdatePreRegistration(...args),
}));

const mockFindTeamByName = jest.fn();
const mockFindTeamById = jest.fn();
const mockCreateTeam = jest.fn();

jest.mock('../../repositories/team.repository', () => ({
  findTeamByName: (...args: unknown[]) => mockFindTeamByName(...args),
  findTeamById: (...args: unknown[]) => mockFindTeamById(...args),
  createTeam: (...args: unknown[]) => mockCreateTeam(...args),
}));

// ── Test App Setup ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/events/:eventId/pre-registrations', preregistrationAdminRouter);

// Error handler middleware
app.use(
  (
    err: { statusCode?: number; message?: string; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Error occurred',
      },
    });
  }
);

// ── Test Suites ───────────────────────────────────────────────────────────────

describe('Feature 5: Admin Review & Approval of Pre-Registrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. GET /events/:eventId/pre-registrations (List & Status Filter) ───────

  describe('GET /events/:eventId/pre-registrations', () => {
    it('returns 200 with list of all pre-registrations for owner admin', async () => {
      mockListPreRegistrations.mockResolvedValueOnce([mockPreRegPending, mockPreRegApproved]);

      const res = await request(app)
        .get('/events/EVT-001/pre-registrations')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(mockListPreRegistrations).toHaveBeenCalledWith('EVT-001', undefined);
    });

    it('filters list by status query parameter when status=pending is passed', async () => {
      mockListPreRegistrations.mockResolvedValueOnce([mockPreRegPending]);

      const res = await request(app)
        .get('/events/EVT-001/pre-registrations?status=pending')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(mockListPreRegistrations).toHaveBeenCalledWith('EVT-001', 'pending');
    });

    it('returns 403 FORBIDDEN when non-owner admin accesses the endpoint', async () => {
      const res = await request(app)
        .get('/events/EVT-001/pre-registrations')
        .set('Authorization', 'Bearer admin-other-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ── 2. GET /events/:eventId/pre-registrations/:id (Detail & Signed URL) ────

  describe('GET /events/:eventId/pre-registrations/:id', () => {
    it('returns 200 with pre-registration detail and freshly signed receipt URL', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegPending);

      const res = await request(app)
        .get('/events/EVT-001/pre-registrations/PREREG-001')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('PREREG-001');
      expect(res.body.data.paymentReceiptUrl).toBe('https://signed-storage-url.com/receipt.jpg');
    });

    it('returns 404 NOT_FOUND for unknown pre-registration ID', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/events/EVT-001/pre-registrations/PREREG-UNKNOWN')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ── 3. PATCH /events/:eventId/pre-registrations/:id/approve ─────────────────

  describe('PATCH /events/:eventId/pre-registrations/:id/approve', () => {
    it('approves pending pre-registration and creates team with status approved', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegPending);
      mockFindTeamByName.mockResolvedValueOnce(null);

      const createdTeam = {
        ...mockExistingTeam,
        id: 'TEAM-NEW-100',
        name: 'Harimau Malaya',
      };
      mockCreateTeam.mockResolvedValueOnce(createdTeam);

      const updatedPreReg = {
        ...mockPreRegPending,
        status: 'approved' as const,
        teamId: 'TEAM-NEW-100',
      };
      mockUpdatePreRegistration.mockResolvedValueOnce(updatedPreReg);

      const res = await request(app)
        .patch('/events/EVT-001/pre-registrations/PREREG-001/approve')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preRegistration.status).toBe('approved');
      expect(res.body.data.team.id).toBe('TEAM-NEW-100');
      expect(res.body.data.team.name).toBe(mockPreRegPending.teamName);
      expect(res.body.data.team.phone).toBe(mockPreRegPending.leaderWhatsApp);
      expect(res.body.data.team.membersList).toBe(mockPreRegPending.memberNames.join(', '));
      expect(res.body.data.team.memberCount).toBe(1 + mockPreRegPending.memberNames.length);

      expect(mockCreateTeam).toHaveBeenCalledWith('EVT-001', expect.objectContaining({
        name: mockPreRegPending.teamName,
        status: 'approved',
        memberCount: 1 + mockPreRegPending.memberNames.length,
        leaderName: mockPreRegPending.leaderName,
        membersList: mockPreRegPending.memberNames.join(', '),
        phone: mockPreRegPending.leaderWhatsApp,
      }));

      expect(mockUpdatePreRegistration).toHaveBeenCalledWith('EVT-001', 'PREREG-001', {
        status: 'approved',
        teamId: 'TEAM-NEW-100',
        updatedBy: 'admin-owner-001',
      });
    });

    it('approves rejected pre-registration and creates team document', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegRejected);
      mockFindTeamByName.mockResolvedValueOnce(null);

      const createdTeam = {
        ...mockExistingTeam,
        id: 'TEAM-NEW-200',
        name: 'Helang Terbang',
      };
      mockCreateTeam.mockResolvedValueOnce(createdTeam);

      const updatedPreReg = {
        ...mockPreRegRejected,
        status: 'approved' as const,
        teamId: 'TEAM-NEW-200',
      };
      mockUpdatePreRegistration.mockResolvedValueOnce(updatedPreReg);

      const res = await request(app)
        .patch('/events/EVT-001/pre-registrations/PREREG-002/approve')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.team.id).toBe('TEAM-NEW-200');
    });

    it('is idempotent: returns existing team without creating duplicate team when re-approved', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegApproved);
      mockFindTeamById.mockResolvedValueOnce(mockExistingTeam);

      const res = await request(app)
        .patch('/events/EVT-001/pre-registrations/PREREG-003/approve')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyApproved).toBe(true);
      expect(res.body.data.team.id).toBe('TEAM-300');
      expect(mockCreateTeam).not.toHaveBeenCalled();
    });

    it('returns 409 CONFLICT on team name collision and leaves state unchanged', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegPending);
      // findTeamByName returns an existing team with the same name
      mockFindTeamByName.mockResolvedValueOnce(mockExistingTeam);

      const res = await request(app)
        .patch('/events/EVT-001/pre-registrations/PREREG-001/approve')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('sudah didaftarkan untuk acara ini');

      expect(mockCreateTeam).not.toHaveBeenCalled();
      expect(mockUpdatePreRegistration).not.toHaveBeenCalled();
    });
  });

  // ── 4. PATCH /events/:eventId/pre-registrations/:id/reject ──────────────────

  describe('PATCH /events/:eventId/pre-registrations/:id/reject', () => {
    it('rejects pending pre-registration and updates document status', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegPending);
      const updatedPreReg = { ...mockPreRegPending, status: 'rejected' as const };
      mockUpdatePreRegistration.mockResolvedValueOnce(updatedPreReg);

      const res = await request(app)
        .patch('/events/EVT-001/pre-registrations/PREREG-001/reject')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('rejected');
      expect(mockUpdatePreRegistration).toHaveBeenCalledWith('EVT-001', 'PREREG-001', {
        status: 'rejected',
        updatedBy: 'admin-owner-001',
      });
    });

    it('returns 409 CONFLICT when attempting to reject an already approved pre-registration', async () => {
      mockFindPreRegistrationById.mockResolvedValueOnce(mockPreRegApproved);

      const res = await request(app)
        .patch('/events/EVT-001/pre-registrations/PREREG-003/reject')
        .set('Authorization', 'Bearer admin-owner-token');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('telah diluluskan');
      expect(mockUpdatePreRegistration).not.toHaveBeenCalled();
    });
  });
});
