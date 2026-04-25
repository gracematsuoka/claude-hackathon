/**
 * Full pipeline integration test:
 * 1) POST /api/match-locations
 * 2) POST /api/generate-outline
 *
 * Usage:
 *   node test/full-pipeline.test.js
 *
 * Notes:
 * - Uses real API endpoints and real service integrations.
 * - If no API is running on API_BASE_URL, this script starts local server.js automatically.
 */

require("dotenv").config();

const path = require("path");
const { spawn } = require("child_process");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

const google_places_locs = {
  count: 1,
  results: {
    housing: [
      {
        name: "Ithaca Shelter",
        placeId: "test-place-ithaca-001",
        latitude: 42.4406,
        longitude: -76.4961,
        address: "123 Shelter Lane, Ithaca, NY 14850",
        phoneNumber: "+16262230129",
      },
    ],
    food: [],
  },
};

const person = {
  name: "Test User",
  gender: "male",
  message: "I need shelter tonight and do not speak English.",
  current_location: "Ithaca, NY",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function healthCheck() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) return false;
    const body = await res.json();
    return body?.ok === true;
  } catch {
    return false;
  }
}

async function waitForHealth(maxWaitMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await healthCheck()) return true;
    await sleep(500);
  }
  return false;
}

async function postJson(pathname, body) {
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let parsed;
  try {
    parsed = await res.json();
  } catch {
    parsed = { error: "Non-JSON response" };
  }

  if (!res.ok) {
    const err = new Error(`POST ${pathname} failed with ${res.status}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }

  return parsed;
}

function printStep(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  let serverProc = null;
  let startedLocalServer = false;

  try {
    const alreadyRunning = await healthCheck();
    if (!alreadyRunning) {
      printStep("Starting Local API Server");
      serverProc = spawn("node", ["server.js"], {
        cwd: path.resolve(__dirname, ".."),
        stdio: ["ignore", "pipe", "pipe"],
      });

      serverProc.stdout.on("data", (chunk) => {
        process.stdout.write(`[server] ${chunk}`);
      });
      serverProc.stderr.on("data", (chunk) => {
        process.stderr.write(`[server] ${chunk}`);
      });

      const up = await waitForHealth();
      if (!up) {
        throw new Error(`Server did not become healthy at ${API_BASE_URL}/health`);
      }
      startedLocalServer = true;
      console.log(`Using API base URL: ${API_BASE_URL}`);
    } else {
      printStep("Using Existing API Server");
      console.log(`Using API base URL: ${API_BASE_URL}`);
    }

    printStep("Input Payload: /api/match-locations");
    const matchPayload = { google_places_locs, person };
    console.log(JSON.stringify(matchPayload, null, 2));

    printStep("POST /api/match-locations");
    const matchResult = await postJson("/api/match-locations", matchPayload);
    console.log(JSON.stringify(matchResult, null, 2));

    printStep("Input Payload: /api/generate-outline");
    const outlinePayload = { matchResult, person };
    console.log(JSON.stringify(outlinePayload, null, 2));

    printStep("POST /api/generate-outline");
    const outlineResult = await postJson("/api/generate-outline", outlinePayload);
    console.log(JSON.stringify(outlineResult, null, 2));

    printStep("Done");
    console.log("Full pipeline test completed successfully.");
  } catch (error) {
    printStep("Failure");
    console.error(error.message);
    if (error.body) {
      console.error("Error body:", JSON.stringify(error.body, null, 2));
    }
    process.exitCode = 1;
  } finally {
    if (startedLocalServer && serverProc && !serverProc.killed) {
      printStep("Stopping Local API Server");
      serverProc.kill("SIGTERM");
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
