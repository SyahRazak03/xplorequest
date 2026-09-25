import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import type { EventConfig, PaymentDetails } from '../types';

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

const firebaseConfig: FirebaseOptions = {
  apiKey:     process.env['EXPO_PUBLIC_FIREBASE_API_KEY']     ?? '',
  authDomain: process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '',
  projectId:  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']   ?? '',
  appId:      process.env['EXPO_PUBLIC_FIREBASE_APP_ID']       ?? '',
};

function getFirebaseFirestore() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Fetches real live events directly from backend API or Firestore.
 */
export async function fetchLiveEvents(
  token?: string,
  userUid?: string,
  userRole?: string
): Promise<EventConfig[]> {
  if (token) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const resp = await fetch(`${API_BASE}/events`, { headers });
      const json = await resp.json();
      if (resp.ok && json.success && Array.isArray(json.data)) {
        return json.data.map((d: any) => ({
          id: d.id,
          name: d.name || 'Acara',
          date: d.date || '',
          locationName: d.locationName || '',
          joinCode: d.joinCode || '',
          maxDurationSeconds: d.maxDurationSeconds || 14400,
          totalCheckpoints: d.totalCheckpoints || 0,
          urlSlug: d.urlSlug || '',
          entryFee: d.entryFee || 0,
          paymentBankDetails: d.paymentBankDetails || '',
          paymentDetails: d.paymentDetails || undefined,
          bannerImageUrl: d.bannerImageUrl || undefined,
          paymentQrImageUrl: d.paymentQrImageUrl || undefined,
          latitude: d.latitude || undefined,
          longitude: d.longitude || undefined,
          geofenceBoundary: Array.isArray(d.geofenceBoundary)
            ? d.geofenceBoundary.map((v: any) => ({
                latitude: v.latitude ?? v.x ?? 0,
                longitude: v.longitude ?? v.y ?? 0,
              }))
            : undefined,
        }));
      }
    } catch (err) {
      console.warn('API fetch live events fallback to direct Firestore:', err);
    }
  }

  try {
    const db = getFirebaseFirestore();
    const snap = await getDocs(collection(db, 'events'));
    const list: EventConfig[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (!d['isArchived']) {
        // Multi-tenant isolation: if caller is an organizer (admin), only return events created by this organizer
        if (userRole === 'admin' && userUid) {
          if (d['createdBy'] && d['createdBy'] !== userUid) {
            return;
          }
        }

        list.push({
          id: doc.id,
          name: d['name'] || 'Acara',
          date: d['date'] || '',
          locationName: d['locationName'] || '',
          joinCode: d['joinCode'] || '',
          maxDurationSeconds: d['maxDurationSeconds'] || 14400,
          totalCheckpoints: d['totalCheckpoints'] || 0,
          urlSlug: d['urlSlug'] || '',
          entryFee: d['entryFee'] || 0,
          latitude: d['latitude'] || undefined,
          longitude: d['longitude'] || undefined,
          geofenceBoundary: Array.isArray(d['geofenceBoundary'])
            ? d['geofenceBoundary'].map((v: any) => ({
                latitude: v.latitude ?? v.x ?? 0,
                longitude: v.longitude ?? v.y ?? 0,
              }))
            : undefined,
        });
      }
    });
    return list;
  } catch (err) {
    console.warn('Failed to fetch live events from Firestore:', err);
    return [];
  }
}

/**
 * Updates structured organizer payment details for an event.
 * Calls PATCH /events/:eventId/payment-details.
 */
export async function updatePaymentDetailsService(
  eventId: string,
  paymentDetails: PaymentDetails,
  token?: string
): Promise<EventConfig> {
  const url = `${API_BASE}/events/${encodeURIComponent(eventId)}/payment-details`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ paymentDetails }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Failed to update payment information.');
  }

  return payload.data as EventConfig;
}

/**
 * Persists a newly created event to Firestore `events/{eventId}` so it can be queried by urlSlug on web pre-registration.
 */
export async function createLiveEvent(
  eventConfig: EventConfig,
  idToken?: string,
  ownerUid?: string
): Promise<EventConfig> {
  if (idToken) {
    try {
      const resp = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: eventConfig.name,
          date: eventConfig.date,
          locationName: eventConfig.locationName || 'Kuala Lumpur',
          urlSlug: eventConfig.urlSlug || undefined,
          entryFee: eventConfig.entryFee || 0,
          joinCode: eventConfig.joinCode || undefined,
          maxDurationSeconds: eventConfig.maxDurationSeconds || 14400,
          totalCheckpoints: eventConfig.totalCheckpoints || 8,
          paymentBankDetails: eventConfig.paymentBankDetails || '',
          paymentDetails: eventConfig.paymentDetails || undefined,
          bannerImageUrl: eventConfig.bannerImageUrl || undefined,
          paymentQrImageUrl: eventConfig.paymentQrImageUrl || undefined,
          createdBy: ownerUid || undefined,
        }),
      });

      const json = await resp.json();
      if (resp.ok && json.success && json.data) {
        return {
          ...eventConfig,
          id: json.data.id || eventConfig.id,
          urlSlug: json.data.urlSlug || eventConfig.urlSlug,
          joinCode: json.data.joinCode || eventConfig.joinCode,
        };
      } else {
        console.warn('Backend API event creation notice:', json.error?.message);
      }
    } catch (apiErr) {
      console.warn('Backend API event creation network warning:', apiErr);
    }
  }

  try {
    const db = getFirebaseFirestore();
    const { doc, setDoc } = require('firebase/firestore');
    const docRef = doc(db, 'events', eventConfig.id);

    const dataToSave = {
      id: eventConfig.id,
      name: eventConfig.name,
      date: eventConfig.date,
      locationName: eventConfig.locationName || '',
      urlSlug: eventConfig.urlSlug || '',
      entryFee: eventConfig.entryFee || 0,
      joinCode: eventConfig.joinCode || 'XT2026',
      maxDurationSeconds: eventConfig.maxDurationSeconds || 14400,
      totalCheckpoints: eventConfig.totalCheckpoints || 8,
      paymentBankDetails: eventConfig.paymentBankDetails || '',
      paymentDetails: eventConfig.paymentDetails || null,
      bannerImageUrl: eventConfig.bannerImageUrl || null,
      paymentQrImageUrl: eventConfig.paymentQrImageUrl || null,
      createdBy: ownerUid || null,
      isArchived: false,
      isStarted: false,
      isFinished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, dataToSave);
  } catch (err) {
    console.warn('Failed to save event to Firestore via Client SDK:', err);
  }

  return eventConfig;
}

/**
 * Fetches crew PIN code and assigned marshal ID for an event from backend API.
 */
export async function fetchCrewPinService(
  eventId: string,
  token?: string
): Promise<{ crewPinCode: string; marshalId?: string }> {
  if (token && API_BASE) {
    try {
      const resp = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/crew-pin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await resp.json();
      if (resp.ok && json.success && json.data?.crewPinCode) {
        return {
          crewPinCode: json.data.crewPinCode,
          marshalId: json.data.marshalId,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch crew PIN from API:', err);
    }
  }
  return { crewPinCode: '8492' };
}

/**
 * Updates race rules, time limits, and penalties for an event in Firestore.
 */
export async function updateEventRulesService(
  eventId: string,
  rulesData: Record<string, unknown>,
  token?: string
): Promise<void> {
  try {
    const db = getFirebaseFirestore();
    const { doc, updateDoc } = require('firebase/firestore');
    const docRef = doc(db, 'events', eventId);
    await updateDoc(docRef, {
      rules: rulesData,
      maxDurationSeconds: typeof rulesData['maxRaceTime'] === 'number' ? (rulesData['maxRaceTime'] as number) * 60 : 14400,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to update event rules in Firestore:', err);
  }

  if (token) {
    try {
      await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rules: rulesData }),
      });
    } catch {
      // Best effort backend sync
    }
  }
}

/**
 * Updates event status in Firestore and Backend API to `isStarted: true` / `status: 'active'`.
 */
export async function startRaceService(eventId: string, token?: string): Promise<void> {
  const startedAt = Date.now();

  // 1. Try Backend API first
  if (token) {
    try {
      await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startedAt }),
      });
    } catch {
      // Best effort backend sync
    }
  }

  // 2. Direct Firestore updates
  try {
    const db = getFirebaseFirestore();
    const { doc, updateDoc, setDoc } = require('firebase/firestore');

    // Update teams subcollection _raceState doc (Allowed for crew/participants)
    const subColStateRef = doc(db, 'events', eventId, 'teams', '_raceState');
    await setDoc(subColStateRef, {
      isStarted: true,
      status: 'active',
      startedAt,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Try root event doc update (Silently catch permission error if non-admin)
    try {
      const docRef = doc(db, 'events', eventId);
      await updateDoc(docRef, {
        isStarted: true,
        status: 'active',
        startedAt,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Ignored if client lacks root doc permission
    }
  } catch (err) {
    console.warn('Firestore race state notice:', err);
  }
}

/**
 * Subscribes to real-time status changes of an event (e.g., isStarted, status, startedAt).
 */
export function subscribeToEventState(
  eventId: string,
  onUpdate: (eventState: { isStarted: boolean; startedAt?: number }) => void
): () => void {
  try {
    const db = getFirebaseFirestore();
    const { doc, onSnapshot } = require('firebase/firestore');

    const subColStateRef = doc(db, 'events', eventId, 'teams', '_raceState');
    const rootDocRef = doc(db, 'events', eventId);

    const unsubSub = onSnapshot(
      subColStateRef,
      (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.isStarted || data.status === 'active') {
            onUpdate({
              isStarted: true,
              startedAt: data.startedAt,
            });
          }
        }
      },
      () => {}
    );

    const unsubRoot = onSnapshot(
      rootDocRef,
      (snapshot: any) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.isStarted || data.status === 'active') {
            onUpdate({
              isStarted: true,
              startedAt: data.startedAt,
            });
          }
        }
      },
      () => {}
    );

    return () => {
      try { unsubSub(); } catch {}
      try { unsubRoot(); } catch {}
    };
  } catch (err) {
    console.warn('Failed to subscribe to event state:', err);
    return () => {};
  }
}

/**
 * Permanently deletes an event and all its associated data from the backend / Firestore.
 */
export async function deleteEventService(eventId: string, token?: string): Promise<void> {
  let apiSuccess = false;
  if (token && API_BASE) {
    try {
      const resp = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await resp.json();
      if (resp.ok && json.success) {
        apiSuccess = true;
      } else if (json.error?.message) {
        throw new Error(json.error.message);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      console.warn('Backend API deleteEvent network warning:', err);
    }
  }

  if (!apiSuccess) {
    try {
      const db = getFirebaseFirestore();
      const { doc, deleteDoc } = require('firebase/firestore');
      const docRef = doc(db, 'events', eventId);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.warn('Direct Firestore deleteDoc notice:', err);
      if (!apiSuccess && err.message) {
        throw new Error(err.message || 'Failed to delete event from Firestore.');
      }
    }
  }
}
