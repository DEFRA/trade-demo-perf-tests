// K6 HTML Report Generator
// Reusable HTML report generation for K6 performance tests

import { env } from '../config/test-config.js';
import { workload } from '../config/workloads.js';

/**
 * Generates an HTML report from K6 test results
 * @param {Object} data - K6 summary data
 * @param {Object} options - Report customization options
 * @param {string} options.title - Report title (default: "K6 Performance Test Report")
 * @param {string} options.testName - Name of the test (default: "Performance Test")
 * @param {Array<string>} options.journeyMetrics - List of custom journey metrics to include
 * @returns {string} HTML report content
 */
export function generateHtmlReport(data, options = {}) {
  const {
    title = 'K6 Performance Test Report',
    testName = 'Performance Test',
    journeyMetrics = [
      'notification_journey_duration',
      'auth_duration',
      'origin_step_duration',
      'commodity_step_duration',
      'purpose_step_duration',
      'transport_step_duration',
      'save_step_duration',
      'submit_duration'
    ]
  } = options;

  const date = new Date().toISOString();
  const metrics = data.metrics;

  // Extract workload configuration from K6 options
  const workloadConfig = extractWorkloadConfig(data);

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
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
    <h1>${title}</h1>
    <p><strong>Test:</strong> ${testName}</p>
    <p><strong>Generated:</strong> ${date}</p>
    <p><strong>Duration:</strong> ${data.state?.testRunDurationMs ? (data.state.testRunDurationMs / 1000).toFixed(2) + 's' : 'N/A'}</p>

    <h2>Workload Configuration</h2>
    <table>
      <tr>
        <th>Profile</th>
        <td>${env.profile.workload} / ${env.profile.threshold}</td>
      </tr>
      <tr>
        <th>Scenario</th>
        <td>${workloadConfig.scenarioName}</td>
      </tr>
      <tr>
        <th>Executor</th>
        <td><code>${workloadConfig.executor}</code></td>
      </tr>
      ${workloadConfig.details}
    </table>

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
      ${[...journeyMetrics, 'http_req_duration']
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
        <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? '&#x2705; PASS' : '&#x274C; FAIL'}</td>
      </tr>
          `).join('');
        }).join('')}
    </table>

    <h2>Page Failures</h2>
    <table>
      <tr>
        <th>Page</th>
        <th>Failures</th>
      </tr>
      ${[
        { metric: 'origin_page_failures', label: 'Origin Page' },
        { metric: 'commodity_page_failures', label: 'Commodity Page' },
        { metric: 'purpose_page_failures', label: 'Purpose Page' },
        { metric: 'transport_page_failures', label: 'Transport Page' },
        { metric: 'review_page_failures', label: 'Review Page' },
        { metric: 'save_failures', label: 'Save as Draft' },
        { metric: 'submit_failures', label: 'Submit' }
      ].map(({ metric, label }) => {
          const values = metrics[metric]?.values || {};
          const count = values.count || 0;
          return `
      <tr>
        <td>${label}</td>
        <td class="metric-value ${count > 0 ? 'fail' : ''}">${count}</td>
      </tr>
          `;
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
        <td class="metric-value">${values.count || 'N/A'}</td>
        <td class="metric-value">${values.rate ? values.rate.toFixed(4) : 'N/A'}</td>
      </tr>
          `;
        }).join('')}
    </table>

    <h2>HTTP Metrics</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Average</th>
        <th>Min</th>
        <th>Max</th>
        <th>P90</th>
        <th>P95</th>
      </tr>
      ${['http_req_duration', 'http_req_waiting', 'http_req_connecting', 'http_req_sending', 'http_req_receiving']
        .filter(name => metrics[name])
        .map(name => {
          const m = metrics[name].values;
          return `
      <tr>
        <td>${name.replace(/http_req_/, '').replace(/_/g, ' ')}</td>
        <td class="metric-value">${m.avg?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m.min?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m.max?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m['p(90)']?.toFixed(2) || 'N/A'} ms</td>
        <td class="metric-value">${m['p(95)']?.toFixed(2) || 'N/A'} ms</td>
      </tr>
          `;
        }).join('')}
    </table>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Creates a K6 handleSummary function that generates HTML and JSON reports
 * @param {Object} options - Report customization options
 * @param {string} options.htmlFilename - HTML report filename (default: 'index.html')
 * @param {string} options.jsonFilename - JSON report filename (default: 'summary.json')
 * @param {string} options.title - Report title
 * @param {string} options.testName - Name of the test
 * @param {Array<string>} options.journeyMetrics - List of custom journey metrics to include
 * @returns {Function} handleSummary function for K6
 */
export function createHandleSummary(options = {}) {
  const {
    htmlFilename = 'index.html',
    jsonFilename = 'summary.json',
    ...reportOptions
  } = options;

  return function handleSummary(data) {
    return {
      [htmlFilename]: generateHtmlReport(data, reportOptions),
      [jsonFilename]: JSON.stringify(data, null, 2),
      stdout: textSummary(data)  // Also output to console
    };
  };
}

/**
 * Extracts workload configuration from imported config
 * @param {Object} data - K6 summary data (unused, kept for signature compatibility)
 * @returns {Object} Workload configuration with scenarioName, executor, and details (HTML)
 */
function extractWorkloadConfig(data) {
  // Use the imported workload configuration directly
  const scenarioName = env.profile.workload;
  const scenario = workload;
  const executor = scenario.executor || 'unknown';

  // Generate executor-specific details
  let details = '';

  switch (executor) {
    case 'ramping-vus':
      // Show stages with duration and target VUs
      if (scenario.stages && scenario.stages.length > 0) {
        details += '<tr><th>Stages</th><td><ul style="margin: 0; padding-left: 20px;">';
        scenario.stages.forEach((stage, index) => {
          details += `<li>Stage ${index + 1}: ${stage.duration} &#x2192; ${stage.target} VUs</li>`;
        });
        details += '</ul></td></tr>';
      }
      if (scenario.startVUs !== undefined) {
        details += `<tr><th>Start VUs</th><td>${scenario.startVUs}</td></tr>`;
      }
      if (scenario.gracefulRampDown) {
        details += `<tr><th>Graceful Ramp Down</th><td>${scenario.gracefulRampDown}</td></tr>`;
      }
      break;

    case 'constant-arrival-rate':
      // Show rate, duration, and preAllocated VUs
      if (scenario.rate !== undefined) {
        const timeUnit = scenario.timeUnit || '1s';
        details += `<tr><th>Rate</th><td>${scenario.rate} iterations per ${timeUnit}</td></tr>`;
      }
      if (scenario.duration) {
        details += `<tr><th>Duration</th><td>${scenario.duration}</td></tr>`;
      }
      if (scenario.preAllocatedVUs !== undefined) {
        details += `<tr><th>Pre-allocated VUs</th><td>${scenario.preAllocatedVUs}</td></tr>`;
      }
      if (scenario.maxVUs !== undefined) {
        details += `<tr><th>Max VUs</th><td>${scenario.maxVUs}</td></tr>`;
      }
      break;

    case 'per-vu-iterations':
      // Show VUs and iterations
      if (scenario.vus !== undefined) {
        details += `<tr><th>Virtual Users</th><td>${scenario.vus}</td></tr>`;
      }
      if (scenario.iterations !== undefined) {
        details += `<tr><th>Iterations</th><td>${scenario.iterations} per VU</td></tr>`;
      }
      if (scenario.maxDuration) {
        details += `<tr><th>Max Duration</th><td>${scenario.maxDuration}</td></tr>`;
      }
      break;

    case 'shared-iterations':
      // Show total iterations and VUs
      if (scenario.vus !== undefined) {
        details += `<tr><th>Virtual Users</th><td>${scenario.vus}</td></tr>`;
      }
      if (scenario.iterations !== undefined) {
        details += `<tr><th>Total Iterations</th><td>${scenario.iterations} (shared)</td></tr>`;
      }
      if (scenario.maxDuration) {
        details += `<tr><th>Max Duration</th><td>${scenario.maxDuration}</td></tr>`;
      }
      break;

    case 'constant-vus':
      // Show VUs and duration
      if (scenario.vus !== undefined) {
        details += `<tr><th>Virtual Users</th><td>${scenario.vus}</td></tr>`;
      }
      if (scenario.duration) {
        details += `<tr><th>Duration</th><td>${scenario.duration}</td></tr>`;
      }
      break;

    case 'ramping-arrival-rate':
      // Show stages with rate targets
      if (scenario.stages && scenario.stages.length > 0) {
        details += '<tr><th>Stages</th><td><ul style="margin: 0; padding-left: 20px;">';
        scenario.stages.forEach((stage, index) => {
          details += `<li>Stage ${index + 1}: ${stage.duration} &#x2192; ${stage.target} iterations/s</li>`;
        });
        details += '</ul></td></tr>';
      }
      if (scenario.preAllocatedVUs !== undefined) {
        details += `<tr><th>Pre-allocated VUs</th><td>${scenario.preAllocatedVUs}</td></tr>`;
      }
      if (scenario.startRate !== undefined) {
        const timeUnit = scenario.timeUnit || '1s';
        details += `<tr><th>Start Rate</th><td>${scenario.startRate} per ${timeUnit}</td></tr>`;
      }
      break;

    default:
      details = '<tr><td colspan="2"><em>Unknown executor type</em></td></tr>';
  }

  // If no details were generated, show a message
  if (details === '') {
    details = '<tr><td colspan="2"><em>No configuration details available</em></td></tr>';
  }

  return {
    scenarioName,
    executor,
    details
  };
}

/**
 * Generates a text summary for console output
 * @param {Object} data - K6 summary data
 * @returns {string} Text summary
 */
function textSummary(data) {
  const metrics = data.metrics;
  const lines = [
    '',
    '═══════════════════════════════════════════════════════',
    '  K6 Performance Test Summary',
    '═══════════════════════════════════════════════════════',
    '',
    `  Duration: ${data.state?.testRunDurationMs ? (data.state.testRunDurationMs / 1000).toFixed(2) + 's' : 'N/A'}`,
    `  VUs (max): ${metrics.vus?.values?.max || 'N/A'}`,
    `  Requests: ${metrics.http_reqs?.values?.count || 'N/A'}`,
    `  Error Rate: ${metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(2) + '%' : 'N/A'}`,
    '',
    '  HTTP Duration (avg): ' + (metrics.http_req_duration?.values?.avg?.toFixed(2) || 'N/A') + ' ms',
    '  HTTP Duration (p95): ' + (metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A') + ' ms',
    '  HTTP Duration (p99): ' + (metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 'N/A') + ' ms',
    '',
    '═══════════════════════════════════════════════════════',
    ''
  ];

  return lines.join('\n');
}
