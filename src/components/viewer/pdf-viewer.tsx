"use client";
import dynamic from "next/dynamic";
export const PdfViewer = dynamic(
  () => import("./pdf-canvas").then((m) => m.PdfCanvas),
  { ssr: false },
);
