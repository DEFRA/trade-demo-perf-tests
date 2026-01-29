// OriginPage - Country of origin selection page

import { getWithValidation, postWithValidation, extractCrumbOrThrow } from '../utils/http-utils.js';

export class OriginPage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/import/consignment/origin`;
  }

  /**
   * Navigate to country of origin page
   * @returns {string} CSRF crumb token for form submission
   * @throws {TestingError} If page fails to load or crumb not found
   */
  visit() {
    console.log('==== Navigating to Country of Origin page...');

    const response = getWithValidation(
      this.url,
      { 'Country of Origin loaded': (r) => r.status === 200 && r.url.endsWith('/import/consignment/origin') },
      'Loading the Country of Origin page failed'
    );

    return extractCrumbOrThrow(response, 'Country of Origin page');
  }

  /**
   * Submit country of origin
   * @param {string} crumb - CSRF token
   * @param {string} countryCode - ISO country code (e.g., 'US', 'FR')
   * @returns {string} New CSRF crumb token for next page
   * @throws {TestingError} If submission fails or crumb not found
   */
  submit(crumb, countryCode) {
    console.log('==== Posting Country of Origin page...');

    const formData = {
      'crumb': crumb,
      'origin-country': countryCode
    };

    const response = postWithValidation(
      this.url,
      formData,
      { 'Country of Origin submitted': (r) => r.status === 200 && r.url.endsWith('/import/commodity/codes') },
      'Country of Origin submission failed'
    );

    return extractCrumbOrThrow(response, 'After origin submission');
  }
}
