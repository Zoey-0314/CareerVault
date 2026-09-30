import type { Metadata } from "next";
import "./globals.css";
import "./resume-reference.css";

export const metadata: Metadata = {
  title: "CareerVault — Career Memory & Resume Tailoring",
  description: "A verified career memory that turns real experiences, credentials, and project evidence into role-specific resumes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
