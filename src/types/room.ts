export type WallSide = "north" | "south" | "east" | "west";
export type FloorMaterial = "wood" | "tile" | "concrete" | "carpet" | "plain";
export type OpeningType = "door" | "window";
export type RoomShape = "rect" | "L" | "T" | "U" | "chamfer";
export type WallPattern = "none" | "stripes" | "dots" | "brick" | "panels" | "plaster";

/**
 * Room coordinate system (metres): the bounding box spans x ∈ [0, length], z ∈ [0, width].
 * The floor is a polygon inside that box (a rectangle, or an L / T / U / chamfered shape).
 * Y is up. Walls are built outside the polygon so interior dimensions stay exact.
 * Polygon vertices run clockwise as seen on screen (x right, z down), so the interior
 * is on the right of every edge and the outward normal is (dz, -dx).
 */
export interface Opening {
  id: string;
  type: OpeningType;
  /** Index of the wall (polygon edge) the opening sits in. */
  edge: number;
  /** Centre of the opening measured along the edge from its start vertex, metres. */
  offset: number;
  width: number;
  height: number;
  /** Height of the bottom edge above the floor, metres (0 for doors). */
  sill: number;
}

export interface RoomConfig {
  length: number;
  width: number;
  wallHeight: number;
  wallThickness: number;
  floorMaterial: FloorMaterial;
  floorColor: string;
  wallColor: string;
  gridSpacing: number;
  shape: RoomShape;
  /** Rotation of the base shape in 90° steps (0..3). */
  shapeOrient: 0 | 1 | 2 | 3;
  /** Size of the cut-out used by L / T / U / chamfer shapes, metres. */
  cutW: number;
  cutD: number;
  /** Per-wall overrides keyed by edge index. */
  wallColors: Record<string, string>;
  wallPatterns: Record<string, WallPattern>;
  /** Default pattern for walls without an override. */
  wallPattern: WallPattern;
  /** Angle (degrees, clockwise) between the top of the plan and true north — used by the Vastu helper. */
  northAngle: number;
  openings: Opening[];
}

export type WallMode = "auto" | "full" | "low" | "hidden";
