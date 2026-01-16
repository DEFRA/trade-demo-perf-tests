#!/usr/bin/env node

import { DefraIdStubClient } from '../lib/defra-id-stub-client.js';
import fs from 'fs';

const VUS_MAX = parseInt(process.env.VUS_MAX || '50', 10);
const USER_POOL_PREFIX = process.env.USER_POOL_PREFIX || 'k6-perf-user';
const USER_POOL_DOMAIN = process.env.USER_POOL_DOMAIN || 'example.com';
const DEFRA_ID_STUB_URL = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200';

async function createUserPool() {
  console.log(`Creating user pool with ${VUS_MAX} users...`);
  console.log(`DEFRA ID Stub URL: ${DEFRA_ID_STUB_URL}`);

  const client = new DefraIdStubClient(DEFRA_ID_STUB_URL);
  const users = [];
  const errors = [];

  for (let i = 1; i <= VUS_MAX; i++) {
    const email = `${USER_POOL_PREFIX}-${i}@${USER_POOL_DOMAIN}`;

    try {
      console.log(`[${i}/${VUS_MAX}] Creating user: ${email}`);

      const result = await client.registerUser({
        email,
        firstName: 'K6',
        lastName: `PerfUser${i}`,
        loa: '1'
      });

      users.push({
        email,
        userId: result.userId || result.id,
        createdAt: new Date().toISOString()
      });

      // Small delay to avoid overwhelming the stub
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Failed to create user ${email}:`, error.message);
      errors.push({ email, error: error.message });
    }
  }

  // Write user pool to file for reference
  const poolData = {
    createdAt: new Date().toISOString(),
    vusMax: VUS_MAX,
    users,
    errors
  };

  fs.writeFileSync('users-pool.json', JSON.stringify(poolData, null, 2));
  console.log(`User pool saved to users-pool.json`);

  if (errors.length > 0) {
    console.error(`\nFailed to create ${errors.length} users`);
    process.exit(1);
  }

  console.log(`\nSuccessfully created ${users.length} users`);
  process.exit(0);
}

createUserPool().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
