import { randomUUID } from 'crypto';

export class DefraIdStubClient {
  constructor(baseUrl = process.env.DEFRA_ID_STUB_URL || 'http://localhost:3200') {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.registerEndpoint = `${baseUrl}/cdp-defra-id-stub/API/register`;
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }

  async registerUser(userData) {
    // Input validation
    if (!userData || !userData.email) {
      throw new Error('Email is required in userData');
    }

    // Generate a proper UUID for userId
    const userId = userData.userId || randomUUID();

    const payload = {
      userId: userId,
      email: userData.email,
      firstName: userData.firstName || 'K6',
      lastName: userData.lastName || 'PerfUser',
      loa: userData.loa || '1',
      aal: userData.aal || '1',
      enrolmentCount: 1,
      enrolmentRequestCount: 1,
      relationships: [
        {
          organisationName: 'K6 Performance Test Organization',
          relationshipRole: 'Employee',
          roleName: 'Performance Tester',
          roleStatus: '1'
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

  async expireUser(userId) {
    // DEFRA ID stub expire endpoint: POST /cdp-defra-id-stub/API/register/{userId}/expire
    const expireEndpoint = `${this.baseUrl}/cdp-defra-id-stub/API/register/${userId}/expire`;

    try {
      const response = await fetch(expireEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (e) {
          // Ignore if unable to read body
        }
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`
        };
      }

      // Check if response has content
      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = { message: 'User expired' };
      }

      return { success: true, message: 'User expired successfully', data: result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async _fetchWithRetry(url, options, retries = this.maxRetries) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        // Enhance error message with response body
        // let errorBody = '';
        // try {
        //   errorBody = await response.text();
        // } catch (e) {
        //   // Ignore if unable to read body
        // }

        // const errorMessage = `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`;
        const errorMessage = `url: ${url} responded with HTTP ${response.status}: ${response.statusText}`;
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
