const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { searchPlacesByFilter } = require("./src/services/googlePlaces");

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
    });

    res.json({
      count: results.length,
      results,
    });
    // res will look like
    // { count: number; results: {
    //   "house": {
    //     latitude: place.location?.latitude ?? null,
    //     longitude: place.location?.longitude ?? null,
    //     address: place.formattedAddress ?? null,
    //     phoneNumber:
    //       place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    //   }[],
    //   "food": {
    //     latitude: place.location?.latitude ?? null,
    //     longitude: place.location?.longitude ?? null,
    //     address: place.formattedAddress ?? null,
    //     phoneNumber:
    //       place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    //   }[]
    // }}
  } catch (error) {
    const statusCode =
      error.message === "GOOGLE_MAPS_API_KEY is not configured." ? 500 : 400;

    res.status(statusCode).json({
      error: error.message,
    });
  }
});


// Locations
app.get("/api/locations", (_req, res) => {
  const locations = db.prepare("SELECT * FROM locations").all();
  res.json(locations);
});

app.get("/api/locations/:id", (req, res) => {
  const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(req.params.id);
  if (!location) return res.status(404).json({ error: "Not found" });
  res.json(location);
});

app.post("/api/locations", (req, res) => {
  const { name, address, phone, latitude, longitude } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const result = db
    .prepare(
      "INSERT INTO locations (name, address, phone, latitude, longitude) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, address ?? null, phone ?? null, latitude ?? null, longitude ?? null);
  const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(location);
});

app.put("/api/locations/:id", (req, res) => {
  const { name, address, phone, latitude, longitude } = req.body;
  const existing = db.prepare("SELECT * FROM locations WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  db.prepare(
    `UPDATE locations
     SET name = ?, address = ?, phone = ?, latitude = ?, longitude = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    address ?? existing.address,
    phone ?? existing.phone,
    latitude ?? existing.latitude,
    longitude ?? existing.longitude,
    req.params.id
  );
  const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(req.params.id);
  res.json(location);
});

// match_locations — core ShelterFlow matching endpoint
app.post("/api/match-locations", async (req, res) => {
  const { google_places_locs, person } = req.body;
  if (!Array.isArray(google_places_locs) || !person?.message) {
    return res.status(400).json({ error: "google_places_locs (array) and person.message are required" });
  }
  try {
    const result = await match_locations(google_places_locs, person);
    res.json(result);
  } catch (err) {
    console.error("match_locations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/locations/:id", (req, res) => {
  const result = db.prepare("DELETE FROM locations WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});