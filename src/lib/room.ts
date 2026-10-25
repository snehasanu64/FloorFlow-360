import { uid } from "./id";
import { isHexColor } from "./color";
import { clamp } from "./measurements";
import { roomEdges } from "./roomShape";
import type { FloorMaterial, Opening, OpeningType, RoomConfig, RoomShape, WallPattern } from "@/types/room";

export const ROOM_LIMITS = {
  length: { min: 1.5, max: 20 },
  width: { min: 1.5, max: 20 },
  wallHeight: { min: 2, max: 6 },
  wallThickness: { min: 0.05, max: 0.5 },
  gridSpacing: { min: 0.05, max: 1 },
} as const;

export const FLOOR_MATERIALS: { value: FloorMaterial; label: string; color: string }[] = [
  { value: "wood", label: "Wood planks", color: "#c8a47a" },
  { value: "tile", label: "Tile", color: "#e4e1da" },
  { value: "concrete", label: "Concrete", color: "#a7a8a8" },
  { value: "carpet", label: "Carpet", color: "#b9b2a6" },
  { value: "plain", label: "Plain colour", color: "#d9d4ca" },
];

export const ROOM_SHAPES: { value: RoomShape; label: string }[] = [
  { value: "rect", label: "Rectangle" },
  { value: "L", label: "L-shaped" },
  { value: "T", label: "T-shaped" },
  { value: "U", label: "U-shaped" },
  { value: "chamfer", label: "Angled corner" },
];

export const WALL_PATTERNS: { value: WallPattern; label: string }[] = [
  { value: "none", label: "Plain paint" },
  { value: "plaster", label: "Textured plaster" },
  { value: "stripes", label: "Stripes" },
  { value: "dots", label: "Polka dots" },
  { value: "brick", label: "Brick" },
  { value: "panels", label: "Wall panelling" },
];

export const DEFAULT_ROOM: RoomConfig = {
  length: 5,
  width: 4,
  wallHeight: 2.8,
  wallThickness: 0.12,
  floorMaterial: "wood",
  floorColor: "#c8a47a",
  wallColor: "#f1ede6",
  gridSpacing: 0.1,
  shape: "rect",
  shapeOrient: 0,
  cutW: 2,
  cutD: 1.6,
  wallColors: {},
  wallPatterns: {},
  wallPattern: "none",
  northAngle: 0,
  openings: [],
};

export const OPENING_DEFAULTS: Record<OpeningType, { width: number; height: number; sill: number }> = {
  door: { width: 0.9, height: 2.05, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 0.9 },
};

export const isRectRoom = (r: Pick<RoomConfig, "shape">) => r.shape === "rect";

export function edgeCount(room: RoomConfig) {
  return roomEdges(room).length;
}

export function clampOpening(o: Opening, room: RoomConfig): Opening {
  const edges = roomEdges(room);
  const edge = clamp(Math.round(Number.isFinite(o.edge) ? o.edge : 0), 0, edges.length - 1);
  const len = edges[edge].length;
  const width = clamp(o.width, 0.3, Math.max(0.3, len - 0.2));
  const height = clamp(o.height, 0.3, Math.max(0.3, room.wallHeight - 0.05));
  const sill = clamp(o.sill, 0, Math.max(0, room.wallHeight - height - 0.02));
  const offset = clamp(o.offset, width / 2 + 0.05, Math.max(width / 2 + 0.05, len - width / 2 - 0.05));
  return { ...o, edge, width, height, sill: o.type === "door" ? 0 : sill, offset };
}

export function createOpening(type: OpeningType, room: RoomConfig): Opening {
  const d = OPENING_DEFAULTS[type];
  const edges = roomEdges(room);
  // doors go on the longest south-facing wall, windows on the longest north-facing wall
  const want = type === "door" ? { x: 0, z: 1 } : { x: 0, z: -1 };
  const candidates = edges.filter((e) => e.normal.x * want.x + e.normal.z * want.z > 0.9);
  const pool = candidates.length ? candidates : edges;
  const edge = pool.reduce((best, e) => (e.length > best.length ? e : best));
  return clampOpening(
    { id: uid(type), type, edge: edge.index, offset: edge.length / 2, width: d.width, height: d.height, sill: d.sill },
    room,
  );
}

/** Coerces a partial / untrusted room into a valid RoomConfig. */
export function sanitizeRoom(input: Partial<RoomConfig>, base: RoomConfig = DEFAULT_ROOM): RoomConfig {
  const num = (v: unknown, fallback: number, lim: { min: number; max: number }) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lim.min, lim.max) : fallback;
  const shape = ROOM_SHAPES.some((s) => s.value === input.shape) ? (input.shape as RoomShape) : base.shape;
  const orient = [0, 1, 2, 3].includes(input.shapeOrient as number) ? (input.shapeOrient as 0 | 1 | 2 | 3) : base.shapeOrient;
  const cleanColors: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.wallColors ?? base.wallColors)) if (isHexColor(v)) cleanColors[k] = v;
  const cleanPatterns: Record<string, WallPattern> = {};
  for (const [k, v] of Object.entries(input.wallPatterns ?? base.wallPatterns))
    if (WALL_PATTERNS.some((p) => p.value === v)) cleanPatterns[k] = v;
  const room: RoomConfig = {
    length: num(input.length, base.length, ROOM_LIMITS.length),
    width: num(input.width, base.width, ROOM_LIMITS.width),
    wallHeight: num(input.wallHeight, base.wallHeight, ROOM_LIMITS.wallHeight),
    wallThickness: num(input.wallThickness, base.wallThickness, ROOM_LIMITS.wallThickness),
    gridSpacing: num(input.gridSpacing, base.gridSpacing, ROOM_LIMITS.gridSpacing),
    floorMaterial: FLOOR_MATERIALS.some((m) => m.value === input.floorMaterial)
      ? (input.floorMaterial as FloorMaterial)
      : base.floorMaterial,
    floorColor: isHexColor(input.floorColor) ? input.floorColor : base.floorColor,
    wallColor: isHexColor(input.wallColor) ? input.wallColor : base.wallColor,
    shape,
    shapeOrient: orient,
    cutW: num(input.cutW, base.cutW, { min: 0.6, max: 19 }),
    cutD: num(input.cutD, base.cutD, { min: 0.6, max: 19 }),
    wallColors: cleanColors,
    wallPatterns: cleanPatterns,
    wallPattern: WALL_PATTERNS.some((p) => p.value === input.wallPattern) ? (input.wallPattern as WallPattern) : base.wallPattern,
    northAngle: typeof input.northAngle === "number" && Number.isFinite(input.northAngle) ? ((input.northAngle % 360) + 360) % 360 : base.northAngle,
    openings: [],
  };
  const openings = input.openings ?? base.openings;
  room.openings = openings.map((o) => clampOpening(o, room));
  return room;
}

/** Field-level validation messages for the room form (values in metres). */
export function validateRoomFields(v: Partial<Record<keyof typeof ROOM_LIMITS, number>>): Record<string, string> {
  const errors: Record<string, string> = {};
  const labels = {
    length: "Length",
    width: "Width",
    wallHeight: "Wall height",
    wallThickness: "Wall thickness",
    gridSpacing: "Grid spacing",
  } as const;
  for (const key of Object.keys(ROOM_LIMITS) as (keyof typeof ROOM_LIMITS)[]) {
    const val = v[key];
    const lim = ROOM_LIMITS[key];
    if (val === undefined || !Number.isFinite(val)) errors[key] = `${labels[key]} must be a number.`;
    else if (val < lim.min || val > lim.max)
      errors[key] = `${labels[key]} must be between ${lim.min * 100} and ${lim.max * 100} cm.`;
  }
  return errors;
}
