/**
 * handlers/__tests__/preregistration.test.ts
 *
 * Integration and security unit tests for Web Pre-Registration Form Endpoint
 * (POST /public/events/:slug/pre-register).
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { publicRouter } from '../public';

// ── Firebase Mocks ────────────────────────────────────────────────────────────

const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockFileSave = jest.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = jest
  .fn()
  .mockResolvedValue(['https://storage.googleapis.com/test-bucket/receipt.jpg']);

const mockDocRef = {
  id: 'PREREG-001',
  get: jest.fn().mockResolvedValue({ exists: false }),
  set: mockSet,
  update: jest.fn().mockResolvedValue(undefined),
};

const mockCollectionRef = {
  doc: jest.fn(() => mockDocRef),
  where: mockWhere,
  get: mockGet,
};

const mockFirestore = {
  collection: jest.fn((colName: string) => {
    if (colName === 'rateLimits') {
      return mockCollectionRef;
    }
    return {
      doc: jest.fn(() => ({
        collection: jest.fn(() => mockCollectionRef),
        set: mockSet,
      })),
      where: mockWhere,
    };
  }),
  runTransaction: jest.fn(async (cb: any) => cb({
    get: jest.fn().mockResolvedValue({ exists: false }),
    set: jest.fn(),
    update: jest.fn(),
  })),
};

const mockStorageFile = {
  save: mockFileSave,
  getSignedUrl: mockGetSignedUrl,
};

const mockStorageBucket = {
  file: jest.fn(() => mockStorageFile),
  name: 'test-bucket',
};

const mockStorage = {
  bucket: jest.fn(() => mockStorageBucket),
};

jest.mock('../../config/firebase', () => ({
  getFirestore: () => mockFirestore,
  getStorage: () => mockStorage,
}));

// ── App Setup ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/public', publicRouter);
app.use(errorHandler);

// ── Helper Data ───────────────────────────────────────────────────────────────

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
};

// Valid 12-byte JPEG buffer base64 string
const VALID_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]).toString('base64');

// Invalid non-image buffer base64 string ("Hello World")
const INVALID_MAGIC_BASE64 = Buffer.from('Hello World This Is Not An Image File Content!').toString('base64');

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('POST /public/events/:slug/pre-register', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockWhere.mockImplementation(() => ({
      where: mockWhere,
      limit: mockLimit,
      get: mockGet,
    }));

    mockLimit.mockImplementation(() => ({
      get: mockGet,
    }));

    // Default mock transaction: not blocked
    mockFirestore.runTransaction.mockImplementation(async (cb: any) =>
      cb({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn(),
        update: jest.fn(),
      })
    );
  });

  const validPayload = {
    teamName: 'Harimau Malaya',
    leaderName: 'Ali Baba',
    leaderWhatsApp: '0123456789',
    memberNames: ['Ahmad', 'Babu', 'Chong'], // 1 leader + 3 members = 4 (matches maxTeamSize: 4)
    imageBase64: VALID_JPEG_BASE64,
    contentType: 'image/jpeg',
  };

  it('1. Returns HTTP 201 with submissionId, status pending, teamName, and submittedAt on valid registration', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: MOCK_EVENT_DOC.id, data: () => MOCK_EVENT_DOC }],
    });

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(validPayload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.submissionId).toBeDefined();
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.teamName).toBe('Harimau Malaya');
    expect(res.body.data.submittedAt).toBeDefined();

    expect(mockFileSave).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it('2. Returns HTTP 404 NOT_FOUND when event urlSlug is non-existent or archived', async () => {
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const res = await request(app)
      .post('/public/events/non-existent-slug/pre-register')
      .send(validPayload)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('3. Returns HTTP 400 BAD_REQUEST when event is already started or finished', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: MOCK_EVENT_DOC.id,
          data: () => ({ ...MOCK_EVENT_DOC, isStarted: true }),
        },
      ],
    });

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(validPayload)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('telah ditutup');
  });

  it('4. Returns HTTP 422 UNPROCESSABLE_ENTITY on invalid Malaysian phone format', async () => {
    const invalidPhonePayload = {
      ...validPayload,
      leaderWhatsApp: '12345', // Invalid format
    };

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(invalidPhonePayload)
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('nombor telefon Malaysia yang sah');
  });

  it('5. Returns HTTP 422 UNPROCESSABLE_ENTITY when total team members exceed event maxTeamSize', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: MOCK_EVENT_DOC.id, data: () => MOCK_EVENT_DOC }], // maxTeamSize is 4
    });

    const oversizedPayload = {
      ...validPayload,
      memberNames: ['Ahli 1', 'Ahli 2', 'Ahli 3', 'Ahli 4'], // 1 leader + 4 members = 5 > maxTeamSize (4)
    };

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(oversizedPayload)
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('melebihi had maksimum acara');
  });

  it('6. Returns HTTP 422 UNPROCESSABLE_ENTITY when binary magic bytes do not match declared MIME type', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: MOCK_EVENT_DOC.id, data: () => MOCK_EVENT_DOC }],
    });

    const invalidMagicPayload = {
      ...validPayload,
      imageBase64: INVALID_MAGIC_BASE64, // Text content declared as image/jpeg
      contentType: 'image/jpeg',
    };

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(invalidMagicPayload)
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('tidak sepadan dengan jenis MIME');
  });

  it('7. Returns HTTP 422 UNPROCESSABLE_ENTITY when image size exceeds 5MB limit', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: MOCK_EVENT_DOC.id, data: () => MOCK_EVENT_DOC }],
    });

    // Create a dummy buffer larger than 5MB (5.1MB) starting with valid JPEG header
    const largeBuffer = Buffer.alloc(5.1 * 1024 * 1024);
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff;
    largeBuffer[3] = 0xe0;

    const oversizedImagePayload = {
      ...validPayload,
      imageBase64: largeBuffer.toString('base64'),
    };

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(oversizedImagePayload)
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('tidak boleh melebihi 5MB');
  });

  it('8. Returns HTTP 429 TOO_MANY_REQUESTS when IP rate limit threshold is exceeded', async () => {
    // Mock rateLimiter transaction returning blocked = true
    mockFirestore.runTransaction.mockImplementationOnce(async () => true);

    const res = await request(app)
      .post('/public/events/explorace-tasik-titiwangsa-2026/pre-register')
      .send(validPayload)
      .expect(429);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(res.body.error.message).toContain('Terlalu banyak percubaan');
  });
});
