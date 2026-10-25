import type { ProjectFile } from "@/types/project";
import { uid } from "./id";
import { parseProjectJson, STORAGE_KEY } from "./persistence";

/**
 * Multiple saved projects in localStorage.
 *   roomcraft3d:library:v1        -> LibraryEntry[] (light index, newest first)
 *   roomcraft3d:project:<id>      -> ProjectFile JSON
 * The old single-slot save (roomcraft3d:project:v1) is migrated into the library on first read.
 */
const INDEX_KEY = "roomcraft3d:library:v1";
const PROJECT_PREFIX = "roomcraft3d:project:";
const MIGRATED_KEY = "roomcraft3d:library:migrated";

export interface LibraryEntry {
  id: string;
  name: string;
  savedAt: string;
  items: number;
  levels: number;
  dims: string;
  thumb?: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function readIndex(): LibraryEntry[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: LibraryEntry[]) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

function describe(p: ProjectFile): Pick<LibraryEntry, "items" | "levels" | "dims"> {
  const lv = p.levels[0];
  return {
    items: p.levels.reduce((n, l) => n + l.items.length, 0),
    levels: p.levels.length,
    dims: `${Math.round(lv.room.length * 100)} × ${Math.round(lv.room.width * 100)} cm`,
  };
}

function migrateLegacy() {
  try {
    if (window.localStorage.getItem(MIGRATED_KEY)) return;
    const text = window.localStorage.getItem(STORAGE_KEY);
    window.localStorage.setItem(MIGRATED_KEY, "1");
    if (!text) return;
    const res = parseProjectJson(text);
    if (!res.ok) return;
    const id = uid("proj");
    window.localStorage.setItem(PROJECT_PREFIX + id, JSON.stringify(res.project));
    writeIndex([{ id, name: res.project.name, savedAt: res.project.savedAt, ...describe(res.project) }, ...readIndex()]);
  } catch {
    /* storage unavailable: nothing to migrate */
  }
}

export function listProjects(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  migrateLegacy();
  return readIndex().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveToLibrary(id: string, project: ProjectFile, thumb?: string | null): Result<object> {
  try {
    window.localStorage.setItem(PROJECT_PREFIX + id, JSON.stringify(project));
    const rest = readIndex().filter((e) => e.id !== id);
    const prev = readIndex().find((e) => e.id === id);
    writeIndex([{ id, name: project.name, savedAt: project.savedAt, ...describe(project), thumb: thumb ?? prev?.thumb }, ...rest]);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `Could not save to local storage (${e instanceof Error ? e.message : "unavailable"}). Export the project as JSON instead.`,
    };
  }
}

export function loadFromLibrary(id: string): Result<{ project: ProjectFile; warnings: string[] }> {
  let text: string | null;
  try {
    text = window.localStorage.getItem(PROJECT_PREFIX + id);
  } catch {
    return { ok: false, error: "Local storage is unavailable in this browser." };
  }
  if (!text) return { ok: false, error: "That project could not be found." };
  const res = parseProjectJson(text);
  if (!res.ok) return { ok: false, error: `Saved project is invalid: ${res.errors.join(" ")}` };
  return { ok: true, project: res.project, warnings: res.warnings };
}

export function deleteFromLibrary(id: string) {
  try {
    window.localStorage.removeItem(PROJECT_PREFIX + id);
    writeIndex(readIndex().filter((e) => e.id !== id));
  } catch {
    /* ignore */
  }
}

export function renameInLibrary(id: string, name: string) {
  try {
    writeIndex(readIndex().map((e) => (e.id === id ? { ...e, name } : e)));
    const res = loadFromLibrary(id);
    if (res.ok) window.localStorage.setItem(PROJECT_PREFIX + id, JSON.stringify({ ...res.project, name }));
  } catch {
    /* ignore */
  }
}

export function duplicateInLibrary(id: string): string | null {
  const res = loadFromLibrary(id);
  if (!res.ok) return null;
  const nid = uid("proj");
  const copy: ProjectFile = { ...res.project, name: `${res.project.name} (copy)`, savedAt: new Date().toISOString() };
  const idx = readIndex().find((e) => e.id === id);
  return saveToLibrary(nid, copy, idx?.thumb).ok ? nid : null;
}
