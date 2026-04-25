const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const MAX_RESULTS_PER_CATEGORY = 8;

const FILTER_CONFIG = {
  housing: {
    mode: "text",
    queries: [
      "homeless shelter",
      "emergency shelter",
      "women's shelter",
      "men's shelter",
      "family shelter",
      "youth shelter",
    ],
  },
  food_shelter: {
    mode: "text",
    queries: [
      "food bank",
      "soup kitchen",
      "free meal center",
      "homeless shelter meal service",
      "community meal program",
    ],
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

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    name: place.displayName?.text ?? place.name ?? null,
    placeId: place.id ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    address: place.formattedAddress ?? null,
    phoneNumber:
      place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
  };
}

function isWithinRadius(place, latitude, longitude, radius) {
  if (place.latitude == null || place.longitude == null) {
    return false;
  }

  return (
    haversineMeters(latitude, longitude, place.latitude, place.longitude) <=
    radius
  );
}

function distanceFromCenter(place, latitude, longitude) {
  if (place.latitude == null || place.longitude == null) {
    return Number.POSITIVE_INFINITY;
  }

  return haversineMeters(latitude, longitude, place.latitude, place.longitude);
}

async function searchHousing({ latitude, longitude, radius }) {
  const resultsById = new Map();

  for (const textQuery of FILTER_CONFIG.housing.queries) {
    const response = await callPlacesApi("/places:searchText", {
      fieldMask:
        "places.id,places.displayName,places.location,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber",
      body: {
        textQuery,
        pageSize: 10,
        locationRestriction: {
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

      const mappedPlace = mapPlace(place);
      if (!isWithinRadius(mappedPlace, latitude, longitude, radius)) {
        continue;
      }

      resultsById.set(place.id, mappedPlace);
    }
  }

  return Array.from(resultsById.values())
    .sort(
      (a, b) =>
        distanceFromCenter(a, latitude, longitude) -
        distanceFromCenter(b, latitude, longitude),
    )
    .slice(0, MAX_RESULTS_PER_CATEGORY);
}

async function searchFoodShelter({ latitude, longitude, radius }) {
  const resultsById = new Map();

  for (const textQuery of FILTER_CONFIG.food_shelter.queries) {
    const response = await callPlacesApi("/places:searchText", {
      fieldMask:
        "places.id,places.displayName,places.location,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber",
      body: {
        textQuery,
        pageSize: 10,
        locationRestriction: {
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

      const mappedPlace = mapPlace(place);
      if (!isWithinRadius(mappedPlace, latitude, longitude, radius)) {
        continue;
      }

      resultsById.set(place.id, mappedPlace);
    }
  }

  return Array.from(resultsById.values())
    .sort(
      (a, b) =>
        distanceFromCenter(a, latitude, longitude) -
        distanceFromCenter(b, latitude, longitude),
    )
    .slice(0, MAX_RESULTS_PER_CATEGORY);
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return value.toLowerCase() === "true";
}

async function searchPlacesByFilter(params) {
  const latitude = parseCoordinate(params.latitude, "latitude");
  const longitude = parseCoordinate(params.longitude, "longitude");
  const radius = validateRadius(params.radius);
  const requestedFood = parseBoolean(params.isFood);
  const requestedHousing = parseBoolean(params.isHome);
  const wantsFood = requestedFood || (!requestedFood && !requestedHousing);
  const wantsHousing =
    requestedHousing || (!requestedFood && !requestedHousing);

  const res = { food: [], housing: [] };
  if (wantsFood) {
    res.food = await searchFoodShelter({ latitude, longitude, radius });
  }
  if (wantsHousing) {
    res.housing = await searchHousing({ latitude, longitude, radius });
  }

  return res;
}

module.exports = {
  searchPlacesByFilter,
};
