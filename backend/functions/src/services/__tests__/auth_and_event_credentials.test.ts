/**
 * services/__tests__/auth_and_event_credentials.test.ts
 *
 * Unit tests for Krew & Marshal credentials:
 *   1. crewLogin() does NOT auto-provision when PIN is wrong (security guard)
 *   2. crewLogin() auto-provisions crew user doc when PIN is correct and marshalId is new
 *   3. getCrewPinService() returns assigned marshalId vs null when unassigned
 */

import { crewLogin } from '../auth.service';
import { getCrewPinService } from '../event.service';
import { AppError, ErrorCode } from '../../utils/errors';

// ── State for mock Firestore ──────────────────────────────────────────────────

let mockUsersDocs: Record<string, any> = {};
let mockCheckpointsDocs: Record<string, any> = {};
let mockSecretsDoc: any = null;

const mockSetUser = jest.fn((docId: string, data: any) => {
  mockUsersDocs[docId] = data;
  return Promise.resolve();
});

jest.mock('../../config/firebase', () => ({
  getAdminApp: jest.fn(),
  getAuth: jest.fn().mockReturnValue({
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  }),
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockImplementation((collName: string) => {
      if (collName === 'users') {
        return {
          doc: jest.fn().mockImplementation((docId: string) => ({
            get: jest.fn().mockImplementation(async () => {
              const d = mockUsersDocs[docId];
              return { exists: Boolean(d), data: () => d };
            }),
            set: (data: any) => mockSetUser(docId, data),
          })),
          where: jest.fn().mockImplementation((field: string, _op: string, val: any) => {
            return {
              where: jest.fn().mockImplementation((field2: string, _op2: string, val2: any) => {
                return {
                  where: jest.fn().mockImplementation((field3: string, _op3: string, val3: any) => ({
                    limit: jest.fn().mockReturnThis(),
                    get: jest.fn().mockImplementation(async () => {
                      const matches = Object.values(mockUsersDocs).filter((u: any) => {
                        const m1 = u[field] === val;
                        const m2 = u[field2] === val2;
                        const m3 = u[field3] === val3;
                        return m1 && m2 && m3;
                      });
                      return {
                        empty: matches.length === 0,
                        docs: matches.map((d) => ({ data: () => d })),
                      };
                    }),
                  })),
                  limit: jest.fn().mockReturnThis(),
                  get: jest.fn().mockImplementation(async () => {
                    const matches = Object.values(mockUsersDocs).filter((u: any) => {
                      const m1 = u[field] === val;
                      const m2 = u[field2] === val2;
                      return m1 && m2;
                    });
                    return {
                      empty: matches.length === 0,
                      docs: matches.map((d) => ({ data: () => d })),
                    };
                  }),
                };
              }),
              limit: jest.fn().mockReturnThis(),
              get: jest.fn().mockImplementation(async () => {
                const matches = Object.values(mockUsersDocs).filter((u: any) => u[field] === val);
                return {
                  empty: matches.length === 0,
                  docs: matches.map((d) => ({ data: () => d })),
                };
              }),
            };
          }),
        };
      }

      if (collName === 'events') {
        return {
          doc: jest.fn().mockImplementation((eventId: string) => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ id: eventId, name: 'Demo Event' }),
            }),
            collection: jest.fn().mockImplementation((subColl: string) => {
              if (subColl === 'checkpoints') {
                return {
                  doc: jest.fn().mockImplementation((cpId: string) => ({
                    get: jest.fn().mockImplementation(async () => {
                      const cp = mockCheckpointsDocs[cpId];
                      return { exists: Boolean(cp), data: () => cp };
                    }),
                  })),
                  orderBy: jest.fn().mockReturnThis(),
                  get: jest.fn().mockImplementation(async () => {
                    const docs = Object.values(mockCheckpointsDocs);
                    return {
                      empty: docs.length === 0,
                      docs: docs.map((d) => ({ data: () => d, id: d.id })),
                    };
                  }),
                };
              }
              if (subColl === 'secrets') {
                return {
                  doc: jest.fn().mockImplementation((docId: string) => ({
                    get: jest.fn().mockImplementation(async () => {
                      if (docId === 'config' && mockSecretsDoc) {
                        return { exists: true, data: () => mockSecretsDoc };
                      }
                      return { exists: false };
                    }),
                  })),
                };
              }
              return {};
            }),
          })),
        };
      }
      return {};
    }),
  }),
}));

describe('Krew & Marshal Credentials Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersDocs = {};
    mockCheckpointsDocs = {
      'CP-ATTENDANCE': {
        id: 'CP-ATTENDANCE',
        name: 'Pos Kehadiran Mula',
        isAttendanceStation: true,
        isStart: true,
      },
      'CP-002': {
        id: 'CP-002',
        name: 'Pos Kawalan 2',
        isAttendanceStation: false,
      },
    };
    mockSecretsDoc = { crewPinCode: '1234' };
  });

  describe('crewLogin() - Auto-provisioning and PIN validation', () => {
    it('(1) SECURITY GUARD: correctly does NOT auto-provision when PIN is wrong', async () => {
      const wrongPinCall = crewLogin(
        'MARSHAL-NEW-01',
        '9999', // Wrong PIN!
        'CP-ATTENDANCE',
        'EVT-001'
      );

      await expect(wrongPinCall).rejects.toThrow(
        new AppError(ErrorCode.UNAUTHORIZED, 'Invalid credentials or ID.')
      );

      // Verify no user document was written/auto-provisioned in Firestore
      expect(mockSetUser).not.toHaveBeenCalled();
      expect(mockUsersDocs['MARSHAL-NEW-01']).toBeUndefined();
    });

    it('(2) Auto-provisions brand-new marshalId when PIN is correct', async () => {
      const result = await crewLogin(
        'MARSHAL-NEW-01',
        '1234', // Correct PIN!
        'CP-ATTENDANCE',
        'EVT-001'
      );

      expect(result.role).toBe('crew');
      expect(result.customToken).toBe('mock-custom-token');
      expect(result.checkpointId).toBe('CP-ATTENDANCE');

      // Verify Firestore user document WAS set/auto-provisioned
      expect(mockSetUser).toHaveBeenCalled();
      const createdUid = result.uid;
      expect(mockUsersDocs[createdUid]).toBeDefined();
      expect(mockUsersDocs[createdUid].id).toBe('MARSHAL-NEW-01');
      expect(mockUsersDocs[createdUid].role).toBe('crew');
    });

    it('(2b) Reuses existing user doc when marshalId is already registered', async () => {
      mockUsersDocs['user-existing-123'] = {
        uid: 'user-existing-123',
        id: 'MARSHAL-EXISTING',
        name: 'Marshal Senior Siti',
        role: 'crew',
      };

      const result = await crewLogin(
        'MARSHAL-EXISTING',
        '1234',
        'CP-ATTENDANCE',
        'EVT-001'
      );

      expect(result.uid).toBe('user-existing-123');
      expect(result.name).toBe('Marshal Senior Siti');
    });
  });

  describe('getCrewPinService() - Marshal ID resolution', () => {
    it('(3) returns crewPinCode AND real marshalId when marshal is assigned/logged in', async () => {
      mockUsersDocs['crew-uid-888'] = {
        uid: 'crew-uid-888',
        id: 'MARSHAL-DUTY-01',
        role: 'crew',
        checkpointId: 'CP-ATTENDANCE',
        eventId: 'EVT-001',
      };

      const result = await getCrewPinService('EVT-001');

      expect(result.crewPinCode).toBe('1234');
      expect(result.marshalId).toBe('MARSHAL-DUTY-01');
    });

    it('(3b) returns crewPinCode AND null marshalId when no marshal is assigned or logged in', async () => {
      // mockUsersDocs is empty
      const result = await getCrewPinService('EVT-001');

      expect(result.crewPinCode).toBe('1234');
      expect(result.marshalId).toBeNull();
    });
  });
});
