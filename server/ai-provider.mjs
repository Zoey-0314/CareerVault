const PROVIDER_DEFAULTS = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-6-luna" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-flash" },
};

const RATE_STATE_KEY = Symbol.for("careervault.ai-rate-state");

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiSafetyLimits() {
  return {
    minuteLimit: positiveInt(process.env.AI_MAX_UPSTREAM_CALLS_PER_MINUTE, 30),
    hourLimit: positiveInt(process.env.AI_MAX_UPSTREAM_CALLS_PER_HOUR, 300),
    maxOutputTokens: positiveInt(process.env.AI_MAX_OUTPUT_TOKENS, 2200),
    maxPayloadBytes: positiveInt(process.env.AI_MAX_UPSTREAM_PAYLOAD_BYTES, 4_800_000),
  };
}

function getRateState() {
  if (!globalThis[RATE_STATE_KEY]) globalThis[RATE_STATE_KEY] = { timestamps: [] };
  return globalThis[RATE_STATE_KEY];
}

function consumeAiBudget() {
  const now = Date.now();
  const { minuteLimit, hourLimit } = getAiSafetyLimits();
  const state = getRateState();
  state.timestamps = state.timestamps.filter((time) => now - time < 60 * 60 * 1000);
  const lastMinute = state.timestamps.filter((time) => now - time < 60 * 1000).length;
  if (lastMinute >= minuteLimit || state.timestamps.length >= hourLimit) {
    return {
      allowed: false,
      retryAfterSeconds: lastMinute >= minuteLimit ? 60 : 300,
      minuteLimit,
      hourLimit,
    };
  }
  state.timestamps.push(now);
  return { allowed: true, minuteLimit, hourLimit };
}

function safeJsonSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
  catch { return Number.POSITIVE_INFINITY; }
}

function localErrorResponse(status, code, message, extraHeaders = {}) {
  const payload = { error: { code, message } };
  const upstream = new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
  return { upstream, payload };
}

export function getAiProvider() {
  const requested = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const provider = requested || (process.env.AI_API_KEY ? "deepseek" : "openai");
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) throw new Error(`Unsupported AI_PROVIDER: ${provider}`);

  const apiKey = String(process.env.AI_API_KEY || (provider === "openai" ? process.env.OPENAI_API_KEY : "") || "").trim();
  const model = String(process.env.AI_MODEL || (provider === "openai" ? process.env.OPENAI_MODEL : "") || defaults.model).trim();
  const baseUrl = String(process.env.AI_BASE_URL || defaults.baseUrl).trim().replace(/\/$/, "");

  return {
    provider,
    apiKey,
    model,
    baseUrl,
    responsesUrl: `${baseUrl}/responses`,
    supportsImages: provider === "openai" || (provider === "deepseek" && model === "deepseek-flash"),
    supportsPdfInput: provider === "openai",
  };
}

export function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

export async function createResponse(config, body) {
  const limits = getAiSafetyLimits();
  const preparedBody = { ...body };
  if (Number.isFinite(Number(preparedBody.max_output_tokens))) {
    preparedBody.max_output_tokens = Math.min(Number(preparedBody.max_output_tokens), limits.maxOutputTokens);
  } else {
    preparedBody.max_output_tokens = limits.maxOutputTokens;
  }

  const payloadBytes = safeJsonSize(preparedBody);
  if (payloadBytes > limits.maxPayloadBytes) {
    return localErrorResponse(
      413,
      "careervault_payload_too_large",
      `本次 AI 请求过大（约 ${Math.ceil(payloadBytes / 1024)} KB），已在发送给模型前拦截。请缩小图片、减少文本长度或改为分段处理。`,
    );
  }

  const budget = consumeAiBudget();
  if (!budget.allowed) {
    return localErrorResponse(
      429,
      "careervault_rate_limited",
      "CareerVault 的公共 AI 调用暂时达到安全上限，请稍后再试。",
      { "Retry-After": String(budget.retryAfterSeconds) },
    );
  }

  const upstream = await fetch(config.responsesUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(preparedBody),
  });
  const payload = await upstream.json().catch(() => ({}));
  return { upstream, payload };
}

export function providerDisplayName(provider) {
  return provider === "deepseek" ? "DeepSeek" : "OpenAI";
}
