"use client";

import { Camera, ImagePlus, Loader2, Palette, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { getCatalogItem } from "@/data/furniture-catalog";
import { AiError, analyzeWithClaude, loadStoredKey, storeKey } from "@/lib/ai";
import { ROOM_KINDS, type RoomKind } from "@/lib/autolayout";
import { formatDims } from "@/lib/measurements";
import { analyzeImages, describeLight, kindLabel, scoreStyles, suggestFurniture, type Suggestion } from "@/lib/photo-analysis";
import { STYLES, applyStyleToRoom, getStyle, matchStyle, restyle, styleFor, type StylePreset } from "@/lib/styles";
import { downscaleImage } from "@/lib/surface";
import { useEditorStore } from "@/store/editor-store";
import { FootprintThumb } from "../furniture/FootprintThumb";
import { Button } from "../layout/ui";
import { Modal } from "../layout/Panels";
import { CameraCapture } from "./photo/CameraCapture";
import { PanoViewer } from "./photo/PanoViewer";

interface Photo {
  id: string;
  url: string;
  pano: boolean;
  name: string;
}

interface Result {
  source: "local" | "claude";
  kind: RoomKind | "other";
  styleId: string;
  alternatives: { style: StylePreset; confidence: number; why: string }[];
  palette: string[];
  summary: string;
  notes: string[];
  suggestions: Suggestion[];
}

const MAX_PHOTOS = 8;
let photoSeq = 0;

const isPanoSize = (w: number, h: number) => h > 0 && w / h > 1.8 && w / h < 2.25;

function imageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = url;
  });
}

export function PhotoStudio() {
  const s = useEditorStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [kind, setKind] = useState<RoomKind | "other">("living");
  const [wishes, setWishes] = useState("");
  const [busy, setBusy] = useState<"local" | "claude" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [chosen, setChosen] = useState<string>("");
  const [apiKey, setApiKey] = useState(() => loadStoredKey());
  const [remember, setRemember] = useState(() => loadStoredKey() !== "");
  const fileRef = useRef<HTMLInputElement>(null);
  const panoRef = useRef<HTMLInputElement>(null);

  const style = useMemo(() => getStyle(chosen || result?.styleId || ""), [chosen, result]);
  const activePhoto = photos.find((p) => p.id === active) ?? photos[0];

  const addPhoto = async (url: string, name: string, forcePano?: boolean) => {
    const { w, h } = await imageSize(url);
    const p: Photo = { id: `ph-${++photoSeq}`, url, name, pano: forcePano ?? isPanoSize(w, h) };
    setPhotos((cur) => (cur.length >= MAX_PHOTOS ? cur : [...cur, p]));
    setActive(p.id);
    setResult(null);
  };

  const onFiles = async (files: FileList | null, pano: boolean) => {
    if (!files) return;
    setError(null);
    for (const f of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      try {
        // keep panoramas wide enough to look sharp when zoomed; ordinary photos only need analysing
        await addPhoto(await downscaleImage(f, pano ? 3072 : 1400, 0.85), f.name, pano ? true : undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that image.");
      }
    }
  };

  const analyseLocal = async () => {
    if (!photos.length) return setError("Add at least one photo first.");
    setBusy("local");
    setError(null);
    try {
      const feats = await analyzeImages(photos.map((p) => p.url));
      const scores = scoreStyles(feats);
      const requested = wishes.trim() ? matchStyle(wishes) : null;
      const top = requested?.style ?? scores[0].style;
      const notes = [
        `${describeLight(feats)}.`,
        `Detected from colour and light: ${scores[0].why}.`,
        ...(requested ? [`You asked for "${wishes.trim()}" — matched to ${requested.style.name}.`] : wishes.trim() ? [`Could not match "${wishes.trim()}" to a style; used the detected one.`] : []),
        "This on-device analysis reads colour and light only — it cannot recognise furniture in the photo. Use “Analyse with Claude” for that.",
      ];
      setResult({
        source: "local",
        kind,
        styleId: top.id,
        alternatives: scores.slice(0, 3),
        palette: feats.palette,
        summary: `${top.name}: ${top.description}`,
        notes,
        suggestions: suggestFurniture(kind, top, s.room, s.items),
      });
      setChosen("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(null);
    }
  };

  const analyseClaude = async () => {
    if (!photos.length) return setError("Add at least one photo first.");
    if (!apiKey.trim()) return setError("Paste your Anthropic API key first.");
    setBusy("claude");
    setError(null);
    try {
      storeKey(remember ? apiKey.trim() : null);
      // send smaller copies: the vision model does not need more than ~1500 px
      const small = await Promise.all(photos.map((p) => shrink(p.url, p.pano ? 2000 : 1400)));
      const ai = await analyzeWithClaude({ apiKey: apiKey.trim(), images: small, roomHint: kind, room: s.room, existing: s.items, wishes });
      const requested = wishes.trim() ? matchStyle(wishes) : null;
      const styleId = requested?.style.id ?? ai.styleId ?? scoreStyles(await analyzeImages(photos.map((p) => p.url)))[0].style.id;
      const st = getStyle(styleId);
      setResult({
        source: "claude",
        kind: ai.roomType,
        styleId,
        alternatives: STYLES.filter((x) => x.id === styleId).map((x) => ({ style: x, confidence: 1, why: "identified by Claude" })),
        palette: ai.palette,
        summary: ai.summary,
        notes: ai.observations,
        suggestions: ai.suggestions.map((x) => ({ catalogId: x.catalogId, reason: x.reason, color: x.color ?? (st ? styleFor(x.catalogId, st)?.color : undefined) })),
      });
      setChosen("");
      if (ai.roomType !== "other") setKind(ai.roomType);
    } catch (e) {
      setError(e instanceof AiError ? e.message : e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(null);
    }
  };

  const add = (sg: Suggestion) => {
    const st = style ? styleFor(sg.catalogId, style) : null;
    s.addItem(sg.catalogId, undefined, sg.color ? { color: sg.color, ...(st ? { material: st.material } : {}) } : undefined);
  };

  const doRestyle = () => {
    if (!style) return;
    const r = restyle(s.items, s.room, style);
    s.replaceLayout({ room: r.room, items: r.items });
    s.notify("success", `Restyled as ${style.name}: room finishes and ${r.changed} piece${r.changed === 1 ? "" : "s"} recoloured. Ctrl+Z undoes it.`);
  };

  return (
    <Modal title="Photo studio — photos & 360° to style and furniture ideas" onClose={() => s.openPanel(null)} width="max-w-5xl">
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------- inputs ---------- */}
        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">1 · Add photos of your home</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCamera((c) => !c)} disabled={photos.length >= MAX_PHOTOS}>
                <Camera size={15} /> Take photo
              </Button>
              <Button onClick={() => fileRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                <Upload size={15} /> Upload photos
              </Button>
              <Button onClick={() => panoRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                <ImagePlus size={15} /> Upload 360° panorama
              </Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onFiles(e.target.files, false); e.target.value = ""; }} />
              <input ref={panoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFiles(e.target.files, true); e.target.value = ""; }} />
            </div>
            <p className="text-[11px] text-muted">
              Up to {MAX_PHOTOS} photos. A 360° panorama is an equirectangular (2:1) image from a 360 camera or your phone&apos;s panorama / photo-sphere mode — it opens in an interactive viewer.
              Photos stay on your device unless you choose Claude analysis below.
            </p>
            {camera && <CameraCapture count={photos.length} onClose={() => setCamera(false)} onShot={(u) => void addPhoto(u, `Camera photo ${photos.length + 1}`, false)} />}
            {photos.length > 0 && (
              <ul className="grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <li key={p.id} className={`group relative overflow-hidden rounded-lg border ${activePhoto?.id === p.id ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
                    <button className="block aspect-square w-full" onClick={() => setActive(p.id)} title={p.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    </button>
                    {p.pano && <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[9px] font-semibold text-white">360°</span>}
                    <button
                      aria-label={`Remove ${p.name}`}
                      onClick={() => {
                        setPhotos((c) => c.filter((x) => x.id !== p.id));
                        setResult(null);
                      }}
                      className="absolute right-1 top-1 hidden rounded bg-black/65 p-0.5 text-white group-hover:block"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">2 · Tell us about the room</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-muted">
                Room type
                <select value={kind} onChange={(e) => setKind(e.target.value as RoomKind | "other")} className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink">
                  {ROOM_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                  <option value="other">Not sure</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-muted">
                Style you want (optional)
                <input value={wishes} onChange={(e) => setWishes(e.target.value)} placeholder="e.g. minimal Scandinavian" className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink" />
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">3 · Analyse</h3>
            <Button variant="primary" className="w-full py-2" onClick={analyseLocal} disabled={busy !== null}>
              {busy === "local" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Analyse on this device (free)
            </Button>
            <details className="rounded-xl border border-line p-3 text-sm">
              <summary className="cursor-pointer font-medium">Smarter analysis with Claude vision (optional)</summary>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted">
                  Recognises the room type, the furniture already in the photos and suggests pieces from this catalogue. <b>Your photos are sent to Anthropic</b> using <b>your own API key</b>, billed to your Anthropic account; this app stores neither.
                </p>
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Anthropic API key (sk-ant-…)"
                  aria-label="Anthropic API key"
                  className="h-9 w-full rounded-md border border-line bg-panel px-2 text-sm"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={remember} onChange={(e) => { setRemember(e.target.checked); if (!e.target.checked) storeKey(null); }} /> Remember the key in this browser (use a restricted key)
                </label>
                <Button className="w-full" onClick={analyseClaude} disabled={busy !== null}>
                  {busy === "claude" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Analyse with Claude
                </Button>
              </div>
            </details>
            {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-900">{error}</p>}
          </section>
        </div>

        {/* ---------- preview + results ---------- */}
        <div className="space-y-4">
          {activePhoto ? (
            activePhoto.pano ? (
              <PanoViewer key={activePhoto.id} src={activePhoto.url} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activePhoto.url} alt={activePhoto.name} className="max-h-72 w-full rounded-xl bg-sunken object-contain" />
            )
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-center text-sm text-muted">
              <Camera size={26} />
              <p>Take or upload photos of the room (or a 360° panorama)<br />to get a style read and furniture ideas.</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-line p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{getStyle(result.styleId)?.name ?? "Style"}</div>
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-medium text-muted">{result.source === "claude" ? "Claude vision" : "On-device analysis"}</span>
                </div>
                <p className="text-xs text-muted">{result.summary}</p>
                {result.palette.length > 0 && (
                  <div className="mt-2 flex gap-1.5" aria-label="Palette from the photos">
                    {result.palette.map((c, i) => (
                      <span key={i} title={c} className="h-6 w-6 rounded-full border border-black/15" style={{ background: c }} />
                    ))}
                  </div>
                )}
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
                {result.source === "local" && result.alternatives.length > 1 && (
                  <p className="mt-2 text-[11px] text-muted">
                    Also close to: {result.alternatives.slice(1).map((a) => `${a.style.name} (${Math.round(a.confidence * 100)}%)`).join(", ")}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Palette size={15} className="text-accent" /> Apply a style to your room
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Style to apply"
                    value={style?.id ?? ""}
                    onChange={(e) => setChosen(e.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-sm"
                  >
                    {STYLES.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  {style && (
                    <span className="flex gap-1">
                      {[style.wall, style.floor, style.upholstery, style.wood, style.accent].map((c, i) => (
                        <span key={i} className="h-5 w-5 rounded-full border border-black/15" style={{ background: c }} />
                      ))}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button onClick={doRestyle} disabled={!style || s.screen !== "editor"} variant="primary">
                    Restyle walls, floor &amp; furniture
                  </Button>
                  <Button
                    disabled={!style}
                    onClick={() => {
                      if (!style) return;
                      s.replaceLayout({ room: applyStyleToRoom(s.room, style) });
                      s.notify("success", `Walls and floor set to ${style.name}.`);
                    }}
                  >
                    Walls &amp; floor only
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted">Layout stays as it is; locked pieces keep their colour. Undo with Ctrl+Z.</p>
              </div>

              <div className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">Suggested furniture — {kindLabel(result.kind)}</div>
                  {result.suggestions.length > 1 && (
                    <Button className="!px-2 !py-1 text-xs" onClick={() => result.suggestions.forEach(add)}>
                      Add all
                    </Button>
                  )}
                </div>
                {result.suggestions.length === 0 ? (
                  <p className="text-xs text-muted">Nothing more to suggest for this room — it already has the essentials, or the room is small.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {result.suggestions.map((sg) => {
                      const cat = getCatalogItem(sg.catalogId);
                      if (!cat) return null;
                      return (
                        <li key={sg.catalogId} className="flex items-center gap-2.5 rounded-lg border border-line p-2">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-sunken">
                            <FootprintThumb cat={cat} color={sg.color} size={38} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{cat.name}</div>
                            <div className="text-[11px] text-muted">{formatDims(cat.width, cat.depth, cat.height)}</div>
                            <div className="text-xs text-muted">{sg.reason}</div>
                          </div>
                          {sg.color && <span className="h-5 w-5 shrink-0 rounded-full border border-black/15" style={{ background: sg.color }} title={sg.color} />}
                          <Button className="!px-2.5 !py-1 text-xs" onClick={() => add(sg)} disabled={s.screen !== "editor"}>
                            Add
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Re-encodes a data URL as a smaller JPEG for the vision API. */
function shrink(url: string, maxW: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}
