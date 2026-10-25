"use client";

import { useMemo } from "react";
import { TEMPLATES, buildTemplate, type Template } from "@/data/templates";
import { getRoomPolygon, itemRects, rectCorners } from "@/lib/geometry";
import { formatLen } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "../layout/ui";
import { Modal } from "../layout/Panels";

function Preview({ t }: { t: Template }) {
  const { room, items } = useMemo(() => buildTemplate(t), [t]);
  const poly = getRoomPolygon(room);
  const pad = 0.15;
  const vw = room.length + pad * 2;
  const vh = room.width + pad * 2;
  return (
    <svg viewBox={`${-pad} ${-pad} ${vw} ${vh}`} className="h-36 w-full" role="img" aria-label={`${t.name} preview`}>
      <polygon points={poly.map((p) => `${p.x},${p.z}`).join(" ")} fill="#efe9de" stroke="#3c4046" strokeWidth={0.12} strokeLinejoin="round" />
      {items
        .filter((i) => i.catalogId !== "ceiling-light")
        .map((i) =>
          itemRects(i).map((r, k) => (
            <polygon
              key={`${i.id}-${k}`}
              points={rectCorners(r).map((c) => `${c.x},${c.z}`).join(" ")}
              fill={i.color}
              fillOpacity={i.catalogId === "rug" || i.catalogId === "pooja-mat" ? 0.45 : 0.9}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={0.015}
            />
          )),
        )}
    </svg>
  );
}

export function TemplatesDialog() {
  const s = useEditorStore();
  const close = () => s.openPanel(null);

  const use = (t: Template) => {
    const go = () => {
      const { room, items } = buildTemplate(t);
      s.startProject(room, t.name, items);
      s.notify("success", `"${t.name}" template loaded — move, recolour or replace anything.`);
    };
    if (s.screen === "editor" && (s.dirty || s.items.length > 0))
      s.askConfirm({
        title: `Start from "${t.name}"?`,
        message: "This starts a new project from the template. Unsaved changes in the current project will be discarded.",
        confirmLabel: "Start from template",
        danger: s.dirty,
        onConfirm: go,
      });
    else go();
  };

  return (
    <Modal title="Start from a template" onClose={close}>
      <div className="p-5">
        <p className="mb-4 text-sm text-muted">Each template is a complete, editable layout — rooms, doors, windows and furniture. Change anything afterwards.</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <li key={t.id} className="flex flex-col rounded-xl border border-line p-3 transition hover:border-accent hover:shadow-md">
              <div className="rounded-lg bg-sunken p-2">
                <Preview t={t} />
              </div>
              <div className="mt-2 text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted">
                {formatLen(t.room.length)} × {formatLen(t.room.width)} · {t.items.length} pieces
              </div>
              <p className="mt-1 flex-1 text-xs text-muted">{t.description}</p>
              <Button className="mt-2" variant="primary" onClick={() => use(t)}>
                Use this template
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
