export class NotificationPages {
  constructor(page) {
    this.page = page;
  }

  // Origin page
  async fillOrigin(country = 'United States') {
    // Use semantic locator for select element
    await this.page.getByLabel(/country/i).selectOption({ label: country });
    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Commodity page
  async searchCommodity(code = '0102') {
    // Use label or placeholder for input field
    await this.page.getByLabel(/commodity code/i)
      .or(this.page.getByPlaceholder(/commodity/i))
      .fill(code);
    await this.page.getByRole('button', { name: /search/i }).click();
  }

  async selectCommodityRefinement(text = 'Bison bison') {
    // Click the specific commodity from search results
    await this.page.getByText(text).click();
    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Commodity Quantities
  async fillCommodityQuantities(quantity = '100') {
    // Find all number inputs and fill them
    // Using getByLabel for better semantics, fallback to type
    const quantityInputs = this.page.getByLabel(/quantity/i)
      .or(this.page.getByRole('textbox', { name: /quantity/i }))
      .or(this.page.locator('input[type="number"]'));

    const count = await quantityInputs.count();

    for (let i = 0; i < count; i++) {
      await quantityInputs.nth(i).fill(quantity.toString());
    }

    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Purpose page
  async fillPurpose() {
    // Select purpose checkbox/radio - use getByLabel for accessibility
    await this.page.getByLabel(/Great Britain/i)
      .or(this.page.getByText(/import into Great Britain/i))
      .click();

    // Select purpose from dropdown
    await this.page.getByLabel(/purpose/i).selectOption({ label: 'Slaughter' });
    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Transport page
  async fillTransport() {
    // Fill port of entry
    await this.page.getByLabel(/port/i).fill('DOVER');

    // Select means of transport
    await this.page.getByLabel(/means of transport/i)
      .or(this.page.getByLabel(/transport/i))
      .selectOption({ label: 'Railway' });

    // Random 10-character vehicle ID
    const vehicleId = Math.random().toString(36).substring(2, 12).toUpperCase();
    await this.page.getByLabel(/vehicle/i).fill(vehicleId);

    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Review page operations
  async clickChangeCommodity() {
    // Find the Change link for commodity using semantic approach
    // Look for a link with "Change" text near "Commodity"
    const commoditySection = this.page.getByText(/commodity/i).locator('..');
    await commoditySection.getByRole('link', { name: /change/i }).click();
  }

  async saveAndContinueThroughPages() {
    // Click "Save and Continue" through multiple pages
    // We need to go through: Quantities -> Purpose -> Transport -> Review
    for (let i = 0; i < 3; i++) {
      // Wait for page to stabilize
      await this.page.waitForLoadState('networkidle');
      await this.page.getByRole('button', { name: /save and continue/i }).click();
    }
  }

  async saveAsDraft() {
    await this.page.getByRole('button', { name: /save as draft/i }).click();
  }

  async submitNotification() {
    // Check the confirmation checkbox
    await this.page.getByRole('checkbox').check();
    await this.page.getByRole('button', { name: /submit notification/i }).click();
  }

  async verifyConfirmation() {
    // Check for confirmation message in heading
    await this.page.getByRole('heading', { name: /notification submitted/i })
      .waitFor({ state: 'visible' });
  }

  async returnToDashboard() {
    await this.page.getByRole('link', { name: /dashboard/i })
      .or(this.page.getByRole('link', { name: /return to dashboard/i }))
      .click();
  }
}
