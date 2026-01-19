export class AuthPage {
  constructor(page) {
    this.page = page;
  }

  async signIn() {
    // Click "Sign in" button on frontend using semantic locator
    await this.page.getByRole('link', { name: /sign in/i }).click();

    // Wait for redirect to DEFRA ID stub
    await this.page.waitForURL(/cdp-defra-id-stub/);
  }

  async selectUser(email) {
    // In DEFRA ID stub, click the user by email
    // The stub typically shows a list of users - use text locator
    await this.page.getByText(email).click();

    // Wait for redirect back to application (no longer on stub)
    await this.page.waitForURL(/^(?!.*cdp-defra-id-stub).*/);
  }

  async verifyAuthenticated(expectedName = 'K6') {
    // Verify user name appears - check for sign out link nearby
    const header = this.page.locator('header').or(this.page.locator('.govuk-header'));
    await header.getByText(expectedName).waitFor({ state: 'visible' });
  }
}
