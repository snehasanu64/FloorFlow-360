"use client";

import { memo, useMemo } from "react";
import { Ellipse, Group, Line } from "react-konva";
import type Konva from "konva";
import { getCatalogItem } from "@/data/furniture-catalog";
import { toneColor } from "@/lib/color";
import { footprintShapes, type FootShape } from "@/lib/footprint";
import { PX_PER_M } from "@/lib/measurements";
import { resolvePlacement } from "@/lib/placement";
import { useEditorStore } from "@/store/editor-store";
import type { PlacedItem } from "@/types/furniture";

const PX = PX_PER_M;

function Shape2D({ s, base, overlay }: { s: FootShape; base: string; overlay?: string }) {
  const stroke = overlay ? overlay : "rgba(0,0,0,0.42)";
  const fill = overlay ? `${overlay}33` : toneColor(base, s.tone);
  const sw = overlay ? 2 : 1;
  const dash = s.dashed ? [5, 4] : undefined;
  if (s.t === "poly") {
    return <Line points={s.pts.map((v) => v * PX)} closed fill={fill} stroke={stroke} strokeWidth={sw} strokeScaleEnabled={false} lineJoin="round" dash={dash} listening={!overlay} />;
  }
  return <Ellipse x={s.cx * PX} y={s.cz * PX} radiusX={s.rx * PX} radiusY={s.rz * PX} fill={fill} stroke={stroke} strokeWidth={sw} strokeScaleEnabled={false} dash={dash} listening={!overlay} />;
}

export type ItemStatus = "ok" | "overlap" | "outside";

interface Props {
  item: PlacedItem;
  status: ItemStatus;
  selected: boolean;
  /** Pointer tool: items only move with the select tool. */
  interactive: boolean;
}

/** Drag-start positions of every item that moves with the dragged one. */
let dragOrigins: Record<string, { x: number; z: number }> = {};

export const Item2D = memo(function Item2D({ item, status, selected, interactive }: Props) {
  const cat = getCatalogItem(item.catalogId);
  const model = cat?.model ?? "rug";
  const seats = cat?.seats;
  const shapes = useMemo(
    () => footprintShapes({ model, width: item.width, depth: item.depth, seats, orientation: item.orientation }),
    [model, item.width, item.depth, seats, item.orientation],
  );
  const id = item.id;

  const onDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const st = useEditorStore.getState();
    if (st.tool !== "select") return;
    const ev = e.evt as MouseEvent;
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) st.toggleSelect(id);
    else if (!st.selectedIds.includes(id)) st.select(id);
  };

  const onDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const st = useEditorStore.getState();
    if (!st.selectedIds.includes(id)) st.select(id);
    const ids = useEditorStore.getState().selectedIds;
    dragOrigins = {};
    for (const it of st.items) if (ids.includes(it.id) && !it.locked) dragOrigins[it.id] = { x: it.x, z: it.z };
    st.beginTransient();
  };
  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const st = useEditorStore.getState();
    const it = st.items.find((i) => i.id === id);
    const origin = dragOrigins[id];
    if (!it || !origin) return;
    const pos = e.target.position();
    const moving = Object.keys(dragOrigins);
    const res = resolvePlacement(
      { ...it, x: origin.x, z: origin.z },
      pos.x / PX,
      pos.y / PX,
      st.items.filter((o) => !moving.includes(o.id)),
      st.room,
      { snapGrid: st.snapGrid, snapWalls: st.snapWalls, align: st.alignGuides },
    );
    st.moveGroupTransient(dragOrigins, res.x - origin.x, res.z - origin.z);
    st.setGuides(res.guides);
    const now = useEditorStore.getState().items.find((i) => i.id === id);
    if (now) e.target.position({ x: now.x * PX, y: now.z * PX });
  };
  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    dragOrigins = {};
    useEditorStore.getState().endTransient();
  };

  const overlayColor = status === "overlap" ? "#dc2626" : status === "outside" ? "#f59e0b" : undefined;
  const canDrag = interactive && !item.locked;

  return (
    <Group
      id={`item-${id}`}
      x={item.x * PX}
      y={item.z * PX}
      rotation={item.rotation}
      draggable={canDrag}
      onMouseDown={onDown}
      onTouchStart={onDown}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = !interactive ? "crosshair" : item.locked ? "not-allowed" : "move";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "";
      }}
    >
      {shapes.map((s, i) => (
        <Shape2D key={i} s={s} base={item.color} />
      ))}
      {overlayColor && <Shape2D s={shapes[0]} base={item.color} overlay={overlayColor} />}
      {selected && !overlayColor && <Shape2D s={shapes[0]} base={item.color} overlay="#2563eb" />}
    </Group>
  );
});
