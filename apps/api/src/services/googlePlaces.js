const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

const FILTER_CONFIG = {
  housing: {
    mode: "nearby",
    includedTypes: [
      "apartment_building",
      "apartment_complex",
      "housing_complex",
      "lodging",
      "hostel",
    ],
  },
  food_shelter: {
    mode: "text",
    queries: ["food shelter", "homeless shelter", "food bank", "soup kitchen"],
  },
};

function parseCoordinate(value, name) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
}

function validateRadius(radius) {
  const parsed = Number(radius);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("radius must be a positive number in meters.");
  }

  return parsed;
}

function getApiKey() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }

  return process.env.GOOGLE_MAPS_API_KEY;
}

async function callPlacesApi(path, { method = "POST", body, fieldMask }) {
  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": fieldMask,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let details = "";

    try {
      const errorPayload = await response.json();
      details = errorPayload.error?.message || JSON.stringify(errorPayload);
    } catch (_error) {
      details = await response.text();
    }

    throw new Error(
      `Google Places API request failed with ${response.status}: ${details}`,
    );
  }

  return response.json();
}

function mapPlace(place) {
  return {
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    address: place.formattedAddress ?? null,
    phoneNumber:
      place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
  };
}

async function searchHousing({ latitude, longitude, radius }) {
  const response = await callPlacesApi("/places:searchNearby", {
    fieldMask:
      "places.id,places.location,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber",
    body: {
      includedTypes: FILTER_CONFIG.housing.includedTypes,
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
    },
  });

  return (response.places || []).map(mapPlace);
}

async function searchFoodShelter({ latitude, longitude, radius }) {
  const resultsById = new Map();

  for (const textQuery of FILTER_CONFIG.food_shelter.queries) {
    const response = await callPlacesApi("/places:searchText", {
      fieldMask:
        "places.id,places.location,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber",
      body: {
        textQuery,
        pageSize: 20,
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius,
          },
        },
      },
    });

    for (const place of response.places || []) {
      if (!place.id) {
        continue;
      }

      resultsById.set(place.id, mapPlace(place));
    }
  }

  return Array.from(resultsById.values());
}

async function searchPlacesByFilter(params) {
  const latitude = parseCoordinate(params.latitude, "latitude");
  const longitude = parseCoordinate(params.longitude, "longitude");
  const radius = validateRadius(params.radius);
  const isFood = params.isFood;
  const isHome = params.isHome;

  const res = { food: [], house: [] };
  if (isFood) {
    res.food = searchHousing({ latitude, longitude, radius });
  }
  if (isHome) {
    res.home = searchFoodShelter({ latitude, longitude, radius });
  }
}

module.exports = {
  searchPlacesByFilter,
};
