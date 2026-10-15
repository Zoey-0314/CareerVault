export type AiEndpointKind = "interview" | "credential" | "jd" | "resume" | "interview-prep";

const PUBLIC_BACKEND_ORIGIN = "https://career-vault-sage.vercel.app";
const GITHUB_PAGES_HOST = "zoey-0314.github.io";
const SAME_ORIGIN_AI_HOSTS = new Set([
  "career-vault.xyz",
  "www.career-vault.xyz",
]);

function normalizeConfiguredEndpoint(configured: string, kind: AiEndpointKind): string {
  const base = configured.replace(/\/$/, "");
  if (/\/api\/(interview|credential|jd|resume|interview-prep)$/.test(base)) {
    return base.replace(/\/api\/(interview|credential|jd|resume|interview-prep)$/, `/api/${kind}`);
  }
  return `${base}/api/${kind}`;
}

export function resolveAiEndpointForLocation(
  kind: AiEndpointKind,
  hostname: string,
  origin: string,
  configured = "",
): string | undefined {
  const explicit = configured.trim();
  if (explicit) return normalizeConfiguredEndpoint(explicit, kind);

  if (hostname === GITHUB_PAGES_HOST) return `${PUBLIC_BACKEND_ORIGIN}/api/${kind}`;
  if (hostname.endsWith(".vercel.app") || SAME_ORIGIN_AI_HOSTS.has(hostname)) {
    return `${origin.replace(/\/$/, "")}/api/${kind}`;
  }
  return undefined;
}

export function resolveAiEndpoint(kind: AiEndpointKind): string | undefined {
  const configured = process.env.NEXT_PUBLIC_CAREERVAULT_AI_URL || "";
  if (typeof window === "undefined") {
    return configured.trim() ? normalizeConfiguredEndpoint(configured.trim(), kind) : undefined;
  }
  return resolveAiEndpointForLocation(kind, window.location.hostname, window.location.origin, configured);
}
