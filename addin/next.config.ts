import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd().endsWith("/addin")
    ? process.cwd() + "/.."
    : process.cwd(),
  serverExternalPackages: ["msw"],
  allowedDevOrigins: ["*.officeapps.live.com", "*.office.com"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};
export default config;
