/** UI shows centimetres; the store, 2D scene and Three.js use metres. */
export const M_TO_CM = 100;
export const toCm = (m: number) => m * M_TO_CM;
export const fromCm = (cm: number) => cm / M_TO_CM;
export const round = (v: number, digits = 3) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
export type Unit = "cm" | "m" | "in" | "ft";
export const UNITS: Record<Unit, { label: string; factor: number; name: string }> = {
  cm: { label: "cm", factor: 100, name: "Centimetres" },
  m: { label: "m", factor: 1, name: "Metres" },
  in: { label: "in", factor: 39.37007874, name: "Inches" },
  ft: { label: "ft", factor: 3.280839895, name: "Feet" },
};
let currentUnit: Unit = "cm";
export const setCurrentUnit = (u: Unit) => {
  currentUnit = u;
};
export const getCurrentUnit = () => currentUnit;
const trim = (n: number, d: number) => String(Math.round(n * 10 ** d) / 10 ** d);
/** Number in the active unit, without the unit label. */
export const lenValue = (m: number) => {
  const u = UNITS[currentUnit];
  return trim(m * u.factor, currentUnit === "cm" ? 1 : currentUnit === "m" ? 2 : 1);
};
/** "123.4 cm" style label in the active unit. */
export const formatLen = (m: number) => `${lenValue(m)} ${UNITS[currentUnit].label}`;
export const formatCm = formatLen;
export const formatCmShort = (m: number) => {
  const u = UNITS[currentUnit];
  return trim(m * u.factor, currentUnit === "m" ? 2 : currentUnit === "ft" ? 1 : 0);
};
export const formatDims = (w: number, d: number, h?: number) =>
  `${formatCmShort(w)} × ${formatCmShort(d)}${h !== undefined ? ` × ${formatCmShort(h)}` : ""} ${UNITS[currentUnit].label}`;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const normalizeDeg = (deg: number) => ((deg % 360) + 360) % 360;
export const degToRad = (d: number) => (d * Math.PI) / 180;

/** Pixels per metre of the 2D scene before the stage zoom is applied. */
export const PX_PER_M = 100;
export const metresToPx = (m: number) => m * PX_PER_M;
export const pxToMetres = (px: number) => px / PX_PER_M;
