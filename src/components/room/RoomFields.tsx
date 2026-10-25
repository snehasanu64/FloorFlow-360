"use client";

import { FLOOR_MATERIALS, ROOM_LIMITS, ROOM_SHAPES, WALL_PATTERNS } from "@/lib/room";
import { normalizeHex } from "@/lib/color";
import type { FloorMaterial, RoomConfig, RoomShape, WallPattern } from "@/types/room";
import { RotateCw } from "lucide-react";
import { Field } from "../layout/ui";
import { NumberField } from "../properties/NumberField";

type Dims = Pick<RoomConfig, "length" | "width" | "wallHeight" | "wallThickness" | "gridSpacing">;

const lim = (k: keyof typeof ROOM_LIMITS) => ({ min: ROOM_LIMITS[k].min * 100, max: ROOM_LIMITS[k].max * 100 });

/** Shared room inputs. `clamp` enforces the limits while typing (live editing); otherwise errors are shown. */
export function RoomFields({
  room,
  onChange,
  errors = {},
  clamp,
}: {
  room: Dims & Pick<RoomConfig, "floorMaterial" | "floorColor" | "wallColor" | "shape" | "shapeOrient" | "cutW" | "cutD" | "wallPattern">;
  onChange: (patch: Partial<RoomConfig>) => void;
  errors?: Record<string, string>;
  clamp: boolean;
}) {
  const nf = (key: keyof Dims, label: string) => (
    <NumberField
      label={label}
      value={room[key]}
      onCommit={(v) => onChange({ [key]: v })}
      error={errors[key]}
      {...(clamp ? lim(key) : {})}
    />
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {nf("length", "Room length")}
        {nf("width", "Room width")}
        {nf("wallHeight", "Wall height")}
        {nf("wallThickness", "Wall thickness")}
        {nf("gridSpacing", "Grid spacing")}
      </div>
      <div className="space-y-2 rounded-lg border border-line p-2.5">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label="Room shape">
            <select
              value={room.shape}
              onChange={(e) => onChange({ shape: e.target.value as RoomShape })}
              className="h-8 w-full rounded-md border border-line bg-panel px-2 text-sm"
            >
              {ROOM_SHAPES.map((sh) => (
                <option key={sh.value} value={sh.value}>
                  {sh.label}
                </option>
              ))}
            </select>
          </Field>
          {room.shape !== "rect" && (
            <button
              type="button"
              title="Rotate the shape 90°"
              aria-label="Rotate the shape 90 degrees"
              onClick={() => onChange({ shapeOrient: ((room.shapeOrient + 1) % 4) as 0 | 1 | 2 | 3 })}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line hover:bg-hover"
            >
              <RotateCw size={14} />
            </button>
          )}
        </div>
        {room.shape !== "rect" && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={room.shape === "chamfer" ? "Corner cut (across)" : "Cut-out width"} value={room.cutW} min={60} max={1900} onCommit={(v) => onChange({ cutW: v })} />
            <NumberField label={room.shape === "chamfer" ? "Corner cut (down)" : "Cut-out depth"} value={room.cutD} min={60} max={1900} onCommit={(v) => onChange({ cutD: v })} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Floor material">
          <select
            value={room.floorMaterial}
            onChange={(e) => {
              const m = e.target.value as FloorMaterial;
              const preset = FLOOR_MATERIALS.find((f) => f.value === m);
              onChange({ floorMaterial: m, floorColor: preset?.color ?? room.floorColor });
            }}
            className="h-8 w-full rounded-md border border-line bg-panel px-2 text-sm"
          >
            {FLOOR_MATERIALS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Floor colour">
          <input
            type="color"
            value={normalizeHex(room.floorColor)}
            onChange={(e) => onChange({ floorColor: e.target.value })}
            className="h-8 w-full cursor-pointer rounded-md border border-line bg-panel p-0.5"
          />
        </Field>
        <Field label="Wall pattern">
          <select
            value={room.wallPattern}
            onChange={(e) => onChange({ wallPattern: e.target.value as WallPattern })}
            className="h-8 w-full rounded-md border border-line bg-panel px-2 text-sm"
          >
            {WALL_PATTERNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Wall colour">
          <input
            type="color"
            value={normalizeHex(room.wallColor)}
            onChange={(e) => onChange({ wallColor: e.target.value })}
            className="h-8 w-full cursor-pointer rounded-md border border-line bg-panel p-0.5"
          />
        </Field>
      </div>
    </div>
  );
}
