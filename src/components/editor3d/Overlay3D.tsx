"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Expand, Footprints, Info, LayoutGrid, Minus, Plus, RotateCw, X } from "lucide-react";
import { VIEW_PRESETS } from "@/lib/camera";
import { toggleFullscreen } from "@/lib/fullscreen";
import { useEditorStore } from "@/store/editor-store";
import { IconButton, Segmented, ToggleButton } from "../layout/ui";
import { CAM_EVENT, type CamEventDetail } from "./CameraRig";
import { WALK_EVENT, type WalkKey } from "./WalkControls";

const send = (d: CamEventDetail) => window.dispatchEvent(new CustomEvent(CAM_EVENT, { detail: d }));

const walkKey = (key: WalkKey, down: boolean) => window.dispatchEvent(new CustomEvent(WALK_EVENT, { detail: { key, down } }));

function PadButton({ k, children, label }: { k: WalkKey; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        walkKey(k, true);
      }}
      onPointerUp={() => walkKey(k, false)}
      onPointerCancel={() => walkKey(k, false)}
      onLostPointerCapture={() => walkKey(k, false)}
      className="flex h-11 w-11 touch-none select-none items-center justify-center rounded-lg border border-line bg-panel/95 shadow active:bg-accent-soft"
    >
      {children}
    </button>
  );
}

export function Overlay3D() {
  const s = useEditorStore();
  const selected = s.items.find((i) => i.id === s.selectedId);
  if (s.walk) {
    return (
      <>
        <div className="pointer-events-none absolute left-3 top-3 max-w-sm rounded-lg bg-panel/90 px-3 py-2 text-xs shadow backdrop-blur">
          <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-ink">
            <Footprints size={14} className="text-accent" /> Walking through the room
          </div>
          <span className="text-muted">W A S D or arrow keys to move (hold Shift to run) · drag to look around · Esc to exit</span>
        </div>
        <div className="pointer-events-none absolute right-3 top-3">
          <button
            onClick={() => {
              s.setWalk(false);
              s.requestCamera("default");
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium shadow-md hover:bg-hover"
          >
            <X size={15} /> Exit walkthrough
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 grid grid-cols-3 gap-1.5">
          <span />
          <span className="pointer-events-auto">
            <PadButton k="f" label="Walk forward">
              <ChevronUp size={20} />
            </PadButton>
          </span>
          <span />
          <span className="pointer-events-auto">
            <PadButton k="l" label="Step left">
              <ChevronLeft size={20} />
            </PadButton>
          </span>
          <span className="pointer-events-auto">
            <PadButton k="b" label="Walk backward">
              <ChevronDown size={20} />
            </PadButton>
          </span>
          <span className="pointer-events-auto">
            <PadButton k="r" label="Step right">
              <ChevronRight size={20} />
            </PadButton>
          </span>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-panel/95 p-1 shadow-sm backdrop-blur">
          <Segmented
            value={s.cameraType}
            onChange={s.setCameraType}
            options={[
              { value: "perspective", label: "Perspective" },
              { value: "orthographic", label: "Top ortho", title: "Orthographic top-down camera" },
            ]}
          />
          <Segmented
            value={s.wallMode}
            onChange={s.setWallMode}
            options={[
              { value: "auto", label: "Auto walls", title: "Hide walls between the camera and the room" },
              { value: "full", label: "Walls" },
              { value: "low", label: "Low" },
              { value: "hidden", label: "Hidden", title: "Hide walls to inspect from above" },
            ]}
          />
        </div>
      </div>

      {s.levels.length > 1 && (
        <div className="pointer-events-none absolute left-3 top-16">
          <div className="pointer-events-auto rounded-lg border border-line bg-panel/95 p-1 shadow-sm backdrop-blur">
            <Segmented
              value={s.floorView}
              onChange={s.setFloorView}
              options={[
                { value: "active", label: "This floor", title: "Show only the floor being edited" },
                { value: "below", label: "+ below", title: "Show this floor and the ones below it" },
                { value: "all", label: "All floors" },
              ]}
            />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 flex gap-2">
        <button
          onClick={() => s.setWalk(true)}
          title="Walk through the room at eye height"
          className="pointer-events-auto flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent shadow-md transition hover:bg-accent-strong"
        >
          <Footprints size={16} /> Walk inside
        </button>
        <button
          onClick={() => s.setMode("2d")}
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-ink shadow-md transition hover:bg-hover"
        >
          <LayoutGrid size={16} /> Back to 2D plan
        </button>
      </div>

      {s.items.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <div className="rounded-lg bg-panel/90 px-3 py-2 text-xs text-muted shadow backdrop-blur">The room is empty — add furniture in the 2D plan.</div>
        </div>
      )}

      {s.view360 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <div className="pointer-events-auto w-full max-w-2xl rounded-xl border border-line bg-panel/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <RotateCw size={14} className="text-accent" /> 360° interactive view
                </div>
                <p className="flex items-center gap-1 text-[11px] text-muted">
                  <Info size={11} /> Live 3D scene — drag to orbit, scroll to zoom. Not a pre-recorded photo.
                </p>
              </div>
              <IconButton label="Close 360° panel" onClick={() => s.toggle360(false)}>
                <X size={15} />
              </IconButton>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-center gap-1">
                <IconButton label="Rotate left 45°" onClick={() => send({ type: "orbit", deg: -45 })}>
                  <ChevronLeft size={16} />
                </IconButton>
                <ToggleButton active={s.autoRotate} onClick={() => s.setAutoRotate(!s.autoRotate)} label="Auto-rotate" icon={<RotateCw size={15} />} />
                <IconButton label="Rotate right 45°" onClick={() => send({ type: "orbit", deg: 45 })}>
                  <ChevronRight size={16} />
                </IconButton>
              </div>
              <div className="flex items-center gap-1">
                <IconButton label="Zoom out" onClick={() => send({ type: "zoom", factor: 1.2 })}>
                  <Minus size={15} />
                </IconButton>
                <IconButton label="Zoom in" onClick={() => send({ type: "zoom", factor: 1 / 1.2 })}>
                  <Plus size={15} />
                </IconButton>
              </div>
              <Segmented
                value={s.inspect}
                onChange={(v) => {
                  if (v === "furniture" && !selected) {
                    s.notify("info", "Click a piece of furniture first, then inspect it.");
                    return;
                  }
                  s.setInspect(v);
                }}
                options={[
                  { value: "room", label: "Orbit room" },
                  { value: "furniture", label: "Inspect selected", title: "Orbit around the selected furniture" },
                ]}
              />
              <IconButton label="Fullscreen" onClick={toggleFullscreen}>
                <Expand size={15} />
              </IconButton>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {VIEW_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    s.setInspect("room");
                    s.requestCamera(p.value);
                  }}
                  className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-hover"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => {
                  s.setInspect("room");
                  s.requestCamera("default");
                }}
                className="ml-auto rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition hover:opacity-80"
              >
                Reset camera
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-panel/80 px-2 py-1 text-[11px] text-muted backdrop-blur">
          Drag to orbit · scroll to zoom · right-drag to pan · drag the selected item to move it
        </div>
      )}
    </>
  );
}
