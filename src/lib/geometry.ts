import { getCatalogItem } from "@/data/furniture-catalog";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";
import { localRects } from "./footprint";
import { degToRad } from "./measurements";
import { quadInsidePolygon, roomPolygon, type P2 } from "./roomShape";

export interface Vec2 {
  x: number;
  z: number;
}

/** A rectangle in room space, centred at (cx, cz), rotated clockwise (seen from above) by rot degrees. */
export interface OrientedRect {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  rot: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const EPS = 1e-4;

/**
 * Rotate a local point by `deg` clockwise on screen (x right, z down).
 * This is the convention shared by Konva (positive rotation is clockwise)
 * and the 3D scene, which applies rotation.y = -deg.
 */
export function rotateLocal(lx: number, lz: number, deg: number): Vec2 {
  const a = degToRad(deg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: lx * c - lz * s, z: lx * s + lz * c };
}

export function rectCorners(r: OrientedRect): Vec2[] {
  const pts: [number, number][] = [
    [-r.hw, -r.hd],
    [r.hw, -r.hd],
    [r.hw, r.hd],
    [-r.hw, r.hd],
  ];
  return pts.map(([lx, lz]) => {
    const p = rotateLocal(lx, lz, r.rot);
    return { x: r.cx + p.x, z: r.cz + p.z };
  });
}

/** Footprint rectangles of an item in room space (two for the L-shaped sofa, otherwise one). */
export function itemRects(item: PlacedItem): OrientedRect[] {
  const cat = getCatalogItem(item.catalogId);
  const locals = localRects({
    model: cat?.model ?? "rug",
    width: item.width,
    depth: item.depth,
    seats: cat?.seats,
    orientation: item.orientation,
  });
  return locals.map((l) => {
    const c = rotateLocal(l.cx, l.cz, item.rotation);
    return { cx: item.x + c.x, cz: item.z + c.z, hw: l.hw, hd: l.hd, rot: item.rotation };
  });
}

export function boundsOfPoints(points: Vec2[]): Bounds {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Axis-aligned bounds of the transformed footprint. */
export function itemBounds(item: PlacedItem): Bounds {
  return boundsOfPoints(itemRects(item).flatMap(rectCorners));
}

/** Half extents of the item's axis-aligned bounds relative to its centre. */
export function itemHalfExtents(item: PlacedItem) {
  const b = itemBounds(item);
  return { left: item.x - b.minX, right: b.maxX - item.x, top: item.z - b.minZ, bottom: b.maxZ - item.z };
}

function project(poly: Vec2[], ax: number, az: number): [number, number] {
  let min = Infinity,
    max = -Infinity;
  for (const p of poly) {
    const v = p.x * ax + p.z * az;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Separating-axis overlap test for two oriented rectangles. Touching edges do not count. */
export function rectsOverlap(a: OrientedRect, b: OrientedRect): boolean {
  const pa = rectCorners(a);
  const pb = rectCorners(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 2; i++) {
      // Only the first two edges are needed: opposite edges share normals.
      const p1 = poly[i];
      const p2 = poly[i + 1];
      const ax = -(p2.z - p1.z);
      const az = p2.x - p1.x;
      const len = Math.hypot(ax, az) || 1;
      const [minA, maxA] = project(pa, ax / len, az / len);
      const [minB, maxB] = project(pb, ax / len, az / len);
      if (maxA <= minB + EPS || maxB <= minA + EPS) return false;
    }
  }
  return true;
}

export function itemsOverlap(a: PlacedItem, b: PlacedItem): boolean {
  const ra = itemRects(a);
  const rb = itemRects(b);
  return ra.some((x) => rb.some((y) => rectsOverlap(x, y)));
}

type RoomLike = Pick<RoomConfig, "length" | "width"> & Partial<Pick<RoomConfig, "shape" | "shapeOrient" | "cutW" | "cutD">>;

const polyCache = new WeakMap<object, P2[]>();
/** Floor polygon of a room (cached per room object; a plain rectangle when no shape is set). */
export function getRoomPolygon(room: RoomLike): P2[] {
  const hit = polyCache.get(room);
  if (hit) return hit;
  const poly = roomPolygon({
    length: room.length,
    width: room.width,
    shape: room.shape ?? "rect",
    shapeOrient: room.shapeOrient ?? 0,
    cutW: room.cutW ?? 2,
    cutD: room.cutD ?? 1.6,
  });
  polyCache.set(room, poly);
  return poly;
}

export function roomBounds(room: Pick<RoomConfig, "length" | "width">): Bounds {
  return { minX: 0, maxX: room.length, minZ: 0, maxZ: room.width };
}

/** True when every corner of the (rotated) footprint lies inside the room floor. */
export function isInsideRoom(item: PlacedItem, room: RoomLike): boolean {
  if (!room.shape || room.shape === "rect") {
    const b = itemBounds(item);
    return b.minX >= -EPS && b.minZ >= -EPS && b.maxX <= room.length + EPS && b.maxZ <= room.width + EPS;
  }
  const poly = getRoomPolygon(room);
  return itemRects(item).every((r) => quadInsidePolygon(rectCorners(r).map((c) => ({ x: c.x, z: c.z })), poly));
}

/** Pointer position in canvas pixels -> room metres, given the stage transform. */
export function canvasToRoom(px: number, py: number, view: { x: number; y: number; scale: number }, pxPerM: number): Vec2 {
  return { x: (px - view.x) / view.scale / pxPerM, z: (py - view.y) / view.scale / pxPerM };
}

/** Room metres -> canvas pixels. Inverse of canvasToRoom. */
export function roomToCanvas(x: number, z: number, view: { x: number; y: number; scale: number }, pxPerM: number) {
  return { x: x * pxPerM * view.scale + view.x, y: z * pxPerM * view.scale + view.y };
}
