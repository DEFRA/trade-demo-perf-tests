const config = {
  // 12 iterations of the user journey over 10 mins (average volume of traffic)
  load: {
    executor: 'constant-arrival-rate',
    duration: '10m',
    preAllocatedVUs: 1,
    rate: 12,
    timeUnit: '10m',
  },
  // ramp up to 50 users over 1 minute.  Constant 50 users for 15 minutes and a ramp down to 0 for the last minute.
  stress: {
    executor: 'ramping-vus',
    stages: [
      {duration: '1m', target: 200},
      {duration: '30m', target: 200},
      {duration: '1m', target: 0},
    ],
    gracefulRampDown: '30s',
  },
  // Ramp up to 50 virtual users in 1 min with each virtual user completing as many iterations of the user journey as possible
  spike: {
    executor: 'ramping-vus',
    stages: [
      {duration: '30s', target: 200},
      {duration: '1m', target: 200},
      {duration: '30s', target: 0},
    ],
  },
  // 1 iteration of the user journey for validation purposes
  smoke: {
    executor: 'per-vu-iterations',
    vus: 1,
    iterations: 5,
  },
};

export const workload = config[__ENV.K6_WORKLOAD] || config['smoke'];
