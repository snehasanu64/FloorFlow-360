import type Konva from "konva";
import type { ProjectFile } from "@/types/project";
import { PX_PER_M } from "./measurements";

/** Registries filled by the 2D and 3D viewports so toolbar actions can capture them. */
let stage2D: Konva.Stage | null = null;
let capture3D: (() => string | null) | null = null;

export const register2DStage = (s: Konva.Stage | null) => {
  stage2D = s;
};
export const register3DCapture = (fn: (() => string | null) | null) => {
  capture3D = fn;
};
export const has3DCapture = () => capture3D !== null;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const safeFileName = (name: string) =>
  (name || "roomcraft-project").trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "roomcraft-project";

export function exportProjectJson(project: ProjectFile) {
  downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${safeFileName(project.name)}.json`);
}

/** Renders the whole floor plan (regardless of current zoom/pan) to a data URL. */
function renderPlan(room: { length: number; width: number; wallThickness: number }, pixelRatio: number, mime: string): string | null {
  const stage = stage2D;
  if (!stage) return null;
  const pad = 90;
  const t = room.wallThickness * PX_PER_M;
  const w = room.length * PX_PER_M + 2 * t + pad * 2;
  const h = room.width * PX_PER_M + 2 * t + pad * 2;
  const saved = { x: stage.x(), y: stage.y(), sx: stage.scaleX(), sy: stage.scaleY() };
  const hidden = stage.find(".ui-only");
  try {
    hidden.forEach((n) => n.visible(false));
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: pad + t, y: pad + t });
    return stage.toDataURL({ x: 0, y: 0, width: w, height: h, pixelRatio, mimeType: mime, quality: 0.8 });
  } catch {
    return null;
  } finally {
    hidden.forEach((n) => n.visible(true));
    stage.scale({ x: saved.sx, y: saved.sy });
    stage.position({ x: saved.x, y: saved.y });
    stage.batchDraw();
  }
}

/** Exports the whole floor plan as a PNG download. */
export function export2DPng(name: string, room: { length: number; width: number; wallThickness: number }): boolean {
  const url = renderPlan(room, 2, "image/png");
  if (!url) return false;
  downloadDataUrl(url, `${safeFileName(name)}-floorplan.png`);
  return true;
}

/** Full-resolution plan image (for PDF reports). */
export function capture2DPlan(room: { length: number; width: number; wallThickness: number }): string | null {
  return renderPlan(room, 1.5, "image/png");
}

/** Small JPEG used as a project thumbnail in the library. */
export function capture2DThumb(room: { length: number; width: number; wallThickness: number }): string | null {
  const url = renderPlan(room, 0.28, "image/jpeg");
  return url && url.length < 60_000 ? url : null;
}

/** Current 3D viewport as a PNG data URL (null when the 3D view has not been opened). */
export function capture3DImage(): string | null {
  return capture3D ? capture3D() : null;
}

export function export3DPng(name: string): boolean {
  if (!capture3D) return false;
  const url = capture3D();
  if (!url) return false;
  downloadDataUrl(url, `${safeFileName(name)}-3d.png`);
  return true;
}
