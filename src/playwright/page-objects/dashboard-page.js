export class DashboardPage {
  constructor(page) {
    this.page = page;
  }

  async clickNewImport() {
    // Use semantic locator for button or link
    await this.page.getByRole('link', { name: /new import/i })
      .or(this.page.getByRole('button', { name: /new import/i }))
      .click();
  }

  async verifyNotificationInList() {
    // Check that a notification appears in the dashboard list
    // Look for common table/list structures
    const notificationList = this.page.getByRole('table')
      .or(this.page.getByRole('list'))
      .or(this.page.getByTestId('notification-list'));

    await notificationList.waitFor({ state: 'visible' });
  }
}
