import { registerCustomModel, unregisterCustomModel } from "@/data/furniture-catalog";
import type { CustomModelMeta } from "@/types/project";
import { uid } from "./id";

/**
 * User-uploaded GLB models. The binary lives in this browser's IndexedDB (too big for localStorage or a
 * project JSON); the project file only stores size / name metadata, so a project opened elsewhere shows a
 * placeholder box until the .glb is imported there too.
 */
const DB_NAME = "roomcraft3d-models";
const META = "meta";
const BLOBS = "blobs";
export const MAX_MODEL_BYTES = 25 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available in this browser."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the model database."));
  });
}

function tx<T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        const r = run(t);
        t.oncomplete = () => {
          db.close();
          resolve(r ? (r.result as T) : undefined);
        };
        t.onerror = () => reject(t.error ?? new Error("Database error."));
        t.onabort = () => reject(t.error ?? new Error("Database transaction was aborted."));
      }),
  );
}

export async function listStoredModels(): Promise<CustomModelMeta[]> {
  try {
    const rows = await tx<CustomModelMeta[]>([META], "readonly", (t) => t.objectStore(META).getAll());
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function getModelBlob(id: string): Promise<Blob | undefined> {
  return tx<Blob>([BLOBS], "readonly", (t) => t.objectStore(BLOBS).get(id));
}

export async function storeModel(meta: CustomModelMeta, blob: Blob): Promise<void> {
  await tx([META, BLOBS], "readwrite", (t) => {
    t.objectStore(META).put(meta);
    t.objectStore(BLOBS).put(blob, meta.id);
  });
}

export async function deleteStoredModel(id: string): Promise<void> {
  await tx([META, BLOBS], "readwrite", (t) => {
    t.objectStore(META).delete(id);
    t.objectStore(BLOBS).delete(id);
  });
  unregisterCustomModel(id);
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/** Registers every stored model in the catalogue (call once at start-up). */
export async function loadStoredModelsIntoCatalog(): Promise<number> {
  const metas = await listStoredModels();
  metas.forEach(registerCustomModel);
  return metas.length;
}

const urlCache = new Map<string, string | null>();

/** Object URL for a stored model (cached); null when the binary is not in this browser. */
export async function modelUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id) ?? null;
  try {
    const blob = await getModelBlob(id);
    const url = blob ? URL.createObjectURL(blob) : null;
    urlCache.set(id, url);
    return url;
  } catch {
    urlCache.set(id, null);
    return null;
  }
}
export const forgetModelUrl = (id: string) => urlCache.delete(id);

export type ImportUnit = "m" | "cm" | "mm" | "in";
export const IMPORT_UNITS: Record<ImportUnit, { label: string; scale: number }> = {
  m: { label: "Metres", scale: 1 },
  cm: { label: "Centimetres", scale: 0.01 },
  mm: { label: "Millimetres", scale: 0.001 },
  in: { label: "Inches", scale: 0.0254 },
};

/** Reads a .glb, measures it, stores it and registers it in the catalogue. Throws a readable Error on failure. */
export async function importGlbFile(file: File, unit: ImportUnit, displayName?: string): Promise<CustomModelMeta> {
  if (!/\.(glb|gltf)$/i.test(file.name)) throw new Error("Choose a .glb file (binary glTF).");
  if (file.size > MAX_MODEL_BYTES) throw new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${MAX_MODEL_BYTES / 1048576} MB.`);
  const [{ GLTFLoader }, THREE] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("three")]);
  const url = URL.createObjectURL(file);
  try {
    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(url);
    } catch {
      throw new Error("The model could not be read. Use a self-contained .glb file (Draco-compressed models are not supported).");
    }
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.x + size.y + size.z) || size.x + size.y + size.z === 0) throw new Error("The model appears to be empty.");
    const k = IMPORT_UNITS[unit].scale;
    const dims = { width: size.x * k, depth: size.z * k, height: size.y * k };
    const biggest = Math.max(dims.width, dims.depth, dims.height);
    if (biggest > 30 || biggest < 0.02) throw new Error(`The model measures ${biggest.toFixed(3)} m at that unit — pick a different unit (it is probably in ${biggest > 30 ? "millimetres or centimetres" : "metres"}).`);
    const meta: CustomModelMeta = {
      id: uid("custom"),
      name: (displayName?.trim() || file.name.replace(/\.(glb|gltf)$/i, "")).slice(0, 60),
      width: Math.round(dims.width * 1000) / 1000,
      depth: Math.round(dims.depth * 1000) / 1000,
      height: Math.round(dims.height * 1000) / 1000,
      color: "#c9c6c0",
    };
    await storeModel(meta, file);
    registerCustomModel(meta);
    return meta;
  } finally {
    URL.revokeObjectURL(url);
  }
}
