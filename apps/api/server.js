const express = require("express");
const cors = require("cors");
require("dotenv").config();
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
  const { google_places_locs, person } = req.body;
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
    const result = await match_locations(google_places_locs, person);
    res.json(result);
  } catch (err) {
    console.error("match_locations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
