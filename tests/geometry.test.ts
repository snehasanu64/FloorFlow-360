import { describe, expect, it } from "vitest";
import { canvasToRoom, isInsideRoom, itemBounds, itemsOverlap, rectsOverlap, roomToCanvas } from "@/lib/geometry";
import { analyzeLayout, clampInsideRoom, createPlacedItem, resolvePlacement } from "@/lib/placement";
import { getCatalogItem } from "@/data/furniture-catalog";
import { DEFAULT_ROOM } from "@/lib/room";
import { buildProjectFile, validateProject } from "@/lib/persistence";
import type { PlacedItem } from "@/types/furniture";

const make = (id: string, patch: Partial<PlacedItem> = {}): PlacedItem => ({
  ...createPlacedItem(getCatalogItem(id)!),
  ...patch,
});
const room = { ...DEFAULT_ROOM, length: 5, width: 4 };

describe("rotated footprints", () => {
  it("swaps extents at 90 degrees", () => {
    const sofa = make("sofa-3", { x: 2.5, z: 2, rotation: 90 });
    const b = itemBounds(sofa);
    expect(b.maxX - b.minX).toBeCloseTo(0.95, 3);
    expect(b.maxZ - b.minZ).toBeCloseTo(2.2, 3);
  });

  it("detects a 45 degree box exceeding the wall that an axis-aligned one would not", () => {
    const table = make("dining-table", { x: 0.85, z: 2, rotation: 0 });
    expect(isInsideRoom(table, room)).toBe(true);
    expect(isInsideRoom({ ...table, rotation: 45 }, room)).toBe(false);
  });

  it("clamps rotated items inside the room", () => {
    const sofa = make("sofa-3", { x: -3, z: 10, rotation: 90 });
    const c = clampInsideRoom(sofa, room);
    expect(isInsideRoom({ ...sofa, ...c }, room)).toBe(true);
  });
});

describe("overlap detection", () => {
  it("treats touching edges as non-overlapping and overlaps as overlapping", () => {
    const a = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 0 };
    expect(rectsOverlap(a, { cx: 2, cz: 0, hw: 1, hd: 1, rot: 0 })).toBe(false);
    expect(rectsOverlap(a, { cx: 1.9, cz: 0, hw: 1, hd: 1, rot: 0 })).toBe(true);
  });

  it("handles rotated rectangles (corner gap that AABBs would flag)", () => {
    const a = { cx: 0, cz: 0, hw: 1, hd: 1, rot: 45 };
    const b = { cx: 2.3, cz: 2.3, hw: 1, hd: 1, rot: 0 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it("does not flag the notch of an L-shaped sofa", () => {
    const l = make("sofa-l", { x: 2.5, z: 2, orientation: "right" });
    // chaise on the right: bottom-left of the footprint is empty
    const stool = make("side-table", { x: 2.5 - 1.1, z: 2 + 0.6 });
    expect(itemsOverlap(l, stool)).toBe(false);
    const stoolOnSeat = make("side-table", { x: 2.5 - 1.0, z: 2 - 0.6 });
    expect(itemsOverlap(l, stoolOnSeat)).toBe(true);
  });

  it("mirrors the L-sofa footprint when orientation is left", () => {
    const l = make("sofa-l", { x: 2.5, z: 2, orientation: "left" });
    const stool = make("side-table", { x: 2.5 + 1.1, z: 2 + 0.6 });
    expect(itemsOverlap(l, stool)).toBe(false);
  });

  it("analyzeLayout ignores rugs and reports outside items", () => {
    const rug = make("rug", { x: 2.5, z: 2 });
    const sofa = make("sofa-3", { x: 2.5, z: 2 });
    const out = make("armchair", { x: 6, z: 2 });
    const res = analyzeLayout([rug, sofa, out], room);
    expect(res.get(sofa.id)!.overlaps).toHaveLength(0);
    expect(res.get(out.id)!.outside).toBe(true);
  });
});

describe("placement", () => {
  it("snaps the item edge to grid and walls", () => {
    const sofa = make("sofa-3");
    const res = resolvePlacement(sofa, 1.234, 0.5, [], room, { snapGrid: true, snapWalls: true, align: false });
    const b = itemBounds({ ...sofa, x: res.x, z: res.z });
    expect(b.minX).toBeCloseTo(Math.round(b.minX * 10) / 10, 3);
    const nearWall = resolvePlacement(sofa, 1.18, 2, [], room, { snapGrid: false, snapWalls: true, align: false });
    expect(itemBounds({ ...sofa, x: nearWall.x }).minX).toBeCloseTo(0, 6);
  });
});

describe("coordinate conversion", () => {
  it("round-trips canvas pixels and room metres under zoom and pan", () => {
    const view = { x: 120, y: -40, scale: 1.7 };
    const px = roomToCanvas(3.2, 1.4, view, 100);
    const back = canvasToRoom(px.x, px.y, view, 100);
    expect(back.x).toBeCloseTo(3.2, 6);
    expect(back.z).toBeCloseTo(1.4, 6);
  });
});

describe("project validation", () => {
  it("round-trips a project", () => {
    const items = [make("sofa-3", { x: 2, z: 2, color: "#1f3556" }), make("coffee-table", { x: 2, z: 3 })];
    const file = buildProjectFile("Test", room, items);
    const res = validateProject(JSON.parse(JSON.stringify(file)));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.project.levels[0].items).toHaveLength(2);
      expect(res.project.levels[0].items[0].color).toBe("#1f3556");
      expect(res.project.levels[0].room.length).toBe(5);
    }
  });

  it("rejects malformed data and skips unknown furniture", () => {
    expect(validateProject(null).ok).toBe(false);
    expect(validateProject({ version: 1, room: {}, items: [] }).ok).toBe(false);
    const file = buildProjectFile("Test", room, []);
    const legacy = { app: "roomcraft-3d", version: 1, name: "Test", savedAt: file.savedAt, room: file.levels[0].room };
    const res = validateProject({ ...legacy, items: [{ catalogId: "nope" }, { catalogId: "sofa-3", x: "bad" }] });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.project.levels[0].items).toHaveLength(1);
      expect(res.warnings.length).toBeGreaterThan(0);
    }
  });
});
