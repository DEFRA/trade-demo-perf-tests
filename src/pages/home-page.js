// HomePage - Landing page for the trade application

import { getWithValidation } from '../utils/http-utils.js';

export class HomePage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.url = baseUrl;
  }

  /**
   * Navigate to home page
   * @throws {TestingError} If page fails to load
   */
  visit() {
    getWithValidation(
      this.url,
      { 'home page loaded': (r) => r.status === 200 && r.url === this.baseUrl },
      'Loading the Home Page failed'
    );
  }
}
