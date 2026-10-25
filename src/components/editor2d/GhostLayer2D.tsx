"use client";

import { Group, Line, Text } from "react-konva";
import { getRoomPolygon, itemRects, rectCorners } from "@/lib/geometry";
import { isStairs } from "@/lib/levels";
import { PX_PER_M } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";

const PX = PX_PER_M;

/** Faint outline of the neighbouring floor (the one below, or above on the ground floor) to line up stairs and walls. */
export function GhostLayer2D({ scale }: { scale: number }) {
  const levels = useEditorStore((s) => s.levels);
  const levelData = useEditorStore((s) => s.levelData);
  const active = useEditorStore((s) => s.activeLevelId);
  const idx = levels.findIndex((l) => l.id === active);
  const other = idx > 0 ? levels[idx - 1] : levels[idx + 1];
  const snap = other ? levelData[other.id] : undefined;
  if (!other || !snap) return null;
  const poly = getRoomPolygon(snap.room);
  const fs = Math.max(8, 10 / scale);
  return (
    <Group name="ui-only" listening={false} opacity={0.9}>
      <Line points={poly.flatMap((p) => [p.x * PX, p.z * PX])} closed stroke="#6b7280" strokeWidth={1.5} dash={[8, 6]} strokeScaleEnabled={false} opacity={0.55} />
      {snap.items.map((it) => {
        const stairs = isStairs(it.catalogId);
        return itemRects(it).map((r, k) => (
          <Line
            key={`${it.id}-${k}`}
            points={rectCorners(r).flatMap((c) => [c.x * PX, c.z * PX])}
            closed
            fill={stairs ? "rgba(47,95,208,0.22)" : "rgba(0,0,0,0.05)"}
            stroke={stairs ? "#2f5fd0" : "rgba(0,0,0,0.22)"}
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={[4, 3]}
          />
        ));
      })}
      <Text x={6 / scale} y={-18 / scale - 4} text={`Ghost: ${other.name}${idx > 0 ? " (below)" : " (above)"}`} fontSize={fs} fill="#6b7280" />
    </Group>
  );
}
