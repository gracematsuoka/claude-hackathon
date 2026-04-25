// --- Shared types ---
type JsonObject = Record<string, unknown>;

interface RouteResponseBase {
  error?: string;
  status: number;
  ok: boolean;
  rawBody: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: JsonObject;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;


function getApiUrl(): string {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  }
  return API_URL;
}

function parseBody(rawBody: string): JsonObject | null {
  try {
    return JSON.parse(rawBody) as JsonObject;
  } catch (_error) {
    return null;
  }
}

async function requestJson(
  path: string,
  options: RequestOptions = {},
): Promise<RouteResponseBase & { parsedBody: JsonObject | null }> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawBody = await response.text();
  const parsedBody = parseBody(rawBody);

  return {
    error: typeof parsedBody?.error === "string" ? parsedBody.error : undefined,
    status: response.status,
    ok: response.ok,
    rawBody,
    parsedBody,
  };
}

// --- /api/chat ---
interface SendChatMessageParams {
  message: string;
  language: string;
}

export interface ChatRouteResponse extends RouteResponseBase {
  reasoning?: string;
  needs?: string[];
  message?: string;
  dispatch?: boolean;
}

export async function sendChatMessage({
  message,
  language,
}: SendChatMessageParams): Promise<ChatRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/api/chat", {
    method: "POST",
    body: { message, language },
  });

  return {
    ...base,
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
  };
}

// --- /health ---
export interface HealthRouteResponse extends RouteResponseBase {
  healthOk?: boolean;
}

export async function getHealth(): Promise<HealthRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/health");
  return {
    ...base,
    healthOk: typeof parsedBody?.ok === "boolean" ? parsedBody.ok : undefined,
  };
}

// --- /api/message ---
export interface MessageRouteResponse extends RouteResponseBase {
  message?: string;
}

export async function getApiMessage(): Promise<MessageRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/api/message");
  return {
    ...base,
    message:
      typeof parsedBody?.message === "string" ? parsedBody.message : undefined,
  };
}

// --- /api/places ---
export interface PlaceResult {
  name: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  phoneNumber: string | null;
}

interface GetPlacesParams {
  latitude: string | number;
  longitude: string | number;
  radius: string | number;
  filter?: string;
  isFood?: boolean;
  isHome?: boolean;
}

export interface PlacesRouteResponse extends RouteResponseBase {
  count?: number;
  results?: {
    housing?: PlaceResult[];
    food?: PlaceResult[];
  };
}

export async function getPlaces({
  latitude,
  longitude,
  radius,
  filter,
  isFood,
  isHome,
}: GetPlacesParams): Promise<PlacesRouteResponse> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius: String(radius),
  });

  if (filter) params.set("filter", filter);
  if (typeof isFood === "boolean") params.set("isFood", String(isFood));
  if (typeof isHome === "boolean") params.set("isHome", String(isHome));

  const { parsedBody, ...base } = await requestJson(`/api/places?${params.toString()}`);

  return {
    ...base,
    count: typeof parsedBody?.count === "number" ? parsedBody.count : undefined,
    results:
      parsedBody?.results && typeof parsedBody.results === "object"
        ? (parsedBody.results as PlacesRouteResponse["results"])
        : undefined,
  };
}

// --- /api/locations ---
export interface LocationRecord {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_place_id?: string | null;
  last_called?: string | null;
  space_available?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

interface UpsertLocationParams {
  name?: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface LocationsRouteResponse extends RouteResponseBase {
  locations?: LocationRecord[];
}

export async function getLocations(): Promise<LocationsRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/api/locations");
  return {
    ...base,
    locations: Array.isArray(parsedBody)
      ? (parsedBody as unknown as LocationRecord[])
      : undefined,
  };
}

export interface LocationRouteResponse extends RouteResponseBase {
  location?: LocationRecord;
}

export async function getLocationById(id: string): Promise<LocationRouteResponse> {
  const { parsedBody, ...base } = await requestJson(`/api/locations/${id}`);
  return {
    ...base,
    location:
      parsedBody && !Array.isArray(parsedBody)
        ? (parsedBody as unknown as LocationRecord)
        : undefined,
  };
}

export async function createLocation(
  params: UpsertLocationParams,
): Promise<LocationRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/api/locations", {
    method: "POST",
    body: params as JsonObject,
  });
  return {
    ...base,
    location:
      parsedBody && !Array.isArray(parsedBody)
        ? (parsedBody as unknown as LocationRecord)
        : undefined,
  };
}

export async function updateLocation(
  id: string,
  params: UpsertLocationParams,
): Promise<LocationRouteResponse> {
  const { parsedBody, ...base } = await requestJson(`/api/locations/${id}`, {
    method: "PUT",
    body: params as JsonObject,
  });
  return {
    ...base,
    location:
      parsedBody && !Array.isArray(parsedBody)
        ? (parsedBody as unknown as LocationRecord)
        : undefined,
  };
}

export interface DeleteLocationRouteResponse extends RouteResponseBase {}

export async function deleteLocation(
  id: string,
): Promise<DeleteLocationRouteResponse> {
  const { parsedBody: _parsedBody, ...base } = await requestJson(
    `/api/locations/${id}`,
    { method: "DELETE" },
  );
  return base;
}

// --- /api/match-locations ---
interface MatchLocationsParams {
  google_places_locs: JsonObject;
  person: JsonObject;
  forceCall?: boolean;
}

export interface MatchLocationsRouteResponse extends RouteResponseBase {
  result?: JsonObject;
}

export async function matchLocations({
  google_places_locs,
  person,
  forceCall,
}: MatchLocationsParams): Promise<MatchLocationsRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/api/match-locations", {
    method: "POST",
    body: {
      google_places_locs,
      person,
      forceCall,
    },
  });

  return {
    ...base,
    result:
      parsedBody && !Array.isArray(parsedBody)
        ? (parsedBody as JsonObject)
        : undefined,
  };
}

// --- /api/generate-outline ---
interface GenerateOutlineParams {
  matchResult: JsonObject;
  person: JsonObject;
}

export interface GenerateOutlineRouteResponse extends RouteResponseBase {
  outline?: JsonObject | string;
}

export async function generateOutline({
  matchResult,
  person,
}: GenerateOutlineParams): Promise<GenerateOutlineRouteResponse> {
  const { parsedBody, ...base } = await requestJson("/api/generate-outline", {
    method: "POST",
    body: {
      matchResult,
      person,
    },
  });

  return {
    ...base,
    outline:
      typeof parsedBody?.outline === "string" ||
      (parsedBody?.outline && typeof parsedBody.outline === "object")
        ? (parsedBody.outline as JsonObject | string)
        : undefined,
  };
}
