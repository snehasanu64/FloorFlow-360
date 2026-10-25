"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { loadStoredModelsIntoCatalog } from "@/lib/custom-models";
import { loadPrefs, useEditorStore } from "@/store/editor-store";
import { PropertiesPanel } from "../properties/PropertiesPanel";
import { Landing } from "../landing/Landing";
import { RoomSetup } from "../room/RoomSetup";
import { Sidebar } from "../sidebar/Sidebar";
import { Toolbar } from "../toolbar/Toolbar";
import { ConfirmHost, ToastHost } from "./Overlays";
import { StatusBar } from "./StatusBar";
import { PanelHost } from "../panels/PanelHost";

const Loading = ({ label }: { label: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted">
    <Loader2 className="animate-spin" size={26} />
    {label}
  </div>
);

// Konva and Three.js are browser-only: load them on the client.
const Editor2D = dynamic(() => import("../editor2d/Editor2D"), { ssr: false, loading: () => <Loading label="Loading floor plan…" /> });
const SceneCanvas = dynamic(() => import("../editor3d/SceneCanvas"), { ssr: false, loading: () => <Loading label="Loading 3D scene…" /> });

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditorStore.getState();
      if (st.screen !== "editor") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const has = st.selectedIds.length > 0;
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        st.redo();
      } else if (mod && key === "s") {
        e.preventDefault();
        st.saveProject();
      } else if (mod && key === "a") {
        e.preventDefault();
        st.selectAll();
      } else if (mod && key === "c" && has) {
        e.preventDefault();
        st.copySelected();
      } else if (mod && key === "x" && has) {
        e.preventDefault();
        st.cutSelected();
      } else if (mod && key === "v") {
        e.preventDefault();
        st.paste();
      } else if (mod && key === "d" && has) {
        e.preventDefault();
        st.duplicateSelected();
      } else if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) st.ungroupSelected();
        else st.groupSelected();
      } else if ((key === "delete" || key === "backspace") && has) {
        e.preventDefault();
        st.removeSelected();
      } else if (key === "escape") {
        if (st.walk) {
          st.setWalk(false);
          st.requestCamera("default");
          return;
        }
        st.select(null);
        st.setTool("select");
        st.clearMeasures();
      } else if (!mod && key === "v") {
        st.setTool("select");
      } else if (!mod && key === "m") {
        st.setTool(st.tool === "measure" ? "select" : "measure");
      } else if (!mod && key === "l" && has) {
        const sel = st.items.filter((i) => st.selectedIds.includes(i.id));
        st.lockSelected(!sel.every((i) => i.locked));
      } else if (!mod && key === "r" && has) {
        st.rotateSelected(e.shiftKey ? -90 : 90);
      } else if (e.key.startsWith("Arrow") && has) {
        e.preventDefault();
        const step = e.shiftKey ? st.room.gridSpacing * 5 : st.room.gridSpacing;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dz = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        st.nudgeSelected(dx, dz);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function useUnsavedGuard() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}

export function AppShell() {
  const screen = useEditorStore((s) => s.screen);
  const mode = useEditorStore((s) => s.mode);
  const [visited3d, setVisited3d] = useState(false);
  const [entered, setEntered] = useState(false);
  const theme = useEditorStore((s) => s.theme);
  useShortcuts();
  useUnsavedGuard();

  useEffect(() => {
    const prefs = loadPrefs();
    const st = useEditorStore.getState();
    if (prefs.units) st.setUnits(prefs.units);
    if (prefs.theme) st.setTheme(prefs.theme);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) st.setTheme("dark");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    void loadStoredModelsIntoCatalog().then((n) => n > 0 && useEditorStore.getState().bumpCustom());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === "3d") setVisited3d(true);
  }, [mode]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (screen === "editor") setEntered(true);
  }, [screen]);

  const editorVisible = screen === "editor";
  const onLanding = screen === "landing";
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      {onLanding && (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Landing />
        </main>
      )}
      {screen === "setup" && (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <RoomSetup />
        </main>
      )}
      {/* Canvases stay mounted once created: unmounting Konva / R3F roots during a render is unsafe. */}
      {entered && (
        <div className={editorVisible ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <Toolbar />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="relative min-w-0 flex-1">
              <div className={mode === "2d" ? "absolute inset-0" : "pointer-events-none invisible absolute inset-0"}>
                <Editor2D />
              </div>
              {visited3d && (
                <div className={mode === "3d" ? "absolute inset-0" : "pointer-events-none invisible absolute inset-0"}>
                  <SceneCanvas />
                </div>
              )}
            </main>
            <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-line bg-panel xl:block">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold">Properties</div>
              <PropertiesPanel />
            </aside>
          </div>
          <StatusBar />
        </div>
      )}
      <PanelHost />
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
