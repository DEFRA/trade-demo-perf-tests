// ReviewPage - Review and confirm notification details

import http from 'k6/http';
import { check } from 'k6';
import {extractCrumbOrThrow, postWithValidation, postRestWithValidation, extractCSRFTokenFromMeta} from '../utils/http-utils.js';
import { TestingError } from '../tests/exceptions.js';

export class ReviewPage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/import/review`;
    this.csrfToken = null; // Store the meta tag token.
  }

  /**
   * Validate review page content
   * @param {string} expectedCountry - Expected country code
   * @param {string} expectedCommodity - Expected commodity description
   * @param {string} expectedReason - Expected main reason for import
   * @param {string} expectedPurpose - Expected internal market purpose
   * @param {string} expectedBcp - Expected border control post
   * @throws {TestingError} If validation fails
   */
  validate(expectedCountry, expectedCommodity, expectedReason, expectedPurpose, expectedBcp) {
    console.log('==== Validating Review page...');

    const response = http.get(this.url, {
      tags: { name: 'GetReviewPage' }
    });

    if (!check(response, {
      'Review page loaded': (r) => r.status === 200 && r.url.endsWith('/import/review')
    })) {
      console.log(`Response status: ${response.status}`);
      console.log(`Response URL: ${response.url}`);
      throw new TestingError('Loading the Review page failed');
    }

    // Extract and store CSRF token from meta tag for RESTful calls
    this.csrfToken = extractCSRFTokenFromMeta(response.body);
    if (!this.csrfToken) {
      throw new TestingError('CSRF token meta tag not found in review page');
    }

    const body = response.body;
    const validations = [];

    // Validate Country of Origin
    if (body.includes(expectedCountry)) {
      console.log(`✓ Country of Origin validated: ${expectedCountry}`);
    } else {
      validations.push(`Country of Origin: expected ${expectedCountry} not found`);
    }

    // Validate Commodity
    if (body.includes(expectedCommodity)) {
      console.log(`✓ Commodity validated: ${expectedCommodity}`);
    } else {
      validations.push(`Commodity: expected '${expectedCommodity}' not found`);
    }

    // Validate Main reason for import
    if (body.includes(expectedReason)) {
      console.log(`✓ Main reason for import validated: ${expectedReason}`);
    } else {
      validations.push(`Main reason for import: expected ${expectedReason} not found`);
    }

    // Validate Internal market purpose
    if (body.includes(expectedPurpose)) {
      console.log(`✓ Internal market purpose validated: ${expectedPurpose}`);
    } else {
      validations.push(`Internal market purpose: expected ${expectedPurpose} not found`);
    }

    // Validate Transport BCP
    if (body.includes(expectedBcp)) {
      console.log(`✓ BCP validated: ${expectedBcp}`);
    } else {
      validations.push(`BCP: expected ${expectedBcp} not found`);
    }

    // If any validations failed, throw error
    if (validations.length > 0) {
      console.error('Review page validation failed:');
      validations.forEach(v => console.error(`  ✗ ${v}`));
      throw new TestingError(`Review page validation failed: ${validations.join('; ')}`);
    }

    console.log('✓ All review page validations passed');
  }

  /**
   * Submit notification for processing
   * @param {string} crumb - CSRF token
   * @param {boolean} confirmation - Confirmation checkbox value
   * @throws {TestingError} If submission fails
   */
  submit(crumb, confirmation) {
    console.log('==== Submitting Notification...');

    const submitData = {
      crumb: crumb,
      confirmAccurate: confirmation
    };

    const response = postWithValidation(
      this.url,
      submitData,
      {
        'Notification Submitted': (r) =>
          r.status === 200 && r.url.endsWith('/import/confirmation')
      },
      'Submitting the Notification failed',
      { tags: { name: 'SubmitNotification' } }
    );

    // Additional validation for confirmation page content
    if (!check(response, {
      'confirmation received': (r) => r.status === 200 && r.body.includes('Import notification submitted')
    })) {
      throw new TestingError('Confirmation page content not found.');
    }
  }

  /**
   * Save as draft
   */
  saveAsDraft() {
    console.log('==== Saving Notification...');

    const saveData = JSON.stringify({
      formData: {}
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken  // CSRF token in header, not body!
      },
      tags: { name: 'SaveDraft' }
    }

    const jsonResponse = postRestWithValidation(
      `${this.baseUrl}/import/save-as-draft`,
      saveData,
      {
        'Notification Saved': (r) => r.status === 200
      },
      'Saving the Draft Notification failed',
      params
    );

    if (!check(jsonResponse, {
      'Draft saved successfully': (j) => j.success && j.message === 'Draft saved successfully'
    })) {
      throw new TestingError('Draft not saved successully');
    }
    console.log(`✓ Draft saved successfully. ID: ${jsonResponse.notificationId || 'new'}`);
  }
}
