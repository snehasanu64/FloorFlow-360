function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");
}

/** amount in [-1, 1]: negative mixes toward black, positive toward white. */
export function shade(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  return rgbToHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

export const isHexColor = (v: unknown): v is string =>
  typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

/** Normalises #abc to #aabbcc so <input type="color"> accepts it. */
export const normalizeHex = (v: string) => rgbToHex(...hexToRgb(v));

export type Tone = "base" | "dark" | "light" | "accent" | "green" | "white" | "wood" | "glass";

export function toneColor(base: string, tone: Tone) {
  switch (tone) {
    case "base":
      return base;
    case "dark":
      return shade(base, -0.28);
    case "light":
      return shade(base, 0.2);
    case "accent":
      return shade(base, -0.12);
    case "green":
      return "#6a9a55";
    case "white":
      return "#f2efe8";
    case "wood":
      return "#8b6b4a";
    case "glass":
      return "#cfe3ea";
  }
}

export const COLOR_PRESETS = [
  { name: "Beige", value: "#d8c8aa" },
  { name: "Grey", value: "#8b8d90" },
  { name: "Charcoal", value: "#3b3d41" },
  { name: "Navy blue", value: "#1f3556" },
  { name: "Olive green", value: "#6b7140" },
  { name: "Brown", value: "#6f4a32" },
  { name: "White", value: "#f1efea" },
  { name: "Black", value: "#1b1b1d" },
  { name: "Terracotta", value: "#b5654a" },
  { name: "Sage", value: "#9aae96" },
];

export const WOOD_PRESETS = [
  { name: "Light oak", value: "#c9a77c" },
  { name: "Natural ash", value: "#dcc8a2" },
  { name: "Walnut", value: "#5e4231" },
  { name: "Teak", value: "#9a6a3b" },
  { name: "Cherry", value: "#8a4b34" },
  { name: "Ebony", value: "#2a211c" },
];
