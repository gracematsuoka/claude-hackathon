const OpenAI = require("openai");
const db = require("./db");

const COORDINATE_THRESHOLD_KM = 0.1; // 100 meters

// ─── Geo helpers ─────────────────────────────────────────────────────────────

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

function isToday(datetimeStr) {
  if (!datetimeStr) return false;
  return new Date(datetimeStr).toDateString() === new Date().toDateString();
}

// ─── DB matching / upserting ──────────────────────────────────────────────────

function findMatchingLocation(googlePlace) {
  // 1. Match by google_place_id (most reliable)
  if (googlePlace.place_id) {
    const row = db
      .prepare("SELECT * FROM locations WHERE google_place_id = ?")
      .get(googlePlace.place_id);
    if (row) return row;
  }

  const all = db.prepare("SELECT * FROM locations").all();

  // 2. Match by normalized address
  if (googlePlace.formatted_address) {
    const norm = googlePlace.formatted_address.toLowerCase().trim();
    const row = all.find(
      (loc) => loc.address && loc.address.toLowerCase().trim() === norm
    );
    if (row) return row;
  }

  // 3. Match by coordinates within threshold
  const lat = googlePlace.geometry?.location?.lat;
  const lng = googlePlace.geometry?.location?.lng;
  if (lat != null && lng != null) {
    const row = all.find(
      (loc) =>
        loc.latitude != null &&
        loc.longitude != null &&
        haversineKm(lat, lng, loc.latitude, loc.longitude) <= COORDINATE_THRESHOLD_KM
    );
    if (row) return row;
  }

  return null;
}

function upsertLocation(googlePlace) {
  const existing = findMatchingLocation(googlePlace);
  if (existing) return existing;

  const result = db
    .prepare(
      `INSERT INTO locations (name, address, phone, latitude, longitude, google_place_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      googlePlace.name,
      googlePlace.formatted_address ?? null,
      googlePlace.formatted_phone_number ?? null,
      googlePlace.geometry?.location?.lat ?? null,
      googlePlace.geometry?.location?.lng ?? null,
      googlePlace.place_id ?? null
    );

  return db
    .prepare("SELECT * FROM locations WHERE id = ?")
    .get(result.lastInsertRowid);
}

// ─── Bland.ai ────────────────────────────────────────────────────────────────

function buildBlandPrompt(person) {
  // TODO: finalize prompt wording with team
  const genderPhrase = person.gender ? `a ${person.gender} individual` : "an individual";
  return `You are calling a homeless shelter on behalf of someone in need of shelter tonight.

If the person who answers speaks a language other than English, please communicate with them in their language.

You are calling on behalf of ${genderPhrase} named ${person.name ?? "someone"}. Their message is:
"${person.message}"

Please:
1. Ask if they currently have space available tonight for ${genderPhrase}.
2. Ask about any gender-specific, age, or sobriety requirements.
3. Ask for the best way to arrive or check in.
4. Be polite, brief, and clear.

Thank them and end the call.`;
}

async function triggerBlandCall(location, person) {
  const res = await fetch("https://api.bland.ai/v1/calls", {
    method: "POST",
    headers: {
      Authorization: process.env.BLAND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone_number: location.phone,
      task: buildBlandPrompt(person),
      voice: "nat",
      wait_for_greeting: true,
      record: true,
      language: "en",
      max_duration: 2, // minutes
    }),
  });

  const data = await res.json();
  if (!data.call_id) {
    console.error("Bland.ai call failed for", location.name, data);
    return null;
  }
  return data.call_id;
}

async function pollForTranscript(callId, maxWaitMs = 150_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));

    const res = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: { Authorization: process.env.BLAND_API_KEY },
    });
    const data = await res.json();

    if (data.status === "completed" || data.status === "complete") {
      return data.transcripts ?? data.transcript ?? null;
    }
    if (data.status === "failed" || data.status === "error") {
      console.error("Bland.ai call failed, id:", callId);
      return null;
    }
  }
  console.warn("Bland.ai poll timed out for call", callId);
  return null;
}

async function callLocationViaBland(location, person) {
  const callId = await triggerBlandCall(location, person);
  if (!callId) return null;
  return pollForTranscript(callId);
}

// ─── Claude transcript interpretation ────────────────────────────────────────

async function interpretTranscripts(callResults, person) {
  const withTranscripts = callResults.filter((r) => r.transcript);
  if (!withTranscripts.length) return [];

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const transcriptBlock = withTranscripts
    .map(
      ({ location, transcript }) =>
        `### ${location.name}\nPhone: ${location.phone}\nTranscript:\n${JSON.stringify(transcript, null, 2)}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You help connect people experiencing homelessness to shelter.
Analyze call transcripts and extract information relevant to the specific person seeking help.
Always respond with valid JSON only — no markdown, no explanation.`;

  const userPrompt = `Person seeking shelter:
- Name: ${person.name ?? "Unknown"}
- Gender: ${person.gender ?? "Unknown"}
- Needs: ${person.message ?? "General shelter for tonight"}

Shelter call transcripts:
${transcriptBlock}

Return a JSON array. One object per shelter:
{
  "location_name": string,
  "space_available": true | false | null,
  "requirements": string | null,
  "checkin_info": string | null,
  "relevant_notes": string | null
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content);
    // GPT with json_object mode returns an object — unwrap array if wrapped
    return Array.isArray(parsed) ? parsed : parsed.shelters ?? parsed.locations ?? [];
  } catch {
    return [];
  }
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * @param {object[]} google_places_locs  - Array of Google Places API result objects
 * @param {object}   person              - { name, gender, message, current_location }
 * @returns {Promise<{ locations: object[], no_phone: object[] }>}
 */
async function match_locations(google_places_locs, person) {
  // 1. Match or create each place in the DB
  const dbLocations = google_places_locs.map(upsertLocation);

  // 2. Split: already called today vs needs a call
  const alreadyCalled = dbLocations.filter((loc) => isToday(loc.last_called));
  const needsCalling = dbLocations.filter(
    (loc) => !isToday(loc.last_called) && loc.phone
  );
  const noPhone = dbLocations.filter(
    (loc) => !isToday(loc.last_called) && !loc.phone
  );

  // 3. Call locations that need it via Bland.ai (parallel)
  const callResults = await Promise.all(
    needsCalling.map(async (location) => {
      const transcript = await callLocationViaBland(location, person);
      return { location, transcript };
    })
  );

  // 4. Interpret transcripts with Claude
  const interpretations = await interpretTranscripts(callResults, person);

  // 5. Persist results to DB
  const now = new Date().toISOString();
  for (const { location, transcript } of callResults) {
    const interp = interpretations.find(
      (i) => i.location_name === location.name
    );
    db.prepare(
      `UPDATE locations
       SET last_called = ?, space_available = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      now,
      interp?.space_available != null ? (interp.space_available ? 1 : 0) : null,
      location.id
    );
  }

  // 6. Build response
  const justCalled = callResults.map(({ location }) => {
    const fresh = db
      .prepare("SELECT * FROM locations WHERE id = ?")
      .get(location.id);
    const interp = interpretations.find((i) => i.location_name === location.name);
    return {
      ...fresh,
      call_status: "just_called",
      requirements: interp?.requirements ?? null,
      checkin_info: interp?.checkin_info ?? null,
      relevant_notes: interp?.relevant_notes ?? null,
    };
  });

  const previouslyCalled = alreadyCalled.map((loc) => ({
    ...loc,
    call_status: "called_today",
  }));

  return {
    locations: [...justCalled, ...previouslyCalled],
    no_phone: noPhone.map((loc) => ({ ...loc, call_status: "no_phone" })),
  };
}

module.exports = { match_locations };
