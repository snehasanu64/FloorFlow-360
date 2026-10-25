import { toneColor } from "@/lib/color";
import { footprintShapes } from "@/lib/footprint";
import type { CatalogItem } from "@/types/furniture";

function pointsAttr(pts: number[]) {
  const out: string[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(`${pts[i]},${pts[i + 1]}`);
  return out.join(" ");
}

/** Top-down SVG thumbnail rendered from the same footprint data as the 2D editor. */
export function FootprintThumb({ cat, color, size = 64 }: { cat: CatalogItem; color?: string; size?: number }) {
  const base = color ?? cat.defaultColor;
  const shapes = footprintShapes({ model: cat.model, width: cat.width, depth: cat.depth, seats: cat.seats, orientation: cat.defaultOrientation });
  const pad = 0.06 * Math.max(cat.width, cat.depth);
  const vw = cat.width + pad * 2;
  const vd = cat.depth + pad * 2;
  return (
    <svg width={size} height={size} viewBox={`${-vw / 2} ${-vd / 2} ${vw} ${vd}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {shapes.map((s, i) =>
        s.t === "poly" ? (
          <polygon
            key={i}
            points={pointsAttr(s.pts)}
            fill={toneColor(base, s.tone)}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={vw * 0.006}
            strokeLinejoin="round"
          />
        ) : (
          <ellipse
            key={i}
            cx={s.cx}
            cy={s.cz}
            rx={s.rx}
            ry={s.rz}
            fill={toneColor(base, s.tone)}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={vw * 0.006}
            strokeDasharray={s.dashed ? `${vw * 0.02}` : undefined}
          />
        ),
      )}
    </svg>
  );
}
