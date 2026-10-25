"use client";

import { memo, useMemo, useState } from "react";
import { Group, Line, Path, Rect, Shape, Text } from "react-konva";
import type Konva from "konva";
import { shade } from "@/lib/color";
import { getRoomPolygon } from "@/lib/geometry";
import { PX_PER_M, formatLen } from "@/lib/measurements";
import { outerCorners, polygonEdges, type Edge } from "@/lib/roomShape";
import { useEditorStore } from "@/store/editor-store";
import type { Opening, RoomConfig, WallMode } from "@/types/room";

const PX = PX_PER_M;
const WALL_COLOR = "#3c4046";

/** Konva pose of an opening: origin on the wall centre line, local +x along the wall, local +y into the room. */
export function openingPose(edge: Edge, offset: number) {
  return {
    x: (edge.a.x + edge.dir.x * offset) * PX,
    y: (edge.a.z + edge.dir.z * offset) * PX,
    rotation: edge.angleDeg,
  };
}

function nearestEdge(edges: Edge[], px: number, pz: number) {
  let best = { edge: edges[0], dist: Infinity, along: 0 };
  for (const e of edges) {
    const along = Math.min(e.length, Math.max(0, (px - e.a.x) * e.dir.x + (pz - e.a.z) * e.dir.z));
    const cx = e.a.x + e.dir.x * along;
    const cz = e.a.z + e.dir.z * along;
    const dist = Math.hypot(px - cx, pz - cz);
    if (dist < best.dist) best = { edge: e, dist, along: (px - e.a.x) * e.dir.x + (pz - e.a.z) * e.dir.z };
  }
  return best;
}

function OpeningShape({ room, o, edges, scale }: { room: RoomConfig; o: Opening; edges: Edge[]; scale: number }) {
  const [hover, setHover] = useState(false);
  const edge = edges[Math.min(o.edge, edges.length - 1)];
  const t = room.wallThickness * PX;
  const w = o.width * PX;
  const pos = openingPose(edge, o.offset);
  const floor = shade(room.floorColor, 0.6);
  const hw = w / 2;

  const onDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    useEditorStore.getState().beginTransient();
  };
  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const p = e.target.getStage()?.getRelativePointerPosition();
    if (!p) return;
    const st = useEditorStore.getState();
    const es = polygonEdges(getRoomPolygon(st.room));
    // snap to whichever wall the pointer is nearest, so openings can move between walls
    const near = nearestEdge(es, p.x / PX, p.y / PX);
    st.updateOpening(o.id, { edge: near.edge.index, offset: near.along }, true);
    const next = useEditorStore.getState().room.openings.find((x) => x.id === o.id);
    if (next) {
      const np = openingPose(es[next.edge], next.offset);
      e.target.position({ x: np.x, y: np.y });
      e.target.rotation(np.rotation);
    }
  };
  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    useEditorStore.getState().endTransient();
  };

  return (
    <Group
      x={pos.x}
      y={pos.y}
      rotation={pos.rotation}
      draggable
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onMouseEnter={(e) => {
        setHover(true);
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "grab";
      }}
      onMouseLeave={(e) => {
        setHover(false);
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "";
      }}
    >
      {/* the wall band lies on the outward (negative y) side of the centre line */}
      <Rect x={-hw} y={-t} width={w} height={t} fill={o.type === "door" ? floor : "#e3eef3"} />
      {o.type === "window" ? (
        <>
          <Line points={[-hw, -t, hw, -t]} stroke="#6b7b86" strokeWidth={1.5} strokeScaleEnabled={false} />
          <Line points={[-hw, 0, hw, 0]} stroke="#6b7b86" strokeWidth={1.5} strokeScaleEnabled={false} />
          <Line points={[-hw, -t / 2, hw, -t / 2]} stroke="#3b82c4" strokeWidth={2} strokeScaleEnabled={false} />
        </>
      ) : (
        <>
          <Line points={[-hw, 0, -hw, w]} stroke="#6b7280" strokeWidth={2} strokeScaleEnabled={false} />
          <Path data={`M ${hw} 0 A ${w} ${w} 0 0 1 ${-hw} ${w}`} stroke="#6b7280" strokeWidth={1} dash={[4, 3]} strokeScaleEnabled={false} />
        </>
      )}
      <Rect
        x={-hw - 8 / scale}
        y={-t - 14 / scale}
        width={w + 16 / scale}
        height={t + 28 / scale}
        fill={hover ? "rgba(47,95,208,0.18)" : "rgba(0,0,0,0.001)"}
        stroke={hover ? "#2f5fd0" : undefined}
        strokeWidth={1}
        strokeScaleEnabled={false}
        cornerRadius={3 / scale}
      />
    </Group>
  );
}

function GridLines({ room, scale, poly }: { room: RoomConfig; scale: number; poly: { x: number; z: number }[] }) {
  let step = room.gridSpacing;
  while (step * PX * scale < 7) step *= 2;
  const draw = (spacing: number, from: number) => (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.save();
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x * PX, p.z * PX) : ctx.moveTo(p.x * PX, p.z * PX)));
    ctx.closePath();
    ctx.clip();
    ctx.beginPath();
    for (let x = from; x < room.length - 1e-6; x += spacing) {
      ctx.moveTo(x * PX, 0);
      ctx.lineTo(x * PX, room.width * PX);
    }
    for (let z = from; z < room.width - 1e-6; z += spacing) {
      ctx.moveTo(0, z * PX);
      ctx.lineTo(room.length * PX, z * PX);
    }
    ctx.fillStrokeShape(shape);
    ctx.restore();
  };
  return (
    <>
      <Shape listening={false} stroke="rgba(0,0,0,0.07)" strokeWidth={1} strokeScaleEnabled={false} sceneFunc={draw(step, step)} />
      <Shape listening={false} stroke="rgba(0,0,0,0.16)" strokeWidth={1} strokeScaleEnabled={false} sceneFunc={draw(1, 1)} />
    </>
  );
}

function DimensionLine({ x1, y1, x2, y2, label, scale, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; scale: number; vertical?: boolean }) {
  const fs = Math.max(9, 12 / scale);
  const tick = 5 / scale;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <Group listening={false}>
      <Line points={[x1, y1, x2, y2]} stroke="#6b7280" strokeWidth={1} strokeScaleEnabled={false} />
      {vertical ? (
        <>
          <Line points={[x1 - tick, y1, x1 + tick, y1]} stroke="#6b7280" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[x2 - tick, y2, x2 + tick, y2]} stroke="#6b7280" strokeWidth={1} strokeScaleEnabled={false} />
          <Text x={mx - 8 / scale} y={my} text={label} fontSize={fs} fill="#374151" fontStyle="600" rotation={-90} width={160 / scale} offsetX={80 / scale} align="center" offsetY={fs + 2 / scale} />
        </>
      ) : (
        <>
          <Line points={[x1, y1 - tick, x1, y1 + tick]} stroke="#6b7280" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[x2, y2 - tick, x2, y2 + tick]} stroke="#6b7280" strokeWidth={1} strokeScaleEnabled={false} />
          <Text x={mx - 80 / scale} y={my - fs - 3 / scale} width={160 / scale} align="center" text={label} fontSize={fs} fill="#374151" fontStyle="600" />
        </>
      )}
    </Group>
  );
}

interface Props {
  room: RoomConfig;
  scale: number;
  showGrid: boolean;
  wallMode: WallMode;
  /** Re-render trigger when the display unit changes. */
  units: string;
}

export const RoomLayer2D = memo(function RoomLayer2D({ room, scale, showGrid, wallMode }: Props) {
  const t = room.wallThickness;
  const poly = getRoomPolygon(room);
  const edges = useMemo(() => polygonEdges(poly), [poly]);
  const corners = useMemo(() => outerCorners(edges, t), [edges, t]);
  const L = room.length * PX;
  const W = room.width * PX;
  const wallOpacity = wallMode === "hidden" ? 0.25 : 1;
  const off = 22 / scale + t * PX;
  const irregular = room.shape !== "rect";
  const fs = Math.max(8, 10 / scale);
  return (
    <Group>
      <Line
        name="bg"
        points={poly.flatMap((p) => [p.x * PX, p.z * PX])}
        closed
        fill={shade(room.floorColor, 0.62)}
        shadowColor="black"
        shadowBlur={14}
        shadowOpacity={0.12}
        shadowOffsetY={3}
      />
      {showGrid && <GridLines room={room} scale={scale} poly={poly} />}
      {edges.map((e, i) => {
        const oa = corners[i];
        const ob = corners[(i + 1) % corners.length];
        return (
          <Line
            key={e.index}
            name="bg"
            closed
            points={[e.a.x * PX, e.a.z * PX, e.b.x * PX, e.b.z * PX, ob.x * PX, ob.z * PX, oa.x * PX, oa.z * PX]}
            fill={WALL_COLOR}
            stroke={WALL_COLOR}
            strokeWidth={0.5}
            strokeScaleEnabled={false}
            opacity={wallOpacity}
          />
        );
      })}
      {room.openings.map((o) => (
        <OpeningShape key={o.id} room={room} o={o} edges={edges} scale={scale} />
      ))}
      {irregular &&
        edges.map((e) => (
          <Text
            key={`len-${e.index}`}
            listening={false}
            text={formatLen(e.length)}
            fontSize={fs}
            fill="#6b7280"
            x={((e.a.x + e.b.x) / 2 - e.normal.x * 0.18) * PX - 40 / scale}
            y={((e.a.z + e.b.z) / 2 - e.normal.z * 0.18) * PX - fs / 2}
            width={80 / scale}
            align="center"
          />
        ))}
      <DimensionLine x1={0} y1={-off} x2={L} y2={-off} label={formatLen(room.length)} scale={scale} />
      <DimensionLine x1={-off} y1={0} x2={-off} y2={W} label={formatLen(room.width)} scale={scale} vertical />
      <Text listening={false} x={0} y={W + t * PX + 8 / scale} text={`Wall height ${formatLen(room.wallHeight)}  ·  grid ${formatLen(room.gridSpacing)}`} fontSize={Math.max(9, 11 / scale)} fill="#6b7280" />
    </Group>
  );
});
