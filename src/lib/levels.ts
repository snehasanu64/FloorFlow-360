import { getCatalogItem } from "@/data/furniture-catalog";
import type { PlacedItem } from "@/types/furniture";
import { rectCorners, itemRects } from "./geometry";
import type { P2 } from "./roomShape";

/** Thickness of the slab between two floors, metres. */
export const SLAB = 0.2;

/** Floor-to-floor offset of every level: level i sits on top of the walls + slab of the levels below it. */
export function levelElevations(levels: { id: string; wallHeight: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  let y = 0;
  for (const l of levels) {
    out[l.id] = y;
    y += l.wallHeight + SLAB;
  }
  return out;
}

export const isStairs = (catalogId: string) => {
  const m = getCatalogItem(catalogId)?.model;
  return m === "stairs" || m === "spiralStairs";
};

/** Footprint polygons (room metres) of the staircases on a floor — used to cut holes in the floors they pass through. */
export function stairOpenings(items: PlacedItem[]): P2[][] {
  const out: P2[][] = [];
  for (const it of items) {
    if (!isStairs(it.catalogId)) continue;
    for (const r of itemRects(it)) out.push(rectCorners(r).map((c) => ({ x: c.x, z: c.z })));
  }
  return out;
}
