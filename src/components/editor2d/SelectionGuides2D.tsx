"use client";

import { Circle, Group, Label, Line, Rect, Tag, Text } from "react-konva";
import { getRoomPolygon, itemBounds } from "@/lib/geometry";
import { PX_PER_M, formatCmShort, formatLen } from "@/lib/measurements";
import type { AlignGuide } from "@/lib/placement";
import { rayToPolygon, type P2 } from "@/lib/roomShape";
import { selectionBounds } from "@/lib/selection-ops";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";

const PX = PX_PER_M;

function Pill({ x, y, text, scale, color = "#1d4ed8" }: { x: number; y: number; text: string; scale: number; color?: string }) {
  const fs = Math.max(8, 11 / scale);
  return (
    <Label x={x} y={y} listening={false}>
      <Tag fill="white" stroke={color} strokeWidth={1} strokeScaleEnabled={false} cornerRadius={4 / scale} shadowColor="black" shadowBlur={4} shadowOpacity={0.12} />
      <Text text={text} fontSize={fs} fill={color} padding={3 / scale} fontStyle="600" />
    </Label>
  );
}

/** Measurement guides for the selection: size pill plus distances to each wall. Hidden from PNG export. */
export function SelectionGuides2D({
  items,
  room,
  scale,
  guides,
  showDims,
}: {
  units?: string;
  items: PlacedItem[];
  room: RoomConfig;
  scale: number;
  guides: AlignGuide[];
  showDims: boolean;
}) {
  const item = items.length === 1 ? items[0] : null;
  const multi = items.length > 1 ? selectionBounds(items) : null;
  return (
    <Group name="ui-only" listening={false}>
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <Line key={i} points={[g.pos * PX, 0, g.pos * PX, room.width * PX]} stroke="#d946ef" strokeWidth={1} dash={[4, 4]} strokeScaleEnabled={false} />
        ) : (
          <Line key={i} points={[0, g.pos * PX, room.length * PX, g.pos * PX]} stroke="#d946ef" strokeWidth={1} dash={[4, 4]} strokeScaleEnabled={false} />
        ),
      )}
      {item && showDims && <SelectionDims item={item} room={room} scale={scale} />}
      {multi && (
        <>
          <Rect
            x={multi.minX * PX - 4 / scale}
            y={multi.minZ * PX - 4 / scale}
            width={(multi.maxX - multi.minX) * PX + 8 / scale}
            height={(multi.maxZ - multi.minZ) * PX + 8 / scale}
            stroke="#2563eb"
            strokeWidth={1.5}
            dash={[6, 4]}
            strokeScaleEnabled={false}
            cornerRadius={4 / scale}
          />
          <Pill
            x={((multi.minX + multi.maxX) / 2) * PX}
            y={multi.maxZ * PX + 10 / scale}
            text={`${items.length} items · ${formatLen(multi.maxX - multi.minX)} × ${formatLen(multi.maxZ - multi.minZ)}`}
            scale={scale}
          />
        </>
      )}
    </Group>
  );
}

function SelectionDims({ item, room, scale }: { item: PlacedItem; room: RoomConfig; scale: number }) {
  const b = itemBounds(item);
  const poly = getRoomPolygon(room);
  const dirs = [
    { o: { x: b.minX, z: item.z }, d: { x: -1, z: 0 } },
    { o: { x: b.maxX, z: item.z }, d: { x: 1, z: 0 } },
    { o: { x: item.x, z: b.minZ }, d: { x: 0, z: -1 } },
    { o: { x: item.x, z: b.maxZ }, d: { x: 0, z: 1 } },
  ];
  const lines = dirs.flatMap(({ o, d }) => {
    const t = rayToPolygon(o, d, poly);
    if (t === null) return [];
    return [{ x1: o.x * PX, y1: o.z * PX, x2: (o.x + d.x * t) * PX, y2: (o.z + d.z * t) * PX, d: t }];
  });
  return (
    <>
      {lines
        .filter((l) => l.d > 0.03)
        .map((l, i) => (
          <Group key={i}>
            <Line points={[l.x1, l.y1, l.x2, l.y2]} stroke="#1d4ed8" strokeWidth={1} dash={[3, 3]} strokeScaleEnabled={false} opacity={0.6} />
            <Pill x={(l.x1 + l.x2) / 2} y={(l.y1 + l.y2) / 2} text={formatCmShort(l.d)} scale={scale} />
          </Group>
        ))}
      <Pill x={item.x * PX} y={b.maxZ * PX + 8 / scale} text={`W ${formatLen(item.width)} × D ${formatLen(item.depth)}`} scale={scale} />
    </>
  );
}

/** Persistent tape-measure lines drawn with the measure tool. */
export function MeasureLayer({
  measures,
  pending,
  hover,
  scale,
}: {
  measures: { a: P2; b: P2 }[];
  pending: P2 | null;
  hover: P2 | null;
  scale: number;
  units?: string;
}) {
  const line = (a: P2, b: P2, key: string, live = false) => {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    return (
      <Group key={key}>
        <Line points={[a.x * PX, a.z * PX, b.x * PX, b.z * PX]} stroke="#e11d48" strokeWidth={2} dash={live ? [6, 4] : undefined} strokeScaleEnabled={false} />
        <Circle x={a.x * PX} y={a.z * PX} radius={4 / scale} fill="#e11d48" />
        <Circle x={b.x * PX} y={b.z * PX} radius={4 / scale} fill="#e11d48" />
        <Pill
          x={((a.x + b.x) / 2) * PX}
          y={((a.z + b.z) / 2) * PX - 22 / scale}
          text={`${formatLen(d)}   (Δx ${formatLen(Math.abs(b.x - a.x))}, Δz ${formatLen(Math.abs(b.z - a.z))})`}
          scale={scale}
          color="#e11d48"
        />
      </Group>
    );
  };
  return (
    <Group name="ui-only" listening={false}>
      {measures.map((m, i) => line(m.a, m.b, `m${i}`))}
      {pending && hover && line(pending, hover, "live", true)}
      {pending && !hover && <Circle x={pending.x * PX} y={pending.z * PX} radius={4 / scale} fill="#e11d48" />}
    </Group>
  );
}
