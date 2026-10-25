import type { RoomConfig } from "@/types/room";

export interface P2 {
  x: number;
  z: number;
}

export interface Edge {
  index: number;
  a: P2;
  b: P2;
  /** Unit direction a -> b. */
  dir: P2;
  /** Unit outward normal (away from the room interior). */
  normal: P2;
  length: number;
  /** Direction angle in degrees (clockwise on screen), used as the Konva rotation. */
  angleDeg: number;
}

type ShapeParams = Pick<RoomConfig, "length" | "width" | "shape" | "shapeOrient" | "cutW" | "cutD">;

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Smallest wall segment we allow when cutting a shape out of the bounding box. */
const MIN_SEG = 0.6;

function basePolygon(shape: RoomShape, L: number, W: number, cutW: number, cutD: number): P2[] {
  const p = (x: number, z: number): P2 => ({ x, z });
  switch (shape) {
    case "rect":
      return [p(0, 0), p(L, 0), p(L, W), p(0, W)];
    case "L": {
      const cw = clampN(cutW, MIN_SEG, L - MIN_SEG);
      const cd = clampN(cutD, MIN_SEG, W - MIN_SEG);
      return [p(0, 0), p(L - cw, 0), p(L - cw, cd), p(L, cd), p(L, W), p(0, W)];
    }
    case "T": {
      const cw = clampN(cutW, MIN_SEG, L / 2 - MIN_SEG);
      const cd = clampN(cutD, MIN_SEG, W - MIN_SEG);
      return [p(0, 0), p(L, 0), p(L, W - cd), p(L - cw, W - cd), p(L - cw, W), p(cw, W), p(cw, W - cd), p(0, W - cd)];
    }
    case "U": {
      const cw = clampN(cutW, MIN_SEG, L - 2 * MIN_SEG);
      const cd = clampN(cutD, MIN_SEG, W - MIN_SEG);
      const xa = (L - cw) / 2;
      return [p(0, 0), p(xa, 0), p(xa, cd), p(xa + cw, cd), p(xa + cw, 0), p(L, 0), p(L, W), p(0, W)];
    }
    case "chamfer": {
      const cw = clampN(cutW, MIN_SEG, L - MIN_SEG);
      const cd = clampN(cutD, MIN_SEG, W - MIN_SEG);
      return [p(0, 0), p(L - cw, 0), p(L, cd), p(L, W), p(0, W)];
    }
  }
}

type RoomShape = RoomConfig["shape"];

/** Floor outline in room metres, clockwise on screen. */
export function roomPolygon(r: ShapeParams): P2[] {
  const odd = r.shapeOrient % 2 === 1;
  const Lb = odd ? r.width : r.length;
  const Wb = odd ? r.length : r.width;
  let pts = basePolygon(r.shape, Lb, Wb, r.cutW, r.cutD);
  for (let k = 0; k < r.shapeOrient; k++) {
    // 90° clockwise on screen: (x, z) -> (-z, x)
    pts = pts.map((q) => ({ x: -q.z, z: q.x }));
    const minX = Math.min(...pts.map((q) => q.x));
    const minZ = Math.min(...pts.map((q) => q.z));
    pts = pts.map((q) => ({ x: q.x - minX, z: q.z - minZ }));
  }
  return pts;
}

export function polygonEdges(poly: P2[]): Edge[] {
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1e-9;
    const dir = { x: dx / length, z: dz / length };
    return {
      index: i,
      a,
      b,
      dir,
      normal: { x: dir.z, z: -dir.x },
      length,
      angleDeg: (Math.atan2(dir.z, dir.x) * 180) / Math.PI,
    };
  });
}

export const roomEdges = (r: ShapeParams) => polygonEdges(roomPolygon(r));

export function polygonArea(poly: P2[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

const onSegment = (p: P2, a: P2, b: P2, eps: number) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1e-12;
  const t = clampN(((p.x - a.x) * dx + (p.z - a.z) * dz) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)) <= eps;
};

/** Point-in-polygon; points within `eps` of the boundary count as inside. */
export function pointInPolygon(p: P2, poly: P2[], eps = 1e-4): boolean {
  for (let i = 0; i < poly.length; i++) if (onSegment(p, poly[i], poly[(i + 1) % poly.length], eps)) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function cross(o: P2, a: P2, b: P2) {
  return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
}

/** True when two segments cross at a point interior to both (touching / collinear does not count). */
function properCross(a: P2, b: P2, c: P2, d: P2, eps = 1e-6) {
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/**
 * True when a convex quad (4 corners) lies inside the polygon:
 * all corners inside, no polygon edge crosses a quad edge and no polygon vertex pokes into the quad.
 */
export function quadInsidePolygon(quad: P2[], poly: P2[], eps = 1e-4): boolean {
  if (!quad.every((q) => pointInPolygon(q, poly, eps))) return false;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    for (let j = 0; j < poly.length; j++) {
      if (properCross(a, b, poly[j], poly[(j + 1) % poly.length])) return false;
    }
  }
  // reflex vertices strictly inside the quad
  for (const v of poly) {
    const s = [0, 1, 2, 3].map((i) => cross(quad[i], quad[(i + 1) % 4], v));
    if (s.every((c) => c > 1e-5) || s.every((c) => c < -1e-5)) return false;
  }
  return true;
}

/** Intersection of two infinite lines given as point + direction. */
function lineIntersect(p: P2, d: P2, q: P2, e: P2): P2 | null {
  const den = d.x * e.z - d.z * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / den;
  return { x: p.x + d.x * t, z: p.z + d.z * t };
}

/**
 * Outer wall corners for every vertex, mitred between neighbouring walls.
 * result[i] is the outer point belonging to vertex i (the start of edge i).
 */
export function outerCorners(edges: Edge[], t: number): P2[] {
  const n = edges.length;
  return edges.map((e, i) => {
    const prev = edges[(i + n - 1) % n];
    const p1 = { x: prev.a.x + prev.normal.x * t, z: prev.a.z + prev.normal.z * t };
    const p2 = { x: e.a.x + e.normal.x * t, z: e.a.z + e.normal.z * t };
    return lineIntersect(p1, prev.dir, p2, e.dir) ?? p2;
  });
}

const DIRS = ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"];

/** Compass-style label from a unit vector on the plan (top = north when northAngle = 0). */
export function compassLabel(v: P2, northAngle = 0): string {
  // angle measured clockwise from "up" (-z)
  let deg = (Math.atan2(v.x, -v.z) * 180) / Math.PI - northAngle;
  deg = ((deg % 360) + 360) % 360;
  return DIRS[Math.round(deg / 45) % 8];
}

export const wallLabel = (e: Edge, northAngle = 0) => `Wall ${e.index + 1} (${compassLabel(e.normal, northAngle)})`;

/** Distance from `o` along unit direction `d` to the nearest polygon edge, or null when nothing is hit. */
export function rayToPolygon(o: P2, d: P2, poly: P2[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - o.x) * ez - (a.z - o.z) * ex) / den;
    const u = ((a.x - o.x) * d.z - (a.z - o.z) * d.x) / den;
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && (best === null || t < best)) best = t;
  }
  return best;
}
