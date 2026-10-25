import * as THREE from "three";
import { hexToRgb, rgbToHex, shade } from "./color";
import type { FloorMaterial, WallPattern } from "@/types/room";

/** Deterministic pseudo random so textures do not flicker between rebuilds. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finish(canvas: HTMLCanvasElement, repeatX: number, repeatY: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Procedurally generated floor texture (no external image assets). Returns null for plain colour. */
export function makeFloorTexture(kind: FloorMaterial, color: string): THREE.Texture | null {
  if (typeof document === "undefined" || kind === "plain") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;
  const rand = rng(7);
  if (kind === "wood") {
    // 1.2 m x 0.6 m tile with 4 planks of 15 cm
    g.fillStyle = color;
    g.fillRect(0, 0, 512, 512);
    const planks = 4;
    const ph = 512 / planks;
    for (let i = 0; i < planks; i++) {
      const offset = rand() * 256;
      for (let seg = 0; seg < 2; seg++) {
        const x0 = ((seg * 256 + offset) % 512) - 256 * 0;
        g.fillStyle = shade(color, (rand() - 0.5) * 0.22);
        g.fillRect(x0 % 512, i * ph, 256, ph);
        g.fillRect((x0 % 512) - 512, i * ph, 256, ph);
        g.strokeStyle = "rgba(0,0,0,0.22)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x0 % 512, i * ph);
        g.lineTo(x0 % 512, (i + 1) * ph);
        g.stroke();
      }
      for (let k = 0; k < 18; k++) {
        g.strokeStyle = `rgba(60,35,15,${0.05 + rand() * 0.08})`;
        g.lineWidth = 1;
        const y = i * ph + rand() * ph;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(170, y + (rand() - 0.5) * 6, 340, y + (rand() - 0.5) * 6, 512, y);
        g.stroke();
      }
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, i * ph);
      g.lineTo(512, i * ph);
      g.stroke();
    }
    return finish(c, 1 / 1.2, 1 / 0.6);
  }
  if (kind === "tile") {
    g.fillStyle = shade(color, -0.18);
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = color;
    g.fillRect(6, 6, 500, 500);
    const grd = g.createLinearGradient(0, 0, 512, 512);
    grd.addColorStop(0, "rgba(255,255,255,0.18)");
    grd.addColorStop(1, "rgba(0,0,0,0.06)");
    g.fillStyle = grd;
    g.fillRect(6, 6, 500, 500);
    return finish(c, 1 / 0.6, 1 / 0.6);
  }
  // concrete & carpet: speckle noise
  g.fillStyle = color;
  g.fillRect(0, 0, 512, 512);
  const [r, gr, b] = hexToRgb(color);
  const count = kind === "carpet" ? 14000 : 7000;
  for (let i = 0; i < count; i++) {
    const d = (rand() - 0.5) * (kind === "carpet" ? 40 : 28);
    g.fillStyle = rgbToHex(r + d, gr + d, b + d);
    const s = kind === "carpet" ? 2 : 1 + rand() * 4;
    g.fillRect(rand() * 512, rand() * 512, s, s);
  }
  return finish(c, 1 / (kind === "carpet" ? 1 : 2), 1 / (kind === "carpet" ? 1 : 2));
}

/** Soft radial blob used as a cheap ambient-occlusion contact shadow under furniture. */
export function makeBlobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.85)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.45)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tile size (metres) covered by one wall-pattern texture. Wall UVs are in metres. */
export function wallTileSize(pattern: WallPattern, wallHeight: number): [number, number] {
  switch (pattern) {
    case "stripes":
      return [0.4, 0.4];
    case "dots":
      return [0.3, 0.3];
    case "brick":
      return [0.6, 0.3];
    case "panels":
      return [1.0, wallHeight];
    default:
      return [1, 1];
  }
}

/** Procedural wall pattern; null for plain paint. */
export function makeWallTexture(pattern: WallPattern, color: string, wallHeight: number): THREE.Texture | null {
  if (typeof document === "undefined" || pattern === "none") return null;
  const [tw, th] = wallTileSize(pattern, wallHeight);
  const W = 256;
  const H = Math.min(1024, Math.max(64, Math.round((W * th) / tw)));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const rand = rng(11);
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  const dark = shade(color, -0.1);
  const darker = shade(color, -0.22);
  const light = shade(color, 0.12);
  if (pattern === "plaster") {
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = rand() > 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
      const sz = 1 + rand() * 3;
      g.fillRect(rand() * W, rand() * H, sz, sz);
    }
  } else if (pattern === "stripes") {
    g.fillStyle = dark;
    g.fillRect(0, 0, W / 2, H);
  } else if (pattern === "dots") {
    g.fillStyle = darker;
    for (const [x, y] of [[W / 4, H / 4], [(3 * W) / 4, (3 * H) / 4]]) {
      g.beginPath();
      g.arc(x, y, W * 0.09, 0, Math.PI * 2);
      g.fill();
    }
  } else if (pattern === "brick") {
    const rows = 2;
    const bh = H / rows;
    g.fillStyle = shade(color, -0.35);
    g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? W / 4 : 0;
      for (let k = -1; k < 2; k++) {
        g.fillStyle = shade(color, (rand() - 0.5) * 0.18);
        g.fillRect(off + (k * W) / 2 + 3, r * bh + 3, W / 2 - 6, bh - 6);
      }
    }
  } else if (pattern === "panels") {
    // wainscot: framed panels on the lower 40 %, chair rail, plain above
    const rail = H * 0.4;
    g.fillStyle = light;
    g.fillRect(0, H - rail, W, rail);
    g.strokeStyle = darker;
    g.lineWidth = 3;
    g.strokeRect(W * 0.12, H - rail + rail * 0.18, W * 0.76, rail * 0.64);
    g.fillStyle = darker;
    g.fillRect(0, H - rail - 4, W, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / tw, 1 / th);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
