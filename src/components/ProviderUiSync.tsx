"use client";

import { useEffect, useState } from "react";

type AiStatus = {
  configured: boolean;
  provider?: "openai" | "deepseek";
  providerName?: string;
  model?: string;
  supportsImages?: boolean;
  supportsPdfInput?: boolean;
};

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
    if (status?.configured && /^(GPT|AI)\s*·\s*(待连接|连接中)$/.test(next.trim())) next = next.replace(/^(GPT|AI)\s*·\s*(待连接|连接中)$/, providerLabel);
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
      if (element.textContent?.includes("岗位图片 / PDF")) element.textContent = element.textContent.replace("岗位图片 / PDF", "岗位图片");
      if (element.textContent?.includes("选择图片 / PDF")) element.textContent = element.textContent.replace("选择图片 / PDF", "选择图片");
    }
  }
}

function destructiveActionGuard(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest("button");
  if (!button) return;

  if (button.querySelector(".lucide-trash-2")) {
    const ok = window.confirm("确定删除这条记录吗？删除后会立即从当前浏览器的数据中移除。建议重要数据先导出备份。");
    if (!ok) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    return;
  }

  if (button.textContent?.includes("从云端恢复")) {
    const ok = window.confirm("从云端恢复会覆盖当前浏览器里的档案、经历、证书和 JD。确定继续吗？如果本地内容更新，建议先点“同步到云端”或导出备份。");
    if (!ok) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }
}

export function ProviderUiSync() {
  const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || "local";
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiStatusUrl(), { method: "GET", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: AiStatus | null) => { if (!cancelled && payload) setStatus(payload); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    syncProviderText(status);
    const observer = new MutationObserver(() => syncProviderText(status));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    document.addEventListener("click", destructiveActionGuard, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", destructiveActionGuard, true);
    };
  }, [status]);

  const provider = status?.configured
    ? `${status.providerName || "AI"}${status.model ? ` · ${status.model}` : ""}`
    : status ? "AI 未配置" : "AI 状态检查中";

  return (
    <div
      aria-label={`CareerVault build ${buildSha}; ${provider}`}
      title={provider}
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
        color: "#687069",
        fontSize: 10,
        lineHeight: 1,
        letterSpacing: ".02em",
      }}
    >
      <span>Build {buildSha === "local" ? "local" : buildSha.slice(0, 7)}</span>
      <span>·</span>
      <span>{provider}</span>
    </div>
  );
}
