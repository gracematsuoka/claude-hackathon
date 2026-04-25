const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function sendChatMessage({ message, language }) {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      language,
    }),
  });

  const rawBody = await response.text();
  let parsedBody = null;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch (_error) {
    parsedBody = null;
  }

  return {
    reasoning:
      typeof parsedBody?.reasoning === "string" ? parsedBody.reasoning : undefined,
    needs: Array.isArray(parsedBody?.needs)
      ? parsedBody.needs.filter((need) => typeof need === "string")
      : undefined,
    message:
      typeof parsedBody?.message === "string" ? parsedBody.message : undefined,
    dispatch:
      typeof parsedBody?.dispatch === "boolean"
        ? parsedBody.dispatch
        : undefined,
    error: typeof parsedBody?.error === "string" ? parsedBody.error : undefined,
    status: response.status,
    ok: response.ok,
    rawBody,
  };
}

module.exports = {
  sendChatMessage,
};
