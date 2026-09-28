import { Karla, Noto_Sans_HK } from "next/font/google";
export const karla = Karla({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-karla",
  display: "swap",
});
export const notoSansHK = Noto_Sans_HK({
  weight: ["400", "500", "700"],
  variable: "--font-noto-hk",
  display: "swap",
  preload: false,
});
