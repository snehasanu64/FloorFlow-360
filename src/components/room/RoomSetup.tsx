"use client";

import { LogoMark } from "../layout/Logo";
import { ArrowRight, FolderOpen, LayoutTemplate, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRoomPolygon } from "@/lib/geometry";
import { listProjects, type LibraryEntry } from "@/lib/library";
import { parseProjectJson } from "@/lib/persistence";
import { DEFAULT_ROOM, sanitizeRoom, validateRoomFields } from "@/lib/room";
import { formatCm } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";
import type { RoomConfig } from "@/types/room";
import { Button, Field } from "../layout/ui";
import { RoomFields } from "./RoomFields";

export function RoomSetup() {
  const start = useEditorStore((s) => s.startProject);
  const importResult = useEditorStore((s) => s.importResult);
  const openFromLibrary = useEditorStore((s) => s.openFromLibrary);
  const openPanel = useEditorStore((s) => s.openPanel);
  const notify = useEditorStore((s) => s.notify);
  const [draft, setDraft] = useState<RoomConfig>(DEFAULT_ROOM);
  const [name, setName] = useState("My room");
  const [saved, setSaved] = useState<LibraryEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(listProjects());
  }, []);

  const errors = useMemo(() => validateRoomFields(draft), [draft]);
  const valid = Object.keys(errors).length === 0;

  const preview = useMemo(() => {
    const room = sanitizeRoom(draft);
    const k = 200 / Math.max(room.length, room.width, 0.1);
    const poly = getRoomPolygon(room);
    return {
      w: Math.max(10, room.length * k),
      h: Math.max(10, room.width * k),
      points: poly.map((p) => `${p.x * k},${p.z * k}`).join(" "),
    };
  }, [draft]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    importResult(parseProjectJson(await file.text()));
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-panel shadow-xl">
        <div className="grid md:grid-cols-[1fr_1.15fr]">
          <div className="flex flex-col justify-between bg-gradient-to-br from-stone-900 to-stone-700 p-7 text-stone-100">
            <div>
              <button onClick={() => useEditorStore.setState({ screen: "landing" })} className="mb-4 text-xs text-stone-300 hover:text-white">
                ← Back to home
              </button>
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <LogoMark size={34} />
                FloorFlow 360
              </div>
              <h1 className="text-2xl font-semibold leading-tight">Design your home in 2D, walk through it in 3D.</h1>
              <p className="mt-2 text-sm text-stone-300">
                Start with your room&apos;s dimensions. Everything runs in your browser — no account, no uploads.
              </p>
            </div>
            <div className="my-6 flex items-center justify-center rounded-xl bg-white/5 p-6">
              <div className="relative">
                <svg width={preview.w + 12} height={preview.h + 12} viewBox={`-6 -6 ${preview.w + 12} ${preview.h + 12}`}>
                  <polygon points={preview.points} fill="#e7e5e0" stroke="#d6d3cd" strokeWidth={8} strokeLinejoin="round" />
                </svg>
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-stone-300">{formatCm(draft.length)}</span>
                <span className="absolute -left-7 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-stone-300">{formatCm(draft.width)}</span>
              </div>
            </div>
            {saved.length > 0 && (
              <div className="rounded-xl bg-white/10 p-3 text-sm">
                <div className="mb-1.5 font-medium">Continue where you left off</div>
                <ul className="space-y-1">
                  {saved.slice(0, 3).map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => openFromLibrary(p.id)}
                        className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-left hover:bg-white/20"
                      >
                        <FolderOpen size={14} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{p.name}</span>
                          <span className="block truncate text-[11px] text-stone-300">
                            {p.dims} · {p.items} item{p.items === 1 ? "" : "s"} · {new Date(p.savedAt).toLocaleDateString()}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {saved.length > 3 && (
                  <button onClick={() => openPanel("projects")} className="mt-1.5 text-xs text-stone-300 underline">
                    All {saved.length} projects…
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            className="space-y-5 p-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) {
                notify("error", "Please fix the highlighted room dimensions.");
                return;
              }
              start(sanitizeRoom(draft), name);
            }}
          >
            <h2 className="text-lg font-semibold">Room setup</h2>
            <Field label="Project name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="h-9 w-full rounded-md border border-line bg-panel px-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </Field>
            <RoomFields room={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} errors={errors} clamp={false} />
            <p className="text-xs text-muted">All values in centimetres. Doors and windows can be added once you&apos;re in the editor.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" disabled={!valid} className="px-5 py-2">
                Create room <ArrowRight size={15} />
              </Button>
              <Button onClick={() => openPanel("templates")}>
                <LayoutTemplate size={14} /> Templates
              </Button>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Import JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
