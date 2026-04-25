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

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
