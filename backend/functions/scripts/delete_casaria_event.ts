import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

delete process.env['FIRESTORE_EMULATOR_HOST'];
delete process.env['FIREBASE_AUTH_EMULATOR_HOST'];

import * as admin from 'firebase-admin';

function initAdmin(): void {
  if (admin.apps.length > 0) return;
  const b64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  const filePath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const projectId = process.env['FIREBASE_PROJECT_ID'] || process.env['XQ_PROJECT_ID'] || 'xplorequest-cab6c';

  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)), projectId });
  } else if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    admin.initializeApp({ credential: admin.credential.cert(resolved), projectId });
  } else {
    admin.initializeApp({ projectId });
  }
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();

  console.log('Searching for "Casaria" events in Firestore...');

  const eventsSnap = await db.collection('events').get();
  console.log(`Total events found in database: ${eventsSnap.size}`);

  const toDeleteDocs: admin.firestore.DocumentSnapshot[] = [];

  eventsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const name = (data['name'] || '').toLowerCase();
    const slug = (data['urlSlug'] || '').toLowerCase();
    const docId = doc.id.toLowerCase();

    if (name.includes('casaria') || slug.includes('casaria') || docId.includes('casaria')) {
      console.log(`Found matching event: ID=${doc.id}, Name="${data['name']}", Slug="${data['urlSlug']}"`);
      toDeleteDocs.push(doc);
    }
  });

  if (toDeleteDocs.length === 0) {
    console.log('No event matching "Casaria" was found in Firestore.');
    process.exit(0);
  }

  for (const doc of toDeleteDocs) {
    const eventId = doc.id;
    console.log(`\nDeleting event ${eventId} and its subcollections...`);

    const subcols = ['teams', 'checkpoints', 'preRegistrations', 'secrets'];
    for (const sub of subcols) {
      const subSnap = await db.collection('events').doc(eventId).collection(sub).get();
      if (!subSnap.empty) {
        const batch = db.batch();
        subSnap.docs.forEach((sDoc) => batch.delete(sDoc.ref));
        await batch.commit();
        console.log(`  - Deleted ${subSnap.size} documents in subcollection "${sub}"`);
      }
    }

    await db.collection('events').doc(eventId).delete();
    console.log(`✅ Successfully deleted event document ${eventId}`);
  }

  console.log('\nDone deleting Casaria event!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error executing delete script:', err);
  process.exit(1);
});
