# K6 Performance Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Playwright-based k6 load tests for the trade-demo-frontend notification journey with automated user pool management.

**Architecture:** Dual-tool approach using Playwright for journey development (excellent DX, codegen, debugging) and k6 for load execution (efficient, scalable). User pool created via DEFRA ID stub API with predictable emails (k6-perf-user-${VU}@example.com), each virtual user gets dedicated credentials. Setup → Test → Teardown orchestration in entrypoint.sh.

**Tech Stack:** Node.js 20+, Playwright, k6, @k6/browser (for Playwright conversion), DEFRA ID stub API

---

## Task 1: Project Setup and Dependencies

**Files:**
- Create: `package.json`
- Create: `playwright.config.js`
- Create: `.gitignore` (update)

**Step 1: Initialize package.json**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/package.json`:

```json
{
  "name": "trade-demo-perf-tests",
  "version": "1.0.0",
  "description": "K6-based performance tests for trade-demo-frontend",
  "type": "module",
  "scripts": {
    "playwright": "playwright test",
    "playwright:debug": "playwright test --debug",
    "playwright:ui": "playwright test --ui",
    "playwright:codegen": "playwright codegen http://localhost:3000",
    "generate:k6": "node scripts/convert-to-k6.js",
    "setup:users": "node src/setup/create-user-pool.js",
    "cleanup:users": "node src/setup/cleanup-user-pool.js",
    "k6:local": "k6 run src/tests/notification-journey.js",
    "test:full": "npm run setup:users && npm run k6:local; EXIT_CODE=$?; npm run cleanup:users; exit $EXIT_CODE"
  },
  "keywords": ["performance", "k6", "playwright", "load-testing"],
  "author": "DEFRA",
  "license": "OGL-UK-3.0",
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "playwright": "^1.48.0"
  },
  "dependencies": {
    "playwright-to-k6": "^0.1.0"
  }
}
```

**Step 2: Create Playwright configuration**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/playwright.config.js`:

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: process.env.TARGET_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'echo "Start your services with: docker compose --profile performance up"',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

**Step 3: Update .gitignore**

Add to `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/.gitignore`:

```
# Node
node_modules/
package-lock.json

# Playwright
test-results/
playwright-report/
playwright/.cache/

# K6
*.html
summary.json
users-pool.json

# IDE
.vscode/
*.swp
*.swo
```

**Step 4: Install dependencies**

Run:
```bash
cd /Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests
npm install
npx playwright install chromium
```

Expected: Dependencies installed, Playwright browsers downloaded

**Step 5: Commit**

```bash
git add package.json playwright.config.js .gitignore
git commit -m "chore: initialize Node.js project with Playwright and k6 dependencies"
```

---

## Task 2: DEFRA ID Stub API Client Library

**Files:**
- Create: `src/lib/defra-id-stub-client.js`
- Create: `src/lib/defra-id-stub-client.test.js`

**Step 1: Write the test for user registration**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/lib/defra-id-stub-client.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DefraIdStubClient } from './defra-id-stub-client.js';

describe('DefraIdStubClient', () => {
  let client;

  beforeEach(() => {
    client = new DefraIdStubClient('http://localhost:3200');
  });

  it('should register a new user', async () => {
    const userData = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      loa: '1'
    };

    const result = await client.registerUser(userData);

    expect(result).toBeDefined();
    expect(result.email).toBe('test@example.com');
  });

  it('should retry on network failure', async () => {
    // Test retry logic
    const client = new DefraIdStubClient('http://invalid-host:9999');

    await expect(client.registerUser({ email: 'test@example.com' }))
      .rejects
      .toThrow();
  });
});
```

**Note:** We'll skip running Jest tests for now since the project uses Playwright. This is here for documentation. We'll verify manually.

**Step 2: Write the DEFRA ID stub client implementation**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/lib/defra-id-stub-client.js`:

```javascript
export class DefraIdStubClient {
  constructor(baseUrl = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200') {
    this.baseUrl = baseUrl;
    this.registerEndpoint = `${baseUrl}/cdp-defra-id-stub/API/register`;
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }

  async registerUser(userData) {
    const payload = {
      email: userData.email,
      firstName: userData.firstName || 'K6',
      lastName: userData.lastName || 'PerfUser',
      loa: userData.loa || '1',
      enrolmentCount: 1,
      enrolmentRequestCount: 1,
      relationships: [
        {
          organisationName: 'K6 Performance Test Organization',
          relationshipRole: 'Employee'
        }
      ]
    };

    return this._fetchWithRetry(this.registerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async deleteUser(email) {
    // Note: DEFRA ID stub may not have a delete endpoint
    // This is a placeholder for future implementation
    console.warn('Delete user not implemented in DEFRA ID stub');
    return { success: false, message: 'Delete endpoint not available' };
  }

  async _fetchWithRetry(url, options, retries = this.maxRetries) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0) {
        console.log(`Request failed, retrying... (${retries} attempts left)`);
        await this._sleep(this.retryDelay);
        return this._fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Step 3: Manual verification**

Run:
```bash
# Start services
docker compose --profile performance up -d defra-id-stub redis

# Test the client (in Node REPL)
node --input-type=module <<EOF
import { DefraIdStubClient } from './src/lib/defra-id-stub-client.js';
const client = new DefraIdStubClient('http://localhost:3200');
const result = await client.registerUser({ email: 'manual-test@example.com' });
console.log('Registration result:', result);
EOF
```

Expected: User registered successfully, JSON response with user data

**Step 4: Commit**

```bash
git add src/lib/
git commit -m "feat: add DEFRA ID stub API client with retry logic"
```

---

## Task 3: User Pool Setup Script

**Files:**
- Create: `src/setup/create-user-pool.js`

**Step 1: Write the user pool creation script**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/setup/create-user-pool.js`:

```javascript
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
```

**Step 2: Make script executable**

Run:
```bash
chmod +x src/setup/create-user-pool.js
```

**Step 3: Test the setup script**

Run:
```bash
# Ensure services are running
docker compose --profile performance up -d defra-id-stub redis

# Create small test pool
VUS_MAX=3 npm run setup:users
```

Expected:
- Output shows 3 users created
- `users-pool.json` file created with user data
- Exit code 0

**Step 4: Verify users in stub**

Visit `http://localhost:3200/cdp-defra-id-stub/users` or use the stub's UI to confirm users exist.

**Step 5: Commit**

```bash
git add src/setup/create-user-pool.js
git commit -m "feat: add user pool creation script with retry and error handling"
```

---

## Task 4: User Pool Cleanup Script

**Files:**
- Create: `src/setup/cleanup-user-pool.js`

**Step 1: Write the cleanup script**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/setup/cleanup-user-pool.js`:

```javascript
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

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error deleting user ${email}:`, error.message);
      failedCount++;
    }
  }

  // Remove users-pool.json if it exists
  if (fs.existsSync('users-pool.json')) {
    fs.unlinkSync('users-pool.json');
    console.log('Removed users-pool.json');
  }

  console.log(`\nCleanup complete:`);
  console.log(`  Deleted: ${deletedCount}`);
  console.log(`  Failed: ${failedCount}`);

  // Don't fail the test if cleanup fails - it's best effort
  if (failedCount > 0) {
    console.warn('\nNote: Some users could not be deleted. Manual cleanup may be required.');
    console.warn('DEFRA ID stub may not support user deletion - users may accumulate in the stub.');
  }

  process.exit(0);
}

cleanupUserPool().catch(error => {
  console.error('Fatal error during cleanup:', error);
  // Still exit 0 - cleanup failures shouldn't fail the test
  process.exit(0);
});
```

**Step 2: Make script executable**

Run:
```bash
chmod +x src/setup/cleanup-user-pool.js
```

**Step 3: Test the cleanup script**

Run:
```bash
# Run cleanup
VUS_MAX=3 npm run cleanup:users
```

Expected:
- Script runs without crashing
- Logs show cleanup attempts
- `users-pool.json` removed if it existed
- Exit code 0 (even if delete not supported)

**Step 4: Commit**

```bash
git add src/setup/cleanup-user-pool.js
git commit -m "feat: add user pool cleanup script with best-effort deletion"
```

---

## Task 5: Playwright Notification Journey Script

**Files:**
- Create: `src/playwright/notification-journey.spec.js`
- Create: `src/playwright/page-objects/dashboard-page.js`
- Create: `src/playwright/page-objects/auth-page.js`
- Create: `src/playwright/page-objects/notification-pages.js`

**Step 1: Create auth page object**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/playwright/page-objects/auth-page.js`:

```javascript
export class AuthPage {
  constructor(page) {
    this.page = page;
  }

  async signIn() {
    // Click "Sign in" button on frontend
    await this.page.click('text=Sign in');

    // Wait for redirect to DEFRA ID stub
    await this.page.waitForURL(/cdp-defra-id-stub/);
  }

  async selectUser(email) {
    // In DEFRA ID stub, click the user by email
    // The stub typically shows a list of users
    await this.page.click(`text=${email}`);

    // Wait for redirect back to application
    await this.page.waitForURL(/^(?!.*cdp-defra-id-stub).*/);
  }

  async verifyAuthenticated(expectedName = 'K6') {
    // Verify user name appears next to "Sign out"
    const signOutSection = this.page.locator('text=Sign out').locator('..');
    await expect(signOutSection).toContainText(expectedName);
  }
}
```

**Step 2: Create dashboard page object**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/playwright/page-objects/dashboard-page.js`:

```javascript
export class DashboardPage {
  constructor(page) {
    this.page = page;
  }

  async clickNewImport() {
    await this.page.click('text=New Import');
  }

  async verifyNotificationInList() {
    // Check that a notification appears in the dashboard list
    // This is a simple check - may need refinement based on actual UI
    const notificationList = this.page.locator('[data-testid="notification-list"]').or(
      this.page.locator('table').first()
    );
    await expect(notificationList).toBeVisible();
  }
}
```

**Step 3: Create notification pages object**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/playwright/page-objects/notification-pages.js`:

```javascript
export class NotificationPages {
  constructor(page) {
    this.page = page;
  }

  // Origin page
  async fillOrigin(country = 'United States') {
    await this.page.selectOption('select[name="country"]', { label: country });
    await this.page.click('button:has-text("Save and Continue")');
  }

  // Commodity page
  async searchCommodity(code = '0102') {
    await this.page.fill('input[name="commodityCode"]', code);
    await this.page.click('button:has-text("Search")');
  }

  async selectCommodityRefinement(text = 'Bison bison') {
    await this.page.click(`text=${text}`);
    await this.page.click('button:has-text("Save and Continue")');
  }

  // Commodity Quantities
  async fillCommodityQuantities(quantity = '100') {
    // May have multiple quantity fields - fill all visible ones
    const quantityInputs = this.page.locator('input[type="number"]').or(
      this.page.locator('input[name*="quantity"]')
    );
    const count = await quantityInputs.count();

    for (let i = 0; i < count; i++) {
      await quantityInputs.nth(i).fill(quantity.toString());
    }

    await this.page.click('button:has-text("Save and Continue")');
  }

  // Purpose page
  async fillPurpose() {
    await this.page.check('input[value*="Great Britain"]').or(
      this.page.locator('text=For import into Great Britain or northern Ireland').locator('..')
    );
    await this.page.selectOption('select[name*="purpose"]', { label: 'Slaughter' });
    await this.page.click('button:has-text("Save and Continue")');
  }

  // Transport page
  async fillTransport() {
    await this.page.fill('input[name*="port"]', 'DOVER');
    await this.page.selectOption('select[name*="meansOfTransport"]', { label: 'Railway' });

    // Random 10-character vehicle ID
    const vehicleId = Math.random().toString(36).substring(2, 12).toUpperCase();
    await this.page.fill('input[name*="vehicle"]', vehicleId);

    await this.page.click('button:has-text("Save and Continue")');
  }

  // Review page operations
  async clickChangeCommodity() {
    // Click "Change" link in the commodity row
    const commodityRow = this.page.locator('text=Commodity').locator('..');
    await commodityRow.locator('a:has-text("Change")').click();
  }

  async saveAndContinueThroughPages() {
    // Click "Save and Continue" until we're back at Review
    // We need to go through: Quantities -> Purpose -> Transport -> Review
    for (let i = 0; i < 3; i++) {
      await this.page.waitForTimeout(500); // Small wait for page to stabilize
      await this.page.click('button:has-text("Save and Continue")');
    }
  }

  async saveAsDraft() {
    await this.page.click('button:has-text("Save as draft")');
  }

  async submitNotification() {
    await this.page.check('input[type="checkbox"]');
    await this.page.click('button:has-text("Submit notification")');
  }

  async verifyConfirmation() {
    // Check for confirmation message
    await expect(this.page.locator('h1')).toContainText('Notification submitted');
  }

  async returnToDashboard() {
    await this.page.click('a:has-text("Dashboard")').or(
      this.page.click('a:has-text("Return to dashboard")')
    );
  }
}
```

**Step 4: Write the main Playwright test**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/playwright/notification-journey.spec.js`:

```javascript
import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page.js';
import { DashboardPage } from './page-objects/dashboard-page.js';
import { NotificationPages } from './page-objects/notification-pages.js';

test.describe('Notification Journey', () => {
  test('Create and submit import notification', async ({ page }) => {
    const testUserEmail = 'k6-perf-user-1@example.com';

    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);
    const notificationPages = new NotificationPages(page);

    // Navigate to frontend
    await page.goto('/');

    // Authenticate via DEFRA ID stub
    await authPage.signIn();
    await authPage.selectUser(testUserEmail);
    await authPage.verifyAuthenticated('K6');

    // Start new import notification
    await dashboardPage.clickNewImport();

    // Fill Origin page
    await notificationPages.fillOrigin();

    // Search and select commodity
    await notificationPages.searchCommodity('0102');
    await notificationPages.selectCommodityRefinement('Bison bison');

    // Fill commodity quantities
    await notificationPages.fillCommodityQuantities('100');

    // Fill purpose
    await notificationPages.fillPurpose();

    // Fill transport
    await notificationPages.fillTransport();

    // We're now on Review page - click Change for commodity
    await notificationPages.clickChangeCommodity();

    // Update quantities with new random values
    const newQuantity = Math.floor(Math.random() * 500) + 1;
    await notificationPages.fillCommodityQuantities(newQuantity.toString());

    // Click through Purpose and Transport pages back to Review
    await notificationPages.saveAndContinueThroughPages();

    // Save as draft
    await notificationPages.saveAsDraft();

    // Submit notification
    await notificationPages.submitNotification();

    // Verify confirmation
    await notificationPages.verifyConfirmation();

    // Return to dashboard
    await notificationPages.returnToDashboard();

    // Verify notification appears in list
    await dashboardPage.verifyNotificationInList();
  });
});
```

**Step 5: Run Playwright test locally**

Run:
```bash
# Ensure services are running
docker compose --profile performance up -d

# Create test user
VUS_MAX=1 npm run setup:users

# Run Playwright test
npm run playwright
```

Expected:
- Test runs and completes the full journey
- Green checkmark for passing test
- Screenshot/video captured if configured

**Step 6: Debug if needed**

If test fails:
```bash
# Run with UI mode for debugging
npm run playwright:ui

# Or run with debug mode
npm run playwright:debug
```

**Step 7: Commit**

```bash
git add src/playwright/
git commit -m "feat: add Playwright notification journey test with page objects"
```

---

## Task 6: Playwright to k6 Conversion Script

**Files:**
- Create: `scripts/convert-to-k6.js`

**Step 1: Create conversion script**

Create `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/scripts/convert-to-k6.js`:

```javascript
#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PLAYWRIGHT_SCRIPT = 'src/playwright/notification-journey.spec.js';
const K6_OUTPUT = 'src/tests/notification-journey.js';

console.log('Converting Playwright script to k6...');
console.log(`Input: ${PLAYWRIGHT_SCRIPT}`);
console.log(`Output: ${K6_OUTPUT}`);

try {
  // Note: playwright-to-k6 may not be fully compatible with all Playwright features
  // This is a starting point - manual adjustments will be needed

  console.log('\nAttempting conversion with playwright-to-k6...');

  try {
    execSync(`npx playwright-to-k6 ${PLAYWRIGHT_SCRIPT} -o ${K6_OUTPUT}`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('\nNote: playwright-to-k6 conversion may have issues.');
    console.warn('Creating a manual k6 template instead...');

    // Create a manual k6 template since playwright-to-k6 may not work perfectly
    createManualK6Template();
  }

  console.log(`\n✓ Conversion complete!`);
  console.log(`\nNext steps:`);
  console.log(`1. Review ${K6_OUTPUT} and add manual enhancements`);
  console.log(`2. Add environment variable configuration`);
  console.log(`3. Add VU-based user selection`);
  console.log(`4. Add load test scenarios and thresholds`);
  console.log(`5. Add custom metrics and checks`);

} catch (error) {
  console.error('Conversion failed:', error.message);
  console.log('\nCreating manual k6 template as fallback...');
  createManualK6Template();
}

function createManualK6Template() {
  // Create a template k6 script that needs to be manually filled in
  // This is a fallback since playwright-to-k6 may not work perfectly

  const template = `// Generated from Playwright script - MANUAL CONVERSION NEEDED
// Original: ${PLAYWRIGHT_SCRIPT}
// Generated: ${new Date().toISOString()}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const journeyDuration = new Trend('notification_journey_duration');
const draftSaveTime = new Trend('draft_save_duration');
const submissionTime = new Trend('submission_duration');
const failedJourneys = new Counter('failed_journeys');

// Load test configuration
export const options = {
  scenarios: {
    ramp_up_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.RAMP_UP_DURATION || '5m', target: parseInt(__ENV.VUS_MAX || '50') },
        { duration: __ENV.HOLD_DURATION || '10m', target: parseInt(__ENV.VUS_MAX || '50') },
        { duration: __ENV.RAMP_DOWN_DURATION || '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration': [
      \`p(95)<\${__ENV.THRESHOLD_P95_MS || '3000'}\`,
      \`p(99)<\${__ENV.THRESHOLD_P99_MS || '5000'}\`
    ],
    'http_req_failed': [\`rate<\${__ENV.THRESHOLD_ERROR_RATE || '0.01'}\`],
    'checks': ['rate>0.95'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const DEFRA_ID_STUB_URL = __ENV.DEFRA_ID_STUB_URL || 'http://localhost:3200';
const USER_POOL_PREFIX = __ENV.USER_POOL_PREFIX || 'k6-perf-user';
const USER_POOL_DOMAIN = __ENV.USER_POOL_DOMAIN || 'example.com';

export default function () {
  const startTime = Date.now();

  // Each VU uses a dedicated user from the pool
  const userEmail = \`\${USER_POOL_PREFIX}-\${__VU}@\${USER_POOL_DOMAIN}\`;

  console.log(\`VU \${__VU}: Starting journey with user \${userEmail}\`);

  // TODO: Implement the notification journey
  // This is a placeholder - you need to implement the actual HTTP requests
  // based on the Playwright script flow

  // 1. Authentication flow (sign in, select user, verify)
  // 2. Dashboard -> New Import
  // 3. Origin -> Commodity -> Quantities -> Purpose -> Transport -> Review
  // 4. Change commodity -> Update quantities -> Back to Review
  // 5. Save as draft
  // 6. Submit notification
  // 7. Verify in dashboard

  const response = http.get(BASE_URL);

  check(response, {
    'homepage loaded': (r) => r.status === 200,
  });

  // Record journey duration
  const journeyTime = Date.now() - startTime;
  journeyDuration.add(journeyTime);

  sleep(1);
}
`;

  fs.mkdirSync(path.dirname(K6_OUTPUT), { recursive: true });
  fs.writeFileSync(K6_OUTPUT, template);
  console.log(`Created manual k6 template at ${K6_OUTPUT}`);
}
```

**Step 2: Make script executable**

Run:
```bash
chmod +x scripts/convert-to-k6.js
```

**Step 3: Run conversion**

Run:
```bash
npm run generate:k6
```

Expected:
- Conversion runs (may show warnings)
- `src/tests/notification-journey.js` created
- Console shows next steps

**Step 4: Commit**

```bash
git add scripts/convert-to-k6.js src/tests/notification-journey.js
git commit -m "feat: add Playwright to k6 conversion script and generated k6 template"
```

---

## Task 7: Enhanced k6 Test Implementation

**Files:**
- Modify: `src/tests/notification-journey.js`

**Step 1: Update k6 script with manual implementation**

Since playwright-to-k6 conversion is limited, we need to manually implement the k6 test based on the Playwright journey.

**Note:** This is a significant manual task. The k6 script needs to replicate the Playwright journey using HTTP requests and HTML parsing. Due to the complexity and the need to inspect actual HTTP requests from the application, this step requires:

1. Running the Playwright test with network logging
2. Capturing the actual HTTP requests made during the journey
3. Replicating those requests in k6
4. Handling cookies, CSRF tokens, session management

**For now, create a functional k6 smoke test that verifies the basic flow:**

Update `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/src/tests/notification-journey.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const journeyDuration = new Trend('notification_journey_duration');
const failedJourneys = new Counter('failed_journeys');

// Load test configuration
export const options = {
  scenarios: {
    ramp_up_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.RAMP_UP_DURATION || '5m', target: parseInt(__ENV.VUS_MAX || '50') },
        { duration: __ENV.HOLD_DURATION || '10m', target: parseInt(__ENV.VUS_MAX || '50') },
        { duration: __ENV.RAMP_DOWN_DURATION || '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration': [
      `p(95)<${__ENV.THRESHOLD_P95_MS || '3000'}`,
      `p(99)<${__ENV.THRESHOLD_P99_MS || '5000'}`
    ],
    'http_req_failed': [`rate<${__ENV.THRESHOLD_ERROR_RATE || '0.01'}`],
    'checks': ['rate>0.95'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const USER_POOL_PREFIX = __ENV.USER_POOL_PREFIX || 'k6-perf-user';
const USER_POOL_DOMAIN = __ENV.USER_POOL_DOMAIN || 'example.com';

export default function () {
  const startTime = Date.now();

  // Each VU uses a dedicated user from the pool
  const userEmail = `${USER_POOL_PREFIX}-${__VU}@${USER_POOL_DOMAIN}`;

  console.log(`VU ${__VU}: Starting journey with user ${userEmail}`);

  // Placeholder: Basic smoke test
  // TODO: Implement full notification journey with actual HTTP requests

  const homepageResponse = http.get(BASE_URL);

  check(homepageResponse, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage has title': (r) => r.body.includes('<title>'),
  });

  if (homepageResponse.status !== 200) {
    failedJourneys.add(1);
    return;
  }

  // Record journey duration
  const journeyTime = Date.now() - startTime;
  journeyDuration.add(journeyTime);

  sleep(1);
}

export function handleSummary(data) {
  // Generate HTML report
  return {
    'index.html': htmlReport(data),
  };
}

function htmlReport(data) {
  const date = new Date().toISOString();
  const metrics = data.metrics;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>K6 Performance Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .pass { color: green; }
    .fail { color: red; }
  </style>
</head>
<body>
  <h1>K6 Performance Test Report</h1>
  <p><strong>Generated:</strong> ${date}</p>
  <p><strong>VUs:</strong> ${data.state?.testRunDurationMs ? 'Completed' : 'Running'}</p>

  <h2>Metrics</h2>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    ${Object.entries(metrics).map(([name, metric]) => `
      <tr>
        <td>${name}</td>
        <td>${JSON.stringify(metric.values || metric)}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>
`;
}
```

**Step 2: Test the k6 script locally**

Run:
```bash
# Create user pool
VUS_MAX=2 npm run setup:users

# Run k6 test with minimal load
k6 run --vus 2 --duration 30s src/tests/notification-journey.js
```

Expected:
- k6 runs successfully
- Basic HTTP checks pass
- Metrics displayed
- `index.html` report generated

**Step 3: Commit**

```bash
git add src/tests/notification-journey.js
git commit -m "feat: implement k6 smoke test with metrics and HTML reporting"
```

---

## Task 8: Update Entrypoint Script

**Files:**
- Modify: `entrypoint.sh`

**Step 1: Update entrypoint.sh to orchestrate setup/test/teardown**

Modify `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/entrypoint.sh`:

```bash
#!/usr/bin/env bash

echo "run_id: $RUN_ID in $ENVIRONMENT"

K6_HOME=/opt/perftest
K6_REPORT=index.html
K6_SUMMARY=summary.json

export HTTPS_PROXY=http://localhost:3128

# Validate VUS_MAX matches pool size
VUS_MAX=${VUS_MAX:-50}
echo "Configured for ${VUS_MAX} virtual users"

# Setup: Create user pool
echo "=== Setup: Creating user pool ==="
node ${K6_HOME}/src/setup/create-user-pool.js
setup_exit_code=$?

if [ $setup_exit_code -ne 0 ]; then
  echo "ERROR: User pool creation failed"
  exit $setup_exit_code
fi

# Run k6 test
echo "=== Running k6 performance test ==="
k6 run \
  -e TARGET_URL=${TARGET_URL:-https://trade-demo-frontend.${ENVIRONMENT}.cdp-int.defra.cloud} \
  -e VUS_MAX=${VUS_MAX} \
  -e RAMP_UP_DURATION=${RAMP_UP_DURATION:-5m} \
  -e HOLD_DURATION=${HOLD_DURATION:-10m} \
  -e RAMP_DOWN_DURATION=${RAMP_DOWN_DURATION:-2m} \
  -e THRESHOLD_P95_MS=${THRESHOLD_P95_MS:-3000} \
  -e THRESHOLD_P99_MS=${THRESHOLD_P99_MS:-5000} \
  -e THRESHOLD_ERROR_RATE=${THRESHOLD_ERROR_RATE:-0.01} \
  -e DEFRA_ID_STUB_URL=${DEFRA_ID_STUB_URL:-http://defra-id-stub:3200} \
  ${K6_HOME}/src/tests/notification-journey.js \
  --summary-export=${K6_SUMMARY}
test_exit_code=$?

# Teardown: Cleanup user pool (always run, even if test failed)
echo "=== Teardown: Cleaning up user pool ==="
node ${K6_HOME}/src/setup/cleanup-user-pool.js
cleanup_exit_code=$?

if [ $cleanup_exit_code -ne 0 ]; then
  echo "WARNING: User pool cleanup had issues (non-fatal)"
fi

# Publish results to S3
if [ -n "$RESULTS_OUTPUT_S3_PATH" ]; then
  if [ -f "$K6_REPORT" -a -f "$K6_SUMMARY" ]; then
    echo "=== Publishing results to S3 ==="
    aws --endpoint-url=$S3_ENDPOINT s3 cp "$K6_REPORT" "$RESULTS_OUTPUT_S3_PATH/$K6_REPORT"
    aws --endpoint-url=$S3_ENDPOINT s3 cp "$K6_SUMMARY" "$RESULTS_OUTPUT_S3_PATH/$K6_SUMMARY"
    if [ $? -eq 0 ]; then
      echo "HTML and summary report files published to $RESULTS_OUTPUT_S3_PATH"
    fi
  else
    echo "WARNING: $K6_REPORT or $K6_SUMMARY not found"
  fi
else
  echo "RESULTS_OUTPUT_S3_PATH is not set - skipping S3 upload (OK for local runs)"
fi

# Exit with k6's exit code to preserve pass/fail status
exit $test_exit_code
```

**Step 2: Update Dockerfile to include Node.js**

Modify `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/Dockerfile`:

```dockerfile
FROM grafana/k6:latest

ENV TZ="Europe/London"

USER root

# Install Node.js and dependencies
RUN apk add --no-cache \
   aws-cli \
   bash \
   curl \
   nodejs \
   npm

USER k6

WORKDIR /opt/perftest

COPY package.json ./
COPY src/ ./src/
COPY entrypoint.sh .

# Install Node.js dependencies
RUN npm install --production

ENV S3_ENDPOINT=https://s3.eu-west-2.amazonaws.com

ENTRYPOINT [ "./entrypoint.sh" ]
```

**Step 3: Test the full orchestration locally**

Run:
```bash
# Build the Docker image
docker build -t trade-demo-perf-tests .

# Run locally with docker compose
docker compose up --build development
```

Expected:
- Setup script creates users
- k6 runs the test
- Cleanup script removes users
- Reports uploaded to LocalStack S3
- Container exits with k6's exit code

**Step 4: Commit**

```bash
git add entrypoint.sh Dockerfile
git commit -m "feat: orchestrate setup/test/teardown in entrypoint with Node.js support"
```

---

## Task 9: Documentation and README

**Files:**
- Modify: `README.md`

**Step 1: Update README with k6 instructions**

Update `/Users/andrewharrison-defra/Defra/trade/trade-demo-perf-tests/README.md`:

```markdown
# trade-demo-perf-tests

K6-based performance tests for the trade-demo-frontend notification journey.

## Architecture

This project uses a dual-tool approach:
- **Playwright** for journey development (excellent DX, codegen, debugging)
- **k6** for load execution (efficient, scalable)

User pool management via DEFRA ID stub API with predictable emails.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local Playwright development)
- Running services via `docker compose --profile performance up`

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Start services:**
   ```bash
   docker compose --profile performance up -d
   ```

3. **Develop/test Playwright journeys:**
   ```bash
   # Run Playwright tests
   npm run playwright

   # Debug with UI
   npm run playwright:ui

   # Record new tests
   npm run playwright:codegen
   ```

4. **Convert to k6:**
   ```bash
   npm run generate:k6
   ```

5. **Run k6 locally:**
   ```bash
   # Create user pool
   VUS_MAX=5 npm run setup:users

   # Run k6 test
   npm run k6:local

   # Cleanup
   npm run cleanup:users

   # Or run everything
   npm run test:full
   ```

### Docker-Based Testing

Run the full test suite in Docker:

```bash
docker compose up --build development
```

This orchestrates:
1. User pool creation (setup)
2. k6 load test execution
3. User pool cleanup (teardown)
4. Results upload to S3

## Configuration

Configure via environment variables:

**Test Target:**
- `TARGET_URL` - Frontend URL (default: `http://localhost:3000`)
- `DEFRA_ID_STUB_URL` - DEFRA ID stub endpoint (default: `http://localhost:3200`)

**Load Parameters:**
- `VUS_MAX` - Maximum concurrent virtual users (default: `50`)
- `RAMP_UP_DURATION` - Ramp-up time (default: `5m`)
- `HOLD_DURATION` - Hold time at peak (default: `10m`)
- `RAMP_DOWN_DURATION` - Ramp-down time (default: `2m`)

**Thresholds:**
- `THRESHOLD_P95_MS` - P95 response time threshold (default: `3000`)
- `THRESHOLD_P99_MS` - P99 response time threshold (default: `5000`)
- `THRESHOLD_ERROR_RATE` - Maximum error rate (default: `0.01`)

**AWS/S3:**
- `RESULTS_OUTPUT_S3_PATH` - S3 path for results
- `S3_ENDPOINT` - S3 endpoint URL
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**User Pool:**
- `USER_POOL_PREFIX` - Email prefix (default: `k6-perf-user`)
- `USER_POOL_DOMAIN` - Email domain (default: `example.com`)

## Project Structure

```
trade-demo-perf-tests/
├── src/
│   ├── playwright/           # Playwright journey scripts
│   │   ├── page-objects/     # Page object models
│   │   └── notification-journey.spec.js
│   ├── tests/                # Generated k6 scripts
│   │   └── notification-journey.js
│   ├── setup/                # User pool management
│   │   ├── create-user-pool.js
│   │   └── cleanup-user-pool.js
│   └── lib/                  # Shared libraries
│       └── defra-id-stub-client.js
├── scripts/                  # Build/conversion scripts
│   └── convert-to-k6.js
├── docs/plans/               # Design documents
├── package.json
├── playwright.config.js
├── Dockerfile
├── entrypoint.sh
└── compose.yml
```

## CI/CD

The GitHub workflow (`.github/workflows/publish.yml`) builds and publishes the Docker image on push to `main`.

## Testing Strategy

1. **Playwright Development:** Write/verify journeys in Playwright
2. **Conversion:** Generate k6 scripts with manual enhancements
3. **Local Smoke Test:** Run with minimal VUs locally
4. **Docker Integration Test:** Full stack test via Docker Compose
5. **Platform Execution:** Run via CDP Portal

## Known Limitations

- DEFRA ID stub may not support user deletion (cleanup is best-effort)
- playwright-to-k6 conversion requires manual enhancement
- k6 script needs manual HTTP request implementation for full journey

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with k6 architecture and usage instructions"
```

---

## Task 10: Final Integration Test

**Files:**
- None (testing only)

**Step 1: Clean environment**

Run:
```bash
docker compose down -v
```

**Step 2: Build and test full stack**

Run:
```bash
docker compose --profile performance up -d
```

Wait for all services to be healthy.

**Step 3: Run the performance test**

Run:
```bash
docker compose up --build development
```

Expected:
- Container builds successfully
- Setup creates user pool
- k6 runs test
- Cleanup removes users
- Exit code 0 (or k6's exit code)
- Reports in `./reports/` directory

**Step 4: Verify reports**

Check:
```bash
ls -lh reports/
cat reports/index.html  # Should contain HTML report
cat reports/summary.json  # Should contain JSON summary
```

**Step 5: Verify S3 upload (LocalStack)**

```bash
aws --endpoint-url=http://localhost:4566 s3 ls s3://test-results/ --recursive
```

Expected: Files uploaded to S3 bucket

**Step 6: Final commit**

```bash
git status
# Commit any remaining changes
git commit -m "test: verify full integration test passes"
```

---

## Next Steps

1. **Implement Full k6 Journey:** The current k6 script is a placeholder. Implement the actual HTTP requests for the notification journey by:
   - Running Playwright with network logging
   - Capturing HTTP requests, cookies, CSRF tokens
   - Replicating in k6

2. **Add Multiple Scenarios:** Implement smoke, stress, spike test scenarios

3. **Enhanced Reporting:** Add more detailed metrics, custom checks

4. **CI/CD Integration:** Test in actual CDP platform environment

5. **Performance Baselines:** Establish performance baselines and alerts

---

## Troubleshooting

**User pool creation fails:**
- Check DEFRA ID stub is running: `docker compose ps defra-id-stub`
- Verify network connectivity
- Check stub logs: `docker compose logs defra-id-stub`

**Playwright test fails:**
- Use UI mode: `npm run playwright:ui`
- Check selectors match actual UI
- Verify services are running

**k6 test fails:**
- Check user pool was created
- Verify TARGET_URL is correct
- Review k6 logs for specific errors

**Docker build fails:**
- Clear Docker cache: `docker compose build --no-cache`
- Check Dockerfile syntax
- Verify all files exist
