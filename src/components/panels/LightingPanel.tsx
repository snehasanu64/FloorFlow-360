"use client";

import { Box, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { formatHour, lampsActive, sunState, type LampsMode } from "@/lib/lighting";
import { useEditorStore } from "@/store/editor-store";
import { Button, Segmented } from "../layout/ui";
import { Drawer } from "../layout/Panels";

const PRESETS: { label: string; hour: number; icon: React.ReactNode }[] = [
  { label: "Sunrise", hour: 6.5, icon: <Sunrise size={14} /> },
  { label: "Morning", hour: 9, icon: <Sun size={14} /> },
  { label: "Noon", hour: 12.5, icon: <Sun size={14} /> },
  { label: "Golden hour", hour: 17.5, icon: <Sunset size={14} /> },
  { label: "Evening", hour: 19.5, icon: <Moon size={14} /> },
  { label: "Night", hour: 23, icon: <Moon size={14} /> },
];

export function LightingPanel() {
  const s = useEditorStore();
  const sun = sunState(s.timeOfDay);
  const lamps = s.items.filter((i) => ["floor-lamp", "ceiling-light"].includes(i.catalogId)).length;
  return (
    <Drawer title="Lighting & time of day" onClose={() => s.openPanel(null)}>
      <div className="space-y-4 p-4">
        {s.mode !== "3d" && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-sunken p-2.5 text-xs">
            <span className="text-muted">Lighting shows in the 3D view.</span>
            <Button className="!px-2 !py-1 text-xs" onClick={() => s.setMode("3d")}>
              <Box size={13} /> Open 3D
            </Button>
          </div>
        )}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted">Time of day</span>
            <span className="text-lg font-semibold tabular-nums">{formatHour(s.timeOfDay)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={0.25}
            value={s.timeOfDay}
            aria-label="Time of day"
            onChange={(e) => s.setTimeOfDay(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => s.setTimeOfDay(p.hour)}
                className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-hover"
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">Lamps</div>
          <Segmented<LampsMode>
            value={s.lampsMode}
            onChange={s.setLampsMode}
            options={[
              { value: "auto", label: "Auto (dusk–dawn)" },
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
          <p className="mt-1.5 text-xs text-muted">
            {lamps === 0
              ? "Add a floor lamp or ceiling light to see them light the room."
              : `${Math.min(lamps, 6)} lamp${lamps === 1 ? "" : "s"} currently ${lampsActive(s.lampsMode, sun) ? "lit" : "off"} (up to 6 light the room).`}
          </p>
        </div>
        <p className="text-[11px] leading-snug text-muted">
          Sunlight enters through the windows you placed and casts moving shadows. The sun rises in the east (right side of the plan at 0° north) and sets in the west.
        </p>
      </div>
    </Drawer>
  );
}
