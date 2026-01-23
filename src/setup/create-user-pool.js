#!/usr/bin/env node

import { DefraIdStubClient } from '../lib/defra-id-stub-client.js';
import fs from 'fs';
import crypto from 'crypto';

const VUS_MAX = parseInt(process.env.VUS_MAX || '50', 10);
const USER_POOL_PREFIX = process.env.USER_POOL_PREFIX || 'k6-perf-user';
const USER_POOL_DOMAIN = process.env.USER_POOL_DOMAIN || 'example.com';
const DEFRA_ID_STUB_URL = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200';
const FAILURE_TOLERANCE = 0.1; // Allow up to 10% failure rate

// Validate VUS_MAX
if (isNaN(VUS_MAX)) {
  console.error('Error: VUS_MAX must be a valid number');
  process.exit(1);
}

if (VUS_MAX < 1) {
  console.error('Error: VUS_MAX must be at least 1');
  process.exit(1);
}

if (VUS_MAX > 1000) {
  console.error('Error: VUS_MAX must not exceed 1000');
  process.exit(1);
}

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
        userId: crypto.randomUUID(),
        email,
        firstName: 'K6',
        lastName: `PerfUser${i}`,
        loa: '1',
        aal: '1',
        enrolmentCount: '1',
        enrolmentRequestCount: '1'
      });

      console.log(`  User created: ${email}`);

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

  // Check failure rate against tolerance threshold
  if (errors.length > 0) {
    const failureRate = errors.length / VUS_MAX;
    const failurePercentage = (failureRate * 100).toFixed(2);

    console.warn(`\nFailed to create ${errors.length} users (${failurePercentage}% failure rate)`);

    if (failureRate > FAILURE_TOLERANCE) {
      console.error(`Failure rate ${failurePercentage}% exceeds tolerance threshold of ${FAILURE_TOLERANCE * 100}%`);
      process.exit(1);
    } else {
      console.warn(`Failure rate ${failurePercentage}% is within tolerance threshold of ${FAILURE_TOLERANCE * 100}%`);
    }
  }

  console.log(`\nSuccessfully created ${users.length} users`);
  process.exit(0);
}

createUserPool().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
