// CommodityPage - Commodity code search and selection

import { getWithValidation, extractCrumbOrThrow } from '../utils/http-utils.js';

export class CommodityPage {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.codesUrl = `${baseUrl}/import/commodity/codes`;
  }

  /**
   * Search for commodity code
   * @param {string} crumb - CSRF token
   * @param {string} commodityCode - Commodity code to search (e.g., '0102')
   * @returns {string} New CSRF crumb token
   * @throws {TestingError} If search fails or crumb not found
   */
  searchCode(crumb, commodityCode) {
    console.log('==== Selecting Commodity Codes...');

    const searchUrl = `${this.codesUrl}/search?crumb=${encodeURIComponent(crumb)}&commodity-code=${commodityCode}`;

    const response = getWithValidation(
      searchUrl,
      {
        'Commodity Codes Searched': (r) =>
          r.status === 200 && r.url === searchUrl
      },
      'Commodity Code search failed',
      { tags: { name: 'CommodityCodeSelection' } }
    );

    return extractCrumbOrThrow(response, 'Commodity code search');
  }

  /**
   * Select commodity species
   * @param {string} crumb - CSRF token
   * @param {string} commodityType - Type of commodity (e.g., 'Domestic', 'Wild')
   * @param {string} speciesId - Species identifier
   * @returns {string} New CSRF crumb token
   * @throws {TestingError} If selection fails or crumb not found
   */
  selectSpecies(crumb, commodityType, speciesId) {
    console.log('==== Selecting Commodity Species...');

    const selectUrl = `${this.codesUrl}/select?crumb=${encodeURIComponent(crumb)}&commodityType=${commodityType}&species=${speciesId}`;

    const response = getWithValidation(
      selectUrl,
      {
        'Commodity Species Selected': (r) =>
          r.status === 200 && r.url.endsWith('/import/commodity/codes/quantities')
      },
      'Commodity Species Selection failed',
      { tags: { name: 'SelectCommoditySpecies' } }
    );

    return extractCrumbOrThrow(response, 'Commodity species selection');
  }

  /**
   * Save commodity quantities
   * @param {string} crumb - CSRF token
   * @param {string} speciesId - Species identifier
   * @param {number} numberOfAnimals - Number of animals
   * @param {number} numberOfPacks - Number of packs
   * @returns {string} New CSRF crumb token
   * @throws {TestingError} If save fails or crumb not found
   */
  saveQuantities(crumb, speciesId, numberOfAnimals, numberOfPacks) {
    console.log('==== Selecting Commodity Quantities...');

    const saveUrl = `${this.codesUrl}/quantities/save?crumb=${encodeURIComponent(crumb)}&${speciesId}-noOfAnimals=${numberOfAnimals}&${speciesId}-noOfPacks=${numberOfPacks}`;

    const response = getWithValidation(
      saveUrl,
      {
        'Commodity Quantities Saved': (r) =>
          r.status === 200 && r.url.endsWith('/import/consignment/purpose')
      },
      'Saving the Commodity Quantities failed',
      { tags: { name: 'SaveCommodityQuantities' } }
    );

    return extractCrumbOrThrow(response, 'Commodity quantities save');
  }

  /**
   * Navigate to change commodity codes (from review page)
   * @param {string} crumb - CSRF token
   * @returns {string} New CSRF crumb token
   * @throws {TestingError} If navigation fails or crumb not found
   */
  change(crumb) {
    console.log('==== Changing Commodity Quantities...');

    const changeUrl = `${this.codesUrl}?crumb=${encodeURIComponent(crumb)}`;

    const response = getWithValidation(
      changeUrl,
      {
        'Commodity Codes Changed': (r) =>
          r.status === 200 && r.url.endsWith('/import/commodity/codes/quantities')
      },
      'Changing the Commodity Codes failed',
      { tags: { name: 'ChangeCommodityCode' } }
    );

    return extractCrumbOrThrow(response, 'Commodity codes change');
  }
}
