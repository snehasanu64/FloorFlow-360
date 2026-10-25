"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Box,
  BoxSelect,
  Copy,
  Group,
  Grid3x3,
  Lock,
  LockOpen,
  Magnet,
  MousePointer2,
  Maximize,
  RotateCcw,
  RotateCw,
  Ruler,
  Trash2,
  Ungroup,
  ZoomIn,
  ZoomOut,
  Compass,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { IconButton, ToggleButton } from "../layout/ui";

export function Overlay2D({ zoom, onZoom }: { zoom: number; onZoom: (factor: number) => void }) {
  const s = useEditorStore();
  const hasItems = s.items.length > 0;
  const n = s.selectedIds.length;
  const sel = s.items.filter((i) => s.selectedIds.includes(i.id));
  const allLocked = sel.length > 0 && sel.every((i) => i.locked);
  const anyGrouped = sel.some((i) => i.groupId);
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-panel/95 p-1 shadow-sm backdrop-blur">
          <ToggleButton active={s.tool === "select"} onClick={() => s.setTool("select")} label="Select / move (V)" icon={<MousePointer2 size={15} />} />
          <ToggleButton active={s.tool === "marquee"} onClick={() => s.setTool(s.tool === "marquee" ? "select" : "marquee")} label="Box select — drag a rectangle (or hold Shift)" icon={<BoxSelect size={15} />} />
          <ToggleButton active={s.tool === "measure"} onClick={() => s.setTool(s.tool === "measure" ? "select" : "measure")} label="Measure tool — click two points (M)" icon={<Ruler size={15} />} />
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-panel/95 p-1 shadow-sm backdrop-blur">
          <ToggleButton active={s.snapGrid} onClick={() => s.toggle("snapGrid")} label="Snap to grid" icon={<Magnet size={15} />} />
          <ToggleButton active={s.showGrid} onClick={() => s.toggle("showGrid")} label="Show grid" icon={<Grid3x3 size={15} />} />
          <ToggleButton active={s.snapWalls} onClick={() => s.toggle("snapWalls")} label="Snap to walls" icon={<Ruler size={15} className="rotate-90" />} />
          <ToggleButton active={s.alignGuides} onClick={() => s.toggle("alignGuides")} label="Alignment helper" icon={<AlignHorizontalDistributeCenter size={15} />} />
        </div>
        {s.tool === "measure" && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-panel/95 px-2 py-1 text-xs shadow-sm backdrop-blur">
            <span className="text-muted">{s.pendingMeasure ? "Click the second point" : "Click the first point"}</span>
            <button className="font-medium text-accent hover:underline disabled:opacity-40" disabled={!s.measures.length && !s.pendingMeasure} onClick={s.clearMeasures}>
              Clear ({s.measures.length})
            </button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 flex items-start gap-2">
        <div
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel/95 shadow-sm"
          title={`North is ${Math.round(s.room.northAngle)}° from the top of the plan (set in the Vastu panel)`}
        >
          <Compass size={20} className="text-accent" style={{ transform: `rotate(${s.room.northAngle}deg)` }} />
        </div>
        <button
          onClick={() => s.setMode("3d")}
          className="pointer-events-auto flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-md transition hover:bg-accent-strong"
        >
          <Box size={16} /> View in 3D
        </button>
      </div>

      {n > 0 && s.tool === "select" && (
        <div className="pointer-events-none absolute left-1/2 top-16 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-0.5 rounded-lg border border-line bg-panel/95 p-1 shadow-md backdrop-blur">
            {n > 1 && <span className="px-2 text-xs font-semibold text-accent">{n} selected</span>}
            <IconButton label="Rotate 90° counter-clockwise" onClick={() => s.rotateSelected(-90)}>
              <RotateCcw size={15} />
            </IconButton>
            <IconButton label="Rotate 90° clockwise (R)" onClick={() => s.rotateSelected(90)}>
              <RotateCw size={15} />
            </IconButton>
            <IconButton label="Duplicate (Ctrl+D)" onClick={s.duplicateSelected}>
              <Copy size={15} />
            </IconButton>
            <IconButton label={allLocked ? "Unlock (L)" : "Lock in place (L)"} active={allLocked} onClick={() => s.lockSelected(!allLocked)}>
              {allLocked ? <LockOpen size={15} /> : <Lock size={15} />}
            </IconButton>
            {n > 1 && (
              <IconButton label={anyGrouped ? "Ungroup (Ctrl+Shift+G)" : "Group (Ctrl+G)"} onClick={anyGrouped ? s.ungroupSelected : s.groupSelected}>
                {anyGrouped ? <Ungroup size={15} /> : <Group size={15} />}
              </IconButton>
            )}
            {n > 1 && (
              <>
                <span className="mx-1 h-5 w-px bg-line" />
                <IconButton label="Align left" onClick={() => s.alignSelected("left")}>
                  <AlignStartVertical size={15} />
                </IconButton>
                <IconButton label="Align horizontal centres" onClick={() => s.alignSelected("centerH")}>
                  <AlignCenterVertical size={15} />
                </IconButton>
                <IconButton label="Align right" onClick={() => s.alignSelected("right")}>
                  <AlignEndVertical size={15} />
                </IconButton>
                <IconButton label="Align top" onClick={() => s.alignSelected("top")}>
                  <AlignStartHorizontal size={15} />
                </IconButton>
                <IconButton label="Align vertical centres" onClick={() => s.alignSelected("centerV")}>
                  <AlignCenterHorizontal size={15} />
                </IconButton>
                <IconButton label="Align bottom" onClick={() => s.alignSelected("bottom")}>
                  <AlignEndHorizontal size={15} />
                </IconButton>
                <IconButton label="Distribute horizontally (3+ items)" disabled={n < 3} onClick={() => s.alignSelected("distributeH")}>
                  <AlignHorizontalDistributeCenter size={15} />
                </IconButton>
                <IconButton label="Distribute vertically (3+ items)" disabled={n < 3} onClick={() => s.alignSelected("distributeV")}>
                  <AlignVerticalDistributeCenter size={15} />
                </IconButton>
              </>
            )}
            <span className="mx-1 h-5 w-px bg-line" />
            <IconButton label="Delete (Del)" danger onClick={s.removeSelected}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      )}

      {!hasItems && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-xs rounded-xl border border-dashed border-line-strong bg-panel/80 p-5 text-center text-sm text-muted backdrop-blur">
            <p className="mb-1 font-medium text-ink">Your room is empty</p>
            Pick furniture in the <b>Furniture</b> tab — click a card, or drag it onto the plan.
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-line bg-panel/95 p-1 shadow-sm backdrop-blur">
        <IconButton label="Zoom out" onClick={() => onZoom(1 / 1.25)}>
          <ZoomOut size={15} />
        </IconButton>
        <span className="w-12 text-center text-xs tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => onZoom(1.25)}>
          <ZoomIn size={15} />
        </IconButton>
        <IconButton label="Fit room to screen" onClick={() => s.fitView()}>
          <Maximize size={15} />
        </IconButton>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-panel/80 px-2 py-1 text-[11px] text-muted backdrop-blur">
        {s.tool === "measure"
          ? "Measure: click two points · snaps to corners and grid · Esc to stop"
          : s.tool === "marquee"
            ? "Drag a rectangle to select several items"
            : "Scroll to zoom · drag empty space to pan · Shift+drag to box-select · Shift+click to add"}
      </div>
    </>
  );
}
