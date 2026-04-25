const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { generateChatResponse } = require("./src/services/llm");
const { searchPlacesByFilter } = require("./src/services/googlePlaces");
const { db } = require("./firebase");
const { match_locations } = require("./match_locations");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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
  // expecting these params in req:
  // const latitude = parseCoordinate(params.latitude, "latitude");
  // const longitude = parseCoordinate(params.longitude, "longitude");
  // const radius = validateRadius(params.radius);
  // const isFood = params.isFood;
  // const isHome = params.isHome;
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

    res.json({ count, results });
  } catch (error) {
    const statusCode =
      error.message === "GOOGLE_MAPS_API_KEY is not configured." ? 500 : 400;
    res.status(statusCode).json({ error: error.message });
  }
  // res will look like
  // { count: number; results: {
  //   "housing": {
  //     name: place.displayName?.text ?? place.name ?? null,
  //     placeId: place.id ?? null,
  //     latitude: place.location?.latitude ?? null,
  //     longitude: place.location?.longitude ?? null,
  //     address: place.formattedAddress ?? null,
  //     phoneNumber:
  //       place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
  //   }[],
  //   "food": {
  //     name: place.displayName?.text ?? place.name ?? null,
  //     placeId: place.id ?? null,
  //     latitude: place.location?.latitude ?? null,
  //     longitude: place.location?.longitude ?? null,
  //     address: place.formattedAddress ?? null,
  //     phoneNumber:
  //       place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
  //   }[]
  // }}
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
// Locations CRUD
app.get("/api/locations", async (_req, res) => {
  const snap = await db.collection("locations").get();
  res.json(snap.docs.map((d) => d.data()));
});

app.get("/api/locations/:id", async (req, res) => {
  const doc = await db.collection("locations").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Not found" });
  res.json(doc.data());
});

app.post("/api/locations", async (req, res) => {
  const { name, address, phone, latitude, longitude } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const ref = db.collection("locations").doc();
  const now = new Date().toISOString();
  const location = {
    id: ref.id,
    name,
    address: address ?? null,
    phone: phone ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    google_place_id: null,
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
  if (!doc.exists) return res.status(404).json({ error: "Not found" });
  const { name, address, phone, latitude, longitude } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (phone !== undefined) updates.phone = phone;
  if (latitude !== undefined) updates.latitude = latitude;
  if (longitude !== undefined) updates.longitude = longitude;
  await ref.update(updates);
  res.json((await ref.get()).data());
});

app.delete("/api/locations/:id", async (req, res) => {
  const ref = db.collection("locations").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: "Not found" });
  await ref.delete();
  res.status(204).end();
});

// match_locations — core ShelterFlow matching endpoint
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate personalized outline describing how each location relates to user needs
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
    const allLocations = [...locations, ...no_phone];

    if (!allLocations.length) {
      return res.json({
        outline: "No locations available to generate an outline.",
      });
    }

    // Build location details for the prompt
    const locationDetails = allLocations
      .map((loc) => {
        const status =
          loc.call_status === "no_phone"
            ? "No phone number available"
            : loc.space_available === true
              ? "Has space available"
              : loc.space_available === false
                ? "No space available"
                : "Availability unknown";
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

    const systemPrompt = `You are a helpful assistant that creates personalized outlines for people experiencing homelessness.
Given a list of shelter locations with their availability and details, create a clear, compassionate outline that explains how each location relates to the person's specific needs.
You must explicitly answer:
1) "How many beds are available?"
2) "What time should they arrive for best chance of getting a bed?"
If the data is missing, clearly say "Unknown".
Always respond with valid JSON only — no markdown, no explanation.`;

    const userPrompt = `Person seeking shelter:
- Name: ${person.name ?? "Unknown"}
- Gender: ${person.gender ?? "Not specified"}
- Specific needs/message: ${person.message}
- Current location: ${person.current_location ?? "Unknown"}

Available locations:
${locationDetails}

Return a JSON object with this structure:
{
  "summary": "A brief overview of the options available",
  "recommendations": [
    {
      "location_name": string,
      "reason": "Why this location is a good fit for the person's needs",
      "action": "What the person should do next, and include direct answers to: (1) How many beds are available? (2) What time should they arrive for best chance of getting a bed? If unknown, say Unknown."
    }
  ],
  "general_notes": "Any helpful tips or information for the person"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json({ outline: parsed });
  } catch (err) {
    console.error("generate-outline error:", err);
    res.status(500).json({ error: "Internal server error" });
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
