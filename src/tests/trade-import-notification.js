// K6 Performance Test - Trade Demo Frontend Import Notification Journey
// Created: 2026-01-21
// Purpose: End-to-end load test with live DEFRA ID authentication

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const journeyDuration = new Trend('notification_journey_duration');
const authDuration = new Trend('auth_duration');
const originStepDuration = new Trend('origin_step_duration');
const commodityStepDuration = new Trend('commodity_step_duration');
const submitDuration = new Trend('submit_duration');
const failedJourneys = new Counter('failed_journeys');
const authFailures = new Counter('auth_failures');

// Environment configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const DEFRA_ID_STUB_URL = __ENV.DEFRA_ID_STUB_URL || 'http://localhost:3200';
const USER_POOL_PREFIX = __ENV.USER_POOL_PREFIX || 'k6-perf-user';
const USER_POOL_DOMAIN = __ENV.USER_POOL_DOMAIN || 'example.com';

// K6 test configuration
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
    'auth_failures': ['count<5'],
    'failed_journeys': [`count<${parseInt(__ENV.VUS_MAX || '50') * 0.05}`], // Max 5% failed journeys
  },
};

// Helper: Create a testing flow error
function TestingError(message) {
  this.name = 'TestingError';
  this.message = message || '';
  var error = new Error(this.message);
  error.name = this.name;
  this.stack = error.stack;
}
// Helper: create an authentication error
function AuthenticationError(message) {
  this.name = 'TestingError';
  this.message = message || '';
  var error = new Error(this.message);
  error.name = this.name;
  this.stack = error.stack;
}

TestingError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype = Object.create(Error.prototype);

const countryCodes = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'US', 'CS', 'AU', 'NZ', 'NO', 'CH', 'IS', 'JP', 'CN', 'IN', 'BR', 'AR', 'ZA'];
const internalMarketPurposes =['Commercial Sale','Rescue','Breeding','Research','Racing or Competition','Companion Animal not for Resale or Rehoming','Production','Slaughter','Fattening','Game Restocking'];

// Helper: Extract the crumb from the form body
function extractCrumbFromBody(body) {
  let crumbElement = body.match(/<input[^>]*name=["']crumb["'][^>]*>/i);
  if (!crumbElement) {
    console.warn('✗ Could not find <input name="crumb"> in HTML');
    return null;
  }
  let crumb = crumbElement[0].match(/value=["']([^"']*)["']/i);
  if (!crumb || !crumb[1]) {
    console.warn('✗ Found crumb input but no value attribute');
    return null;
  }
  return crumb[1];
}

// Helper: Authenticate user via DEFRA ID stub
function authenticateUser(userEmail) {
  const authStart = Date.now();

  console.log(`VU ${__VU}: Starting authentication for ${userEmail}`);

  // Step 1: Navigate to login endpoint - this triggers OAuth flow
  let response = http.get(`${BASE_URL}/auth/login`, {
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
    loginPath = `${DEFRA_ID_STUB_URL}${loginPath.startsWith('/') ? loginPath : '/' + loginPath}`;
  }

  // Step 3: Click the user's login link
  response = http.get(loginPath, {
    tags: { name: 'DEFRA ID - User Login' }
  });

  console.log(`VU ${__VU}: Following callback redirect...`);

  // The final response should be 200 and show authenticated content
  if (!check(response, { 'authentication successful': (r) => r.status === 200 && r.url === BASE_URL + '/'})) {
    throw new AuthenticationError(`Authentication failed - final status ${response.status}`);
  }

  authDuration.add(Date.now() - authStart);
  console.log(`VU ${__VU}: Authentication successful (${Date.now() - authStart}ms)`);

}

// Step 1: Navigate to home page
function getHomePage() {
  let response = http.get(BASE_URL, {});

  if (!check(response, { 'home page loaded': (r) => r.status === 200 && r.url === BASE_URL})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Loading the Home Page failed');
  }
}

// Step 2: Navigate to dashboard
function getDashboard() {
  let response = http.get(`${BASE_URL}/dashboard`, {});

  if (!check(response, { 'dashboard loaded': (r) => r.status === 200 && r.url.endsWith('/dashboard')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Loading the Home Page failed');
  }
}

// Step 3: Navigate to origin page
function getCountryOfOrigin() {
  console.log('==== Navigating to Country of Origin page...');

  let response = http.get(`${BASE_URL}/import/consignment/origin`, {});

  if (!check(response, { 'Country of Origin loaded': (r) => r.status === 200 && r.url.endsWith('/import/consignment/origin')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Loading the Country of Origin failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Step 4: Submit origin
function submitCountryOfOrigin(crumb, country) {
  console.log('==== Posting Country of Origin page...');
  const formData = {
    'crumb': crumb,
    'origin-country': country
  }
  let response = http.post(`${BASE_URL}/import/consignment/origin`, formData, {});

  if (!check(response, { 'origin submitted': (r) => r.status === 200 && r.url.endsWith('/import/commodity/codes')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Origin submission failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Step 5: Search for commodity code
function submitCommodityCode(crumb, commodityCode) {
  console.log('==== Selecting Commodity Codes...');
  let response = http.get(`${BASE_URL}/import/commodity/codes/search?crumb=${encodeURIComponent(crumb)}&commodity-code=${commodityCode}`, {
  });

  if (!check(response, { 'Commodity Codes Searched': (r) =>
      r.status === 200 && r.url === `${BASE_URL}/import/commodity/codes/search?crumb=${encodeURIComponent(crumb)}&commodity-code=${commodityCode}`})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('CommodityCode search failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Step 6: Select commodity species
function submitCommodityCodeSpecies(crumb, commodityType, speciesId) {
  console.log('==== Selecting Commodity Species...');
  const response = http.get(`${BASE_URL}/import/commodity/codes/select?crumb=${encodeURIComponent(crumb)}&commodityType=${commodityType}&species=${speciesId}`, {});

  if (!check(response, { 'Commodity Species Selected': (r) =>
      r.status === 200 && r.url.endsWith('/import/commodity/codes/quantities') })) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Commodity Species Selection failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Step 7: Save commodity quantities
function submitCommodityQuantities(crumb, commodityCode, speciesId, noOfAnimals, noOfPacks) {
  console.log('==== Selecting Commodity Quantities...');
  const response = http.get(`${BASE_URL}/import/commodity/codes/quantities/save?crumb=${encodeURIComponent(crumb)}&${speciesId}-noOfAnimals=${noOfAnimals}&${speciesId}-noOfPacks=${noOfPacks}`, {
  });

  if (!check(response, { 'Commodity Quantities Saved': (r) =>
      r.status === 200 && r.url.endsWith('/import/consignment/purpose')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    console.error(`VU ${__VU}: Saving the Commodity Quantities failed`);
    failedJourneys.add(1);
    throw new TestingError('Saving the Commodity Quantities failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Step 8: Submit purpose
function submitPurpose(crumb, purpose, internalMarketPurpose) {
  console.log('==== Posting Purpose page...');
  const purposeData = {
    crumb: encodeURIComponent(crumb),
    purpose: purpose,
    'internal-market-purpose': internalMarketPurpose
  }
  let response = http.post(`${BASE_URL}/import/consignment/purpose`, purposeData, {});

  if (!check(response, { 'Purpose submitted': (r) =>
      r.status === 200 && r.url.endsWith('/import/transport')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Saving the purpose failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Step 9: Submit transport means
function submitTransport(crumb, bcp, transportMeansBefore, vehicleId) {
  console.log('==== Posting Means of Transport page...');
  const transportData = {
    crumb: encodeURIComponent(crumb),
    bcp: bcp,
    'transport-means-before': transportMeansBefore,
    'vehicle-identifier': vehicleId
  }
  let response = http.post(`${BASE_URL}/import/transport`, transportData, {});

  if (!check(response, { 'Commodity Codes Saved': (r) => r.status === 200 && r.url.endsWith('/import/review')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Saving the Means of Transport failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }
  return newCrumb;
}

// Step 10: Submit notification
function submitNotification(crumb, confirmation) {
  console.log('==== Submitting Notification...');
  const submitData = {
    crumb: encodeURIComponent(crumb),
    confirmAccurate: confirmation
  }
  let response = http.post(`${BASE_URL}/import/review`, submitData, {});

  if (!check(response, { 'Notification Submitted': (r) => r.status === 200 && r.url.endsWith('/import/confirmation')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Submitting the Notification failed');
  }

  if (!check(response, {
    'confirmation received': (r) => r.status === 200 && (r.body.includes('Import notification submitted'))
  })) {
    throw new TestingError('Confirmation page content not found.');
  }
}

function changeCommodityCodes(crumb) {
  console.log('==== Changing Commodity Quantities...');
  const response = http.get(`${BASE_URL}/import/commodity/codes?crumb=${encodeURIComponent(crumb)}`, {});
  if (!check(response, { 'Commodity Codes Changed': (r) => r.status === 200 && r.url.endsWith('/import/commodity/codes/quantities')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Changing the Commodity Codes failed');
  }
  const newCrumb = extractCrumbFromBody(response.body);
  if (!newCrumb) {
    throw new TestingError('Crumb not found in response body.');
  }

  return newCrumb;
}

// Validate review page content
function validateReviewPage(expectedCountry, expectedCommodity, expectedReason, expectedPurpose, bcp) {
  console.log('==== Validating Review page...');

  const response = http.get(`${BASE_URL}/import/review`, {});

  if (!check(response, { 'Review page loaded': (r) => r.status === 200 && r.url.endsWith('/import/review')})) {
    console.log(`Response status: ${response.status}`);
    console.log(`Response URL: ${response.url}`);
    throw new TestingError('Loading the Review page failed');
  }

  const body = response.body;
  const validations = [];

  // Validate Country of Origin
  if (body.includes(expectedCountry)) {
    console.log(`✓ Country of Origin validated: ${expectedCountry}`);
  } else {
    validations.push(`Country of Origin: expected ${expectedCountry} not found`);
  }

  // Validate Commodity
  if (body.includes(expectedCommodity)) {
    console.log(`✓ Commodity validated: ${expectedCommodity}`);
  } else {
    validations.push(`Commodity: expected '${expectedCommodity}' not found`);
  }

  // Validate Main reason for import
  if (body.includes(expectedReason)) {
    console.log(`✓ Main reason for import validated: ${expectedReason}`);
  } else {
    validations.push(`Main reason for import: expected ${expectedReason} not found`);
  }

  // Validate Internal market purpose
  if (body.includes(expectedPurpose)) {
    console.log(`✓ Internal market purpose validated: ${expectedPurpose}`);
  } else {
    validations.push(`Internal market purpose: expected ${expectedPurpose} not found`);
  }

  // Validate Transport BCP or PoE (vehicle identifier)
  if (body.includes(bcp)) {
    console.log(`✓ BCP validated: ${bcp}`);
  } else {
    validations.push(`BCP: expected ${bcp} not found`);
  }

  // If any validations failed, throw error
  if (validations.length > 0) {
    console.error('Review page validation failed:');
    validations.forEach(v => console.error(`  ✗ ${v}`));
    throw new TestingError(`Review page validation failed: ${validations.join('; ')}`);
  }

  console.log('✓ All review page validations passed');
}


//Helper function: get a random String
function getRandomString() {
  return Math.random().toString(36).substring(2, 12).toUpperCase();
}

////////////////////////////////////////////////////////////
/////////////////// The main test function /////////////////
////////////////////////////////////////////////////////////
// Main test scenario
export default function () {
  const journeyStart = Date.now();

  // Determine user email for this VU
  const userEmail = `${USER_POOL_PREFIX}-${__VU}@${USER_POOL_DOMAIN}`;
  console.log(`\n=== VU ${__VU}: Starting journey for ${userEmail} ===`);

  try {
    authenticateUser(userEmail);

    getHomePage();

    getDashboard();

    const originStart = Date.now();
    let crumb = getCountryOfOrigin()
    const countryCode = countryCodes[Math.floor(Math.random() * countryCodes.length)]
    crumb = submitCountryOfOrigin(crumb, countryCode);
    originStepDuration.add(Date.now() - originStart);

    const commodityStart = Date.now();
    const commodityCode = '0102';
    crumb = submitCommodityCode(crumb, commodityCode);
    const speciesId = '716661';
    crumb = submitCommodityCodeSpecies(crumb, "Domestic", speciesId);

    const noOfAnimals = Math.floor(Math.random() * 500) + 1;
    const noOfPacks = Math.floor(Math.random() * 50) + 1;
    crumb = submitCommodityQuantities(crumb, commodityCode, speciesId, noOfAnimals, noOfPacks);
    commodityStepDuration.add(Date.now() - commodityStart);

    let purpose = internalMarketPurposes[Math.floor(Math.random() * internalMarketPurposes.length)]
    crumb = submitPurpose(crumb, 'internalmarket', purpose);

    let vehicleId = getRandomString();
    crumb = submitTransport(crumb, 'Dover', 'Road', vehicleId);

    // validate review page
    validateReviewPage(countryCode, '0102 - Live bovine animals', 'internalmarket', purpose, 'Dover');

    // Hit the Change link for the commodity
    crumb = changeCommodityCodes(crumb);
    crumb = submitCommodityQuantities(crumb, commodityCode, speciesId, 1, 12);
    purpose = internalMarketPurposes[Math.floor(Math.random() * internalMarketPurposes.length)]
    crumb = submitPurpose(crumb, 'internalmarket', purpose);
    vehicleId = getRandomString();
    crumb = submitTransport(crumb, 'Dover', 'Road', vehicleId);

    // validate review page
    validateReviewPage(countryCode, '0102 - Live bovine animals', 'internalmarket', purpose, 'Dover');

    // submit notification
    const submitStart = Date.now();
    submitNotification(crumb, true);
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
