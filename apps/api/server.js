const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { match_locations } = require("./match_locations");
const { generateChatResponse } = require("./src/services/llm");
const { searchPlacesByFilter } = require("./src/services/googlePlaces");
const { db } = require("./firebase");

const app = express();
const PORT = process.env.PORT || 4000;
const STALE_THRESHOLD_MS = 60 * 60 * 1000;
const MATCH_DISTANCE_KM = 0.15;

app.use(cors());
app.use(express.json());

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getLocationTimestamp(location) {
  return location.updated_at || location.last_called || location.created_at || null;
}

function getMarkerStatus(location) {
  if (!location) {
    return "missing";
  }

  const timestamp = getLocationTimestamp(location);
  if (!timestamp) {
    return "stale";
  }

  const ageMs = Date.now() - new Date(timestamp).getTime();
  return ageMs <= STALE_THRESHOLD_MS ? "fresh" : "stale";
}

function findMatchingStoredLocation(place, storedLocations) {
  if (place.placeId) {
    const byPlaceId = storedLocations.find(
      (location) => location.google_place_id === place.placeId,
    );
    if (byPlaceId) {
      return byPlaceId;
    }
  }

  const normalizedPlaceAddress = normalizeAddress(place.address);
  if (normalizedPlaceAddress) {
    const byAddress = storedLocations.find(
      (location) => normalizeAddress(location.address) === normalizedPlaceAddress,
    );
    if (byAddress) {
      return byAddress;
    }
  }

  if (place.latitude == null || place.longitude == null) {
    return null;
  }

  return (
    storedLocations.find((location) => {
      if (location.latitude == null || location.longitude == null) {
        return false;
      }

      return (
        haversineKm(
          place.latitude,
          place.longitude,
          location.latitude,
          location.longitude,
        ) <= MATCH_DISTANCE_KM
      );
    }) ?? null
  );
}

async function getStoredLocations() {
  const snapshot = await db.collection("locations").get();
  return snapshot.docs.map((doc) => doc.data());
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/message", (_req, res) => {
  res.json({ message: "Hello from Express" });
});

app.post("/api/chat", async (req, res) => {
  const { message, language } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "A non-empty 'message' string is required.",
    });
  }

  if (language != null && (typeof language !== "string" || !language.trim())) {
    return res.status(400).json({
      error: "'language' must be a non-empty string when provided.",
    });
  }

  if (language != null && (typeof language !== "string" || !language.trim())) {
    return res.status(400).json({
      error: "'language' must be a non-empty string when provided.",
    });
  }

  try {
    const chat = await generateChatResponse({
      message: message.trim(),
      language: language?.trim(),
    });

    return res.status(200).json(chat);
  } catch (error) {
    console.error("Chat request failed:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to generate chat response.",
    });
  }
});

app.get("/api/places", async (req, res) => {
  try {
    const results = await searchPlacesByFilter({
      latitude: req.query.latitude,
      longitude: req.query.longitude,
      radius: req.query.radius,
      filter: req.query.filter,
      isFood: req.query.isFood,
      isHome: req.query.isHome,
    });

    const count = Object.values(results).reduce(
      (total, entries) => total + entries.length,
      0,
    );

    return res.json({ count, results });
  } catch (error) {
    const statusCode =
      error.message === "GOOGLE_MAPS_API_KEY is not configured." ? 500 : 400;

    return res.status(statusCode).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
// Locations CRUD
app.get("/api/locations", async (_req, res) => {
  const locations = await getStoredLocations();
  res.json(locations);
});

app.get("/api/locations/shelters/nearby", async (req, res) => {
  try {
    const places = await searchPlacesByFilter({
      latitude: req.query.latitude,
      longitude: req.query.longitude,
      radius: req.query.radius,
      isFood: false,
      isHome: true,
    });

    const shelters = places.housing ?? [];
    const storedLocations = await getStoredLocations();

    const results = shelters.map((shelter) => {
      const storedLocation = findMatchingStoredLocation(shelter, storedLocations);
      const status = getMarkerStatus(storedLocation);

      return {
        name: shelter.name,
        placeId: shelter.placeId,
        latitude: shelter.latitude,
        longitude: shelter.longitude,
        address: shelter.address,
        phoneNumber: shelter.phoneNumber,
        markerStatus: status,
        markerColor:
          status === "fresh"
            ? "#4CAF50"
            : status === "stale"
              ? "#F4B942"
              : "#9CA3AF",
        markerStatusLabel:
          status === "fresh"
            ? "Up to date"
            : status === "stale"
              ? "Updated >1 hr ago"
              : "No data",
        backendLocation: storedLocation
          ? {
            id: storedLocation.id ?? null,
            name: storedLocation.name ?? null,
            address: storedLocation.address ?? null,
            phone: storedLocation.phone ?? null,
            updated_at: storedLocation.updated_at ?? null,
            last_called: storedLocation.last_called ?? null,
            space_available: storedLocation.space_available ?? null,
          }
          : null,
      };
    });

    return res.json({
      count: results.length,
      results,
    });
  } catch (error) {
    const statusCode =
      error.message === "GOOGLE_MAPS_API_KEY is not configured." ? 500 : 400;

    return res.status(statusCode).json({ error: error.message });
  }
});

app.get("/api/locations/:id", async (req, res) => {
  const doc = await db.collection("locations").doc(req.params.id).get();
  if (!doc.exists) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(doc.data());
});

app.post("/api/locations", async (req, res) => {
  const { name, address, phone, latitude, longitude, google_place_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const ref = db.collection("locations").doc();
  const now = new Date().toISOString();
  const location = {
    id: ref.id,
    name,
    address: address ?? null,
    phone: phone ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    google_place_id: google_place_id ?? null,
    last_called: null,
    space_available: null,
    created_at: now,
    updated_at: now,
  };

  await ref.set(location);
  res.status(201).json(location);
});

app.put("/api/locations/:id", async (req, res) => {
  const ref = db.collection("locations").doc(req.params.id);
  const doc = await ref.get();

  if (!doc.exists) {
    return res.status(404).json({ error: "Not found" });
  }

  const { name, address, phone, latitude, longitude, google_place_id } = req.body;
  const updates = { updated_at: new Date().toISOString() };

  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (phone !== undefined) updates.phone = phone;
  if (latitude !== undefined) updates.latitude = latitude;
  if (longitude !== undefined) updates.longitude = longitude;
  if (google_place_id !== undefined) updates.google_place_id = google_place_id;

  await ref.update(updates);
  res.json((await ref.get()).data());
});

app.delete("/api/locations/:id", async (req, res) => {
  const ref = db.collection("locations").doc(req.params.id);
  const doc = await ref.get();

  if (!doc.exists) {
    return res.status(404).json({ error: "Not found" });
  }

  await ref.delete();
  res.status(204).end();
});

app.post("/api/match-locations", async (req, res) => {
  const { google_places_locs, person, forceCall } = req.body;
  if (
    !google_places_locs ||
    typeof google_places_locs.results !== "object" ||
    !person?.message
  ) {
    return res.status(400).json({
      error:
        "google_places_locs ({ count, results: { house?, food? } }) and person.message are required",
    });
  }

  try {
    const result = await match_locations(google_places_locs, person, {
      forceCall: forceCall === true,
    });
    res.json(result);
  } catch (err) {
    console.error("match_locations error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/generate-outline", async (req, res) => {
  const OpenAI = require("openai");
  const { matchResult, person } = req.body;

  if (!matchResult || !person?.message) {
    return res.status(400).json({
      error:
        "matchResult (from /api/match-locations) and person.message are required",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { locations = [], no_phone = [] } = matchResult;
    console.log("[generate-outline] received locations count:", locations.length, "no_phone count:", no_phone.length);
    console.log("[generate-outline] transcript presence per location:", locations.map(l => ({ name: l.name, hasTranscript: !!l.transcript, transcriptType: typeof l.transcript, call_status: l.call_status })));
    const allLocations = [...locations, ...no_phone];
    console.log("[generate-outline] allLocations count:", allLocations.length);

    if (!allLocations.length) {
      return res.json({
        outline: "No locations available to generate an outline.",
      });
    }

    const transcriptToText = (transcript) => {
      console.log("[transcriptToText] input type:", typeof transcript, "value:", transcript === null ? "null" : transcript === undefined ? "undefined" : Array.isArray(transcript) ? `array[${transcript.length}]` : String(transcript).slice(0, 80));
      if (!transcript) return "None";
      if (typeof transcript === "string") return transcript;
      if (Array.isArray(transcript)) {
        const lines = transcript
          .map((entry) => {
            const speaker =
              entry && typeof entry === "object" && typeof entry.user === "string"
                ? entry.user
                : "unknown";
            const text =
              entry && typeof entry === "object" && typeof entry.text === "string"
                ? entry.text
                : "";
            return `${speaker}: ${text}`.trim();
          })
          .filter(Boolean);
        return lines.length ? lines.join("\n") : JSON.stringify(transcript);
      }
      return JSON.stringify(transcript);
    };

    const getQuestionLabels = (category) => {
      if (category === "food") {
        return {
          q1: "What food is available?",
          q2: "When should I come?",
        };
      }
      return {
        q1: "How many beds are available?",
        q2: "What time should they arrive for best chance of getting a bed?",
      };
    };

    const locationDetails = allLocations
      .map((loc) => {
        const isFood = loc.category === "food";
        const status = loc.call_status === "no_phone"
          ? "No phone number available"
          : isFood
            ? (loc.question_1_answer ?? "Food availability unknown")
            : loc.space_available === true
              ? "Has space available"
              : loc.space_available === false
                ? "No space available"
                : "Availability unknown";

        const questionLabels = getQuestionLabels(loc.category);

        return `### ${loc.name}
- Address: ${loc.address ?? "Unknown"}
- Phone: ${loc.phone ?? "N/A"}
- Category: ${loc.category ?? "Unknown"}
- Status: ${status}
- Question 1 (${questionLabels.q1}): ${loc.question_1_answer ?? "Unknown"}
- Question 2 (${questionLabels.q2}): ${loc.question_2_answer ?? "Unknown"}
- Requirements: ${loc.requirements ?? "None listed"}
- Check-in Info: ${loc.checkin_info ?? "Not provided"}
- Notes: ${loc.relevant_notes ?? "None"}
- Transcript:
${transcriptToText(loc.transcript)}`;
      })
      .join("\n\n");

    const systemPrompt = `You help connect people experiencing homelessness to shelter and food.
Write a single, plain paragraph (2-4 sentences) telling the person what you found.
Be direct and warm. Include only facts from the provided data — beds/food available, arrival time, requirements, check-in info.
Do not use bullet points, headers, or JSON. Just a paragraph of plain text.`;

    const userPrompt = `Person: ${person.name ?? "someone"}, ${person.gender ?? ""}, needs: ${person.message}

${locationDetails}

Write one paragraph summarizing what is available and what they should do.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const message = completion.choices[0].message.content?.trim() ?? "I found some options nearby. Please call ahead to confirm availability.";
    console.log("[generate-outline] message:", message);
    return res.json({ outline: message });
  } catch (err) {
    console.error("generate-outline error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  // Returns something like this
  //   "outline": {
  //     "summary": "Overview of options",
  //     "recommendations": [
  //       {
  //         "location_name": "Shelter A",
  //         "reason": "Why it's a good fit",
  //         "action": "What to do next"
  //       },
  //       {
  //         "location_name": "Shelter B",
  //         "reason": "Why it's a good fit",
  //         "action": "What to do next"
  //       }
  //     ],
  //     "general_notes": "Tips for the person"
  //   }
  // }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
