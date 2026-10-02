const PROVIDER_DEFAULTS = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-6-luna",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
  },
};

export function getAiProvider() {
  const requested = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const provider = requested || (process.env.AI_API_KEY ? "deepseek" : "openai");
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) throw new Error(`Unsupported AI_PROVIDER: ${provider}`);

  const apiKey = String(
    process.env.AI_API_KEY ||
    (provider === "openai" ? process.env.OPENAI_API_KEY : "") ||
    "",
  ).trim();
  const model = String(
    process.env.AI_MODEL ||
    (provider === "openai" ? process.env.OPENAI_MODEL : "") ||
    defaults.model,
  ).trim();
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
  const upstream = await fetch(config.responsesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await upstream.json().catch(() => ({}));
  return { upstream, payload };
}

export function providerDisplayName(provider) {
  return provider === "deepseek" ? "DeepSeek" : "OpenAI";
}
