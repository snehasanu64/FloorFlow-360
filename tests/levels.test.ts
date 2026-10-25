import { beforeEach, describe, expect, it } from "vitest";
import { levelElevations, SLAB, stairOpenings } from "@/lib/levels";
import { validateProject } from "@/lib/persistence";
import { DEFAULT_ROOM } from "@/lib/room";
import { buildBom } from "@/lib/estimate";
import { useEditorStore } from "@/store/editor-store";

const st = () => useEditorStore.getState();

describe("floors", () => {
  beforeEach(() => {
    st().startProject(DEFAULT_ROOM, "Two floors");
  });

  it("stacks floors at wall height + slab", () => {
    const ys = levelElevations([
      { id: "a", wallHeight: 2.8 },
      { id: "b", wallHeight: 3 },
      { id: "c", wallHeight: 2.6 },
    ]);
    expect(ys.a).toBe(0);
    expect(ys.b).toBeCloseTo(2.8 + SLAB);
    expect(ys.c).toBeCloseTo(2.8 + SLAB + 3 + SLAB);
  });

  it("keeps each floor's furniture when switching, and saves every floor", () => {
    st().addItem("sofa-3");
    const ground = st().activeLevelId;
    st().addLevel("First floor");
    expect(st().levels).toHaveLength(2);
    expect(st().items).toHaveLength(0); // the new floor is empty
    st().addItem("bed-double");
    st().addItem("wardrobe");
    const first = st().activeLevelId;
    st().switchLevel(ground);
    expect(st().items.map((i) => i.catalogId)).toEqual(["sofa-3"]);
    expect(st().past).toHaveLength(0); // history restarts per floor
    st().switchLevel(first);
    expect(st().items).toHaveLength(2);

    const file = st().buildFile();
    expect(file.levels.map((l) => [l.name, l.items.length])).toEqual([
      ["Ground floor", 1],
      ["First floor", 2],
    ]);
    const res = validateProject(JSON.parse(JSON.stringify(file)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.project.levels.map((l) => l.items.length)).toEqual([1, 2]);
  });

  it("deleting the active floor falls back to another one", () => {
    st().addItem("sofa-3");
    st().addLevel("Upstairs");
    const up = st().activeLevelId;
    st().removeLevel(up);
    expect(st().levels).toHaveLength(1);
    expect(st().items.map((i) => i.catalogId)).toEqual(["sofa-3"]);
    st().removeLevel(st().activeLevelId); // cannot delete the only floor
    expect(st().levels).toHaveLength(1);
  });

  it("staircases cut an opening matching their footprint", () => {
    st().addItem("stairs");
    const openings = stairOpenings(st().items);
    expect(openings).toHaveLength(1);
    const xs = openings[0].map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1.0, 3);
  });

  it("the cost estimate counts every floor", () => {
    st().addItem("sofa-3");
    st().addLevel("Upstairs");
    st().addItem("sofa-3");
    const file = st().buildFile();
    const bom = buildBom(file.levels, st().estimate);
    expect(bom.quantity).toBe(2);
    expect(bom.lines).toHaveLength(1);
    expect(bom.lines[0].floors).toEqual(["Ground floor", "Upstairs"]);
  });
});
