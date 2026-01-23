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
    // Try multiple strategies to find the commodity code input
    await this.page.getByLabel(/commodity code/i)
      .or(this.page.getByRole('textbox', { name: /commodity/i }))
      .or(this.page.locator('#commodity-code'))
      .or(this.page.locator('input[name*="commodity"]'))
      .or(this.page.locator('input[id*="commodity"]'))
      .fill(code);
    await this.page.getByRole('button', { name: /search/i }).click();
  }

  async selectCommodityRefinement(text = 'Bison bison') {
    // Click the specific commodity from search results
    await this.page.getByText(text).click();
    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Commodity Quantities
  async fillCommodityQuantities(noOfAnimals = '100', noOfPacks = '10') {
    // Fill the number of animals field
    const noOfAnimalsField = this.page.locator('input[name$="-noOfAnimals"]')
      .or(this.page.getByLabel(/number of animals/i));

    if (await noOfAnimalsField.count() > 0) {
      await noOfAnimalsField.fill(noOfAnimals.toString());
    }

    // Fill the number of packages field
    const noOfPacksField = this.page.locator('input[name$="-noOfPacks"]')
      .or(this.page.getByLabel(/number of (?:packages|packs)/i));

    if (await noOfPacksField.count() > 0) {
      await noOfPacksField.fill(noOfPacks.toString());
    }

    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Purpose page
  async fillPurpose() {
    // Select purpose checkbox/radio - use getByLabel for accessibility
    await this.page.getByText(/import into Great Britain/i)
      .click();

    // Select purpose from dropdown
    await this.page.getByLabel(/What are the animals for/i).selectOption({ label: 'Slaughter' });
    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Transport page
  async fillTransport() {
    // Fill port of entry
    await this.page.getByRole('textbox', { name: 'BCP or Port of Entry' }).fill('DOVER');

    // Select means of transport
    await this.page.getByLabel(/means of transport/i)
      .or(this.page.getByLabel(/transport/i))
      .selectOption({ label: 'Railway' });

    // Random 10-character vehicle ID
    const vehicleId = Math.random().toString(36).substring(2, 12).toUpperCase();
    await this.page.locator('input[name="vehicle-identifier"]').fill(vehicleId);

    await this.page.getByRole('button', { name: /save and continue/i }).click();
  }

  // Review page operations
  async clickChangeCommodity() {
    // Find the Change link for commodity using semantic approach
    // Look for a link with "Change" text near "Commodity"
    await this.page.waitForLoadState('networkidle');
    const commoditySection = this.page.getByText(/commodity/i).locator('..');
    await commoditySection.getByRole('link', { name: /change/i }).click();
  }

  async saveAndContinueThroughPages() {
    // Click "Save and Continue" through multiple pages
    // We need to go through: Quantities -> Purpose -> Transport -> Review
    do {
      await this.page.getByRole('button', { name: /save and continue/i }).click();
      await this.page.waitForLoadState('networkidle');
    } while (await this.page.getByRole('button', { name: /save and continue/i }).count() > 0);

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

    // Extract and return the notification ID (CDP format)
    const notificationIdText = await this.page.getByRole('paragraph')
      .filter({ hasText: 'Keep a note of your CDP' })
      .getByRole('strong')
      .textContent();
    return notificationIdText?.trim();
  }

  async returnToDashboard() {
    await this.page.getByRole('link', { name: /dashboard/i })
      .or(this.page.getByRole('link', { name: /return to dashboard/i }))
      .click();
  }

  // Helper function to convert CDP notification ID to CHED reference
  // Matches the logic in trade-demo-backend generateChedReference()
  generateChedReference(notificationId) {
    // Parse notification ID: CDP.2025.12.05.6
    const parts = notificationId.split('.');

    if (parts.length !== 5) {
      throw new Error(
        `Invalid notification ID format. Expected: CDP.YYYY.MM.DD.S, got: ${notificationId}`
      );
    }

    const year = parts[1];      // 2025
    const month = parts[2];     // 12
    const day = parts[3];       // 05
    const sequence = parts[4];  // 6

    // Pad sequence to 4 digits: 6 -> 0600
    const paddedSequence = (parseInt(sequence) * 100).toString().padStart(4, '0');

    // Build CHED reference: CHEDA.2025.12050600
    return `CHEDA.${year}.${month}${day}${paddedSequence}`;
  }
}
