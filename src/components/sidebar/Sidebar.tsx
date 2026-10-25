"use client";

import { AlertTriangle, Armchair, DoorOpen, Home, Palette, Search, SlidersHorizontal, Square, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, FURNITURE_CATALOG, getCatalogItem, listCustomModels } from "@/data/furniture-catalog";
import { formatDims } from "@/lib/measurements";
import { useEditorStore, type SidebarTab } from "@/store/editor-store";
import { useLayoutIssues, useSelectedItem } from "@/store/selectors";
import type { FurnitureCategory } from "@/types/furniture";
import { FootprintThumb } from "../furniture/FootprintThumb";
import { Button, IconButton, Segmented } from "../layout/ui";
import { EmptySelection, PropertiesPanel } from "../properties/PropertiesPanel";
import { MaterialControls } from "../properties/MaterialControls";
import { OpeningsEditor } from "../room/OpeningsEditor";
import { RoomFields } from "../room/RoomFields";
import { WallsEditor } from "../room/WallsEditor";
import { FloorsEditor } from "../room/FloorsEditor";

const TABS: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "room", label: "Room", icon: <Home size={16} /> },
  { id: "furniture", label: "Furniture", icon: <Armchair size={16} /> },
  { id: "materials", label: "Materials", icon: <Palette size={16} /> },
  { id: "properties", label: "Properties", icon: <SlidersHorizontal size={16} /> },
];

function RoomPanel() {
  const room = useEditorStore((s) => s.room);
  const setRoom = useEditorStore((s) => s.setRoom);
  const bringAllInside = useEditorStore((s) => s.bringAllInside);
  const select = useEditorStore((s) => s.select);
  const items = useEditorStore((s) => s.items);
  const { map, counts } = useLayoutIssues();
  const outside = items.filter((i) => map.get(i.id)?.outside);
  return (
    <div className="space-y-5 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Floors</h3>
        <FloorsEditor />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Dimensions &amp; finishes</h3>
        <RoomFields room={room} onChange={setRoom} clamp />
      </section>
      {counts.outside > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> {counts.outside} item{counts.outside > 1 ? "s are" : " is"} outside the room
          </div>
          <ul className="mb-2 space-y-0.5">
            {outside.map((i) => (
              <li key={i.id}>
                <button className="underline" onClick={() => select(i.id)}>
                  {i.name}
                </button>
              </li>
            ))}
          </ul>
          <Button onClick={bringAllInside}>Move everything inside</Button>
        </div>
      )}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Walls — accent colours &amp; patterns</h3>
        <WallsEditor />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Doors &amp; windows</h3>
        <OpeningsEditor />
      </section>
    </div>
  );
}

type CatalogEntry = (typeof FURNITURE_CATALOG)[number];

function FurnitureCard({ c, onAdd }: { c: CatalogEntry; onAdd: (id: string) => void }) {
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-roomcraft", c.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(c.id)}
      title={`Add ${c.name} (or drag it onto the plan)`}
      className="group flex flex-col rounded-xl border border-line bg-panel p-2 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <div className="flex h-20 items-center justify-center rounded-lg bg-sunken">
        <FootprintThumb cat={c} size={72} />
      </div>
      <div className="mt-2 text-[13px] font-medium leading-tight text-ink">{c.name}</div>
      <div className="text-[11px] text-muted">{formatDims(c.width, c.depth, c.height)}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted/80">{c.model === "glb" ? "My model" : CATEGORY_LABELS[c.category]}</div>
    </button>
  );
}

function FurniturePanel() {
  useEditorStore((s) => s.units);
  const addItem = useEditorStore((s) => s.addItem);
  const addOpening = useEditorStore((s) => s.addOpening);
  const [q, setQ] = useState("");
  const customRev = useEditorStore((s) => s.customRev);
  const [cat, setCat] = useState<FurnitureCategory | "all" | "custom">("all");
  const [view, setView] = useState<"rooms" | "az">("rooms");
  const scroller = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const custom = listCustomModels();
    const match = (c: CatalogEntry) =>
      !t || c.name.toLowerCase().includes(t) || c.keywords.some((k) => k.includes(t)) || CATEGORY_LABELS[c.category].toLowerCase().includes(t);
    if (view === "az") return [...FURNITURE_CATALOG, ...custom].filter(match).sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: "base" }));
    if (cat === "custom") return custom.filter((c) => !t || c.name.toLowerCase().includes(t));
    return [...FURNITURE_CATALOG, ...(cat === "all" ? custom : [])].filter((c) => (cat === "all" || c.category === cat || c.alsoIn?.includes(cat)) && match(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat, view, customRev]);

  const groups = useMemo(() => {
    const m = new Map<string, CatalogEntry[]>();
    for (const c of list) {
      const L = /[a-z]/i.test(c.name[0]) ? c.name[0].toUpperCase() : "#";
      m.set(L, [...(m.get(L) ?? []), c]);
    }
    return [...m.entries()];
  }, [list]);
  const present = new Set(groups.map(([L]) => L));
  const jump = (L: string) => scroller.current?.querySelector(`[data-letter="${L}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search furniture…" aria-label="Search furniture" className="h-9 w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "rooms", label: "By room" },
              { value: "az", label: "A–Z", title: "Every item in alphabetical order" },
            ]}
          />
          <span className="text-[11px] text-muted">{list.length} item{list.length === 1 ? "" : "s"}</span>
        </div>
        {view === "rooms" ? (
          <div className="flex flex-wrap gap-1">
            {(["all", ...CATEGORIES, ...(listCustomModels().length || customRev ? (["custom"] as const) : [])] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${cat === c ? "bg-ink text-panel" : "bg-sunken text-muted hover:text-ink"}`}
              >
                {c === "all" ? "All" : c === "custom" ? "My models" : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-0.5" role="navigation" aria-label="Jump to letter">
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => (
              <button
                key={L}
                disabled={!present.has(L)}
                onClick={() => jump(L)}
                className="h-6 w-6 rounded text-[11px] font-semibold text-ink transition hover:bg-accent-soft hover:text-accent disabled:text-muted/40 disabled:hover:bg-transparent"
              >
                {L}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 rounded-xl border border-line bg-sunken p-2.5">
          <div className="mb-1.5 text-xs font-semibold text-ink">Doors &amp; windows</div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => addOpening("door")} title="Add a door to the south wall">
              <DoorOpen size={14} /> Door
            </Button>
            <Button className="flex-1" onClick={() => addOpening("window")} title="Add a window to the north wall">
              <Square size={14} /> Window
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">Drag them along the walls in the 2D plan, or edit them in the Room tab.</p>
        </div>
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No furniture matches “{q}”. Anything missing can be imported as a 3D model (Tools → My 3D models).</p>
        ) : view === "az" ? (
          <div className="space-y-4">
            {groups.map(([L, items]) => (
              <section key={L} data-letter={L}>
                <h3 className="sticky top-0 z-10 -mx-1 mb-2 bg-panel/95 px-1 py-1 text-sm font-bold text-accent backdrop-blur">{L}</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {items.map((c) => (
                    <FurnitureCard key={c.id} c={c} onAdd={addItem} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {list.map((c) => (
              <FurnitureCard key={c.id} c={c} onAdd={addItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlacedList() {
  const items = useEditorStore((s) => s.items);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const remove = useEditorStore((s) => s.removeItem);
  const { map } = useLayoutIssues();
  if (!items.length) return <EmptySelection text="No furniture placed yet. Add pieces from the Furniture tab." />;
  return (
    <div className="p-3">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">In this room ({items.length})</h3>
      <ul className="space-y-1">
        {items.map((i) => {
          const iss = map.get(i.id);
          const cat = getCatalogItem(i.catalogId);
          return (
            <li key={i.id}>
              <div
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${i.id === selectedId ? "border-accent bg-accent-soft" : "border-transparent hover:bg-hover"}`}
              >
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => select(i.id)}>
                  {cat && <FootprintThumb cat={cat} color={i.color} size={28} />}
                  <span className="truncate text-sm">{i.name}</span>
                  {(iss?.overlaps.length || iss?.outside) && <AlertTriangle size={13} className="shrink-0 text-amber-600" />}
                </button>
                <IconButton label={`Delete ${i.name}`} danger onClick={() => remove(i.id)}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MaterialsPanel() {
  const item = useSelectedItem();
  if (!item) return <EmptySelection text="Select furniture to change its colour, material and glossiness." />;
  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold">{item.name}</h3>
      <MaterialControls item={item} />
    </div>
  );
}

export function Sidebar() {
  const tab = useEditorStore((s) => s.sidebarTab);
  const setTab = useEditorStore((s) => s.setSidebarTab);
  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-line bg-panel max-md:w-[260px]">
      <nav className="grid grid-cols-4 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 border-b-2 py-2 text-[11px] font-medium transition ${
              tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "room" && <RoomPanel />}
        {tab === "furniture" && <FurniturePanel />}
        {tab === "materials" && <MaterialsPanel />}
        {tab === "properties" && (
          <>
            <div className="xl:hidden">
              <PropertiesPanel />
            </div>
            <div className="max-xl:hidden">
              <PlacedList />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
