# K6 Performance Tests Design

**Date:** 2026-01-16
**Project:** trade-demo-perf-tests
**Purpose:** Load testing for trade-demo-frontend notification journey

## Overview

The trade-demo-perf-tests project will implement performance tests for the trade-demo-frontend application using a dual-tool approach: Playwright for journey development and k6 for load execution. This combines Playwright's excellent developer experience with k6's efficient load testing capabilities.

## Architecture

### High-Level Flow

1. **Setup phase**: Create user pool via DEFRA ID stub API (e.g., 50 users with predictable emails)
2. **Load test execution**: k6 runs converted scripts, each virtual user uses a dedicated pool user
3. **Teardown phase**: Clean up created users via stub API
4. **Reporting**: Upload k6 HTML report and JSON summary to S3

### Key Architectural Decisions

- Playwright scripts live in `src/playwright/` as the source of truth for user journeys
- Conversion to k6 via `playwright-to-k6` generates `src/tests/*.js` files
- Both Playwright and k6 scripts are committed to version control
- User pool uses predictable pattern: `k6-perf-user-${VU_NUMBER}@example.com`
- Each virtual user maps to one pool user (VU 1 → user-1, VU 2 → user-2)
- Authentication uses DEFRA ID stub's "select user from list" flow (no passwords needed)

### Environment-Driven Configuration

- `TARGET_URL`: Target frontend (default: `http://localhost:3000`)
- `VUS_MAX`: Maximum concurrent virtual users (default: 50)
- `RAMP_UP_DURATION`: Time to reach max VUs (default: 5m)
- `HOLD_DURATION`: Time at peak load (default: 10m)
- Existing infrastructure already handles S3 upload, proxy config, result publishing

## User Pool Management

### Setup Phase

A Node.js script (`src/setup/create-user-pool.js`) will call the DEFRA ID stub API to bulk-create users:

- Read `VUS_MAX` environment variable to determine pool size
- Generate predictable user data: `k6-perf-user-1@example.com` through `k6-perf-user-${VUS_MAX}@example.com`
- Make HTTP POST requests to the stub's `/cdp-defra-id-stub/API/register` endpoint
- Each user payload includes: email, firstName ("K6"), lastName ("PerfUser"), loa, enrolment data
- Store created user emails in a simple JSON file (`users-pool.json`) for reference
- Exit with error code if any user creation fails

### Teardown Phase

A matching script (`src/setup/cleanup-user-pool.js`) will:

- Read the same environment variables
- Call the stub API to delete users (need to investigate stub's delete endpoint)
- If no delete endpoint exists, document that users accumulate in stub and require manual cleanup
- Log cleanup results but don't fail the test if cleanup fails (test results are more important)

### User Selection in k6 Tests

Each k6 virtual user will use its built-in `__VU` identifier to select a user:

```javascript
const userEmail = `k6-perf-user-${__VU}@example.com`;
```

This ensures clean isolation - VU 1 always uses user-1, VU 2 uses user-2, etc. No shared state, no race conditions.

## Playwright Journey Implementation

### Authentication Flow

- Navigate to `${TARGET_URL}`
- Click "Sign in" button
- Wait for redirect to DEFRA ID stub
- Find and click the user by email (using test data: `k6-perf-user-1@example.com` for recording)
- Wait for redirect back to application
- Assert user name appears next to "Sign out" button

### Notification Journey Steps

1. **Dashboard → New Import**: Click "New Import" or similar CTA
2. **Origin page**: Select country from dropdown, click "Save and Continue"
3. **Commodity page**: Enter "0102" in commodity code field, click "Search"
4. **Commodity refinement**: Select "Bison bison" from results, click "Save and Continue"
5. **Commodity Quantities**: Enter integer values (e.g., "100"), click "Save and Continue"
6. **Purpose page**: Select "For import into Great Britain or northern Ireland" radio, select "Slaughter" from dropdown, click "Save and Continue"
7. **Transport page**: Type "DOVER", select "Railway" for means of transport, enter 10-char random string for vehicle ID, click "Save and Continue"
8. **Review page (first visit)**: Click "Change" link for Commodity row (navigates back to Commodity Quantities)
9. **Update quantities**: Enter new random integers, click "Save and Continue"
10. **Navigate back through journey**: Click "Save and Continue" on each subsequent page (Purpose → Transport) until returning to Review page
11. **Review page (second visit)**: Click "Save as draft"
12. **Review page (after draft save)**: Check checkbox, click "Submit notification"
13. **Confirmation page**: Assert success message
14. **Return to Dashboard**: Assert notification appears in the list

### Playwright Script Features

- Uses Page Object Model pattern for maintainability
- Includes explicit waits for navigation and element visibility
- Captures network requests for debugging
- Screenshots on failure for troubleshooting
- Can be run locally: `npx playwright test` for verification

## Playwright to k6 Conversion

### Conversion Process

The project will use `@k6/playwright-to-k6` to convert Playwright scripts into k6-compatible JavaScript during development.

### Workflow

1. Developer writes/updates Playwright script in `src/playwright/notification-journey.spec.js`
2. Run conversion command: `npm run generate:k6`
3. Generates `src/tests/notification-journey.js` in k6 format
4. Commit both the Playwright source and generated k6 script
5. Docker build copies `src/` directory (includes both Playwright and k6 files)
6. entrypoint.sh runs the k6 script

### Manual Adjustments to Generated k6 Script

The generated k6 script will need manual enhancements:

- Add environment variable support (`TARGET_URL`, `VUS_MAX`, etc.)
- Inject `__VU` based user email selection
- Add k6 load test options (scenarios, thresholds)
- Add custom metrics/checks for the journey steps
- These manual edits are made once, then maintained alongside Playwright changes

### Trade-off Acceptance

This isn't a fully automated pipeline - regenerating the k6 script may require re-applying manual customizations. This is acceptable because:

- Journey changes infrequently once established
- Manual control over k6 configuration is valuable
- Alternative (custom conversion) is significant engineering effort

### Future Extensibility

Pulling in Playwright scripts from other repos is straightforward:

- **Copy and adapt** (recommended): Copy test files into `src/playwright/`, run conversion
- **Git submodule/subtree**: Link to other repos for automatic sync
- **Shared npm package**: Publish common tests as internal package
- **Selective import**: Script that clones and copies specific test files

## k6 Test Implementation

### Test Options Configuration

```javascript
export let options = {
  scenarios: {
    ramp_up_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5m', target: 50 },  // Ramp up to 50 VUs over 5 min
        { duration: '10m', target: 50 }, // Hold at 50 VUs for 10 min
        { duration: '2m', target: 0 },   // Ramp down to 0
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'], // 95% under 3s, 99% under 5s
    http_req_failed: ['rate<0.01'],                   // Error rate < 1%
    checks: ['rate>0.95'],                            // 95% of checks pass
  },
};
```

Values like `target: 50`, durations, and thresholds will be parameterized via environment variables.

### Virtual User Logic

```javascript
export default function() {
  const userEmail = `k6-perf-user-${__VU}@example.com`;

  // Execute notification journey with this user
  // Converted Playwright actions go here
  // Add k6 checks at key points
}
```

### k6 Checks

Critical validation points:

- Login successful (user name visible)
- Each page transition successful (correct page title/heading)
- Draft save successful
- Submission successful (confirmation page)
- Notification appears in dashboard list

### Custom Metrics

- Journey completion time (custom trend metric)
- Failed journeys counter
- Draft save time
- Submission time

## Project Structure

```
trade-demo-perf-tests/
├── src/
│   ├── playwright/
│   │   └── notification-journey.spec.js    # Source Playwright script
│   ├── tests/
│   │   └── notification-journey.js         # Generated k6 script
│   ├── setup/
│   │   ├── create-user-pool.js             # Setup: create users
│   │   └── cleanup-user-pool.js            # Teardown: delete users
│   └── lib/
│       └── defra-id-stub-client.js         # Shared API client for stub
├── package.json                             # Node.js dependencies & scripts
├── playwright.config.js                     # Playwright configuration
├── Dockerfile                               # Already exists (k6 base)
├── entrypoint.sh                            # Updated to run setup/test/teardown
├── compose.yml                              # Already exists
└── README.md                                # Updated documentation
```

### Package.json Scripts

```json
{
  "scripts": {
    "playwright": "playwright test",
    "playwright:debug": "playwright test --debug",
    "playwright:ui": "playwright test --ui",
    "generate:k6": "playwright-to-k6 src/playwright/notification-journey.spec.js -o src/tests/notification-journey.js",
    "setup:users": "node src/setup/create-user-pool.js",
    "cleanup:users": "node src/setup/cleanup-user-pool.js",
    "k6:local": "k6 run src/tests/notification-journey.js",
    "test:full": "npm run setup:users && npm run k6:local && npm run cleanup:users"
  }
}
```

### Updated entrypoint.sh Flow

1. Run `node src/setup/create-user-pool.js` (setup phase)
2. Run k6 test: `k6 run src/tests/notification-journey.js --summary-export=summary.json`
3. Run `node src/setup/cleanup-user-pool.js` (teardown phase, even if test fails)
4. Upload HTML report and summary.json to S3
5. Exit with k6's exit code (preserve test pass/fail status)

### Local Development Workflow

- `npm run playwright` - Run/verify Playwright script locally
- `npm run generate:k6` - Convert to k6 after Playwright changes
- `npm run test:full` - Full local test run (setup → k6 → cleanup)
- `docker compose --profile performance up` - Full Docker-based test with all services

## Reporting and Metrics

### k6 Report Generation

The k6 test will generate two output files uploaded to S3:

**1. HTML Report (`index.html`):**

- Generated using k6's `handleSummary()` function or k6-reporter
- Includes visual graphs of response times, throughput, error rates
- Summary statistics (p95, p99, avg response times)
- Per-scenario breakdown
- Human-readable format for stakeholders

**2. JSON Summary (`summary.json`):**

- Exported via `--summary-export=summary.json` flag
- Machine-readable test results
- Consumed by CDP reporting framework
- Contains: metrics, thresholds status, check results, timestamps

### Metrics Tracked

**Built-in k6 metrics:**

- `http_req_duration` - HTTP request response times (p50, p95, p99)
- `http_req_failed` - Failed requests rate
- `http_reqs` - Total HTTP requests per second
- `vus` - Active virtual users over time
- `iteration_duration` - Full journey completion time

**Custom metrics:**

- `notification_journey_duration` - Time from login to submission confirmation
- `draft_save_duration` - Time to save draft
- `submission_duration` - Time from submit click to confirmation

### Thresholds (Pass/Fail Criteria)

- `http_req_duration: p(95) < 3000ms` - 95% of requests under 3 seconds
- `http_req_duration: p(99) < 5000ms` - 99% of requests under 5 seconds
- `http_req_failed: rate < 0.01` - Less than 1% error rate
- `checks: rate > 0.95` - 95% of validation checks pass

Test fails if any threshold is breached. Exit code propagates to CI/CD.

### S3 Upload

- Existing entrypoint.sh logic already handles this
- Files uploaded to `${RESULTS_OUTPUT_S3_PATH}/index.html` and `${RESULTS_OUTPUT_S3_PATH}/summary.json`
- CDP reporting framework consumes these files

## Configuration

### Environment Variables

**Test Target Configuration:**

- `TARGET_URL` - Frontend URL (default: `http://localhost:3000`)
- `DEFRA_ID_STUB_URL` - DEFRA ID stub endpoint (default: derived from TARGET_URL or `http://localhost:3200`)

**Load Test Parameters:**

- `VUS_MAX` - Maximum concurrent virtual users (default: `50`)
- `RAMP_UP_DURATION` - Time to ramp up to max VUs (default: `5m`)
- `HOLD_DURATION` - Time to hold at peak load (default: `10m`)
- `RAMP_DOWN_DURATION` - Time to ramp down (default: `2m`)

**Threshold Configuration:**

- `THRESHOLD_P95_MS` - 95th percentile response time threshold (default: `3000`)
- `THRESHOLD_P99_MS` - 99th percentile response time threshold (default: `5000`)
- `THRESHOLD_ERROR_RATE` - Maximum error rate (default: `0.01` = 1%)

**S3 and AWS (already existing):**

- `RESULTS_OUTPUT_S3_PATH` - S3 path for results
- `S3_ENDPOINT` - S3 endpoint URL
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**User Pool Configuration:**

- `USER_POOL_PREFIX` - Email prefix (default: `k6-perf-user`)
- `USER_POOL_DOMAIN` - Email domain (default: `example.com`)

**Multiple Scenario Support (future):**

- `K6_SCENARIO` - Which scenario to run (default: `ramp_up`, future: `spike`, `stress`, `smoke`)
- Scenarios defined in separate option objects within the k6 script
- Allows running different load patterns without code changes

### Configuration Loading

Both setup scripts and k6 tests will read from `process.env` (Node.js) and `__ENV` (k6), with fallback defaults in code.

## Error Handling

### Setup Phase Error Handling

The user pool creation script (`create-user-pool.js`) will handle:

- **API failures**: Retry failed user creation up to 3 times with exponential backoff
- **Partial failures**: If some users succeed but others fail, log the successful user count and fail fast
- **Stub unavailable**: Exit immediately with clear error message if stub endpoint unreachable
- **Duplicate users**: If users already exist from previous failed runs, document this scenario (may need to add timestamp to email to avoid collisions)

### k6 Test Error Handling

During load test execution:

- **Missing user**: If virtual user can't find their email in the stub's user list, fail that iteration and log the VU number
- **Authentication failures**: k6 check fails, counted toward threshold, doesn't crash the test
- **Page navigation timeouts**: Individual iteration fails, but test continues for other VUs
- **Network errors**: Retry logic for transient failures (configurable)
- **Unexpected responses**: k6 checks catch this, logged for debugging

### Teardown Phase Error Handling

The cleanup script will:

- **Continue on failure**: Log errors but don't fail the overall test if cleanup fails
- **Best effort cleanup**: Even if some user deletions fail, attempt all of them
- **Missing delete endpoint**: If stub doesn't support deletion, log warning and document manual cleanup process

### Edge Cases

- **More VUs than pool users**: Prevent by validating `VUS_MAX` matches pool size in entrypoint.sh
- **Concurrent access to same user**: Won't happen with VU-based user assignment
- **Test interrupted mid-run**: Orphaned users remain in stub; document periodic manual cleanup or add cleanup job
- **Stub reset during test**: Test fails appropriately, clear error in logs

### Logging Strategy

- Setup/teardown: Console logs with timestamps, JSON format for parsing
- k6 test: Built-in k6 logging, includes VU number and iteration for traceability
- All logs visible in Docker output and captured by CDP platform

## Testing Strategy

### Testing the Performance Tests

**Local Playwright Verification:**

1. Start trade-demo-frontend locally: `cd trade-demo-frontend && make start`
2. Run Playwright test: `npm run playwright`
3. Verify journey completes successfully with visual feedback
4. Use Playwright UI mode for debugging: `npm run playwright:ui`

**Local k6 Smoke Test:**

1. Start the environment with performance profile: `docker compose --profile performance up`
2. Wait for all services to be healthy (docker compose health checks handle this)
3. Generate k6 script: `npm run generate:k6`
4. Run with minimal load: `K6_SCENARIO=smoke VUS_MAX=1 npm run test:full`
5. Verify single user journey works end-to-end
6. Check reports generated correctly

**Docker Compose Integration Test:**

1. Build and run full stack: `docker compose up --build`
2. Verifies Docker image builds correctly
3. Tests S3 upload to LocalStack
4. Validates entrypoint.sh orchestration

### CI/CD Integration

The existing GitHub workflow (`.github/workflows/publish.yml`) already builds and publishes the Docker image on push to `main`. No changes needed - the new structure fits the existing build pipeline.

## Implementation Phases

### Phase 1 - Foundation (MVP)

- Set up project structure and dependencies
- Implement user pool setup/teardown scripts
- Write Playwright notification journey script
- Convert to k6 and add basic configuration
- Verify locally with smoke test

### Phase 2 - Reporting & Configuration

- Implement HTML report generation
- Add environment variable configuration
- Update entrypoint.sh for full orchestration
- Test Docker build and S3 upload

### Phase 3 - Additional Scenarios (future)

- Add spike test scenario
- Add stress test scenario
- Add smoke test scenario for quick validation
- Expand to additional user journeys

## Notes

- The test data is kept simple for MVP (static commodity code "0102", static selection "Bison bison")
- Additional validation checks and data variation can be added in future iterations based on testing needs
- The docker compose performance profile ensures all required services are running before tests execute
