"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useTranslations } from "next-intl";
import { ChevronsLeftRight } from "lucide-react";
import { PdfCanvas } from "./pdf-canvas";
import { RasterCanvas } from "./raster-canvas";
import { bboxPixels } from "./geometry";
import type { DrawingChange, DrawingComparison } from "@/schemas";
export type ViewerMode = "side" | "overlay" | "swipe";
export type CanvasControls = {
  setZoom: (value: number) => void;
  pan: (dx: number, dy: number) => void;
  fit: () => void;
  focus: (change: DrawingChange) => void;
};
const WIDTH = 640,
  HEIGHT = 452;
function tinted(source: HTMLCanvasElement, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const raw = color.trim().replace("#", "");
  const rgb =
    raw.length === 6
      ? [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16))
      : [0, 0, 0];
  for (let i = 0; i < pixels.data.length; i += 4) {
    const alpha =
      255 - (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
    pixels.data[i] = rgb[0];
    pixels.data[i + 1] = rgb[1];
    pixels.data[i + 2] = rgb[2];
    pixels.data[i + 3] = alpha;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
export function ComparisonCanvas({
  base,
  target,
  mode,
  alignment,
  onControls,
  onZoom,
  page = 1,
  baseLabel,
  targetLabel,
  baseMimeType,
  targetMimeType,
}: {
  base: Blob;
  target: Blob;
  mode: ViewerMode;
  alignment: DrawingComparison["alignment"];
  onControls: (controls: CanvasControls) => void;
  onZoom: (zoom: number) => void;
  page?: number;
  baseLabel: string;
  targetLabel: string;
  baseMimeType?: string;
  targetMimeType?: string;
}) {
  const t = useTranslations("Drawing");
  const refs = useRef<(ReactZoomPanPinchRef | null)[]>([]);
  const shared = useRef({ x: 0, y: 0, scale: 1 });
  const sources = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const displays = useRef<(HTMLCanvasElement | null)[]>([]);
  const tintedSources = useRef<(HTMLCanvasElement | null)[]>([null, null]);
  const [renderScale, setRenderScale] = useState(1);
  const [swipe, setSwipe] = useState(50);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const viewport = useRef<HTMLDivElement>(null);
  const baseIsImage = (baseMimeType ?? base.type).startsWith("image/");
  const targetIsImage = (targetMimeType ?? target.type).startsWith("image/");
  const aligning = useCallback(
    (ctx: CanvasRenderingContext2D, factor: number) => {
      ctx.translate(alignment.dx * factor, alignment.dy * factor);
      ctx.scale(alignment.scale, alignment.scale);
      ctx.translate((WIDTH * factor) / 2, (HEIGHT * factor) / 2);
      ctx.rotate((alignment.rotationDeg * Math.PI) / 180);
      ctx.translate((-WIDTH * factor) / 2, (-HEIGHT * factor) / 2);
    },
    [alignment],
  );
  const paint = useCallback(() => {
    const [a, b] = sources.current;
    if (!a || !b) return;
    const factor = a.width / WIDTH;
    const css = getComputedStyle(document.documentElement);
    if (!tintedSources.current[0])
      tintedSources.current = [
        tinted(a, css.getPropertyValue("--rev-base")),
        tinted(b, css.getPropertyValue("--rev-target")),
      ];
    for (const [index, canvas] of displays.current.entries()) {
      if (!canvas) continue;
      canvas.width = a.width;
      canvas.height = a.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = css.getPropertyValue("--paper");
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (mode === "side") {
        if (index === 0) ctx.drawImage(a, 0, 0);
        else {
          ctx.save();
          aligning(ctx, factor);
          ctx.drawImage(b, 0, 0);
          ctx.restore();
        }
      } else if (mode === "overlay") {
        ctx.drawImage(tintedSources.current[0]!, 0, 0);
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        aligning(ctx, factor);
        ctx.drawImage(tintedSources.current[1]!, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(a, 0, 0);
        ctx.save();
        ctx.beginPath();
        ctx.rect((canvas.width * swipe) / 100, 0, canvas.width, canvas.height);
        ctx.clip();
        ctx.fillStyle = css.getPropertyValue("--paper");
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        aligning(ctx, factor);
        ctx.drawImage(b, 0, 0);
        ctx.restore();
      }
    }
  }, [mode, swipe, aligning]);
  useEffect(() => paint(), [paint]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const captureA = useCallback(
    (canvas: HTMLCanvasElement) => {
      sources.current[0] = canvas;
      tintedSources.current = [null, null];
      paint();
    },
    [paint],
  );
  const captureB = useCallback(
    (canvas: HTMLCanvasElement) => {
      sources.current[1] = canvas;
      tintedSources.current = [null, null];
      paint();
    },
    [paint],
  );
  const transform = useCallback(
    (x: number, y: number, scale: number) => {
      shared.current = { x, y, scale };
      for (const ref of refs.current) ref?.setTransform(x, y, scale, 0);
      onZoom(scale);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setRenderScale(scale), 150);
    },
    [onZoom],
  );
  useEffect(() => {
    onControls({
      setZoom: (value) =>
        transform(
          shared.current.x,
          shared.current.y,
          Math.max(0.25, Math.min(4, value)),
        ),
      pan: (dx, dy) =>
        transform(
          shared.current.x + dx,
          shared.current.y + dy,
          shared.current.scale,
        ),
      fit: () => {
        const w =
          (viewport.current?.clientWidth ?? 640) / (mode === "side" ? 2 : 1);
        const scale = Math.max(
          0.25,
          Math.min(1, (w - 24) / WIDTH, 560 / HEIGHT),
        );
        transform((w - WIDTH * scale) / 2, 20, scale);
      },
      focus: (change) => {
        const b = bboxPixels(change.bbox, WIDTH, HEIGHT);
        const w =
          (viewport.current?.clientWidth ?? 640) / (mode === "side" ? 2 : 1);
        const scale = Math.min(
          4,
          Math.max(1, Math.min((w - 48) / b.w, 480 / b.h)),
        );
        transform(
          w / 2 - (b.x + b.w / 2) * scale,
          280 - (b.y + b.h / 2) * scale,
          scale,
        );
      },
    });
  }, [mode, onControls, transform]);
  return (
    <div
      ref={viewport}
      className="relative h-[600px] overflow-hidden bg-viewer-bg"
      data-testid="comparison-canvas"
    >
      <div
        className="pointer-events-none absolute -left-[10000px] top-0"
        aria-hidden="true"
      >
        {baseIsImage ? (
          <RasterCanvas
            file={base}
            width={WIDTH}
            pixelRatio={
              (typeof window !== "undefined" ? window.devicePixelRatio : 1) *
              renderScale
            }
            onCanvas={captureA}
            loading={t("loading")}
            error={t("pdfError")}
          />
        ) : (
          <PdfCanvas
            file={base}
            page={page}
            zoom={1}
            width={WIDTH}
            pixelRatio={
              (typeof window !== "undefined" ? window.devicePixelRatio : 1) *
              renderScale
            }
            onCanvas={captureA}
            framed={false}
            loading={t("loading")}
            error={t("pdfError")}
          />
        )}
        {targetIsImage ? (
          <RasterCanvas
            file={target}
            width={WIDTH}
            pixelRatio={
              (typeof window !== "undefined" ? window.devicePixelRatio : 1) *
              renderScale
            }
            onCanvas={captureB}
            loading={t("loading")}
            error={t("pdfError")}
          />
        ) : (
          <PdfCanvas
            file={target}
            page={page}
            zoom={1}
            width={WIDTH}
            pixelRatio={
              (typeof window !== "undefined" ? window.devicePixelRatio : 1) *
              renderScale
            }
            onCanvas={captureB}
            framed={false}
            loading={t("loading")}
            error={t("pdfError")}
          />
        )}
      </div>
      <div
        className={`grid h-full ${mode === "side" ? "grid-cols-2 gap-2" : "grid-cols-1"}`}
      >
        {Array.from({ length: mode === "side" ? 2 : 1 }, (_, index) => (
          <div className="relative min-w-0 overflow-hidden" key={index}>
            {mode === "side" && (
              <p className="absolute top-1 z-10 rounded-sm bg-panel px-2 py-1 text-xs">
                {index === 0 ? baseLabel : targetLabel}
              </p>
            )}
            <TransformWrapper
              minScale={0.25}
              maxScale={4}
              limitToBounds={false}
              doubleClick={{ disabled: true }}
              initialScale={1}
              initialPositionX={0}
              initialPositionY={0}
              onInit={(ref) => {
                refs.current[index] = ref;
                ref.setTransform(
                  shared.current.x,
                  shared.current.y,
                  shared.current.scale,
                  0,
                );
                paint();
              }}
              onTransform={(ref, state) => {
                const { positionX: x, positionY: y, scale } = state;
                if (
                  Math.abs(x - shared.current.x) +
                    Math.abs(y - shared.current.y) +
                    Math.abs(scale - shared.current.scale) <
                  0.001
                )
                  return;
                shared.current = { x, y, scale };
                refs.current.forEach((other, i) => {
                  if (i !== index) other?.setTransform(x, y, scale, 0);
                });
                clearTimeout(timer.current);
                timer.current = setTimeout(() => {
                  setRenderScale(scale);
                  onZoom(scale);
                }, 150);
              }}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: 600 }}
                contentStyle={{ width: WIDTH, height: HEIGHT }}
              >
                <div
                  className="relative bg-paper"
                  style={{ width: WIDTH, height: HEIGHT }}
                >
                  <canvas
                    ref={(node) => {
                      displays.current[index] = node;
                      if (node) paint();
                    }}
                    style={{ width: WIDTH, height: HEIGHT }}
                    role="img"
                    aria-label={t(
                      index === 0 && mode === "side"
                        ? "baseCanvas"
                        : "targetCanvas",
                    )}
                  />
                  {mode === "swipe" && (
                    <div
                      className="absolute inset-y-0 cursor-ew-resize touch-none border-l-2 border-ink"
                      style={{ left: `${swipe}%` }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        if (
                          !event.currentTarget.hasPointerCapture(
                            event.pointerId,
                          )
                        )
                          return;
                        const bounds =
                          event.currentTarget.parentElement!.getBoundingClientRect();
                        setSwipe(
                          Math.max(
                            0,
                            Math.min(
                              100,
                              ((event.clientX - bounds.left) / bounds.width) *
                                100,
                            ),
                          ),
                        );
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        if (
                          event.currentTarget.hasPointerCapture(event.pointerId)
                        )
                          event.currentTarget.releasePointerCapture(
                            event.pointerId,
                          );
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      aria-hidden="true"
                    >
                      <span className="absolute left-0 top-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-ink bg-panel text-ink">
                        <ChevronsLeftRight size={18} />
                      </span>
                    </div>
                  )}
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        ))}
      </div>
      {mode === "swipe" && (
        <label className="absolute bottom-3 left-3 right-3 rounded-md bg-panel p-2 text-sm">
          {t("divider")}
          <input
            type="range"
            min={0}
            max={100}
            value={swipe}
            onChange={(e) => setSwipe(Number(e.target.value))}
            className="w-full accent-clay-700"
          />
        </label>
      )}
    </div>
  );
}
