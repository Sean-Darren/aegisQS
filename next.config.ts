import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const nextConfig: NextConfig = { turbopack: { root: process.cwd() } };
export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
