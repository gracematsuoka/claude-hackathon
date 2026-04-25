const { SYSTEM_PROMPT } = require("./utils");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_MAX_OUTPUT_TOKENS || 300,
);

function buildSystemPrompt(language) {
  if (typeof language === "string" && language.trim()) {
    return `The system parameter language is: ${language.trim()}. ${SYSTEM_PROMPT}`;
  }

  return SYSTEM_PROMPT;
}

function buildChatRequest({ message, language }) {
  return {
    model: DEFAULT_MODEL,
    max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildSystemPrompt(language),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    ],
  };
}

async function generateChatResponse({ message, language }) {
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
    body: JSON.stringify(buildChatRequest({ message, language })),
  });

  let data;

  try {
    data = await response.json();
  } catch (_error) {
    const error = new Error("OpenAI returned an invalid response.");
    error.statusCode = 502;
    throw error;
  }

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
  BASE_SYSTEM_PROMPT,
  buildSystemPrompt,
  generateChatResponse,
};
