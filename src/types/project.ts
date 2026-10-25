import type { PlacedItem } from "./furniture";
import type { RoomConfig } from "./room";

/** v2 adds multiple floors ("levels") and custom (uploaded) models. v1 files with a single room still load. */
export const PROJECT_VERSION = 2;

export interface Level {
  id: string;
  name: string;
  room: RoomConfig;
  items: PlacedItem[];
}

/** Metadata of an uploaded GLB model. The binary itself stays in this browser's IndexedDB. */
export interface CustomModelMeta {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  color: string;
}

/** Cost-estimate settings saved with the project. Overrides are unit prices per catalogue id, in `currency`. */
export interface EstimateSettings {
  currency: string;
  taxPct: number;
  discountPct: number;
  overrides: Record<string, number>;
}

export interface ProjectFile {
  app: "roomcraft-3d";
  version: number;
  name: string;
  savedAt: string;
  levels: Level[];
  customModels?: CustomModelMeta[];
  estimate?: EstimateSettings;
}

export interface Snapshot {
  room: RoomConfig;
  items: PlacedItem[];
}
