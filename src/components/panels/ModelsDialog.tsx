"use client";

import { Package, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { listCustomModels } from "@/data/furniture-catalog";
import { IMPORT_UNITS, deleteStoredModel, importGlbFile, type ImportUnit } from "@/lib/custom-models";
import { formatDims } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";
import { Button, IconButton } from "../layout/ui";
import { Modal } from "../layout/Panels";

export function ModelsDialog() {
  const s = useEditorStore();
  useEditorStore((st) => st.customRev);
  const [unit, setUnit] = useState<ImportUnit>("m");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const models = listCustomModels();

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const meta = await importGlbFile(file, unit, name);
      s.bumpCustom();
      setName("");
      s.notify("success", `"${meta.name}" imported (${formatDims(meta.width, meta.depth, meta.height)}). Find it under Furniture → My models.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="My 3D models" onClose={() => s.openPanel(null)} width="max-w-2xl">
      <div className="space-y-5 p-5">
        <p className="text-sm text-muted">
          Import real furniture models in <b>.glb</b> format. They are scaled to real-world size, appear in the Furniture tab under <b>My models</b>, and behave like any other piece
          (move, rotate, resize, collide, count in the estimate).
        </p>
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted">
              Model units
              <select value={unit} onChange={(e) => setUnit(e.target.value as ImportUnit)} className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink">
                {(Object.keys(IMPORT_UNITS) as ImportUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {IMPORT_UNITS[u].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted">
              Name (optional)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to the file name" className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink" />
            </label>
          </div>
          <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={15} /> {busy ? "Importing…" : "Choose .glb file"}
          </Button>
          <input ref={fileRef} type="file" accept=".glb,.gltf,model/gltf-binary" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          {error && <p className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-900">{error}</p>}
          <p className="text-[11px] leading-snug text-muted">
            Most glTF models are in metres. Files up to 25 MB, self-contained (textures embedded), not Draco-compressed. Check the licence of any model you download.
            Model files stay in <b>this browser</b>; exported project JSON only records their names and sizes, so on another computer they show as placeholder boxes until you import the .glb there too.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Imported models ({models.length})</h3>
          {models.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-muted">Nothing imported yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {models.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
                  <Package size={18} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted">{formatDims(m.width, m.depth, m.height)}</div>
                  </div>
                  {s.screen === "editor" && (
                    <Button className="!px-2.5 !py-1 text-xs" onClick={() => s.addItem(m.id)}>
                      <Plus size={13} /> Add to room
                    </Button>
                  )}
                  <IconButton
                    label={`Delete ${m.name}`}
                    danger
                    onClick={() =>
                      s.askConfirm({
                        title: `Delete "${m.name}"?`,
                        message: "The model file is removed from this browser. Pieces already placed keep their size but show as a red placeholder box.",
                        confirmLabel: "Delete model",
                        danger: true,
                        onConfirm: () => {
                          void deleteStoredModel(m.id).then(() => s.bumpCustom());
                        },
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
