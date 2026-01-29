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
import { createHandleSummary } from '../utils/report-generator.js';

// Custom metrics
const journeyDuration = new Trend('notification_journey_duration');
const authDuration = new Trend('auth_duration');
const originStepDuration = new Trend('origin_step_duration');
const commodityStepDuration = new Trend('commodity_step_duration');
const purposeStepDuration = new Trend('purpose_step_duration');
const transportStepDuration = new Trend('transport_step_duration');
const saveStepDuration = new Trend('save_step_duration');
const submitDuration = new Trend('submit_duration');
const failedJourneys = new Counter('failed_journeys');
const successfulJourneys = new Counter('successful_journey_counter');
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
    const purposeStart = Date.now();
    crumb = purposePage.submit(crumb, testData.purpose, testData.internalMarketPurpose);
    purposeStepDuration.add(Date.now() - purposeStart)

    // Step 4: Transport
    const TransportStart = Date.now();
    crumb = transportPage.submit(crumb, testData.transport.bcp, testData.transport.type, testData.transport.vehicleId);
    transportStepDuration.add(Date.now() - TransportStart);

    // Step 5: Review and validate
    reviewPage.validate(
      testData.countryCode,
      testData.commodity.description,
      testData.purpose,
      testData.internalMarketPurpose,
      testData.transport.bcp
    );

    let saveStart = Date.now();
    reviewPage.saveAsDraft();
    saveStepDuration.add(Date.now() - saveStart);

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

    saveStart = Date.now();
    reviewPage.saveAsDraft();
    saveStepDuration.add(Date.now() - saveStart);

    const submitStart = Date.now();
    reviewPage.submit(crumb, true);
    submitDuration.add(Date.now() - submitStart);

    successfulJourneys.add(1);
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

// HTML report generation using reusable report generator
export const handleSummary = createHandleSummary({
  title: 'Trade Demo Frontend - K6 Performance Test Report',
  testName: 'Import Notification Journey (Live Authentication)',
  journeyMetrics: [
    'notification_journey_duration',
    'auth_duration',
    'origin_step_duration',
    'commodity_step_duration',
    'purpose_step_duration',
    'transport_step_duration',
    'save_step_duration',
    'submit_duration'
  ]
});
