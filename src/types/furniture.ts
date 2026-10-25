export type FurnitureCategory = "living" | "bedroom" | "dining" | "office" | "kitchen" | "bathroom" | "kids" | "outdoor" | "pooja" | "general";
export type MaterialKind = "fabric" | "leather" | "wood" | "metal" | "matte";
export type Orientation = "left" | "right";

export type ModelKey =
  | "sofa"
  | "lsofa"
  | "armchair"
  | "coffeeTable"
  | "tvUnit"
  | "sideTable"
  | "bookshelf"
  | "bed"
  | "bedsideTable"
  | "wardrobe"
  | "dressingTable"
  | "diningTable"
  | "diningChairs"
  | "sideboard"
  | "officeDesk"
  | "officeChair"
  | "storageCabinet"
  | "floorLamp"
  | "ceilingLight"
  | "rug"
  | "plant"
  | "decorCabinet"
  | "ottoman"
  | "chair"
  | "barStool"
  | "lDesk"
  | "drawers"
  | "fridge"
  | "stove"
  | "washer"
  | "kitchenBase"
  | "sink"
  | "wallCabinet"
  | "bathtub"
  | "shower"
  | "toilet"
  | "vanity"
  | "crib"
  | "bunkBed"
  | "mirror"
  | "coatStand"
  | "piano"
  | "shoeRack"
  | "tv"
  | "mandir"
  | "chowki"
  | "deepam"
  | "stairs"
  | "spiralStairs"
  | "appliance"
  | "ac"
  | "ceilingFan"
  | "standFan"
  | "beanbag"
  | "basket"
  | "screen"
  | "fireplace"
  | "jhula"
  | "curtain"
  | "treadmill"
  | "aquarium"
  | "rack"
  | "tree"
  | "grandClock"
  | "wallArt"
  | "glb";

/** An entry of the furniture catalogue. All lengths in metres. */
export interface CatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  /** Extra categories this item is also listed under in the catalogue. */
  alsoIn?: FurnitureCategory[];
  model: ModelKey;
  width: number;
  depth: number;
  height: number;
  defaultColor: string;
  materials: MaterialKind[];
  defaultMaterial: MaterialKind;
  defaultRotation: number;
  defaultOrientation: Orientation;
  /** Price placeholder for future inventory / quotation integration. */
  price: { amount: number | null; currency: string };
  /** Number of seats / pillows etc., interpreted by the model. */
  seats?: number;
  /** "ceiling" items hang from the ceiling instead of standing on the floor. */
  mount?: "floor" | "ceiling";
  /** Height of the underside above the floor for wall-hung pieces, metres. */
  elevation?: number;
  /** Flat or hanging items that must not trigger overlap warnings. */
  ignoreCollision?: boolean;
  /** Smallest allowed footprint when resizing, metres. */
  minSize: number;
  /** Optional future hook: URL of a GLB/GLTF model that replaces the procedural one. */
  glbUrl?: string;
  keywords: string[];
}

/** A catalogue item placed in a room. Position is the footprint centre, metres. */
export interface PlacedItem {
  id: string;
  catalogId: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Degrees, clockwise when viewed from above (matches the 2D editor). */
  rotation: number;
  color: string;
  material: MaterialKind;
  roughness: number;
  orientation: Orientation;
  /** Locked items cannot be dragged, resized or rotated by pointer. */
  locked?: boolean;
  /** Items sharing a groupId are selected and moved together. */
  groupId?: string;
  /** Procedural surface detail (wood grain, fabric weave…). Default on; false = flat colour. */
  detail?: boolean;
  /** User-supplied texture (data URL, downscaled). Overrides the procedural surface. */
  textureUrl?: string;
}
