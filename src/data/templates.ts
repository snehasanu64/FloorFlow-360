import { getCatalogItem } from "./furniture-catalog";
import { createPlacedItem } from "@/lib/placement";
import { clampOpening, DEFAULT_ROOM, sanitizeRoom, OPENING_DEFAULTS } from "@/lib/room";
import { uid } from "@/lib/id";
import type { PlacedItem } from "@/types/furniture";
import type { OpeningType, RoomConfig } from "@/types/room";

/**
 * Ready-made starting layouts. All coordinates are in centimetres on the room's top-down plan
 * (x right, z down, origin at the north-west corner). Rotation is degrees clockwise; furniture
 * "front" faces south at 0°, west at 90°, north at 180°, east at 270°.
 * Door / window `edge` follows the wall order of a rectangle: 0 north, 1 east, 2 south, 3 west, and
 * `offset` is measured along the wall from its start (north: from the west end, east: from the north
 * end, south: from the east end, west: from the south end).
 */
export interface TemplateItem {
  id: string;
  x: number;
  z: number;
  rot?: number;
  color?: string;
  orient?: "left" | "right";
}
export interface TemplateOpening {
  type: OpeningType;
  edge: number;
  offset: number;
  width?: number;
}
export interface Template {
  id: string;
  name: string;
  description: string;
  roomType: "living" | "bedroom" | "studio" | "kitchen" | "pooja" | "office" | "dining" | "kids" | "bathroom";
  room: Partial<RoomConfig> & { length: number; width: number };
  openings: TemplateOpening[];
  items: TemplateItem[];
}

export const TEMPLATES: Template[] = [
  {
    id: "living-room",
    name: "Living room",
    description: "Sofa facing a TV wall, coffee table on a rug, armchair, bookshelf and plant.",
    roomType: "living",
    room: { length: 5.2, width: 4.2, wallColor: "#efe9df", floorMaterial: "wood", floorColor: "#c8a47a" },
    openings: [
      { type: "window", edge: 0, offset: 100 },
      { type: "window", edge: 3, offset: 210 },
      { type: "door", edge: 1, offset: 330 },
    ],
    items: [
      { id: "tv-unit", x: 260, z: 20 },
      { id: "tv-wall", x: 260, z: 3 },
      { id: "sofa-3", x: 260, z: 330, rot: 180 },
      { id: "rug", x: 260, z: 235 },
      { id: "coffee-table", x: 260, z: 215 },
      { id: "armchair", x: 95, z: 230, rot: 270, color: "#1f3556" },
      { id: "side-table", x: 95, z: 330 },
      { id: "bookshelf", x: 505, z: 150, rot: 90 },
      { id: "plant", x: 30, z: 30 },
      { id: "floor-lamp", x: 470, z: 40 },
      { id: "ceiling-light", x: 260, z: 215 },
    ],
  },
  {
    id: "bedroom",
    name: "Master bedroom",
    description: "Double bed with bedside tables, wardrobe, dressing table and chest of drawers.",
    roomType: "bedroom",
    room: { length: 4.2, width: 3.8, wallColor: "#ece8e1", floorMaterial: "wood", floorColor: "#b99572" },
    openings: [
      { type: "window", edge: 1, offset: 100 },
      { type: "door", edge: 3, offset: 80 },
    ],
    items: [
      { id: "bed-double", x: 210, z: 100 },
      { id: "bedside", x: 110, z: 20 },
      { id: "bedside", x: 310, z: 20 },
      { id: "wardrobe", x: 100, z: 350, rot: 180 },
      { id: "dressing-table", x: 397.5, z: 280, rot: 90 },
      { id: "chest-drawers", x: 22.5, z: 150, rot: 270 },
      { id: "rug", x: 210, z: 250, color: "#9aae96" },
      { id: "ottoman", x: 210, z: 235 },
      { id: "plant", x: 380, z: 40 },
      { id: "ceiling-light", x: 210, z: 190 },
    ],
  },
  {
    id: "studio",
    name: "Studio apartment (1RK)",
    description: "Open plan: kitchen run, dining, living and sleeping zones in one 7.2 × 4.8 m space.",
    roomType: "studio",
    room: { length: 7.2, width: 4.8, wallColor: "#f0ebe3", floorMaterial: "wood", floorColor: "#c9a47c" },
    openings: [
      { type: "window", edge: 0, offset: 560 },
      { type: "window", edge: 1, offset: 395 },
      { type: "door", edge: 3, offset: 260 },
    ],
    items: [
      { id: "fridge", x: 35, z: 35 },
      { id: "kitchen-base", x: 100, z: 30 },
      { id: "kitchen-sink", x: 190, z: 30 },
      { id: "kitchen-base", x: 280, z: 30 },
      { id: "stove", x: 340, z: 30 },
      { id: "kitchen-base", x: 400, z: 30 },
      { id: "wall-cabinet", x: 110, z: 17.5 },
      { id: "wall-cabinet", x: 190, z: 17.5 },
      { id: "wall-cabinet", x: 270, z: 17.5 },
      { id: "wall-cabinet", x: 430, z: 17.5 },
      { id: "dining-table", x: 560, z: 120 },
      { id: "dining-chairs", x: 560, z: 45 },
      { id: "dining-chairs", x: 560, z: 195, rot: 180 },
      { id: "crockery-unit", x: 700, z: 120, rot: 90 },
      { id: "tv-unit", x: 150, z: 460, rot: 180 },
      { id: "tv-wall", x: 150, z: 477, rot: 180 },
      { id: "sofa-3", x: 140, z: 300 },
      { id: "rug", x: 140, z: 380 },
      { id: "coffee-table", x: 140, z: 395 },
      { id: "armchair", x: 300, z: 370, rot: 90, color: "#6b7140" },
      { id: "plant", x: 30, z: 450 },
      { id: "floor-lamp", x: 275, z: 285 },
      { id: "bed-double", x: 620, z: 395, rot: 90 },
      { id: "bedside", x: 700, z: 297.5, rot: 90 },
      { id: "wardrobe", x: 430, z: 450, rot: 180 },
      { id: "ceiling-light", x: 560, z: 120 },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen with island",
    description: "Galley run with fridge, sink and cooker, wall cabinets, island with bar stools.",
    roomType: "kitchen",
    room: { length: 4.3, width: 3.0, wallColor: "#f2efe9", floorMaterial: "tile", floorColor: "#e0ddd6" },
    openings: [
      { type: "window", edge: 0, offset: 190 },
      { type: "door", edge: 2, offset: 80 },
    ],
    items: [
      { id: "fridge", x: 35, z: 35 },
      { id: "kitchen-base", x: 100, z: 30 },
      { id: "kitchen-sink", x: 190, z: 30 },
      { id: "kitchen-base", x: 280, z: 30 },
      { id: "stove", x: 340, z: 30 },
      { id: "kitchen-base", x: 400, z: 30 },
      { id: "wall-cabinet", x: 110, z: 17.5 },
      { id: "wall-cabinet", x: 270, z: 17.5 },
      { id: "wall-cabinet", x: 385, z: 17.5 },
      { id: "kitchen-island", x: 215, z: 170 },
      { id: "bar-stool", x: 175, z: 235 },
      { id: "bar-stool", x: 215, z: 235 },
      { id: "bar-stool", x: 255, z: 235 },
      { id: "washer", x: 35, z: 265, rot: 180 },
      { id: "ceiling-light", x: 215, z: 170 },
    ],
  },
  {
    id: "pooja",
    name: "Pooja room",
    description: "Compact prayer room: mandir, chowki seat, brass deepam, mat, Tulsi plant and storage.",
    roomType: "pooja",
    room: { length: 2.6, width: 2.4, wallColor: "#f6efe0", floorMaterial: "tile", floorColor: "#ddd3c0", wallPattern: "plaster" },
    openings: [
      { type: "window", edge: 0, offset: 60 },
      { type: "door", edge: 2, offset: 180 },
    ],
    items: [
      { id: "mandir", x: 190, z: 20, color: "#8a4b34" },
      { id: "deepam", x: 120, z: 40 },
      { id: "pooja-mat", x: 190, z: 115 },
      { id: "chowki", x: 190, z: 100 },
      { id: "pooja-plant", x: 230, z: 200 },
      { id: "pooja-cabinet", x: 242.5, z: 110, rot: 90 },
      { id: "ceiling-light", x: 130, z: 120 },
    ],
  },
  {
    id: "office",
    name: "Home office",
    description: "Corner L-desk with chair, filing cabinet, two bookshelves, plant and lamp.",
    roomType: "office",
    room: { length: 3.6, width: 3.2, wallColor: "#e9ecee", floorMaterial: "wood", floorColor: "#b8946f" },
    openings: [
      { type: "window", edge: 0, offset: 90 },
      { type: "door", edge: 3, offset: 220 },
    ],
    items: [
      { id: "l-desk", x: 270, z: 70 },
      { id: "office-chair", x: 237, z: 105, rot: 180 },
      { id: "filing-cabinet", x: 30, z: 200, rot: 270 },
      { id: "bookshelf", x: 100, z: 305, rot: 180 },
      { id: "bookshelf", x: 200, z: 305, rot: 180 },
      { id: "plant", x: 330, z: 290 },
      { id: "floor-lamp", x: 320, z: 200 },
      { id: "ceiling-light", x: 180, z: 160 },
    ],
  },
  {
    id: "dining",
    name: "Dining room",
    description: "Six-seat dining table, sideboard and crockery unit.",
    roomType: "dining",
    room: { length: 4.4, width: 3.8, wallColor: "#efe7dc", floorMaterial: "wood", floorColor: "#a9835c" },
    openings: [
      { type: "window", edge: 1, offset: 190 },
      { type: "door", edge: 0, offset: 380 },
    ],
    items: [
      { id: "dining-table", x: 220, z: 190 },
      { id: "dining-chairs", x: 220, z: 117 },
      { id: "dining-chairs", x: 220, z: 263, rot: 180 },
      { id: "dining-chair", x: 112, z: 190, rot: 270 },
      { id: "dining-chair", x: 328, z: 190, rot: 90 },
      { id: "sideboard", x: 220, z: 357.5, rot: 180 },
      { id: "crockery-unit", x: 20, z: 190, rot: 270 },
      { id: "plant", x: 410, z: 340 },
      { id: "ceiling-light", x: 220, z: 190 },
    ],
  },
  {
    id: "kids",
    name: "Kids room",
    description: "Bunk bed, study desk and chair, toy storage, bookshelf and play rug.",
    roomType: "kids",
    room: { length: 3.6, width: 3.4, wallColor: "#eef3ea", floorMaterial: "carpet", floorColor: "#c9c1b3" },
    openings: [
      { type: "window", edge: 0, offset: 250 },
      { type: "door", edge: 2, offset: 60 },
    ],
    items: [
      { id: "bunk-bed", x: 60, z: 100 },
      { id: "kids-desk", x: 332.5, z: 100, rot: 90 },
      { id: "office-chair", x: 275, z: 100, rot: 270, color: "#6b7140" },
      { id: "toy-storage", x: 180, z: 322.5, rot: 180 },
      { id: "rug", x: 200, z: 200, color: "#b5654a" },
      { id: "bookshelf", x: 15, z: 270, rot: 270 },
      { id: "plant", x: 330, z: 300 },
      { id: "ceiling-light", x: 180, z: 170 },
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    description: "Bathtub, toilet, vanity with basin and washing machine.",
    roomType: "bathroom",
    room: { length: 2.6, width: 2.3, wallColor: "#eef1f1", floorMaterial: "tile", floorColor: "#cfd2d0" },
    openings: [
      { type: "window", edge: 0, offset: 220 },
      { type: "door", edge: 3, offset: 80 },
    ],
    items: [
      { id: "bathtub", x: 85, z: 37.5 },
      { id: "toilet", x: 225, z: 150, rot: 90 },
      { id: "vanity", x: 60, z: 205, rot: 180 },
      { id: "washer", x: 150, z: 200, rot: 180 },
    ],
  },
];

export interface BuiltTemplate {
  room: RoomConfig;
  items: PlacedItem[];
}

/** Turns a template description into a room + placed items (unknown catalogue ids are skipped). */
export function buildTemplate(t: Template): BuiltTemplate {
  const room = sanitizeRoom({ ...DEFAULT_ROOM, ...t.room, openings: [] });
  room.openings = t.openings.map((o) => {
    const d = OPENING_DEFAULTS[o.type];
    return clampOpening(
      { id: uid(o.type), type: o.type, edge: o.edge, offset: o.offset / 100, width: o.width ? o.width / 100 : d.width, height: d.height, sill: d.sill },
      room,
    );
  });
  const items: PlacedItem[] = [];
  for (const ti of t.items) {
    const cat = getCatalogItem(ti.id);
    if (!cat) continue;
    const base = createPlacedItem(cat);
    items.push({
      ...base,
      x: ti.x / 100,
      z: ti.z / 100,
      rotation: ti.rot ?? 0,
      color: ti.color ?? base.color,
      orientation: ti.orient ?? base.orientation,
    });
  }
  return { room, items };
}
