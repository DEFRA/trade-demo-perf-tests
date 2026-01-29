#!/usr/bin/env node

import { DefraIdStubClient } from '../lib/defra-id-stub-client.js';
import fs from 'fs';

const DEFRA_ID_STUB_URL = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200/cdp-defra-id-stub';

async function cleanupUserPool() {
  console.log(`Cleaning up user pool...`);
  console.log(`DEFRA ID Stub URL: ${DEFRA_ID_STUB_URL}`);
  console.log('Note: Users are expired via POST /API/register/{userId}/expire\n');

  const client = new DefraIdStubClient(DEFRA_ID_STUB_URL);
  let expiredCount = 0;
  let failedCount = 0;
  let usersToClean = [];

  // Try to read users from users-pool.json first
  const filePath = 'users-pool.json';
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const poolData = JSON.parse(fileContent);
      usersToClean = poolData.users || [];
      console.log(`Found ${usersToClean.length} users in users-pool.json`);
    } catch (error) {
      console.warn(`Could not read users-pool.json: ${error.message}`);
      console.warn('Fallback not available - userId required for expiry');
    }
  } else {
    console.warn('users-pool.json not found');
    console.warn('Cannot expire users without userId (stored in users-pool.json)');
  }

  // Expire users
  for (let i = 0; i < usersToClean.length; i++) {
    const user = usersToClean[i];

    try {
      console.log(`[${i + 1}/${usersToClean.length}] Expiring user: ${user.email}`);

      if (!user.userId) {
        console.warn(`  No userId found for ${user.email} - cannot expire (userId required)`);
        failedCount++;
        continue;
      }

      const result = await client.expireUser(user.userId);

      if (result.success) {
        console.log(`  ✓ Expired ${user.email}`);
        expiredCount++;
      } else {
        // console.warn(`  ✗ Could not expire ${user.email}: ${result.message}`);
        console.warn(`  ✗ Could not expire ${user.email}`);
        failedCount++;
      }

      // Small delay to avoid overwhelming the stub
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.warn(`  ✗ Error expiring user ${user.email}:`, error.message);
      failedCount++;
    }
  }

  // Remove users-pool.json if it exists
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log('Removed users-pool.json');
    } catch (error) {
      console.warn(`Could not remove users-pool.json: ${error.message}`);
    }
  }

  console.log(`\nCleanup complete:`);
  console.log(`  Expired: ${expiredCount}`);
  console.log(`  Failed: ${failedCount}`);

  // Don't fail the test if cleanup fails - it's best effort
  if (failedCount > 0) {
    console.warn('\nNote: Some users could not be expired. Manual cleanup may be required.');
  }

  // Always exit 0 - cleanup failures shouldn't fail the test
  process.exit(0);
}

cleanupUserPool().catch(error => {
  console.error('Fatal error during cleanup:', error);
  // Still exit 0 - cleanup failures shouldn't fail the test
  process.exit(0);
});
