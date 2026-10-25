import type { RoomConfig } from "@/types/room";

export type ViewPreset = "default" | "front" | "back" | "left" | "right" | "top" | "isometric";

export const VIEW_PRESETS: { value: ViewPreset; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
  { value: "isometric", label: "Isometric" },
];

export type Vec3 = [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export function roomCenter(room: Pick<RoomConfig, "length" | "width">): Vec3 {
  return [room.length / 2, 0.6, room.width / 2];
}

/** Camera pose for a named view of the whole room. Front looks from the south wall toward the north wall. */
export function presetPose(preset: ViewPreset, room: Pick<RoomConfig, "length" | "width" | "wallHeight">): CameraPose {
  const [cx, cy, cz] = roomCenter(room);
  const span = Math.max(room.length, room.width);
  const d = span * 1.15 + 1.5;
  const target: Vec3 = [cx, cy, cz];
  switch (preset) {
    case "front":
      return { position: [cx, d * 0.55, cz + d], target };
    case "back":
      return { position: [cx, d * 0.55, cz - d], target };
    case "left":
      return { position: [cx - d, d * 0.55, cz], target };
    case "right":
      return { position: [cx + d, d * 0.55, cz], target };
    case "top":
      return { position: [cx, d * 1.7, cz + 0.001], target: [cx, 0, cz] };
    case "isometric":
    case "default":
    default:
      return { position: [cx + d * 0.75, d * 0.8, cz + d * 0.85], target };
  }
}

/** Close-up pose for inspecting a single piece of furniture. */
export function inspectPose(x: number, z: number, height: number, size: number, elevation = 0): CameraPose {
  const d = Math.max(size, height) * 2.1 + 0.8;
  const y = elevation + height / 2;
  return { position: [x + d * 0.7, y + d * 0.55, z + d * 0.75], target: [x, y, z] };
}

/** Zoom so that the room fits an orthographic top-down viewport. */
export function orthoZoomToFit(room: Pick<RoomConfig, "length" | "width">, viewW: number, viewH: number) {
  const margin = 1.35;
  return Math.max(10, Math.min(viewW / (room.length * margin), viewH / (room.width * margin)));
}
