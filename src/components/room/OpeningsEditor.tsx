"use client";

import { DoorOpen, Plus, Square, Trash2 } from "lucide-react";
import { roomEdges, wallLabel } from "@/lib/roomShape";
import { useEditorStore } from "@/store/editor-store";
import type { Opening } from "@/types/room";
import { Button, IconButton } from "../layout/ui";
import { NumberField } from "../properties/NumberField";


export function OpeningsEditor() {
  const room = useEditorStore((s) => s.room);
  const edges = roomEdges(room);
  const add = useEditorStore((s) => s.addOpening);
  const update = useEditorStore((s) => s.updateOpening);
  const remove = useEditorStore((s) => s.removeOpening);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => add("door")}>
          <Plus size={14} /> Door
        </Button>
        <Button className="flex-1" onClick={() => add("window")}>
          <Plus size={14} /> Window
        </Button>
      </div>
      {room.openings.length === 0 && <p className="text-xs text-muted">Optional. Add doors and windows, then drag them along the walls in the 2D plan.</p>}
      {room.openings.map((o: Opening) => (
        <div key={o.id} className="space-y-2 rounded-lg border border-line p-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium capitalize">
              {o.type === "door" ? <DoorOpen size={14} /> : <Square size={14} />} {o.type}
            </span>
            <IconButton label={`Remove ${o.type}`} danger onClick={() => remove(o.id)}>
              <Trash2 size={14} />
            </IconButton>
          </div>
          <select
            aria-label="Wall"
            value={o.edge}
            onChange={(e) => update(o.id, { edge: Number(e.target.value) })}
            className="h-8 w-full rounded-md border border-line bg-panel px-2 text-sm"
          >
            {edges.map((e) => (
              <option key={e.index} value={e.index}>
                {wallLabel(e, room.northAngle)}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Position along wall" value={o.offset} onCommit={(v) => update(o.id, { offset: v })} min={0} max={(edges[Math.min(o.edge, edges.length - 1)]?.length ?? 1) * 100} />
            <NumberField label="Width" value={o.width} onCommit={(v) => update(o.id, { width: v })} min={30} max={600} />
            <NumberField label="Height" value={o.height} onCommit={(v) => update(o.id, { height: v })} min={30} max={600} />
            {o.type === "window" && <NumberField label="Sill height" value={o.sill} onCommit={(v) => update(o.id, { sill: v })} min={0} max={500} />}
          </div>
        </div>
      ))}
    </div>
  );
}
