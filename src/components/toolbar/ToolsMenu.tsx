"use client";

import { Calculator, Camera, Compass, LayoutTemplate, Lightbulb, Package, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEditorStore, type PanelId } from "@/store/editor-store";

const ENTRIES: { panel: PanelId; label: string; hint: string; icon: React.ReactNode }[] = [
  { panel: "templates", label: "Start from a template", hint: "Living room, bedroom, kitchen, pooja room…", icon: <LayoutTemplate size={15} /> },
  { panel: "autolayout", label: "Auto-arrange room", hint: "Suggest a layout with design rules", icon: <Wand2 size={15} /> },
  { panel: "vastu", label: "Vastu check", hint: "Directions and placement hints", icon: <Compass size={15} /> },
  { panel: "estimate", label: "Cost estimate", hint: "Bill of materials, CSV and PDF", icon: <Calculator size={15} /> },
  { panel: "lighting", label: "Lighting & time of day", hint: "Sun, lamps and night mode", icon: <Lightbulb size={15} /> },
  { panel: "models", label: "My 3D models (GLB)", hint: "Import real furniture models", icon: <Package size={15} /> },
  { panel: "photo", label: "Photo studio (AI)", hint: "Photo / 360° → style & furniture ideas", icon: <Camera size={15} /> },
];

export function ToolsMenu({ implemented }: { implemented: PanelId[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openPanel = useEditorStore((s) => s.openPanel);
  const active = useEditorStore((s) => s.panel);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Tools: templates, auto-arrange, Vastu, estimate, lighting, models, photo studio"
        aria-label="Tools"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition ${active ? "bg-accent-soft text-accent" : "text-ink hover:bg-hover"}`}
      >
        <Sparkles size={16} />
        <span className="max-lg:hidden">Tools</span>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-72 rounded-xl border border-line bg-panel p-1 shadow-xl">
          {ENTRIES.filter((e) => implemented.includes(e.panel)).map((e) => (
            <button
              key={e.panel}
              onClick={() => {
                setOpen(false);
                openPanel(e.panel);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-hover"
            >
              <span className="mt-0.5 text-accent">{e.icon}</span>
              <span>
                <span className="block text-sm font-medium">{e.label}</span>
                <span className="block text-[11px] text-muted">{e.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
