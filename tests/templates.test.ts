import { describe, expect, it } from "vitest";
import { TEMPLATES, buildTemplate } from "@/data/templates";
import { analyzeLayout } from "@/lib/placement";

describe("layout templates", () => {
  for (const t of TEMPLATES) {
    it(`${t.name}: every piece is inside the room and nothing overlaps`, () => {
      const { room, items } = buildTemplate(t);
      expect(items.length).toBe(t.items.length); // no unknown catalogue ids
      const issues = analyzeLayout(items, room);
      const problems = items
        .map((it) => ({ name: it.name, x: it.x, z: it.z, i: issues.get(it.id)! }))
        .filter((p) => p.i.outside || p.i.overlaps.length)
        .map((p) => `${p.name} @ (${p.x}, ${p.z}) ${p.i.outside ? "OUTSIDE " : ""}${p.i.overlaps.length ? "overlaps " + p.i.overlaps.length : ""}`);
      expect(problems).toEqual([]);
    });

    it(`${t.name}: doors and windows are valid`, () => {
      const { room } = buildTemplate(t);
      expect(room.openings).toHaveLength(t.openings.length);
      for (const o of room.openings) {
        expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
