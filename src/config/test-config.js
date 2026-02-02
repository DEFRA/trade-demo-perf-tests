// K6 Performance Test Configuration
// Centralizes all environment-based configuration for trade-demo-perf-tests

import { workload } from './workloads.js';
import { threshold } from './thresholds.js';

/**
 * Environment Configuration
 * These values can be overridden via environment variables
 */
export const env = {
  // Target application URLs
  baseUrl: __ENV.TARGET_URL || 'http://localhost:3000',
  defraIdStubUrl: __ENV.DEFRA_ID_STUB_URL || 'http://localhost:3200',

  // User pool configuration for authentication
  userPool: {
    prefix: __ENV.USER_POOL_PREFIX || 'k6-perf-user',
    domain: __ENV.USER_POOL_DOMAIN || 'example.com',
  },

  // Test profile selection
  profile: {
    workload: __ENV.K6_WORKLOAD || 'smoke',      // smoke, load, stress, spike
    threshold: __ENV.K6_THRESHOLD || 'low',      // low, medium, high
  },
};

/**
 * Get VUS_MAX from environment or workload profile
 * Priority: VUS_MAX env var > workload profile preAllocatedVUs
 */
function getVusMax() {
  if (__ENV.VUS_MAX) {
    return parseInt(__ENV.VUS_MAX);
  }

  // Extract VUs from workload profile
  if (workload.preAllocatedVUs) {
    return workload.preAllocatedVUs;
  }

  if (workload.vus) {
    return workload.vus;
  }

  // For ramping-vus executor, find max target from stages
  if (workload.stages) {
    return Math.max(...workload.stages.map(stage => stage.target));
  }

  return 50; // Default fallback
}

/**
 * K6 Test Options
 * Generates K6 options object based on profile or environment configuration
 *
 * Priority (highest to lowest):
 * 1. Explicit environment variables (VUS_MAX, RAMP_UP_DURATION, etc.)
 * 2. K6_WORKLOAD profile (smoke, load, stress, spike)
 * 3. Default ramping-vus configuration
 */
export function getK6Options() {
  const vusMax = getVusMax();

  // Determine which scenario configuration to use
  let scenarios;

  if (__ENV.VUS_MAX || __ENV.RAMP_UP_DURATION || __ENV.HOLD_DURATION || __ENV.RAMP_DOWN_DURATION) {
    // Manual override mode: use environment variables
    console.log('Using manual configuration from environment variables');
    scenarios = {
      ramp_up_load: {
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
          { duration: __ENV.RAMP_UP_DURATION || '5m', target: vusMax },
          { duration: __ENV.HOLD_DURATION || '10m', target: vusMax },
          { duration: __ENV.RAMP_DOWN_DURATION || '2m', target: 0 },
        ],
      },
    };
  } else {
    // Profile mode: use workload profile
    console.log(`Using K6_WORKLOAD profile: ${env.profile.workload}`);
    scenarios = {
      [env.profile.workload]: workload
    };
  }

  // Determine thresholds
  let thresholds;

  if (__ENV.THRESHOLD_P95_MS || __ENV.THRESHOLD_P99_MS || __ENV.THRESHOLD_ERROR_RATE) {
    // Manual threshold override
    console.log('Using manual thresholds from environment variables');
    thresholds = {
      'http_req_duration': [
        `p(95)<${__ENV.THRESHOLD_P95_MS || '3000'}`,
        `p(99)<${__ENV.THRESHOLD_P99_MS || '5000'}`
      ],
      'http_req_failed': [`rate<${__ENV.THRESHOLD_ERROR_RATE || '0.01'}`],
      'checks': ['rate>0.95'],
      'authorisation_failures': ['count<5'],
      'failed_journey_counter': [`count<${vusMax * 0.05}`], // Max 5% failed journeys
    };
  } else {
    // Profile mode: use threshold profile
    console.log(`Using K6_THRESHOLD profile: ${env.profile.threshold}`);
    thresholds = {
      ...threshold,
      'checks': ['rate>0.95'],
      'authorisation_failures': ['count<5'],
      'failed_journey_counter': [`count<${vusMax * 0.05}`],

      // Per-endpoint thresholds using tags
      'http_req_duration{name:GetHomePage}': ['p(95)<200'],
      'http_req_duration{name:getDashboardPage}': ['p(95)<400'],
      'http_req_duration{name:GetOriginPage}': ['p(95)<400'],
      'http_req_duration{name:SubmitOriginPage}': ['p(95)<600'],
      'http_req_duration{name:CommodityCodeSelection}': ['p(95)<600'],
      'http_req_duration{name:SelectCommoditySpecies}': ['p(95)<600'],
      'http_req_duration{name:SaveCommodityQuantities}': ['p(95)<600'],
      'http_req_duration{name:SubmitPurpose}': ['p(95)<600'],
      'http_req_duration{name:SubmitTransportPage}': ['p(95)<600'],
      'http_req_duration{name:GetReviewPage}': ['p(95)<500'],
      'http_req_duration{name:SaveDraft}': ['p(95)<800'],
      'http_req_duration{name:SubmitNotification}': ['p(95)<1000'],
    };
  }

  return {
    scenarios,
    thresholds,
  };
}

/**
 * User Email Generator
 * Generates unique email addresses for each virtual user
 */
export function getUserEmail(virtualUserId) {
  return `${env.userPool.prefix}-${virtualUserId}@${env.userPool.domain}`;
}
