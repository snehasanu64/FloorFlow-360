import { getCatalogItem } from "@/data/furniture-catalog";
import type { MaterialKind, ModelKey, PlacedItem } from "@/types/furniture";
import type { FloorMaterial, RoomConfig, WallPattern } from "@/types/room";
import { defaultRoughness } from "./materials";

/** Interior style presets: a palette plus the materials that make the style recognisable. */
export interface StylePreset {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  wall: string;
  wallPattern: WallPattern;
  floorMaterial: FloorMaterial;
  floor: string;
  upholstery: string;
  upholsteryMaterial: "fabric" | "leather";
  wood: string;
  metal: string;
  accent: string;
  rug: string;
  cabinet: string;
}

export const STYLES: StylePreset[] = [
  {
    id: "scandinavian",
    name: "Scandinavian",
    description: "Light, airy and calm: pale woods, soft neutrals, a touch of sage.",
    keywords: ["scandinavian", "scandi", "nordic", "hygge", "airy", "light wood", "swedish", "danish"],
    wall: "#f3f1ec",
    wallPattern: "none",
    floorMaterial: "wood",
    floor: "#d9bf98",
    upholstery: "#cfcac1",
    upholsteryMaterial: "fabric",
    wood: "#d8bf98",
    metal: "#2b2b2b",
    accent: "#7f9a8c",
    rug: "#e5ded0",
    cabinet: "#f2f0ea",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean lines and quiet whites with almost no colour.",
    keywords: ["minimal", "minimalist", "minimalism", "clean", "simple", "white", "uncluttered", "monochrome"],
    wall: "#f6f6f4",
    wallPattern: "none",
    floorMaterial: "plain",
    floor: "#e6e3dd",
    upholstery: "#d6d3cd",
    upholsteryMaterial: "fabric",
    wood: "#cdb89a",
    metal: "#2a2a2a",
    accent: "#bfb8ac",
    rug: "#ecebe7",
    cabinet: "#f6f6f4",
  },
  {
    id: "modern",
    name: "Modern / contemporary",
    description: "Cool greys, dark metals and a deep navy accent.",
    keywords: ["modern", "contemporary", "urban", "sleek", "current", "city"],
    wall: "#e9e8e6",
    wallPattern: "none",
    floorMaterial: "wood",
    floor: "#8f7457",
    upholstery: "#6d7076",
    upholsteryMaterial: "fabric",
    wood: "#6b5845",
    metal: "#1c1c1e",
    accent: "#2f4f6f",
    rug: "#b9bcc2",
    cabinet: "#dcdad6",
  },
  {
    id: "industrial",
    name: "Industrial loft",
    description: "Exposed brick, concrete, black metal and worn leather.",
    keywords: ["industrial", "loft", "warehouse", "brick", "factory", "concrete", "steampunk"],
    wall: "#b9654a",
    wallPattern: "brick",
    floorMaterial: "concrete",
    floor: "#8a8b8b",
    upholstery: "#5b4636",
    upholsteryMaterial: "leather",
    wood: "#6b4f3a",
    metal: "#262626",
    accent: "#b4562f",
    rug: "#4a4a4a",
    cabinet: "#3a3a3c",
  },
  {
    id: "boho",
    name: "Boho / eclectic",
    description: "Earthy terracotta, warm wood, brass and plenty of colour.",
    keywords: ["boho", "bohemian", "eclectic", "colourful", "colorful", "earthy", "vibrant", "artsy"],
    wall: "#f3e6d4",
    wallPattern: "none",
    floorMaterial: "wood",
    floor: "#bd9a6f",
    upholstery: "#c5774f",
    upholsteryMaterial: "fabric",
    wood: "#a9774a",
    metal: "#b88a3b",
    accent: "#4c7a6a",
    rug: "#d9a066",
    cabinet: "#e6d2b3",
  },
  {
    id: "indian",
    name: "Traditional Indian",
    description: "Warm cream walls, teak and rosewood, maroon upholstery and brass.",
    keywords: ["traditional", "indian", "ethnic", "desi", "rajasthani", "heritage", "teak", "brass", "classic", "kerala", "south indian"],
    wall: "#f7ecd2",
    wallPattern: "plaster",
    floorMaterial: "tile",
    floor: "#e0cba3",
    upholstery: "#8c2f2f",
    upholsteryMaterial: "fabric",
    wood: "#6b3d22",
    metal: "#c9a227",
    accent: "#1f6f5b",
    rug: "#a8322d",
    cabinet: "#7a4b2b",
  },
  {
    id: "japandi",
    name: "Japandi",
    description: "Japanese calm meets Scandinavian warmth: natural wood, olive and stone.",
    keywords: ["japandi", "japanese", "zen", "wabi", "wabi-sabi", "tatami"],
    wall: "#ece8df",
    wallPattern: "plaster",
    floorMaterial: "wood",
    floor: "#cdb08a",
    upholstery: "#bfb7a8",
    upholsteryMaterial: "fabric",
    wood: "#b8946a",
    metal: "#2f2f2f",
    accent: "#6f7a5e",
    rug: "#d9d2c3",
    cabinet: "#e8e2d5",
  },
  {
    id: "luxe",
    name: "Modern luxe",
    description: "Rich navy and burgundy with walnut, marble tones and gold.",
    keywords: ["luxe", "luxury", "luxurious", "glam", "glamorous", "opulent", "premium", "elegant", "hotel", "plush", "gold"],
    wall: "#d9d0c4",
    wallPattern: "panels",
    floorMaterial: "tile",
    floor: "#e8e4de",
    upholstery: "#2e3a4f",
    upholsteryMaterial: "fabric",
    wood: "#4b3626",
    metal: "#c9a54a",
    accent: "#7a2f45",
    rug: "#cfc7b8",
    cabinet: "#3b3430",
  },
  {
    id: "coastal",
    name: "Coastal",
    description: "Sea-glass blues, white, driftwood and rope-like neutrals.",
    keywords: ["coastal", "beach", "nautical", "seaside", "hamptons", "marine", "sea", "ocean"],
    wall: "#eef3f4",
    wallPattern: "none",
    floorMaterial: "wood",
    floor: "#d9c7a8",
    upholstery: "#e9eef0",
    upholsteryMaterial: "fabric",
    wood: "#cdb99a",
    metal: "#8a8f93",
    accent: "#4f86a6",
    rug: "#d7e3e8",
    cabinet: "#f3f6f6",
  },
  {
    id: "rustic",
    name: "Rustic / farmhouse",
    description: "Weathered wood, leather, olive green and cosy warmth.",
    keywords: ["rustic", "farmhouse", "cabin", "country", "cottage", "lodge", "barn", "cosy", "cozy"],
    wall: "#e8dcc8",
    wallPattern: "plaster",
    floorMaterial: "wood",
    floor: "#8a6a45",
    upholstery: "#7a5a3a",
    upholsteryMaterial: "leather",
    wood: "#7b5a3a",
    metal: "#3a3a3a",
    accent: "#6b7140",
    rug: "#a07b55",
    cabinet: "#8a6a45",
  },
  {
    id: "midcentury",
    name: "Mid-century modern",
    description: "Walnut, mustard and teal with tapered, retro character.",
    keywords: ["mid-century", "midcentury", "mid century", "retro", "vintage", "60s", "70s", "sixties", "seventies"],
    wall: "#f1ece1",
    wallPattern: "none",
    floorMaterial: "wood",
    floor: "#a87c4f",
    upholstery: "#d89a3d",
    upholsteryMaterial: "fabric",
    wood: "#8b5a2b",
    metal: "#b07a3c",
    accent: "#2f7f7a",
    rug: "#e6ddc8",
    cabinet: "#a8743f",
  },
];

export const getStyle = (id: string) => STYLES.find((s) => s.id === id);

/** Free-text style request ("minimal Scandinavian with warm wood") -> best matching preset, or null. */
export function matchStyle(text: string): { style: StylePreset; score: number } | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\- ]+/g, " ")} `;
  let best: { style: StylePreset; score: number } | null = null;
  for (const style of STYLES) {
    let score = 0;
    if (t.includes(` ${style.id} `) || t.includes(` ${style.name.toLowerCase()} `)) score += 3;
    for (const k of style.keywords) if (t.includes(` ${k} `) || t.includes(` ${k}s `)) score += k.includes(" ") || k.includes("-") ? 2 : 1;
    if (score > (best?.score ?? 0)) best = { style, score };
  }
  return best;
}

type Role = "upholstery" | "accent" | "wood" | "cabinet" | "metal" | "rug";

const ROLE_BY_MODEL: Partial<Record<ModelKey, Role>> = {
  sofa: "upholstery",
  lsofa: "upholstery",
  bed: "upholstery",
  officeChair: "upholstery",
  armchair: "accent",
  ottoman: "accent",
  coffeeTable: "wood",
  tvUnit: "wood",
  sideTable: "wood",
  bookshelf: "wood",
  bedsideTable: "wood",
  wardrobe: "wood",
  dressingTable: "wood",
  diningTable: "wood",
  diningChairs: "wood",
  chair: "wood",
  sideboard: "wood",
  officeDesk: "wood",
  lDesk: "wood",
  storageCabinet: "wood",
  decorCabinet: "wood",
  drawers: "wood",
  shoeRack: "wood",
  chowki: "wood",
  mandir: "wood",
  stairs: "wood",
  crib: "wood",
  bunkBed: "wood",
  mirror: "wood",
  kitchenBase: "cabinet",
  sink: "cabinet",
  wallCabinet: "cabinet",
  vanity: "cabinet",
  floorLamp: "metal",
  ceilingLight: "metal",
  coatStand: "metal",
  barStool: "metal",
  spiralStairs: "metal",
  rug: "rug",
  beanbag: "accent",
  curtain: "accent",
  screen: "wood",
  grandClock: "wood",
  jhula: "wood",
  rack: "metal",
  basket: "metal",
};

/** The colour and material a style gives a catalogue piece (null = leave the piece alone, e.g. appliances, plants). */
export function styleFor(catalogId: string, style: StylePreset): { color: string; material: MaterialKind } | null {
  const cat = getCatalogItem(catalogId);
  if (!cat) return null;
  const role = ROLE_BY_MODEL[cat.model];
  if (!role) return null;
  const allowed = (m: MaterialKind) => cat.materials.includes(m);
  const pick = (...prefs: MaterialKind[]) => prefs.find(allowed) ?? cat.defaultMaterial;
  switch (role) {
    case "upholstery":
      return { color: style.upholstery, material: pick(style.upholsteryMaterial, "fabric", "leather", "matte") };
    case "accent":
      return { color: style.accent, material: pick(style.upholsteryMaterial, "fabric", "leather", "matte") };
    case "wood":
      return { color: style.wood, material: pick("wood", "matte") };
    case "cabinet":
      return { color: style.cabinet, material: pick("matte", "wood") };
    case "metal":
      return { color: style.metal, material: pick("metal", "matte") };
    case "rug":
      return { color: style.rug, material: pick("fabric") };
  }
}

/** Applies a style to the room finishes and to every unlocked piece it knows how to recolour. Layout is untouched. */
export function restyle(items: PlacedItem[], room: RoomConfig, style: StylePreset): { items: PlacedItem[]; room: RoomConfig; changed: number } {
  let changed = 0;
  const next = items.map((it) => {
    if (it.locked) return it;
    const s = styleFor(it.catalogId, style);
    if (!s) return it;
    changed++;
    return {
      ...it,
      color: s.color,
      material: s.material,
      roughness: s.material === it.material ? it.roughness : defaultRoughness(s.material),
      textureUrl: undefined,
    };
  });
  return { items: next, room: applyStyleToRoom(room, style), changed };
}

export function applyStyleToRoom(room: RoomConfig, style: StylePreset): RoomConfig {
  return {
    ...room,
    wallColor: style.wall,
    wallPattern: style.wallPattern,
    wallColors: {},
    wallPatterns: {},
    floorMaterial: style.floorMaterial,
    floorColor: style.floor,
  };
}
