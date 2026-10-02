"use client";

import { useEffect, useState } from "react";

export function DeploymentNotice() {
  const [isPages, setIsPages] = useState(false);

  useEffect(() => {
    setIsPages(window.location.hostname === "zoey-0314.github.io");
  }, []);

  if (!isPages) return null;

  return (
    <aside
      role="note"
      aria-label="GitHub Pages mirror notice"
      style={{
        position: "fixed",
        right: 12,
        bottom: 48,
        zIndex: 9998,
        maxWidth: 340,
        padding: "10px 12px",
        border: "1px solid rgba(90,100,92,.18)",
        borderRadius: 12,
        background: "rgba(250,249,246,.95)",
        backdropFilter: "blur(10px)",
        color: "#5f665f",
        fontSize: 11,
        lineHeight: 1.55,
        boxShadow: "0 10px 30px rgba(39,43,39,.08)",
      }}
    >
      <strong style={{ display: "block", color: "#303530", marginBottom: 3 }}>GitHub Pages 是镜像入口</strong>
      <span>本地数据按域名隔离，不会与 Vercel 正式入口自动共享。</span>{" "}
      <a href="https://career-vault-sage.vercel.app/" style={{ color: "#3f5147", fontWeight: 700 }}>打开正式入口</a>
    </aside>
  );
}
