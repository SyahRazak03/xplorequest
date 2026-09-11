/**
 * handlers/__tests__/auth.test.ts
 *
 * Unit tests for the authentication API handlers and validation.
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { authRouter } from '../auth';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    }),
    runTransaction: jest.fn().mockImplementation(async (cb: (tx: MockTx) => Promise<unknown>) => {
      const mockTx: MockTx = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      };
      return cb(mockTx);
    }),
  }),
  getAuth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'user-123',
      role: 'admin',
    }),
    revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
  }),
  getConfig: jest.fn().mockReturnValue({
    projectId: 'test-project',
    region: 'asia-southeast1',
    version: '1.0.0',
    nodeEnv: 'test',
    hmacSecret: 'test-secret',
    sessionMaxAgeMs: 604800000,
  }),
}));

jest.mock('../../services/auth.service', () => ({
  adminLogin: jest.fn().mockResolvedValue({
    customToken: 'mock-admin-custom-token',
    uid: 'admin-123',
    role: 'admin',
    name: 'Encik Azman',
    email: 'azman@xplorequest.com',
  }),
  crewLogin: jest.fn().mockResolvedValue({
    customToken: 'mock-crew-custom-token',
    uid: 'crew-123',
    role: 'crew',
    name: 'Husna',
    checkpointId: 'CP-002',
    eventId: 'EV-001',
  }),
  participantJoin: jest.fn().mockResolvedValue({
    customToken: 'mock-participant-custom-token',
    uid: 'participant-123',
    role: 'participant',
    name: 'Pasukan Harimau',
    teamId: 'TEAM-001',
    teamName: 'Pasukan Harimau',
    eventId: 'EV-001',
  }),
  logout: jest.fn().mockResolvedValue(undefined),
  getMe: jest.fn().mockResolvedValue({
    uid: 'admin-123',
    role: 'admin',
    name: 'Encik Azman',
    email: 'azman@xplorequest.com',
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use(errorHandler);

// ── Tests ─────────────────────────────────────────────────────────────────────

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: { code: string; message: string };
}

jest.setTimeout(15000);

describe('Auth Handlers', () => {
  describe('POST /auth/admin/login', () => {
    it('returns 400 if email is invalid', async () => {
      const res = await request(app)
        .post('/auth/admin/login')
        .send({ email: 'invalid-email', password: 'password123' });

      expect(res.status).toBe(400);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 200 with admin custom token on valid request', async () => {
      const res = await request(app)
        .post('/auth/admin/login')
        .send({ email: 'azman@xplorequest.com', password: 'password123' });

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ role: string; customToken: string }>;
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('admin');
      expect(body.data.customToken).toBe('mock-admin-custom-token');
    });
  });

  describe('POST /auth/crew/login', () => {
    it('returns 400 if PIN is not 4 digits', async () => {
      const res = await request(app)
        .post('/auth/crew/login')
        .send({ marshalId: 'USR-CREW-002', crewPinCode: '12', checkpointId: 'CP-002', eventId: 'EV-001' });

      expect(res.status).toBe(400);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
    });

    it('returns 200 on valid crew credentials', async () => {
      const res = await request(app)
        .post('/auth/crew/login')
        .send({ marshalId: 'USR-CREW-002', crewPinCode: '1234', checkpointId: 'CP-002', eventId: 'EV-001' });

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ role: string; customToken: string }>;
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('crew');
      expect(body.data.customToken).toBe('mock-crew-custom-token');
    });
  });

  describe('POST /auth/participant/join', () => {
    it('returns 400 if join code is too short', async () => {
      const res = await request(app)
        .post('/auth/participant/join')
        .send({ joinCode: 'AB', teamName: 'Pasukan Harimau' });

      expect(res.status).toBe(400);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
    });

    it('returns 200 on valid participant join', async () => {
      const res = await request(app)
        .post('/auth/participant/join')
        .send({ joinCode: 'XT2026', teamName: 'Pasukan Harimau' });

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ role: string; customToken: string }>;
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('participant');
      expect(body.data.customToken).toBe('mock-participant-custom-token');
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 if missing Authorization header', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
      const body = res.body as ApiError;
      expect(body.success).toBe(false);
    });

    it('returns user profile when Bearer token is provided', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer mock-valid-id-token');

      expect(res.status).toBe(200);
      const body = res.body as ApiSuccess<{ role: string }>;
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('admin');
    });
  });
});
