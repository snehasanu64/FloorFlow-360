import { CATEGORY_LABELS, getCatalogItem } from "@/data/furniture-catalog";
import { CURRENCIES, convertPrice, indicativePriceUsd, type CurrencyCode } from "@/data/pricing";
import type { EstimateSettings, Level } from "@/types/project";

export const DEFAULT_ESTIMATE: EstimateSettings = { currency: "USD", taxPct: 0, discountPct: 0, overrides: {} };

export const isCurrency = (c: unknown): c is CurrencyCode => typeof c === "string" && c in CURRENCIES;

export interface BomLine {
  key: string;
  catalogId: string;
  name: string;
  category: string;
  w: number;
  d: number;
  h: number;
  color: string;
  material: string;
  qty: number;
  floors: string[];
  unitPrice: number;
  /** True when the user typed a price for this catalogue item. */
  custom: boolean;
  total: number;
}

export interface Bom {
  lines: BomLine[];
  quantity: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: CurrencyCode;
}

const cm = (m: number) => Math.round(m * 100);

/** Bill of materials across all floors: identical pieces (same model, size, colour, material) share one line. */
export function buildBom(levels: Pick<Level, "name" | "items">[], est: EstimateSettings): Bom {
  const currency: CurrencyCode = isCurrency(est.currency) ? est.currency : "USD";
  const map = new Map<string, BomLine>();
  for (const lv of levels) {
    for (const it of lv.items) {
      const cat = getCatalogItem(it.catalogId);
      if (!cat) continue;
      const key = [it.catalogId, cm(it.width), cm(it.depth), cm(it.height), it.color, it.material].join("|");
      const hit = map.get(key);
      if (hit) {
        hit.qty += 1;
        if (!hit.floors.includes(lv.name)) hit.floors.push(lv.name);
        continue;
      }
      const override = est.overrides[it.catalogId];
      const unit = override !== undefined ? override : convertPrice(indicativePriceUsd(it.catalogId, it.width, it.depth, it.height), currency);
      map.set(key, {
        key,
        catalogId: it.catalogId,
        name: cat.name,
        category: CATEGORY_LABELS[cat.category],
        w: cm(it.width),
        d: cm(it.depth),
        h: cm(it.height),
        color: it.color,
        material: it.material,
        qty: 1,
        floors: [lv.name],
        unitPrice: unit,
        custom: override !== undefined,
        total: 0,
      });
    }
  }
  const lines = [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  for (const l of lines) l.total = l.qty * l.unitPrice;
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discount = (subtotal * Math.min(100, Math.max(0, est.discountPct))) / 100;
  const tax = ((subtotal - discount) * Math.min(100, Math.max(0, est.taxPct))) / 100;
  return { lines, quantity: lines.reduce((n, l) => n + l.qty, 0), subtotal, discount, tax, total: subtotal - discount + tax, currency };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV that opens directly in Excel / Google Sheets (UTF-8 with BOM). */
export function bomToCsv(bom: Bom, projectName: string): string {
  const head = ["Item", "Category", "Width (cm)", "Depth (cm)", "Height (cm)", "Colour", "Material", "Floors", "Qty", `Unit price (${bom.currency})`, `Total (${bom.currency})`];
  const rows = bom.lines.map((l) => [l.name, l.category, l.w, l.d, l.h, l.color, l.material, l.floors.join(" / "), l.qty, l.unitPrice, l.total]);
  const blank = ["", "", "", "", "", "", "", "", "", "", ""];
  const sum = (label: string, v: number) => [...blank.slice(0, 9), label, Math.round(v)];
  const out = [
    [`Cost estimate — ${projectName}`],
    ["Prices are indicative placeholders unless you entered your own."],
    [],
    head,
    ...rows,
    [],
    sum("Subtotal", bom.subtotal),
    ...(bom.discount ? [sum("Discount", -bom.discount)] : []),
    ...(bom.tax ? [sum("Tax", bom.tax)] : []),
    sum("Total", bom.total),
  ];
  return "﻿" + out.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
