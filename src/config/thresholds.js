const config = {
  low: {
    http_req_duration: ['p(90)<2500'],
    http_req_failed: ['rate<0.01'],
  },
  medium: {
    http_req_duration: ['p(90)<400', 'p(95)<800', 'p(99.9)<2000'],
    http_req_failed: ['rate<0.01'],
  },
  high: {
    http_req_duration: ['p(90)<250', 'p(95)<500', 'p(99.9)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export const threshold = config[__ENV.K6_THRESHOLD] || config['low'];
