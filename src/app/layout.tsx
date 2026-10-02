import type { Metadata } from "next";
import "./globals.css";
import "./resume-reference.css";
import { ProviderUiSync } from "@/components/ProviderUiSync";

export const metadata: Metadata = {
  title: "CareerVault — Career Memory & Resume Tailoring",
  description: "A verified career memory that turns real experiences, credentials, and project evidence into role-specific resumes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || "local";
  return (
    <html lang="zh-CN" data-build={buildSha}>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="careervault-build" content={buildSha} />
      </head>
      <body>
        {children}
        <ProviderUiSync />
      </body>
    </html>
  );
}
