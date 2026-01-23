import { test } from '@playwright/test';
import { AuthPage } from './page-objects/auth-page.js';
import { DashboardPage } from './page-objects/dashboard-page.js';
import { NotificationPages } from './page-objects/notification-pages.js';

test('Capture network traffic for k6 conversion', async ({ page }) => {
  const testUserEmail = process.env.TEST_USER_EMAIL || 'k6-perf-user-1@example.com';
  const authPage = new AuthPage(page);
  const dashboardPage = new DashboardPage(page);
  const notificationPages = new NotificationPages(page);

  // Log all HTTP requests
  page.on('request', request => {
    const method = request.method();
    const url = request.url();
    const headers = request.headers();

    console.log('\n=== REQUEST ===');
    console.log(`${method} ${url}`);
    console.log('Headers:', JSON.stringify({
      'cookie': headers['cookie'] || '(none)',
      'content-type': headers['content-type'] || '(none)',
      'referer': headers['referer'] || '(none)',
    }, null, 2));

    const postData = request.postData();
    if (postData) {
      console.log('Body:', postData);
    }
  });

  // Log all HTTP responses
  page.on('response', async response => {
    const status = response.status();
    const url = response.url();
    const headers = response.headers();

    console.log('\n=== RESPONSE ===');
    console.log(`${status} ${url}`);

    if (headers['set-cookie']) {
      console.log('Set-Cookie:', headers['set-cookie']);
    }

    // Log redirects
    if (status >= 300 && status < 400) {
      console.log('Redirect to:', headers['location']);
    }
  });

  // Run the notification journey
  console.log('\n\n========== STARTING NOTIFICATION JOURNEY ==========\n');

  await page.goto('/');

  await authPage.signIn();
  await authPage.selectUser(testUserEmail);
  await authPage.verifyAuthenticated(testUserEmail);

  await dashboardPage.navigate();
  await dashboardPage.clickNewImport();

  await notificationPages.fillOrigin('United States');
  await notificationPages.searchCommodity('0102');
  await notificationPages.selectCommodityRefinement('Bison bison');
  await notificationPages.fillCommodityQuantities('100', '10');
  await notificationPages.fillPurpose();
  await notificationPages.fillTransport();

  await notificationPages.submitNotification();
  await notificationPages.verifyConfirmation();

  console.log('\n\n========== JOURNEY COMPLETE ==========\n');
});
