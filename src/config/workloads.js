const config = {
  // 12 iterations of the user journey over 15 mins (average volume of traffic)
  load: {
    executor: 'constant-arrival-rate',
    duration: '15m',
    preAllocatedVUs: 1,
    rate: 12,
    timeUnit: '15m',
  },
  // 2160 iterations of the user journey over 15 mins (180x average volume of traffic)
  stress: {
    executor: 'constant-arrival-rate',
    duration: '15m',
    preAllocatedVUs: 300,
    rate: 2160,
    timeUnit: '15m',
  },
  // Ramp up to 50 virtual users in 1 min with each virtual user completing as many iterations of the user journey as possible
  spike: {
    executor: 'ramping-vus',
    stages: [
      {duration: '1m', target: 50},
      {duration: '30s', target: 0},
    ],
  },
  // 1 iteration of the user journey for validation purposes
  smoke: {
    executor: 'per-vu-iterations',
    vus: 1,
    iterations: 1,
  },
};

export const workload = config[__ENV.K6_WORKLOAD] || config['smoke'];
