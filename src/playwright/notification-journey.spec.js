import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page.js';
import { DashboardPage } from './page-objects/dashboard-page.js';
import { NotificationPages } from './page-objects/notification-pages.js';

test.describe('Notification Journey', () => {
  test('Create and submit import notification', async ({ page }) => {
    // Arrange - Set up test user and page objects
    const testUserEmail = process.env.TEST_USER_EMAIL || 'k6-perf-user-1@example.com';
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);
    const notificationPages = new NotificationPages(page);

    // Navigate to frontend
    await page.goto('/');

    // Act - Authenticate via DEFRA ID stub
    await authPage.signIn();
    await authPage.selectUser(testUserEmail);

    // Assert - Verify authentication
    await authPage.verifyAuthenticated('K6');

    // Act - Start new import notification
    await dashboardPage.clickNewImport();

    // Act - Fill Origin page
    await notificationPages.fillOrigin('United States');

    // Act - Search and select commodity
    await notificationPages.searchCommodity('0102');
    await notificationPages.selectCommodityRefinement('Bison bison');

    // Act - Fill commodity quantities
    await notificationPages.fillCommodityQuantities('100');

    // Act - Fill purpose
    await notificationPages.fillPurpose();

    // Act - Fill transport
    await notificationPages.fillTransport();

    // Assert - We should now be on Review page
    await expect(page.getByRole('heading', { name: /review/i }))
      .or(page.getByText(/check your answers/i))
      .toBeVisible();

    // Act - Change commodity quantities
    await notificationPages.clickChangeCommodity();

    // Act - Update quantities with new random values
    const newQuantity = Math.floor(Math.random() * 500) + 1;
    await notificationPages.fillCommodityQuantities(newQuantity.toString());

    // Act - Navigate through Purpose and Transport pages back to Review
    await notificationPages.saveAndContinueThroughPages();

    // Assert - Back on Review page
    await expect(page.getByRole('heading', { name: /review/i }))
      .or(page.getByText(/check your answers/i))
      .toBeVisible();

    // Act - Save as draft
    await notificationPages.saveAsDraft();

    // Assert - Draft saved confirmation
    await expect(page.getByText(/saved/i).or(page.getByText(/draft/i)))
      .toBeVisible();

    // Act - Submit notification
    await notificationPages.submitNotification();

    // Assert - Verify confirmation
    await notificationPages.verifyConfirmation();

    // Act - Return to dashboard
    await notificationPages.returnToDashboard();

    // Assert - Verify notification appears in list
    await dashboardPage.verifyNotificationInList();
  });

  test('Create import notification with minimal data', async ({ page }) => {
    // Arrange
    const testUserEmail = process.env.TEST_USER_EMAIL || 'k6-perf-user-1@example.com';
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);
    const notificationPages = new NotificationPages(page);

    await page.goto('/');

    // Act - Authentication
    await authPage.signIn();
    await authPage.selectUser(testUserEmail);

    // Assert
    await authPage.verifyAuthenticated('K6');

    // Act - Create notification
    await dashboardPage.clickNewImport();
    await notificationPages.fillOrigin();
    await notificationPages.searchCommodity();
    await notificationPages.selectCommodityRefinement();
    await notificationPages.fillCommodityQuantities();
    await notificationPages.fillPurpose();
    await notificationPages.fillTransport();

    // Assert - On review page
    await expect(page.getByRole('heading', { name: /review/i }))
      .or(page.getByText(/check your answers/i))
      .toBeVisible();

    // Act - Submit directly
    await notificationPages.submitNotification();

    // Assert - Verify submission
    await notificationPages.verifyConfirmation();
  });
});
