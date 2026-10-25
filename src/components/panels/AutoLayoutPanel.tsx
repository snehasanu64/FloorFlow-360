"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";
import { ROOM_KINDS, autoArrange, type RoomKind } from "@/lib/autolayout";
import { useEditorStore } from "@/store/editor-store";
import { Button, Field } from "../layout/ui";
import { Drawer } from "../layout/Panels";

export function AutoLayoutPanel() {
  const s = useEditorStore();
  const [kind, setKind] = useState<RoomKind>("living");
  const [mode, setMode] = useState<"replace" | "add">("replace");
  const [skipped, setSkipped] = useState<string[] | null>(null);

  const run = () => {
    const keep = mode === "add" ? s.items : [];
    const res = autoArrange(s.room, kind, keep);
    s.replaceLayout({ items: res.items });
    setSkipped(res.skipped);
    const label = ROOM_KINDS.find((k) => k.value === kind)?.label ?? "room";
    s.notify(res.skipped.length ? "warning" : "success", res.skipped.length ? `${label} arranged — ${res.skipped.length} piece(s) did not fit.` : `${label} arranged. Use Undo to go back.`);
  };

  return (
    <Drawer title="Auto-arrange room" onClose={() => s.openPanel(null)}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted">
          Suggests a furniture layout for this floor using simple design rules: pieces against walls, a conversation area in front of the sofa,
          walking space around beds and tables, and clear door swings.
        </p>
        <Field label="Room type">
          <select value={kind} onChange={(e) => setKind(e.target.value as RoomKind)} className="h-9 w-full rounded-md border border-line bg-panel px-2 text-sm">
            {ROOM_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="mb-1 text-xs font-medium text-muted">Existing furniture</legend>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace everything on this floor
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "add"} onChange={() => setMode("add")} /> Keep what&apos;s there and add around it
          </label>
        </fieldset>
        <Button variant="primary" className="w-full py-2" onClick={run}>
          <Wand2 size={15} /> Arrange {ROOM_KINDS.find((k) => k.value === kind)?.label.toLowerCase()}
        </Button>
        {skipped && skipped.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <b>Did not fit:</b> {skipped.join(", ")}. Try a bigger room, or place those pieces by hand.
          </div>
        )}
        <p className="text-[11px] text-muted">Results are a starting point — drag, rotate or recolour anything afterwards. Ctrl+Z undoes the whole arrangement.</p>
      </div>
    </Drawer>
  );
}
