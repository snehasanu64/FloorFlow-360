import { describe, expect, it } from "vitest";
import { getCatalogItem } from "@/data/furniture-catalog";
import { AiError, buildPrompt, parseAiResult, responseSchema } from "@/lib/ai";
import { analyzePixels, scoreStyles, suggestFurniture } from "@/lib/photo-analysis";
import { createPlacedItem } from "@/lib/placement";
import { DEFAULT_ROOM, sanitizeRoom } from "@/lib/room";
import { STYLES, getStyle, matchStyle, restyle, styleFor } from "@/lib/styles";
import type { PlacedItem } from "@/types/furniture";

const mk = (id: string, patch: Partial<PlacedItem> = {}): PlacedItem => ({ ...createPlacedItem(getCatalogItem(id)!), ...patch });
const solid = (r: number, g: number, b: number, n = 400) => {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) d.set([r, g, b, 255], i * 4);
  return d;
};

describe("style matching", () => {
  it("maps free text to presets", () => {
    expect(matchStyle("minimal Scandinavian with light wood")?.style.id).toBe("scandinavian");
    expect(matchStyle("a cosy industrial loft")?.style.id).toBe("industrial");
    expect(matchStyle("colourful boho vibe")?.style.id).toBe("boho");
    expect(matchStyle("traditional Indian home with teak and brass")?.style.id).toBe("indian");
    expect(matchStyle("mid-century modern")?.style.id).toBe("midcentury");
    expect(matchStyle("zzzz qqqq")).toBeNull();
  });
});

describe("restyle", () => {
  const room = sanitizeRoom({ ...DEFAULT_ROOM });
  it("recolours furniture and room finishes but never moves anything", () => {
    const style = getStyle("scandinavian")!;
    const items = [mk("sofa-3", { x: 2, z: 3 }), mk("coffee-table", { x: 2, z: 2 }), mk("fridge", { x: 4, z: 1 }), mk("sofa-2", { x: 1, z: 1, locked: true })];
    const r = restyle(items, room, style);
    expect(r.items.map((i) => [i.x, i.z, i.rotation])).toEqual(items.map((i) => [i.x, i.z, i.rotation]));
    expect(r.items[0].color).toBe(style.upholstery);
    expect(r.items[1].color).toBe(style.wood);
    expect(r.items[1].material).toBe("wood");
    expect(r.items[2].color).toBe(items[2].color); // appliances are left alone
    expect(r.items[3].color).toBe(items[3].color); // locked pieces keep their colour
    expect(r.room.wallColor).toBe(style.wall);
    expect(r.room.floorColor).toBe(style.floor);
    expect(r.changed).toBe(2);
  });

  it("uses leather for leather styles and respects the materials a piece allows", () => {
    const ind = getStyle("industrial")!;
    expect(styleFor("sofa-3", ind)?.material).toBe("leather");
    expect(styleFor("plant", ind)).toBeNull();
    for (const s of STYLES) {
      for (const id of ["sofa-3", "coffee-table", "kitchen-base", "floor-lamp", "rug", "armchair"]) {
        const st = styleFor(id, s)!;
        expect(getCatalogItem(id)!.materials).toContain(st.material);
      }
    }
  });
});

describe("photo analysis", () => {
  it("reads brightness, saturation and a palette from pixels", () => {
    const bright = analyzePixels(solid(245, 243, 238));
    expect(bright.brightness).toBeGreaterThan(0.9);
    expect(bright.saturation).toBeLessThan(0.15);
    expect(bright.palette.length).toBeGreaterThan(0);
    const dark = analyzePixels(solid(40, 42, 46));
    expect(dark.brightness).toBeLessThan(0.2);
  });

  it("maps typical colour profiles onto sensible styles", () => {
    const top = (d: Uint8ClampedArray) => scoreStyles(analyzePixels(d))[0].style.id;
    expect(["minimal", "scandinavian"]).toContain(top(solid(246, 245, 241)));
    expect(["industrial", "luxe", "modern"]).toContain(top(solid(52, 54, 58)));
    expect(["indian", "rustic", "midcentury", "boho", "japandi"]).toContain(top(solid(150, 100, 55)));
    expect(["coastal", "minimal", "scandinavian"]).toContain(top(solid(200, 225, 240)));
    const sum = scoreStyles(analyzePixels(solid(150, 100, 55))).reduce((s, x) => s + x.confidence, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("furniture suggestions", () => {
  const room = sanitizeRoom({ ...DEFAULT_ROOM, length: 5, width: 4 });
  it("starts with the anchor pieces of the room type and skips what is already there", () => {
    const style = getStyle("scandinavian")!;
    const empty = suggestFurniture("living", style, room, []);
    expect(empty[0].catalogId).toBe("sofa-3");
    expect(empty[0].color).toBe(style.upholstery);
    const withSofa = suggestFurniture("living", style, room, [mk("sofa-3")]);
    expect(withSofa.some((s) => s.catalogId === "sofa-3")).toBe(false);
    expect(suggestFurniture("pooja", undefined, room, []).map((s) => s.catalogId)).toContain("mandir");
  });

  it("does not suggest pieces that would swamp a tiny room", () => {
    const tiny = sanitizeRoom({ ...DEFAULT_ROOM, length: 2, width: 2 });
    const ids = suggestFurniture("living", undefined, tiny, []).map((s) => s.catalogId);
    expect(ids).not.toContain("sofa-3");
  });
});

describe("Claude response handling", () => {
  it("accepts well-formed structured output and drops anything invalid", () => {
    const text = JSON.stringify({
      roomType: "bedroom",
      style: "japandi",
      summary: "A calm bedroom.",
      palette: ["#aabbcc", "not-a-colour", "#123"],
      observations: ["Bed under the window"],
      suggestions: [
        { catalogId: "wardrobe", reason: "Storage", color: "#d8bf98" },
        { catalogId: "flying-carpet", reason: "Not in the catalogue", color: "#000000" },
        { catalogId: "wardrobe", reason: "duplicate", color: "#ffffff" },
        { catalogId: "bedside", reason: "Night table", color: "red" },
      ],
    });
    const r = parseAiResult(`Here you go:\n${text}`);
    expect(r.roomType).toBe("bedroom");
    expect(r.styleId).toBe("japandi");
    expect(r.palette).toEqual(["#aabbcc", "#123"]);
    expect(r.suggestions.map((s) => s.catalogId)).toEqual(["wardrobe", "bedside"]);
    expect(r.suggestions[1].color).toBeUndefined();
  });

  it("rejects non-JSON and tolerates unknown enums", () => {
    expect(() => parseAiResult("no json here")).toThrow(AiError);
    const r = parseAiResult(JSON.stringify({ roomType: "garage", style: "gothic", summary: 5, palette: "x", observations: null, suggestions: "none" }));
    expect(r.roomType).toBe("other");
    expect(r.styleId).toBeNull();
    expect(r.suggestions).toEqual([]);
  });

  it("builds a prompt and schema that only allow real catalogue ids", () => {
    const room = sanitizeRoom({ ...DEFAULT_ROOM });
    const p = buildPrompt({ roomHint: "living", room, existing: [mk("sofa-3")], wishes: "minimal" });
    expect(p).toContain("sofa-3 | Three-seater sofa");
    expect(p).toContain("Three-seater sofa");
    const schema = responseSchema();
    expect(schema.properties.suggestions.items.properties.catalogId.enum).toContain("mandir");
    expect(schema.required).toContain("suggestions");
  });
});
