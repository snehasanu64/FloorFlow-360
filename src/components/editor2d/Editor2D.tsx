"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Rect, Stage, Text, Transformer } from "react-konva";
import Konva from "konva";
import { getCatalogItem } from "@/data/furniture-catalog";
import { register2DStage } from "@/lib/export";
import { canvasToRoom, getRoomPolygon, itemBounds, itemRects, rectCorners } from "@/lib/geometry";
import { PX_PER_M, clamp, normalizeDeg, round } from "@/lib/measurements";
import type { P2 } from "@/lib/roomShape";
import { useEditorStore } from "@/store/editor-store";
import { useLayoutIssues } from "@/store/selectors";
import { GhostLayer2D } from "./GhostLayer2D";
import { Item2D, type ItemStatus } from "./Item2D";
import { Overlay2D } from "./Overlay2D";
import { RoomLayer2D } from "./RoomLayer2D";
import { MeasureLayer, SelectionGuides2D } from "./SelectionGuides2D";

// left button drags nodes / pans in select mode; middle & right buttons pan manually (see onStageDown)
Konva.dragButtons = [0];

const PX = PX_PER_M;
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;

interface View {
  x: number;
  y: number;
  scale: number;
}

/** Keeps the zoom/pan when the 2D editor is hidden while viewing 3D. */
let savedView: { view: View; key: string } | null = null;

export default function Editor2D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(() => savedView?.view ?? { x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
    savedView = { view, key: savedView?.key ?? "" };
  }, [view]);

  const room = useEditorStore((s) => s.room);
  const items = useEditorStore((s) => s.items);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const tool = useEditorStore((s) => s.tool);
  const showGrid = useEditorStore((s) => s.showGrid);
  const wallMode = useEditorStore((s) => s.wallMode);
  const units = useEditorStore((s) => s.units);
  const guides = useEditorStore((s) => s.guides);
  const fitNonce = useEditorStore((s) => s.fitNonce);
  const measures = useEditorStore((s) => s.measures);
  const pendingMeasure = useEditorStore((s) => s.pendingMeasure);
  const { map: issues } = useLayoutIssues();
  const selectedItems = useMemo(() => items.filter((i) => selectedIds.includes(i.id)), [items, selectedIds]);
  const single = selectedItems.length === 1 ? selectedItems[0] : null;

  const [shiftHeld, setShiftHeld] = useState(false);
  const [marquee, setMarquee] = useState<{ a: P2; b: P2 } | null>(null);
  const [hoverPt, setHoverPt] = useState<P2 | null>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === "Shift" && setShiftHeld(true);
    const up = (e: KeyboardEvent) => e.key === "Shift" && setShiftHeld(false);
    const blur = () => setShiftHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    register2DStage(stageRef.current);
    return () => register2DStage(null);
  });

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const pad = 80;
    const t = room.wallThickness;
    const rw = (room.length + 2 * t) * PX;
    const rh = (room.width + 2 * t) * PX;
    const scale = clamp(Math.min((size.w - pad * 2) / rw, (size.h - pad * 2) / rh), MIN_SCALE, MAX_SCALE);
    setView({ scale, x: (size.w - room.length * PX * scale) / 2, y: (size.h - room.width * PX * scale) / 2 });
  }, [size.w, size.h, room.length, room.width, room.wallThickness]);

  // Fit on explicit request or room-size change; otherwise restore the previous view.
  const fitKey = `${fitNonce}|${room.length}|${room.width}`;
  useEffect(() => {
    if (!size.w || !size.h) return;
    if (savedView && savedView.key === fitKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fit();
    savedView = { view: viewRef.current, key: fitKey };
  }, [fit, fitKey, size.w, size.h]);

  // Attach the transformer to a single, unlocked selection.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = single && !single.locked && tool === "select" ? stage.findOne(`#item-${single.id}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [single, single?.width, single?.depth, single?.rotation, single?.locked, tool, items.length]);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    const v = viewRef.current;
    const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    const wx = (px - v.x) / v.scale;
    const wy = (py - v.y) / v.scale;
    setView({ scale: ns, x: px - wx * ns, y: py - wy * ns });
  }, []);

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    zoomAt(p.x, p.y, Math.pow(1.0015, -e.evt.deltaY));
  };

  // Two-finger pinch zoom + pan for tablets.
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    if (stage.isDragging()) stage.stopDrag();
    const rect = stage.container().getBoundingClientRect();
    const cx = (t[0].clientX + t[1].clientX) / 2 - rect.left;
    const cy = (t[0].clientY + t[1].clientY) / 2 - rect.top;
    const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const prev = pinch.current;
    if (prev) {
      const v = viewRef.current;
      const ns = clamp(v.scale * (dist / prev.dist), MIN_SCALE, MAX_SCALE);
      const wx = (prev.cx - v.x) / v.scale;
      const wy = (prev.cy - v.y) / v.scale;
      setView({ scale: ns, x: cx - wx * ns, y: cy - wy * ns });
    }
    pinch.current = { dist, cx, cy };
  };

  const onStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
  };

  const pointerRoom = (): P2 | null => {
    const p = stageRef.current?.getRelativePointerPosition();
    return p ? { x: p.x / PX, z: p.y / PX } : null;
  };

  /** Snap a measure point to room corners / item corners (within ~12 px), then to the grid. */
  const snapMeasure = (p: P2): P2 => {
    const st = useEditorStore.getState();
    const tol = 12 / (PX * viewRef.current.scale);
    let best: P2 | null = null;
    let bestD = tol;
    const consider = (q: P2) => {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    };
    getRoomPolygon(st.room).forEach(consider);
    for (const it of st.items) for (const r of itemRects(it)) rectCorners(r).forEach((c) => consider({ x: c.x, z: c.z }));
    if (best) return best;
    if (st.snapGrid && st.room.gridSpacing > 0) {
      const g = st.room.gridSpacing;
      return { x: Math.round(p.x / g) * g, z: Math.round(p.z / g) * g };
    }
    return p;
  };

  const onStageDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const st = useEditorStore.getState();
    const onBg = e.target === e.target.getStage() || e.target.name() === "bg";
    const ev = e.evt as MouseEvent;
    if (ev.button === 1 || ev.button === 2) {
      ev.preventDefault();
      const sp = stageRef.current?.getPointerPosition();
      if (sp) panRef.current = { x: sp.x, y: sp.y, vx: viewRef.current.x, vy: viewRef.current.y };
      return;
    }
    if (st.tool === "measure") {
      if (ev.button !== undefined && ev.button !== 0) return;
      const p = pointerRoom();
      if (p) st.addMeasurePoint(snapMeasure(p));
      return;
    }
    if (!onBg) return;
    const additive = !!ev.shiftKey;
    if (st.tool === "marquee" || additive) {
      const p = pointerRoom();
      if (p) setMarquee({ a: p, b: p });
      if (!additive) st.select(null);
      return;
    }
    st.select(null);
  };

  const onStageMove = () => {
    if (panRef.current) {
      const sp = stageRef.current?.getPointerPosition();
      if (sp) setView((v) => ({ ...v, x: panRef.current!.vx + sp.x - panRef.current!.x, y: panRef.current!.vy + sp.y - panRef.current!.y }));
      return;
    }
    if (marquee) {
      const p = pointerRoom();
      if (p) setMarquee({ a: marquee.a, b: p });
    } else if (tool === "measure" && pendingMeasure) {
      const p = pointerRoom();
      if (p) setHoverPt(snapMeasure(p));
    }
  };

  const onStageUp = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    panRef.current = null;
    if (!marquee) return;
    const st = useEditorStore.getState();
    const x0 = Math.min(marquee.a.x, marquee.b.x);
    const x1 = Math.max(marquee.a.x, marquee.b.x);
    const z0 = Math.min(marquee.a.z, marquee.b.z);
    const z1 = Math.max(marquee.a.z, marquee.b.z);
    setMarquee(null);
    if (x1 - x0 < 0.05 && z1 - z0 < 0.05) return;
    const hit = st.items
      .filter((it) => {
        const b = itemBounds(it);
        return b.maxX >= x0 && b.minX <= x1 && b.maxZ >= z0 && b.minZ <= z1;
      })
      .map((it) => it.id);
    const additive = !!(e.evt as MouseEvent).shiftKey;
    st.selectMany(additive ? [...new Set([...st.selectedIds, ...hit])] : hit);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("application/x-roomcraft");
    if (!id || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const p = canvasToRoom(e.clientX - rect.left, e.clientY - rect.top, viewRef.current, PX);
    useEditorStore.getState().addItem(id, p);
  };

  const onTransformStart = () => useEditorStore.getState().beginTransient();
  const onTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const st = useEditorStore.getState();
    const id = node.id().replace("item-", "");
    const it = st.items.find((i) => i.id === id);
    if (!it) {
      st.endTransient();
      return;
    }
    const min = getCatalogItem(it.catalogId)?.minSize ?? 0.1;
    const width = Math.max(min, round(it.width * Math.abs(node.scaleX()), 3));
    const depth = Math.max(min, round(it.depth * Math.abs(node.scaleY()), 3));
    node.scale({ x: 1, y: 1 });
    st.setItemTransient(id, {
      width,
      depth,
      rotation: normalizeDeg(round(node.rotation(), 2)),
      x: round(node.x() / PX, 4),
      z: round(node.y() / PX, 4),
    });
    st.endTransient();
  };

  const sorted = useMemo(
    () => [...items].sort((a, b) => (getCatalogItem(a.catalogId)?.ignoreCollision ? 0 : 1) - (getCatalogItem(b.catalogId)?.ignoreCollision ? 0 : 1)),
    [items],
  );
  const fs = clamp(12 / view.scale, 7, 22);
  const panWithLeft = tool === "select" && !shiftHeld;
  const multi = selectedItems.length > 1;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ background: "var(--canvas-bg)", touchAction: "none", cursor: tool === "measure" ? "crosshair" : undefined }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={Math.max(size.w, 1)}
        height={Math.max(size.h, 1)}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        draggable={panWithLeft}
        onDragEnd={onStageDragEnd}
        onWheel={onWheel}
        onMouseDown={onStageDown}
        onTouchStart={onStageDown}
        onMouseMove={onStageMove}
        onTouchMove={(e) => {
          onTouchMove(e);
          onStageMove();
        }}
        onMouseUp={onStageUp}
        onTouchEnd={(e) => {
          pinch.current = null;
          onStageUp(e);
        }}
      >
        <Layer>
          <RoomLayer2D room={room} scale={view.scale} showGrid={showGrid} wallMode={wallMode} units={units} />
          <GhostLayer2D scale={view.scale} />
          {sorted.map((it) => {
            const iss = issues.get(it.id);
            const status: ItemStatus = iss?.overlaps.length ? "overlap" : iss?.outside ? "outside" : "ok";
            return <Item2D key={it.id} item={it} status={status} selected={multi && selectedIds.includes(it.id)} interactive={tool === "select"} />;
          })}
          {sorted.map((it) => {
            const cat = getCatalogItem(it.catalogId);
            // ceiling lights and wall-hung pieces sit above other furniture: no label, to avoid clutter
            if (cat?.mount === "ceiling" || (cat?.elevation ?? 0) > 0) return null;
            const b = itemBounds(it);
            const w = (b.maxX - b.minX) * PX;
            if (w < fs * 3.5) return null;
            const isRug = cat?.model === "rug";
            return (
              <Text
                key={`l-${it.id}`}
                listening={false}
                x={b.minX * PX}
                y={isRug ? b.minZ * PX + fs * 0.4 : ((b.minZ + b.maxZ) / 2) * PX - fs / 2}
                width={w}
                align="center"
                text={`${it.name}${it.locked ? " 🔒" : ""}${it.groupId ? " ⛓" : ""}`}
                fontSize={fs}
                fill="rgba(17,24,39,0.82)"
                fontStyle="600"
                ellipsis
                wrap="none"
              />
            );
          })}
          <SelectionGuides2D items={selectedItems} room={room} scale={view.scale} guides={guides} showDims={tool === "select"} units={units} />
          <MeasureLayer measures={measures} pending={pendingMeasure} hover={hoverPt} scale={view.scale} units={units} />
          {marquee && (
            <Rect
              name="ui-only"
              listening={false}
              x={Math.min(marquee.a.x, marquee.b.x) * PX}
              y={Math.min(marquee.a.z, marquee.b.z) * PX}
              width={Math.abs(marquee.a.x - marquee.b.x) * PX}
              height={Math.abs(marquee.a.z - marquee.b.z) * PX}
              fill="rgba(47,95,208,0.12)"
              stroke="#2f5fd0"
              strokeWidth={1}
              dash={[4, 3]}
              strokeScaleEnabled={false}
            />
          )}
          <Transformer
            ref={trRef}
            name="ui-only"
            rotateEnabled
            rotationSnaps={[0, 90, 180, 270]}
            rotationSnapTolerance={6}
            keepRatio={false}
            flipEnabled={false}
            anchorSize={10}
            anchorCornerRadius={5}
            anchorStroke="#2563eb"
            anchorFill="#ffffff"
            borderStroke="#2563eb"
            borderDash={[5, 3]}
            rotateAnchorOffset={26}
            onTransformStart={onTransformStart}
            onTransformEnd={onTransformEnd}
          />
        </Layer>
      </Stage>
      <Overlay2D zoom={view.scale} onZoom={(f) => zoomAt(size.w / 2, size.h / 2, f)} />
    </div>
  );
}

