export interface ChatRouteResponse {
  reasoning?: string;
  needs?: string[];
  message?: string;
  dispatch?: boolean;
  error?: string;
  status: number;
  ok: boolean;
  rawBody: string;
}

interface SendChatMessageParams {
  message: string;
  language: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function sendChatMessage({
  message,
  language,
}: SendChatMessageParams): Promise<ChatRouteResponse> {
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
  let parsedBody: Record<string, unknown> | null = null;

  try {
    parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (_error) {
    parsedBody = null;
  }

  return {
    reasoning:
      typeof parsedBody?.reasoning === "string"
        ? parsedBody.reasoning
        : undefined,
    needs: Array.isArray(parsedBody?.needs)
      ? parsedBody.needs.filter(
          (need): need is string => typeof need === "string",
        )
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
