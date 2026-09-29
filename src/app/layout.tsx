import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerVault",
  description: "Build a verified career memory and tailor it for every opportunity.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
