// K6 Performance Test - Trade Demo Frontend Import Notification Journey
// Created: 2026-01-21
// Purpose: End-to-end load test with live DEFRA ID authentication

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
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
const authDuration = new Trend('authorisation_duration');
const homeStepDuration = new Trend('get_home_page_step_duration');
const dashboardStepDuration = new Trend('get_dashboard_step_duration');
const originStepDuration = new Trend('get_country_of_origin_step_duration');
const originSelectionStepDuration = new Trend('post_country_of_origin_step_duration');
const commoditySelectionStepDuration = new Trend('get_commodity_selection_step_duration');
const commoditySpeciesStepDuration = new Trend('get_commodity_species_step_duration');
const commodityQuantitiesStepDuration = new Trend('get_commodity_quantities_step_duration');
const purposeStepDuration = new Trend('post_purpose_step_duration');
const transportStepDuration = new Trend('post_transport_step_duration');
const saveStepDuration = new Trend('post_save_step_duration');
const submitDuration = new Trend('post_submit_step_duration');
const failedJourneys = new Counter('failed_journey_counter');
const successfulJourneys = new Counter('successful_journey_counter');


// Page-level failure counters
const authFailures = new Counter('authorisation_failures');
const homePageFailures = new Counter('home_page_failures');
const dashboardFailures = new Counter('dashboard_page_failures');
const originPageFailures = new Counter('country_of_origin_failures');
const commodityPageFailures = new Counter('commodity_page_failures');
const purposePageFailures = new Counter('purpose_page_failures');
const transportPageFailures = new Counter('transport_page_failures');
const reviewPageFailures = new Counter('review_page_failures');
const saveFailures = new Counter('save_failures');
const submitFailures = new Counter('submit_failures');

// K6 test configuration
export const options = getK6Options();

TestingError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype = Object.create(Error.prototype);

// Helper: Authenticate user via DEFRA ID stub
function authenticateUser(userEmail) {
  const authStart = Date.now();

  console.log(`VU ${__VU}: Starting authorisation for ${userEmail}`);

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
  if (!check(response, { 'Authorisation successful': (r) => r.status === 200 && r.url === env.baseUrl + '/'})) {
    throw new AuthenticationError(`Authorisation failed - final status ${response.status}`);
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
    // Group: Authentication and Dashboard
    group('authorisation', () => {
      try {
        authenticateUser(userEmail);
        sleep(randomIntBetween(1, 2));  // Think time after login
      } catch (e) {
        authFailures.add(1);
        throw e;
      }

    });

    group('home_page', () => {
      try {
        const homeStart = Date.now();
        homePage.visit();
        homeStepDuration.add(Date.now() - homeStart);
        sleep(0.5);  // Brief pause viewing home page
      } catch (e) {
        homePageFailures.add(1);
        throw e;
      }
    })

    group('dashboard', () => {
      try {
      const dashboardStart = Date.now();
      dashboardPage.visit();
      dashboardStepDuration.add(Date.now() - dashboardStart);
      sleep(randomIntBetween(1, 3));  // User reviews dashboard
      } catch (e) {
        dashboardFailures.add(1);
        throw e;
      }
    })

    // Step 1: Country of Origin
    let crumb;
    group('country_of_origin', () => {
      try {
        const originStart = Date.now();
        crumb = originPage.visit();
        originStepDuration.add(Date.now() - originStart);

        const originSelectionStart = Date.now();
        crumb = originPage.submit(crumb, testData.countryCode);
        originSelectionStepDuration.add(Date.now() - originSelectionStart);
      } catch (e) {
        originPageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 3));  // User thinks about commodity selection
    });

    // Step 2: Commodity Selection
    group('commodity', () => {
      try {
        const commodityStart = Date.now();
        crumb = commodityPage.searchCode(crumb, testData.commodity.code);
        commoditySelectionStepDuration.add(Date.now() - commodityStart);

        const commoditySpeciesStart = Date.now();
        crumb = commodityPage.selectSpecies(crumb, testData.commodity.speciesType, testData.commodity.speciesId);
        commoditySpeciesStepDuration.add(Date.now() - commoditySpeciesStart);

        const commodityQuantitiesStart = Date.now();
        crumb = commodityPage.saveQuantities(crumb, testData.commodity.speciesId, testData.commodity.animals, testData.commodity.packs);
        commodityQuantitiesStepDuration.add(Date.now() - commodityQuantitiesStart);
      } catch (e) {
        commodityPageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 2));  // User considers purpose
    });

    // Step 3: Purpose
    group('purpose', () => {
      try {
        const purposeStart = Date.now();
        crumb = purposePage.submit(crumb, testData.purpose, testData.internalMarketPurpose);
        purposeStepDuration.add(Date.now() - purposeStart);
      } catch (e) {
        purposePageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 2));  // User reviews transport options
    });

    // Step 4: Transport
    group('transport', () => {
      try {
        const transportStart = Date.now();
        crumb = transportPage.submit(crumb, testData.transport.bcp, testData.transport.type, testData.transport.vehicleId);
        transportStepDuration.add(Date.now() - transportStart);
      } catch (e) {
        transportPageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(2, 4));  // User reviews all details before saving
    });

    // Step 5: Review and validate

    try {
      reviewPage.validate(
        testData.countryCode,
        testData.commodity.description,
        testData.purpose,
        testData.internalMarketPurpose,
        testData.transport.bcp
      );
    } catch (e) {
      reviewPageFailures.add(1);
      throw e;
    }
    group('save', () => {
      try {
        let saveStart = Date.now();
        reviewPage.saveAsDraft();
        saveStepDuration.add(Date.now() - saveStart);
      } catch (e) {
        saveFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 2));  // User decides to make changes
    });

    // Step 6: Change commodity quantities (testing the change flow)
    // Generate new quantities for the change scenario
    const newAnimals = Math.floor(testData.commodity.animals * 0.5); // Reduce by 50%
    const newPacks = Math.floor(testData.commodity.packs * 0.5);
    const testData2 = generateImportNotificationData({ useWeightedCountries: true });

    group('change_flow', () => {
      try {
        const commoditySelectionStart = Date.now();
        crumb = commodityPage.change(crumb);
        commoditySelectionStepDuration.add(Date.now() - commoditySelectionStart);
        const commodityQuantitiesStart = Date.now();
        crumb = commodityPage.saveQuantities(crumb, testData.commodity.speciesId, newAnimals, newPacks);
        commodityQuantitiesStepDuration.add(Date.now() - commodityQuantitiesStart);
      } catch (e) {
        commodityPageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 2));  // User reviews changes

      // Re-submit purpose and transport (generate new random data)

      try {
        const purposeStart = Date.now();
        crumb = purposePage.submit(crumb, testData.purpose, testData2.internalMarketPurpose);
        purposeStepDuration.add(Date.now() - purposeStart);
      } catch (e) {
        purposePageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 2));  // User reviews updated purpose

      try {
        const transportStart = Date.now();
        crumb = transportPage.submit(crumb, testData2.transport.bcp, testData2.transport.type, testData2.transport.vehicleId);
        transportStepDuration.add(Date.now() - transportStart);
      } catch (e) {
        transportPageFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(2, 4));  // User carefully reviews final details
    });

    try {
      reviewPage.validate(
        testData.countryCode,
        testData.commodity.description,
        testData.purpose,
        testData2.internalMarketPurpose,
        testData2.transport.bcp
      );
    } catch (e) {
      reviewPageFailures.add(1);
      throw e;
    }

    // Step 7: Final validation and submit
    group('save', () => {
      try {
        let saveStart = Date.now();
        reviewPage.saveAsDraft();
        saveStepDuration.add(Date.now() - saveStart);
      } catch (e) {
        saveFailures.add(1);
        throw e;
      }
      sleep(randomIntBetween(1, 3));  // User prepares to submit
    });

    group('submit', () => {
      try {
        const submitStart = Date.now();
        reviewPage.submit(crumb, true);
        submitDuration.add(Date.now() - submitStart);
      } catch (e) {
        submitFailures.add(1);
        throw e;
      }
    });

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
  testName: 'Import Notification Journey (Stub Authentication)'
});
