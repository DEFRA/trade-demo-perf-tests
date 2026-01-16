export class DefraIdStubClient {
  constructor(baseUrl = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200') {
    this.baseUrl = baseUrl;
    this.registerEndpoint = `${baseUrl}/cdp-defra-id-stub/API/register`;
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }

  async registerUser(userData) {
    const payload = {
      email: userData.email,
      firstName: userData.firstName || 'K6',
      lastName: userData.lastName || 'PerfUser',
      loa: userData.loa || '1',
      enrolmentCount: 1,
      enrolmentRequestCount: 1,
      relationships: [
        {
          organisationName: 'K6 Performance Test Organization',
          relationshipRole: 'Employee'
        }
      ]
    };

    return this._fetchWithRetry(this.registerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async deleteUser(email) {
    // Note: DEFRA ID stub may not have a delete endpoint
    // This is a placeholder for future implementation
    console.warn('Delete user not implemented in DEFRA ID stub');
    return { success: false, message: 'Delete endpoint not available' };
  }

  async _fetchWithRetry(url, options, retries = this.maxRetries) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0) {
        console.log(`Request failed, retrying... (${retries} attempts left)`);
        await this._sleep(this.retryDelay);
        return this._fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
