"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCm } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";
import { useLayoutIssues } from "@/store/selectors";

export function StatusBar() {
  useEditorStore((s) => s.units);
  const room = useEditorStore((s) => s.room);
  const count = useEditorStore((s) => s.items.length);
  const items = useEditorStore((s) => s.items);
  const select = useEditorStore((s) => s.select);
  const { map, counts } = useLayoutIssues();
  const first = items.find((i) => map.get(i.id)?.overlaps.length || map.get(i.id)?.outside);
  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-xs text-muted">
      <span>
        Room {formatCm(room.length)} × {formatCm(room.width)} × {formatCm(room.wallHeight)}
      </span>
      <span>
        {count} item{count === 1 ? "" : "s"}
      </span>
      {counts.overlaps + counts.outside > 0 ? (
        <button onClick={() => first && select(first.id)} className="flex items-center gap-1 font-medium text-amber-700 hover:underline">
          <AlertTriangle size={13} />
          {counts.overlaps > 0 && `${counts.overlaps} overlapping`}
          {counts.overlaps > 0 && counts.outside > 0 && " · "}
          {counts.outside > 0 && `${counts.outside} outside room`}
        </button>
      ) : (
        <span className="flex items-center gap-1 text-emerald-700">
          <CheckCircle2 size={13} /> No layout issues
        </span>
      )}
      <span className="ml-auto max-md:hidden">Ctrl+Z undo · Ctrl+Y redo · Del delete · Ctrl+D duplicate · R rotate</span>
    </footer>
  );
}
