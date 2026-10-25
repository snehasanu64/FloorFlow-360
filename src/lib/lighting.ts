/** Sun / sky model for the 3D scene. `hour` is local solar time 0..24: sunrise at 6, sunset at 18. */
export interface SunState {
  /** Normalised direction from the room towards the sun. */
  dir: [number, number, number];
  /** 0 at/below the horizon, 1 at noon. */
  elevation: number;
  sunIntensity: number;
  sunColor: string;
  ambient: number;
  hemisphere: number;
  environment: number;
  background: string;
  moonIntensity: number;
  isNight: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, "0")).join("")}`;
}

export function sunState(hour: number): SunState {
  const h = ((hour % 24) + 24) % 24;
  const a = ((h - 6) / 12) * Math.PI; // 0 at sunrise, π at sunset
  const sin = Math.sin(a);
  const elevation = clamp01(sin);
  const dayness = clamp01(sin * 2.2); // quick fade around the horizon
  const dir: [number, number, number] = [Math.cos(a), Math.max(0.05, sin), 0.45];
  const len = Math.hypot(...dir);
  const warm = clamp01(1 - sin * 2.2); // golden near the horizon
  return {
    dir: [dir[0] / len, dir[1] / len, dir[2] / len],
    elevation,
    sunIntensity: sin > 0 ? 0.35 + 1.9 * Math.pow(elevation, 0.6) : 0,
    sunColor: mixHex("#fff3df", "#ff9d5c", warm),
    ambient: lerp(0.1, 0.38, dayness),
    hemisphere: lerp(0.12, 0.55, dayness),
    environment: lerp(0.12, 0.55, dayness),
    background: mixHex("#0e111a", mixHex("#e9d9c8", "#e8e6e1", clamp01(sin * 1.6)), dayness),
    moonIntensity: lerp(0.28, 0, dayness),
    isNight: sin < 0.12,
  };
}

export type LampsMode = "auto" | "on" | "off";
export const lampsActive = (mode: LampsMode, s: SunState) => (mode === "on" ? true : mode === "off" ? false : s.elevation < 0.35);

export function formatHour(h: number) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
