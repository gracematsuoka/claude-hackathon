/**
 * Mock test data for API testing
 */

// Single location in Ithaca, NY with phone number
const singleIthacaLocation = {
  count: 1,
  results: {
    housing: [
      {
        name: "Ithaca Shelter",
        placeId: "ChIJS5Z-123456789",
        latitude: 42.4406,
        longitude: -76.4961,
        address: "123 Shelter Lane, Ithaca, NY 14850",
        phoneNumber: "6262230129",
      },
    ],
    food: [],
  },
};

// Person object for testing
const testPerson = {
  name: "Test User",
  gender: "male",
  message: "Need shelter for tonight",
  current_location: "Ithaca, NY",
};

module.exports = {
  singleIthacaLocation,
  testPerson,
};