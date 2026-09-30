#!/usr/bin/env ts-node
/**
 * scripts/delete_event.ts
 *
 * Generic administrative CLI script to permanently delete an event and
 * recursively clean up all associated subcollections (teams, checkpoints,
 * preRegistrations, secrets, scans) from Cloud Firestore.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/delete_event.ts <event-slug-or-id-or-name>
 *
 * Examples:
 *   npx ts-node --project tsconfig.json scripts/delete_event.ts test-race-kedua
 *   npx ts-node --project tsconfig.json scripts/delete_event.ts EV-942
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

delete process.env['FIRESTORE_EMULATOR_HOST'];
delete process.env['FIREBASE_AUTH_EMULATOR_HOST'];

const API_BASE = 'https://asia-southeast1-xplorequest-cab6c.cloudfunctions.net/api';

async function main(): Promise<void> {
  const target = process.argv[2];

  if (!target || !target.trim()) {
    console.error('❌ Error: Missing event identifier.');
    console.log('\nUsage:');
    console.log('  npx ts-node --project tsconfig.json scripts/delete_event.ts <event-slug-or-id>');
    console.log('\nExample:');
    console.log('  npx ts-node --project tsconfig.json scripts/delete_event.ts test-race-kedua');
    process.exit(1);
  }

  const queryTarget = target.trim().toLowerCase();
  console.log(`🔍 Searching for event matching "${target}"...`);

  let eventsToTarget: Array<{ id: string; name?: string; urlSlug?: string }> = [];

  try {
    const resp = await fetch(`${API_BASE}/events`, {
      headers: { Authorization: `Bearer ${process.env['ADMIN_TOKEN'] || 'admin-session-token'}` },
    });
    if (resp.ok) {
      const json = (await resp.json()) as any;
      if (json && json.success && Array.isArray(json.data)) {
        eventsToTarget = json.data.filter((e: any) => {
          const id = (e.id || '').toLowerCase();
          const slug = (e.urlSlug || '').toLowerCase();
          const name = (e.name || '').toLowerCase();
          return (
            id === queryTarget ||
            slug === queryTarget ||
            name === queryTarget ||
            id.includes(queryTarget) ||
            slug.includes(queryTarget)
          );
        });
      }
    }
  } catch (err) {
    console.warn('API lookup warning:', err);
  }

  // Fallback: If not found via list API, try direct slug fetch
  if (eventsToTarget.length === 0) {
    try {
      const pubResp = await fetch(`${API_BASE}/public/events/${encodeURIComponent(queryTarget)}`);
      if (pubResp.ok) {
        const pubJson = (await pubResp.json()) as any;
        if (pubJson && pubJson.success && pubJson.data) {
          eventsToTarget.push(pubJson.data);
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  if (eventsToTarget.length === 0) {
    console.log(`⚠️ No event matching "${target}" was found in database.`);
    process.exit(0);
  }

  for (const event of eventsToTarget) {
    const eventId = event.id;
    const eventName = event.name || eventId;
    console.log(`\n🗑️ Deleting event "${eventName}" (ID: ${eventId})...`);

    try {
      const delResp = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env['ADMIN_TOKEN'] || 'admin-session-token'}` },
      });
      const delJson = (await delResp.json()) as any;
      if (delResp.ok && delJson && delJson.success) {
        console.log(`✅ Successfully deleted event document and resources for ${eventId}`);
      } else {
        console.error(`❌ Failed to delete event ${eventId}:`, delJson?.error?.message || delJson);
      }
    } catch (err) {
      console.error(`❌ Network error while deleting event ${eventId}:`, err);
    }
  }

  console.log('\n🎉 Deletion task complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error executing event deletion script:', err);
  process.exit(1);
});
