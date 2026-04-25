require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { db } = require("../firebase");
const shelters = require("./shelters.json");

function toIsoOrNow(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function normalizeSpaceAvailable(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value === true) {
    return 1;
  }

  if (value === false) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

async function importShelters() {
  if (!Array.isArray(shelters)) {
    throw new Error("shelters.json must export an array of shelter entries.");
  }

  for (const shelter of shelters) {
    const docId = shelter.google_place_id || undefined;
    const docRef = docId
      ? db.collection("locations").doc(docId)
      : db.collection("locations").doc();

    const existing = await docRef.get();
    const createdAt = existing.exists
      ? existing.data()?.created_at || toIsoOrNow(shelter.created_at)
      : toIsoOrNow(shelter.created_at);

    const payload = {
      id: docRef.id,
      name: shelter.name ?? "Unknown shelter",
      address: shelter.address ?? null,
      phone: shelter.phone ?? null,
      latitude: shelter.latitude ?? null,
      longitude: shelter.longitude ?? null,
      google_place_id: shelter.google_place_id ?? null,
      last_called: shelter.last_called ?? null,
      space_available: normalizeSpaceAvailable(shelter.space_available),
      created_at: createdAt,
      updated_at: toIsoOrNow(shelter.updated_at),
    };

    await docRef.set(payload, { merge: true });
    console.log(`Imported ${payload.name}`);
  }

  console.log(`Import complete: ${shelters.length} shelter entries processed.`);
}

importShelters().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
