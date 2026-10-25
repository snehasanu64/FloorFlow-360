"use client";

import { levelElevations, stairOpenings } from "@/lib/levels";
import { useEditorStore } from "@/store/editor-store";
import { FurnitureStatic, Furniture3D } from "./Furniture3D";
import { Room3D, RoomView } from "./Room3D";

/** All floors stacked in 3D. The active floor is interactive; the others are shown for context. */
export function Levels3D() {
  const levels = useEditorStore((s) => s.levels);
  const levelData = useEditorStore((s) => s.levelData);
  const active = useEditorStore((s) => s.activeLevelId);
  const room = useEditorStore((s) => s.room);
  const items = useEditorStore((s) => s.items);
  const floorView = useEditorStore((s) => s.floorView);
  const wallMode = useEditorStore((s) => s.wallMode);

  const snap = (id: string) => (id === active ? { room, items } : levelData[id]);
  const ys = levelElevations(levels.map((l) => ({ id: l.id, wallHeight: snap(l.id)?.room.wallHeight ?? 2.8 })));
  const activeIdx = Math.max(0, levels.findIndex((l) => l.id === active));
  const shown = levels.filter((_, i) => floorView === "all" || i === activeIdx || (floorView === "below" && i < activeIdx));
  const topShown = shown[shown.length - 1]?.id;

  return (
    <>
      {levels.map((l, i) => {
        if (!shown.includes(l)) return null;
        const data = snap(l.id);
        if (!data) return null;
        const below = i > 0 ? snap(levels[i - 1].id) : undefined;
        const floorHoles = below ? stairOpenings(below.items) : [];
        const ceilingHoles = stairOpenings(data.items);
        const ceiling = l.id === topShown;
        if (l.id === active) {
          return (
            <group key={l.id} position={[0, ys[l.id], 0]}>
              <Room3D y={0} floorHoles={floorHoles} ceilingHoles={ceilingHoles} ceiling={ceiling} />
              <Furniture3D />
            </group>
          );
        }
        return (
          <group key={l.id} position={[0, ys[l.id], 0]}>
            <RoomView room={data.room} wallMode={wallMode === "hidden" ? "hidden" : "full"} labels={false} ceiling={ceiling} floorHoles={floorHoles} ceilingHoles={ceilingHoles} slab={i > 0} y={0} />
            <FurnitureStatic items={data.items} wallHeight={data.room.wallHeight} />
          </group>
        );
      })}
    </>
  );
}
