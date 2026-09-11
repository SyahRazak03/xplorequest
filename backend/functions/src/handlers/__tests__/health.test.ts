/**
 * handlers/__tests__/health.test.ts
 *
 * Unit tests for the GET /health endpoint.
 *
 * Runs in isolation via jest — no Firebase emulator required.
 * The firebase config module is fully mocked before any imports.
 */

import express from 'express';
import request from 'supertest';

import { errorHandler } from '../../utils/errors';
import { healthHandler } from '../health';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// jest.mock() is hoisted above imports by babel-jest / ts-jest
jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getConfig: jest.fn().mockReturnValue({
    projectId: 'test-project',
    region: 'asia-southeast1',
    version: '1.0.0',
    nodeEnv: 'test',
    hmacSecret: 'test-secret',
    sessionMaxAgeMs: 604800000,
  }),
}));

// ── Test App ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.get('/health', healthHandler);
app.use(errorHandler);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with success:true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.body.success).toBe(true);
  });

  it('returns the correct health response shape', async () => {
    const res = await request(app).get('/health');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = res.body.data as Record<string, unknown>;

    expect(data['status']).toBe('ok');
    expect(data['version']).toBe('1.0.0');
    expect(data['environment']).toBe('test');
    expect(data['region']).toBe('asia-southeast1');
    expect(typeof data['timestamp']).toBe('string');
    expect(typeof data['uptime']).toBe('number');
  });

  it('returns a valid ISO-8601 timestamp', async () => {
    const res = await request(app).get('/health');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const data = res.body.data as { timestamp: string };
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});
