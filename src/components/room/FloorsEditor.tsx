"use client";

import { Layers, Plus, Trash2 } from "lucide-react";
import { SLAB } from "@/lib/levels";
import { useEditorStore } from "@/store/editor-store";
import { Button, IconButton } from "../layout/ui";

/** Add, rename, switch and delete floors. */
export function FloorsEditor() {
  const s = useEditorStore();
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {s.levels.map((l, i) => {
          const isActive = l.id === s.activeLevelId;
          const count = isActive ? s.items.length : (s.levelData[l.id]?.items.length ?? 0);
          return (
            <li key={l.id} className={`flex items-center gap-2 rounded-lg border p-1.5 ${isActive ? "border-accent bg-accent-soft" : "border-line"}`}>
              <Layers size={14} className="ml-1 shrink-0 text-muted" />
              <input
                aria-label={`Name of floor ${i + 1}`}
                value={l.name}
                onChange={(e) => s.renameLevel(l.id, e.target.value)}
                className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-medium focus:bg-panel focus:outline-none"
              />
              <span className="shrink-0 text-[11px] text-muted">{count} item{count === 1 ? "" : "s"}</span>
              {isActive ? (
                <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">Editing</span>
              ) : (
                <Button className="!px-2 !py-0.5 text-xs" onClick={() => s.switchLevel(l.id)}>
                  Edit
                </Button>
              )}
              <IconButton
                label={`Delete ${l.name}`}
                danger
                disabled={s.levels.length < 2}
                onClick={() =>
                  s.askConfirm({
                    title: `Delete "${l.name}"?`,
                    message: "The floor and everything on it will be removed. This cannot be undone.",
                    confirmLabel: "Delete floor",
                    danger: true,
                    onConfirm: () => s.removeLevel(l.id),
                  })
                }
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <Button className="w-full" onClick={() => s.addLevel()}>
        <Plus size={14} /> Add floor
      </Button>
      <p className="text-[11px] leading-snug text-muted">
        A new floor copies the footprint of the one you are editing. Floors stack at wall height + {Math.round(SLAB * 100)} cm of slab. Add a <b>staircase</b> (General tab) and it cuts an opening through the floor above. Undo history restarts when you switch floors.
      </p>
    </div>
  );
}
