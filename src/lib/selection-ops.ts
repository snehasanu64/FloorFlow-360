import type { PlacedItem } from "@/types/furniture";
import { boundsOfPoints, itemBounds, rotateLocal, type Bounds } from "./geometry";
import { normalizeDeg, round } from "./measurements";

export type AlignMode = "left" | "right" | "top" | "bottom" | "centerH" | "centerV" | "distributeH" | "distributeV";

/** Union of the axis-aligned bounds of several items. */
export function selectionBounds(items: PlacedItem[]): Bounds | null {
  if (!items.length) return null;
  const pts = items.flatMap((it) => {
    const b = itemBounds(it);
    return [
      { x: b.minX, z: b.minZ },
      { x: b.maxX, z: b.maxZ },
    ];
  });
  return boundsOfPoints(pts);
}

/** Adds every member of the groups touched by `ids`. */
export function expandGroups(items: PlacedItem[], ids: string[]): string[] {
  const groups = new Set(items.filter((i) => ids.includes(i.id) && i.groupId).map((i) => i.groupId));
  if (!groups.size) return ids;
  const out = new Set(ids);
  for (const it of items) if (it.groupId && groups.has(it.groupId)) out.add(it.id);
  return [...out];
}

/** Rotates items together around the centre of their combined bounds. */
export function rotateGroup(items: PlacedItem[], ids: string[], deg: number): PlacedItem[] {
  const sel = items.filter((i) => ids.includes(i.id) && !i.locked);
  const b = selectionBounds(sel);
  if (!b) return items;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const single = sel.length === 1;
  return items.map((it) => {
    if (!sel.includes(it)) return it;
    if (single) return { ...it, rotation: normalizeDeg(round(it.rotation + deg, 2)) };
    const p = rotateLocal(it.x - cx, it.z - cz, deg);
    return { ...it, x: round(cx + p.x, 4), z: round(cz + p.z, 4), rotation: normalizeDeg(round(it.rotation + deg, 2)) };
  });
}

export function alignItems(items: PlacedItem[], ids: string[], mode: AlignMode): PlacedItem[] {
  const sel = items.filter((i) => ids.includes(i.id) && !i.locked);
  if (sel.length < 2) return items;
  const bs = new Map(sel.map((i) => [i.id, itemBounds(i)]));
  const all = selectionBounds(sel)!;
  const patch = new Map<string, { x?: number; z?: number }>();
  if (mode === "distributeH" || mode === "distributeV") {
    if (sel.length < 3) return items;
    const horizontal = mode === "distributeH";
    const centre = (i: PlacedItem) => {
      const b = bs.get(i.id)!;
      return horizontal ? (b.minX + b.maxX) / 2 : (b.minZ + b.maxZ) / 2;
    };
    const sorted = [...sel].sort((a, b) => centre(a) - centre(b));
    const first = centre(sorted[0]);
    const last = centre(sorted[sorted.length - 1]);
    sorted.forEach((it, k) => {
      const target = first + ((last - first) * k) / (sorted.length - 1);
      const d = target - centre(it);
      patch.set(it.id, horizontal ? { x: it.x + d } : { z: it.z + d });
    });
  } else {
    for (const it of sel) {
      const b = bs.get(it.id)!;
      switch (mode) {
        case "left":
          patch.set(it.id, { x: it.x + (all.minX - b.minX) });
          break;
        case "right":
          patch.set(it.id, { x: it.x + (all.maxX - b.maxX) });
          break;
        case "top":
          patch.set(it.id, { z: it.z + (all.minZ - b.minZ) });
          break;
        case "bottom":
          patch.set(it.id, { z: it.z + (all.maxZ - b.maxZ) });
          break;
        case "centerH":
          patch.set(it.id, { x: it.x + ((all.minX + all.maxX) / 2 - (b.minX + b.maxX) / 2) });
          break;
        case "centerV":
          patch.set(it.id, { z: it.z + ((all.minZ + all.maxZ) / 2 - (b.minZ + b.maxZ) / 2) });
          break;
      }
    }
  }
  return items.map((it) => {
    const p = patch.get(it.id);
    return p ? { ...it, x: round(p.x ?? it.x, 4), z: round(p.z ?? it.z, 4) } : it;
  });
}
