import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import type { EventConfig, PaymentDetails } from '../mockData';

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
export async function fetchLiveEvents(token?: string): Promise<EventConfig[]> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token || 'token-admin-casaria'}`,
    };
    const resp = await fetch(`${API_BASE}/events`, { headers });
    const json = await resp.json();
    if (resp.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
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

  try {
    const db = getFirebaseFirestore();
    const snap = await getDocs(collection(db, 'events'));
    const list: EventConfig[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (!d['isArchived']) {
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
    throw new Error(payload.error?.message || 'Gagal mengemaskini maklumat pembayaran.');
  }

  return payload.data as EventConfig;
}

/**
 * Persists a newly created event to Firestore `events/{eventId}` so it can be queried by urlSlug on web pre-registration.
 */
export async function createLiveEvent(eventConfig: EventConfig, idToken?: string): Promise<EventConfig> {
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
