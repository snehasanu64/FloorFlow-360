"use client";

import { AlertTriangle, Copy, Group, Lock, LockOpen, MousePointerClick, RotateCcw, RotateCw, Trash2, Undo2, Ungroup } from "lucide-react";
import { COLOR_PRESETS } from "@/lib/color";
import { getCatalogItem } from "@/data/furniture-catalog";
import { normalizeDeg, round } from "@/lib/measurements";
import { clampInsideRoom } from "@/lib/placement";
import { useEditorStore } from "@/store/editor-store";
import { useLayoutIssues, useSelectedItem } from "@/store/selectors";
import { Button, Segmented } from "../layout/ui";
import { MaterialControls } from "./MaterialControls";
import { NumberField } from "./NumberField";

export function EmptySelection({ text = "Select a piece of furniture to edit its size, position, colour and material." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
      <MousePointerClick size={28} className="text-line-strong" />
      <p>{text}</p>
    </div>
  );
}

function MultiPanel() {
  const s = useEditorStore();
  const sel = s.items.filter((i) => s.selectedIds.includes(i.id));
  const allLocked = sel.every((i) => i.locked);
  const grouped = sel.some((i) => i.groupId);
  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold">{sel.length} items selected</h2>
        <p className="text-xs text-muted">Move, rotate, align or style them together. Shift+click adds or removes items.</p>
      </div>
      <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-line p-1.5 text-xs">
        {sel.map((i) => (
          <li key={i.id} className="flex items-center gap-1.5 truncate">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/15" style={{ background: i.color }} />
            {i.name}
            {i.locked && <span title="Locked">🔒</span>}
            {i.groupId && <span title="Grouped">⛓</span>}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => s.rotateSelected(-90)}>
          <RotateCcw size={14} /> −90°
        </Button>
        <Button onClick={() => s.rotateSelected(90)}>
          <RotateCw size={14} /> +90°
        </Button>
        <Button onClick={() => s.lockSelected(!allLocked)}>
          {allLocked ? <LockOpen size={14} /> : <Lock size={14} />} {allLocked ? "Unlock" : "Lock"}
        </Button>
        <Button onClick={grouped ? s.ungroupSelected : s.groupSelected}>
          {grouped ? <Ungroup size={14} /> : <Group size={14} />} {grouped ? "Ungroup" : "Group"}
        </Button>
        <Button onClick={s.duplicateSelected}>
          <Copy size={14} /> Duplicate
        </Button>
        <Button variant="danger" onClick={s.removeSelected}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Set colour for all</div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              title={c.name}
              aria-label={c.name}
              onClick={() => s.updateSelected({ color: c.value })}
              className="h-7 w-7 rounded-full border border-black/15 transition hover:scale-110"
              style={{ background: c.value }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const item = useSelectedItem();
  const s = useEditorStore();
  const room = s.room;
  const { map } = useLayoutIssues();
  if (s.selectedIds.length > 1) return <MultiPanel />;
  if (!item) return <EmptySelection />;
  const cat = getCatalogItem(item.catalogId);
  const issue = map.get(item.id);
  const upd = (patch: Partial<typeof item>, key?: string) => s.updateItem(item.id, patch, key);
  const min = (cat?.minSize ?? 0.1) * 100;

  return (
    <div className="space-y-5 p-4">
      <div>
        <input
          aria-label="Item name"
          value={item.name}
          onChange={(e) => upd({ name: e.target.value.slice(0, 60) }, `name-${item.id}`)}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold text-ink hover:border-line focus:border-accent focus:outline-none"
        />
        <p className="px-1 text-xs text-muted">
          {cat?.name} · Price: {cat?.price.amount ?? "not set"} <span className="opacity-60">(placeholder)</span>
        </p>
      </div>

      {(issue?.overlaps.length || issue?.outside) && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            {issue.overlaps.length > 0 && <p>Overlaps {issue.overlaps.length} other item{issue.overlaps.length > 1 ? "s" : ""}.</p>}
            {issue.outside && (
              <p>
                Extends outside the room.{" "}
                <button
                  className="font-medium underline"
                  onClick={() => {
                    const c = clampInsideRoom(item, room);
                    upd({ x: round(c.x, 4), z: round(c.z, 4) });
                  }}
                >
                  Move inside
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Size</h3>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Width" value={item.width} min={min} max={1000} onCommit={(v) => upd({ width: v })} />
          <NumberField label="Depth" value={item.depth} min={min} max={1000} onCommit={(v) => upd({ depth: v })} />
          <NumberField label="Height" value={item.height} min={1} max={600} onCommit={(v) => upd({ height: v })} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Position</h3>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="X" value={item.x} min={-500} max={(room.length + 5) * 100} onCommit={(v) => upd({ x: v })} />
          <NumberField label="Z" value={item.z} min={-500} max={(room.width + 5) * 100} onCommit={(v) => upd({ z: v })} />
          <NumberField
            label="Rotation"
            unit="°"
            factor={1}
            value={item.rotation}
            onCommit={(v) => upd({ rotation: normalizeDeg(round(v, 2)) })}
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button className="flex-1" onClick={() => s.rotateItem(item.id, -90)}>
            <RotateCcw size={14} /> −90°
          </Button>
          <Button className="flex-1" onClick={() => s.rotateItem(item.id, 90)}>
            <RotateCw size={14} /> +90°
          </Button>
        </div>
      </section>

      {(cat?.model === "lsofa" || cat?.model === "lDesk") && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Return / chaise side</h3>
          <Segmented
            value={item.orientation}
            onChange={(v) => upd({ orientation: v })}
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Colour &amp; material</h3>
        <MaterialControls item={item} />
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button onClick={() => s.resetItem(item.id)} title="Restore catalogue size, colour, material and rotation">
          <Undo2 size={14} /> Reset to defaults
        </Button>
        <Button onClick={() => s.lockSelected(!item.locked)} title="Locked items cannot be dragged, resized or rotated by pointer">
          {item.locked ? <LockOpen size={14} /> : <Lock size={14} />} {item.locked ? "Unlock" : "Lock"}
        </Button>
        <Button onClick={() => s.duplicateItem(item.id)}>
          <Copy size={14} /> Duplicate
        </Button>
        <Button variant="danger" onClick={() => s.removeItem(item.id)}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}
