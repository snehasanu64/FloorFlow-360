import type { CatalogItem, FurnitureCategory, MaterialKind } from "@/types/furniture";
import { MORE_DEFS } from "./catalog-more";

const cm = (n: number) => n / 100;

export type CatalogDef = {
  id: string;
  name: string;
  category: FurnitureCategory;
  alsoIn?: FurnitureCategory[];
  model: CatalogItem["model"];
  size: [number, number, number]; // width, depth, height in cm
  color: string;
  materials: MaterialKind[];
  seats?: number;
  mount?: "floor" | "ceiling";
  elevation?: number;
  ignoreCollision?: boolean;
  min?: number;
  keywords?: string[];
};

const upholstered: MaterialKind[] = ["fabric", "leather", "wood", "matte"];
const woodItem: MaterialKind[] = ["wood", "matte", "metal"];

const baseDefs: CatalogDef[] = [
  // Living room
  { id: "sofa-2", name: "Two-seater sofa", category: "living", model: "sofa", size: [160, 90, 85], color: "#8b8d90", materials: upholstered, seats: 2, keywords: ["couch", "loveseat"] },
  { id: "sofa-3", name: "Three-seater sofa", category: "living", model: "sofa", size: [220, 95, 85], color: "#8b8d90", materials: upholstered, seats: 3, keywords: ["couch"] },
  { id: "sofa-l", name: "L-shaped sofa", category: "living", model: "lsofa", size: [280, 180, 85], color: "#8b8d90", materials: upholstered, keywords: ["sectional", "corner", "couch"] },
  { id: "armchair", name: "Armchair", category: "living", model: "armchair", size: [85, 85, 85], color: "#1f3556", materials: upholstered, seats: 1, keywords: ["chair", "lounge"] },
  { id: "coffee-table", name: "Coffee table", category: "living", model: "coffeeTable", size: [110, 60, 42], color: "#c9a77c", materials: woodItem, keywords: ["centre table"] },
  { id: "tv-unit", name: "TV unit", category: "living", model: "tvUnit", size: [160, 40, 50], color: "#5e4231", materials: woodItem, keywords: ["media", "console", "television"] },
  { id: "side-table", name: "Side table", category: "living", model: "sideTable", size: [45, 45, 55], color: "#c9a77c", materials: woodItem, keywords: ["end table"] },
  { id: "bookshelf", name: "Bookshelf", category: "living", model: "bookshelf", size: [90, 30, 190], color: "#c9a77c", materials: woodItem, keywords: ["shelf", "books"] },
  // Bedroom
  { id: "bed-single", name: "Single bed", category: "bedroom", model: "bed", size: [100, 200, 90], color: "#d8c8aa", materials: upholstered, seats: 1, keywords: ["bed"] },
  { id: "bed-double", name: "Double bed", category: "bedroom", model: "bed", size: [150, 200, 95], color: "#d8c8aa", materials: upholstered, seats: 2, keywords: ["bed"] },
  { id: "bed-king", name: "King-size bed", category: "bedroom", model: "bed", size: [180, 210, 100], color: "#8b8d90", materials: upholstered, seats: 2, keywords: ["bed"] },
  { id: "bedside", name: "Bedside table", category: "bedroom", model: "bedsideTable", size: [45, 40, 50], color: "#c9a77c", materials: woodItem, keywords: ["nightstand"] },
  { id: "wardrobe", name: "Wardrobe", category: "bedroom", model: "wardrobe", size: [180, 60, 210], color: "#dcc8a2", materials: woodItem, keywords: ["closet"] },
  { id: "dressing-table", name: "Dressing table", category: "bedroom", model: "dressingTable", size: [110, 45, 140], color: "#f1efea", materials: woodItem, keywords: ["vanity", "mirror"] },
  // Dining
  { id: "dining-table", name: "Dining table", category: "dining", model: "diningTable", size: [160, 90, 75], color: "#9a6a3b", materials: woodItem, keywords: ["table"] },
  { id: "dining-chairs", name: "Dining chairs (pair)", category: "dining", model: "diningChairs", size: [100, 50, 90], color: "#9a6a3b", materials: ["wood", "fabric", "leather", "metal", "matte"], keywords: ["chair"] },
  { id: "sideboard", name: "Sideboard", category: "dining", model: "sideboard", size: [160, 45, 85], color: "#5e4231", materials: woodItem, keywords: ["buffet", "credenza"] },
  // Office
  { id: "office-desk", name: "Office desk", category: "office", model: "officeDesk", size: [140, 70, 75], color: "#dcc8a2", materials: woodItem, keywords: ["desk", "workstation"] },
  { id: "office-chair", name: "Office chair", category: "office", model: "officeChair", size: [60, 60, 95], color: "#1b1b1d", materials: ["fabric", "leather", "matte"], keywords: ["chair", "task"] },
  { id: "storage-cabinet", name: "Storage cabinet", category: "office", model: "storageCabinet", size: [80, 40, 120], color: "#8b8d90", materials: woodItem, keywords: ["filing", "cupboard"] },
  // General
  { id: "floor-lamp", name: "Floor lamp", category: "general", model: "floorLamp", size: [40, 40, 160], color: "#1b1b1d", materials: ["metal", "matte"], keywords: ["light"] },
  { id: "ceiling-light", name: "Ceiling light", category: "general", model: "ceilingLight", size: [50, 50, 35], color: "#f1efea", materials: ["metal", "matte"], mount: "ceiling", ignoreCollision: true, keywords: ["pendant", "light", "chandelier"] },
  { id: "rug", name: "Rug", category: "general", model: "rug", size: [200, 140, 2], color: "#b5654a", materials: ["fabric"], ignoreCollision: true, min: 0.4, keywords: ["carpet"] },
  { id: "plant", name: "Plant", category: "general", alsoIn: ["living", "outdoor", "bedroom"], model: "plant", size: [45, 45, 110], color: "#b5654a", materials: ["matte", "metal"], keywords: ["pot", "decor"] },
  { id: "decor-cabinet", name: "Decorative cabinet", category: "general", model: "decorCabinet", size: [80, 35, 140], color: "#6b7140", materials: woodItem, keywords: ["display", "curio"] },

  // More living / bedroom / dining / office
  { id: "ottoman", name: "Ottoman", category: "living", model: "ottoman", size: [60, 60, 42], color: "#b5654a", materials: upholstered, keywords: ["pouf", "footstool"] },
  { id: "console-table", name: "Console table", category: "living", model: "diningTable", size: [120, 35, 80], color: "#5e4231", materials: woodItem, keywords: ["hallway", "entry"] },
  { id: "piano", name: "Upright piano", category: "living", model: "piano", size: [150, 60, 120], color: "#1b1b1d", materials: ["wood", "matte"], keywords: ["music", "keyboard"] },
  { id: "chest-drawers", name: "Chest of drawers", category: "bedroom", model: "drawers", size: [90, 45, 100], color: "#dcc8a2", materials: woodItem, seats: 4, keywords: ["dresser"] },
  { id: "round-table", name: "Round dining table", category: "dining", model: "sideTable", size: [120, 120, 75], color: "#c9a77c", materials: woodItem, keywords: ["table"] },
  { id: "dining-chair", name: "Dining chair", category: "dining", model: "chair", size: [45, 50, 90], color: "#9a6a3b", materials: ["wood", "fabric", "leather", "metal", "matte"], keywords: ["chair"] },
  { id: "bar-stool", name: "Bar stool", category: "dining", model: "barStool", size: [40, 40, 75], color: "#1b1b1d", materials: ["metal", "leather", "matte"], keywords: ["counter", "stool"] },
  { id: "crockery-unit", name: "Crockery unit", category: "dining", model: "decorCabinet", size: [100, 40, 190], color: "#dcc8a2", materials: woodItem, keywords: ["display", "glass cabinet"] },
  { id: "l-desk", name: "L-shaped desk", category: "office", model: "lDesk", size: [160, 140, 75], color: "#dcc8a2", materials: woodItem, keywords: ["corner desk", "workstation"] },
  { id: "filing-cabinet", name: "Filing cabinet", category: "office", model: "drawers", size: [45, 60, 130], color: "#8b8d90", materials: ["metal", "matte", "wood"], seats: 4, keywords: ["drawers"] },
  { id: "meeting-table", name: "Meeting table", category: "office", model: "diningTable", size: [240, 120, 75], color: "#5e4231", materials: woodItem, keywords: ["conference", "boardroom"] },
  // Kitchen
  { id: "fridge", name: "Refrigerator", category: "kitchen", alsoIn: ["living"], model: "fridge", size: [70, 70, 180], color: "#c9ccd0", materials: ["metal", "matte"], keywords: ["fridge", "freezer"] },
  { id: "stove", name: "Cooker / stove", category: "kitchen", model: "stove", size: [60, 60, 90], color: "#2b2d31", materials: ["metal", "matte"], keywords: ["oven", "hob", "range"] },
  { id: "kitchen-base", name: "Base cabinet", category: "kitchen", model: "kitchenBase", size: [60, 60, 90], color: "#f1efea", materials: ["matte", "wood"], keywords: ["counter", "kitchen unit"] },
  { id: "kitchen-sink", name: "Sink unit", category: "kitchen", model: "sink", size: [120, 60, 90], color: "#f1efea", materials: ["matte", "wood"], keywords: ["basin", "counter"] },
  { id: "kitchen-island", name: "Kitchen island", category: "kitchen", model: "kitchenBase", size: [140, 80, 92], color: "#1f3556", materials: ["matte", "wood"], keywords: ["counter", "breakfast"] },
  { id: "wall-cabinet", name: "Wall cabinet", category: "kitchen", model: "wallCabinet", size: [80, 35, 70], color: "#f1efea", materials: ["matte", "wood"], elevation: 1.4, ignoreCollision: true, keywords: ["overhead", "cupboard"] },
  { id: "kitchen-table", name: "Kitchen table", category: "kitchen", model: "diningTable", size: [120, 70, 75], color: "#c9a77c", materials: woodItem, keywords: ["table"] },
  // Bathroom
  { id: "bathtub", name: "Bathtub", category: "bathroom", model: "bathtub", size: [170, 75, 55], color: "#f4f4f2", materials: ["matte"], keywords: ["bath"] },
  { id: "shower", name: "Shower enclosure", category: "bathroom", model: "shower", size: [90, 90, 200], color: "#f4f4f2", materials: ["matte"], keywords: ["cubicle"] },
  { id: "toilet", name: "Toilet", category: "bathroom", model: "toilet", size: [40, 70, 75], color: "#f4f4f2", materials: ["matte"], keywords: ["wc", "lavatory"] },
  { id: "vanity", name: "Vanity with basin", category: "bathroom", model: "vanity", size: [80, 50, 85], color: "#dcc8a2", materials: ["wood", "matte"], keywords: ["washbasin", "sink"] },
  { id: "washer", name: "Washing machine", category: "bathroom", alsoIn: ["kitchen"], model: "washer", size: [60, 60, 85], color: "#eceeef", materials: ["metal", "matte"], keywords: ["laundry"] },
  { id: "bath-cabinet", name: "Tall bathroom cabinet", category: "bathroom", model: "storageCabinet", size: [40, 30, 170], color: "#f1efea", materials: ["matte", "wood"], keywords: ["storage"] },
  // Kids room
  { id: "crib", name: "Baby crib", category: "kids", model: "crib", size: [70, 130, 95], color: "#f1efea", materials: ["wood", "matte"], keywords: ["cot", "baby"] },
  { id: "kids-bed", name: "Kids bed", category: "kids", model: "bed", size: [90, 190, 65], color: "#9aae96", materials: upholstered, seats: 1, keywords: ["bed", "child"] },
  { id: "bunk-bed", name: "Bunk bed", category: "kids", model: "bunkBed", size: [100, 200, 170], color: "#c9a77c", materials: ["wood", "matte"], keywords: ["bed", "double decker"] },
  { id: "kids-desk", name: "Study desk", category: "kids", model: "officeDesk", size: [110, 55, 70], color: "#f1efea", materials: woodItem, keywords: ["homework"] },
  { id: "toy-storage", name: "Toy storage", category: "kids", model: "storageCabinet", size: [100, 35, 65], color: "#d8c8aa", materials: ["matte", "wood"], keywords: ["toys"] },
  // Outdoor / balcony
  { id: "outdoor-chair", name: "Outdoor chair", category: "outdoor", model: "chair", size: [55, 55, 85], color: "#3b3d41", materials: ["metal", "wood", "matte"], keywords: ["patio", "garden", "balcony"] },
  { id: "outdoor-table", name: "Outdoor table", category: "outdoor", model: "sideTable", size: [90, 90, 75], color: "#3b3d41", materials: ["metal", "wood", "matte"], keywords: ["patio", "garden", "balcony"] },
  { id: "garden-bench", name: "Garden bench", category: "outdoor", model: "diningTable", size: [150, 45, 45], color: "#9a6a3b", materials: ["wood", "metal"], keywords: ["seat", "patio"] },
  { id: "planter", name: "Large planter", category: "outdoor", model: "plant", size: [60, 60, 120], color: "#6f4a32", materials: ["matte", "metal"], keywords: ["plant", "pot"] },
  // Stairs (height = floor to floor; edit it if your storeys are taller)
  { id: "stairs", name: "Straight staircase", category: "general", alsoIn: ["living"], model: "stairs", size: [100, 300, 300], color: "#9a6a3b", materials: ["wood", "matte", "metal"], ignoreCollision: false, keywords: ["steps", "stairway", "floor"] },
  { id: "spiral-stairs", name: "Spiral staircase", category: "general", alsoIn: ["living"], model: "spiralStairs", size: [160, 160, 300], color: "#2b2d31", materials: ["metal", "wood", "matte"], keywords: ["steps", "stairway", "circular"] },
  // General extras
  { id: "bench", name: "Bench", category: "general", model: "diningTable", size: [120, 40, 45], color: "#c9a77c", materials: woodItem, keywords: ["seat", "hallway"] },
  { id: "standing-mirror", name: "Standing mirror", category: "general", alsoIn: ["bedroom"], model: "mirror", size: [60, 30, 170], color: "#5e4231", materials: ["wood", "metal", "matte"], keywords: ["full length"] },
  { id: "coat-stand", name: "Coat stand", category: "general", alsoIn: ["living"], model: "coatStand", size: [40, 40, 175], color: "#1b1b1d", materials: ["metal", "wood", "matte"], keywords: ["hallway", "hanger"] },
  { id: "shoe-rack", name: "Shoe rack", category: "general", alsoIn: ["living"], model: "shoeRack", size: [80, 30, 60], color: "#c9a77c", materials: woodItem, keywords: ["hallway", "shoes"] },

  // Television
  { id: "tv", name: "Television (on stand)", category: "living", alsoIn: ["bedroom"], model: "tv", size: [124, 22, 78], color: "#141416", materials: ["matte", "metal"], keywords: ["tv", "led", "screen", "display"] },
  { id: "tv-wall", name: "Wall-mounted TV", category: "living", alsoIn: ["bedroom"], model: "tv", size: [124, 6, 72], color: "#141416", materials: ["matte", "metal"], seats: 1, elevation: 0.9, ignoreCollision: true, keywords: ["tv", "led", "screen", "wall mount"] },
  // Pooja room
  { id: "mandir", name: "Pooja mandir (floor)", category: "pooja", model: "mandir", size: [90, 40, 175], color: "#8a4b34", materials: ["wood", "matte"], keywords: ["temple", "puja", "prayer", "mandap"] },
  { id: "mandir-wall", name: "Wall-mounted mandir", category: "pooja", model: "mandir", size: [60, 28, 80], color: "#8a4b34", materials: ["wood", "matte"], seats: 1, elevation: 1.2, ignoreCollision: true, keywords: ["temple", "puja", "prayer"] },
  { id: "chowki", name: "Pooja chowki / seat", category: "pooja", model: "chowki", size: [60, 60, 18], color: "#9a6a3b", materials: ["wood", "matte"], keywords: ["puja", "prayer", "stool", "asan"] },
  { id: "deepam", name: "Deepam / lamp stand", category: "pooja", model: "deepam", size: [32, 32, 110], color: "#c9a227", materials: ["metal"], keywords: ["diya", "lamp", "brass", "puja"] },
  { id: "pooja-cabinet", name: "Pooja storage cabinet", category: "pooja", model: "storageCabinet", size: [60, 35, 90], color: "#8a4b34", materials: ["wood", "matte"], keywords: ["puja", "storage"] },
  { id: "pooja-mat", name: "Pooja mat", category: "pooja", model: "rug", size: [90, 90, 2], color: "#a8322d", materials: ["fabric"], ignoreCollision: true, min: 0.3, keywords: ["puja", "carpet", "asan"] },
  { id: "pooja-plant", name: "Tulsi plant", category: "pooja", alsoIn: ["outdoor"], model: "plant", size: [40, 40, 90], color: "#b5654a", materials: ["matte"], keywords: ["tulsi", "basil", "plant"] },
];

const defs: CatalogDef[] = [...baseDefs, ...MORE_DEFS];

export const FURNITURE_CATALOG: CatalogItem[] = defs.map((d) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  alsoIn: d.alsoIn,
  model: d.model,
  width: cm(d.size[0]),
  depth: cm(d.size[1]),
  height: cm(d.size[2]),
  defaultColor: d.color,
  materials: d.materials,
  defaultMaterial: d.materials[0],
  defaultRotation: 0,
  defaultOrientation: "right",
  price: { amount: null, currency: "USD" },
  seats: d.seats,
  mount: d.mount ?? "floor",
  elevation: d.elevation,
  ignoreCollision: d.ignoreCollision,
  minSize: d.min ?? Math.min(0.15, d.size[0] / 100, d.size[1] / 100),
  keywords: d.keywords ?? [],
}));

const byId = new Map(FURNITURE_CATALOG.map((c) => [c.id, c]));
/** Models uploaded by the user (GLB). Registered at runtime; see lib/custom-models.ts. */
const customById = new Map<string, CatalogItem>();
export const getCatalogItem = (id: string) => byId.get(id) ?? customById.get(id);
export const listCustomModels = () => [...customById.values()];

export function registerCustomModel(m: { id: string; name: string; width: number; depth: number; height: number; color: string }) {
  customById.set(m.id, {
    id: m.id,
    name: m.name,
    category: "general",
    model: "glb",
    width: m.width,
    depth: m.depth,
    height: m.height,
    defaultColor: m.color,
    materials: ["matte"],
    defaultMaterial: "matte",
    defaultRotation: 0,
    defaultOrientation: "right",
    price: { amount: null, currency: "USD" },
    minSize: 0.05,
    keywords: ["custom", "uploaded", "glb"],
  });
}
export function unregisterCustomModel(id: string) {
  customById.delete(id);
}

export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  living: "Living room",
  bedroom: "Bedroom",
  dining: "Dining room",
  office: "Office",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  kids: "Kids room",
  outdoor: "Outdoor / balcony",
  pooja: "Pooja room",
  general: "General",
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as FurnitureCategory[];
