const config = {
  low: {
    http_req_duration: ['p(90)<2500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],  // 95% of checks must pass
  },
  medium: {
    http_req_duration: ['p(90)<400', 'p(95)<800', 'p(99.9)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],  // 95% of checks must pass
  },
  high: {
    http_req_duration: ['p(90)<250', 'p(95)<500', 'p(99.9)<1500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],  // 99% of checks must pass (stricter for high profile)
  },
};

export const threshold = config[__ENV.K6_THRESHOLD] || config['low'];
