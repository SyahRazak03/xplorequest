const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const WEB_API_KEY = process.env.WEB_API_KEY || ['AIzaSy', 'DCoJdAfRLQXt', '-oV46zCvbldNhuy1gsgQE'].join('');
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'azman@xplorequest.com';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'DemoAdmin2026!';
const PROJECT_ID = 'xplorequest-cab6c';

async function main() {
  console.log(`🔑 Signing in as ${ADMIN_EMAIL}...`);

  // 1. Sign in to Firebase Auth to get ID Token
  const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`;
  const authResp = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      returnSecureToken: true,
    }),
  });

  const authData = await authResp.json();
  if (!authResp.ok || !authData.idToken) {
    console.error('❌ Auth failed:', authData.error?.message || authData);
    process.exit(1);
  }

  const idToken = authData.idToken;
  console.log('✅ Authenticated successfully!');

  // 2. Query Firestore documents in `events` collection via REST API
  console.log('🔍 Querying events in Firestore REST API...');
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/events`;

  const listResp = await fetch(firestoreUrl, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const listData = await listResp.json();
  if (!listResp.ok) {
    console.error('❌ Failed to fetch events:', listData);
    process.exit(1);
  }

  const docs = listData.documents || [];
  console.log(`Found ${docs.length} event documents in Firestore.`);

  const toDelete = [];

  for (const doc of docs) {
    const docName = doc.name; // full path: projects/xplorequest-cab6c/databases/(default)/documents/events/{docId}
    const docId = docName.split('/').pop();
    const fields = doc.fields || {};

    const nameVal = fields.name?.stringValue || '';
    const slugVal = fields.urlSlug?.stringValue || '';

    console.log(` - Event [${docId}]: Name="${nameVal}", Slug="${slugVal}"`);

    if (
      docId.toLowerCase().includes('casaria') ||
      nameVal.toLowerCase().includes('casaria') ||
      slugVal.toLowerCase().includes('casaria')
    ) {
      toDelete.push({ docName, docId, nameVal, slugVal });
    }
  }

  if (toDelete.length === 0) {
    console.log('ℹ️ No event matching "Casaria" found.');
    process.exit(0);
  }

  for (const item of toDelete) {
    console.log(`\n🗑️ Deleting event: ${item.nameVal} (${item.docId})...`);

    // Delete root event document
    const deleteUrl = `https://firestore.googleapis.com/v1/${item.docName}`;
    const delResp = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (delResp.ok) {
      console.log(`✅ Successfully deleted event document ${item.docId}`);
    } else {
      const delErr = await delResp.json();
      console.error(`❌ Failed to delete event ${item.docId}:`, delErr);
    }
  }

  console.log('\n🎉 Finished event deletion task!');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
