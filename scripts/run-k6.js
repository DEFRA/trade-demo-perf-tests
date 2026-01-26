#!/usr/bin/env node
/**
 * K6 Test Runner
 * Wrapper script to forward environment variables to K6 using -e flags
 *
 * Usage: node scripts/run-k6.js <test-file>
 * Example: K6_WORKLOAD=load K6_THRESHOLD=medium node scripts/run-k6.js src/tests/trade-import-notification.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables to forward to K6
const K6_ENV_VARS = [
  // Profile configuration
  'K6_WORKLOAD',
  'K6_THRESHOLD',

  // Manual workload configuration
  'VUS_MAX',
  'RAMP_UP_DURATION',
  'HOLD_DURATION',
  'RAMP_DOWN_DURATION',

  // Manual threshold configuration
  'THRESHOLD_P95_MS',
  'THRESHOLD_P99_MS',
  'THRESHOLD_ERROR_RATE',

  // Application URLs
  'TARGET_URL',
  'DEFRA_ID_STUB_URL',

  // User pool configuration
  'USER_POOL_PREFIX',
  'USER_POOL_DOMAIN'
];

// Get test file from command line arguments
const testFile = process.argv[2];
if (!testFile) {
  console.error('Error: Test file path is required');
  console.error('Usage: node scripts/run-k6.js <test-file>');
  process.exit(1);
}

// Resolve test file path relative to project root
const projectRoot = resolve(__dirname, '..');
const testFilePath = resolve(projectRoot, testFile);

// Build K6 command arguments
const k6Args = ['run'];

// Add -e flags for each defined environment variable
K6_ENV_VARS.forEach(varName => {
  const value = process.env[varName];
  if (value !== undefined) {
    k6Args.push('-e', `${varName}=${value}`);
  }
});

// Add test file path
k6Args.push(testFilePath);

// Log the command being executed (for debugging)
console.log(`Running: k6 ${k6Args.join(' ')}\n`);

// Execute K6 with forwarded environment variables
const k6Process = spawn('k6', k6Args, {
  stdio: 'inherit',
  cwd: projectRoot
});

// Handle process exit
k6Process.on('exit', (code) => {
  process.exit(code);
});

// Handle errors
k6Process.on('error', (error) => {
  console.error(`Error executing k6: ${error.message}`);
  process.exit(1);
});
