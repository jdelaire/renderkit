import { getOpenAIKey, getProxyBaseUrl } from "./openaiClient";

const API_BASE = "https://api.openai.com/v1";
const PROXY_TOKEN = import.meta.env.VITE_PROXY_TOKEN as string | undefined;

export type OpenAIVideoResponse = {
  id: string;
  status: string;
  created_at?: number;
  output?: string[];
  progress?: number;
  error?: { message?: string; type?: string; code?: string };
};

export type OpenAIRequestError = Error & {
  status?: number;
  code?: string;
  type?: string;
  retryAfter?: number;
};

function readRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function parseError(response: Response): Promise<OpenAIRequestError> {
  let message = response.statusText || "Request failed";
  let type: string | undefined;
  let code: string | undefined;

  try {
    const data = await response.json();
    if (data?.error?.message) message = data.error.message;
    if (data?.error?.type) type = data.error.type;
    if (data?.error?.code) code = data.error.code;
  } catch {
    // ignore JSON parse errors
  }

  const error = new Error(message) as OpenAIRequestError;
  error.status = response.status;
  error.type = type;
  error.code = code;
  error.retryAfter = readRetryAfter(response.headers.get("retry-after"));
  return error;
}

function getApiBase() {
  return getProxyBaseUrl() ?? API_BASE;
}

function authHeaders() {
  const apiKey = getOpenAIKey();
  if (!apiKey && !getProxyBaseUrl()) {
    throw new Error("Missing OpenAI API key");
  }
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (PROXY_TOKEN && getProxyBaseUrl()) {
    headers["X-Renderkit-Token"] = PROXY_TOKEN;
  }
  return headers;
}

export async function createVideo(request: {
  prompt: string;
  model: string;
  seconds: number;
  size: string;
}): Promise<OpenAIVideoResponse> {
  const form = new FormData();
  form.append("prompt", request.prompt);
  form.append("model", request.model);
  form.append("seconds", String(request.seconds));
  form.append("size", request.size);

  const response = await fetch(`${getApiBase()}/videos`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

export async function retrieveVideo(id: string): Promise<OpenAIVideoResponse> {
  const response = await fetch(`${getApiBase()}/videos/${id}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

export async function downloadVideoContent(id: string): Promise<Blob> {
  const response = await fetch(`${getApiBase()}/videos/${id}/content`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.blob();
}
