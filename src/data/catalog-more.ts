import type { CatalogDef } from "./furniture-catalog";

const upholstered = ["fabric", "leather", "wood", "matte"] as const;
const woodItem = ["wood", "matte", "metal"] as const;
const metalItem = ["metal", "matte"] as const;
const m = (a: readonly string[]) => [...a] as CatalogDef["materials"];


/**
 * A–Z of everyday household items. Models are shared where the shape is genuinely the same (a pantry
 * is a tall storage cabinet, a bar counter is a base cabinet…); anything else can be imported as a GLB.
 */
export const MORE_DEFS: CatalogDef[] = [
  // ---- Living room
  { id: "chaise-lounge", name: "Chaise lounge", category: "living", model: "sofa", size: [170, 70, 80], color: "#8b8d90", materials: m(upholstered), seats: 1, keywords: ["daybed", "lounger"] },
  { id: "recliner", name: "Recliner chair", category: "living", model: "armchair", size: [90, 95, 100], color: "#6f4a32", materials: ["leather", "fabric", "wood", "matte"], seats: 1, keywords: ["lounge chair", "massage chair", "zero gravity"] },
  { id: "rocking-chair", name: "Rocking chair", category: "living", alsoIn: ["bedroom", "kids"], model: "chair", size: [60, 85, 95], color: "#9a6a3b", materials: ["wood", "fabric", "matte"], keywords: ["nursing chair", "nursery"] },
  { id: "sofa-cum-bed", name: "Sofa-cum-bed (futon)", category: "living", alsoIn: ["bedroom"], model: "sofa", size: [190, 90, 85], color: "#6d7076", materials: m(upholstered), seats: 2, keywords: ["futon", "sofa bed"] },
  { id: "bean-bag", name: "Bean bag", category: "living", alsoIn: ["kids"], model: "beanbag", size: [80, 80, 70], color: "#b5654a", materials: ["fabric", "leather"], keywords: ["bean bag", "pouf", "lounger"] },
  { id: "floor-cushion", name: "Floor cushion", category: "living", model: "beanbag", size: [60, 60, 15], color: "#4c7a6a", materials: ["fabric"], keywords: ["meditation", "yoga", "seat"] },
  { id: "magazine-rack", name: "Magazine rack", category: "living", model: "storageCabinet", size: [40, 25, 50], color: "#c9a77c", materials: m(woodItem), keywords: ["newspaper"] },
  { id: "room-divider", name: "Room divider screen", category: "living", alsoIn: ["bedroom"], model: "screen", size: [160, 30, 170], color: "#9a6a3b", materials: ["wood", "fabric", "matte"], keywords: ["partition", "folding screen"] },
  { id: "fireplace", name: "Fireplace", category: "living", model: "fireplace", size: [140, 45, 110], color: "#e8e2d5", materials: ["matte", "wood"], keywords: ["hearth", "mantel", "chimney"] },
  { id: "curtain", name: "Curtain", category: "living", alsoIn: ["bedroom", "dining", "kids"], model: "curtain", size: [140, 15, 250], color: "#d8c8aa", materials: ["fabric"], ignoreCollision: true, keywords: ["drape", "window"] },
  { id: "ceiling-fan", name: "Ceiling fan", category: "living", alsoIn: ["bedroom", "dining", "kids", "office"], model: "ceilingFan", size: [120, 120, 40], color: "#f1efea", materials: m(metalItem), mount: "ceiling", ignoreCollision: true, keywords: ["fan"] },
  { id: "wall-ac", name: "Split air conditioner", category: "living", alsoIn: ["bedroom", "office", "kids"], model: "ac", size: [90, 22, 30], color: "#f4f4f2", materials: ["matte"], elevation: 2.0, ignoreCollision: true, keywords: ["ac", "air conditioning", "cooling"] },
  { id: "standing-fan", name: "Pedestal fan", category: "living", alsoIn: ["bedroom", "office"], model: "standFan", size: [45, 45, 120], color: "#d6d3cd", materials: m(metalItem), keywords: ["stand fan", "cooler"] },
  { id: "air-cooler", name: "Air cooler", category: "living", alsoIn: ["bedroom"], model: "appliance", size: [50, 40, 85], color: "#c9ccd0", materials: ["matte", "metal"], seats: 4, keywords: ["desert cooler", "evaporative"] },
  { id: "grandfather-clock", name: "Grandfather clock", category: "living", model: "grandClock", size: [45, 30, 200], color: "#5e4231", materials: m(woodItem), keywords: ["pendulum", "long case"] },
  { id: "aquarium", name: "Aquarium on stand", category: "living", model: "aquarium", size: [100, 40, 130], color: "#2b2d31", materials: ["wood", "matte"], keywords: ["fish tank", "pet"] },
  { id: "music-system", name: "Floor speaker", category: "living", model: "appliance", size: [28, 28, 100], color: "#1b1b1d", materials: ["wood", "matte"], seats: 3, keywords: ["audio", "hifi", "home theatre"] },

  // ---- Bedroom
  { id: "daybed", name: "Daybed", category: "bedroom", model: "bed", size: [100, 200, 80], color: "#d8c8aa", materials: m(upholstered), seats: 1, keywords: ["divan"] },
  { id: "dressing-stool", name: "Dressing stool", category: "bedroom", model: "ottoman", size: [45, 35, 45], color: "#b5654a", materials: m(upholstered), keywords: ["vanity stool"] },
  { id: "clothes-rack", name: "Clothes rack", category: "bedroom", alsoIn: ["general"], model: "rack", size: [120, 45, 170], color: "#1b1b1d", materials: m(metalItem), keywords: ["garment rail", "hanger"] },
  { id: "storage-trunk", name: "Blanket chest / trunk", category: "bedroom", alsoIn: ["living", "general"], model: "storageCabinet", size: [100, 45, 50], color: "#6f4a32", materials: m(woodItem), keywords: ["trunk", "ottoman storage"] },
  { id: "tallboy", name: "Tallboy chest", category: "bedroom", model: "drawers", size: [60, 45, 130], color: "#dcc8a2", materials: m(woodItem), seats: 5, keywords: ["lingerie chest", "dresser"] },
  { id: "armoire", name: "Armoire", category: "bedroom", model: "wardrobe", size: [120, 55, 200], color: "#5e4231", materials: m(woodItem), keywords: ["cupboard"] },
  { id: "sliding-wardrobe", name: "Sliding wardrobe", category: "bedroom", model: "wardrobe", size: [240, 65, 230], color: "#f1efea", materials: m(woodItem), keywords: ["built-in wardrobe", "closet"] },
  { id: "laundry-basket", name: "Laundry basket", category: "bedroom", alsoIn: ["bathroom"], model: "basket", size: [40, 40, 55], color: "#c9a77c", materials: ["matte", "wood"], keywords: ["hamper", "clothes"] },
  { id: "safe-locker", name: "Safe / locker", category: "bedroom", alsoIn: ["office"], model: "storageCabinet", size: [45, 45, 60], color: "#3b3d41", materials: m(metalItem), keywords: ["vault", "strongbox"] },

  // ---- Dining
  { id: "bar-counter", name: "Bar counter", category: "dining", alsoIn: ["kitchen"], model: "kitchenBase", size: [180, 55, 105], color: "#5e4231", materials: ["wood", "matte"], keywords: ["breakfast bar", "pub"] },
  { id: "bar-cabinet", name: "Bar cabinet", category: "dining", alsoIn: ["living"], model: "decorCabinet", size: [80, 40, 150], color: "#3b3430", materials: m(woodItem), keywords: ["liquor", "wine cabinet"] },
  { id: "serving-trolley", name: "Tea / serving trolley", category: "dining", alsoIn: ["kitchen", "living"], model: "kitchenBase", size: [75, 40, 80], color: "#c9a77c", materials: ["wood", "matte"], keywords: ["bar cart", "tea trolley"] },
  { id: "dining-bench", name: "Dining bench", category: "dining", model: "diningTable", size: [140, 38, 45], color: "#9a6a3b", materials: m(woodItem), keywords: ["bench seat"] },
  { id: "wine-rack", name: "Wine rack", category: "dining", alsoIn: ["kitchen"], model: "shoeRack", size: [60, 30, 110], color: "#6f4a32", materials: m(woodItem), keywords: ["bottle"] },

  // ---- Office
  { id: "standing-desk", name: "Standing desk", category: "office", model: "officeDesk", size: [140, 70, 110], color: "#dcc8a2", materials: m(woodItem), keywords: ["sit-stand", "height adjustable"] },
  { id: "computer-desk", name: "Computer desk", category: "office", model: "officeDesk", size: [120, 60, 75], color: "#8b8d90", materials: m(woodItem), keywords: ["pc table", "laptop table"] },
  { id: "printer-stand", name: "Printer stand", category: "office", model: "storageCabinet", size: [60, 45, 70], color: "#dcc8a2", materials: m(woodItem), keywords: ["copier"] },
  { id: "library-shelf", name: "Library bookcase", category: "office", alsoIn: ["living"], model: "bookshelf", size: [120, 35, 220], color: "#5e4231", materials: m(woodItem), keywords: ["books", "shelves"] },
  { id: "reception-desk", name: "Reception desk", category: "office", model: "kitchenBase", size: [200, 70, 105], color: "#f1efea", materials: ["matte", "wood"], keywords: ["front desk", "counter"] },
  { id: "sewing-table", name: "Sewing machine table", category: "office", alsoIn: ["general"], model: "officeDesk", size: [100, 50, 75], color: "#c9a77c", materials: m(woodItem), keywords: ["tailor", "craft"] },
  { id: "workbench", name: "Workbench", category: "general", model: "officeDesk", size: [150, 60, 90], color: "#6f4a32", materials: m(woodItem), keywords: ["garage", "tools", "workshop"] },

  // ---- Kitchen & appliances
  { id: "dishwasher", name: "Dishwasher", category: "kitchen", model: "appliance", size: [60, 60, 85], color: "#c9ccd0", materials: ["metal", "matte"], seats: 1, keywords: ["dish washer"] },
  { id: "oven-tower", name: "Built-in oven tower", category: "kitchen", model: "appliance", size: [60, 60, 200], color: "#2b2d31", materials: ["metal", "matte"], seats: 1, keywords: ["microwave", "oven"] },
  { id: "mini-fridge", name: "Mini fridge", category: "kitchen", alsoIn: ["bedroom", "office"], model: "fridge", size: [50, 50, 85], color: "#c9ccd0", materials: ["metal", "matte"], keywords: ["bar fridge", "compact"] },
  { id: "fridge-double", name: "Side-by-side fridge", category: "kitchen", model: "fridge", size: [90, 70, 180], color: "#8b8d90", materials: ["metal", "matte"], keywords: ["french door", "double door"] },
  { id: "pantry-cabinet", name: "Pantry cabinet", category: "kitchen", model: "storageCabinet", size: [80, 55, 210], color: "#f1efea", materials: ["matte", "wood"], keywords: ["larder", "grocery"] },
  { id: "kitchen-trolley", name: "Kitchen trolley", category: "kitchen", model: "kitchenBase", size: [60, 40, 85], color: "#c9a77c", materials: ["wood", "matte"], keywords: ["cart", "utility cart"] },
  { id: "chimney", name: "Kitchen chimney / hood", category: "kitchen", model: "wallCabinet", size: [90, 50, 70], color: "#8b8d90", materials: m(metalItem), elevation: 1.6, ignoreCollision: true, keywords: ["exhaust", "range hood"] },
  { id: "water-purifier", name: "Water purifier", category: "kitchen", model: "appliance", size: [40, 20, 50], color: "#f4f4f2", materials: ["matte"], seats: 3, elevation: 1.1, ignoreCollision: true, keywords: ["ro", "filter"] },
  { id: "water-dispenser", name: "Water dispenser", category: "kitchen", alsoIn: ["office"], model: "appliance", size: [35, 35, 110], color: "#f4f4f2", materials: ["matte", "metal"], seats: 2, keywords: ["cooler", "water cooler"] },
  { id: "dustbin", name: "Dustbin", category: "kitchen", alsoIn: ["bathroom", "outdoor", "office"], model: "basket", size: [35, 35, 60], color: "#8b8d90", materials: m(metalItem), keywords: ["trash", "waste"] },

  // ---- Bathroom
  { id: "bidet", name: "Bidet", category: "bathroom", model: "toilet", size: [38, 55, 40], color: "#f4f4f2", materials: ["matte"], keywords: ["wash"] },
  { id: "geyser", name: "Water heater (geyser)", category: "bathroom", model: "appliance", size: [35, 35, 55], color: "#f4f4f2", materials: ["matte", "metal"], seats: 3, elevation: 1.7, ignoreCollision: true, keywords: ["boiler", "hot water"] },
  { id: "towel-stand", name: "Towel stand", category: "bathroom", model: "coatStand", size: [35, 35, 110], color: "#c9ccd0", materials: m(metalItem), keywords: ["rail", "rack"] },
  { id: "bath-stool", name: "Bath stool", category: "bathroom", model: "ottoman", size: [35, 30, 35], color: "#f1efea", materials: ["matte", "wood"], keywords: ["shower stool"] },

  // ---- Kids
  { id: "baby-changer", name: "Baby changing table", category: "kids", alsoIn: ["bedroom"], model: "drawers", size: [90, 50, 95], color: "#f1efea", materials: m(woodItem), seats: 3, keywords: ["nursery", "diaper"] },
  { id: "cradle", name: "Cradle", category: "kids", model: "crib", size: [55, 95, 75], color: "#d8c8aa", materials: ["wood", "matte"], keywords: ["bassinet", "baby"] },
  { id: "high-chair", name: "High chair", category: "kids", alsoIn: ["dining"], model: "barStool", size: [40, 40, 85], color: "#f1efea", materials: ["wood", "matte", "metal"], keywords: ["baby chair", "feeding"] },
  { id: "kids-wardrobe", name: "Kids wardrobe", category: "kids", model: "wardrobe", size: [100, 50, 150], color: "#9aae96", materials: m(woodItem), keywords: ["closet"] },
  { id: "kids-table", name: "Kids activity table", category: "kids", model: "diningTable", size: [80, 60, 50], color: "#f1efea", materials: m(woodItem), keywords: ["play table", "craft"] },
  { id: "kids-chair", name: "Kids chair", category: "kids", model: "chair", size: [30, 30, 55], color: "#b5654a", materials: ["wood", "matte"], keywords: ["small chair"] },
  { id: "kids-bookshelf", name: "Kids bookshelf", category: "kids", model: "bookshelf", size: [80, 30, 110], color: "#d8c8aa", materials: m(woodItem), keywords: ["picture books"] },

  // ---- Outdoor / balcony / utility
  { id: "sun-lounger", name: "Sun lounger", category: "outdoor", model: "diningTable", size: [60, 190, 40], color: "#d8c8aa", materials: ["wood", "metal"], keywords: ["deck chair", "pool"] },
  { id: "bbq-grill", name: "BBQ grill", category: "outdoor", model: "stove", size: [80, 50, 95], color: "#2b2d31", materials: m(metalItem), keywords: ["barbecue", "tandoor"] },
  { id: "jhula", name: "Jhula (Indian swing)", category: "outdoor", alsoIn: ["living"], model: "jhula", size: [150, 60, 200], color: "#8a4b34", materials: ["wood", "metal"], keywords: ["indian swing", "hanging seat"] },
  { id: "umbrella-stand", name: "Umbrella stand", category: "outdoor", alsoIn: ["living"], model: "basket", size: [25, 25, 60], color: "#3b3d41", materials: m(metalItem), keywords: ["hallway"] },
  { id: "patio-sofa", name: "Patio sofa", category: "outdoor", model: "sofa", size: [180, 80, 80], color: "#8b8d90", materials: m(upholstered), seats: 2, keywords: ["garden sofa", "balcony"] },
  { id: "plant-stand", name: "Plant stand", category: "outdoor", alsoIn: ["living", "general"], model: "sideTable", size: [30, 30, 60], color: "#2b2d31", materials: m(woodItem), keywords: ["flower stand", "vase"] },

  // ---- General, wall items, fitness, seasonal
  { id: "wall-painting", name: "Wall painting / frame", category: "general", alsoIn: ["living", "bedroom", "office", "dining"], model: "wallArt", size: [80, 3, 60], color: "#5e4231", materials: ["wood", "matte"], seats: 0, elevation: 1.3, ignoreCollision: true, keywords: ["art", "picture", "poster"] },
  { id: "wall-clock", name: "Wall clock", category: "general", alsoIn: ["living", "bedroom", "kitchen", "office"], model: "wallArt", size: [40, 4, 40], color: "#1b1b1d", materials: ["matte", "wood", "metal"], seats: 1, elevation: 1.9, ignoreCollision: true, keywords: ["timepiece"] },
  { id: "wall-mirror", name: "Round wall mirror", category: "general", alsoIn: ["bedroom", "bathroom", "living"], model: "wallArt", size: [70, 4, 70], color: "#c9a54a", materials: ["metal", "wood", "matte"], seats: 2, elevation: 1.1, ignoreCollision: true, keywords: ["mirror"] },
  { id: "floating-shelf", name: "Floating wall shelf", category: "general", alsoIn: ["living", "bedroom", "kids", "kitchen"], model: "wallCabinet", size: [90, 22, 4], color: "#c9a77c", materials: m(woodItem), elevation: 1.4, ignoreCollision: true, keywords: ["wall shelf"] },
  { id: "treadmill", name: "Treadmill", category: "general", model: "treadmill", size: [80, 170, 140], color: "#2b2d31", materials: ["matte", "metal"], keywords: ["gym", "fitness", "exercise", "cardio"] },
  { id: "yoga-mat", name: "Yoga mat", category: "general", alsoIn: ["living", "bedroom"], model: "rug", size: [60, 180, 1], color: "#7f9a8c", materials: ["fabric"], ignoreCollision: true, min: 0.3, keywords: ["exercise mat", "fitness"] },
  { id: "door-mat", name: "Door mat", category: "general", model: "rug", size: [70, 45, 1], color: "#6f4a32", materials: ["fabric"], ignoreCollision: true, min: 0.3, keywords: ["welcome mat", "entrance"] },
  { id: "pet-bed", name: "Pet bed", category: "general", alsoIn: ["living"], model: "beanbag", size: [70, 50, 20], color: "#a9774a", materials: ["fabric"], keywords: ["dog bed", "cat bed"] },
  { id: "ironing-board", name: "Ironing board", category: "general", alsoIn: ["bedroom"], model: "diningTable", size: [120, 35, 90], color: "#8b8d90", materials: ["metal", "matte"], keywords: ["iron"] },
  { id: "christmas-tree", name: "Xmas tree (Christmas)", category: "general", alsoIn: ["living"], model: "tree", size: [80, 80, 180], color: "#4f7f3f", materials: ["matte"], keywords: ["xmas", "festive", "decor"] },
  // ---- the remaining letters
  { id: "entertainment-unit", name: "Entertainment unit", category: "living", model: "tvUnit", size: [200, 45, 55], color: "#3b3430", materials: m(woodItem), keywords: ["media wall", "tv cabinet"] },
  { id: "ergonomic-chair", name: "Ergonomic chair", category: "office", model: "officeChair", size: [65, 65, 120], color: "#2b2d31", materials: ["fabric", "leather", "matte"], keywords: ["mesh chair", "executive chair", "boss chair"] },
  { id: "jute-rug", name: "Jute rug", category: "general", alsoIn: ["living", "bedroom"], model: "rug", size: [240, 170, 2], color: "#c9ae80", materials: ["fabric"], ignoreCollision: true, min: 0.4, keywords: ["natural fibre", "carpet"] },
  { id: "nesting-tables", name: "Nesting tables", category: "living", model: "coffeeTable", size: [60, 40, 45], color: "#2b2d31", materials: m(woodItem), keywords: ["set of tables"] },
  { id: "queen-bed", name: "Queen-size bed", category: "bedroom", model: "bed", size: [160, 200, 100], color: "#d8c8aa", materials: m(upholstered), seats: 2, keywords: ["bed"] },
  { id: "quilt-rack", name: "Quilt / blanket ladder", category: "bedroom", alsoIn: ["living"], model: "rack", size: [60, 25, 170], color: "#c9a77c", materials: m(woodItem), keywords: ["throw", "towel ladder"] },
  { id: "zero-gravity-chair", name: "Zero-gravity chair", category: "outdoor", alsoIn: ["living"], model: "armchair", size: [70, 110, 100], color: "#3b3d41", materials: ["fabric", "metal", "matte"], seats: 1, keywords: ["lounger", "reclining"] },
  { id: "zafu-cushion", name: "Zafu meditation cushion", category: "pooja", alsoIn: ["living", "general"], model: "beanbag", size: [40, 40, 18], color: "#a8322d", materials: ["fabric"], keywords: ["yoga", "prayer seat", "asan"] },
];
