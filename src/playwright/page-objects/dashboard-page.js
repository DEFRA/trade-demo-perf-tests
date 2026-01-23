export class DashboardPage {
  constructor(page) {
    this.page = page;
  }

  async navigate() {
    // Navigate to dashboard from home page
    await this.page.getByRole('link', { name: /dashboard/i })
      .or(this.page.getByRole('link', { name: /my notifications/i }))
      .click();

    // Wait for dashboard to load
    await this.page.waitForURL(/dashboard|notifications/i);
  }

  async clickNewImport() {
    // Use semantic locator for button or link
    await this.page.getByRole('link', { name: /new import/i })
      .or(this.page.getByRole('button', { name: /new import/i }))
      .click();
  }

  async verifyNotificationInList(chedReference = null) {
    // If CHED reference provided, search for it specifically
    if (chedReference) {
      await this.page.getByText(chedReference).waitFor({ state: 'visible' });
    } else {
      // Otherwise, just check that a notification list appears
      const notificationList = this.page.getByRole('table')
        .or(this.page.getByRole('list'))
        .or(this.page.getByTestId('notification-list'));

      await notificationList.waitFor({ state: 'visible' });
    }
  }
}
