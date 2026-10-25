import { getCatalogItem, registerCustomModel } from "@/data/furniture-catalog";
import { PROJECT_VERSION, type CustomModelMeta, type EstimateSettings, type Level, type ProjectFile } from "@/types/project";
import { DEFAULT_ESTIMATE, isCurrency } from "./estimate";
import type { MaterialKind, Orientation, PlacedItem } from "@/types/furniture";
import type { Opening, RoomConfig, WallSide } from "@/types/room";
import { isHexColor } from "./color";
import { uid } from "./id";
import { clamp } from "./measurements";
import { clampOpening, DEFAULT_ROOM, sanitizeRoom } from "./room";

/** Legacy single-slot key; kept so projects saved by older versions can be migrated into the library. */
export const STORAGE_KEY = "roomcraft3d:project:v1";

export type ValidationResult =
  | { ok: true; project: ProjectFile; warnings: string[] }
  | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const WALLS: WallSide[] = ["north", "south", "east", "west"];
const MATERIAL_KINDS: MaterialKind[] = ["fabric", "leather", "wood", "metal", "matte"];
const MAX_TEXTURE_CHARS = 450_000;

function parseRoom(r: Record<string, unknown>, warnings: string[], errors: string[]): RoomConfig | null {
  for (const key of ["length", "width", "wallHeight", "wallThickness", "gridSpacing"]) {
    if (!isNum(r[key])) {
      errors.push(`Room ${key} must be a number.`);
      return null;
    }
  }
  const rawOpenings = Array.isArray(r.openings) ? r.openings : [];
  const room = sanitizeRoom({ ...(r as Partial<RoomConfig>), openings: [] }, DEFAULT_ROOM);
  for (const key of ["length", "width", "wallHeight"] as const) {
    if (room[key] !== r[key]) warnings.push(`Room ${key} was outside the supported range and was adjusted.`);
  }
  const openings: Opening[] = [];
  const LEGACY_EDGE: Record<WallSide, number> = { north: 0, east: 1, south: 2, west: 3 };
  for (const o of rawOpenings) {
    if (!isObj(o) || (o.type !== "door" && o.type !== "window")) {
      warnings.push("A door/window entry was invalid and skipped.");
      continue;
    }
    if (![o.offset, o.width, o.height].every(isNum)) {
      warnings.push("A door/window entry had invalid numbers and was skipped.");
      continue;
    }
    let edge: number;
    let offset = o.offset as number;
    if (isNum(o.edge)) edge = o.edge;
    else if (WALLS.includes(o.wall as WallSide)) {
      // projects saved before room shapes existed: the wall was named, offset measured from the west / north end
      edge = LEGACY_EDGE[o.wall as WallSide];
      if (o.wall === "south") offset = room.length - offset;
      if (o.wall === "west") offset = room.width - offset;
    } else {
      warnings.push("A door/window entry was invalid and skipped.");
      continue;
    }
    openings.push(
      clampOpening(
        {
          id: typeof o.id === "string" ? o.id : uid(o.type),
          type: o.type,
          edge,
          offset,
          width: o.width as number,
          height: o.height as number,
          sill: isNum(o.sill) ? o.sill : 0,
        },
        room,
      ),
    );
  }
  room.openings = openings;
  return room;
}

function parseItems(rawItems: unknown[], room: RoomConfig, warnings: string[]): PlacedItem[] {
  const items: PlacedItem[] = [];
  const seen = new Set<string>();
  rawItems.forEach((it, idx) => {
    if (!isObj(it)) {
      warnings.push(`Furniture #${idx + 1} is not an object and was skipped.`);
      return;
    }
    const cat = typeof it.catalogId === "string" ? getCatalogItem(it.catalogId) : undefined;
    if (!cat) {
      warnings.push(`Furniture #${idx + 1} uses unknown catalogue ID "${String(it.catalogId)}" and was skipped.`);
      return;
    }
    const num = (v: unknown, fb: number, lo: number, hi: number) => (isNum(v) ? clamp(v, lo, hi) : fb);
    let id = typeof it.id === "string" && it.id ? it.id : uid("item");
    if (seen.has(id)) id = uid("item");
    seen.add(id);
    const material: MaterialKind = MATERIAL_KINDS.includes(it.material as MaterialKind) ? (it.material as MaterialKind) : cat.defaultMaterial;
    const tex = typeof it.textureUrl === "string" && it.textureUrl.startsWith("data:image/") && it.textureUrl.length <= MAX_TEXTURE_CHARS ? it.textureUrl : undefined;
    items.push({
      id,
      catalogId: cat.id,
      name: typeof it.name === "string" && it.name.trim() ? it.name.slice(0, 60) : cat.name,
      x: num(it.x, room.length / 2, -50, 50),
      z: num(it.z, room.width / 2, -50, 50),
      width: num(it.width, cat.width, cat.minSize, 10),
      depth: num(it.depth, cat.depth, cat.minSize, 10),
      height: num(it.height, cat.height, 0.01, 6),
      rotation: num(it.rotation, 0, -3600, 3600),
      color: isHexColor(it.color) ? it.color : cat.defaultColor,
      material,
      roughness: num(it.roughness, 0.6, 0, 1),
      orientation: (it.orientation === "left" ? "left" : "right") as Orientation,
      ...(it.locked === true ? { locked: true } : {}),
      ...(typeof it.groupId === "string" && it.groupId ? { groupId: it.groupId.slice(0, 40) } : {}),
      ...(it.detail === false ? { detail: false } : {}),
      ...(tex ? { textureUrl: tex } : {}),
    });
  });
  return items;
}

function parseCustomModels(raw: unknown, warnings: string[]): CustomModelMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomModelMeta[] = [];
  for (const m of raw) {
    if (!isObj(m) || typeof m.id !== "string" || !m.id.startsWith("custom-") || ![m.width, m.depth, m.height].every(isNum)) {
      warnings.push("A custom model entry was invalid and skipped.");
      continue;
    }
    out.push({
      id: m.id,
      name: typeof m.name === "string" ? m.name.slice(0, 60) : "Custom model",
      width: clamp(m.width as number, 0.05, 20),
      depth: clamp(m.depth as number, 0.05, 20),
      height: clamp(m.height as number, 0.01, 8),
      color: isHexColor(m.color) ? m.color : "#c9c6c0",
    });
  }
  return out;
}

function parseEstimate(raw: unknown): EstimateSettings | undefined {
  if (!isObj(raw)) return undefined;
  const overrides: Record<string, number> = {};
  if (isObj(raw.overrides)) {
    for (const [k, v] of Object.entries(raw.overrides)) if (isNum(v) && v >= 0 && v <= 1e9 && k.length < 60) overrides[k] = v;
  }
  return {
    currency: isCurrency(raw.currency) ? raw.currency : DEFAULT_ESTIMATE.currency,
    taxPct: isNum(raw.taxPct) ? clamp(raw.taxPct, 0, 100) : 0,
    discountPct: isNum(raw.discountPct) ? clamp(raw.discountPct, 0, 100) : 0,
    overrides,
  };
}

/** Validates and normalises an untrusted project (from localStorage or an imported file). */
export function validateProject(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, errors: ["The file does not contain a project object."] };
  const errors: string[] = [];
  const warnings: string[] = [];

  if (raw.app !== undefined && raw.app !== "roomcraft-3d") errors.push("This file was not created by RoomCraft 3D.");
  if (!isNum(raw.version)) errors.push("Missing project version.");
  else if (raw.version > PROJECT_VERSION) errors.push(`Project version ${raw.version} is newer than this app supports.`);

  // v2 has `levels`; v1 had a single `room` + `items`
  let rawLevels: { id?: unknown; name?: unknown; room: unknown; items: unknown }[] = [];
  if (Array.isArray(raw.levels)) {
    rawLevels = raw.levels.filter(isObj) as typeof rawLevels;
    if (!rawLevels.length) errors.push("The project has no floors.");
  } else {
    if (!isObj(raw.room)) errors.push("Missing room settings.");
    if (!Array.isArray(raw.items)) errors.push("Missing furniture list.");
    rawLevels = [{ name: "Ground floor", room: raw.room, items: raw.items }];
  }
  if (errors.length) return { ok: false, errors };

  const customModels = parseCustomModels(raw.customModels, warnings);
  customModels.forEach(registerCustomModel);

  const levels: Level[] = [];
  const seenIds = new Set<string>();
  for (const [i, lv] of rawLevels.entries()) {
    if (!isObj(lv.room) || !Array.isArray(lv.items)) {
      errors.push(`Floor ${i + 1} is missing its room or furniture list.`);
      continue;
    }
    const room = parseRoom(lv.room, warnings, errors);
    if (!room) continue;
    let id = typeof lv.id === "string" && lv.id ? lv.id : uid("lvl");
    if (seenIds.has(id)) id = uid("lvl");
    seenIds.add(id);
    levels.push({
      id,
      name: typeof lv.name === "string" && lv.name.trim() ? lv.name.slice(0, 40) : `Floor ${i + 1}`,
      room,
      items: parseItems(lv.items, room, warnings),
    });
  }
  if (errors.length || !levels.length) return { ok: false, errors: errors.length ? errors : ["The project has no valid floors."] };

  return {
    ok: true,
    warnings,
    project: {
      app: "roomcraft-3d",
      version: PROJECT_VERSION,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.slice(0, 80) : "Imported project",
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
      levels,
      ...(customModels.length ? { customModels } : {}),
      ...(parseEstimate(raw.estimate) ? { estimate: parseEstimate(raw.estimate) } : {}),
    },
  };
}

export function parseProjectJson(text: string): ValidationResult {
  try {
    return validateProject(JSON.parse(text));
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
}

/** Convenience: a one-floor project. */
export function buildProjectFile(name: string, room: RoomConfig, items: PlacedItem[]): ProjectFile {
  return buildProjectFromLevels(name, [{ id: uid("lvl"), name: "Ground floor", room, items }]);
}

export function buildProjectFromLevels(name: string, levels: Level[], customModels?: CustomModelMeta[], estimate?: EstimateSettings): ProjectFile {
  return {
    app: "roomcraft-3d",
    version: PROJECT_VERSION,
    name,
    savedAt: new Date().toISOString(),
    levels,
    ...(customModels?.length ? { customModels } : {}),
    ...(estimate ? { estimate } : {}),
  };
}

export function isStorageAvailable(): boolean {
  try {
    const k = "__roomcraft_test__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
