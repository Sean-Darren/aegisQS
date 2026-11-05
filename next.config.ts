import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  distDir: process.env.AEGISQS_NEXT_DIST_DIR || ".next",
};
export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
