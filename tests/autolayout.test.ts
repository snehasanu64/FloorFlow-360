import { describe, expect, it } from "vitest";
import { ROOM_KINDS, autoArrange } from "@/lib/autolayout";
import { analyzeLayout } from "@/lib/placement";
import { DEFAULT_ROOM, createOpening, sanitizeRoom } from "@/lib/room";
import { vastuReport, vastuScore, directionOf, zoneOf } from "@/lib/vastu";
import { buildTemplate, TEMPLATES } from "@/data/templates";

const sizes: [number, number][] = [
  [4, 3.5],
  [5, 4],
  [6.5, 4.5],
];

describe("auto arrange", () => {
  for (const kind of ROOM_KINDS) {
    for (const [L, W] of sizes) {
      it(`${kind.label} in ${L} × ${W} m produces a valid layout`, () => {
        const base = sanitizeRoom({ ...DEFAULT_ROOM, length: L, width: W });
        const room = { ...base, openings: [createOpening("door", base), createOpening("window", base)] };
        const { items } = autoArrange(room, kind.value);
        const issues = analyzeLayout(items, room);
        const bad = items.filter((i) => issues.get(i.id)!.outside || issues.get(i.id)!.overlaps.length).map((i) => i.name);
        expect(bad).toEqual([]);
        expect(items.length).toBeGreaterThan(0);
      });
    }
  }

  it("a living room gets a sofa facing the TV and a coffee table between them", () => {
    const room = sanitizeRoom({ ...DEFAULT_ROOM, length: 5.5, width: 4.2 });
    const { items } = autoArrange(room, "living");
    const by = (id: string) => items.find((i) => i.catalogId === id);
    const tv = by("tv-unit");
    const sofa = by("sofa-3");
    const table = by("coffee-table");
    expect(tv && sofa && table).toBeTruthy();
    // table is between the sofa and the TV
    const dTvSofa = Math.hypot(tv!.x - sofa!.x, tv!.z - sofa!.z);
    expect(Math.hypot(tv!.x - table!.x, tv!.z - table!.z)).toBeLessThan(dTvSofa);
    expect(Math.hypot(sofa!.x - table!.x, sofa!.z - table!.z)).toBeLessThan(dTvSofa);
  });

  it("never blocks the door swing", () => {
    const base = sanitizeRoom({ ...DEFAULT_ROOM, length: 4, width: 3.5 });
    const door = createOpening("door", base);
    const room = { ...base, openings: [door] };
    const { items } = autoArrange(room, "bedroom");
    // door is on the south wall (edge 2); the swing square sits in front of it
    const e = { x: room.length - door.offset, z: room.width };
    for (const it of items) {
      if (it.catalogId === "rug" || it.catalogId === "ceiling-light") continue;
      const near = Math.abs(it.x - e.x) < door.width / 2 + it.width / 2 - 0.05 && room.width - it.z < door.width + it.depth / 2 - 0.05;
      expect(near, `${it.name} blocks the door`).toBe(false);
    }
  });
});

describe("vastu helper", () => {
  it("compass directions follow the plan and the north angle", () => {
    expect(directionOf({ x: 0, z: -1 })).toBe("N");
    expect(directionOf({ x: 1, z: 0 })).toBe("E");
    expect(directionOf({ x: 0, z: 1 })).toBe("S");
    expect(directionOf({ x: 0, z: -1 }, 90)).toBe("W"); // true north is to the right, so "up" is west
    const room = sanitizeRoom({ ...DEFAULT_ROOM, length: 6, width: 4 });
    expect(zoneOf({ x: 5.5, z: 0.4 }, room)).toBe("NE");
    expect(zoneOf({ x: 0.4, z: 3.6 }, room)).toBe("SW");
    expect(zoneOf({ x: 3, z: 2 }, room)).toBe("C");
  });

  it("flags a mandir in the south-west and approves it in the north-east", () => {
    const t = TEMPLATES.find((x) => x.id === "pooja")!;
    const { room, items } = buildTemplate(t);
    const mandir = items.find((i) => i.catalogId === "mandir")!;
    const ok = vastuReport([{ ...mandir, x: room.length - 0.5, z: 0.3 }], room);
    expect(ok.find((c) => c.id.endsWith("-zone"))!.status).toBe("good");
    const bad = vastuReport([{ ...mandir, x: 0.5, z: room.width - 0.3 }], room);
    expect(bad.find((c) => c.id.endsWith("-zone"))!.status).toBe("warn");
    expect(vastuScore(ok).pct).not.toBeNull();
  });

  it("warns when a heavy item blocks the centre", () => {
    const t = TEMPLATES.find((x) => x.id === "living-room")!;
    const { room, items } = buildTemplate(t);
    const sofa = items.find((i) => i.catalogId === "sofa-3")!;
    const checks = vastuReport([{ ...sofa, x: room.length / 2, z: room.width / 2 }], room);
    expect(checks.find((c) => c.id === "centre")!.status).toBe("warn");
  });
});
