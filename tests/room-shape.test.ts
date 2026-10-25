import { describe, expect, it } from "vitest";
import { getCatalogItem } from "@/data/furniture-catalog";
import { isInsideRoom } from "@/lib/geometry";
import { buildProjectFile, validateProject } from "@/lib/persistence";
import { analyzeLayout, createPlacedItem, resolvePlacement } from "@/lib/placement";
import { DEFAULT_ROOM, createOpening, sanitizeRoom } from "@/lib/room";
import { outerCorners, pointInPolygon, polygonArea, polygonEdges, rayToPolygon, roomPolygon } from "@/lib/roomShape";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";

const mk = (id: string, patch: Partial<PlacedItem> = {}): PlacedItem => ({ ...createPlacedItem(getCatalogItem(id)!), ...patch });
const room = (patch: Partial<RoomConfig>): RoomConfig => sanitizeRoom({ ...DEFAULT_ROOM, length: 6, width: 5, ...patch });

describe("room polygons", () => {
  it("builds a clockwise rectangle with outward normals", () => {
    const e = polygonEdges(roomPolygon(room({})));
    expect(e).toHaveLength(4);
    expect(e[0].normal).toEqual({ x: 0, z: -1 }); // north wall faces up
    expect(e[2].normal.z).toBeCloseTo(1); // south wall faces down
  });

  it("L / T / U / chamfer areas are the bounding box minus the cut-out", () => {
    const L = room({ shape: "L", cutW: 2, cutD: 2 });
    expect(polygonArea(roomPolygon(L))).toBeCloseTo(6 * 5 - 4, 6);
    const T = room({ shape: "T", cutW: 2, cutD: 2 });
    expect(polygonArea(roomPolygon(T))).toBeCloseTo(6 * 5 - 2 * 4, 6);
    const U = room({ shape: "U", cutW: 2, cutD: 2 });
    expect(polygonArea(roomPolygon(U))).toBeCloseTo(6 * 5 - 4, 6);
    const C = room({ shape: "chamfer", cutW: 2, cutD: 2 });
    expect(polygonArea(roomPolygon(C))).toBeCloseTo(6 * 5 - 2, 6);
  });

  it("keeps the bounding box when the shape is rotated", () => {
    for (const o of [0, 1, 2, 3] as const) {
      const poly = roomPolygon(room({ shape: "L", shapeOrient: o }));
      expect(Math.max(...poly.map((p) => p.x))).toBeCloseTo(6, 6);
      expect(Math.max(...poly.map((p) => p.z))).toBeCloseTo(5, 6);
      expect(Math.min(...poly.map((p) => p.x))).toBeCloseTo(0, 6);
    }
  });

  it("miters wall corners outside the floor", () => {
    const edges = polygonEdges(roomPolygon(room({})));
    const c = outerCorners(edges, 0.12);
    expect(c[0].x).toBeCloseTo(-0.12, 6);
    expect(c[0].z).toBeCloseTo(-0.12, 6);
  });

  it("point and ray queries", () => {
    const poly = roomPolygon(room({ shape: "L", cutW: 2, cutD: 2 })); // NE corner removed
    expect(pointInPolygon({ x: 1, z: 1 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 5.5, z: 1 }, poly)).toBe(false);
    expect(rayToPolygon({ x: 1, z: 1 }, { x: 1, z: 0 }, poly)).toBeCloseTo(3, 6); // hits the notch wall at x = 4
  });
});

describe("furniture in non-rectangular rooms", () => {
  const L = room({ shape: "L", cutW: 2, cutD: 2 }); // NE corner removed
  it("flags items inside the cut-out or straddling it", () => {
    const inside = mk("armchair", { x: 1.5, z: 1.5 });
    const inCut = mk("armchair", { x: 5, z: 1 });
    const straddle = mk("sofa-3", { x: 4.2, z: 1.9 });
    expect(isInsideRoom(inside, L)).toBe(true);
    expect(isInsideRoom(inCut, L)).toBe(false);
    expect(isInsideRoom(straddle, L)).toBe(false);
    const issues = analyzeLayout([inside, inCut], L);
    expect(issues.get(inCut.id)!.outside).toBe(true);
    expect(issues.get(inside.id)!.outside).toBe(false);
  });

  it("dragging never moves an item into the cut-out", () => {
    const it = mk("armchair", { x: 3.5, z: 3 });
    const res = resolvePlacement(it, 5.2, 1.0, [], L, { snapGrid: false, snapWalls: false, align: false });
    expect(isInsideRoom({ ...it, x: res.x, z: res.z }, L)).toBe(true);
  });

  it("snaps to the east wall and to the inner wall of the notch", () => {
    const it = mk("armchair", { x: 3.2, z: 3 });
    const east = resolvePlacement(it, 5.5, 3.5, [], L, { snapGrid: false, snapWalls: true, align: false });
    expect(east.x + 0.425).toBeCloseTo(6, 3);
    // the notch floor wall runs along z = 2 (x 4..6) with the room below it: the item top meets it
    const notch = resolvePlacement(it, 5, 2.5, [], L, { snapGrid: false, snapWalls: true, align: false });
    expect(notch.z - 0.425).toBeCloseTo(2, 3);
  });
});

describe("openings", () => {
  it("places doors on a south-facing wall and windows on a north-facing wall", () => {
    const r = room({});
    expect(createOpening("door", r).edge).toBe(2);
    expect(createOpening("window", r).edge).toBe(0);
  });

  it("migrates pre-shape projects that named walls", () => {
    const base = buildProjectFile("old", room({}), []).levels[0];
    const legacy = {
      app: "roomcraft-3d",
      version: 1,
      name: "old",
      items: [],
      room: {
        ...base.room,
        openings: [
          { id: "a", type: "window", wall: "north", offset: 1.5, width: 1, height: 1.2, sill: 0.9 },
          { id: "b", type: "door", wall: "south", offset: 1, width: 0.9, height: 2.05, sill: 0 },
          { id: "c", type: "window", wall: "west", offset: 1, width: 1, height: 1, sill: 1 },
        ],
      },
    };
    const res = validateProject(legacy);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const o = res.project.levels[0].room.openings;
      expect(o[0].edge).toBe(0);
      expect(o[0].offset).toBeCloseTo(1.5);
      expect(o[1].edge).toBe(2);
      expect(o[1].offset).toBeCloseTo(6 - 1); // measured from the south wall's start (east end)
      expect(o[2].edge).toBe(3);
      expect(o[2].offset).toBeCloseTo(5 - 1);
    }
  });
});
