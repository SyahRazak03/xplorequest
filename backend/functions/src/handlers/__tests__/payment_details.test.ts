/**
 * handlers/__tests__/payment_details.test.ts
 *
 * Integration tests for Feature 4C: Organizer-Editable Payment Details.
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { eventsRouter } from '../events';
import { publicRouter } from '../public';

// ── Firebase Mocks ────────────────────────────────────────────────────────────

const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockGet = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);

const MOCK_EVENT_DOC = {
  id: 'EVT-100',
  name: 'Explorace Tasik Titiwangsa 2026',
  urlSlug: 'explorace-tasik-titiwangsa-2026',
  date: '27 Jun 2026',
  locationName: 'Taman Tasik Titiwangsa, KL',
  maxTeamSize: 4,
  isStarted: false,
  isFinished: false,
  isArchived: false,
  createdBy: 'admin-uid-123',
  paymentDetails: {
    bankName: 'Maybank',
    accountHolderName: 'XploreQuest Resources',
    accountNumber: '564123456789',
    note: 'Sila sertakan nama kumpulan pada rujukan.',
  },
};

const mockDocRef = {
  id: MOCK_EVENT_DOC.id,
  get: jest.fn().mockResolvedValue({
    exists: true,
    data: () => MOCK_EVENT_DOC,
  }),
  update: mockUpdate,
};

const mockCollectionRef = {
  doc: jest.fn(() => mockDocRef),
  where: mockWhere,
  get: mockGet,
};

jest.mock('../../config/firebase', () => ({
  getFirestore: () => ({
    collection: jest.fn((colName: string) => {
      if (colName === 'rateLimits') {
        return mockCollectionRef;
      }
      return {
        doc: jest.fn(() => mockDocRef),
        where: mockWhere,
      };
    }),
  }),
}));

// Mock Auth Middleware
let mockUserRole = 'admin';
let mockUserUid = 'admin-uid-123';
let includeAuthHeader = true;

jest.mock('../../middleware/auth', () => ({
  verifyFirebaseToken: (req: any, _res: any, next: any) => {
    if (!includeAuthHeader) {
      return next();
    }
    req.user = {
      uid: mockUserUid,
      role: mockUserRole,
      email: 'admin@xplorequest.com',
    };
    next();
  },
  requireRole: (...roles: string[]) => (req: any, _res: any, next: any) => {
    if (!req.user) {
      const { AppError, ErrorCode } = require('../../utils/errors');
      return next(new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.'));
    }
    if (!roles.includes(req.user.role)) {
      const { AppError, ErrorCode } = require('../../utils/errors');
      return next(new AppError(ErrorCode.FORBIDDEN, 'Akses ditolak.'));
    }
    next();
  },
}));

// ── App Setup ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const { verifyFirebaseToken } = require('../../middleware/auth');
  verifyFirebaseToken(req, res, next);
});
app.use('/events', eventsRouter);
app.use('/public', publicRouter);
app.use(errorHandler);

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Feature 4C: PATCH /events/:id/payment-details & Public Read Reflection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRole = 'admin';
    mockUserUid = 'admin-uid-123';
    includeAuthHeader = true;

    mockWhere.mockImplementation(() => ({
      where: mockWhere,
      limit: mockLimit,
      get: mockGet,
    }));

    mockLimit.mockImplementation(() => ({
      get: mockGet,
    }));
  });

  const validPaymentDetailsPayload = {
    paymentDetails: {
      bankName: 'CIMB Bank',
      accountHolderName: 'XploreQuest Enterprise',
      accountNumber: '8001234567',
      note: 'Sila lampirkan resit.',
    },
  };

  it('1. Admin successfully updates payment details via PATCH /events/:id/payment-details', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: MOCK_EVENT_DOC.id, data: () => MOCK_EVENT_DOC }],
    });

    const res = await request(app)
      .patch('/events/EVT-100/payment-details')
      .set('Authorization', 'Bearer valid-admin-token')
      .send(validPaymentDetailsPayload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentDetails: validPaymentDetailsPayload.paymentDetails,
        updatedBy: 'admin-uid-123',
      })
    );
  });

  it('2. Returns 401 UNAUTHORIZED when no authorization header is provided', async () => {
    includeAuthHeader = false;

    const res = await request(app)
      .patch('/events/EVT-100/payment-details')
      .send(validPaymentDetailsPayload)
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('3. Returns 403 FORBIDDEN when user role is not admin (e.g. participant or crew)', async () => {
    mockUserRole = 'participant';

    const res = await request(app)
      .patch('/events/EVT-100/payment-details')
      .set('Authorization', 'Bearer participant-token')
      .send(validPaymentDetailsPayload)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('4. Returns 422 UNPROCESSABLE_ENTITY on invalid account number format', async () => {
    const invalidPayload = {
      paymentDetails: {
        bankName: 'Maybank',
        accountHolderName: 'Ali Baba',
        accountNumber: '1234-5678-INVALID-ABC', // Contains letters
      },
    };

    const res = await request(app)
      .patch('/events/EVT-100/payment-details')
      .set('Authorization', 'Bearer valid-admin-token')
      .send(invalidPayload)
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Nombor akaun hanya boleh mengandungi nombor');
  });

  it('5. GET /public/events/:slug reflects updated paymentDetails in public response', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: MOCK_EVENT_DOC.id, data: () => MOCK_EVENT_DOC }],
    });

    const res = await request(app)
      .get('/public/events/explorace-tasik-titiwangsa-2026')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentDetails).toEqual(MOCK_EVENT_DOC.paymentDetails);
  });
});
