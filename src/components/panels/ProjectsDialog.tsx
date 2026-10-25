"use client";

import { Copy, FolderOpen, Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteFromLibrary, duplicateInLibrary, listProjects, renameInLibrary, type LibraryEntry } from "@/lib/library";
import { useEditorStore } from "@/store/editor-store";
import { Button, IconButton } from "../layout/ui";
import { Modal } from "../layout/Panels";

export function ProjectsDialog() {
  const s = useEditorStore();
  const [entries, setEntries] = useState<LibraryEntry[]>(() => listProjects());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const refresh = () => setEntries(listProjects());
  const close = () => s.openPanel(null);

  const open = (id: string) => {
    const go = () => {
      s.openFromLibrary(id);
    };
    if (s.screen === "editor" && s.dirty && id !== s.projectId)
      s.askConfirm({
        title: "Open another project?",
        message: "You have unsaved changes in the current project. Opening another project will discard them.",
        confirmLabel: "Discard & open",
        danger: true,
        onConfirm: go,
      });
    else go();
  };

  return (
    <Modal title="My projects" onClose={close} width="max-w-3xl">
      <div className="p-5">
        {s.screen === "editor" && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sunken p-3">
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">Current: {s.projectName}</div>
              <div className="text-xs text-muted">{s.dirty ? "Unsaved changes" : s.projectId ? "Saved" : "Not saved yet"}</div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                s.saveProject();
                refresh();
              }}
            >
              <Save size={14} /> {s.projectId ? "Save" : "Save to library"}
            </Button>
            {s.projectId && (
              <Button
                onClick={() => {
                  s.saveProject(true);
                  refresh();
                }}
              >
                <Copy size={14} /> Save as new copy
              </Button>
            )}
          </div>
        )}
        {entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No saved projects yet. Press Save in the toolbar to keep your design in this browser.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {entries.map((e) => (
              <li key={e.id} className={`flex gap-3 rounded-xl border p-3 ${e.id === s.projectId ? "border-accent bg-accent-soft" : "border-line"}`}>
                <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken">
                  {e.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.thumb} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <FolderOpen size={22} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {renaming === e.id ? (
                    <form
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        if (draft.trim()) renameInLibrary(e.id, draft.trim());
                        if (e.id === s.projectId && draft.trim()) s.setProjectName(draft.trim());
                        setRenaming(null);
                        refresh();
                      }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(ev) => setDraft(ev.target.value)}
                        onBlur={() => setRenaming(null)}
                        className="w-full rounded-md border border-accent bg-panel px-2 py-0.5 text-sm"
                      />
                    </form>
                  ) : (
                    <div className="truncate text-sm font-semibold">{e.name}</div>
                  )}
                  <div className="text-xs text-muted">
                    {e.dims} · {e.items} item{e.items === 1 ? "" : "s"}
                    {e.levels > 1 ? ` · ${e.levels} floors` : ""}
                  </div>
                  <div className="text-[11px] text-muted">{new Date(e.savedAt).toLocaleString()}</div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <Button className="!px-2 !py-1 text-xs" onClick={() => open(e.id)}>
                      <FolderOpen size={13} /> Open
                    </Button>
                    <IconButton
                      label="Rename"
                      onClick={() => {
                        setRenaming(e.id);
                        setDraft(e.name);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      label="Duplicate"
                      onClick={() => {
                        duplicateInLibrary(e.id);
                        refresh();
                      }}
                    >
                      <Copy size={14} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      danger
                      onClick={() =>
                        s.askConfirm({
                          title: `Delete "${e.name}"?`,
                          message: "This removes the saved project from this browser. Export it as JSON first if you may need it again.",
                          confirmLabel: "Delete",
                          danger: true,
                          onConfirm: () => {
                            deleteFromLibrary(e.id);
                            refresh();
                          },
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
