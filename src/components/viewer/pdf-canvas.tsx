"use client";
import { useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import type { BBox } from "@/schemas";
export type { BBox } from "@/schemas";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfCanvas({
  file,
  page,
  bbox,
  zoom,
  loading,
  error,
  highlightText,
  width = 480,
  pixelRatio,
  onCanvas,
  framed = true,
}: {
  file: Blob;
  page: number;
  bbox?: BBox;
  zoom: number;
  loading: string;
  error: string;
  highlightText?: string;
  width?: number;
  pixelRatio?: number;
  onCanvas?: (canvas: HTMLCanvasElement) => void;
  framed?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  function escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char] ?? char,
    );
  }
  return (
    <div
      className={
        framed
          ? "overflow-auto border border-line bg-viewer-bg p-3"
          : "relative"
      }
    >
      <Document file={file} loading={loading} error={error} suspense={false}>
        <div className="relative mx-auto w-fit bg-panel">
          <Page
            pageNumber={page}
            width={width}
            canvasRef={canvas}
            devicePixelRatio={pixelRatio}
            onRenderSuccess={() => {
              if (canvas.current) onCanvas?.(canvas.current);
            }}
            scale={zoom}
            renderAnnotationLayer={false}
            renderTextLayer={!!highlightText}
            customTextRenderer={
              highlightText
                ? ({ str }) => {
                    const at = str
                      .toLocaleLowerCase()
                      .indexOf(highlightText.toLocaleLowerCase());
                    if (at < 0) return escapeHtml(str);
                    return `${escapeHtml(str.slice(0, at))}<mark class="drawing-text-highlight">${escapeHtml(str.slice(at, at + highlightText.length))}</mark>${escapeHtml(str.slice(at + highlightText.length))}`;
                  }
                : undefined
            }
            loading={loading}
            error={error}
            suspense={false}
          />
          {bbox && (
            <span
              data-testid="drawing-bbox"
              aria-hidden="true"
              className="drawing-highlight pointer-events-none absolute border-b-2 border-clay-600 bg-limewash/70 mix-blend-multiply"
              style={{
                left: `${bbox.x * 100}%`,
                top: `${bbox.y * 100}%`,
                width: `${bbox.w * 100}%`,
                height: `${bbox.h * 100}%`,
              }}
            />
          )}
        </div>
      </Document>
    </div>
  );
}
