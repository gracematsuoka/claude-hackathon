require("dotenv").config();

const OpenAI = require("openai");

// Test data: single Ithaca location with phone 6262230129
const testLocation = {
  id: "loc-0",
  name: "Ithaca Shelter",
  address: "123 Shelter Lane, Ithaca, NY 14850",
  phone: "6262230129",
  latitude: 42.4406,
  longitude: -76.4961,
  google_place_id: "ChIJS5Z-123456789",
  category: "housing",
};

const testPerson = {
  name: "Test User",
  gender: "male",
  message: "Need shelter for tonight",
  current_location: "Ithaca, NY",
};

async function triggerBlandCall(location, person) {
  const genderPhrase = person.gender ? `a ${person.gender} individual` : "an individual";
  const task = `You are calling a homeless shelter on behalf of someone in need of shelter tonight.

If the person who answers speaks a language other than English, please communicate with them in their language.

You are calling on behalf of ${genderPhrase} named ${person.name ?? "someone"}. Their message is:
"${person.message}"

Please:
1. Ask if they currently have space available tonight for ${genderPhrase}.
2. Ask about any gender-specific, age, or sobriety requirements.
3. Ask for the best way to arrive or check in.
4. Be polite, brief, and clear.

Thank them and end the call.`;

  console.log("\n=== Calling Bland.ai ===");
  console.log(`Phone: ${location.phone}`);
  console.log(`Task: ${task.substring(0, 100)}...`);

  const res = await fetch("https://api.bland.ai/v1/calls", {
    method: "POST",
    headers: {
      Authorization: process.env.BLAND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone_number: location.phone,
      task: task,
      voice: "nat",
      wait_for_greeting: true,
      record: true,
      language: "en",
      max_duration: 2,
    }),
  });

  const data = await res.json();
  console.log("Bland.ai response:", JSON.stringify(data, null, 2));

  if (!data.call_id) {
    console.error("Bland.ai call failed:", data);
    return null;
  }
  return data.call_id;
}

async function pollForTranscript(callId, maxWaitMs = 120000) {
  const deadline = Date.now() + maxWaitMs;
  console.log("\n=== Polling for transcript ===");

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));

    const res = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: { Authorization: process.env.BLAND_API_KEY },
    });
    const data = await res.json();

    console.log(`Status: ${data.status}`);

    if (data.status === "completed" || data.status === "complete") {
      return data.transcripts ?? data.transcript ?? null;
    }
    if (data.status === "failed" || data.status === "error") {
      console.error("Bland.ai call failed:", data);
      return null;
    }
  }
  console.warn("Bland.ai poll timed out for call", callId);
  return null;
}

async function generateOutline(locations, person) {
  console.log("\n=== Generating outline with OpenAI ===");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const locationDetails = locations
    .map((loc) => {
      const status = loc.call_status === "no_phone" ? "No phone number available" :
        loc.space_available === true ? "Has space available" :
        loc.space_available === false ? "No space available" :
        "Availability unknown";
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
      "action": "What the person should do next (call, go there, etc.)"
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
  return parsed;
}

async function main() {
  console.log("=== Bland.ai Real API Test ===");
  console.log("Location:", testLocation);
  console.log("Person:", testPerson);

  // Step 1: Call Bland.ai
  const callId = await triggerBlandCall(testLocation, testPerson);

  if (!callId) {
    console.error("Failed to get call ID from Bland.ai");
    process.exit(1);
  }

  console.log(`Call ID: ${callId}`);

  // Step 2: Poll for transcript
  const transcript = await pollForTranscript(callId);

  if (!transcript) {
    console.log("No transcript received, using simulated data");
    // Use simulated data for testing purposes
    var locationResult = {
      ...testLocation,
      space_available: true,
      requirements: "None",
      checkin_info: "Arrive before 10pm",
      relevant_notes: "Quiet facility",
      call_status: "completed",
    };
  } else {
    console.log("\n=== Transcript received ===");
    console.log(JSON.stringify(transcript, null, 2));

    // Step 3: Interpret transcript with OpenAI
    console.log("\n=== Interpreting transcript with OpenAI ===");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You help connect people experiencing homelessness to shelter.
Analyze call transcripts and extract information relevant to the specific person seeking help.
Always respond with valid JSON only — no markdown, no explanation.`
        },
        {
          role: "user",
          content: `Person seeking shelter:
- Name: ${testPerson.name ?? "Unknown"}
- Gender: ${testPerson.gender ?? "Unknown"}
- Needs: ${testPerson.message ?? "General shelter for tonight"}

Shelter call transcripts:
### ${testLocation.name}
Phone: ${testLocation.phone}
Transcript:
${JSON.stringify(transcript, null, 2)}

Return a JSON array. One object per shelter:
{
  "location_name": string,
  "space_available": true | false | null,
  "requirements": string | null,
  "checkin_info": string | null,
  "relevant_notes": string | null
}`
        }
      ]
    });

    const interpreted = JSON.parse(completion.choices[0].message.content);
    console.log("Interpreted result:", JSON.stringify(interpreted, null, 2));

    // Handle both array and object responses
    const results = Array.isArray(interpreted) ? interpreted : [interpreted];
    locationResult = {
      ...testLocation,
      ...results[0],
      call_status: "completed"
    };
  }

  // Step 4: Generate outline
  const outline = await generateOutline([locationResult], testPerson);

  console.log("\n=== Final Outline ===");
  console.log(JSON.stringify(outline, null, 2));
}

main().catch(console.error);