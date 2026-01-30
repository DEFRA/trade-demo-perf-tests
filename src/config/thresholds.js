const config = {
  low: {
    http_req_duration: [
      'p(90)<2500',
      { threshold: 'p(95)<5000', abortOnFail: true }  // Abort if extreme latency
    ],
    http_req_failed: [
      'rate<0.01',
      { threshold: 'rate<0.10', abortOnFail: true }  // Abort if >10% errors
    ],
    checks: ['rate>0.95'],  // 95% of checks must pass
  },
  medium: {
    http_req_duration: [
      'p(90)<400',
      'p(95)<800',
      'p(99.9)<2000',
      { threshold: 'p(95)<3000', abortOnFail: true }  // Abort if extreme latency
    ],
    http_req_failed: [
      'rate<0.01',
      { threshold: 'rate<0.10', abortOnFail: true }  // Abort if >10% errors
    ],
    checks: ['rate>0.95'],  // 95% of checks must pass
  },
  high: {
    http_req_duration: [
      'p(90)<250',
      'p(95)<500',
      'p(99.9)<1500',
      { threshold: 'p(95)<2000', abortOnFail: true }  // Abort if extreme latency
    ],
    http_req_failed: [
      'rate<0.01',
      { threshold: 'rate<0.05', abortOnFail: true }  // Abort if >5% errors (stricter)
    ],
    checks: ['rate>0.99'],  // 99% of checks must pass (stricter for high profile)
  },
};

export const threshold = config[__ENV.K6_THRESHOLD] || config['low'];
