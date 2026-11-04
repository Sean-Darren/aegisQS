"use client";
import type { DrawingChange, DrawingComparison } from "@/schemas";
import { bboxPixels, revisionCloudPath } from "./geometry";
import { confidenceThresholds } from "@/lib/config";
export function RevisionClouds({
  changes,
  width,
  height,
  selectedId,
  onSelect,
  zoom = 1,
  alignment,
}: {
  changes: DrawingChange[];
  width: number;
  height: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  zoom?: number;
  alignment?: DrawingComparison["alignment"];
}) {
  return (
    <svg
      className="revision-clouds pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <g
        transform={
          alignment
            ? `translate(${alignment.dx} ${alignment.dy}) scale(${alignment.scale}) rotate(${alignment.rotationDeg} ${width / 2} ${height / 2})`
            : undefined
        }
      >
        {changes.map((change) => {
          const b = bboxPixels(change.bbox, width, height);
          const selected = change.id === selectedId;
          const pad = 8 / zoom;
          const tag = 22 / zoom;
          return (
            <g
              key={change.id}
              data-change-cloud={change.id}
              onClick={() => onSelect?.(change.id)}
              className="pointer-events-auto cursor-pointer"
            >
              <path
                d={revisionCloudPath(
                  b.x - pad,
                  b.y - pad,
                  b.w + pad * 2,
                  b.h + pad * 2,
                  10 / zoom,
                )}
                stroke="var(--clay-600)"
                strokeWidth={
                  (selected ? 3 : change.status === "no_variation" ? 1.5 : 2) /
                  zoom
                }
                strokeDasharray={
                  change.confidence < confidenceThresholds.change ||
                  change.status === "no_variation"
                    ? `${5 / zoom} ${3 / zoom}`
                    : undefined
                }
                fill={
                  change.status === "no_variation" ? "none" : "var(--limewash)"
                }
                fillOpacity={selected ? 0.7 : 0.4}
                style={{ mixBlendMode: "multiply" }}
              />
              <path
                d={`M ${b.x + b.w} ${b.y - pad - tag} l ${tag / 2} ${tag} h ${-tag} Z`}
                fill="var(--ink)"
                stroke={selected ? "var(--lichen)" : "none"}
                strokeWidth={2 / zoom}
              />
              <text
                x={b.x + b.w}
                y={b.y - pad - 3 / zoom}
                textAnchor="middle"
                fill="var(--primary-foreground)"
                fontSize={12 / zoom}
                fontWeight={700}
                className="tabular-nums"
              >
                {change.number}
              </text>
              {change.status === "potential_variation" && (
                <text
                  x={b.x + b.w + tag}
                  y={b.y - pad}
                  fill="var(--caution)"
                  fontSize={16 / zoom}
                >
                  △
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
