import { getAiProvider, getAiSafetyLimits, providerDisplayName } from "./_ai-provider.mjs";

const DEFAULT_ORIGIN = "https://zoey-0314.github.io";

function allowedOrigins(req) {
  const configured = (process.env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const host = req.headers.host ? `https://${req.headers.host}` : "";
  return Array.from(new Set([...configured, host].filter(Boolean)));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export default function handler(req, res) {
  const origins = allowedOrigins(req);
  const requestOrigin = req.headers.origin || "";
  const responseOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0] || "*";
  for (const [key, value] of Object.entries(corsHeaders(responseOrigin))) res.setHeader(key, value);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  if (requestOrigin && !origins.includes(requestOrigin)) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "origin_not_allowed" }));
    return;
  }

  try {
    const ai = getAiProvider();
    const limits = getAiSafetyLimits();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      configured: Boolean(ai.apiKey),
      provider: ai.provider,
      providerName: providerDisplayName(ai.provider),
      model: ai.model,
      supportsImages: ai.supportsImages,
      supportsPdfInput: ai.supportsPdfInput,
      safety: {
        maxUpstreamCallsPerMinute: limits.minuteLimit,
        maxUpstreamCallsPerHour: limits.hourLimit,
        maxOutputTokens: limits.maxOutputTokens,
        maxPayloadBytes: limits.maxPayloadBytes,
      },
    }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ configured: false, error: error instanceof Error ? error.message : "invalid_ai_provider" }));
  }
}
