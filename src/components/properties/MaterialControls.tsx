"use client";

import { getCatalogItem } from "@/data/furniture-catalog";
import { COLOR_PRESETS, WOOD_PRESETS, normalizeHex } from "@/lib/color";
import { useRef, useState } from "react";
import { MATERIALS, defaultRoughness } from "@/lib/materials";
import { detailForMaterial, downscaleImage } from "@/lib/surface";
import { useEditorStore } from "@/store/editor-store";
import type { PlacedItem } from "@/types/furniture";

/** Colour, preset palette, material kind and roughness of one item. Only that item is updated. */
export function MaterialControls({ item }: { item: PlacedItem }) {
  const update = useEditorStore((s) => s.updateItem);
  const setMaterial = useEditorStore((s) => s.setMaterial);
  const cat = getCatalogItem(item.catalogId);
  const notify = useEditorStore((st) => st.notify);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasDetail = detailForMaterial(item.material) !== null;
  const kinds = cat?.materials ?? ["fabric"];
  const presets = item.material === "wood" ? [...WOOD_PRESETS, ...COLOR_PRESETS.slice(0, 0)] : COLOR_PRESETS;
  const swatches = item.material === "wood" ? [...WOOD_PRESETS, ...COLOR_PRESETS.slice(6, 8)] : presets;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Colour</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Custom colour"
            value={normalizeHex(item.color)}
            onChange={(e) => update(item.id, { color: e.target.value }, `color-${item.id}`)}
            className="h-9 w-12 cursor-pointer rounded-md border border-line bg-panel p-0.5"
          />
          <span className="text-xs tabular-nums text-muted">{item.color.toUpperCase()}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {swatches.map((c) => (
            <button
              key={c.value + c.name}
              type="button"
              title={c.name}
              aria-label={c.name}
              onClick={() => update(item.id, { color: c.value })}
              className={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                item.color.toLowerCase() === c.value ? "ring-2 ring-accent ring-offset-2 ring-offset-panel" : "border-black/15"
              }`}
              style={{ background: c.value }}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Material</div>
        <div className="grid grid-cols-2 gap-1.5">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMaterial(item.id, k)}
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                item.material === k ? "border-accent bg-accent-soft" : "border-line hover:bg-hover"
              }`}
            >
              <div className="text-sm font-medium text-ink">{MATERIALS[k].label}</div>
              <div className="text-[11px] leading-tight text-muted">{MATERIALS[k].description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
          <span>Roughness (glossiness)</span>
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => update(item.id, { roughness: defaultRoughness(item.material) })}
          >
            Reset
          </button>
        </div>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.01}
          value={item.roughness}
          aria-label="Roughness"
          onChange={(e) => update(item.id, { roughness: parseFloat(e.target.value) }, `rough-${item.id}`)}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[10px] text-muted">
          <span>Glossy</span>
          <span>Matte</span>
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-line p-2.5">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            <span className="font-medium">Surface detail</span>
            <span className="block text-[11px] text-muted">{hasDetail ? "Generated wood grain, weave, leather or brushed-metal relief" : "Not available for this material"}</span>
          </span>
          <input
            type="checkbox"
            checked={item.detail !== false && hasDetail}
            disabled={!hasDetail || !!item.textureUrl}
            onChange={(e) => update(item.id, { detail: e.target.checked ? undefined : false })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-hover disabled:opacity-50"
          >
            {item.textureUrl ? "Replace texture…" : "Upload texture image…"}
          </button>
          {item.textureUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.textureUrl} alt="Uploaded texture" className="h-7 w-7 rounded border border-line object-cover" />
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => update(item.id, { textureUrl: undefined })}>
                Remove
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                update(item.id, { textureUrl: await downscaleImage(file) });
              } catch (err) {
                notify("error", err instanceof Error ? err.message : "Could not read that image.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
        <p className="text-[11px] leading-snug text-muted">Your image wraps each surface of this piece (downscaled to 512 px and saved with the project).</p>
      </div>
      <p className="text-[11px] leading-snug text-muted">
        Surface detail is procedurally generated — it adds believable texture, but it is not a photograph of a real product.
      </p>
    </div>
  );
}
