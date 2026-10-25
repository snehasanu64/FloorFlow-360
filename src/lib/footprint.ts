import type { ModelKey, Orientation } from "@/types/furniture";
import type { Tone } from "./color";

/**
 * Single source of truth for furniture footprints.
 * Shapes are expressed in local metres with the origin at the footprint centre,
 * +x to the right and +z toward the "front" of the piece (screen-down at rotation 0).
 * The same data feeds the Konva 2D editor, SVG catalogue thumbnails and collision checks,
 * which keeps the 2D footprint and 3D geometry consistent.
 */
export type FootShape =
  | { t: "poly"; pts: number[]; tone: Tone; dashed?: boolean }
  | { t: "ellipse"; cx: number; cz: number; rx: number; rz: number; tone: Tone; dashed?: boolean };

export interface LocalRect {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
}

export interface FootprintInput {
  model: ModelKey;
  width: number;
  depth: number;
  seats?: number;
  orientation?: Orientation;
}

const rect = (cx: number, cz: number, w: number, d: number, tone: Tone): FootShape => ({
  t: "poly",
  tone,
  pts: [cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, cx - w / 2, cz + d / 2],
});
const ellipse = (cx: number, cz: number, rx: number, rz: number, tone: Tone, dashed = false): FootShape => ({
  t: "ellipse",
  cx,
  cz,
  rx,
  rz,
  tone,
  dashed,
});

/** Proportions of the L-shaped sofa: s = depth of the main section, c = width of the chaise. */
export function lSofaLayout(w: number, d: number) {
  return { s: Math.min(0.95, d * 0.5), c: Math.min(1.0, w * 0.4) };
}

function sofaShapes(w: number, d: number, seats: number): FootShape[] {
  const arm = Math.min(0.14, w * 0.16);
  const back = Math.min(0.16, d * 0.2);
  const out: FootShape[] = [rect(0, 0, w, d, "base")];
  out.push(rect(-w / 2 + arm / 2, 0, arm, d, "dark"), rect(w / 2 - arm / 2, 0, arm, d, "dark"));
  out.push(rect(0, -d / 2 + back / 2, w - 2 * arm, back, "dark"));
  const inner = w - 2 * arm;
  const cw = inner / seats;
  for (let i = 0; i < seats; i++) {
    out.push(rect(-inner / 2 + cw * (i + 0.5), back / 2, cw - 0.03, d - back - 0.04, "light"));
  }
  return out;
}

function mirrorX(shapes: FootShape[]): FootShape[] {
  return shapes.map((s) =>
    s.t === "poly"
      ? { ...s, pts: s.pts.map((v, i) => (i % 2 === 0 ? -v : v)) }
      : { ...s, cx: -s.cx },
  );
}

function lSofaShapes(w: number, d: number, orientation: Orientation): FootShape[] {
  const { s, c } = lSofaLayout(w, d);
  const arm = 0.14;
  const back = 0.16;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const outline: FootShape = { t: "poly", tone: "base", pts: [x0, z0, x1, z0, x1, z1, x1 - c, z1, x1 - c, z0 + s, x0, z0 + s] };
  const shapes: FootShape[] = [
    outline,
    rect(0, z0 + back / 2, w, back, "dark"),
    rect(x0 + arm / 2, z0 + s / 2, arm, s, "dark"),
    rect(x1 - arm / 2, 0, arm, d, "dark"),
    // seat cushions
    rect((x0 + arm + (x1 - c)) / 2, (z0 + back + z0 + s) / 2, x1 - c - x0 - arm - 0.03, s - back - 0.04, "light"),
    rect(x1 - c / 2 - arm / 2 + 0.0, (z0 + back + z1) / 2, c - arm - 0.03, d - back - 0.04, "light"),
  ];
  return orientation === "left" ? mirrorX(shapes) : shapes;
}

function bedShapes(w: number, d: number, pillows: number): FootShape[] {
  const out: FootShape[] = [rect(0, 0, w, d, "base"), rect(0, -d / 2 + 0.04, w, 0.08, "dark")];
  const pw = (w - 0.2) / pillows;
  for (let i = 0; i < pillows; i++) out.push(rect(-w / 2 + 0.1 + pw * (i + 0.5), -d / 2 + 0.3, pw - 0.05, 0.36, "white"));
  out.push(rect(0, -d / 2 + 0.55 + (d - 0.55) / 2, w - 0.06, d - 0.55 - 0.02, "accent"));
  return out;
}

function boxWithFront(w: number, d: number, front = true): FootShape[] {
  const out: FootShape[] = [rect(0, 0, w, d, "base")];
  if (front) out.push(rect(0, d / 2 - 0.02, w - 0.04, 0.03, "dark"));
  return out;
}

export function footprintShapes(f: FootprintInput): FootShape[] {
  const { width: w, depth: d } = f;
  switch (f.model) {
    case "sofa":
      return sofaShapes(w, d, f.seats ?? 3);
    case "armchair":
      return sofaShapes(w, d, 1);
    case "lsofa":
      return lSofaShapes(w, d, f.orientation ?? "right");
    case "bed":
      return bedShapes(w, d, f.seats ?? 2);
    case "coffeeTable":
    case "diningTable":
    case "officeDesk":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.1, d - 0.1, "light")];
    case "dressingTable":
      return [rect(0, 0, w, d, "base"), rect(0, -d / 2 + 0.02, w * 0.6, 0.03, "glass"), rect(w / 2 - 0.15, 0, 0.3, d - 0.04, "dark")];
    case "sideTable":
      return [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w / 2 - 0.06, d / 2 - 0.06, "light")];
    case "tvUnit":
    case "sideboard":
    case "storageCabinet":
    case "wardrobe":
    case "decorCabinet":
    case "bedsideTable":
      return boxWithFront(w, d);
    case "bookshelf": {
      const out = boxWithFront(w, d, false);
      out.push(rect(0, -d / 2 + 0.015, w, 0.03, "dark"));
      return out;
    }
    case "diningChairs": {
      const cw = w / 2 - 0.02;
      const out: FootShape[] = [];
      for (const sx of [-1, 1]) {
        out.push(rect(sx * (w / 4), 0, cw, d, "base"), rect(sx * (w / 4), -d / 2 + 0.03, cw, 0.06, "dark"));
      }
      return out;
    }
    case "officeChair":
      return [ellipse(0, 0, w / 2, d / 2, "base"), rect(0, -d / 2 + 0.05, w * 0.7, 0.1, "dark"), ellipse(0, 0.02, w * 0.3, d * 0.3, "light")];
    case "floorLamp":
      return [ellipse(0, 0, w / 2, d / 2, "dark"), ellipse(0, 0, w * 0.22, d * 0.22, "light")];
    case "ceilingLight":
      return [ellipse(0, 0, w / 2, d / 2, "light", true), ellipse(0, 0, w * 0.18, d * 0.18, "white")];
    case "rug":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.2, d - 0.2, "light")];
    case "plant":
      return [ellipse(0, 0, w / 2, d / 2, "green"), ellipse(0, 0, w * 0.2, d * 0.2, "base")];
    case "ottoman":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.1, d - 0.1, "light")];
    case "chair":
      return [rect(0, 0, w, d, "base"), rect(0, -d / 2 + 0.03, w, 0.06, "dark")];
    case "barStool":
      return [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w * 0.32, d * 0.32, "light")];
    case "lDesk": {
      const { s, c } = lDeskLayout(w, d);
      const x0 = -w / 2;
      const x1 = w / 2;
      const z0 = -d / 2;
      const z1 = d / 2;
      const shapes: FootShape[] = [
        { t: "poly", tone: "base", pts: [x0, z0, x1, z0, x1, z1, x1 - c, z1, x1 - c, z0 + s, x0, z0 + s] },
        rect((x0 + x1 - c) / 2, z0 + s / 2, w - c - 0.1, s - 0.1, "light"),
        rect(x1 - c / 2, 0, c - 0.1, d - 0.1, "light"),
      ];
      return f.orientation === "left" ? mirrorX(shapes) : shapes;
    }
    case "drawers":
    case "wallCabinet":
    case "shoeRack":
    case "kitchenBase":
      return boxWithFront(w, d);
    case "piano":
      return [rect(0, 0, w, d, "base"), rect(0, d / 2 - 0.12, w - 0.04, 0.22, "white"), rect(0, -d / 2 + 0.05, w, 0.1, "dark")];
    case "fridge":
      return [rect(0, 0, w, d, "base"), rect(0, d / 2 - 0.02, w - 0.04, 0.03, "dark"), rect(w / 2 - 0.08, d / 2 - 0.06, 0.03, 0.08, "light")];
    case "stove": {
      const out: FootShape[] = [rect(0, 0, w, d, "base")];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(ellipse(sx * w * 0.24, sz * d * 0.22 - d * 0.04, w * 0.14, w * 0.14, "dark"));
      return out;
    }
    case "washer":
      return [rect(0, 0, w, d, "base"), ellipse(0, d * 0.1, w * 0.3, w * 0.3, "dark"), rect(0, -d / 2 + 0.05, w - 0.06, 0.08, "light")];
    case "sink":
      return [...boxWithFront(w, d), rect(-w * 0.15, -0.02, w * 0.36, d * 0.55, "light")];
    case "bathtub":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.14, d - 0.14, "light")];
    case "shower":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.12, d - 0.12, "glass"), ellipse(0, 0, 0.05, 0.05, "dark")];
    case "toilet":
      return [rect(0, -d / 2 + 0.1, w * 0.9, 0.2, "base"), ellipse(0, d * 0.12, w / 2, d * 0.38, "light")];
    case "vanity":
      return [...boxWithFront(w, d), ellipse(0, -0.02, w * 0.26, d * 0.28, "light")];
    case "crib":
    case "bunkBed":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.12, d - 0.12, "light")];
    case "mirror":
      return [rect(0, 0, w, d, "dark"), rect(0, d / 2 - 0.02, w - 0.04, 0.03, "glass")];
    case "glb":
      return boxWithFront(w, d);
    case "appliance":
      return [rect(0, 0, w, d, "base"), rect(0, d / 2 - 0.03, w - 0.06, 0.04, "dark"), rect(0, -d / 2 + 0.05, w - 0.1, 0.06, "light")];
    case "ac":
      return [rect(0, 0, w, d, "base"), rect(0, d / 2 - 0.02, w - 0.06, 0.03, "dark")];
    case "ceilingFan": {
      const out: FootShape[] = [ellipse(0, 0, w / 2, d / 2, "light", true), ellipse(0, 0, w * 0.08, d * 0.08, "dark")];
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const L = w * 0.45;
        const t = 0.035;
        out.push({ t: "poly", tone: "base", pts: [0.1 * c - t * sn, 0.1 * sn + t * c, L * c - t * sn, L * sn + t * c, L * c + t * sn, L * sn - t * c, 0.1 * c + t * sn, 0.1 * sn - t * c] });
      }
      return out;
    }
    case "standFan":
      return [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w * 0.32, d * 0.32, "light"), ellipse(0, 0, w * 0.06, d * 0.06, "dark")];
    case "beanbag":
      return [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w * 0.3, d * 0.3, "light")];
    case "basket":
      return [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w * 0.4, d * 0.4, "dark")];
    case "screen":
      return [rect(0, 0, w, d, "base"), rect(-w / 3, 0, 0.02, d, "dark"), rect(w / 3, 0, 0.02, d, "dark")];
    case "fireplace":
      return [rect(0, 0, w, d, "base"), rect(0, -d * 0.05, w * 0.5, d * 0.6, "dark"), ellipse(0, -d * 0.1, w * 0.07, d * 0.1, "wood")];
    case "jhula":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w * 0.8, d * 0.8, "light"), rect(0, -d * 0.35, w * 0.8, 0.05, "dark")];
    case "curtain":
      return [rect(0, 0, w, d, "base"), rect(-w * 0.25, 0, 0.01, d, "dark"), rect(0, 0, 0.01, d, "dark"), rect(w * 0.25, 0, 0.01, d, "dark")];
    case "treadmill":
      return [rect(0, 0, w, d, "base"), rect(0, 0.04, w * 0.6, d * 0.78, "dark"), rect(0, -d / 2 + 0.08, w * 0.72, 0.1, "light")];
    case "aquarium":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.08, d - 0.08, "glass")];
    case "rack":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.08, 0.02, "dark")];
    case "tree":
      return [ellipse(0, 0, w / 2, d / 2, "green"), ellipse(0, 0, w * 0.3, d * 0.3, "light"), ellipse(0, 0, w * 0.06, d * 0.06, "dark")];
    case "grandClock":
      return [rect(0, 0, w, d, "base"), rect(0, d / 2 - 0.02, w - 0.08, 0.025, "light")];
    case "wallArt":
      return [rect(0, 0, w, d, "base")];
    case "stairs": {
      // treads drawn as lines across the run; the arrow marks "up" (towards -z, the back of the item)
      const out: FootShape[] = [rect(0, 0, w, d, "base")];
      const n = Math.max(4, Math.round(d / 0.28));
      for (let i = 1; i < n; i++) out.push(rect(0, -d / 2 + (d * i) / n, w - 0.04, 0.012, "dark"));
      out.push(rect(-w / 2 + 0.03, 0, 0.06, d, "dark"), rect(w / 2 - 0.03, 0, 0.06, d, "dark"));
      return out;
    }
    case "spiralStairs": {
      const out: FootShape[] = [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w * 0.07, d * 0.07, "dark")];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rx = w / 2;
        const rz = d / 2;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const t = 0.012;
        // thin quad from the centre to the rim, along angle a
        out.push({ t: "poly", tone: "dark", pts: [0.07 * w * c - t * sn, 0.07 * d * sn + t * c, rx * c - t * sn, rz * sn + t * c, rx * c + t * sn, rz * sn - t * c, 0.07 * w * c + t * sn, 0.07 * d * sn - t * c] });
      }
      return out;
    }
    case "coatStand":
      return [ellipse(0, 0, w / 2, d / 2, "dark"), ellipse(0, 0, w * 0.1, d * 0.1, "light")];
    case "deepam":
      return [ellipse(0, 0, w / 2, d / 2, "base"), ellipse(0, 0, w * 0.3, d * 0.3, "light"), ellipse(0, 0, w * 0.08, d * 0.08, "dark")];
    case "tv":
      return [rect(0, 0, w, d, "base"), rect(0, d / 2 - 0.02, w - 0.04, 0.03, "glass")];
    case "chowki":
      return [rect(0, 0, w, d, "base"), rect(0, 0, w - 0.1, d - 0.1, "light")];
    case "mandir":
      return [rect(0, 0, w, d, "base"), rect(0, -d * 0.1, w - 0.12, d * 0.6, "dark"), ellipse(0, -d * 0.1, w * 0.1, d * 0.12, "wood"), rect(0, d / 2 - 0.02, w - 0.04, 0.03, "dark")];
  }
}

/** L-shaped desk: s = depth of the main top, c = width of the return. */
export function lDeskLayout(w: number, d: number) {
  return { s: Math.min(0.7, d * 0.5), c: Math.min(0.65, w * 0.4) };
}

/** Convex rectangles used for overlap / boundary checks (local metres). */
export function localRects(f: FootprintInput): LocalRect[] {
  const { width: w, depth: d } = f;
  if (f.model === "lsofa") {
    const { s, c } = lSofaLayout(w, d);
    const mainW = w - c;
    const flip = f.orientation === "left" ? -1 : 1;
    return [
      { cx: flip * (-w / 2 + mainW / 2), cz: -d / 2 + s / 2, hw: mainW / 2, hd: s / 2 },
      { cx: flip * (w / 2 - c / 2), cz: 0, hw: c / 2, hd: d / 2 },
    ];
  }
  if (f.model === "lDesk") {
    const { s, c } = lDeskLayout(w, d);
    const mainW = w - c;
    const flip = f.orientation === "left" ? -1 : 1;
    return [
      { cx: flip * (-w / 2 + mainW / 2), cz: -d / 2 + s / 2, hw: mainW / 2, hd: s / 2 },
      { cx: flip * (w / 2 - c / 2), cz: 0, hw: c / 2, hd: d / 2 },
    ];
  }
  return [{ cx: 0, cz: 0, hw: w / 2, hd: d / 2 }];
}
