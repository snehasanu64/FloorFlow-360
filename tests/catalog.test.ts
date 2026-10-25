import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LABELS, FURNITURE_CATALOG } from "@/data/furniture-catalog";
import { indicativePriceUsd } from "@/data/pricing";
import { footprintShapes, localRects } from "@/lib/footprint";
import { createPlacedItem } from "@/lib/placement";

describe("furniture catalogue", () => {
  it("is large and has unique ids and names", () => {
    expect(FURNITURE_CATALOG.length).toBeGreaterThan(150);
    const ids = FURNITURE_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = FURNITURE_CATALOG.map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("has at least one item for every letter A to Z", () => {
    const letters = new Set(FURNITURE_CATALOG.map((c) => c.name[0].toUpperCase()));
    for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") expect(letters.has(L), `no item starting with ${L}`).toBe(true);
  });

  for (const c of FURNITURE_CATALOG) {
    it(`${c.name}: sizes, materials, footprint and price are valid`, () => {
      expect(CATEGORIES).toContain(c.category);
      expect(CATEGORY_LABELS[c.category]).toBeTruthy();
      for (const a of c.alsoIn ?? []) expect(CATEGORIES).toContain(a);
      for (const v of [c.width, c.depth, c.height]) expect(v).toBeGreaterThan(0);
      expect(c.width).toBeLessThan(6);
      expect(c.height).toBeLessThan(4);
      expect(c.minSize).toBeLessThanOrEqual(Math.min(c.width, c.depth) + 1e-9);
      expect(c.materials).toContain(c.defaultMaterial);
      expect(footprintShapes({ model: c.model, width: c.width, depth: c.depth, seats: c.seats }).length).toBeGreaterThan(0);
      expect(localRects({ model: c.model, width: c.width, depth: c.depth }).length).toBeGreaterThan(0);
      expect(indicativePriceUsd(c.id, c.width, c.depth, c.height)).toBeGreaterThan(0);
      const placed = createPlacedItem(c);
      expect(placed.width).toBe(c.width);
      if (c.mount === "ceiling" || (c.elevation ?? 0) > 0) expect(c.ignoreCollision).toBe(true);
    });
  }
});
