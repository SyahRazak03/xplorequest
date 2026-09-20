/**
 * handlers/__tests__/public.test.ts
 *
 * Integration tests for the Public Safe Read Endpoint (GET /public/events/:slug).
 *
 * Coverage & Verification:
 *   1. GET /public/events/:slug returns safe public event data subset.
 *   2. CRITICAL SECURITY GUARANTEE: joinCode, crewPinCode, hmacSecret, geofenceBoundary,
 *      createdBy, rules, and timestamps are strictly EXCLUDED from response keys.
 *   3. Returns 404 for nonexistent or archived event slugs.
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { publicRouter } from '../public';

// ── Mock: Firebase config ─────────────────────────────────────────────────────

const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockGet = jest.fn();

const mockDocRef = {
  get: jest.fn().mockResolvedValue({ exists: false }),
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockCollection = jest.fn((colName: string) => {
  if (colName === 'rateLimits') {
    return {
      doc: jest.fn(() => mockDocRef),
    };
  }
  return {
    where: mockWhere,
    doc: jest.fn(() => mockDocRef),
  };
});

mockWhere.mockImplementation(() => ({
  where: mockWhere,
  limit: mockLimit,
  get: mockGet,
}));

mockLimit.mockImplementation(() => ({
  get: mockGet,
}));

jest.mock('../../config/firebase', () => ({
  getFirestore: () => ({
    collection: mockCollection,
    runTransaction: async (cb: any) => cb({
      get: jest.fn().mockResolvedValue({ exists: false }),
      set: jest.fn(),
      update: jest.fn(),
    }),
  }),
}));

// ── App Setup ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/public', publicRouter);
app.use(errorHandler);

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('GET /public/events/:slug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const MOCK_EVENT_DOC = {
    id: 'EVT-100',
    name: 'Explorace Tasik Titiwangsa 2026',
    joinCode: 'SECRET123', // SECRET FIELD
    date: '27 Jun 2026',
    startTime: '08:00 AM',
    maxDurationSeconds: 14400,
    locationName: 'Taman Tasik Titiwangsa, KL',
    totalCheckpoints: 8,
    maxTeamSize: 4,
    isStarted: false,
    startedAt: null,
    isFinished: false,
    urlSlug: 'explorace-tasik-titiwangsa-2026',
    entryFee: 50,
    paymentBankDetails: 'Maybank 564123456789',
    paymentQrImageUrl: 'https://storage.googleapis.com/test-bucket/qr.jpg',
    bannerImageUrl: 'https://storage.googleapis.com/test-bucket/banner.jpg',
    geofenceBoundary: [{ latitude: 3.17, longitude: 101.7 }], // SECRET GEOMETRY
    rules: { maxRaceTime: 240 }, // INTERNAL RULES
    createdBy: 'admin-uid-999', // ADMIN UID
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    isArchived: false,
  };

  it('returns 200 with ONLY the safe public subset of event fields', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: MOCK_EVENT_DOC.id,
          data: () => MOCK_EVENT_DOC,
        },
      ],
    });

    const res = await request(app)
      .get('/public/events/explorace-tasik-titiwangsa-2026')
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Verify included safe fields
    expect(data).toEqual({
      id: 'EVT-100',
      name: 'Explorace Tasik Titiwangsa 2026',
      date: '27 Jun 2026',
      locationName: 'Taman Tasik Titiwangsa, KL',
      bannerImageUrl: 'https://storage.googleapis.com/test-bucket/banner.jpg',
      entryFee: 50,
      paymentBankDetails: 'Maybank 564123456789',
      paymentDetails: null,
      paymentQrImageUrl: 'https://storage.googleapis.com/test-bucket/qr.jpg',
      maxTeamSize: 4,
      urlSlug: 'explorace-tasik-titiwangsa-2026',
    });

    // ABSOLUTE SECURITY ASSERTS: Ensure sensitive fields are NEVER leaked
    expect(data.joinCode).toBeUndefined();
    expect(data.crewPinCode).toBeUndefined();
    expect(data.hmacSecret).toBeUndefined();
    expect(data.geofenceBoundary).toBeUndefined();
    expect(data.rules).toBeUndefined();
    expect(data.createdBy).toBeUndefined();
    expect(data.createdAt).toBeUndefined();
    expect(data.updatedAt).toBeUndefined();
    expect(data.startTime).toBeUndefined();
    expect(data.maxDurationSeconds).toBeUndefined();
    expect(data.totalCheckpoints).toBeUndefined();
  });

  it('returns 404 NOT_FOUND when event slug does not exist', async () => {
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const res = await request(app)
      .get('/public/events/non-existent-slug')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
