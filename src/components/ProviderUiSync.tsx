"use client";

import { useEffect } from "react";

const replacements: Array<[RegExp, string]> = [
  [/GPT\s*·\s*deepseek-flash/gi, "DeepSeek · deepseek-flash"],
  [/GPT\s*·\s*deepseek/gi, "DeepSeek"],
  [/GPT\s*·\s*待连接/g, "AI · 待连接"],
  [/GPT\s*·\s*连接中/g, "AI · 连接中"],
  [/GPT\s*·\s*调用失败/g, "AI · 调用失败"],
  [/GPT 正在阅读/g, "AI 正在阅读"],
  [/GPT 思考中/g, "AI 思考中"],
  [/GPT 调用失败/g, "AI 调用失败"],
];

function syncProviderText() {
  if (typeof document === "undefined") return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const current = node.nodeValue || "";
    let next = current;
    for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
    if (next !== current) node.nodeValue = next;
    node = walker.nextNode();
  }
}

export function ProviderUiSync() {
  const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || "local";

  useEffect(() => {
    syncProviderText();
    const observer = new MutationObserver(() => syncProviderText());
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-label={`CareerVault build ${buildSha}`}
      style={{
        position: "fixed",
        left: 12,
        bottom: 10,
        zIndex: 9999,
        padding: "5px 8px",
        border: "1px solid rgba(90,100,92,.18)",
        borderRadius: 999,
        background: "rgba(250,249,246,.88)",
        backdropFilter: "blur(10px)",
        color: "#687069",
        fontSize: 10,
        lineHeight: 1,
        letterSpacing: ".04em",
        pointerEvents: "none",
      }}
    >
      Build {buildSha === "local" ? "local" : buildSha.slice(0, 7)}
    </div>
  );
}
