// Generated from Playwright script - MANUAL IMPLEMENTATION
// Original: src/playwright/notification-journey.spec.js
// Generated: 2026-01-19T09:23:21.505Z
//
// This k6 script implements the notification journey from the Playwright test.
// It uses HTTP requests to replicate the browser-based flow.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

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
      `p(95)<${__ENV.THRESHOLD_P95_MS || '3000'}`,
      `p(99)<${__ENV.THRESHOLD_P99_MS || '5000'}`
    ],
    'http_req_failed': [`rate<${__ENV.THRESHOLD_ERROR_RATE || '0.01'}`],
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
  const userEmail = `${USER_POOL_PREFIX}-${__VU}@${USER_POOL_DOMAIN}`;

  console.log(`VU ${__VU}: Starting journey with user ${userEmail}`);

  // TODO: Implement the notification journey using HTTP requests
  // This requires:
  // 1. Authentication flow (DEFRA ID stub OAuth/OIDC)
  // 2. Dashboard -> New Import (HTTP GET/POST)
  // 3. Form submissions for: Origin, Commodity, Quantities, Purpose, Transport
  // 4. Review page interactions
  // 5. Draft save and final submission
  // 6. Verification
  //
  // Note: You'll need to capture actual HTTP requests from the Playwright test
  // using browser DevTools or Playwright's network logging to implement this.

  // Placeholder: Basic smoke test
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

  // Realistic think time between iterations
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
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .summary-card { background: #f0f0f0; padding: 15px; border-radius: 5px; border-left: 4px solid #4CAF50; }
    .summary-card h3 { margin: 0 0 10px 0; color: #333; }
    .summary-card p { margin: 5px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>K6 Performance Test Report</h1>
    <p><strong>Generated:</strong> ${date}</p>
    <p><strong>Test:</strong> Notification Journey</p>

    <div class="summary">
      <div class="summary-card">
        <h3>Test Duration</h3>
        <p>${data.state?.testRunDurationMs ? (data.state.testRunDurationMs / 1000).toFixed(2) + 's' : 'N/A'}</p>
      </div>
      <div class="summary-card">
        <h3>Virtual Users</h3>
        <p>Max: ${metrics.vus?.values?.max || 'N/A'}</p>
      </div>
      <div class="summary-card">
        <h3>Requests</h3>
        <p>Total: ${metrics.http_reqs?.values?.count || 'N/A'}</p>
        <p>Rate: ${metrics.http_reqs?.values?.rate ? metrics.http_reqs.values.rate.toFixed(2) + ' req/s' : 'N/A'}</p>
      </div>
    </div>

    <h2>Metrics</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
      ${Object.entries(metrics).map(([name, metric]) => {
        const values = metric.values || {};
        const displayValue = values.avg !== undefined
          ? `Avg: ${values.avg.toFixed(2)}ms, P95: ${values['p(95)']?.toFixed(2) || 'N/A'}ms, P99: ${values['p(99)']?.toFixed(2) || 'N/A'}ms`
          : JSON.stringify(values);
        return `
      <tr>
        <td>${name}</td>
        <td>${displayValue}</td>
      </tr>
        `;
      }).join('')}
    </table>

    <h2>Thresholds</h2>
    <table>
      <tr>
        <th>Threshold</th>
        <th>Status</th>
      </tr>
      ${Object.entries(data.metrics).map(([name, metric]) => {
        if (!metric.thresholds) return '';
        return Object.entries(metric.thresholds).map(([threshold, result]) => `
      <tr>
        <td>${name}: ${threshold}</td>
        <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'PASS' : 'FAIL'}</td>
      </tr>
        `).join('');
      }).join('')}
    </table>
  </div>
</body>
</html>
`;
}
