import type { ModelKey } from "@/types/furniture";
import { getCatalogItem } from "./furniture-catalog";

/**
 * INDICATIVE placeholder prices (USD) used until real prices are entered.
 * They are rough mid-market guesses per model type, scaled by size — NOT a quotation.
 * The catalogue's `price` field is the hook for real inventory / quotation integration.
 */
const BASE_USD: Record<ModelKey, number> = {
  sofa: 650,
  lsofa: 1400,
  armchair: 320,
  coffeeTable: 160,
  tvUnit: 280,
  sideTable: 90,
  bookshelf: 240,
  bed: 700,
  bedsideTable: 110,
  wardrobe: 780,
  dressingTable: 320,
  diningTable: 480,
  diningChairs: 220,
  sideboard: 420,
  officeDesk: 300,
  officeChair: 190,
  storageCabinet: 210,
  floorLamp: 85,
  ceilingLight: 140,
  rug: 180,
  plant: 45,
  decorCabinet: 360,
  ottoman: 120,
  chair: 90,
  barStool: 85,
  lDesk: 380,
  drawers: 260,
  fridge: 900,
  stove: 650,
  washer: 520,
  kitchenBase: 190,
  sink: 520,
  wallCabinet: 150,
  bathtub: 650,
  shower: 720,
  toilet: 260,
  vanity: 380,
  crib: 280,
  bunkBed: 620,
  mirror: 150,
  coatStand: 60,
  piano: 1800,
  shoeRack: 70,
  tv: 480,
  mandir: 350,
  chowki: 55,
  deepam: 75,
  stairs: 2400,
  spiralStairs: 3200,
  appliance: 420,
  ac: 520,
  ceilingFan: 110,
  standFan: 70,
  beanbag: 60,
  basket: 25,
  screen: 160,
  fireplace: 900,
  jhula: 650,
  curtain: 90,
  treadmill: 800,
  aquarium: 420,
  rack: 75,
  tree: 80,
  grandClock: 700,
  wallArt: 45,
  glb: 200,
};

export const CURRENCIES = {
  USD: { rate: 1, label: "US dollar" },
  INR: { rate: 83, label: "Indian rupee" },
  EUR: { rate: 0.92, label: "Euro" },
  GBP: { rate: 0.79, label: "Pound sterling" },
  AED: { rate: 3.67, label: "UAE dirham" },
} as const;
export type CurrencyCode = keyof typeof CURRENCIES;

/** Indicative unit price in USD, scaled by how much bigger or smaller the piece is than the catalogue size. */
export function indicativePriceUsd(catalogId: string, w: number, d: number, h: number): number {
  const cat = getCatalogItem(catalogId);
  if (!cat) return 0;
  const base = BASE_USD[cat.model] ?? 150;
  const ratio = (w * d * Math.max(h, 0.05)) / (cat.width * cat.depth * Math.max(cat.height, 0.05));
  const scaled = base * Math.sqrt(Math.min(4, Math.max(0.25, ratio)));
  return Math.max(5, Math.round(scaled / 5) * 5);
}

export function convertPrice(usd: number, currency: CurrencyCode): number {
  const v = usd * CURRENCIES[currency].rate;
  return currency === "INR" ? Math.round(v / 50) * 50 : Math.round(v);
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

/** ASCII-only money format for PDF text (standard PDF fonts lack many currency symbols). */
export const formatMoneyPlain = (amount: number, currency: CurrencyCode) => `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
