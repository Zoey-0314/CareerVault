"use client";

import { useEffect, useState } from "react";

type AiStatus = {
  configured: boolean;
  provider?: "openai" | "deepseek";
  providerName?: string;
  model?: string;
  supportsImages?: boolean;
  supportsPdfInput?: boolean;
  safety?: {
    maxUpstreamCallsPerMinute?: number;
    maxUpstreamCallsPerHour?: number;
    maxOutputTokens?: number;
    maxPayloadBytes?: number;
  };
};

type AiActivity = {
  operation?: "interview" | "credential" | "jd";
  stage?: "start" | "success" | "error" | "local";
  provider?: "openai" | "deepseek" | "local-v1";
  model?: string;
  message?: string;
  visionUsed?: boolean;
  fallbackUsed?: boolean;
  inputKind?: "image" | "pdf" | "text";
};

type BrowserQuota = {
  date: string;
  used: number;
  limit: number;
};

const BROWSER_QUOTA_KEY = "careervault-ai-browser-quota-v1";
const DEFAULT_BROWSER_DAILY_LIMIT = 80;

const staticReplacements: Array<[RegExp, string]> = [
  [/GPT\s*·\s*deepseek-flash/gi, "DeepSeek · deepseek-flash"],
  [/GPT\s*·\s*deepseek/gi, "DeepSeek"],
  [/GPT\s*·\s*待连接/g, "AI · 待连接"],
  [/GPT\s*·\s*连接中/g, "AI · 连接中"],
  [/GPT\s*·\s*调用失败/g, "AI · 调用失败"],
  [/GPT 正在阅读/g, "AI 正在阅读"],
  [/GPT 思考中/g, "AI 思考中"],
  [/GPT 调用失败/g, "AI 调用失败"],
  [/让 GPT /g, "让 AI "],
  [/GPT 判断/g, "AI 判断"],
  [/CareerVault 再让 GPT/g, "CareerVault 再让 AI"],
];

function apiStatusUrl() {
  if (typeof window === "undefined") return "";
  if (window.location.hostname === "zoey-0314.github.io") return "https://career-vault-sage.vercel.app/api/status";
  return `${window.location.origin}/api/status`;
}

function syncProviderText(status: AiStatus | null) {
  if (typeof document === "undefined") return;
  const providerLabel = status?.configured
    ? `${status.providerName || "AI"}${status.model ? ` · ${status.model}` : ""}`
    : "AI · 未配置";

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const current = node.nodeValue || "";
    let next = current;
    for (const [pattern, replacement] of staticReplacements) next = next.replace(pattern, replacement);
    if (status?.configured && /^(GPT|AI)\s*·\s*(待连接|连接中)$/.test(next.trim())) next = providerLabel;
    if (status?.configured && /^GPT\s*·\s*(图片已读取|PDF 已读取)$/.test(next.trim())) next = next.replace(/^GPT/, status.providerName || "AI");
    if (next !== current) node.nodeValue = next;
    node = walker.nextNode();
  }

  if (status?.supportsPdfInput === false) {
    for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))) {
      const accept = input.getAttribute("accept") || "";
      if (!accept.includes("application/pdf") && !accept.includes(".pdf")) continue;
      input.setAttribute("accept", "image/*");
    }
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("span,p,strong"))) {
      if (element.textContent?.includes("支持图片或 PDF")) element.textContent = element.textContent.replace("支持图片或 PDF", "当前 AI 仅支持图片识别；PDF 请先转成图片");
      if (element.textContent?.includes("支持图片与 PDF")) element.textContent = element.textContent.replace("支持图片与 PDF", "当前 AI 仅支持图片；PDF 请先转成图片");
      if (element.textContent?.includes("岗位图片 / PDF")) element.textContent = element.textContent.replace("岗位图片 / PDF", "岗位图片");
      if (element.textContent?.includes("选择图片 / PDF")) element.textContent = element.textContent.replace("选择图片 / PDF", "选择图片");
      if (element.textContent?.includes("岗位截图或 PDF")) element.textContent = element.textContent.replace("岗位截图或 PDF", "岗位截图");
    }
  }
}

function cancelEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function destructiveActionGuard(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest("button");
  if (!button) return;

  if (button.querySelector(".lucide-trash-2")) {
    const ok = window.confirm("确定删除这条记录吗？删除后会立即从当前浏览器的数据中移除。建议重要数据先导出备份。");
    if (!ok) cancelEvent(event);
    return;
  }

  if (button.textContent?.includes("从云端恢复")) {
    const ok = window.confirm("从云端恢复会覆盖当前浏览器里的档案、经历、证书和 JD。确定继续吗？如果本地内容更新，建议先点“同步到云端”或导出备份。");
    if (!ok) cancelEvent(event);
  }
}

function fileInputGuard(event: Event, status: AiStatus | null) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  if (!input || input.type !== "file" || !input.files?.length) return;
  const file = input.files[0];
  const accept = input.getAttribute("accept") || "";

  if (file.type === "application/pdf" && status?.supportsPdfInput === false) {
    window.alert("当前 DeepSeek 模型不支持直接读取 PDF。请先把 PDF 转成图片再上传；本次文件没有发送给 AI。");
    input.value = "";
    cancelEvent(event);
    return;
  }

  if ((accept.includes("application/json") || accept.includes(".json")) && file.name.toLowerCase().endsWith(".json")) {
    const ok = window.confirm("恢复备份会覆盖当前浏览器中的 CareerVault 数据。确定继续吗？建议先导出当前备份，以便需要时撤回。");
    if (!ok) {
      input.value = "";
      cancelEvent(event);
    }
  }
}

function activityLabel(activity: AiActivity | null) {
  if (!activity) return "";
  const prefix = activity.operation === "credential" ? "证书" : activity.operation === "jd" ? "JD" : "经历";
  if (activity.stage === "start") return `${prefix} · 处理中`;
  if (activity.stage === "error") return `${prefix} · 调用失败`;
  if (activity.stage === "local") return `${prefix} · 本地规则`;
  if (activity.stage === "success") return activity.fallbackUsed ? `${prefix} · 已读取 / 需核对` : `${prefix} · 已完成`;
  return "";
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function readBrowserQuota(): BrowserQuota {
  const fallback = { date: todayKey(), used: 0, limit: DEFAULT_BROWSER_DAILY_LIMIT };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_QUOTA_KEY) || "null") as Partial<BrowserQuota> | null;
    if (!parsed || parsed.date !== fallback.date) return fallback;
    return {
      date: fallback.date,
      used: Math.max(0, Number(parsed.used) || 0),
      limit: DEFAULT_BROWSER_DAILY_LIMIT,
    };
  } catch {
    return fallback;
  }
}

function saveBrowserQuota(quota: BrowserQuota) {
  try { localStorage.setItem(BROWSER_QUOTA_KEY, JSON.stringify(quota)); }
  catch { /* localStorage may be unavailable in privacy mode. */ }
}

function isAiApiRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "POST") return false;
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = new URL(raw, window.location.origin);
    return /\/api\/(interview|credential|jd)$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function ProviderUiSync() {
  const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || "local";
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [activity, setActivity] = useState<AiActivity | null>(null);
  const [quota, setQuota] = useState<BrowserQuota>({ date: todayKey(), used: 0, limit: DEFAULT_BROWSER_DAILY_LIMIT });

  useEffect(() => {
    setQuota(readBrowserQuota());
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isAiApiRequest(input, init)) return originalFetch(input, init);
      const current = readBrowserQuota();
      if (current.used >= current.limit) {
        setQuota(current);
        return new Response(JSON.stringify({
          error: "browser_daily_ai_limit",
          detail: `当前浏览器今天已使用 ${current.limit} 次 AI 操作。为保护公共 DeepSeek 额度，今日已暂停继续调用；明天会自动恢复。`,
          provider: status?.provider || "AI",
          model: status?.model || "",
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
      const next = { ...current, used: current.used + 1 };
      saveBrowserQuota(next);
      setQuota(next);
      return originalFetch(input, init);
    };
    return () => { window.fetch = originalFetch; };
  }, [status?.provider, status?.model]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiStatusUrl(), { method: "GET", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: AiStatus | null) => { if (!cancelled && payload) setStatus(payload); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onAiStatus = (event: Event) => {
      const detail = (event as CustomEvent<AiActivity>).detail;
      setActivity(detail || null);
    };
    window.addEventListener("careervault:ai-status", onAiStatus as EventListener);
    return () => window.removeEventListener("careervault:ai-status", onAiStatus as EventListener);
  }, []);

  useEffect(() => {
    syncProviderText(status);
    const observer = new MutationObserver(() => syncProviderText(status));
    const onFileChange = (event: Event) => fileInputGuard(event, status);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    document.addEventListener("click", destructiveActionGuard, true);
    document.addEventListener("change", onFileChange, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", destructiveActionGuard, true);
      document.removeEventListener("change", onFileChange, true);
    };
  }, [status]);

  const provider = status?.configured
    ? `${status.providerName || "AI"}${status.model ? ` · ${status.model}` : ""}`
    : status ? "AI 未配置" : "AI 状态检查中";
  const live = activityLabel(activity);
  const quotaLabel = `今日 AI ${quota.used}/${quota.limit}`;

  return (
    <div
      aria-label={`CareerVault build ${buildSha}; ${provider}; ${quotaLabel}${live ? `; ${live}` : ""}`}
      title={activity?.message || `${provider} · ${quotaLabel}`}
      style={{
        position: "fixed",
        left: 12,
        bottom: 10,
        zIndex: 9999,
        display: "flex",
        gap: 6,
        padding: "5px 8px",
        border: "1px solid rgba(90,100,92,.18)",
        borderRadius: 999,
        background: "rgba(250,249,246,.9)",
        backdropFilter: "blur(10px)",
        color: activity?.stage === "error" ? "#8a4b2a" : "#687069",
        fontSize: 10,
        lineHeight: 1,
        letterSpacing: ".02em",
      }}
    >
      <span>Build {buildSha === "local" ? "local" : buildSha.slice(0, 7)}</span>
      <span>·</span>
      <span>{provider}</span>
      <span>·</span>
      <span>{quotaLabel}</span>
      {live && <><span>·</span><span>{live}</span></>}
    </div>
  );
}
