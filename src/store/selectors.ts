import { useMemo } from "react";
import { levelElevations } from "@/lib/levels";
import { analyzeLayout, issueCount } from "@/lib/placement";
import { useEditorStore } from "./editor-store";

/** Overlap / outside-room analysis, memoised on the layout only. */
export function useLayoutIssues() {
  const items = useEditorStore((s) => s.items);
  const room = useEditorStore((s) => s.room);
  return useMemo(() => {
    const map = analyzeLayout(items, room);
    return { map, counts: issueCount(map) };
  }, [items, room]);
}

export function useSelectedItem() {
  return useEditorStore((s) => s.items.find((i) => i.id === s.selectedId) ?? null);
}

/** Height of the active floor above the ground, metres. */
export function useActiveElevation() {
  const levels = useEditorStore((s) => s.levels);
  const levelData = useEditorStore((s) => s.levelData);
  const active = useEditorStore((s) => s.activeLevelId);
  const wallHeight = useEditorStore((s) => s.room.wallHeight);
  const ys = levelElevations(levels.map((l) => ({ id: l.id, wallHeight: l.id === active ? wallHeight : (levelData[l.id]?.room.wallHeight ?? 2.8) })));
  return ys[active] ?? 0;
}
