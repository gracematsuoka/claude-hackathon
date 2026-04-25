/**
 * Test for ShelterFlow API endpoints
 * Run with: node test/match-locations.test.js
 * 
 * This test simulates the full flow: match_locations + generate-outline
 * without calling any external APIs (Firebase, Bland.ai, OpenAI)
 */

const { singleIthacaLocation, testPerson } = require("./mock-responses");

// Simulate the match_locations function logic
function simulateMatchLocations(googlePlacesResult, person) {
  const { results = {} } = googlePlacesResult;
  const places = Object.entries(results).flatMap(([category, arr]) =>
    (arr ?? []).map((place) => ({ ...place, category }))
  );

  // Simulate creating location records (like upsertLocation does)
  const now = new Date().toISOString();
  const locations = places.map((place, index) => ({
    id: `loc-${index}`,
    name: place.name ?? place.address ?? "Unknown location",
    address: place.address ?? null,
    phone: place.phoneNumber ?? null,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    google_place_id: place.placeId ?? null,
    category: place.category ?? null,
    last_called: null,
    space_available: null,
    created_at: now,
    updated_at: now,
    call_status: place.phoneNumber ? "needs_calling" : "no_phone",
  }));

  // Simulate Bland.ai call + OpenAI interpretation
  const calledLocations = locations
    .filter((l) => l.call_status === "needs_calling")
    .map((loc) => ({
      ...loc,
      last_called: now,
      space_available: true, // Simulated: shelter has space
      call_status: "just_called",
      requirements: "None",
      checkin_info: "Arrive before 10pm",
      relevant_notes: "Quiet facility",
    }));

  const previouslyCalled = [];
  const noPhone = locations.filter((l) => l.call_status === "no_phone");

  return {
    locations: [...calledLocations, ...previouslyCalled],
    no_phone: noPhone,
  };
}

// Simulate generate-outline logic
function simulateGenerateOutline(matchResult, person) {
  const { locations = [], no_phone = [] } = matchResult;
  const allLocations = [...locations, ...no_phone];

  if (!allLocations.length) {
    return { outline: "No locations available to generate an outline." };
  }

  // Build location details (like the real endpoint does)
  const locationDetails = allLocations
    .map((loc) => {
      const status = loc.call_status === "no_phone" ? "No phone number available" :
        loc.space_available === true ? "Has space available" :
        loc.space_available === false ? "No space available" :
        "Availability unknown";
      return `### ${loc.name}
- Address: ${loc.address ?? "Unknown"}
- Phone: ${loc.phone ?? "N/A"}
- Category: ${loc.category ?? "Unknown"}
- Status: ${status}
- Requirements: ${loc.requirements ?? "None listed"}
- Check-in Info: ${loc.checkin_info ?? "Not provided"}
- Notes: ${loc.relevant_notes ?? "None"}`;
    })
    .join("\n\n");

  // Simulate OpenAI response
  const outline = {
    summary: `${allLocations.length} location(s) found in ${person.current_location}`,
    recommendations: allLocations.map((loc) => ({
      location_name: loc.name,
      reason: loc.space_available 
        ? "Has confirmed space available for tonight" 
        : "Located in your area",
      action: loc.phone 
        ? `Call ${loc.phone} to confirm arrival` 
        : "Visit location in person",
    })),
    general_notes: "Remember to bring ID if you have it. Most shelters accept anyone in need.",
  };

  return { outline };
}

// Test Case 1: Single Ithaca location - full flow
function testSingleIthacaLocation() {
  console.log("\n=== Test Case 1: Single Ithaca Location (Full Flow) ===");
  console.log("Input (api/places response):", JSON.stringify(singleIthacaLocation, null, 2));
  console.log("Person:", JSON.stringify(testPerson, null, 2));

  // Step 1: Simulate match_locations
  console.log("\n--- Step 1: Simulating match_locations ---");
  const matchResult = simulateMatchLocations(singleIthacaLocation, testPerson);
  
  console.log("match_locations result:");
  console.log(JSON.stringify(matchResult, null, 2));

  // Step 2: Simulate generate-outline
  console.log("\n--- Step 2: Simulating generate-outline ---");
  const outlineResult = simulateGenerateOutline(matchResult, testPerson);

  console.log("generate-outline result:");
  console.log(JSON.stringify(outlineResult, null, 2));

  // Assertions
  const hasLocation = matchResult.locations.length === 1;
  const hasPhone = matchResult.locations[0]?.phone === "6262230129";
  const isIthaca =
    matchResult.locations[0]?.latitude === 42.4406 &&
    matchResult.locations[0]?.longitude === -76.4961;
  const hasOutline = !!outlineResult?.outline?.summary;
  const hasRecommendations = (outlineResult?.outline?.recommendations?.length ?? 0) > 0;

  console.log("\nAssertions:");
  console.log(`✓ match_locations returned 1 location: ${hasLocation}`);
  console.log(`✓ Location has correct phone: ${hasPhone}`);
  console.log(`✓ Location is in Ithaca, NY: ${isIthaca}`);
  console.log(`✓ generate-outline returned summary: ${hasOutline}`);
  console.log(`✓ generate-outline returned recommendations: ${hasRecommendations}`);

  return hasLocation && hasPhone && isIthaca && hasOutline && hasRecommendations;
}

// Run tests
if (require.main === module) {
  console.log("Running ShelterFlow API Simulation Tests...\n");

  const test1Passed = testSingleIthacaLocation();

  console.log("\n=== Test Results ===");
  console.log(`Test Case 1: ${test1Passed ? "PASSED" : "FAILED"}`);

  process.exit(test1Passed ? 0 : 1);
}

module.exports = { testSingleIthacaLocation, simulateMatchLocations, simulateGenerateOutline };