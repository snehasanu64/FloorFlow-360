import { FURNITURE_CATALOG, getCatalogItem } from "@/data/furniture-catalog";
import type { CatalogItem, PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";

type RoomLike = Parameters<typeof isInsideRoom>[1];
import { defaultRoughness } from "./materials";
import { clamp, round } from "./measurements";
import { getRoomPolygon, isInsideRoom, itemBounds, itemHalfExtents, itemsOverlap } from "./geometry";
import { polygonEdges } from "./roomShape";
import { uid } from "./id";

export interface ItemIssue {
  overlaps: string[];
  outside: boolean;
}

/** Overlap / boundary analysis for the whole layout. Non-destructive: only reports. */
export function analyzeLayout(items: PlacedItem[], room: RoomLike): Map<string, ItemIssue> {
  const result = new Map<string, ItemIssue>();
  for (const it of items) result.set(it.id, { overlaps: [], outside: !isInsideRoom(it, room) });
  const collidable = items.filter((it) => !getCatalogItem(it.catalogId)?.ignoreCollision);
  for (let i = 0; i < collidable.length; i++) {
    for (let j = i + 1; j < collidable.length; j++) {
      if (itemsOverlap(collidable[i], collidable[j])) {
        result.get(collidable[i].id)!.overlaps.push(collidable[j].id);
        result.get(collidable[j].id)!.overlaps.push(collidable[i].id);
      }
    }
  }
  return result;
}

export const issueCount = (issues: Map<string, ItemIssue>) => {
  let overlaps = 0;
  let outside = 0;
  for (const v of issues.values()) {
    if (v.overlaps.length) overlaps++;
    if (v.outside) outside++;
  }
  return { overlaps, outside };
};

type Half = { left: number; right: number; top: number; bottom: number };

/** Snap the item's sides to nearby axis-aligned walls of the room outline. */
function snapToWalls(h: Half, x: number, z: number, room: RoomConfig) {
  const edges = polygonEdges(getRoomPolygon(room));
  let nx = x;
  let nz = z;
  let bestX = WALL_SNAP;
  let bestZ = WALL_SNAP;
  for (const e of edges) {
    const horizontal = Math.abs(e.dir.z) < 1e-6;
    const vertical = Math.abs(e.dir.x) < 1e-6;
    if (horizontal) {
      const lo = Math.min(e.a.x, e.b.x);
      const hi = Math.max(e.a.x, e.b.x);
      if (x + h.right <= lo + 1e-6 || x - h.left >= hi - 1e-6) continue;
      const c = e.a.z;
      // interior below the wall (outward normal points up) -> the item's top side meets it
      const d = e.normal.z < 0 ? c - (z - h.top) : c - (z + h.bottom);
      if (Math.abs(d) < bestZ) {
        bestZ = Math.abs(d);
        nz = z + d;
      }
    } else if (vertical) {
      const lo = Math.min(e.a.z, e.b.z);
      const hi = Math.max(e.a.z, e.b.z);
      if (z + h.bottom <= lo + 1e-6 || z - h.top >= hi - 1e-6) continue;
      const c = e.a.x;
      const d = e.normal.x < 0 ? c - (x - h.left) : c - (x + h.right);
      if (Math.abs(d) < bestX) {
        bestX = Math.abs(d);
        nx = x + d;
      }
    }
  }
  return { x: nx, z: nz };
}

export function snapValue(v: number, step: number) {
  return step > 0 ? Math.round(v / step) * step : v;
}

/** Clamp a centre so the item's rotated bounds lie within the room (if it fits). */
export function clampInsideRoom(item: PlacedItem, room: Pick<RoomConfig, "length" | "width">, x = item.x, z = item.z) {
  const h = itemHalfExtents(item);
  const minX = h.left;
  const maxX = room.length - h.right;
  const minZ = h.top;
  const maxZ = room.width - h.bottom;
  return {
    x: minX > maxX ? room.length / 2 : clamp(x, minX, maxX),
    z: minZ > maxZ ? room.width / 2 : clamp(z, minZ, maxZ),
  };
}

export interface AlignGuide {
  axis: "x" | "z";
  /** coordinate of the guide line (metres) */
  pos: number;
}

export interface PlacementOptions {
  snapGrid: boolean;
  snapWalls: boolean;
  align: boolean;
  /** Keep the item inside the room while dragging. */
  clampToRoom?: boolean;
}

const WALL_SNAP = 0.12;
const ALIGN_SNAP = 0.04;

/**
 * Turns a raw dragged centre into a final centre applying (in order):
 * room clamp, grid snap (item edge on grid line), wall snap, alignment to other items.
 */
export function resolvePlacement(
  item: PlacedItem,
  rawX: number,
  rawZ: number,
  others: PlacedItem[],
  room: RoomConfig,
  opts: PlacementOptions,
): { x: number; z: number; guides: AlignGuide[] } {
  const probe: PlacedItem = { ...item, x: rawX, z: rawZ };
  const h = itemHalfExtents(probe);
  let x = rawX;
  let z = rawZ;

  if (opts.snapGrid && room.gridSpacing > 0) {
    x = snapValue(x - h.left, room.gridSpacing) + h.left;
    z = snapValue(z - h.top, room.gridSpacing) + h.top;
  }
  if (opts.snapWalls) {
    const snapped = snapToWalls(h, x, z, room);
    x = snapped.x;
    z = snapped.z;
  }

  const guides: AlignGuide[] = [];
  if (opts.align) {
    const targetsX: number[] = [0, room.length / 2, room.length];
    const targetsZ: number[] = [0, room.width / 2, room.width];
    for (const o of others) {
      if (getCatalogItem(o.catalogId)?.ignoreCollision) continue;
      const b = itemBounds(o);
      targetsX.push(b.minX, (b.minX + b.maxX) / 2, b.maxX);
      targetsZ.push(b.minZ, (b.minZ + b.maxZ) / 2, b.maxZ);
    }
    const best = (own: number[], targets: number[]) => {
      let bestD = ALIGN_SNAP;
      let delta = 0;
      let at: number | null = null;
      for (const o of own)
        for (const t of targets) {
          const dd = t - o;
          if (Math.abs(dd) < bestD) {
            bestD = Math.abs(dd);
            delta = dd;
            at = t;
          }
        }
      return { delta, at };
    };
    const ax = best([x - h.left, x, x + h.right], targetsX);
    const az = best([z - h.top, z, z + h.bottom], targetsZ);
    if (ax.at !== null) {
      x += ax.delta;
      guides.push({ axis: "x", pos: ax.at });
    }
    if (az.at !== null) {
      z += az.delta;
      guides.push({ axis: "z", pos: az.at });
    }
  }

  if (opts.clampToRoom !== false) {
    const c = clampInsideRoom(item, room, x, z);
    x = c.x;
    z = c.z;
    if (room.shape && room.shape !== "rect") {
      // non-rectangular rooms: slide along the walls instead of entering a cut-out
      const ok = (px: number, pz: number) => isInsideRoom({ ...item, x: px, z: pz }, room);
      if (!ok(x, z)) {
        if (ok(x, item.z)) z = item.z;
        else if (ok(item.x, z)) x = item.x;
        else {
          x = item.x;
          z = item.z;
        }
      }
    }
  }
  return { x: round(x, 4), z: round(z, 4), guides };
}

/** Find the free position closest to the room centre for a new item. */
export function findFreeSpot(candidate: PlacedItem, existing: PlacedItem[], room: RoomConfig): { x: number; z: number } {
  const cat = getCatalogItem(candidate.catalogId);
  const solid = cat?.ignoreCollision ? [] : existing.filter((e) => !getCatalogItem(e.catalogId)?.ignoreCollision);
  const centre = clampInsideRoom(candidate, room, room.length / 2, room.width / 2);
  const step = 0.25;
  let best: { x: number; z: number; d: number } | null = null;
  const cols = Math.ceil(room.length / step);
  const rows = Math.ceil(room.width / step);
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const p = clampInsideRoom(candidate, room, i * step, j * step);
      const probe = { ...candidate, x: p.x, z: p.z };
      if (!isInsideRoom(probe, room)) continue;
      if (solid.some((o) => itemsOverlap(probe, o))) continue;
      const d = Math.hypot(p.x - centre.x, p.z - centre.z);
      if (!best || d < best.d) best = { ...p, d };
    }
  }
  return best ? { x: best.x, z: best.z } : centre;
}

export function createPlacedItem(cat: CatalogItem): PlacedItem {
  return {
    id: uid("item"),
    catalogId: cat.id,
    name: cat.name,
    x: 0,
    z: 0,
    width: cat.width,
    depth: cat.depth,
    height: cat.height,
    rotation: cat.defaultRotation,
    color: cat.defaultColor,
    material: cat.defaultMaterial,
    roughness: defaultRoughness(cat.defaultMaterial),
    orientation: cat.defaultOrientation,
  };
}

/** Dimensions, colour, material and rotation back to catalogue defaults; position is kept. */
export function resetItemToDefaults(item: PlacedItem): PlacedItem {
  const cat = getCatalogItem(item.catalogId);
  if (!cat) return item;
  return { ...createPlacedItem(cat), id: item.id, x: item.x, z: item.z, name: cat.name };
}

export const catalogCount = FURNITURE_CATALOG.length;
