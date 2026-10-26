"use client";

import { LogoMark, Wordmark } from "../layout/Logo";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Armchair,
  Box,
  Calculator,
  Camera,
  Compass,
  Footprints,
  FolderOpen,
  Layers,
  LayoutTemplate,
  Lock,
  Moon,
  MousePointer2,
  Ruler,
  Shapes,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TEMPLATES, buildTemplate, type Template } from "@/data/templates";
import { FURNITURE_CATALOG } from "@/data/furniture-catalog";
import { getRoomPolygon, itemRects, rectCorners } from "@/lib/geometry";
import { listProjects, type LibraryEntry } from "@/lib/library";
import { formatLen } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";

const Hero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-sm text-muted">Building your room…</div>,
});

const FEATURES = [
  { icon: <Ruler size={20} />, title: "Exact 2D floor plans", text: "Type your real dimensions. Drag, rotate and resize furniture with snapping, guides and collision warnings." },
  { icon: <Box size={20} />, title: "Instant 3D & walkthrough", text: "See the same room in 3D, orbit 360°, or walk through it at eye height — day or night." },
  { icon: <Armchair size={20} />, title: `${FURNITURE_CATALOG.length} things for your home`, text: "Sofas to zafu cushions: furniture, appliances, kitchen and bath fixtures, decor — browse A–Z." },
  { icon: <Shapes size={20} />, title: "Any room shape", text: "Rectangles, L, T, U and angled rooms, doors, windows, accent walls and multiple floors with stairs." },
  { icon: <Wand2 size={20} />, title: "Auto-arrange & templates", text: "Start from 9 ready-made rooms or let FloorFlow 360 lay out a room using real design rules." },
  { icon: <Compass size={20} />, title: "Vastu helper", text: "Placement hints for the mandir, kitchen, bedroom and entrance, with your plan's true north." },
  { icon: <Camera size={20} />, title: "Photo & 360° ideas", text: "Snap your room or upload a 360° panorama to get a style read and furniture suggestions." },
  { icon: <Calculator size={20} />, title: "Cost estimate & PDF", text: "A bill of materials with your own prices, exported to Excel (CSV) or a shareable PDF report." },
];

const STEPS = [
  { n: "1", title: "Set up the room", text: "Enter dimensions, choose a shape, add doors and windows — or pick a template." },
  { n: "2", title: "Furnish it", text: "Click or drag furniture onto the plan. Recolour, resize, group and align with a few clicks." },
  { n: "3", title: "Explore & share", text: "Switch to 3D, walk through, export plans, a PDF report and a cost estimate." },
];

const ROOMS = ["Living room", "Bedroom", "Kitchen", "Pooja room", "Studio apartment", "Home office", "Kids room", "Dining room", "Bathroom", "Balcony"];

function MiniPlan({ t }: { t: Template }) {
  const { room, items } = useMemo(() => buildTemplate(t), [t]);
  const poly = getRoomPolygon(room);
  const pad = 0.12;
  return (
    <svg viewBox={`${-pad} ${-pad} ${room.length + pad * 2} ${room.width + pad * 2}`} className="h-full w-full" role="img" aria-label={`${t.name} floor plan`}>
      <polygon points={poly.map((p) => `${p.x},${p.z}`).join(" ")} fill="#f1ebe0" stroke="#3c4046" strokeWidth={0.1} strokeLinejoin="round" />
      {items
        .filter((i) => i.catalogId !== "ceiling-light")
        .map((i) =>
          itemRects(i).map((r, k) => (
            <polygon key={`${i.id}-${k}`} points={rectCorners(r).map((c) => `${c.x},${c.z}`).join(" ")} fill={i.color} fillOpacity={i.catalogId === "rug" || i.catalogId === "pooja-mat" ? 0.5 : 0.92} stroke="rgba(0,0,0,0.35)" strokeWidth={0.015} />
          )),
        )}
    </svg>
  );
}

export function Landing() {
  const s = useEditorStore();
  const [saved, setSaved] = useState<LibraryEntry[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(listProjects());
  }, []);

  const start = () => useEditorStore.setState({ screen: "setup" });
  const openTemplate = (t: Template) => {
    const { room, items } = buildTemplate(t);
    s.startProject(room, t.name, items);
  };

  return (
    <div className="relative min-h-full overflow-x-hidden bg-canvas text-ink">
      {/* soft background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[820px] overflow-hidden">
        <div className="ff-dots absolute inset-0" />
        <div className="ff-blob absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-accent/25 blur-3xl" />
        <div className="ff-blob absolute -left-28 top-40 h-[340px] w-[340px] rounded-full bg-amber-400/20 blur-3xl" style={{ animationDelay: "-5s" }} />
        <div className="ff-blob absolute left-1/3 top-0 h-[260px] w-[260px] rounded-full bg-violet-500/15 blur-3xl" style={{ animationDelay: "-9s" }} />
      </div>

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <a href="#top" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <LogoMark size={38} />
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#templates" className="hover:text-ink">Templates</a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            aria-label={s.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => s.setTheme(s.theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel/70 hover:bg-hover"
          >
            {s.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={start} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-md transition hover:bg-accent-strong">
            Start designing
          </button>
        </div>
      </header>

      {/* hero */}
      <section id="top" className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/80 px-3 py-1 text-xs font-medium text-muted shadow-sm backdrop-blur">
            <Sparkles size={13} className="text-accent" /> Free · runs in your browser · no sign-up
          </span>
          <h1 className="ff-rise mt-5 text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.1rem]">
            Design your dream home in{" "}
            <span className="bg-gradient-to-r from-accent via-violet-500 to-amber-500 bg-clip-text text-transparent">2D&nbsp;&amp;&nbsp;3D</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Enter your room, drop in furniture from a catalogue of {FURNITURE_CATALOG.length} household items, and watch it come alive in 3D. Walk through it, light it day or night, and get a cost estimate.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button onClick={start} className="group inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-on-accent shadow-lg shadow-accent/30 transition hover:bg-accent-strong">
              Start designing <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => s.openPanel("templates")} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel/80 px-5 py-3 text-base font-medium shadow-sm backdrop-blur transition hover:bg-hover">
              <LayoutTemplate size={18} /> Browse templates
            </button>
          </div>
          {saved.length > 0 && (
            <button
              onClick={() => s.openFromLibrary(saved[0].id)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-panel/80 px-3 py-2 text-sm backdrop-blur hover:bg-hover"
            >
              <FolderOpen size={15} className="text-accent" />
              Continue <b>{saved[0].name}</b>
              <span className="text-xs text-muted">· {saved[0].items} items</span>
            </button>
          )}
          <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 text-sm">
            {[
              [String(FURNITURE_CATALOG.length), "home items A–Z"],
              [String(TEMPLATES.length), "ready-made rooms"],
              ["2D · 3D · Walk", "one live design"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-xl font-semibold tracking-tight">{v}</dt>
                <dd className="text-xs text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] opacity-60 blur-2xl" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, transparent), color-mix(in srgb, #f59e0b 30%, transparent))" }} aria-hidden />
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-sunken to-panel shadow-2xl">
            <Hero3D />
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-panel/90 px-2.5 py-1 text-[11px] font-medium shadow backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live 3D · drag to look around
            </span>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-panel/90 px-2.5 py-1 text-[11px] font-medium shadow backdrop-blur">Living room template</span>
          </div>
          <div className="ff-float absolute -right-3 top-10 z-10 hidden items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2 text-xs font-medium shadow-xl sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Sun size={15} /></span>
            Day &amp; night lighting
          </div>
          <div className="ff-float absolute -left-6 top-24 z-10 hidden items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2 text-xs font-medium shadow-xl sm:flex" style={{ animationDelay: "-2s" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Footprints size={15} /></span>
            Walk-through
          </div>
          <div className="ff-float absolute -bottom-7 right-44 z-10 hidden items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2 text-xs font-medium shadow-xl sm:flex" style={{ animationDelay: "-4s" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><Wand2 size={15} /></span>
            Auto-arrange
          </div>
          <div className="absolute -bottom-5 -left-4 hidden w-40 rotate-[-4deg] rounded-2xl border border-line bg-panel p-2 shadow-xl sm:block">
            <div className="aspect-[1.25] overflow-hidden rounded-lg bg-sunken p-1">
              <MiniPlan t={TEMPLATES.find((t) => t.id === "bedroom")!} />
            </div>
            <div className="mt-1.5 px-1 text-[11px] font-medium">2D floor plan</div>
          </div>
        </div>
      </section>

      {/* room-type marquee */}
      <section className="relative z-10 overflow-hidden border-y border-line bg-panel py-4" aria-label="Rooms you can design">
        <div className="ff-marquee flex w-max gap-10 text-sm font-medium text-muted">
          {[...ROOMS, ...ROOMS, ...ROOMS, ...ROOMS].map((r, i) => (
            <span key={i} className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-accent to-violet-500" /> {r}
            </span>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything to plan a home — in one place</h2>
          <p className="mt-3 text-muted">From the first measurement to a printable report, without installing anything.</p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="group rounded-2xl border border-line bg-panel p-5 shadow-sm transition hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-on-accent">{f.icon}</span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: <Footprints size={18} />, t: "Walk through it", d: "First-person walkthrough with collisions." },
            { icon: <Layers size={18} />, t: "Multiple floors", d: "Stack floors and connect them with stairs." },
            { icon: <Lock size={18} />, t: "Private by design", d: "Your designs stay in your browser." },
          ].map((x) => (
            <div key={x.t} className="flex items-center gap-3 rounded-2xl border border-line bg-sunken/70 p-4">
              <span className="text-accent">{x.icon}</span>
              <div>
                <div className="text-sm font-semibold">{x.t}</div>
                <div className="text-xs text-muted">{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative z-10 bg-stone-900 text-stone-100">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">From empty room to finished design in three steps</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((st) => (
              <li key={st.n} className="relative rounded-2xl border border-white/15 bg-white/5 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-stone-900">{st.n}</span>
                <h3 className="mt-4 text-lg font-semibold">{st.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed opacity-75">{st.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-stone-900 shadow-lg transition hover:opacity-90">
              <MousePointer2 size={17} /> Try it now — it&apos;s free
            </button>
          </div>
        </div>
      </section>

      {/* templates */}
      <section id="templates" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start from a ready-made room</h2>
            <p className="mt-2 text-muted">Pick a layout, then change anything — size, colours, furniture.</p>
          </div>
          <button onClick={() => s.openPanel("templates")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
            See all templates <ArrowRight size={15} />
          </button>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.slice(0, 6).map((t) => (
            <li key={t.id}>
              <button onClick={() => openTemplate(t)} className="group w-full overflow-hidden rounded-2xl border border-line bg-panel text-left shadow-sm transition hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl">
                <div className="aspect-[4/3] bg-sunken p-4">
                  <MiniPlan t={t} />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t.name}</h3>
                    <ArrowRight size={16} className="text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatLen(t.room.length)} × {formatLen(t.room.width)} · {t.items.length} pieces
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* final CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 px-6 py-14 text-center text-white shadow-2xl">
          <div aria-hidden className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your home, designed before you build it</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">No downloads, no accounts, no cost. Open FloorFlow 360 and start with your first room in under a minute.</p>
          <button onClick={start} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 font-semibold text-stone-900 shadow-lg transition hover:scale-[1.02]">
            Start designing <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted">
          <span className="flex items-center gap-2 font-medium text-ink">
            <LogoMark size={20} /> <Wordmark />
          </span>
          <span>Designs are saved in your browser only. Furniture shown is a simplified 3D representation; cost figures are indicative.</span>
        </div>
      </footer>
    </div>
  );
}
