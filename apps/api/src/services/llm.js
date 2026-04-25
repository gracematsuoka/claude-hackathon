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

function parseChatResponse(reply) {
  let parsed;

  try {
    parsed = JSON.parse(reply);
  } catch (_error) {
    const error = new Error("The LLM returned invalid JSON.");
    error.statusCode = 502;
    throw error;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("The LLM response must be a JSON object.");
    error.statusCode = 502;
    throw error;
  }

  if (typeof parsed.message !== "string" || !parsed.message.trim()) {
    const error = new Error("The LLM response must include a non-empty message.");
    error.statusCode = 502;
    throw error;
  }

  return {
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    needs: Array.isArray(parsed.needs) ? parsed.needs : [],
    message: parsed.message.trim(),
    dispatch: Boolean(parsed.dispatch),
  };
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textParts = [];

  for (const outputItem of data?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (typeof contentItem?.text === "string" && contentItem.text.trim()) {
        textParts.push(contentItem.text.trim());
      }
    }
  }

  return textParts.join("\n").trim();
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

  const reply = extractResponseText(data);

  if (!reply) {
    const error = new Error("The LLM returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return parseChatResponse(reply);
}

module.exports = {
  buildSystemPrompt,
  generateChatResponse,
};
