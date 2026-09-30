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

import * as admin from 'firebase-admin';

function initAdmin(): void {
  if (admin.apps.length > 0) return;

  const b64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  const filePath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const projectId =
    process.env['FIREBASE_PROJECT_ID'] ||
    process.env['XQ_PROJECT_ID'] ||
    'xplorequest-cab6c';

  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(json)),
      projectId,
    });
  } else if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    admin.initializeApp({
      credential: admin.credential.cert(resolved),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

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
  initAdmin();
  const db = admin.firestore();

  console.log(`🔍 Searching for event matching "${target}" in Firestore...`);

  const eventsSnap = await db.collection('events').get();
  const toDeleteDocs: admin.firestore.DocumentSnapshot[] = [];

  eventsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const docId = doc.id.toLowerCase();
    const slug = (data['urlSlug'] || '').toLowerCase();
    const name = (data['name'] || '').toLowerCase();

    if (
      docId === queryTarget ||
      slug === queryTarget ||
      name === queryTarget ||
      docId.includes(queryTarget) ||
      slug.includes(queryTarget)
    ) {
      console.log(`📌 Found matching event: ID="${doc.id}", Name="${data['name']}", Slug="${data['urlSlug'] || ''}"`);
      toDeleteDocs.push(doc);
    }
  });

  if (toDeleteDocs.length === 0) {
    console.log(`⚠️ No event matching "${target}" was found in Firestore.`);
    process.exit(0);
  }

  for (const doc of toDeleteDocs) {
    const eventId = doc.id;
    const eventName = doc.data()?.['name'] || eventId;
    console.log(`\n🗑️ Deleting event "${eventName}" (ID: ${eventId}) and its resources...`);

    const subcols = ['teams', 'checkpoints', 'preRegistrations', 'secrets', 'scans'];
    for (const sub of subcols) {
      const subSnap = await db.collection('events').doc(eventId).collection(sub).get();
      if (!subSnap.empty) {
        const batch = db.batch();
        subSnap.docs.forEach((sDoc) => batch.delete(sDoc.ref));
        await batch.commit();
        console.log(`  - Cleared ${subSnap.size} documents from subcollection "${sub}"`);
      }
    }

    await db.collection('events').doc(eventId).delete();
    console.log(`✅ Successfully deleted event document ${eventId}`);
  }

  console.log('\n🎉 Deletion task complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error executing event deletion script:', err);
  process.exit(1);
});
