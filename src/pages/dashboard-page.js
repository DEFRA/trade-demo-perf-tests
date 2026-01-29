// DashboardPage - User dashboard after authentication

import { getWithValidation } from '../utils/http-utils.js';

export class DashboardPage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.url = `${baseUrl}/dashboard`;
  }

  /**
   * Navigate to dashboard page
   * @throws {TestingError} If page fails to load
   */
  visit() {
    getWithValidation(
      this.url,
      { 'Dashboard loaded': (r) => r.status === 200 && r.url.endsWith('/dashboard') },
      'Loading the Dashboard Page failed'
    );
  }
}
