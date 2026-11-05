"use client";

import { useEffect, useRef, useState } from "react";

export function RasterCanvas({
  file,
  width,
  pixelRatio,
  onCanvas,
  loading,
  error,
}: {
  file: Blob;
  width: number;
  pixelRatio: number;
  onCanvas?: (canvas: HTMLCanvasElement) => void;
  loading: string;
  error: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCanvasRef = useRef(onCanvas);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onCanvasRef.current = onCanvas;
  }, [onCanvas]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const bitmap = await createImageBitmap(file);
        if (cancelled) {
          bitmap.close?.();
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) {
          bitmap.close?.();
          return;
        }

        const logicalWidth = width;
        const logicalHeight = Math.max(
          1,
          Math.round((logicalWidth * bitmap.height) / bitmap.width),
        );
        canvas.width = Math.max(1, Math.round(logicalWidth * pixelRatio));
        canvas.height = Math.max(1, Math.round(logicalHeight * pixelRatio));

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          bitmap.close?.();
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        setState("ready");
        onCanvasRef.current?.(canvas);
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [file, pixelRatio, width]);

  return (
    <>
      {state === "loading" ? <span>{loading}</span> : null}
      {state === "error" ? <span>{error}</span> : null}
      <canvas ref={canvasRef} style={{ width }} aria-hidden="true" />
    </>
  );
}
