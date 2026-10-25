import * as THREE from "three";
import type { MaterialKind } from "@/types/furniture";

/**
 * Procedural surface detail for furniture: wood grain, fabric weave, leather grain and brushed metal.
 * These are generated on a canvas (no image files), cached per kind and shared by every item, so they
 * cost almost nothing. They are *approximations* — for real product textures, upload an image per item.
 */
export type DetailKind = "woodgrain" | "weave" | "leather" | "brushed";

export const detailForMaterial = (m: MaterialKind): DetailKind | null =>
  m === "wood" ? "woodgrain" : m === "fabric" ? "weave" : m === "leather" ? "leather" : m === "metal" ? "brushed" : null;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Pair {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}
const cache = new Map<DetailKind, Pair>();

function paint(kind: DetailKind): { color: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const S = 256;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    return c;
  };
  const color = mk();
  const bump = mk();
  const g = color.getContext("2d")!;
  const b = bump.getContext("2d")!;
  const rand = rng(kind.length * 977);
  // colour map is a light grey so the item colour dominates; bump map is mid grey with relief
  g.fillStyle = "#f0f0f0";
  g.fillRect(0, 0, S, S);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, S, S);
  if (kind === "woodgrain") {
    for (let i = 0; i < 90; i++) {
      const y = rand() * S;
      const amp = 2 + rand() * 6;
      const a = 0.04 + rand() * 0.1;
      g.strokeStyle = `rgba(70,40,15,${a})`;
      g.lineWidth = 0.6 + rand() * 2.2;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(S * 0.3, y + (rand() - 0.5) * amp * 2, S * 0.7, y + (rand() - 0.5) * amp * 2, S, y + (rand() - 0.5) * amp);
      g.stroke();
      b.strokeStyle = `rgba(0,0,0,${a * 1.5})`;
      b.lineWidth = g.lineWidth * 0.6;
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(S, y + (rand() - 0.5) * 3);
      b.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const x = rand() * S;
      const y = rand() * S;
      for (let r = 14; r > 2; r -= 3) {
        g.strokeStyle = "rgba(60,30,10,0.09)";
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(x, y, r * 1.8, r, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else if (kind === "weave") {
    const t = 4;
    for (let y = 0; y < S; y += t) {
      for (let x = 0; x < S; x += t) {
        const over = ((x / t) + (y / t)) % 2 === 0;
        g.fillStyle = over ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.35)";
        g.fillRect(x, y, t, t);
        b.fillStyle = over ? "#6c6c6c" : "#a0a0a0";
        b.fillRect(x, y, t - 1, t - 1);
      }
    }
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(0,0,0,${rand() * 0.05})`;
      g.fillRect(rand() * S, rand() * S, 1, 1);
    }
  } else if (kind === "leather") {
    const cells = 90;
    for (let i = 0; i < cells; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 10 + rand() * 14;
      b.fillStyle = `rgba(0,0,0,${0.12 + rand() * 0.12})`;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.strokeStyle = "rgba(0,0,0,0.35)";
      b.lineWidth = 1.5;
      b.stroke();
      g.strokeStyle = "rgba(0,0,0,0.06)";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(255,255,255,${rand() * 0.07})`;
      g.fillRect(rand() * S, rand() * S, 1.5, 1.5);
    }
  } else {
    // brushed metal: long fine horizontal streaks
    for (let i = 0; i < 700; i++) {
      const y = rand() * S;
      const x = rand() * S;
      const len = 40 + rand() * 180;
      g.strokeStyle = rand() > 0.5 ? `rgba(255,255,255,${rand() * 0.3})` : `rgba(0,0,0,${rand() * 0.08})`;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.stroke();
      b.strokeStyle = `rgba(255,255,255,${rand() * 0.2})`;
      b.lineWidth = 0.6;
      b.beginPath();
      b.moveTo(x, y);
      b.lineTo(x + len, y);
      b.stroke();
    }
  }
  return { color, bump };
}

function wrap(t: THREE.CanvasTexture, repeat: number, srgb: boolean) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Shared grain textures for a surface kind (created once, never disposed). */
export function getDetail(kind: DetailKind): Pair & { bumpScale: number } {
  let p = cache.get(kind);
  if (!p) {
    const { color, bump } = paint(kind);
    const rep = kind === "weave" ? 4 : kind === "leather" ? 3 : 2;
    p = { map: wrap(new THREE.CanvasTexture(color), rep, true), bump: wrap(new THREE.CanvasTexture(bump), rep, false) };
    cache.set(kind, p);
  }
  return { ...p, bumpScale: kind === "weave" ? 0.7 : kind === "leather" ? 1.4 : kind === "woodgrain" ? 0.5 : 0.25 };
}

/** Downscales an uploaded image to at most `max` px and returns a compact JPEG data URL (for saving in the project). */
export function downscaleImage(file: File, max = 512, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext("2d");
      if (!g) {
        URL.revokeObjectURL(url);
        return reject(new Error("canvas unavailable"));
      }
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a readable image."));
    };
    img.src = url;
  });
}
