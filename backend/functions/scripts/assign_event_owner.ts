#!/usr/bin/env ts-node
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'https://asia-southeast1-xplorequest-cab6c.cloudfunctions.net/api';

async function assignOwner() {
  const eventId = process.argv[2] || 'ooeQruqQjeXjtcMR2xHv'; // Test Race Kedua
  const newOwnerUid = process.argv[3] || 'jemputankasih@gmail.com';

  console.log(`Assigning event ${eventId} createdBy owner to "${newOwnerUid}"...`);

  // We can also patch via backend script if service account or admin token is used
}

assignOwner();
