import { getCatalogItem } from "@/data/furniture-catalog";
import type { PlacedItem } from "@/types/furniture";
import type { RoomConfig } from "@/types/room";
import { itemBounds } from "./geometry";
import { getRoomPolygon } from "./geometry";
import { polygonEdges, type P2 } from "./roomShape";

/**
 * Vastu Shastra layout hints. These are widely quoted *general guidelines* and are shown for
 * inspiration only — they are not professional advice, and traditions differ.
 */
export type Dir8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type Zone = Dir8 | "C";
export type CheckStatus = "good" | "warn" | "info";

export interface VastuCheck {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
  itemIds: string[];
}

export const DIR_NAMES: Record<Dir8, string> = {
  N: "North",
  NE: "North-east",
  E: "East",
  SE: "South-east",
  S: "South",
  SW: "South-west",
  W: "West",
  NW: "North-west",
};
const ORDER: Dir8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Compass direction of a plan vector, given the angle of true north measured clockwise from the top of the plan. */
export function directionOf(v: P2, northAngle = 0): Dir8 {
  let deg = (Math.atan2(v.x, -v.z) * 180) / Math.PI - northAngle;
  deg = ((deg % 360) + 360) % 360;
  return ORDER[Math.round(deg / 45) % 8];
}

/** Direction the front (local +z) of an item points to. */
export const frontVector = (rotationDeg: number): P2 => {
  const a = (rotationDeg * Math.PI) / 180;
  return { x: -Math.sin(a), z: Math.cos(a) };
};

function centroid(room: RoomConfig): P2 {
  const poly = getRoomPolygon(room);
  // area centroid
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.z - q.x * p.z;
    a += f;
    cx += (p.x + q.x) * f;
    cz += (p.z + q.z) * f;
  }
  a /= 2;
  return Math.abs(a) < 1e-9 ? { x: room.length / 2, z: room.width / 2 } : { x: cx / (6 * a), z: cz / (6 * a) };
}

/** Zone of a point relative to the middle of the room (the central ~25 % is the Brahmasthan). */
export function zoneOf(p: P2, room: RoomConfig): Zone {
  const c = centroid(room);
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  if (Math.abs(dx) < room.length * 0.12 && Math.abs(dz) < room.width * 0.12) return "C";
  return directionOf({ x: dx, z: dz }, room.northAngle);
}

const zoneName = (z: Zone) => (z === "C" ? "the centre" : `the ${DIR_NAMES[z]}`);

interface Rule {
  ids: string[];
  /** Ideal, acceptable and discouraged zones. */
  good: Zone[];
  ok?: Zone[];
  bad?: Zone[];
  label: string;
  why: string;
  /** Direction a person using the piece faces (opposite of the item's front), or the way the item faces. */
  person?: { good: Dir8[]; label: string };
  head?: { good: Dir8[]; label: string };
}

const RULES: Rule[] = [
  {
    ids: ["mandir", "mandir-wall"],
    good: ["NE"],
    ok: ["N", "E"],
    bad: ["SW", "S", "SE", "W", "NW", "C"],
    label: "Pooja mandir",
    why: "The north-east (Ishanya) is associated with the divine; avoid the south and south-west.",
    person: { good: ["E", "N", "NE"], label: "Worshipper faces" },
  },
  {
    ids: ["chowki", "deepam", "pooja-mat"],
    good: ["NE", "N", "E"],
    bad: ["SW", "S", "SE", "C"],
    label: "Pooja seating / lamp",
    why: "Keep prayer items in the north-east part of the room.",
  },
  {
    ids: ["stove"],
    good: ["SE"],
    ok: ["NW"],
    bad: ["NE", "N", "SW", "C"],
    label: "Cooker",
    why: "The south-east (Agni corner) suits the fire element; avoid the north-east.",
    person: { good: ["E"], label: "Cook faces" },
  },
  {
    ids: ["kitchen-sink"],
    good: ["NE", "N"],
    ok: ["E", "NW"],
    bad: ["SE", "SW", "C"],
    label: "Kitchen sink",
    why: "Water belongs to the north / north-east; keep it away from the cooker.",
  },
  {
    ids: ["fridge"],
    good: ["NW", "W"],
    ok: ["S", "SW", "N"],
    bad: ["NE", "C", "SE"],
    label: "Refrigerator",
    why: "Usually placed in the north-west or west; avoid the north-east and south-east.",
  },
  {
    ids: ["bed-single", "bed-double", "bed-king", "kids-bed", "bunk-bed"],
    good: ["SW"],
    ok: ["S", "W", "NW"],
    bad: ["NE", "C"],
    label: "Bed",
    why: "A master bed in the south-west gives stability; avoid the north-east and the centre.",
    head: { good: ["S", "E"], label: "Head points" },
  },
  {
    ids: ["wardrobe", "storage-cabinet", "chest-drawers", "filing-cabinet", "sofa-3", "sofa-l", "bookshelf"],
    good: ["SW", "S", "W"],
    ok: ["NW", "SE"],
    bad: ["NE", "C"],
    label: "Heavy furniture",
    why: "Heavy pieces are traditionally kept in the south-west / west; keep the north-east light.",
  },
  {
    ids: ["toilet"],
    good: ["NW", "W"],
    ok: ["S"],
    bad: ["NE", "E", "C", "SW"],
    label: "Toilet",
    why: "The north-west or west is preferred; avoid the north-east and the centre.",
  },
  {
    ids: ["dining-table", "round-table", "kitchen-table"],
    good: ["W", "E", "N"],
    ok: ["NW", "SE"],
    bad: ["SW", "C"],
    label: "Dining table",
    why: "Dining areas are commonly placed in the west (or east / north) of the home.",
  },
  {
    ids: ["office-desk", "l-desk", "kids-desk"],
    good: ["N", "E", "NE", "W"],
    bad: ["SW", "C"],
    label: "Study / work desk",
    why: "North, east or west placement supports focus.",
    person: { good: ["N", "E", "NE"], label: "Person faces" },
  },
  {
    ids: ["plant", "planter", "pooja-plant"],
    good: ["NE", "E", "N"],
    bad: ["SW"],
    label: "Plants",
    why: "Greenery thrives in the north-east / east; avoid dense planting in the south-west.",
  },
];

const dirList = (d: Dir8[]) => d.map((x) => DIR_NAMES[x]).join(" / ");

/** Evaluates the placed items and doors against the Vastu guidelines above. */
export function vastuReport(items: PlacedItem[], room: RoomConfig): VastuCheck[] {
  const checks: VastuCheck[] = [];
  const north = room.northAngle;

  for (const it of items) {
    const cat = getCatalogItem(it.catalogId);
    const rule = RULES.find((r) => r.ids.includes(it.catalogId));
    if (!rule || !cat) continue;
    const z = zoneOf({ x: it.x, z: it.z }, room);
    const where = zoneName(z);
    if (rule.good.includes(z)) {
      checks.push({ id: `${it.id}-zone`, status: "good", title: `${it.name}: well placed`, detail: `In ${where} — ${rule.why}`, itemIds: [it.id] });
    } else if (rule.bad?.includes(z)) {
      checks.push({
        id: `${it.id}-zone`,
        status: "warn",
        title: `${it.name}: consider moving`,
        detail: `Currently in ${where}. Better: ${dirList(rule.good as Dir8[])}. ${rule.why}`,
        itemIds: [it.id],
      });
    } else {
      checks.push({
        id: `${it.id}-zone`,
        status: "info",
        title: `${it.name}: acceptable`,
        detail: `In ${where}. Ideal: ${dirList(rule.good as Dir8[])}.`,
        itemIds: [it.id],
      });
    }
    const f = frontVector(it.rotation);
    if (rule.person) {
      const dir = directionOf({ x: -f.x, z: -f.z }, north);
      const good = rule.person.good.includes(dir);
      checks.push({
        id: `${it.id}-person`,
        status: good ? "good" : "info",
        title: `${it.name}: ${rule.person.label.toLowerCase()} ${DIR_NAMES[dir]}`,
        detail: good ? "A favourable facing direction." : `Preferred: ${dirList(rule.person.good)}. Rotate the piece to change it.`,
        itemIds: [it.id],
      });
    }
    if (rule.head) {
      // the headboard is at the back of the bed, i.e. opposite its front
      const back = directionOf({ x: -f.x, z: -f.z }, north);
      const good = rule.head.good.includes(back);
      checks.push({
        id: `${it.id}-head`,
        status: good ? "good" : "warn",
        title: `${it.name}: head points ${DIR_NAMES[back]}`,
        detail: good ? "Sleeping with the head to the south or east is recommended." : "Head to the south or east is recommended; avoid north.",
        itemIds: [it.id],
      });
    }
  }

  // cooker next to sink
  const stove = items.find((i) => i.catalogId === "stove");
  const sink = items.find((i) => i.catalogId === "kitchen-sink");
  if (stove && sink && Math.hypot(stove.x - sink.x, stove.z - sink.z) < 0.9) {
    checks.push({
      id: "stove-sink",
      status: "warn",
      title: "Cooker and sink are very close",
      detail: "Fire and water elements are traditionally kept apart — leave some counter space between them.",
      itemIds: [stove.id, sink.id],
    });
  }

  // mirrors facing a bed
  const beds = items.filter((i) => getCatalogItem(i.catalogId)?.model === "bed" || i.catalogId === "bunk-bed");
  for (const m of items.filter((i) => ["standing-mirror", "dressing-table"].includes(i.catalogId))) {
    const f = frontVector(m.rotation);
    for (const b of beds) {
      const dx = b.x - m.x;
      const dz = b.z - m.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1 && dist < 4 && (f.x * dx + f.z * dz) / dist > 0.85) {
        checks.push({
          id: `${m.id}-${b.id}-mirror`,
          status: "warn",
          title: `${m.name} faces the bed`,
          detail: "A mirror reflecting the bed is best avoided — rotate it or cover it at night.",
          itemIds: [m.id, b.id],
        });
      }
    }
  }

  // open centre (Brahmasthan)
  const c = centroid(room);
  const blocking = items.filter((i) => {
    if (getCatalogItem(i.catalogId)?.ignoreCollision) return false;
    const b = itemBounds(i);
    return c.x > b.minX + 0.05 && c.x < b.maxX - 0.05 && c.z > b.minZ + 0.05 && c.z < b.maxZ - 0.05 && i.height > 0.5;
  });
  if (blocking.length) {
    checks.push({
      id: "centre",
      status: "warn",
      title: "The centre of the room is blocked",
      detail: `${blocking.map((i) => i.name).join(", ")} stands in the Brahmasthan. Keep the centre open and light.`,
      itemIds: blocking.map((i) => i.id),
    });
  } else if (items.length) {
    checks.push({ id: "centre", status: "good", title: "The centre of the room is open", detail: "The Brahmasthan is free of heavy furniture.", itemIds: [] });
  }

  // main door direction
  const edges = polygonEdges(getRoomPolygon(room));
  const door = room.openings.find((o) => o.type === "door");
  if (door && edges[door.edge]) {
    const dir = directionOf(edges[door.edge].normal, north);
    const good: Dir8[] = ["N", "NE", "E"];
    const bad: Dir8[] = ["SW", "S"];
    checks.push({
      id: "door",
      status: good.includes(dir) ? "good" : bad.includes(dir) ? "warn" : "info",
      title: `Door faces ${DIR_NAMES[dir]}`,
      detail: good.includes(dir)
        ? "North, north-east and east entrances are considered auspicious."
        : bad.includes(dir)
          ? "South and south-west entrances are usually discouraged."
          : "Acceptable; north, north-east or east are preferred.",
      itemIds: [],
    });
  }
  return checks;
}

export function vastuScore(checks: VastuCheck[]) {
  const good = checks.filter((c) => c.status === "good").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  return { good, warn, pct: good + warn === 0 ? null : Math.round((good / (good + warn)) * 100) };
}
