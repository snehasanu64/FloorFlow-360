"use client";

import { LogoMark, Wordmark } from "../layout/Logo";
import {
  Box,
  Download,
  FileJson,
  FilePlus2,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  Maximize,
  Moon,
  Sun,
  Redo2,
  RotateCw,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { export2DPng, export3DPng, exportProjectJson, has3DCapture } from "@/lib/export";
import { toggleFullscreen } from "@/lib/fullscreen";
import { UNITS, type Unit } from "@/lib/measurements";
import { parseProjectJson } from "@/lib/persistence";
import { IMPLEMENTED_PANELS } from "../panels/registry";
import { ToolsMenu } from "./ToolsMenu";
import { useEditorStore } from "@/store/editor-store";
import { IconButton, Segmented } from "../layout/ui";

function TextButton({ onClick, icon, children, title, primary }: { onClick: () => void; icon: React.ReactNode; children?: React.ReactNode; title: string; primary?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition ${
        primary ? "bg-accent text-on-accent hover:bg-accent-strong" : "text-ink hover:bg-hover"
      }`}
    >
      {icon}
      <span className="max-lg:hidden">{children}</span>
    </button>
  );
}

const Divider = () => <div className="mx-1 h-5 w-px bg-line" />;

export function Toolbar() {
  const s = useEditorStore();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  const newProject = () => {
    const go = () => s.backToSetup();
    if (s.dirty)
      s.askConfirm({
        title: "Start a new project?",
        message: "You have unsaved changes. Starting a new project will discard them.",
        confirmLabel: "Discard & continue",
        danger: true,
        onConfirm: go,
      });
    else go();
  };

  const doExport = async (kind: "json" | "png2d" | "png3d") => {
    setMenu(false);
    const st = useEditorStore.getState();
    const name = st.projectName;
    if (kind === "json") {
      exportProjectJson(st.buildFile());
      st.notify("success", "Project exported as JSON — check your Downloads folder.");
      return;
    }
    if (kind === "png2d") {
      // the 2D stage stays mounted (hidden) while viewing 3D, so this works from either view
      if (export2DPng(name, st.room)) st.notify("success", "Floor plan exported as PNG — check your Downloads folder.");
      else st.notify("error", "The 2D plan is not ready yet. Try again in a moment.");
      return;
    }
    // 3D: open the 3D view if it has never been shown, capture, then return to the previous view
    const previous = st.mode;
    if (!has3DCapture()) {
      st.setMode("3d");
      for (let i = 0; i < 40 && !has3DCapture(); i++) await new Promise((r) => setTimeout(r, 150));
      await new Promise((r) => setTimeout(r, 600));
    }
    if (export3DPng(name)) st.notify("success", "3D view exported as PNG — check your Downloads folder.");
    else st.notify("error", "The 3D viewport could not be captured.");
    if (previous === "2d") useEditorStore.getState().setMode("2d");
  };

  const onImportFile = async (file?: File) => {
    if (!file) return;
    const res = parseProjectJson(await file.text());
    const apply = () => s.importResult(res);
    if (s.dirty && res.ok)
      s.askConfirm({
        title: "Import project?",
        message: "Importing replaces the current project, including unsaved changes.",
        confirmLabel: "Import",
        danger: true,
        onConfirm: apply,
      });
    else apply();
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel px-3">
      <div className="mr-2 flex items-center gap-2">
        <LogoMark size={28} />
        <Wordmark className="text-[15px] max-sm:hidden" />
      </div>
      <Divider />
      <TextButton onClick={newProject} icon={<FilePlus2 size={16} />} title="New project">
        New
      </TextButton>
      <IconButton label="Undo (Ctrl+Z)" onClick={s.undo} disabled={s.past.length === 0}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton label="Redo (Ctrl+Y)" onClick={s.redo} disabled={s.future.length === 0}>
        <Redo2 size={16} />
      </IconButton>
      <Divider />
      <Segmented
        value={s.mode}
        onChange={s.setMode}
        options={[
          { value: "2d", label: <span className="flex items-center gap-1"><LayoutGrid size={13} /> 2D</span>, title: "2D floor plan" },
          { value: "3d", label: <span className="flex items-center gap-1"><Box size={13} /> 3D</span>, title: "3D view" },
        ]}
      />
      <TextButton onClick={() => s.toggle360()} icon={<RotateCw size={16} />} title="360° interactive view" primary={s.view360}>
        360° View
      </TextButton>
      <ToolsMenu implemented={IMPLEMENTED_PANELS} />
      {s.levels.length > 1 && (
        <select
          aria-label="Active floor"
          title="Switch floor"
          value={s.activeLevelId}
          onChange={(e) => s.switchLevel(e.target.value)}
          className="h-8 max-w-[9rem] rounded-md border border-line bg-panel px-1.5 text-xs font-medium text-ink"
        >
          {s.levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex-1" />

      <span className="mr-2 truncate text-xs text-muted max-xl:hidden" title="Project name">
        {s.projectName}
        {s.dirty ? " • unsaved" : ""}
      </span>
      <TextButton onClick={() => s.saveProject()} icon={<Save size={16} />} title="Save project in this browser (Ctrl+S)">
        Save
      </TextButton>
      <TextButton onClick={() => s.openPanel("projects")} icon={<FolderOpen size={16} />} title="My projects: open, rename, duplicate or delete saved designs">
        Projects
      </TextButton>
      <div className="relative" ref={menuRef}>
        <TextButton onClick={() => setMenu((m) => !m)} icon={<Download size={16} />} title="Export design">
          Export
        </TextButton>
        {menu && (
          <div className="absolute right-0 top-9 z-30 w-60 rounded-xl border border-line bg-panel p-1 shadow-xl">
            {[
              { k: "json" as const, icon: <FileJson size={15} />, label: "Project as JSON" },
              { k: "png2d" as const, icon: <ImageIcon size={15} />, label: "2D floor plan (PNG)" },
              { k: "png3d" as const, icon: <ImageIcon size={15} />, label: "3D viewport (PNG)" },
            ].map((m) => (
              <button key={m.k} onClick={() => void doExport(m.k)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-hover">
                {m.icon} {m.label}
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              onClick={() => {
                setMenu(false);
                fileRef.current?.click();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-hover"
            >
              <Upload size={15} /> Import project JSON…
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void onImportFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <select
        aria-label="Measurement units"
        title="Measurement units"
        value={s.units}
        onChange={(e) => s.setUnits(e.target.value as Unit)}
        className="h-8 rounded-md border border-line bg-panel px-1.5 text-xs font-medium text-ink"
      >
        {(Object.keys(UNITS) as Unit[]).map((u) => (
          <option key={u} value={u}>
            {UNITS[u].label}
          </option>
        ))}
      </select>
      <IconButton label={s.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => s.setTheme(s.theme === "dark" ? "light" : "dark")}>
        {s.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>
      <IconButton label="Fullscreen" onClick={toggleFullscreen}>
        <Maximize size={16} />
      </IconButton>
    </header>
  );
}
