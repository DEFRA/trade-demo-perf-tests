// Test Data Module
// Provides static test data and randomization helpers for K6 performance tests

// =============================================================================
// GEOGRAPHIC DATA
// =============================================================================

/**
 * EU and international country codes
 * Mix of EU member states and third countries for realistic testing
 */
export const countryCodes = [
  // EU Member States
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Third Countries
  'US', 'CS', 'AU', 'NZ', 'NO', 'CH', 'IS', 'JP', 'CN', 'IN',
  'BR', 'AR', 'ZA'
];

/**
 * Country code frequency weights for more realistic distribution
 * Higher numbers = more frequent selection (simulates real-world patterns)
 */
export const countryWeights = {
  'FR': 15,  // France - high volume
  'DE': 15,  // Germany - high volume
  'NL': 12,  // Netherlands - high volume
  'IE': 10,  // Ireland - high volume
  'ES': 8,   // Spain - medium volume
  'IT': 8,   // Italy - medium volume
  'BE': 7,   // Belgium - medium volume
  'PL': 5,   // Poland - medium volume
  'US': 4,   // United States - lower volume
  'AU': 3,   // Australia - lower volume
  // Others default to weight of 1
};

/**
 * UK Border Control Posts with codes
 * Format matches frontend autocomplete: "Name - Code"
 *
 * NOTE: Locally, the BCP API may return empty results if the backend
 * doesn't have access to the BCP data source. In deployed environments,
 * the backend connects to a real service that provides BCP data.
 *
 * These BCPs use realistic UK port codes for performance testing.
 */
export const borderControlPosts = [
  { name: 'Port of Dover (Eastern)', code: 'GBDOVE2', display: 'Port of Dover (Eastern) - GBDOVE2' },
  { name: 'Holyhead Port (undesignated)', code: 'GBHLY4PP', display: 'Holyhead Port (undesignated) - GBHLY4PP' },
  { name: 'Portsmouth International Port', code: 'GBPME2PP', display: 'Portsmouth International Port - GBPME2PP' },
  { name: 'Folkstone', code: 'GBFOL4PP', display: 'Folkestone - GBFOL4PP' },
  { name: 'Associated British Ports - Hull', code: 'GBHLL4PP', display: 'associated British Ports - Hull - GBHLL4PP' },
  { name: 'Grimsby and Immingham', code: 'GBIMM4PP', display: 'Grimsby and Immingham - GBIMM4PP' },
  { name: 'Port of Felixstowe', code: 'GBFXT1PP', display: 'Port of Felixstowe - GBFXT1PP' },
  { name: 'Southampton', code: 'GBSOU1', display: 'Southampton - GBSOU1' },
  { name: 'Heathrow Airport', code: 'GBLHR4PP', display: 'Heathrow Airport - GBLHR4PP' },
  { name: 'Gatwick Airport', code: 'GBGLW4PP', display: 'Gatwick Airport - GBLGW4PP' },
  { name: 'Manchester Airport', code: 'GBMNC4PP', display: 'Manchester Airport - GBMNC4PP' }
];

// =============================================================================
// BUSINESS PURPOSE DATA
// =============================================================================

/**
 * Internal market purposes for imported goods
 */
export const internalMarketPurposes = [
  'Commercial Sale',
  'Rescue',
  'Breeding',
  'Research',
  'Racing or Competition',
  'Companion Animal not for Resale or Rehoming',
  'Production',
  'Slaughter',
  'Fattening',
  'Game Restocking'
];

/**
 * Main reasons for import
 */
export const importReasons = {
  internalMarket: 'internalmarket',
  transhipment: 'transhipment',
  transit: 'transit'
};

// =============================================================================
// COMMODITY DATA
// =============================================================================

export const commodities = [
  {
    code: '0101',
    description: '0101 - Live horses, asses, mules and hinnies',
    species: {
      domestic: {
        id: '1347323',
        type: 'Domestic',
        name: 'Equus asinus'
      }
    },
    // Realistic quantity ranges
    quantityRanges: {
      animals: { min: 1, max: 500 },
      packs: { min: 1, max: 50 }
    }
  },
  {
    code: '0102',
      description: '0102 - Live bovine animals',
      species: {
      domestic: {
        id: '716661',
        type: 'Domestic',
        name: 'Bison bison'
      }
    },
    // Realistic quantity ranges
    quantityRanges: {
      animals: { min: 1, max: 500 },
      packs: { min: 1, max: 50 }
    }
  },
  {
    code: '0103',
      description: '0103 - Live swine',
      species: {
      domestic: {
        id: '1048450',
        type: 'Domestic',
        name: 'Potamochoerus spp.'
      }
    },
    quantityRanges: {
      animals: { min: 1, max: 1000 },
      packs: { min: 1, max: 100 }
    }
  },
  {
    code: '010410',
      description: '010410 - Sheep',
      species: {
      domestic: {
        id: '1148505',
        type: 'Domestic',
        name: 'Ovis aries'
      }
    },
    quantityRanges: {
      animals: { min: 1, max: 800 },
      packs: { min: 1, max: 80 }
    }
  },
  {
    code: '010420',
    description: '010420 - Goats',
    species: {
      domestic: {
        id: '1576160',
        type: 'Domestic',
        name: 'Capra hircus'
      }
    },
    quantityRanges: {
      animals: { min: 1, max: 800 },
      packs: { min: 1, max: 80 }
    }
  },
  {
    code: '01059400',
      description: '01059400 - Fowls of the species Gallus domesticus',
      species: {
      domestic: {
        id: '1319068',
          type: 'Domestic',
          name: 'Gallus domesticus'
      }
    },
    quantityRanges: {
      animals: { min: 100, max: 10000 },
      packs: { min: 10, max: 500 }
    }
  }
];


// =============================================================================
// TRANSPORT DATA
// =============================================================================

/**
 * Means of transport types
 */
export const transportTypes = [
  'Road vehicle',
  'Railway',
  'Airplane',
  'Vessel'
];

/**
 * Vehicle identifier prefixes by transport type
 */
export const vehicleIdPrefixes = {
  'Road vehicle': ['GB', 'FR', 'DE', 'NL', 'ES', 'IT', 'PL', 'RO'],
  'Railway': ['RAIL'],
  'Airplane': ['BA', 'EZY', 'RYR', 'LH', 'AF'],
  'Vessel': ['MV', 'HMS', 'SS']
};

// =============================================================================
// RANDOMIZATION HELPERS
// =============================================================================

/**
 * Get a random item from an array
 * @param {Array} array - Array to select from
 * @returns {*} Random item from array
 */
export function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random country code with optional weighted distribution
 * @param {boolean} useWeights - Whether to use frequency weights
 * @returns {string} Country code
 */
export function getRandomCountry(useWeights = false) {
  if (!useWeights) {
    return getRandomItem(countryCodes);
  }

  // Weighted random selection
  const weightedCountries = [];
  countryCodes.forEach(code => {
    const weight = countryWeights[code] || 1;
    for (let i = 0; i < weight; i++) {
      weightedCountries.push(code);
    }
  });

  return getRandomItem(weightedCountries);
}

/**
 * Get a random internal market purpose
 * @returns {string} Purpose
 */
export function getRandomPurpose() {
  return getRandomItem(internalMarketPurposes);
}

/**
 * Get a random border control post
 * @param {boolean} displayFormat - If true, returns "Name - Code" format, otherwise returns name only
 * @returns {string} BCP in the specified format
 */
export function getRandomBCP(displayFormat = true) {
  const bcp = getRandomItem(borderControlPosts);
  return displayFormat ? bcp.display : bcp.name;
}

/**
 * Get a random transport type
 * @returns {string} Transport type
 */
export function getRandomTransportType() {
  return getRandomItem(transportTypes);
}

/**
 * Get a random commodity
 * @returns {Object} Commodity object with code, description, and species
 */
export function getRandomCommodity() {
  const commodityKeys = Object.keys(commodities);
  const randomKey = getRandomItem(commodityKeys);
  return commodities[randomKey];
}

// =============================================================================
// DATA GENERATORS
// =============================================================================

/**
 * Generate a random alphanumeric string
 * @param {number} length - Length of string to generate
 * @returns {string} Random uppercase alphanumeric string
 */
export function generateRandomString(length = 10) {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Generate a realistic vehicle identifier based on transport type
 * @param {string} transportType - Type of transport
 * @returns {string} Vehicle identifier
 */
export function generateVehicleId(transportType) {
  const prefixes = vehicleIdPrefixes[transportType] || ['XX'];
  const prefix = getRandomItem(prefixes);

  switch (transportType) {
    case 'Road vehicle':
      // Format: GB12ABC or GB12 ABC (UK-style registration)
      return `${prefix}${Math.floor(Math.random() * 100)}${generateRandomString(3)}`;
    case 'Airplane':
      // Format: BA123 (airline code + flight number)
      return `${prefix}${Math.floor(100 + Math.random() * 9900)}`;
    case 'Vessel':
      // Format: MV SHIP-NAME
      return `${prefix} ${generateRandomString(6)}`;
    case 'Railway':
      // Format: RAIL-12345
      return `${prefix}-${Math.floor(10000 + Math.random() * 90000)}`;
    default:
      return generateRandomString(8);
  }
}

/**
 * Generate a random quantity within a commodity's valid range
 * @param {Object} commodity - Commodity object with quantityRanges
 * @param {string} type - 'animals' or 'packs'
 * @returns {number} Random quantity
 */
export function generateQuantity(commodity, type = 'animals') {
  const range = commodity.quantityRanges[type];
  if (!range) {
    return Math.floor(Math.random() * 100) + 1;
  }

  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

/**
 * Generate a complete test data set for an import notification journey
 * @param {Object} options - Configuration options
 * @param {boolean} options.useWeightedCountries - Use weighted country distribution
 * @param {Object} options.specificCommodity - Use specific commodity instead of random
 * @returns {Object} Complete test data set
 */
export function generateImportNotificationData(options = {}) {
  const {
    useWeightedCountries = false,
    specificCommodity = null
  } = options;

  const commodity = specificCommodity || getRandomCommodity();
  const transportType = getRandomTransportType();

  return {
    // Origin
    countryCode: getRandomCountry(useWeightedCountries),

    // Commodity
    commodity: {
      code: commodity.code,
      description: commodity.description,
      speciesId: commodity.species.domestic.id,
      speciesType: commodity.species.domestic.type,
      animals: generateQuantity(commodity, 'animals'),
      packs: generateQuantity(commodity, 'packs')
    },

    // Purpose
    purpose: importReasons.internalMarket,
    internalMarketPurpose: getRandomPurpose(),

    // Transport
    transport: {
      type: transportType,
      bcp: getRandomBCP(true), // Use "Name - Code" display format
      vehicleId: generateVehicleId(transportType)
    }
  };
}

// =============================================================================
// EXPORT DEFAULT FOR CONVENIENCE
// =============================================================================

export default {
  // Data
  countryCodes,
  countryWeights,
  borderControlPosts,
  internalMarketPurposes,
  importReasons,
  commodities,
  transportTypes,

  // Helpers
  getRandomItem,
  getRandomCountry,
  getRandomPurpose,
  getRandomBCP,
  getRandomTransportType,
  getRandomCommodity,

  // Generators
  generateRandomString,
  generateVehicleId,
  generateQuantity,
  generateImportNotificationData
};
