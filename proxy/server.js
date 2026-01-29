const http = require("node:http");
const { Readable } = require("node:stream");

const API_BASE = "https://api.openai.com/v1";
const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 30);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 3);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1_000_000);
const PROXY_TOKEN = process.env.PROXY_TOKEN || "";

let activeRequests = 0;
const rateBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + 60_000 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_PER_MIN) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    ...extraHeaders,
  });
  res.end(body);
}

function sendCors(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Renderkit-Token",
    "Access-Control-Max-Age": "600",
  });
  res.end();
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleProxy(req, res) {
  if (!OPENAI_API_KEY) {
    return sendJson(res, 500, { error: { message: "Missing OPENAI_API_KEY" } });
  }

  if (req.method === "OPTIONS") {
    return sendCors(res);
  }

  if (!req.url || !req.url.startsWith("/videos")) {
    return sendJson(res, 404, { error: { message: "Not found" } });
  }

  if (PROXY_TOKEN) {
    const token = req.headers["x-renderkit-token"];
    if (!token || token !== PROXY_TOKEN) {
      return sendJson(res, 401, { error: { message: "Invalid proxy token" } });
    }
  }

  const ip = getClientIp(req);
  const rate = rateLimit(ip);
  if (!rate.allowed) {
    return sendJson(
      res,
      429,
      { error: { message: "Rate limit exceeded" } },
      { "Retry-After": String(rate.retryAfter) },
    );
  }

  if (activeRequests >= MAX_CONCURRENT) {
    return sendJson(
      res,
      429,
      { error: { message: "Too many concurrent requests" } },
      { "Retry-After": "5" },
    );
  }

  let body;
  try {
    body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  } catch (error) {
    return sendJson(res, 413, { error: { message: error.message } });
  }

  const upstreamHeaders = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (["host", "content-length", "authorization", "connection"].includes(key)) continue;
    upstreamHeaders.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  upstreamHeaders.set("Authorization", `Bearer ${OPENAI_API_KEY}`);

  const targetUrl = `${API_BASE}${req.url}`;

  activeRequests += 1;
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body,
    });

    const responseHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Content-Type": response.headers.get("content-type") || "application/json",
    };
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      responseHeaders["Retry-After"] = retryAfter;
    }
    res.writeHead(response.status, responseHeaders);

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    sendJson(res, 502, { error: { message: error.message } });
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
  }
}

const server = http.createServer((req, res) => {
  void handleProxy(req, res);
});

server.listen(PORT, () => {
  console.log(`renderkit proxy running on http://localhost:${PORT}`);
});
