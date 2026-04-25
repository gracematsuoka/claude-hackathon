const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function buildChatRequest(message) {
  return {
    model: DEFAULT_MODEL,
    input: message,
  };
}

async function generateChatResponse({ message }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildChatRequest(message)),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || "OpenAI request failed.");
    error.statusCode = response.status;
    throw error;
  }

  const reply = data?.output_text?.trim();

  if (!reply) {
    const error = new Error("The LLM returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return reply;
}

module.exports = {
  generateChatResponse,
};
