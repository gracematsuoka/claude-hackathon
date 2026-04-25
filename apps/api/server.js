const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { generateChatResponse } = require("./src/services/llm");
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
