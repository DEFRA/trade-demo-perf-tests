export class DefraIdStubClient {
  constructor(baseUrl = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200') {
    this.baseUrl = baseUrl;
    this.registerEndpoint = `${baseUrl}/cdp-defra-id-stub/API/register`;
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }

  async registerUser(userData) {
    // Input validation
    if (!userData || !userData.email) {
      throw new Error('Email is required in userData');
    }

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
        // Enhance error message with response body
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (e) {
          // Ignore if unable to read body
        }
        const errorMessage = `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0) {
        // Calculate exponential backoff delay
        const attemptNumber = this.maxRetries - retries;
        const delay = this.retryDelay * Math.pow(2, attemptNumber);
        console.log(`Request failed, retrying in ${delay}ms... (${retries} attempts left)`);
        await this._sleep(delay);
        return this._fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
