import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_ACTIONS === "true";
const repoBasePath = "/CareerVault";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: isGithubPages ? repoBasePath : "",
  assetPrefix: isGithubPages ? `${repoBasePath}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
