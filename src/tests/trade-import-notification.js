// K6 Performance Test - Trade Demo Frontend Import Notification Journey
// Created: 2026-01-21
// Purpose: End-to-end load test with live DEFRA ID authentication

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { TestingError, AuthenticationError } from './exceptions.js';
import { env, getK6Options, getUserEmail } from '../config/test-config.js';
import { HomePage } from '../pages/home-page.js';
import { DashboardPage } from '../pages/dashboard-page.js';
import { OriginPage } from '../pages/origin-page.js';
import { CommodityPage } from '../pages/commodity-page.js';
import { PurposePage } from '../pages/purpose-page.js';
import { TransportPage } from '../pages/transport-page.js';
import { ReviewPage } from '../pages/review-page.js';
import { generateImportNotificationData } from '../data/test-data.js';

// Custom metrics
const journeyDuration = new Trend('notification_journey_duration');
const authDuration = new Trend('auth_duration');
const originStepDuration = new Trend('origin_step_duration');
const commodityStepDuration = new Trend('commodity_step_duration');
const submitDuration = new Trend('submit_duration');
const failedJourneys = new Counter('failed_journeys');
const authFailures = new Counter('auth_failures');

// K6 test configuration
export const options = getK6Options();

TestingError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype = Object.create(Error.prototype);

// Helper: Authenticate user via DEFRA ID stub
function authenticateUser(userEmail) {
  const authStart = Date.now();

  console.log(`VU ${__VU}: Starting authentication for ${userEmail}`);

  // Step 1: Navigate to login endpoint - this triggers OAuth flow
  let response = http.get(`${env.baseUrl}/auth/login`, {
    tags: { name: 'Login - Initial' }
  });

  if (response.status !== 200) {
    console.error(`VU ${__VU}: Expected 200 from authorize endpoint, got ${response.status}`);
    throw new AuthenticationError(`Expected 200 from authorize endpoint, got ${response.status}`);
  }

  // Step 2: Parse HTML to find the URL for our specific user email
  // The stub shows links like: <a href="/cdp-defra-id-stub/authorize?...&user=k6-perf-user-1@example.com">
  const emailLinkRegex = new RegExp(`href="([^"]*[?&]user=${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*)"`, 'i');
  const match = response.body.match(emailLinkRegex);

  if (!match || !match[1]) {
    throw new AuthenticationError(`Could not find login link for ${userEmail} in stub response`);
  }

  let loginPath = match[1];
  // Handle relative URLs
  if (!loginPath.startsWith('http')) {
    loginPath = `${env.defraIdStubUrl}${loginPath.startsWith('/') ? loginPath : '/' + loginPath}`;
  }

  // Step 3: Click the user's login link
  response = http.get(loginPath, {
    tags: { name: 'DEFRA ID - User Login' }
  });

  console.log(`VU ${__VU}: Following callback redirect...`);

  // The final response should be 200 and show authenticated content
  if (!check(response, { 'authentication successful': (r) => r.status === 200 && r.url === env.baseUrl + '/'})) {
    throw new AuthenticationError(`Authentication failed - final status ${response.status}`);
  }

  authDuration.add(Date.now() - authStart);
  console.log(`VU ${__VU}: Authentication successful (${Date.now() - authStart}ms)`);
}

////////////////////////////////////////////////////////////
/////////////////// The main test function /////////////////
////////////////////////////////////////////////////////////
// Main test scenario
export default function () {
  const journeyStart = Date.now();

  // Initialize page objects
  const homePage = new HomePage(env.baseUrl);
  const dashboardPage = new DashboardPage(env.baseUrl);
  const originPage = new OriginPage(env.baseUrl);
  const commodityPage = new CommodityPage(env.baseUrl);
  const purposePage = new PurposePage(env.baseUrl);
  const transportPage = new TransportPage(env.baseUrl);
  const reviewPage = new ReviewPage(env.baseUrl);

  // Generate randomized test data for this journey
  const testData = generateImportNotificationData({ useWeightedCountries: true });

  // Determine user email for this VU
  const userEmail = getUserEmail(__VU);
  console.log(`\n=== VU ${__VU}: Starting journey for ${userEmail} ===`);
  console.log(`Test Data: ${testData.countryCode} -> ${testData.commodity.description}`);

  try {
    authenticateUser(userEmail);

    homePage.visit();
    dashboardPage.visit();

    // Step 1: Country of Origin
    const originStart = Date.now();
    let crumb = originPage.visit();
    crumb = originPage.submit(crumb, testData.countryCode);
    originStepDuration.add(Date.now() - originStart);

    // Step 2: Commodity Selection
    const commodityStart = Date.now();
    crumb = commodityPage.searchCode(crumb, testData.commodity.code);
    crumb = commodityPage.selectSpecies(crumb, testData.commodity.speciesType, testData.commodity.speciesId);
    crumb = commodityPage.saveQuantities(crumb, testData.commodity.speciesId, testData.commodity.animals, testData.commodity.packs);
    commodityStepDuration.add(Date.now() - commodityStart);

    // Step 3: Purpose
    crumb = purposePage.submit(crumb, testData.purpose, testData.internalMarketPurpose);

    // Step 4: Transport
    crumb = transportPage.submit(crumb, testData.transport.bcp, testData.transport.type, testData.transport.vehicleId);

    // Step 5: Review and validate
    reviewPage.validate(
      testData.countryCode,
      testData.commodity.description,
      testData.purpose,
      testData.internalMarketPurpose,
      testData.transport.bcp
    );

    // Step 6: Change commodity quantities (testing the change flow)
    // Generate new quantities for the change scenario
    const newAnimals = Math.floor(testData.commodity.animals * 0.5); // Reduce by 50%
    const newPacks = Math.floor(testData.commodity.packs * 0.5);

    crumb = commodityPage.change(crumb);
    crumb = commodityPage.saveQuantities(crumb, testData.commodity.speciesId, newAnimals, newPacks);

    // Re-submit purpose and transport (generate new random data)
    const testData2 = generateImportNotificationData({ useWeightedCountries: true });
    crumb = purposePage.submit(crumb, testData.purpose, testData2.internalMarketPurpose);
    crumb = transportPage.submit(crumb, testData2.transport.bcp, testData2.transport.type, testData2.transport.vehicleId);

    // Step 7: Final validation and submit
    reviewPage.validate(
      testData.countryCode,
      testData.commodity.description,
      testData.purpose,
      testData2.internalMarketPurpose,
      testData2.transport.bcp
    );

    const submitStart = Date.now();
    reviewPage.submit(crumb, true);
    submitDuration.add(Date.now() - submitStart);

  } catch (e) {
    if (e instanceof TestingError) {
      console.log('name:', e.name);
      console.log('message:', e.message);
      console.log('stack:', e.stack);
      console.error(`VU ${__VU}: ${e.message}`);
      failedJourneys.add(1);
    } else if (e instanceof AuthenticationError) {
      console.error(`VU ${__VU}: ${e.message}`);
      authFailures.add(1);
    } else {
      throw e;
    }
  }

  const journeyTime = Date.now() - journeyStart;
  journeyDuration.add(journeyTime);

  console.log(`VU ${__VU}: Journey completed successfully in ${journeyTime}ms`);
}

// Custom HTML report generator
export function handleSummary(data) {
  return {
    'index.html': htmlReport(data),
    'summary.json': JSON.stringify(data),
  };
}

function htmlReport(data) {
  const date = new Date().toISOString();
  const metrics = data.metrics;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Trade Demo Frontend - K6 Performance Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #005ea5; border-bottom: 3px solid #005ea5; padding-bottom: 15px; }
    h2 { color: #333; margin-top: 40px; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 30px 0; }
    .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; opacity: 0.9; }
    .summary-card p { margin: 0; font-size: 28px; font-weight: bold; }
    .summary-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .summary-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #dee2e6; padding: 12px; text-align: left; }
    th { background-color: #005ea5; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f8f9fa; }
    .pass { color: #28a745; font-weight: bold; }
    .fail { color: #dc3545; font-weight: bold; }
    .metric-value { font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Trade Demo Frontend - Performance Test Report</h1>
    <p><strong>Test:</strong> Import Notification Journey (Live Authentication)</p>
    <p><strong>Generated:</strong> ${date}</p>
    <p><strong>Duration:</strong> ${data.state?.testRunDurationMs ? (data.state.testRunDurationMs / 1000).toFixed(2) + 's' : 'N/A'}</p>

    <div class="summary">
      <div class="summary-card">
        <h3>Virtual Users (Max)</h3>
        <p>${metrics.vus?.values?.max || 'N/A'}</p>
      </div>
      <div class="summary-card success">
        <h3>Total Requests</h3>
        <p>${metrics.http_reqs?.values?.count || 'N/A'}</p>
      </div>
      <div class="summary-card">
        <h3>Request Rate</h3>
        <p>${metrics.http_reqs?.values?.rate ? metrics.http_reqs.values.rate.toFixed(2) + ' req/s' : 'N/A'}</p>
      </div>
      <div class="summary-card ${(metrics.http_req_failed?.values?.rate || 0) < 0.01 ? 'success' : 'warning'}">
        <h3>Error Rate</h3>
        <p>${metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(2) + '%' : 'N/A'}</p>
      </div>
    </div>

    <h2>Journey Metrics</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Average</th>
        <th>P95</th>
        <th>P99</th>
        <th>Max</th>
      </tr>
      ${['notification_journey_duration', 'auth_duration', 'origin_step_duration', 'commodity_step_duration', 'submit_duration', 'http_req_duration']
        .filter(name => metrics[name])
        .map(name => {
          const m = metrics[name].values;
          return `
      <tr>
        <td>${name.replace(/_/g, ' ')}</td>
        <td class="metric-value">${m.avg?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m['p(95)']?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m['p(99)']?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m.max?.toFixed(2) || 'N/A'} ms</td>
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
      ${Object.entries(data.metrics)
        .filter(([_, metric]) => metric.thresholds)
        .map(([name, metric]) => {
          return Object.entries(metric.thresholds).map(([threshold, result]) => `
      <tr>
        <td>${name}: ${threshold}</td>
        <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? '✓ PASS' : '✗ FAIL'}</td>
      </tr>
          `).join('');
        }).join('')}
    </table>

    <h2>All Metrics</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Count</th>
        <th>Rate</th>
      </tr>
      ${Object.entries(metrics)
        .filter(([name, _]) => name.includes('counter') || name.includes('failures') || name.includes('failed'))
        .map(([name, metric]) => {
          const values = metric.values || {};
          return `
      <tr>
        <td>${name}</td>
        <td class="metric-value">${values.count !== undefined ? values.count : 'N/A'}</td>
        <td class="metric-value">${values.rate !== undefined ? values.rate.toFixed(4) : 'N/A'}</td>
      </tr>
          `;
        }).join('')}
    </table>
  </div>
</body>
</html>
`;
}
