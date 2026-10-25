import { getCatalogItem } from "@/data/furniture-catalog";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";
import { ROOM_KINDS, type RoomKind } from "./autolayout";
import { rgbToHex } from "./color";
import { getRoomPolygon } from "./geometry";
import { polygonArea } from "./roomShape";
import { STYLES, styleFor, type StylePreset } from "./styles";

/**
 * On-device photo analysis: reads colour and light from the pixels. It cannot recognise objects
 * (that needs a vision model — see lib/ai.ts); what it can do reliably is describe the palette, the
 * brightness and warmth, and map those onto interior styles to drive furniture suggestions.
 */
export interface PhotoFeatures {
  /** 0 (black) .. 1 (white) average perceived brightness. */
  brightness: number;
  /** Average HSL saturation 0..1. */
  saturation: number;
  /** (R - B) / 255: positive = warm light, negative = cool. */
  warmth: number;
  /** Share of pixels that look like wood (orange-brown hues, medium saturation and brightness). */
  woodShare: number;
  /** Share of pixels in the blue-teal range. */
  blueShare: number;
  /** Share of pixels with strong saturation (accent colours). */
  vividShare: number;
  /** Spread of brightness (standard deviation). */
  contrast: number;
  palette: string[];
}

/** Hue (degrees), HSV saturation and value. HSV saturation keeps off-white walls "unsaturated", unlike HSL. */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const sat = max === 0 ? 0 : d / max;
  if (d === 0) return [0, sat, v];
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, sat, v];
}

/** Deterministic k-means over a sample of pixels; clusters are returned largest first. */
function kmeans(px: number[][], k: number): { c: number[]; n: number }[] {
  if (px.length === 0) return [];
  const sorted = [...px].sort((a, b) => a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11 - (b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11));
  let centers = Array.from({ length: k }, (_, i) => [...sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) * sorted.length) / k))]]);
  let counts = new Array(k).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    const sum = Array.from({ length: k }, () => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const p of px) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < k; i++) {
        const d = (p[0] - centers[i][0]) ** 2 + (p[1] - centers[i][1]) ** 2 + (p[2] - centers[i][2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      counts[bi]++;
      sum[bi][0] += p[0];
      sum[bi][1] += p[1];
      sum[bi][2] += p[2];
    }
    centers = centers.map((c, i) => (counts[i] ? sum[i].map((v) => v / counts[i]) : c));
  }
  return centers.map((c, i) => ({ c, n: counts[i] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
}

/** Pure analysis of RGBA pixel data (any size). */
export function analyzePixels(data: Uint8ClampedArray | number[], maxSamples = 3000): PhotoFeatures {
  const total = Math.floor(data.length / 4);
  const step = Math.max(1, Math.floor(total / maxSamples));
  const px: number[][] = [];
  let lum = 0;
  let lum2 = 0;
  let sat = 0;
  let warm = 0;
  let wood = 0;
  let blue = 0;
  let vivid = 0;
  for (let i = 0; i < total; i += step) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    px.push([r, g, b]);
    const [h, s, l] = rgbToHsv(r, g, b);
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    lum += y;
    lum2 += y * y;
    sat += s;
    warm += (r - b) / 255;
    if (h >= 15 && h <= 45 && s >= 0.25 && s <= 0.85 && l >= 0.25 && l <= 0.92) wood++;
    if (h >= 170 && h <= 250 && s >= 0.2) blue++;
    if (s >= 0.6 && l >= 0.3) vivid++;
  }
  const n = Math.max(1, px.length);
  const mean = lum / n;
  const palette = kmeans(px, 5).map((x) => rgbToHex(x.c[0], x.c[1], x.c[2]));
  return {
    brightness: mean,
    saturation: sat / n,
    warmth: warm / n,
    woodShare: wood / n,
    blueShare: blue / n,
    vividShare: vivid / n,
    contrast: Math.sqrt(Math.max(0, lum2 / n - mean * mean)),
    palette,
  };
}

/** Merges several photos: averages the numbers and keeps the most frequent palette colours. */
export function mergeFeatures(list: PhotoFeatures[]): PhotoFeatures {
  const n = list.length || 1;
  const avg = (f: (p: PhotoFeatures) => number) => list.reduce((s, p) => s + f(p), 0) / n;
  return {
    brightness: avg((p) => p.brightness),
    saturation: avg((p) => p.saturation),
    warmth: avg((p) => p.warmth),
    woodShare: avg((p) => p.woodShare),
    blueShare: avg((p) => p.blueShare),
    vividShare: avg((p) => p.vividShare),
    contrast: avg((p) => p.contrast),
    palette: list.flatMap((p) => p.palette.slice(0, 3)).slice(0, 6),
  };
}

export interface StyleScore {
  style: StylePreset;
  /** 0..1 relative confidence among the candidates. */
  confidence: number;
  why: string;
}

/** Maps colour / light features onto the style presets. */
export function scoreStyles(f: PhotoFeatures): StyleScore[] {
  const bright = f.brightness;
  const lowSat = f.saturation < 0.18;
  const midSat = f.saturation >= 0.18 && f.saturation < 0.38;
  const highSat = f.saturation >= 0.38;
  const raw: Record<string, { s: number; why: string }> = {
    scandinavian: { s: (bright > 0.58 ? 2 : 0) + (lowSat || midSat ? 1 : 0) + (f.woodShare > 0.04 && f.woodShare < 0.35 ? 1.5 : 0) - (f.warmth > 0.2 ? 1 : 0), why: "bright, soft colours with a little pale wood" },
    minimal: { s: (bright > 0.62 ? 2 : 0) + (f.saturation < 0.1 ? 2.5 : lowSat ? 1 : 0) + (f.woodShare < 0.08 ? 0.5 : 0) - (f.contrast > 0.28 ? 1 : 0), why: "very bright and almost colourless" },
    modern: { s: (f.contrast > 0.2 ? 1 : 0) + (lowSat ? 1.5 : 0) + (f.warmth < 0.05 ? 1 : 0) + (bright > 0.35 && bright < 0.65 ? 1 : 0), why: "cool, balanced greys with good contrast" },
    industrial: { s: (bright < 0.4 ? 2 : 0) + (lowSat ? 1.5 : 0) + (f.warmth < 0.08 ? 0.5 : 0) + (f.contrast > 0.22 ? 1 : 0) - (f.woodShare > 0.4 ? 1 : 0), why: "dark, muted tones with strong contrast" },
    boho: { s: (highSat ? 2 : 0) + (f.warmth > 0.08 ? 1.5 : 0) + (f.vividShare > 0.12 ? 1.5 : 0) + (f.woodShare > 0.1 ? 0.5 : 0), why: "warm, saturated, colourful palette" },
    indian: { s: (f.warmth > 0.14 ? 2 : 0) + (f.woodShare > 0.2 ? 2 : 0) + (bright > 0.3 && bright < 0.65 ? 1 : 0) + (midSat || highSat ? 1 : 0), why: "warm wood tones and rich, warm colours" },
    japandi: { s: (midSat || lowSat ? 1 : 0) + (f.woodShare > 0.08 && f.woodShare < 0.4 ? 1.5 : 0) + (bright > 0.45 && bright < 0.75 ? 1.5 : 0) + (Math.abs(f.warmth) < 0.12 ? 1 : 0), why: "balanced neutrals with natural wood" },
    luxe: { s: (bright < 0.45 ? 1.5 : 0) + (f.contrast > 0.25 ? 1.5 : 0) + (f.warmth > 0.05 ? 0.5 : 0) + (f.vividShare > 0.05 && f.vividShare < 0.25 ? 1 : 0), why: "deep tones with rich accents and contrast" },
    coastal: { s: (f.blueShare > 0.12 ? 2.5 : f.blueShare > 0.06 ? 1 : 0) + (bright > 0.6 ? 1.5 : 0) + (f.warmth < 0.02 ? 1 : 0), why: "bright with cool blue accents" },
    rustic: { s: (f.woodShare > 0.3 ? 2 : 0) + (f.warmth > 0.1 ? 1 : 0) + (bright < 0.5 ? 1 : 0) + (midSat ? 1 : 0), why: "plenty of warm, darker wood" },
    midcentury: { s: (f.woodShare > 0.15 ? 1.5 : 0) + (f.warmth > 0.06 ? 1 : 0) + (f.vividShare > 0.08 ? 1.5 : 0) + (midSat ? 1 : 0), why: "warm wood with a few vivid retro accents" },
  };
  const scored = STYLES.map((style) => ({ style, s: Math.max(0.1, raw[style.id]?.s ?? 0), why: raw[style.id]?.why ?? "" }));
  const total = scored.reduce((a, b) => a + b.s, 0) || 1;
  return scored
    .map((x) => ({ style: x.style, confidence: x.s / total, why: x.why }))
    .sort((a, b) => b.confidence - a.confidence);
}

export const describeLight = (f: PhotoFeatures) =>
  `${f.brightness > 0.65 ? "Bright" : f.brightness > 0.4 ? "Moderately lit" : "Dim"}, ${f.warmth > 0.1 ? "warm" : f.warmth < -0.03 ? "cool" : "neutral"} light, ${f.saturation > 0.38 ? "colourful" : f.saturation > 0.18 ? "softly coloured" : "muted"} palette`;

/* ---------------- furniture suggestions ---------------- */

export interface Suggestion {
  catalogId: string;
  reason: string;
  /** Colour from the chosen style (used when the piece is added). */
  color?: string;
}

const WISHLIST: Record<RoomKind, { id: string; reason: string; max?: number }[]> = {
  living: [
    { id: "sofa-3", reason: "Seating anchor for the room" },
    { id: "coffee-table", reason: "Gives the seating area a centre" },
    { id: "tv-unit", reason: "Media wall / storage" },
    { id: "armchair", reason: "Extra seat and a place for an accent colour", max: 2 },
    { id: "rug", reason: "Defines the lounge zone and softens the floor" },
    { id: "bookshelf", reason: "Display and storage along a wall" },
    { id: "floor-lamp", reason: "Warm layered lighting for evenings" },
    { id: "side-table", reason: "Surface within reach of the sofa" },
    { id: "plant", reason: "Adds life and a natural colour" },
  ],
  bedroom: [
    { id: "bed-double", reason: "Sleeping area" },
    { id: "bedside", reason: "Night-time surface and storage", max: 2 },
    { id: "wardrobe", reason: "Main clothes storage" },
    { id: "dressing-table", reason: "Grooming area with a mirror" },
    { id: "chest-drawers", reason: "Extra storage" },
    { id: "rug", reason: "Soft landing for bare feet" },
    { id: "ottoman", reason: "Seat or storage at the foot of the bed" },
    { id: "plant", reason: "Calming greenery" },
  ],
  dining: [
    { id: "dining-table", reason: "The centre of the room" },
    { id: "dining-chairs", reason: "Seating (a pair per long side)", max: 2 },
    { id: "sideboard", reason: "Serving and storage" },
    { id: "crockery-unit", reason: "Display for crockery" },
    { id: "plant", reason: "Fresh accent" },
  ],
  kitchen: [
    { id: "fridge", reason: "Cold storage" },
    { id: "stove", reason: "Cooking" },
    { id: "kitchen-sink", reason: "Washing up" },
    { id: "kitchen-base", reason: "Counter and storage", max: 3 },
    { id: "wall-cabinet", reason: "Overhead storage", max: 3 },
    { id: "kitchen-island", reason: "Prep space and breakfast bar" },
    { id: "bar-stool", reason: "Seating at the island", max: 3 },
  ],
  office: [
    { id: "office-desk", reason: "Main work surface" },
    { id: "office-chair", reason: "Ergonomic seat" },
    { id: "bookshelf", reason: "Books and files" },
    { id: "filing-cabinet", reason: "Document storage" },
    { id: "floor-lamp", reason: "Task / ambient light" },
    { id: "plant", reason: "Greenery for focus and calm" },
  ],
  kids: [
    { id: "kids-bed", reason: "Sleeping" },
    { id: "kids-desk", reason: "Homework and craft table" },
    { id: "toy-storage", reason: "Keeps toys tidy" },
    { id: "bookshelf", reason: "Reading corner" },
    { id: "rug", reason: "Soft play area" },
  ],
  bathroom: [
    { id: "vanity", reason: "Basin and storage" },
    { id: "toilet", reason: "Essential fixture" },
    { id: "bathtub", reason: "Bathing" },
    { id: "washer", reason: "Laundry" },
    { id: "bath-cabinet", reason: "Tall storage" },
  ],
  pooja: [
    { id: "mandir", reason: "Focal point of the prayer room" },
    { id: "chowki", reason: "Seat for prayer" },
    { id: "deepam", reason: "Traditional lamp" },
    { id: "pooja-mat", reason: "Clean prayer space" },
    { id: "pooja-plant", reason: "Tulsi plant" },
    { id: "pooja-cabinet", reason: "Storage for pooja items" },
  ],
};

/** Suggest catalogue pieces for a room type that fit the room and are not already there, coloured for the style. */
export function suggestFurniture(kind: RoomKind | "other", style: StylePreset | undefined, room: RoomConfig, existing: PlacedItem[], limit = 8): Suggestion[] {
  const list = WISHLIST[kind === "other" ? "living" : kind];
  const area = polygonArea(getRoomPolygon(room));
  const have = new Map<string, number>();
  for (const it of existing) have.set(it.catalogId, (have.get(it.catalogId) ?? 0) + 1);
  const out: Suggestion[] = [];
  for (const w of list) {
    const cat = getCatalogItem(w.id);
    if (!cat) continue;
    if ((have.get(w.id) ?? 0) >= (w.max ?? 1)) continue;
    const footprint = cat.width * cat.depth;
    if (!cat.ignoreCollision && footprint > area * 0.22) continue; // far too big for this room
    const st = style ? styleFor(w.id, style) : null;
    out.push({
      catalogId: w.id,
      reason: `${w.reason}${st && style ? ` — ${style.name.toLowerCase()} finish` : ""}`,
      color: st?.color,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export const kindLabel = (k: RoomKind | "other") => ROOM_KINDS.find((r) => r.value === k)?.label ?? "Room";

/** Loads an image from a data URL and reads its pixels at a small size (browser only). */
export function loadPixels(dataUrl: string, size = 96): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return reject(new Error("canvas unavailable"));
      g.drawImage(img, 0, 0, w, h);
      resolve({ data: g.getImageData(0, 0, w, h).data, w, h });
    };
    img.onerror = () => reject(new Error("Could not decode the image."));
    img.src = dataUrl;
  });
}

export async function analyzeImages(dataUrls: string[]): Promise<PhotoFeatures> {
  const feats: PhotoFeatures[] = [];
  for (const u of dataUrls) {
    const { data } = await loadPixels(u);
    feats.push(analyzePixels(data));
  }
  return mergeFeatures(feats);
}

