#!/usr/bin/env node

import { DefraIdStubClient } from '../lib/defra-id-stub-client.js';
import fs from 'fs';

const VUS_MAX = parseInt(process.env.VUS_MAX || '50', 10);
const USER_POOL_PREFIX = process.env.USER_POOL_PREFIX || 'k6-perf-user';
const USER_POOL_DOMAIN = process.env.USER_POOL_DOMAIN || 'example.com';
const DEFRA_ID_STUB_URL = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200';

async function cleanupUserPool() {
  console.log(`Cleaning up user pool (${VUS_MAX} users)...`);
  console.log(`DEFRA ID Stub URL: ${DEFRA_ID_STUB_URL}`);

  const client = new DefraIdStubClient(DEFRA_ID_STUB_URL);
  let deletedCount = 0;
  let failedCount = 0;

  for (let i = 1; i <= VUS_MAX; i++) {
    const email = `${USER_POOL_PREFIX}-${i}@${USER_POOL_DOMAIN}`;

    try {
      console.log(`[${i}/${VUS_MAX}] Attempting to delete user: ${email}`);

      const result = await client.deleteUser(email);

      if (result.success) {
        deletedCount++;
      } else {
        console.warn(`Could not delete ${email}: ${result.message}`);
        failedCount++;
      }

      // Small delay to avoid overwhelming the stub
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.warn(`Error deleting user ${email}:`, error.message);
      failedCount++;
    }
  }

  // Remove users-pool.json if it exists
  if (fs.existsSync('users-pool.json')) {
    try {
      fs.unlinkSync('users-pool.json');
      console.log('Removed users-pool.json');
    } catch (error) {
      console.warn(`Could not remove users-pool.json: ${error.message}`);
    }
  }

  console.log(`\nCleanup complete:`);
  console.log(`  Deleted: ${deletedCount}`);
  console.log(`  Failed: ${failedCount}`);

  // Don't fail the test if cleanup fails - it's best effort
  if (failedCount > 0) {
    console.warn('\nNote: Some users could not be deleted. Manual cleanup may be required.');
    console.warn('DEFRA ID stub may not support user deletion - users may accumulate in the stub.');
  }

  // Always exit 0 - cleanup failures shouldn't fail the test
  process.exit(0);
}

cleanupUserPool().catch(error => {
  console.error('Fatal error during cleanup:', error);
  // Still exit 0 - cleanup failures shouldn't fail the test
  process.exit(0);
});
