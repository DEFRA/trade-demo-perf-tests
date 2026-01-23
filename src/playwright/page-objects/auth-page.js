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
    // In DEFRA ID stub, click the login link for the user
    // Find the row containing the email, then click the login link within it
    await this.page.getByRole('link', { name: new RegExp(email, 'i') })
      .or(this.page.locator(`a:has-text("${email}")`))
      .or(this.page.getByText(email).locator('..').getByRole('link', { name: /Log in/i }))
      .click();

    // Wait for redirect back to application (no longer on stub)
    await this.page.waitForURL(/^(?!.*cdp-defra-id-stub).*/);
  }

  async verifyAuthenticated(email) {
    // Verify user name appears - check for sign out link nearby
    const header = this.page.locator('.app-service-header');
    await header.getByText(email).waitFor({ state: 'visible' });
  }
}
