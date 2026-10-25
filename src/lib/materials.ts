import type { MaterialKind } from "@/types/furniture";

export interface MaterialSpec {
  label: string;
  description: string;
  roughness: number;
  metalness: number;
}

export const MATERIALS: Record<MaterialKind, MaterialSpec> = {
  fabric: { label: "Fabric", description: "Soft, matte upholstery", roughness: 0.95, metalness: 0 },
  leather: { label: "Leather", description: "Leather-like satin sheen", roughness: 0.42, metalness: 0.02 },
  wood: { label: "Wood", description: "Wood finish (colour only)", roughness: 0.6, metalness: 0 },
  metal: { label: "Metal", description: "Brushed metal finish", roughness: 0.32, metalness: 0.85 },
  matte: { label: "Painted", description: "Painted matte surface", roughness: 0.8, metalness: 0 },
};

export const defaultRoughness = (kind: MaterialKind) => MATERIALS[kind].roughness;
