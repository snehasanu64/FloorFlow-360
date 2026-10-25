import { create } from "zustand";
import { getCatalogItem } from "@/data/furniture-catalog";
import type { ViewPreset } from "@/lib/camera";
import { uid } from "@/lib/id";
import { normalizeDeg, round, setCurrentUnit, type Unit } from "@/lib/measurements";
import { buildProjectFromLevels, type ValidationResult } from "@/lib/persistence";
import { capture2DThumb } from "@/lib/export";
import { loadFromLibrary, saveToLibrary } from "@/lib/library";
import { listCustomModels, registerCustomModel } from "@/data/furniture-catalog";
import {
  analyzeLayout,
  clampInsideRoom,
  createPlacedItem,
  findFreeSpot,
  issueCount,
  resetItemToDefaults,
  type AlignGuide,
} from "@/lib/placement";
import { clampOpening, createOpening, DEFAULT_ROOM, sanitizeRoom } from "@/lib/room";
import { alignItems, expandGroups, rotateGroup, selectionBounds, type AlignMode } from "@/lib/selection-ops";
import { defaultRoughness } from "@/lib/materials";
import type { MaterialKind, PlacedItem } from "@/types/furniture";
import type { EstimateSettings, ProjectFile, Snapshot } from "@/types/project";
import { DEFAULT_ESTIMATE } from "@/lib/estimate";
import type { P2 } from "@/lib/roomShape";
import type { LampsMode } from "@/lib/lighting";
import type { Opening, OpeningType, RoomConfig, WallMode } from "@/types/room";

export type EditorMode = "2d" | "3d";
export type SidebarTab = "room" | "furniture" | "materials" | "properties";
export type CameraType = "perspective" | "orthographic";
export type InspectTarget = "room" | "furniture";
export type FloorView = "active" | "below" | "all";
export type Tool = "select" | "marquee" | "measure";
export type PanelId = "projects" | "templates" | "autolayout" | "vastu" | "estimate" | "photo" | "models" | "lighting";

export interface Notice {
  id: string;
  kind: "info" | "success" | "warning" | "error";
  message: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

const HISTORY_LIMIT = 100;
const PREFS_KEY = "roomcraft3d:prefs:v1";

export function loadPrefs(): { units?: Unit; theme?: "light" | "dark" } {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePrefs(patch: Record<string, unknown>) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    /* preferences are optional */
  }
}

interface EditorState {
  screen: "landing" | "setup" | "editor";
  projectName: string;
  /** Library id once the project has been saved. */
  projectId: string | null;
  /** Floors: `room` / `items` always hold the active floor; the others live in `levelData`. */
  levels: { id: string; name: string }[];
  activeLevelId: string;
  levelData: Record<string, Snapshot>;
  panel: PanelId | null;
  estimate: EstimateSettings;
  room: RoomConfig;
  items: PlacedItem[];
  past: Snapshot[];
  future: Snapshot[];
  txBase: Snapshot | null;
  dirty: boolean;
  lastSavedAt: string | null;

  selectedId: string | null;
  /** All selected item ids; `selectedId` is the primary (last) one. */
  selectedIds: string[];
  tool: Tool;
  hasClipboard: boolean;
  measures: { a: P2; b: P2 }[];
  pendingMeasure: P2 | null;
  mode: EditorMode;
  sidebarTab: SidebarTab;
  snapGrid: boolean;
  showGrid: boolean;
  snapWalls: boolean;
  alignGuides: boolean;
  guides: AlignGuide[];
  fitNonce: number;

  cameraType: CameraType;
  wallMode: WallMode;
  view360: boolean;
  inspect: InspectTarget;
  autoRotate: boolean;
  camCommand: { preset: ViewPreset; nonce: number };

  notices: Notice[];
  confirm: ConfirmRequest | null;
  units: Unit;
  theme: "light" | "dark";
  timeOfDay: number;
  lampsMode: LampsMode;
  walk: boolean;
  floorView: FloorView;
  /** Bumped when custom (GLB) models are added or removed so catalogue lists refresh. */
  customRev: number;

  // project lifecycle
  startProject: (room: RoomConfig, name?: string, items?: PlacedItem[]) => void;
  backToSetup: () => void;
  loadProject: (file: ProjectFile, opts?: { id?: string | null; dirty?: boolean }) => void;
  buildFile: () => ProjectFile;
  saveProject: (asNew?: boolean) => boolean;
  openFromLibrary: (id: string) => boolean;
  importResult: (res: ValidationResult) => boolean;
  openPanel: (p: PanelId | null) => void;
  setEstimate: (patch: Partial<EstimateSettings>) => void;
  // floors
  addLevel: (name?: string) => void;
  switchLevel: (id: string) => void;
  renameLevel: (id: string, name: string) => void;
  removeLevel: (id: string) => void;
  /** Replaces the whole layout of the active floor (templates, auto-arrange, restyle). */
  replaceLayout: (patch: { room?: RoomConfig; items?: PlacedItem[] }, label?: string) => void;
  setProjectName: (name: string) => void;

  // room
  setRoom: (patch: Partial<RoomConfig>) => void;
  addOpening: (type: OpeningType) => void;
  updateOpening: (id: string, patch: Partial<Opening>, transient?: boolean) => void;
  removeOpening: (id: string) => void;
  bringAllInside: () => void;

  // furniture
  addItem: (catalogId: string, at?: { x: number; z: number }, overrides?: Partial<PlacedItem>) => void;
  updateItem: (id: string, patch: Partial<PlacedItem>, coalesceKey?: string) => void;
  setMaterial: (id: string, material: MaterialKind) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  rotateItem: (id: string, deltaDeg: number) => void;
  resetItem: (id: string) => void;
  select: (id: string | null) => void;
  selectMany: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  setTool: (t: Tool) => void;
  addMeasurePoint: (p: P2) => void;
  clearMeasures: () => void;
  updateSelected: (patch: Partial<PlacedItem>) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  rotateSelected: (deg: number) => void;
  nudgeSelected: (dx: number, dz: number) => void;
  copySelected: () => void;
  cutSelected: () => void;
  paste: () => void;
  lockSelected: (locked: boolean) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  alignSelected: (mode: AlignMode) => void;
  /** Moves a set of items (by their drag-start origins) by a delta, without creating history. */
  moveGroupTransient: (origins: Record<string, { x: number; z: number }>, dx: number, dz: number) => void;

  // transient edits (drags): one history entry per gesture
  beginTransient: () => void;
  setItemTransient: (id: string, patch: Partial<PlacedItem>) => void;
  endTransient: () => void;
  setGuides: (g: AlignGuide[]) => void;

  undo: () => void;
  redo: () => void;

  // ui
  setMode: (m: EditorMode) => void;
  setSidebarTab: (t: SidebarTab) => void;
  toggle: (key: "snapGrid" | "showGrid" | "snapWalls" | "alignGuides") => void;
  fitView: () => void;
  setCameraType: (c: CameraType) => void;
  setWallMode: (w: WallMode) => void;
  toggle360: (on?: boolean) => void;
  setInspect: (i: InspectTarget) => void;
  setAutoRotate: (v: boolean) => void;
  requestCamera: (p: ViewPreset) => void;

  notify: (kind: Notice["kind"], message: string) => void;
  dismissNotice: (id: string) => void;
  setTimeOfDay: (h: number) => void;
  setLampsMode: (m: LampsMode) => void;
  setWalk: (on: boolean) => void;
  setFloorView: (v: FloorView) => void;
  bumpCustom: () => void;
  setUnits: (u: Unit) => void;
  setTheme: (t: "light" | "dark") => void;
  askConfirm: (req: ConfirmRequest) => void;
  closeConfirm: () => void;
}

let clipboard: PlacedItem[] = [];
let pasteCount = 0;
let lastCoalesce: { key: string; time: number } | null = null;

const snap = (s: { room: RoomConfig; items: PlacedItem[] }): Snapshot => ({ room: s.room, items: s.items });

export const useEditorStore = create<EditorState>()((set, get) => {
  /** Applies a change as one undoable history entry. */
  const commit = (patch: Partial<Snapshot>, coalesceKey?: string) => {
    const s = get();
    const now = Date.now();
    const coalesce = !!coalesceKey && lastCoalesce?.key === coalesceKey && now - lastCoalesce.time < 900;
    lastCoalesce = coalesceKey ? { key: coalesceKey, time: now } : null;
    const past = coalesce ? s.past : [...s.past, snap(s)].slice(-HISTORY_LIMIT);
    set({ ...patch, past, future: [], dirty: true });
  };

  return {
    screen: "landing",
    projectName: "My room",
    projectId: null,
    levels: [{ id: "lvl-0", name: "Ground floor" }],
    activeLevelId: "lvl-0",
    levelData: {},
    panel: null,
    estimate: DEFAULT_ESTIMATE,
    room: DEFAULT_ROOM,
    items: [],
    past: [],
    future: [],
    txBase: null,
    dirty: false,
    lastSavedAt: null,

    selectedId: null,
    selectedIds: [],
    tool: "select",
    hasClipboard: false,
    measures: [],
    pendingMeasure: null,
    mode: "2d",
    sidebarTab: "furniture",
    snapGrid: true,
    showGrid: true,
    snapWalls: true,
    alignGuides: true,
    guides: [],
    fitNonce: 0,

    cameraType: "perspective",
    wallMode: "auto",
    view360: false,
    inspect: "room",
    autoRotate: false,
    camCommand: { preset: "default", nonce: 0 },

    notices: [],
    confirm: null,
    units: "cm",
    theme: "light",
    timeOfDay: 14,
    lampsMode: "auto",
    walk: false,
    floorView: "below",
    customRev: 0,

    startProject: (room, name, items = []) => {
      lastCoalesce = null;
      const id = uid("lvl");
      set({
        screen: "editor",
        room: sanitizeRoom(room),
        items,
        projectId: null,
        estimate: DEFAULT_ESTIMATE,
        levels: [{ id, name: "Ground floor" }],
        activeLevelId: id,
        levelData: {},
        past: [],
        future: [],
        txBase: null,
        selectedId: null,
        selectedIds: [],
        measures: [],
        pendingMeasure: null,
        mode: "2d",
        view360: false,
        inspect: "room",
        dirty: items.length > 0,
        lastSavedAt: null,
        projectName: name?.trim() || "My room",
        panel: null,
        sidebarTab: "furniture",
        fitNonce: get().fitNonce + 1,
        camCommand: { preset: "default", nonce: get().camCommand.nonce + 1 },
      });
    },

    backToSetup: () => set({ screen: "setup", selectedId: null, selectedIds: [], panel: null }),

    loadProject: (file, opts = {}) => {
      lastCoalesce = null;
      for (const m of file.customModels ?? []) registerCustomModel(m);
      const [first, ...rest] = file.levels;
      const levelData: Record<string, Snapshot> = {};
      for (const lv of rest) levelData[lv.id] = { room: lv.room, items: lv.items };
      set({
        screen: "editor",
        room: first.room,
        items: first.items,
        levels: file.levels.map((l) => ({ id: l.id, name: l.name })),
        activeLevelId: first.id,
        levelData,
        projectId: opts.id ?? null,
        estimate: file.estimate ?? DEFAULT_ESTIMATE,
        past: [],
        future: [],
        txBase: null,
        selectedId: null,
        selectedIds: [],
        measures: [],
        pendingMeasure: null,
        mode: "2d",
        view360: false,
        inspect: "room",
        dirty: opts.dirty ?? false,
        lastSavedAt: opts.dirty ? null : file.savedAt,
        projectName: file.name,
        panel: null,
        fitNonce: get().fitNonce + 1,
        camCommand: { preset: "default", nonce: get().camCommand.nonce + 1 },
      });
    },

    buildFile: () => {
      const s = get();
      const levels = s.levels.map((l) => {
        const snap = l.id === s.activeLevelId ? { room: s.room, items: s.items } : s.levelData[l.id];
        return { id: l.id, name: l.name, room: snap.room, items: snap.items };
      });
      const used = new Set(levels.flatMap((l) => l.items.map((i) => i.catalogId)));
      const custom = listCustomModels()
        .filter((m) => used.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, width: m.width, depth: m.depth, height: m.height, color: m.defaultColor }));
      return buildProjectFromLevels(s.projectName, levels, custom, s.estimate);
    },

    saveProject: (asNew) => {
      const s = get();
      const id = asNew || !s.projectId ? uid("proj") : s.projectId;
      const file = s.buildFile();
      const res = saveToLibrary(id, file, capture2DThumb(s.room));
      if (!res.ok) {
        s.notify("error", res.error);
        return false;
      }
      set({ dirty: false, lastSavedAt: file.savedAt, projectId: id });
      s.notify("success", asNew ? "Saved as a new project." : "Project saved in this browser.");
      return true;
    },

    openFromLibrary: (id) => {
      const s = get();
      const res = loadFromLibrary(id);
      if (!res.ok) {
        s.notify("error", res.error);
        return false;
      }
      s.loadProject(res.project, { id });
      if (res.warnings.length) s.notify("warning", res.warnings.slice(0, 3).join(" "));
      else s.notify("success", `Opened "${res.project.name}".`);
      return true;
    },

    importResult: (res) => {
      const s = get();
      if (!res.ok) {
        s.notify("error", `Import failed: ${res.errors.join(" ")}`);
        return false;
      }
      s.loadProject(res.project, { id: null, dirty: true });
      if (res.warnings.length) s.notify("warning", `Imported with adjustments: ${res.warnings.slice(0, 3).join(" ")}`);
      else s.notify("success", `Imported "${res.project.name}".`);
      return true;
    },

    openPanel: (p) => set({ panel: p }),
    setEstimate: (patch) => set((s) => ({ estimate: { ...s.estimate, ...patch }, dirty: true })),

    addLevel: (name) => {
      const s = get();
      const id = uid("lvl");
      const label = name?.trim() || (s.levels.length === 0 ? "Ground floor" : `Floor ${s.levels.length + 1}`);
      // new floors start with the same footprint as the active one (no furniture)
      const room: RoomConfig = { ...s.room, openings: s.room.openings.filter((o) => o.type === "window") };
      set({
        levels: [...s.levels, { id, name: label }],
        levelData: { ...s.levelData, [s.activeLevelId]: { room: s.room, items: s.items } },
        activeLevelId: id,
        room,
        items: [],
        past: [],
        future: [],
        selectedId: null,
        selectedIds: [],
        dirty: true,
      });
      lastCoalesce = null;
    },

    switchLevel: (id) => {
      const s = get();
      if (id === s.activeLevelId || !s.levels.some((l) => l.id === id)) return;
      const target = s.levelData[id];
      if (!target) return;
      const rest = { ...s.levelData, [s.activeLevelId]: { room: s.room, items: s.items } };
      delete rest[id];
      lastCoalesce = null;
      set({
        activeLevelId: id,
        levelData: rest,
        room: target.room,
        items: target.items,
        past: [],
        future: [],
        txBase: null,
        selectedId: null,
        selectedIds: [],
        measures: [],
        pendingMeasure: null,
        fitNonce: s.fitNonce + 1,
      });
    },

    renameLevel: (id, name) => set((s) => ({ levels: s.levels.map((l) => (l.id === id ? { ...l, name: name.slice(0, 40) } : l)), dirty: true })),

    removeLevel: (id) => {
      const s = get();
      if (s.levels.length < 2) return;
      const remaining = s.levels.filter((l) => l.id !== id);
      const data = { ...s.levelData };
      if (id === s.activeLevelId) {
        const next = remaining[0];
        const target = data[next.id];
        delete data[next.id];
        lastCoalesce = null;
        set({ levels: remaining, activeLevelId: next.id, levelData: data, room: target.room, items: target.items, past: [], future: [], selectedId: null, selectedIds: [], dirty: true, fitNonce: s.fitNonce + 1 });
      } else {
        delete data[id];
        set({ levels: remaining, levelData: data, dirty: true });
      }
    },

    replaceLayout: (patch) => {
      const s = get();
      commit({ ...(patch.room ? { room: patch.room } : {}), ...(patch.items ? { items: patch.items } : {}) });
      set({ selectedId: null, selectedIds: [], fitNonce: patch.room ? s.fitNonce + 1 : s.fitNonce });
    },

    setProjectName: (name) => set({ projectName: name.slice(0, 80), dirty: true }),

    setRoom: (patch) => {
      const s = get();
      const next = sanitizeRoom({ ...s.room, ...patch }, s.room);
      commit({ room: next }, "room");
      const shrunk = next.length < s.room.length || next.width < s.room.width;
      if (shrunk) {
        const { outside } = issueCount(analyzeLayout(s.items, next));
        if (outside > 0)
          get().notify(
            "warning",
            `${outside} item${outside > 1 ? "s are" : " is"} now outside the room. They were kept in place and are highlighted.`,
          );
      }
    },

    addOpening: (type) => {
      const s = get();
      commit({ room: { ...s.room, openings: [...s.room.openings, createOpening(type, s.room)] } });
    },

    updateOpening: (id, patch, transient) => {
      const s = get();
      const openings = s.room.openings.map((o) => (o.id === id ? clampOpening({ ...o, ...patch }, s.room) : o));
      const room = { ...s.room, openings };
      if (transient) set({ room });
      else commit({ room }, `opening-${id}`);
    },

    removeOpening: (id) => {
      const s = get();
      commit({ room: { ...s.room, openings: s.room.openings.filter((o) => o.id !== id) } });
    },

    bringAllInside: () => {
      const s = get();
      const items = s.items.map((it) => {
        const c = clampInsideRoom(it, s.room);
        return { ...it, x: round(c.x, 4), z: round(c.z, 4) };
      });
      commit({ items });
      s.notify("info", "Moved every item inside the room where it fits.");
    },

    addItem: (catalogId, at, overrides) => {
      const s = get();
      const cat = getCatalogItem(catalogId);
      if (!cat) return;
      const base = { ...createPlacedItem(cat), ...overrides, id: createPlacedItem(cat).id };
      const pos = at ? clampInsideRoom(base, s.room, at.x, at.z) : findFreeSpot(base, s.items, s.room);
      const item = { ...base, x: round(pos.x, 4), z: round(pos.z, 4) };
      commit({ items: [...s.items, item] });
      set({ selectedId: item.id, selectedIds: [item.id] });
    },

    updateItem: (id, patch, coalesceKey) => {
      const s = get();
      commit({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }, coalesceKey);
    },

    setMaterial: (id, material) => {
      get().updateItem(id, { material, roughness: defaultRoughness(material) });
    },

    removeItem: (id) => {
      const s = get();
      commit({ items: s.items.filter((it) => it.id !== id) });
      if (s.selectedIds.includes(id)) {
        const rest = s.selectedIds.filter((x) => x !== id);
        set({ selectedIds: rest, selectedId: rest[rest.length - 1] ?? null });
      }
    },

    duplicateItem: (id) => {
      const s = get();
      const src = s.items.find((it) => it.id === id);
      if (!src) return;
      const copy: PlacedItem = { ...src, id: uid("item") };
      const pos = findFreeSpot(copy, s.items, s.room);
      const placed = { ...copy, x: round(pos.x, 4), z: round(pos.z, 4) };
      // A free spot near the centre is useless if the room is full: nudge from the source instead.
      const probe = analyzeLayout([...s.items, placed], s.room).get(placed.id);
      const final =
        probe && (probe.overlaps.length || probe.outside)
          ? { ...placed, ...clampInsideRoom(placed, s.room, src.x + 0.3, src.z + 0.3) }
          : placed;
      commit({ items: [...s.items, final] });
      set({ selectedId: final.id, selectedIds: [final.id] });
    },

    rotateItem: (id, deltaDeg) => {
      const s = get();
      const it = s.items.find((i) => i.id === id);
      if (!it) return;
      get().updateItem(id, { rotation: normalizeDeg(round(it.rotation + deltaDeg, 2)) }, deltaDeg % 90 === 0 ? undefined : "rotate");
    },

    resetItem: (id) => {
      const s = get();
      commit({ items: s.items.map((it) => (it.id === id ? resetItemToDefaults(it) : it)) });
    },

    select: (id) =>
      set((s) => {
        if (!id) return { selectedId: null, selectedIds: [] };
        const ids = expandGroups(s.items, [id]);
        return { selectedId: id, selectedIds: ids };
      }),
    selectMany: (ids) => set((s) => {
      const all = expandGroups(s.items, ids);
      return { selectedIds: all, selectedId: all[all.length - 1] ?? null };
    }),
    toggleSelect: (id) =>
      set((s) => {
        const group = expandGroups(s.items, [id]);
        const has = s.selectedIds.includes(id);
        const ids = has ? s.selectedIds.filter((x) => !group.includes(x)) : [...new Set([...s.selectedIds, ...group])];
        return { selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
      }),
    selectAll: () => set((s) => ({ selectedIds: s.items.map((i) => i.id), selectedId: s.items[s.items.length - 1]?.id ?? null })),
    setTool: (t) => set(t === "select" ? { tool: t, pendingMeasure: null } : { tool: t }),
    addMeasurePoint: (p) =>
      set((s) => (s.pendingMeasure ? { measures: [...s.measures, { a: s.pendingMeasure, b: p }], pendingMeasure: null } : { pendingMeasure: p })),
    clearMeasures: () => set({ measures: [], pendingMeasure: null }),
    updateSelected: (patch) => {
      const s = get();
      commit({ items: s.items.map((it) => (s.selectedIds.includes(it.id) ? { ...it, ...patch } : it)) }, "update-selected");
    },

    removeSelected: () => {
      const s = get();
      if (!s.selectedIds.length) return;
      commit({ items: s.items.filter((it) => !s.selectedIds.includes(it.id)) });
      set({ selectedId: null, selectedIds: [] });
    },

    duplicateSelected: () => {
      const s = get();
      const src = s.items.filter((it) => s.selectedIds.includes(it.id));
      if (!src.length) return;
      const groupMap = new Map<string, string>();
      const copies = src.map((it) => {
        let groupId = it.groupId;
        if (groupId) {
          if (!groupMap.has(groupId)) groupMap.set(groupId, uid("grp"));
          groupId = groupMap.get(groupId);
        }
        const c: PlacedItem = { ...it, id: uid("item"), x: round(it.x + 0.3, 4), z: round(it.z + 0.3, 4), groupId, locked: false };
        return c;
      });
      commit({ items: [...s.items, ...copies] });
      set({ selectedIds: copies.map((c) => c.id), selectedId: copies[copies.length - 1].id });
    },

    rotateSelected: (deg) => {
      const s = get();
      if (!s.selectedIds.length) return;
      commit({ items: rotateGroup(s.items, s.selectedIds, deg) }, deg % 90 === 0 ? undefined : "rotate-sel");
    },

    nudgeSelected: (dx, dz) => {
      const s = get();
      const ids = s.selectedIds;
      if (!ids.length) return;
      commit(
        { items: s.items.map((it) => (ids.includes(it.id) && !it.locked ? { ...it, x: round(it.x + dx, 4), z: round(it.z + dz, 4) } : it)) },
        "nudge",
      );
    },

    copySelected: () => {
      const s = get();
      const src = s.items.filter((it) => s.selectedIds.includes(it.id));
      if (!src.length) return;
      clipboard = src.map((it) => ({ ...it }));
      set({ hasClipboard: true });
      get().notify("info", `Copied ${src.length} item${src.length > 1 ? "s" : ""}.`);
    },

    cutSelected: () => {
      get().copySelected();
      get().removeSelected();
    },

    paste: () => {
      const s = get();
      if (!clipboard.length) return;
      const groupMap = new Map<string, string>();
      const bounds = selectionBounds(clipboard);
      const shift = pasteCount++ % 4;
      const copies = clipboard.map((it) => {
        let groupId = it.groupId;
        if (groupId) {
          if (!groupMap.has(groupId)) groupMap.set(groupId, uid("grp"));
          groupId = groupMap.get(groupId);
        }
        const c: PlacedItem = { ...it, id: uid("item"), x: round(it.x + 0.4 + shift * 0.2, 4), z: round(it.z + 0.4 + shift * 0.2, 4), groupId, locked: false };
        return c;
      });
      void bounds;
      commit({ items: [...s.items, ...copies] });
      set({ selectedIds: copies.map((c) => c.id), selectedId: copies[copies.length - 1].id });
    },

    lockSelected: (locked) => {
      const s = get();
      commit({ items: s.items.map((it) => (s.selectedIds.includes(it.id) ? { ...it, locked: locked || undefined } : it)) });
    },

    groupSelected: () => {
      const s = get();
      if (s.selectedIds.length < 2) {
        s.notify("info", "Select two or more items to group them.");
        return;
      }
      const gid = uid("grp");
      commit({ items: s.items.map((it) => (s.selectedIds.includes(it.id) ? { ...it, groupId: gid } : it)) });
      s.notify("success", `Grouped ${s.selectedIds.length} items — they now select and move together.`);
    },

    ungroupSelected: () => {
      const s = get();
      commit({ items: s.items.map((it) => (s.selectedIds.includes(it.id) && it.groupId ? { ...it, groupId: undefined } : it)) });
    },

    alignSelected: (mode) => {
      const s = get();
      commit({ items: alignItems(s.items, s.selectedIds, mode) });
    },

    moveGroupTransient: (origins, dx, dz) => {
      set((s) => {
        const movable = s.items.filter((it) => origins[it.id] && !it.locked);
        const b = selectionBounds(movable.map((it) => ({ ...it, x: origins[it.id].x, z: origins[it.id].z })));
        let ddx = dx;
        let ddz = dz;
        if (b) {
          ddx = Math.min(s.room.length - b.maxX, Math.max(-b.minX, dx));
          ddz = Math.min(s.room.width - b.maxZ, Math.max(-b.minZ, dz));
        }
        return {
          items: s.items.map((it) =>
            origins[it.id] && !it.locked ? { ...it, x: round(origins[it.id].x + ddx, 4), z: round(origins[it.id].z + ddz, 4) } : it,
          ),
        };
      });
    },

    beginTransient: () => {
      const s = get();
      if (!s.txBase) set({ txBase: snap(s) });
    },

    setItemTransient: (id, patch) => {
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
    },

    endTransient: () => {
      const s = get();
      const base = s.txBase;
      set({ txBase: null, guides: [] });
      if (!base) return;
      if (base.items === s.items && base.room === s.room) return;
      lastCoalesce = null;
      set({ past: [...s.past, base].slice(-HISTORY_LIMIT), future: [], dirty: true });
    },

    setGuides: (g) => set({ guides: g }),

    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      lastCoalesce = null;
      set({
        room: prev.room,
        items: prev.items,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future].slice(0, HISTORY_LIMIT),
        selectedIds: s.selectedIds.filter((id) => prev.items.some((i) => i.id === id)),
        selectedId: prev.items.some((i) => i.id === s.selectedId) ? s.selectedId : null,
        dirty: true,
      });
    },

    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      lastCoalesce = null;
      set({
        room: next.room,
        items: next.items,
        past: [...s.past, snap(s)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        selectedIds: s.selectedIds.filter((id) => next.items.some((i) => i.id === id)),
        selectedId: next.items.some((i) => i.id === s.selectedId) ? s.selectedId : null,
        dirty: true,
      });
    },

    setMode: (m) => set({ mode: m, ...(m === "2d" ? { view360: false, walk: false } : { tool: "select" as Tool }) }),
    setSidebarTab: (t) => set({ sidebarTab: t }),
    toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<EditorState>),
    fitView: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
    setCameraType: (c) => set({ cameraType: c }),
    setWallMode: (w) => set({ wallMode: w }),
    toggle360: (on) =>
      set((s) => {
        const next = on ?? !s.view360;
        return next ? { view360: true, mode: "3d" as EditorMode } : { view360: false, autoRotate: false };
      }),
    setInspect: (i) => set({ inspect: i }),
    setAutoRotate: (v) => set({ autoRotate: v }),
    requestCamera: (p) => set((s) => ({ camCommand: { preset: p, nonce: s.camCommand.nonce + 1 } })),

    notify: (kind, message) =>
      set((s) => ({ notices: [...s.notices.slice(-3), { id: uid("n"), kind, message }] })),
    dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
    setTimeOfDay: (h) => set({ timeOfDay: Math.min(24, Math.max(0, h)) }),
    setLampsMode: (m) => set({ lampsMode: m }),
    setFloorView: (v) => set({ floorView: v }),
    bumpCustom: () => set((st) => ({ customRev: st.customRev + 1 })),
    setWalk: (on) => set(on ? { walk: true, mode: "3d" as EditorMode, cameraType: "perspective" as CameraType, view360: false, autoRotate: false, selectedId: null, selectedIds: [] } : { walk: false }),
    setUnits: (u) => {
      setCurrentUnit(u);
      set({ units: u });
      savePrefs({ units: u });
    },
    setTheme: (t) => {
      set({ theme: t });
      savePrefs({ theme: t });
    },
    askConfirm: (req) => set({ confirm: req }),
    closeConfirm: () => set({ confirm: null }),
  };
});


if (typeof window !== "undefined") {
  // handy for debugging and automated browser tests
  (window as unknown as { __roomcraft?: typeof useEditorStore }).__roomcraft = useEditorStore;
}
