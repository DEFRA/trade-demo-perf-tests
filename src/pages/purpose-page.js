// PurposePage - Import purpose selection

import { postWithValidation, extractCrumbOrThrow } from '../utils/http-utils.js';

export class PurposePage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/import/consignment/purpose`;
  }

  /**
   * Submit import purpose
   * @param {string} crumb - CSRF token
   * @param {string} purpose - Main purpose (e.g., 'internalmarket', 'transhipment')
   * @param {string} internalMarketPurpose - Specific internal market purpose
   * @returns {string} New CSRF crumb token
   * @throws {TestingError} If submission fails or crumb not found
   */
  submit(crumb, purpose, internalMarketPurpose) {
    console.log('==== Posting Purpose page...');

    const purposeData = {
      crumb: crumb,
      purpose: purpose,
      'internal-market-purpose': internalMarketPurpose
    };

    const response = postWithValidation(
      this.url,
      purposeData,
      {
        'Purpose submitted': (r) =>
          r.status === 200 && r.url.endsWith('/import/transport')
      },
      'Saving the purpose failed',
    { tags: { name: 'SubmitPurpose'} }
    );

    return extractCrumbOrThrow(response, 'Purpose submission');
  }
}
