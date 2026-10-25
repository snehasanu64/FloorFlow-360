import { getCatalogItem } from "@/data/furniture-catalog";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";
import { getRoomPolygon, isInsideRoom, itemRects, itemsOverlap, rectsOverlap, type OrientedRect } from "./geometry";
import { normalizeDeg, round } from "./measurements";
import { createPlacedItem } from "./placement";
import { polygonEdges, type Edge, type P2 } from "./roomShape";

/**
 * Rule-based room arranger. Furniture is placed against walls (backs to the wall, facing in),
 * in front of / beside anchor pieces, and in corners, keeping walking clearances and never
 * blocking door swings (or windows, for tall pieces). Everything it places is validated against
 * the room outline and against the pieces already placed.
 */
export type RoomKind = "living" | "bedroom" | "dining" | "office" | "kitchen" | "pooja" | "kids" | "bathroom";

export const ROOM_KINDS: { value: RoomKind; label: string }[] = [
  { value: "living", label: "Living room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "dining", label: "Dining room" },
  { value: "kitchen", label: "Kitchen" },
  { value: "office", label: "Home office" },
  { value: "kids", label: "Kids room" },
  { value: "bathroom", label: "Bathroom" },
  { value: "pooja", label: "Pooja room" },
];

export interface AutoResult {
  items: PlacedItem[];
  skipped: string[];
}

interface Ctx {
  room: RoomConfig;
  edges: Edge[];
  placed: PlacedItem[];
  wall: Record<string, { edge: Edge; u: number }>;
  doorBlockers: OrientedRect[];
  windowBlockers: OrientedRect[];
  skipped: string[];
  ref: Record<string, PlacedItem>;
}

const axisAligned = (e: Edge) => Math.abs(e.normal.x) < 1e-6 || Math.abs(e.normal.z) < 1e-6;

function edgeRect(e: Edge, offset: number, width: number, depth: number): OrientedRect {
  // local x along the wall, local z into the room (the same convention items use)
  const cx = e.a.x + e.dir.x * offset - e.normal.x * (depth / 2);
  const cz = e.a.z + e.dir.z * offset - e.normal.z * (depth / 2);
  return { cx, cz, hw: width / 2, hd: depth / 2, rot: e.angleDeg };
}

function makeCtx(room: RoomConfig, keep: PlacedItem[]): Ctx {
  const edges = polygonEdges(getRoomPolygon(room));
  const door: OrientedRect[] = [];
  const win: OrientedRect[] = [];
  for (const o of room.openings) {
    const e = edges[o.edge];
    if (!e) continue;
    if (o.type === "door") door.push(edgeRect(e, o.offset, o.width + 0.2, o.width));
    else win.push(edgeRect(e, o.offset, o.width, 0.3));
  }
  return { room, edges, placed: [...keep], wall: {}, doorBlockers: door, windowBlockers: win, skipped: [], ref: {} };
}

const ignores = (it: PlacedItem) => !!getCatalogItem(it.catalogId)?.ignoreCollision;

function valid(ctx: Ctx, it: PlacedItem, clearance: number): boolean {
  if (!isInsideRoom(it, ctx.room)) return false;
  if (!ignores(it)) {
    const probe = clearance > 0 ? { ...it, width: it.width + 2 * clearance, depth: it.depth + 2 * clearance } : it;
    for (const o of ctx.placed) if (!ignores(o) && itemsOverlap(probe, o)) return false;
    const rects = itemRects(probe);
    for (const r of rects) {
      for (const b of ctx.doorBlockers) if (rectsOverlap(r, b)) return false;
      if (it.height > 1.0) for (const b of ctx.windowBlockers) if (rectsOverlap(r, b)) return false;
    }
  }
  return true;
}

function make(ctx: Ctx, id: string, patch: Partial<PlacedItem> = {}): PlacedItem | null {
  const cat = getCatalogItem(id);
  if (!cat) return null;
  void ctx;
  return { ...createPlacedItem(cat), ...patch };
}

function commit(ctx: Ctx, it: PlacedItem, key?: string): PlacedItem {
  const placed = { ...it, x: round(it.x, 4), z: round(it.z, 4), rotation: normalizeDeg(round(it.rotation, 2)) };
  ctx.placed.push(placed);
  if (key) ctx.ref[key] = placed;
  return placed;
}

function skip(ctx: Ctx, id: string) {
  const name = getCatalogItem(id)?.name ?? id;
  ctx.skipped.push(name);
}

interface WallOpts {
  /** Lower is better. */
  edgeScore?: (e: Edge) => number;
  /** 0..1 along the wall, or a point to stay close to. */
  anchor?: number | P2;
  clear?: number;
  key?: string;
  colour?: string;
  /** Gap between the item and the wall. */
  gap?: number;
}

/** Back against a wall, front facing the room. */
function onWall(ctx: Ctx, id: string, o: WallOpts = {}): PlacedItem | null {
  const base = make(ctx, id, o.colour ? { color: o.colour } : {});
  if (!base) return null;
  const clear = o.clear ?? 0.1;
  let best: { it: PlacedItem; edge: Edge; u: number; score: number } | null = null;
  for (const e of ctx.edges) {
    if (!axisAligned(e) || e.length < base.width + 0.1) continue;
    const lo = base.width / 2 + 0.03;
    const hi = e.length - base.width / 2 - 0.03;
    const es = (o.edgeScore?.(e) ?? 0) * 10;
    for (let u = lo; u <= hi + 1e-6; u += 0.05) {
      const cx = e.a.x + e.dir.x * u - e.normal.x * (base.depth / 2 + (o.gap ?? 0));
      const cz = e.a.z + e.dir.z * u - e.normal.z * (base.depth / 2 + (o.gap ?? 0));
      const cand = { ...base, x: cx, z: cz, rotation: e.angleDeg };
      if (!valid(ctx, cand, clear)) continue;
      let target: number;
      if (typeof o.anchor === "object") target = (o.anchor.x - e.a.x) * e.dir.x + (o.anchor.z - e.a.z) * e.dir.z;
      else target = e.length * (o.anchor ?? 0.5);
      const score = es + Math.abs(u - target);
      if (!best || score < best.score) best = { it: cand, edge: e, u, score };
    }
  }
  if (!best) {
    skip(ctx, id);
    return null;
  }
  const placed = commit(ctx, best.it, o.key);
  ctx.wall[placed.id] = { edge: best.edge, u: best.u };
  return placed;
}

const rightOf = (rot: number): P2 => ({ x: Math.cos((rot * Math.PI) / 180), z: Math.sin((rot * Math.PI) / 180) });
const frontOf = (rot: number): P2 => ({ x: -Math.sin((rot * Math.PI) / 180), z: Math.cos((rot * Math.PI) / 180) });

interface RelOpts {
  gap?: number;
  clear?: number;
  key?: string;
  /** Rotate so the new piece faces the reference. */
  faceRef?: boolean;
  colour?: string;
  /** Extra rotation applied after copying the reference's rotation. */
  rotate?: number;
}

/** In front of `ref` (along its front direction). Tries small sideways shifts if the first spot is taken. */
function inFront(ctx: Ctx, id: string, ref: PlacedItem | null | undefined, o: RelOpts = {}): PlacedItem | null {
  if (!ref) {
    skip(ctx, id);
    return null;
  }
  const base = make(ctx, id, o.colour ? { color: o.colour } : {});
  if (!base) return null;
  const f = frontOf(ref.rotation);
  const r = rightOf(ref.rotation);
  const rot = ref.rotation + (o.faceRef ? 180 : 0) + (o.rotate ?? 0);
  for (const along of [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5]) {
    for (const gap of [o.gap ?? 0.4, (o.gap ?? 0.4) - 0.15, (o.gap ?? 0.4) + 0.2]) {
      const dist = ref.depth / 2 + Math.max(0.02, gap) + base.depth / 2;
      const cand = { ...base, x: ref.x + f.x * dist + r.x * along, z: ref.z + f.z * dist + r.z * along, rotation: rot };
      if (valid(ctx, cand, o.clear ?? 0.05)) return commit(ctx, cand, o.key);
    }
  }
  skip(ctx, id);
  return null;
}

/** Next to `ref` on its left or right. */
function beside(ctx: Ctx, id: string, ref: PlacedItem | null | undefined, side: "left" | "right", o: RelOpts = {}): PlacedItem | null {
  if (!ref) {
    skip(ctx, id);
    return null;
  }
  const base = make(ctx, id, o.colour ? { color: o.colour } : {});
  if (!base) return null;
  const sgn = side === "right" ? 1 : -1;
  const r = rightOf(ref.rotation);
  const f = frontOf(ref.rotation);
  const rot = ref.rotation + (o.rotate ?? 0);
  for (const gap of [o.gap ?? 0.05, (o.gap ?? 0.05) + 0.2]) {
    for (const fwd of [0, 0.1, -0.1]) {
      const dist = ref.width / 2 + gap + (o.rotate ? base.depth : base.width) / 2;
      const cand = { ...base, x: ref.x + r.x * sgn * dist + f.x * fwd, z: ref.z + r.z * sgn * dist + f.z * fwd, rotation: rot };
      if (valid(ctx, cand, o.clear ?? 0.02)) return commit(ctx, cand, o.key);
    }
  }
  skip(ctx, id);
  return null;
}

/** Same footprint centre as `ref` (rugs under tables, ceiling lights above them). */
function centredOn(ctx: Ctx, id: string, ref: PlacedItem | null | undefined, o: { colour?: string; key?: string; w?: number; d?: number } = {}) {
  if (!ref) return null;
  const base = make(ctx, id, o.colour ? { color: o.colour } : {});
  if (!base) return null;
  const cand = {
    ...base,
    x: ref.x,
    z: ref.z,
    rotation: ref.rotation,
    width: o.w ?? base.width,
    depth: o.d ?? base.depth,
  };
  if (!isInsideRoom(cand, ctx.room)) return null;
  return commit(ctx, cand, o.key);
}

/** Convex corner positions (the polygon vertices) with the inward diagonal. */
function corners(ctx: Ctx) {
  const n = ctx.edges.length;
  return ctx.edges.map((e, i) => {
    const prev = ctx.edges[(i + n - 1) % n];
    const cross = prev.dir.x * e.dir.z - prev.dir.z * e.dir.x;
    return { p: e.a, convex: cross > 0, inward: { x: -(prev.normal.x + e.normal.x) / 1, z: -(prev.normal.z + e.normal.z) / 1 } };
  });
}

/** Free-standing piece pushed into a corner, preferring corners near `near` (or the first free one). */
function inCorner(ctx: Ctx, id: string, o: { near?: P2; key?: string; clear?: number; colour?: string } = {}): PlacedItem | null {
  const base = make(ctx, id, o.colour ? { color: o.colour } : {});
  if (!base) return null;
  let best: { it: PlacedItem; score: number } | null = null;
  for (const c of corners(ctx)) {
    if (!c.convex) continue;
    for (const k of [0.03, 0.1]) {
      // push fully into the corner using the axis-aligned components of the inward diagonal
      const cand = { ...base, x: c.p.x + Math.sign(c.inward.x) * (base.width / 2 + k), z: c.p.z + Math.sign(c.inward.z) * (base.depth / 2 + k), rotation: 0 };
      if (!valid(ctx, cand, o.clear ?? 0.05)) continue;
      const score = o.near ? Math.hypot(c.p.x - o.near.x, c.p.z - o.near.z) : 0;
      if (!best || score < best.score) best = { it: cand, score };
      break;
    }
  }
  if (!best) {
    skip(ctx, id);
    return null;
  }
  return commit(ctx, best.it, o.key);
}

/** Roughly the centre of the floor, preferring spots with the most clearance. */
function inMiddle(ctx: Ctx, id: string, o: { rotation?: number; clear?: number; key?: string; colour?: string; near?: P2 } = {}): PlacedItem | null {
  const base = make(ctx, id, o.colour ? { color: o.colour } : {});
  if (!base) return null;
  const poly = getRoomPolygon(ctx.room);
  const c = o.near ?? { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, z: poly.reduce((s, p) => s + p.z, 0) / poly.length };
  let best: { it: PlacedItem; d: number } | null = null;
  for (let dx = -ctx.room.length / 2; dx <= ctx.room.length / 2; dx += 0.1) {
    for (let dz = -ctx.room.width / 2; dz <= ctx.room.width / 2; dz += 0.1) {
      const cand = { ...base, x: c.x + dx, z: c.z + dz, rotation: o.rotation ?? 0 };
      const d = Math.hypot(dx, dz);
      if (best && d >= best.d) continue;
      if (valid(ctx, cand, o.clear ?? 0.5)) best = { it: cand, d };
    }
  }
  if (!best) {
    skip(ctx, id);
    return null;
  }
  return commit(ctx, best.it, o.key);
}

const hasOpenings = (ctx: Ctx, e: Edge) => ctx.room.openings.some((o) => o.edge === e.index);
const dot = (a: P2, b: P2) => a.x * b.x + a.z * b.z;

/** Longest wall, preferring walls without doors or windows. */
const calmLongWall = (ctx: Ctx) => (e: Edge) => (hasOpenings(ctx, e) ? 2 : 0) - e.length / 5;
const oppositeOf = (n: P2) => (e: Edge) => dot(e.normal, n);

function living(ctx: Ctx) {
  const tv = onWall(ctx, "tv-unit", { edgeScore: calmLongWall(ctx), clear: 0.05, key: "tv" });
  const tvN = tv ? ctx.wall[tv.id].edge.normal : { x: 0, z: -1 };
  if (tv) {
    const w = ctx.wall[tv.id];
    const mount = make(ctx, "tv-wall");
    if (mount) {
      const cand = { ...mount, x: w.edge.a.x + w.edge.dir.x * w.u - w.edge.normal.x * 0.03, z: w.edge.a.z + w.edge.dir.z * w.u - w.edge.normal.z * 0.03, rotation: w.edge.angleDeg };
      if (isInsideRoom(cand, ctx.room)) commit(ctx, cand);
    }
  }
  let sofa = onWall(ctx, "sofa-3", { edgeScore: oppositeOf(tvN), clear: 0.3, key: "sofa" });
  if (!sofa) sofa = onWall(ctx, "sofa-2", { edgeScore: oppositeOf(tvN), clear: 0.3, key: "sofa" });
  const table = inFront(ctx, "coffee-table", sofa, { gap: 0.45, key: "table" });
  if (table) centredOn(ctx, "rug", table, { w: Math.min(2.4, Math.max(table.width + 0.9, 1.6)), d: Math.min(1.8, table.depth + 1.2) });
  if (table && sofa) {
    const chair = beside(ctx, "armchair", table, "right", { gap: 0.35, rotate: 90, colour: "#1f3556", clear: 0.1 });
    if (!chair) beside(ctx, "armchair", table, "left", { gap: 0.35, rotate: -90, colour: "#1f3556", clear: 0.1 });
  }
  beside(ctx, "side-table", sofa, "left", { gap: 0.05 });
  onWall(ctx, "bookshelf", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0) + dot(e.normal, tvN) * 0 - e.length / 8, clear: 0.2 });
  inCorner(ctx, "plant");
  inCorner(ctx, "floor-lamp", { near: sofa ? { x: sofa.x, z: sofa.z } : undefined });
  centredOn(ctx, "ceiling-light", table ?? sofa);
}

function bedroom(ctx: Ctx) {
  const bed = onWall(ctx, ctx.room.length * ctx.room.width > 14 ? "bed-king" : "bed-double", { edgeScore: calmLongWall(ctx), clear: 0.55, key: "bed" }) ?? onWall(ctx, "bed-double", { edgeScore: calmLongWall(ctx), clear: 0.45, key: "bed" }) ?? onWall(ctx, "bed-single", { clear: 0.4, key: "bed" });
  if (bed) {
    beside(ctx, "bedside", bed, "left", { gap: 0.03 });
    beside(ctx, "bedside", bed, "right", { gap: 0.03 });
  }
  const bedN = bed ? ctx.wall[bed.id].edge.normal : { x: 0, z: -1 };
  onWall(ctx, "wardrobe", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0) + dot(e.normal, bedN) * -1 * 0.5 - e.length / 8, clear: 0.7 });
  onWall(ctx, "dressing-table", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0), clear: 0.6 });
  onWall(ctx, "chest-drawers", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0), clear: 0.6 });
  if (bed) {
    const f = frontOf(bed.rotation);
    const rug = make(ctx, "rug", { color: "#9aae96" });
    if (rug) {
      const cand = { ...rug, x: bed.x + f.x * (bed.depth / 2 - 0.2), z: bed.z + f.z * (bed.depth / 2 - 0.2), rotation: bed.rotation, width: Math.min(2.4, bed.width + 0.9), depth: 1.5 };
      if (isInsideRoom(cand, ctx.room)) commit(ctx, cand);
    }
    inFront(ctx, "ottoman", bed, { gap: -0.05 + 0.05, clear: 0.1 });
  }
  inCorner(ctx, "plant");
  centredOn(ctx, "ceiling-light", bed);
}

function dining(ctx: Ctx) {
  const table = inMiddle(ctx, "dining-table", { clear: 0.75, key: "table" }) ?? inMiddle(ctx, "round-table", { clear: 0.7, key: "table" });
  if (table) {
    const horizontal = table.width >= table.depth;
    void horizontal;
    inFront(ctx, "dining-chairs", table, { gap: -0.18, faceRef: true, clear: 0, rotate: 0 });
    // the other long side: mirror the reference by rotating it 180° first
    const back = { ...table, rotation: table.rotation + 180 };
    inFront(ctx, "dining-chairs", back, { gap: -0.18, faceRef: true, clear: 0 });
    const r = rightOf(table.rotation);
    for (const s of [1, -1]) {
      const chair = make(ctx, "dining-chair");
      if (!chair) continue;
      const dist = table.width / 2 + chair.depth / 2 + 0.03;
      const cand = { ...chair, x: table.x + r.x * s * dist, z: table.z + r.z * s * dist, rotation: table.rotation + (s > 0 ? 90 : -90) };
      if (valid(ctx, cand, 0)) commit(ctx, cand);
    }
    centredOn(ctx, "ceiling-light", table);
  }
  onWall(ctx, "sideboard", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0) - e.length / 6, clear: 0.7 });
  onWall(ctx, "crockery-unit", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0) - e.length / 6, clear: 0.7 });
  inCorner(ctx, "plant");
}

function office(ctx: Ctx) {
  const desk = onWall(ctx, "l-desk", { edgeScore: calmLongWall(ctx), anchor: 0.7, clear: 0.2, key: "desk" }) ?? onWall(ctx, "office-desk", { edgeScore: calmLongWall(ctx), clear: 0.2, key: "desk" });
  if (desk) {
    const f = frontOf(desk.rotation);
    const r = rightOf(desk.rotation);
    const chair = make(ctx, "office-chair");
    if (chair) {
      const isL = desk.catalogId === "l-desk";
      for (const d of [0.55, 0.45, 0.65]) {
        const cand = {
          ...chair,
          x: desk.x + f.x * (isL ? 0.2 : desk.depth / 2 + 0.1) + r.x * (isL ? -0.3 : 0) + f.x * d * 0,
          z: desk.z + f.z * (isL ? 0.2 : desk.depth / 2 + 0.1) + r.z * (isL ? -0.3 : 0),
          rotation: desk.rotation + 180,
        };
        if (isL) {
          // sit inside the L, facing the main desk
          cand.x = desk.x + r.x * -0.33 + f.x * (desk.depth / 2 - 0.35);
          cand.z = desk.z + r.z * -0.33 + f.z * (desk.depth / 2 - 0.35);
        } else {
          cand.x = desk.x + f.x * (desk.depth / 2 + d);
          cand.z = desk.z + f.z * (desk.depth / 2 + d);
        }
        if (valid(ctx, cand, 0)) {
          commit(ctx, cand);
          break;
        }
      }
    }
  }
  onWall(ctx, "bookshelf", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0) - e.length / 8, clear: 0.2 });
  onWall(ctx, "bookshelf", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0) - e.length / 8, clear: 0.2 });
  onWall(ctx, "filing-cabinet", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0), clear: 0.2 });
  inCorner(ctx, "plant");
  inCorner(ctx, "floor-lamp");
  centredOn(ctx, "ceiling-light", desk);
}

function kitchen(ctx: Ctx) {
  // main run along the longest wall, filled from one corner
  const edge = [...ctx.edges].filter(axisAligned).sort((a, b) => (hasOpenings(ctx, a) ? 1 : 0) - (hasOpenings(ctx, b) ? 1 : 0) || b.length - a.length)[0];
  if (!edge) return;
  const seq = ["fridge", "kitchen-base", "kitchen-sink", "kitchen-base", "stove", "kitchen-base", "kitchen-base"];
  let u = 0.02;
  const bases: PlacedItem[] = [];
  for (const id of seq) {
    const base = make(ctx, id);
    if (!base) continue;
    const cx = edge.a.x + edge.dir.x * (u + base.width / 2) - edge.normal.x * (base.depth / 2);
    const cz = edge.a.z + edge.dir.z * (u + base.width / 2) - edge.normal.z * (base.depth / 2);
    const cand = { ...base, x: cx, z: cz, rotation: edge.angleDeg };
    if (u + base.width > edge.length - 0.01) break;
    if (!valid(ctx, cand, 0)) {
      u += base.width; // skip past a door or window gap
      continue;
    }
    const placed = commit(ctx, cand);
    ctx.wall[placed.id] = { edge, u: u + base.width / 2 };
    if (id !== "fridge") bases.push(placed);
    u += base.width;
  }
  for (const b of bases.filter((_, i) => i % 2 === 0)) {
    const cab = make(ctx, "wall-cabinet");
    if (!cab) continue;
    const e = ctx.wall[b.id].edge;
    const cand = { ...cab, x: b.x + frontOf(b.rotation).x * (cab.depth / 2 - b.depth / 2), z: b.z + frontOf(b.rotation).z * (cab.depth / 2 - b.depth / 2), rotation: e.angleDeg, width: Math.min(0.8, b.width * (b.width > 0.9 ? 0.66 : 1.3)) };
    if (isInsideRoom(cand, ctx.room)) commit(ctx, cand);
  }
  const runNormal = edge.normal;
  const island = make(ctx, "kitchen-island");
  if (island && ctx.room.width * ctx.room.length > 11) {
    const mid = { x: edge.a.x + edge.dir.x * edge.length * 0.5 - runNormal.x * 1.9, z: edge.a.z + edge.dir.z * edge.length * 0.5 - runNormal.z * 1.9 };
    const cand = { ...island, x: mid.x, z: mid.z, rotation: edge.angleDeg };
    if (valid(ctx, cand, 0.7)) {
      const placed = commit(ctx, cand, "island");
      const f = frontOf(placed.rotation);
      for (const s of [-0.4, 0, 0.4]) {
        const stool = make(ctx, "bar-stool");
        if (!stool) continue;
        const r = rightOf(placed.rotation);
        const sc = { ...stool, x: placed.x + f.x * (placed.depth / 2 + 0.28) + r.x * s * placed.width * 0.7, z: placed.z + f.z * (placed.depth / 2 + 0.28) + r.z * s * placed.width * 0.7, rotation: 0 };
        if (valid(ctx, sc, 0)) commit(ctx, sc);
      }
    }
  }
  onWall(ctx, "washer", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0) + (e === edge ? 5 : 0), clear: 0.1 });
}

function pooja(ctx: Ctx) {
  // north-east corner of the room (true north via northAngle is handled in the Vastu panel; here: top-right of the plan)
  const target: P2 = { x: ctx.room.length, z: 0 };
  const mandir = onWall(ctx, "mandir", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0) + Math.hypot(e.a.x + e.b.x - 2 * target.x, e.a.z + e.b.z - 2 * target.z) * 0.1, anchor: target, clear: 0.1, key: "mandir" });
  if (mandir) {
    inFront(ctx, "pooja-mat", mandir, { gap: 0.2, clear: 0 });
    inFront(ctx, "chowki", mandir, { gap: 0.35, clear: 0, key: "chowki" });
    beside(ctx, "deepam", mandir, "left", { gap: 0.1 });
  }
  onWall(ctx, "pooja-cabinet", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0), clear: 0.2 });
  inCorner(ctx, "pooja-plant", { near: { x: ctx.room.length, z: ctx.room.width } });
  centredOn(ctx, "ceiling-light", mandir ? { ...mandir, x: ctx.room.length / 2, z: ctx.room.width / 2 } : null);
}

function kids(ctx: Ctx) {
  const bed = onWall(ctx, "bunk-bed", { edgeScore: calmLongWall(ctx), anchor: 0.0, clear: 0.4, key: "bed" }) ?? onWall(ctx, "kids-bed", { edgeScore: calmLongWall(ctx), anchor: 0, clear: 0.4, key: "bed" });
  const desk = onWall(ctx, "kids-desk", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0), anchor: 1, clear: 0.2, key: "desk" });
  if (desk) {
    const f = frontOf(desk.rotation);
    const chair = make(ctx, "office-chair", { color: "#6b7140" });
    if (chair) {
      const cand = { ...chair, x: desk.x + f.x * (desk.depth / 2 + 0.3), z: desk.z + f.z * (desk.depth / 2 + 0.3), rotation: desk.rotation + 180 };
      if (valid(ctx, cand, 0)) commit(ctx, cand);
    }
  }
  onWall(ctx, "toy-storage", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0), clear: 0.3 });
  onWall(ctx, "bookshelf", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0), clear: 0.2 });
  inMiddle(ctx, "rug", { clear: 0, colour: "#b5654a" });
  inCorner(ctx, "plant");
  void bed;
}

function bathroom(ctx: Ctx) {
  const tub = onWall(ctx, "bathtub", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0) - e.length, anchor: 0, clear: 0.1 }) ?? onWall(ctx, "shower", { clear: 0.1 });
  onWall(ctx, "toilet", { edgeScore: (e) => (hasOpenings(ctx, e) ? 2 : 0) + (tub && ctx.wall[tub.id].edge === e ? 1 : 0), clear: 0.35 });
  onWall(ctx, "vanity", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0), clear: 0.4 });
  onWall(ctx, "washer", { edgeScore: (e) => (hasOpenings(ctx, e) ? 3 : 0), clear: 0.2 });
}

const RECIPES: Record<RoomKind, (ctx: Ctx) => void> = { living, bedroom, dining, office, kitchen, pooja, kids, bathroom };

/**
 * Arranges furniture for the given room type. Pieces in `keep` stay where they are and are
 * respected as obstacles; everything else is generated.
 */
export function autoArrange(room: RoomConfig, kind: RoomKind, keep: PlacedItem[] = []): AutoResult {
  const ctx = makeCtx(room, keep);
  RECIPES[kind](ctx);
  return { items: ctx.placed, skipped: ctx.skipped };
}
