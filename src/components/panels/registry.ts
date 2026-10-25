import type { PanelId } from "@/store/editor-store";

/** Panels that have a UI. The Tools menu only lists these, so there are no dead entries. */
export const IMPLEMENTED_PANELS: PanelId[] = ["templates", "autolayout", "vastu", "estimate", "lighting", "models", "photo"];
