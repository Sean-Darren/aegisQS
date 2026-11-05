import type { ReactNode } from "react";
import localFont from "next/font/local";
import Script from "next/script";
import "./style.css";
const karla = localFont({
  src: "../public/fonts/karla-latin.woff2",
  weight: "200 800",
  variable: "--addin-karla",
  display: "swap",
});
export const metadata = { title: "Smart QS Excel add-in" };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={karla.variable}>
        <Script
          id="office-history-save"
          strategy="beforeInteractive"
        >{`window.__smartQsHistory={pushState:history.pushState,replaceState:history.replaceState};`}</Script>
        <Script
          src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
          strategy="beforeInteractive"
        />
        <Script
          id="office-history-restore"
          strategy="beforeInteractive"
        >{`if(window.__smartQsHistory){history.pushState=window.__smartQsHistory.pushState;history.replaceState=window.__smartQsHistory.replaceState;delete window.__smartQsHistory;}`}</Script>
        {children}
      </body>
    </html>
  );
}
