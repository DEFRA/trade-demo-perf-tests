// TransportPage - Means of transport details

import { postWithValidation, extractCrumbOrThrow } from '../utils/http-utils.js';

export class TransportPage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/import/transport`;
  }

  /**
   * Submit transport means details
   * @param {string} crumb - CSRF token
   * @param {string} bcp - Border control post (e.g., 'Dover')
   * @param {string} transportMeansBefore - Transport type (e.g., 'Road', 'Air', 'Sea')
   * @param {string} vehicleIdentifier - Vehicle identifier/registration
   * @returns {string} New CSRF crumb token
   * @throws {TestingError} If submission fails or crumb not found
   */
  submit(crumb, bcp, transportMeansBefore, vehicleIdentifier) {
    console.log('==== Posting Means of Transport page...');

    const transportData = {
      crumb: crumb,
      bcp: bcp,
      'transport-means-before': transportMeansBefore,
      'vehicle-identifier': vehicleIdentifier
    };

    const response = postWithValidation(
      this.url,
      transportData,
      {
        'Transport submitted': (r) =>
          r.status === 200 && r.url.endsWith('/import/review')
      },
      'Saving the Means of Transport failed',
    { tags: { name: 'SubmitTransportPage' } }
    );

    return extractCrumbOrThrow(response, 'Transport submission');
  }
}
