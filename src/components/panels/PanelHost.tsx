"use client";

import { useEditorStore } from "@/store/editor-store";
import { AutoLayoutPanel } from "./AutoLayoutPanel";
import { EstimateDialog } from "./EstimateDialog";
import { LightingPanel } from "./LightingPanel";
import { ModelsDialog } from "./ModelsDialog";
import { PhotoStudio } from "./PhotoStudio";
import { ProjectsDialog } from "./ProjectsDialog";
import { TemplatesDialog } from "./TemplatesDialog";
import { VastuPanel } from "./VastuPanel";

/** Renders whichever tool panel is open (modals and side drawers). */
export function PanelHost() {
  const panel = useEditorStore((s) => s.panel);
  const screen = useEditorStore((s) => s.screen);
  switch (panel) {
    case "projects":
      return <ProjectsDialog />;
    case "templates":
      return <TemplatesDialog />;
    case "autolayout":
      return screen === "editor" ? <AutoLayoutPanel /> : null;
    case "estimate":
      return screen === "editor" ? <EstimateDialog /> : null;
    case "photo":
      return <PhotoStudio />;
    case "models":
      return <ModelsDialog />;
    case "lighting":
      return screen === "editor" ? <LightingPanel /> : null;
    case "vastu":
      return screen === "editor" ? <VastuPanel /> : null;
    default:
      return null;
  }
}
