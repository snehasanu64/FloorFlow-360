"use client";

import { normalizeHex } from "@/lib/color";
import { WALL_PATTERNS } from "@/lib/room";
import { roomEdges, wallLabel } from "@/lib/roomShape";
import { useEditorStore } from "@/store/editor-store";
import type { WallPattern } from "@/types/room";

/** Per-wall colour and pattern overrides (accent walls). */
export function WallsEditor() {
  const room = useEditorStore((s) => s.room);
  const setRoom = useEditorStore((s) => s.setRoom);
  const edges = roomEdges(room);
  const setColor = (i: number, color: string | null) => {
    const next = { ...room.wallColors };
    if (color) next[String(i)] = color;
    else delete next[String(i)];
    setRoom({ wallColors: next });
  };
  const setPattern = (i: number, p: WallPattern | "") => {
    const next = { ...room.wallPatterns };
    if (p) next[String(i)] = p;
    else delete next[String(i)];
    setRoom({ wallPatterns: next });
  };
  return (
    <div className="space-y-2">
      {edges.map((e) => {
        const key = String(e.index);
        const custom = room.wallColors[key];
        return (
          <div key={key} className="rounded-lg border border-line p-2">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
              <span>{wallLabel(e, room.northAngle)}</span>
              {(custom || room.wallPatterns[key]) && (
                <button
                  className="text-accent hover:underline"
                  onClick={() => {
                    const colors = { ...room.wallColors };
                    const patterns = { ...room.wallPatterns };
                    delete colors[key];
                    delete patterns[key];
                    setRoom({ wallColors: colors, wallPatterns: patterns });
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Colour for wall ${e.index + 1}`}
                value={normalizeHex(custom ?? room.wallColor)}
                onChange={(ev) => setColor(e.index, ev.target.value)}
                className="h-8 w-10 cursor-pointer rounded-md border border-line bg-panel p-0.5"
              />
              <select
                aria-label={`Pattern for wall ${e.index + 1}`}
                value={room.wallPatterns[key] ?? ""}
                onChange={(ev) => setPattern(e.index, ev.target.value as WallPattern | "")}
                className="h-8 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-sm"
              >
                <option value="">Same as room</option>
                {WALL_PATTERNS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
