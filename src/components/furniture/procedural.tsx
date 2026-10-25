"use client";

import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getCatalogItem } from "@/data/furniture-catalog";
import { shade } from "@/lib/color";
import { lDeskLayout, lSofaLayout } from "@/lib/footprint";
import { MATERIALS } from "@/lib/materials";
import { detailForMaterial, getDetail } from "@/lib/surface";
import { GlbModel } from "./GlbModel";
import type { MaterialKind, PlacedItem } from "@/types/furniture";

/**
 * Procedural furniture. Every model is built in a local frame with the origin at the
 * footprint centre on the floor, +z toward the front, and is parametrised by the item's
 * width / depth / height so resizing never distorts proportions.
 *
 * To add a real GLB model later, register a component keyed by catalogue ID in
 * `FurnitureModel` (see README, "Adding real models") — nothing else in the app changes.
 */

type V3 = [number, number, number];

export interface Mats {
  primary: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  leg: THREE.MeshStandardMaterial;
}

interface Fixed {
  trim: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  mirror: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial;
  warm: THREE.MeshStandardMaterial;
  books: THREE.MeshStandardMaterial[];
  darkWood: THREE.MeshStandardMaterial;
}

let fixedCache: Fixed | null = null;
function fixed(): Fixed {
  if (!fixedCache) {
    const std = (color: string, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    fixedCache = {
      trim: std("#a3a8ad", 0.3, 0.9),
      white: std("#f2efe8", 0.9),
      dark: std("#202225", 0.5, 0.2),
      glass: new THREE.MeshPhysicalMaterial({ color: "#cfe6ee", roughness: 0.05, transmission: 0, transparent: true, opacity: 0.28, metalness: 0 }),
      mirror: std("#d6e3ea", 0.04, 1),
      green: new THREE.MeshStandardMaterial({ color: "#4f7f3f", roughness: 0.85, flatShading: true }),
      soil: std("#3a2a1f", 1),
      warm: new THREE.MeshStandardMaterial({ color: "#fff1cf", emissive: "#ffd89a", emissiveIntensity: 0.85, roughness: 0.6, side: THREE.DoubleSide }),
      books: ["#9b3d3d", "#2f5d7c", "#c9a24a", "#4b6b45", "#6c4a7a", "#d8d0c0", "#2b2b2f"].map((c) => std(c, 0.8)),
      darkWood: std("#3d2b1f", 0.65),
    };
  }
  return fixedCache;
}

/** Lamp shades glow brighter at night. */
export function setLampGlow(on: boolean) {
  fixed().warm.emissiveIntensity = on ? 2.2 : 0.55;
}

export function useFurnitureMaterials(color: string, material: MaterialKind, roughness: number, detail = true, textureUrl?: string): Mats {
  const invalidate = useThree((st) => st.invalidate);

  // user-supplied texture (a downscaled data URL stored with the item)
  const uploaded = useMemo(() => {
    if (!textureUrl) return null;
    const t = new THREE.TextureLoader().load(textureUrl, () => invalidate());
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.anisotropy = 4;
    return t;
  }, [textureUrl, invalidate]);
  useEffect(() => () => uploaded?.dispose(), [uploaded]);

  const mats = useMemo(() => {
    const spec = MATERIALS[material];
    const kind = detailForMaterial(material);
    const d = !uploaded && detail && kind ? getDetail(kind) : null;
    const make = (c: string) =>
      new THREE.MeshStandardMaterial({
        color: uploaded ? "#ffffff" : c,
        map: uploaded ?? d?.map ?? null,
        bumpMap: d?.bump ?? null,
        bumpScale: d?.bumpScale ?? 0,
        roughness,
        metalness: spec.metalness,
        envMapIntensity: material === "metal" ? 1.2 : 0.6,
      });
    const primary = make(color);
    const accent = make(shade(color, 0.1));
    if (uploaded) accent.color.set("#f2f2f2");
    const upholstered = material === "fabric" || material === "leather";
    return { primary, accent, leg: upholstered ? fixed().darkWood : primary };
  }, [color, material, roughness, detail, uploaded]);
  useEffect(
    () => () => {
      mats.primary.dispose();
      mats.accent.dispose();
    },
    [mats],
  );
  return mats;
}

/* ---------- primitives (position = centre x, bottom y, centre z) ---------- */

function B({ p, s, m, r = 0 }: { p: V3; s: V3; m: THREE.Material; r?: number }) {
  const pos: V3 = [p[0], p[1] + s[1] / 2, p[2]];
  const rad = Math.min(r, Math.min(s[0], s[1], s[2]) / 2 - 0.0015);
  if (rad > 0.002) {
    return <RoundedBox args={s} radius={rad} smoothness={3} position={pos} material={m} castShadow receiveShadow />;
  }
  return (
    <mesh position={pos} material={m} castShadow receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

function Cyl({ p, r, h, m, rt, seg = 20, open = false }: { p: V3; r: number; h: number; m: THREE.Material; rt?: number; seg?: number; open?: boolean }) {
  return (
    <mesh position={[p[0], p[1] + h / 2, p[2]]} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[rt ?? r, r, h, seg, 1, open]} />
    </mesh>
  );
}

interface MP {
  w: number;
  d: number;
  h: number;
  m: Mats;
  seats?: number;
}

/* ---------- seating ---------- */

function SofaBlock({
  x = 0,
  z = 0,
  w,
  d,
  h,
  m,
  seats,
  armL = true,
  armR = true,
}: MP & { x?: number; z?: number; seats: number; armL?: boolean; armR?: boolean }) {
  const legH = 0.1;
  const baseH = 0.16;
  const seatT = 0.14;
  const backT = 0.13;
  const seatTop = legH + baseH + seatT;
  const armT = Math.min(0.14, w * 0.2);
  const armH = Math.min(h - 0.1, seatTop + 0.2);
  const lw = armL ? armT : 0;
  const rw = armR ? armT : 0;
  const innerW = w - lw - rw;
  const innerX = (lw - rw) / 2;
  const cw = innerW / seats;
  const lx = w / 2 - 0.07;
  const lz = d / 2 - 0.07;
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * lx, 0, sz * lz]} s={[0.05, legH, 0.05]} m={m.leg} />))}
      <B p={[0, legH, 0]} s={[w, baseH, d]} m={m.primary} r={0.03} />
      <B p={[0, legH + baseH, -d / 2 + backT / 2]} s={[w - 0.004, h * 0.88 - legH - baseH, backT]} m={m.primary} r={0.04} />
      {Array.from({ length: seats }, (_, i) => {
        const cx = innerX - innerW / 2 + cw * (i + 0.5);
        return (
          <group key={i}>
            <B p={[cx, legH + baseH, backT / 2]} s={[cw - 0.015, seatT, d - backT - 0.02]} m={m.accent} r={0.05} />
            <B p={[cx, seatTop, -d / 2 + backT + 0.09]} s={[cw - 0.02, h - seatTop - 0.02, 0.18]} m={m.accent} r={0.07} />
          </group>
        );
      })}
      {armL && <B p={[-w / 2 + armT / 2, legH, 0]} s={[armT, armH - legH, d]} m={m.primary} r={0.05} />}
      {armR && <B p={[w / 2 - armT / 2, legH, 0]} s={[armT, armH - legH, d]} m={m.primary} r={0.05} />}
    </group>
  );
}

function LSofa({ w, d, h, m, flip }: MP & { flip: boolean }) {
  const { s, c } = lSofaLayout(w, d);
  const mainW = w - c;
  return (
    <group scale={[flip ? -1 : 1, 1, 1]}>
      <SofaBlock x={-w / 2 + mainW / 2} z={-d / 2 + s / 2} w={mainW} d={s} h={h} m={m} seats={mainW > 1.4 ? 2 : 1} armR={false} />
      <SofaBlock x={w / 2 - c / 2} z={0} w={c} d={d} h={h} m={m} seats={1} armL={false} />
    </group>
  );
}

function Chair({ w, d, h, m, seatH = 0.45 }: MP & { seatH?: number }) {
  const lx = w / 2 - 0.03;
  const lz = d / 2 - 0.03;
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * lx, 0, sz * lz]} s={[0.04, seatH, 0.04]} m={m.leg} />))}
      <B p={[0, seatH - 0.04, 0]} s={[w, 0.05, d]} m={m.accent} r={0.015} />
      <B p={[-lx, seatH, -lz]} s={[0.04, h - seatH, 0.04]} m={m.leg} />
      <B p={[lx, seatH, -lz]} s={[0.04, h - seatH, 0.04]} m={m.leg} />
      <B p={[0, seatH + (h - seatH) * 0.45, -lz]} s={[w - 0.06, (h - seatH) * 0.5, 0.03]} m={m.primary} r={0.012} />
    </group>
  );
}

function OfficeChair({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  const seatY = 0.46;
  return (
    <group>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
          <B p={[r * 0.45, 0.05, 0]} s={[r * 0.9, 0.03, 0.04]} m={f.trim} />
          <mesh position={[r * 0.88, 0.025, 0]} material={f.dark} castShadow>
            <sphereGeometry args={[0.025, 10, 8]} />
          </mesh>
        </group>
      ))}
      <Cyl p={[0, 0.05, 0]} r={0.025} h={seatY - 0.1} m={f.trim} seg={12} />
      <B p={[0, seatY - 0.06, 0.0]} s={[r * 1.7, 0.09, r * 1.7]} m={m.accent} r={0.04} />
      <B p={[0, seatY + 0.2, -r * 0.8]} s={[r * 1.6, h - seatY - 0.22, 0.07]} m={m.primary} r={0.04} />
      <B p={[-r * 0.85, seatY + 0.1, -0.02]} s={[0.04, 0.03, r * 1.1]} m={f.dark} />
      <B p={[r * 0.85, seatY + 0.1, -0.02]} s={[0.04, 0.03, r * 1.1]} m={f.dark} />
    </group>
  );
}

function Bed({ w, d, h, m, seats }: MP) {
  const f = fixed();
  const pillows = seats ?? 2;
  const legH = 0.12;
  const matTop = legH + 0.4;
  const pw = (w - 0.16) / pillows;
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05)]} s={[0.07, legH, 0.07]} m={m.leg} />))}
      <B p={[0, legH, 0]} s={[w, 0.18, d]} m={m.primary} r={0.015} />
      <B p={[0, 0, -d / 2 + 0.05]} s={[w, h, 0.1]} m={m.primary} r={0.03} />
      <B p={[0, 0, d / 2 - 0.03]} s={[w, 0.4, 0.06]} m={m.primary} r={0.02} />
      <B p={[0, legH + 0.18, 0.02]} s={[w - 0.1, 0.22, d - 0.18]} m={f.white} r={0.04} />
      {Array.from({ length: pillows }, (_, i) => (
        <B key={i} p={[-w / 2 + 0.08 + pw * (i + 0.5), matTop, -d / 2 + 0.3]} s={[pw - 0.06, 0.13, 0.4]} m={f.white} r={0.06} />
      ))}
      <B p={[0, matTop - 0.02, d / 2 - 0.1 - (d * 0.58) / 2]} s={[w - 0.08, 0.06, d * 0.58]} m={m.accent} r={0.03} />
    </group>
  );
}

/* ---------- tables ---------- */

function Table({ w, d, h, m, shelf = false, top = 0.04 }: MP & { shelf?: boolean; top?: number }) {
  const lx = w / 2 - 0.06;
  const lz = d / 2 - 0.06;
  const legW = h > 0.6 ? 0.06 : 0.045;
  return (
    <group>
      <B p={[0, h - top, 0]} s={[w, top, d]} m={m.primary} r={0.008} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * lx, 0, sz * lz]} s={[legW, h - top, legW]} m={m.leg} />))}
      {shelf && <B p={[0, h * 0.25, 0]} s={[w - 0.14, 0.025, d - 0.14]} m={m.accent} />}
    </group>
  );
}

function SideTable({ w, d, h, m }: MP) {
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl p={[0, h - 0.03, 0]} r={r} h={0.03} m={m.primary} seg={32} />
      <Cyl p={[0, 0.02, 0]} r={0.025} h={h - 0.05} m={m.leg} seg={12} />
      <Cyl p={[0, 0, 0]} r={r * 0.62} h={0.02} m={m.leg} seg={28} />
    </group>
  );
}

function DressingTable({ w, d, h, m }: MP) {
  const f = fixed();
  const topY = 0.75;
  const mw = w * 0.7;
  return (
    <group>
      <Table w={w} d={d} h={topY} m={m} />
      <group position={[w / 2 - 0.16, 0, 0]}>
        <Cabinet w={0.3} d={d - 0.04} h={topY - 0.04} m={m} drawers={3} doors={0} legH={0.0} />
      </group>
      <B p={[0, topY, -d / 2 + 0.02]} s={[mw, h - topY - 0.05, 0.03]} m={m.leg} r={0.01} />
      <B p={[0, topY + 0.03, -d / 2 + 0.04]} s={[mw - 0.07, h - topY - 0.11, 0.01]} m={f.mirror} />
    </group>
  );
}

function OfficeDesk({ w, d, h, m }: MP) {
  const f = fixed();
  const ped = 0.45;
  return (
    <group>
      <B p={[0, h - 0.04, 0]} s={[w, 0.04, d]} m={m.primary} r={0.008} />
      <B p={[-w / 2 + 0.04, 0, 0]} s={[0.04, h - 0.04, d - 0.1]} m={m.leg} />
      <group position={[w / 2 - ped / 2 - 0.02, 0, 0]}>
        <Cabinet w={ped} d={d - 0.1} h={h - 0.04} m={m} drawers={3} doors={0} legH={0} />
      </group>
      <B p={[-0.1, 0.25, -d / 2 + 0.1]} s={[w - ped - 0.2, 0.4, 0.02]} m={m.accent} />
      <B p={[-0.1, 0.0, -d / 2 + 0.1]} s={[0.01, 0.01, 0.01]} m={f.dark} />
    </group>
  );
}

/* ---------- storage ---------- */

function Cabinet({
  w,
  d,
  h,
  m,
  legH = 0.08,
  doors = 2,
  drawers = 0,
  tallHandles = false,
}: MP & { legH?: number; doors?: number; drawers?: number; tallHandles?: boolean }) {
  const f = fixed();
  const bodyH = h - legH;
  const front = d / 2;
  const drawersH = drawers > 0 ? (doors > 0 ? bodyH * 0.32 : bodyH - 0.04) : 0;
  const doorsH = doors > 0 ? bodyH - drawersH - 0.04 : 0;
  const lx = w / 2 - 0.05;
  const lz = d / 2 - 0.05;
  const dw = w / Math.max(doors, 1);
  return (
    <group>
      <B p={[0, legH, 0]} s={[w, bodyH, d]} m={m.primary} r={0.005} />
      {legH > 0.02 &&
        [-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * lx, 0, sz * lz]} s={[0.04, legH, 0.04]} m={m.leg} />))}
      {Array.from({ length: doors }, (_, i) => {
        const cx = -w / 2 + dw * (i + 0.5);
        const hx = i % 2 === 0 ? cx + dw / 2 - 0.05 : cx - dw / 2 + 0.05;
        return (
          <group key={i}>
            <B p={[cx, legH + 0.02, front + 0.008]} s={[dw - 0.012, doorsH, 0.016]} m={m.accent} r={0.004} />
            <B p={[hx, legH + 0.02 + doorsH / 2 - (tallHandles ? 0.15 : 0.0), front + 0.025]} s={[0.012, tallHandles ? 0.3 : Math.min(0.18, doorsH * 0.4), 0.014]} m={f.trim} />
          </group>
        );
      })}
      {Array.from({ length: drawers }, (_, i) => {
        const dh = drawersH / drawers;
        const y = legH + bodyH - 0.02 - drawersH + dh * (drawers - 1 - i);
        return (
          <group key={i}>
            <B p={[0, y, front + 0.008]} s={[w - 0.03, dh - 0.012, 0.016]} m={m.accent} r={0.004} />
            <B p={[0, y + dh / 2 - 0.006, front + 0.025]} s={[Math.min(0.2, w * 0.4), 0.012, 0.014]} m={f.trim} />
          </group>
        );
      })}
    </group>
  );
}

function Shell({ w, d, h, m, legH = 0, shelves, children }: MP & { legH?: number; shelves: number; children?: React.ReactNode }) {
  const t = 0.022;
  const inner = h - legH;
  return (
    <group>
      <B p={[-w / 2 + t / 2, legH, 0]} s={[t, inner, d]} m={m.primary} />
      <B p={[w / 2 - t / 2, legH, 0]} s={[t, inner, d]} m={m.primary} />
      <B p={[0, legH, 0]} s={[w - 2 * t, t, d]} m={m.primary} />
      <B p={[0, h - t, 0]} s={[w - 2 * t, t, d]} m={m.primary} />
      <B p={[0, legH, -d / 2 + 0.006]} s={[w - 2 * t, inner, 0.012]} m={m.accent} />
      {Array.from({ length: shelves }, (_, i) => (
        <B key={i} p={[0, legH + (inner * (i + 1)) / (shelves + 1), 0.0]} s={[w - 2 * t, t, d - 0.02]} m={m.primary} />
      ))}
      {children}
    </group>
  );
}

function Bookshelf({ w, d, h, m }: MP) {
  const f = fixed();
  const shelves = Math.max(2, Math.round(h / 0.36) - 1);
  const t = 0.022;
  const gap = h / (shelves + 1);
  const books: React.ReactNode[] = [];
  for (let s = 0; s <= shelves; s++) {
    if (s === shelves && shelves > 3) continue; // keep the top compartment empty
    let x = -w / 2 + t + 0.02;
    let i = 0;
    const base = s * gap + t;
    const room = gap - t * 1.5;
    while (x < w / 2 - t - 0.06) {
      const seed = s * 31 + i * 17;
      const bw = 0.022 + (Math.abs(Math.sin(seed * 12.9898)) % 1) * 0.03;
      const bh = room * (0.55 + (Math.abs(Math.sin(seed * 78.233)) % 1) * 0.4);
      if (Math.abs(Math.sin(seed * 3.7)) > 0.93) x += 0.12; // gap
      if (x + bw > w / 2 - t - 0.02) break;
      books.push(<B key={`${s}-${i}`} p={[x + bw / 2, base, -0.01]} s={[bw, bh, d * 0.72]} m={f.books[(s * 3 + i) % f.books.length]} />);
      x += bw + 0.002;
      i++;
    }
  }
  return (
    <Shell w={w} d={d} h={h} m={m} shelves={shelves}>
      {books}
    </Shell>
  );
}

function DecorCabinet({ w, d, h, m }: MP) {
  const f = fixed();
  const legH = 0.12;
  const lx = w / 2 - 0.04;
  const lz = d / 2 - 0.04;
  const inner = h - legH;
  return (
    <group>
      <Shell w={w} d={d} h={h} m={m} legH={legH} shelves={3}>
        <B p={[0, legH + 0.02, d / 2 - 0.004]} s={[w - 0.05, inner - 0.04, 0.008]} m={f.glass} />
        <Cyl p={[-w * 0.2, legH + inner / 4 + 0.011, 0]} r={0.06} h={0.14} m={m.accent} rt={0.04} />
        <B p={[w * 0.18, legH + inner / 2 + 0.011, 0]} s={[0.14, 0.1, 0.1]} m={f.white} r={0.01} />
        <Cyl p={[0, legH + (inner * 3) / 4 + 0.011, 0.0]} r={0.05} h={0.16} m={f.green} rt={0.07} />
      </Shell>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * lx, 0, sz * lz]} s={[0.04, legH, 0.04]} m={m.leg} />))}
      <B p={[w / 2 - 0.05, legH + inner / 2, d / 2 + 0.01]} s={[0.012, 0.16, 0.014]} m={f.trim} />
    </group>
  );
}

/* ---------- general ---------- */

function FloorLamp({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  const shadeH = Math.min(0.3, h * 0.2);
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={r * 0.75} h={0.025} m={m.primary} seg={28} />
      <Cyl p={[0, 0.025, 0]} r={0.012} h={h - shadeH - 0.02} m={m.primary} seg={10} />
      <mesh position={[0, h - shadeH / 2, 0]} material={f.warm} castShadow>
        <cylinderGeometry args={[r * 0.62, r * 0.95, shadeH, 28, 1, true]} />
      </mesh>
    </group>
  );
}

function CeilingLight({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  const bodyH = 0.1;
  return (
    <group>
      <Cyl p={[0, 0.03, 0]} r={r} h={bodyH - 0.03} m={m.primary} rt={r * 0.9} seg={36} />
      <mesh position={[0, 0.029, 0]} rotation={[Math.PI / 2, 0, 0]} material={f.warm}>
        <circleGeometry args={[r * 0.97, 36]} />
      </mesh>
      <Cyl p={[0, bodyH, 0]} r={0.006} h={h - bodyH - 0.02} m={f.trim} seg={8} />
      <Cyl p={[0, h - 0.02, 0]} r={0.05} h={0.02} m={f.trim} seg={16} />
    </group>
  );
}

function Rug({ w, d, h, m }: MP) {
  const th = Math.max(0.012, h);
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, th, d]} m={m.primary} />
      <B p={[0, 0, 0]} s={[w - 0.2, th + 0.003, d - 0.2]} m={m.accent} />
    </group>
  );
}

/* ---------- additional models: kitchen, bathroom, kids, misc ---------- */

let stoneMat: THREE.MeshStandardMaterial | null = null;
const stone = () => (stoneMat ??= new THREE.MeshStandardMaterial({ color: "#d6d3cc", roughness: 0.35 }));
let porcelainMat: THREE.MeshStandardMaterial | null = null;
const porcelain = () => (porcelainMat ??= new THREE.MeshStandardMaterial({ color: "#f6f6f4", roughness: 0.18 }));

function Ottoman({ w, d, h, m }: MP) {
  const legH = 0.08;
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07)]} s={[0.05, legH, 0.05]} m={m.leg} />))}
      <B p={[0, legH, 0]} s={[w, h - legH - 0.07, d]} m={m.primary} r={0.04} />
      <B p={[0, h - 0.08, 0]} s={[w - 0.04, 0.08, d - 0.04]} m={m.accent} r={0.035} />
    </group>
  );
}

function BarStool({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl p={[0, h - 0.06, 0]} r={r} h={0.06} m={m.accent} seg={28} />
      <Cyl p={[0, 0.02, 0]} r={0.018} h={h - 0.08} m={f.trim} seg={10} />
      <Cyl p={[0, 0, 0]} r={r * 0.85} h={0.02} m={f.trim} seg={28} />
      <Cyl p={[0, h * 0.34, 0]} r={r * 0.7} h={0.015} m={f.trim} seg={24} rt={r * 0.7} />
    </group>
  );
}

function SingleChair({ w, d, h, m }: MP) {
  return <Chair w={w} d={d} h={h} m={m} seatH={Math.min(0.46, h * 0.52)} />;
}

function LDesk({ w, d, h, m, flip }: MP & { flip: boolean }) {
  const { s, c } = lDeskLayout(w, d);
  const mainW = w - c;
  const leg = 0.05;
  const top = 0.035;
  return (
    <group scale={[flip ? -1 : 1, 1, 1]}>
      <B p={[-w / 2 + mainW / 2, h - top, -d / 2 + s / 2]} s={[mainW, top, s]} m={m.primary} r={0.006} />
      <B p={[w / 2 - c / 2, h - top, 0]} s={[c, top, d]} m={m.primary} r={0.006} />
      {[
        [-w / 2 + 0.05, -d / 2 + 0.05],
        [-w / 2 + 0.05, -d / 2 + s - 0.05],
        [w / 2 - c - 0.0 + 0.05, -d / 2 + s - 0.05],
        [w / 2 - 0.05, d / 2 - 0.05],
        [w / 2 - c + 0.05, d / 2 - 0.05],
        [w / 2 - 0.05, -d / 2 + 0.05],
      ].map(([x, z], i) => (
        <B key={i} p={[x, 0, z]} s={[leg, h - top, leg]} m={m.leg} />
      ))}
      <B p={[-0.1, 0.3, -d / 2 + 0.05]} s={[mainW - 0.2, 0.35, 0.02]} m={m.accent} />
    </group>
  );
}

function Drawers({ w, d, h, m, seats }: MP) {
  return <Cabinet w={w} d={d} h={h} m={m} legH={0.06} doors={0} drawers={seats ?? 4} />;
}

function Fridge({ w, d, h, m }: MP) {
  const f = fixed();
  const split = h * 0.32;
  return (
    <group>
      <B p={[0, 0.02, 0]} s={[w, h - 0.02, d]} m={m.primary} r={0.02} />
      <B p={[0, 0, 0]} s={[w - 0.06, 0.02, d - 0.06]} m={f.dark} />
      <B p={[0, h - split, d / 2 + 0.004]} s={[w - 0.02, split - 0.02, 0.012]} m={m.accent} r={0.006} />
      <B p={[0, 0.04, d / 2 + 0.004]} s={[w - 0.02, h - split - 0.07, 0.012]} m={m.accent} r={0.006} />
      <B p={[w / 2 - 0.07, h - split - 0.2, d / 2 + 0.03]} s={[0.025, 0.4, 0.03]} m={f.trim} />
      <B p={[w / 2 - 0.07, h - split + 0.08, d / 2 + 0.03]} s={[0.025, 0.2, 0.03]} m={f.trim} />
    </group>
  );
}

function Stove({ w, d, h, m }: MP) {
  const f = fixed();
  const burners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return (
    <group>
      <B p={[0, 0.03, 0]} s={[w, h - 0.03 - 0.03, d]} m={m.primary} r={0.01} />
      <B p={[0, h - 0.03, 0]} s={[w, 0.03, d]} m={f.dark} />
      {burners.map(([sx, sz], i) => (
        <Cyl key={i} p={[sx * w * 0.24, h, sz * d * 0.2 - d * 0.04]} r={w * 0.11} h={0.012} m={f.trim} seg={20} />
      ))}
      <B p={[0, h * 0.18, d / 2 + 0.006]} s={[w - 0.08, h * 0.5, 0.014]} m={f.dark} r={0.006} />
      <B p={[0, h * 0.18 + h * 0.5 - 0.06, d / 2 + 0.035]} s={[w - 0.2, 0.025, 0.03]} m={f.trim} />
      {[-0.2, -0.07, 0.07, 0.2].map((x, i) => (
        <Cyl key={i} p={[x * (w / 0.6), h - 0.09, d / 2 + 0.01]} r={0.017} h={0.02} m={f.trim} seg={12} />
      ))}
    </group>
  );
}

function Washer({ w, d, h, m }: MP) {
  const f = fixed();
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, h, d]} m={m.primary} r={0.015} />
      <B p={[0, h - 0.13, d / 2 + 0.002]} s={[w - 0.04, 0.12, 0.006]} m={f.dark} />
      <mesh position={[0, h * 0.42, d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]} material={f.trim} castShadow>
        <cylinderGeometry args={[w * 0.34, w * 0.34, 0.03, 32]} />
      </mesh>
      <mesh position={[0, h * 0.42, d / 2 + 0.028]} rotation={[Math.PI / 2, 0, 0]} material={f.glass}>
        <cylinderGeometry args={[w * 0.27, w * 0.27, 0.02, 32]} />
      </mesh>
    </group>
  );
}

function KitchenBase({ w, d, h, m, doors }: MP & { doors: number }) {
  const f = fixed();
  const plinth = 0.1;
  const top = 0.04;
  const bodyH = h - plinth - top;
  const dw = w / doors;
  return (
    <group>
      <B p={[0, 0, -0.02]} s={[w - 0.04, plinth, d - 0.08]} m={f.dark} />
      <B p={[0, plinth, 0]} s={[w, bodyH, d - 0.02]} m={m.primary} r={0.005} />
      {Array.from({ length: doors }, (_, i) => {
        const cx = -w / 2 + dw * (i + 0.5);
        return (
          <group key={i}>
            <B p={[cx, plinth + 0.02, d / 2 - 0.004]} s={[dw - 0.012, bodyH - 0.04, 0.018]} m={m.accent} r={0.004} />
            <B p={[cx, plinth + bodyH - 0.07, d / 2 + 0.018]} s={[Math.min(0.18, dw * 0.4), 0.014, 0.016]} m={f.trim} />
          </group>
        );
      })}
      <B p={[0, h - top, 0.005]} s={[w + 0.01, top, d + 0.02]} m={stone()} r={0.004} />
    </group>
  );
}

function SinkUnit({ w, d, h, m }: MP) {
  const f = fixed();
  const bw = Math.min(0.55, w * 0.45);
  const bd = Math.min(0.4, d * 0.65);
  return (
    <group>
      <KitchenBase w={w} d={d} h={h} m={m} doors={Math.max(2, Math.round(w / 0.45))} />
      <B p={[-w * 0.15, h - 0.004, 0.02]} s={[bw, 0.006, bd]} m={f.trim} />
      <B p={[-w * 0.15, h, 0.02]} s={[bw - 0.06, 0.004, bd - 0.06]} m={f.dark} />
      <Cyl p={[-w * 0.15, h, -d / 2 + 0.07]} r={0.012} h={0.26} m={f.trim} seg={10} />
      <B p={[-w * 0.15, h + 0.25, -d / 2 + 0.07]} s={[0.02, 0.02, 0.15]} m={f.trim} />
    </group>
  );
}

function WallCabinet({ w, d, h, m }: MP) {
  return <Cabinet w={w} d={d} h={h} m={m} legH={0} doors={Math.max(1, Math.round(w / 0.4))} />;
}

function Bathtub({ w, d, h, m }: MP) {
  const f = fixed();
  const t = 0.07;
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, 0.08, d]} m={m.primary} r={0.03} />
      <B p={[-w / 2 + t / 2, 0, 0]} s={[t, h, d]} m={m.primary} r={0.03} />
      <B p={[w / 2 - t / 2, 0, 0]} s={[t, h, d]} m={m.primary} r={0.03} />
      <B p={[0, 0, -d / 2 + t / 2]} s={[w - 2 * t, h, t]} m={m.primary} r={0.03} />
      <B p={[0, 0, d / 2 - t / 2]} s={[w - 2 * t, h, t]} m={m.primary} r={0.03} />
      <B p={[0, h * 0.25, 0]} s={[w - 2 * t, 0.02, d - 2 * t]} m={m.accent} />
      <Cyl p={[-w / 2 + 0.12, h, 0]} r={0.012} h={0.14} m={f.trim} seg={10} />
      <B p={[-w / 2 + 0.12, h + 0.12, 0.05]} s={[0.02, 0.02, 0.12]} m={f.trim} />
    </group>
  );
}

function Shower({ w, d, h, m }: MP) {
  const f = fixed();
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, 0.08, d]} m={m.primary} r={0.01} />
      <B p={[0, 0.08, d / 2 - 0.01]} s={[w - 0.02, h - 0.1, 0.01]} m={f.glass} />
      <B p={[w / 2 - 0.01, 0.08, 0]} s={[0.01, h - 0.1, d - 0.02]} m={f.glass} />
      <B p={[0, h - 0.04, d / 2 - 0.01]} s={[w, 0.04, 0.03]} m={f.trim} />
      <B p={[w / 2 - 0.01, h - 0.04, 0]} s={[0.03, 0.04, d]} m={f.trim} />
      <B p={[-w / 2 + 0.01, h - 0.04, -d / 2 + 0.01]} s={[0.03, 0.04, 0.03]} m={f.trim} />
      <Cyl p={[-w / 2 + 0.08, 0.08, -d / 2 + 0.06]} r={0.012} h={h - 0.4} m={f.trim} seg={10} />
      <Cyl p={[-w / 2 + 0.08, h - 0.34, -d / 2 + 0.06]} r={0.07} h={0.02} m={f.trim} seg={20} />
      <Cyl p={[0, 0.08, 0]} r={0.04} h={0.004} m={f.dark} seg={16} />
    </group>
  );
}

function Toilet({ w, d, h, m }: MP) {
  const tankD = 0.2;
  return (
    <group>
      <B p={[0, 0.0, -d / 2 + tankD / 2]} s={[w * 0.9, h * 0.48, tankD]} m={m.primary} r={0.03} />
      <B p={[0, h * 0.48, -d / 2 + tankD / 2]} s={[w * 0.94, 0.025, tankD + 0.02]} m={m.accent} r={0.01} />
      <mesh position={[0, 0.2, d / 2 - (d - tankD) / 2 - 0.0]} scale={[1, 1, (d - tankD) / w / 1.0]} material={m.primary} castShadow receiveShadow>
        <cylinderGeometry args={[w / 2, w * 0.34, 0.4, 28]} />
      </mesh>
      <mesh position={[0, 0.41, d / 2 - (d - tankD) / 2]} scale={[1, 1, (d - tankD) / w]} material={porcelain()} castShadow>
        <cylinderGeometry args={[w / 2 + 0.005, w / 2 + 0.005, 0.03, 28]} />
      </mesh>
    </group>
  );
}

function Vanity({ w, d, h, m }: MP) {
  const f = fixed();
  const top = 0.035;
  return (
    <group>
      <Cabinet w={w} d={d} h={h - top} m={m} legH={0.1} doors={2} />
      <B p={[0, h - top, 0.005]} s={[w + 0.01, top, d + 0.02]} m={stone()} r={0.004} />
      <mesh position={[0, h + 0.001, 0.02]} scale={[1, 1, (d * 0.6) / (w * 0.5)]} material={porcelain()} castShadow>
        <cylinderGeometry args={[w * 0.25, w * 0.19, 0.03, 28]} />
      </mesh>
      <Cyl p={[0, h, -d / 2 + 0.07]} r={0.012} h={0.2} m={f.trim} seg={10} />
      <B p={[0, h + 0.19, -d / 2 + 0.12]} s={[0.02, 0.02, 0.1]} m={f.trim} />
    </group>
  );
}

function Crib({ w, d, h, m }: MP) {
  const f = fixed();
  const bar = 0.07;
  const railY = h * 0.55;
  const nx = Math.max(3, Math.floor(w / bar));
  const nz = Math.max(4, Math.floor(d / bar));
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (w / 2 - 0.025), 0, sz * (d / 2 - 0.025)]} s={[0.05, h, 0.05]} m={m.primary} />))}
      <B p={[0, 0.3, 0]} s={[w - 0.06, 0.04, d - 0.06]} m={m.accent} />
      <B p={[0, 0.34, 0]} s={[w - 0.1, 0.08, d - 0.1]} m={f.white} r={0.03} />
      {[-1, 1].map((sz) => (
        <group key={`e${sz}`}>
          <B p={[0, h - 0.05, sz * (d / 2 - 0.025)]} s={[w, 0.04, 0.04]} m={m.primary} />
          <B p={[0, railY - 0.2, sz * (d / 2 - 0.025)]} s={[w, 0.03, 0.03]} m={m.primary} />
          {Array.from({ length: nx }, (_, i) => (
            <B key={i} p={[-w / 2 + 0.07 + ((w - 0.14) * i) / Math.max(1, nx - 1), 0.3, sz * (d / 2 - 0.025)]} s={[0.014, h - 0.35, 0.014]} m={m.primary} />
          ))}
        </group>
      ))}
      {[-1, 1].map((sx) => (
        <group key={`s${sx}`}>
          <B p={[sx * (w / 2 - 0.025), h - 0.05, 0]} s={[0.04, 0.04, d]} m={m.primary} />
          {Array.from({ length: nz }, (_, i) => (
            <B key={i} p={[sx * (w / 2 - 0.025), 0.3, -d / 2 + 0.07 + ((d - 0.14) * i) / Math.max(1, nz - 1)]} s={[0.014, h - 0.35, 0.014]} m={m.primary} />
          ))}
        </group>
      ))}
    </group>
  );
}

function BunkBed({ w, d, h, m }: MP) {
  const f = fixed();
  const post = 0.07;
  const lowY = 0.3;
  const upY = h * 0.62;
  const mattress = (y: number, key: string) => (
    <group key={key}>
      <B p={[0, y - 0.04, 0]} s={[w - 0.04, 0.05, d - 0.04]} m={m.accent} />
      <B p={[0, y, 0]} s={[w - 0.1, 0.16, d - 0.1]} m={f.white} r={0.04} />
    </group>
  );
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (w / 2 - post / 2), 0, sz * (d / 2 - post / 2)]} s={[post, h, post]} m={m.primary} />))}
      {mattress(lowY, "lo")}
      {mattress(upY, "up")}
      {[-1, 1].map((sx) => (
        <B key={sx} p={[sx * (w / 2 - post / 2), upY + 0.1, 0]} s={[0.025, 0.28, d - 0.2]} m={m.primary} />
      ))}
      <B p={[0, upY + 0.1, -d / 2 + post / 2]} s={[w - 0.12, 0.28, 0.025]} m={m.primary} />
      {/* ladder on the front-right */}
      {[-1, 1].map((sz) => (
        <B key={sz} p={[w / 2 + 0.01, 0.1, d / 2 - 0.5 + sz * 0.18]} s={[0.03, upY + 0.15, 0.03]} m={m.leg} />
      ))}
      {[0.25, 0.5, 0.75, 1.0, 1.25].filter((y) => y < upY).map((y) => (
        <B key={y} p={[w / 2 + 0.01, y, d / 2 - 0.5]} s={[0.03, 0.03, 0.36]} m={m.leg} />
      ))}
    </group>
  );
}

function Mirror({ w, d, h, m }: MP) {
  const f = fixed();
  return (
    <group>
      <B p={[0, 0.06, 0]} s={[w, h - 0.06, 0.04]} m={m.primary} r={0.01} />
      <B p={[0, 0.1, 0.021]} s={[w - 0.08, h - 0.14, 0.006]} m={f.mirror} />
      {[-1, 1].map((sx) => (
        <B key={sx} p={[sx * (w / 2 - 0.04), 0, 0]} s={[0.05, 0.06, d]} m={m.primary} />
      ))}
    </group>
  );
}

function CoatStand({ w, d, h, m }: MP) {
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={r * 0.75} h={0.03} m={m.primary} seg={24} />
      <Cyl p={[0, 0.03, 0]} r={0.018} h={h - 0.03} m={m.primary} seg={10} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
          <B p={[r * 0.35, h - 0.1, 0]} s={[r * 0.7, 0.02, 0.02]} m={m.primary} />
          <B p={[r * 0.7, h - 0.1, 0]} s={[0.02, 0.07, 0.02]} m={m.primary} />
        </group>
      ))}
    </group>
  );
}

function Piano({ w, d, h, m }: MP) {
  const f = fixed();
  return (
    <group>
      <B p={[0, 0.08, -d / 2 + (d * 0.7) / 2]} s={[w, h - 0.08, d * 0.7]} m={m.primary} r={0.01} />
      <B p={[0, 0, -d / 2 + (d * 0.7) / 2]} s={[w - 0.1, 0.08, d * 0.65]} m={m.leg} />
      <B p={[0, 0.7, d / 2 - 0.15]} s={[w - 0.02, 0.05, 0.3]} m={m.primary} />
      <B p={[0, 0.75, d / 2 - 0.14]} s={[w - 0.1, 0.025, 0.22]} m={f.white} />
      {Array.from({ length: Math.round((w - 0.1) / 0.1) }, (_, i) => (
        <B key={i} p={[-(w - 0.1) / 2 + 0.06 + i * 0.1 * ((w - 0.12) / (Math.round((w - 0.1) / 0.1) * 0.1)), 0.775, d / 2 - 0.2]} s={[0.04, 0.02, 0.12]} m={f.dark} />
      ))}
      {[-1, 1].map((sx) => (
        <B key={sx} p={[sx * (w / 2 - 0.04), 0.08, d / 2 - 0.15]} s={[0.06, 0.62, 0.3]} m={m.primary} />
      ))}
    </group>
  );
}

function ShoeRack({ w, d, h, m }: MP) {
  const f = fixed();
  const shoes: React.ReactNode[] = [];
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < Math.floor(w / 0.2); i++) {
      shoes.push(
        <B key={`${s}-${i}`} p={[-w / 2 + 0.12 + i * 0.2, 0.05 + (s * (h - 0.05)) / 3 + 0.022, 0]} s={[0.09, 0.07, d * 0.65]} m={f.books[(s + i) % f.books.length]} r={0.02} />,
      );
    }
  }
  return (
    <Shell w={w} d={d} h={h} m={m} legH={0.05} shelves={2}>
      {shoes}
    </Shell>
  );
}


let goldMat: THREE.MeshStandardMaterial | null = null;
const gold = () => (goldMat ??= new THREE.MeshStandardMaterial({ color: "#d1a52a", roughness: 0.28, metalness: 0.9 }));
let flameMat: THREE.MeshStandardMaterial | null = null;
const flame = () => (flameMat ??= new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff9a1f", emissiveIntensity: 1.6, roughness: 0.5 }));

function Television({ w, d, h, m, wall }: MP & { wall: boolean }) {
  const f = fixed();
  const screenH = wall ? h : h - 0.1;
  const y0 = wall ? 0 : 0.1;
  return (
    <group>
      {!wall && (
        <>
          <B p={[0, 0, 0]} s={[Math.min(w * 0.45, 0.6), 0.02, d]} m={m.leg} r={0.005} />
          <B p={[0, 0.02, -d * 0.15]} s={[0.08, 0.1, 0.03]} m={m.leg} />
        </>
      )}
      <B p={[0, y0, wall ? 0 : -d * 0.15]} s={[w, screenH, wall ? d : 0.04]} m={m.primary} r={0.006} />
      <B p={[0, y0 + 0.012, (wall ? d / 2 : -d * 0.15 + 0.02) + 0.001]} s={[w - 0.024, screenH - 0.024, 0.004]} m={f.dark} />
    </group>
  );
}

function Mandir({ w, d, h, m, wall }: MP & { wall: boolean }) {
  const f = fixed();
  const g = gold();
  const baseH = wall ? 0 : Math.min(0.8, h * 0.42);
  const alcoveH = h - baseH;
  const roofH = alcoveH * 0.3;
  const bodyH = alcoveH - roofH;
  const post = 0.045;
  return (
    <group>
      {!wall && <Cabinet w={w} d={d} h={baseH} m={m} legH={0} doors={2} />}
      {/* platform */}
      <B p={[0, baseH, 0]} s={[w + 0.04, 0.04, d + 0.03]} m={m.accent} r={0.006} />
      {/* back + sides */}
      <B p={[0, baseH + 0.04, -d / 2 + 0.015]} s={[w - 0.04, bodyH - 0.04, 0.02]} m={m.accent} />
      {[-1, 1].map((sx) => (
        <B key={sx} p={[sx * (w / 2 - 0.012), baseH + 0.04, -0.01]} s={[0.024, bodyH - 0.04, d - 0.04]} m={m.primary} />
      ))}
      {/* front pillars */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Cyl p={[sx * (w / 2 - post), baseH + 0.04, d / 2 - post]} r={post / 2} h={bodyH - 0.04} m={m.primary} seg={14} />
          <Cyl p={[sx * (w / 2 - post), baseH + 0.04, d / 2 - post]} r={post * 0.8} h={0.03} m={g} seg={14} />
        </group>
      ))}
      {/* lintel with a scalloped gold trim */}
      <B p={[0, baseH + bodyH - 0.05, 0]} s={[w + 0.04, 0.05, d + 0.03]} m={m.primary} r={0.006} />
      <B p={[0, baseH + bodyH - 0.07, d / 2 + 0.015]} s={[w - 0.1, 0.018, 0.012]} m={g} />
      {/* shikhara roof */}
      {[0, 1, 2].map((i) => {
        const k = 1 - i * 0.27;
        return <B key={i} p={[0, baseH + bodyH + (roofH * 0.55 * i) / 2.2, 0]} s={[(w + 0.02) * k, roofH * 0.3, (d + 0.01) * k]} m={i % 2 ? m.accent : m.primary} r={0.006} />;
      })}
      <Cyl p={[0, baseH + bodyH + roofH * 0.6, 0]} r={Math.min(w, d) * 0.07} h={roofH * 0.25} m={g} rt={0.01} seg={14} />
      <mesh position={[0, baseH + bodyH + roofH * 0.95, 0]} material={g} castShadow>
        <sphereGeometry args={[0.025, 12, 10]} />
      </mesh>
      {/* deity idol + diya */}
      <mesh position={[0, baseH + 0.04 + 0.1, -d * 0.1]} material={g} castShadow>
        <sphereGeometry args={[0.05, 14, 12]} />
      </mesh>
      <Cyl p={[0, baseH + 0.04, -d * 0.1]} r={0.07} h={0.11} m={g} rt={0.02} seg={14} />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * w * 0.28, baseH + 0.04, d * 0.15]}>
          <Cyl p={[0, 0, 0]} r={0.035} h={0.025} m={g} seg={14} />
          <mesh position={[0, 0.04, 0]} material={flame()}>
            <coneGeometry args={[0.01, 0.035, 8]} />
          </mesh>
        </group>
      ))}
      <B p={[0, baseH + 0.04, d / 2 - 0.005]} s={[0.001, 0.001, 0.001]} m={f.dark} />
    </group>
  );
}

function Chowki({ w, d, h, m }: MP) {
  const leg = Math.min(0.07, h * 0.5);
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04)]} s={[0.05, h - 0.045, 0.05]} m={m.leg} />))}
      <B p={[0, h - 0.045, 0]} s={[w, 0.045, d]} m={m.primary} r={0.008} />
      <B p={[0, h, 0]} s={[w * 0.7, 0.012, d * 0.7]} m={m.accent} r={0.005} />
      <B p={[0, leg, 0]} s={[w - 0.1, 0.02, d - 0.1]} m={m.accent} />
    </group>
  );
}

function Deepam({ w, d, h }: MP) {
  const g = gold();
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={r * 0.8} h={0.03} m={g} rt={r * 0.5} seg={24} />
      <Cyl p={[0, 0.03, 0]} r={0.016} h={h * 0.55} m={g} seg={12} />
      {[0.22, 0.4].map((k, i) => (
        <mesh key={i} position={[0, h * k, 0]} material={g} castShadow>
          <torusGeometry args={[0.03 + i * 0.01, 0.01, 8, 18]} />
        </mesh>
      ))}
      <Cyl p={[0, h * 0.58, 0]} r={r * 0.9} h={0.03} m={g} rt={r * 0.65} seg={24} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * Math.PI * 2) / 5;
        const rr = r * 0.62;
        return (
          <group key={i} position={[Math.cos(a) * rr, h * 0.58 + 0.03, Math.sin(a) * rr]}>
            <Cyl p={[0, 0, 0]} r={0.03} h={0.02} m={g} seg={12} />
            <mesh position={[0, 0.045, 0]} material={flame()}>
              <coneGeometry args={[0.008, 0.03, 8]} />
            </mesh>
          </group>
        );
      })}
      <Cyl p={[0, h * 0.58 + 0.03, 0]} r={0.012} h={h * 0.4} m={g} seg={10} />
      <mesh position={[0, h - 0.02, 0]} material={g} castShadow>
        <sphereGeometry args={[0.03, 12, 10]} />
      </mesh>
    </group>
  );
}

function Stairs({ w, d, h, m }: MP) {
  const f = fixed();
  const rise = 0.18;
  const n = Math.max(2, Math.round(h / rise));
  const step = h / n;
  const run = d / n;
  const rail = 0.9;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <B key={i} p={[0, 0, d / 2 - run * (i + 0.5)]} s={[w - 0.1, step * (i + 1), run]} m={m.primary} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <B key={`t${i}`} p={[0, step * (i + 1) - 0.035, d / 2 - run * (i + 0.5) + 0.02]} s={[w - 0.08, 0.035, run + 0.04]} m={m.accent} />
      ))}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B p={[sx * (w / 2 - 0.025), 0, 0]} s={[0.05, h, d]} m={m.leg} />
          {Array.from({ length: Math.max(2, Math.floor(n / 3)) }, (_, k) => {
            const i = 1 + k * 3;
            return <B key={k} p={[sx * (w / 2 - 0.025), step * i, d / 2 - run * (i + 0.5)]} s={[0.03, rail, 0.03]} m={f.trim} />;
          })}
          <mesh position={[sx * (w / 2 - 0.025), h / 2 + rail / 2 - 0.05, 0]} rotation={[Math.atan2(h, d), 0, 0]} material={f.trim} castShadow>
            <boxGeometry args={[0.04, 0.04, Math.hypot(d, h)]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SpiralStairs({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  const n = Math.max(8, Math.round(h / 0.19));
  const step = h / n;
  const turn = (Math.PI * 2 * 1.0) / n; // one full turn from bottom to top
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={0.07} h={h} m={f.trim} seg={16} />
      {Array.from({ length: n }, (_, i) => {
        const a = i * turn;
        return (
          <group key={i} position={[0, step * (i + 1) - 0.04, 0]} rotation={[0, -a, 0]}>
            <B p={[r / 2, 0, 0]} s={[r, 0.04, Math.max(0.28, r * 0.55)]} m={m.primary} />
            <Cyl p={[r - 0.03, 0.04, 0]} r={0.012} h={0.9} m={f.trim} seg={8} />
          </group>
        );
      })}
    </group>
  );
}

/* ---------- household extras: appliances, climate, decor ---------- */

const matCache: Record<string, THREE.MeshStandardMaterial> = {};
const lm = (key: string, make: () => THREE.MeshStandardMaterial) => (matCache[key] ??= make());

/** Generic appliance box. variant (catalogue `seats`): 1 front-loader, 2 water dispenser, 3 compact wall / tower unit, 4 air cooler. */
function Appliance({ w, d, h, m, seats }: MP) {
  const f = fixed();
  const v = seats ?? 1;
  if (v === 2) {
    const bodyH = h * 0.7;
    return (
      <group>
        <B p={[0, 0, 0]} s={[w, bodyH, d]} m={m.primary} r={0.02} />
        <B p={[0, bodyH * 0.55, d / 2 + 0.004]} s={[w * 0.6, 0.1, 0.012]} m={f.dark} />
        {[-0.05, 0.05].map((x, i) => (
          <Cyl key={i} p={[x * (w / 0.35), bodyH * 0.55 - 0.05, d / 2 + 0.02]} r={0.012} h={0.04} m={i ? f.trim : m.accent} seg={10} />
        ))}
        <Cyl p={[0, bodyH, 0]} r={w * 0.34} h={h - bodyH} m={f.glass} rt={w * 0.3} seg={24} />
        <Cyl p={[0, bodyH, 0]} r={w * 0.3} h={(h - bodyH) * 0.65} m={m.accent} rt={w * 0.28} seg={24} />
      </group>
    );
  }
  if (v === 3) {
    return (
      <group>
        <B p={[0, 0, 0]} s={[w, h, d]} m={m.primary} r={Math.min(0.05, Math.min(w, d) * 0.3)} />
        <B p={[0, h * 0.62, d / 2 - 0.004]} s={[w * 0.8, h * 0.18, 0.012]} m={f.dark} />
        <B p={[w * 0.3, h * 0.4, d / 2 + 0.002]} s={[0.025, 0.025, 0.01]} m={f.trim} />
        <B p={[-w * 0.3, h * 0.12, d / 2 + 0.002]} s={[w * 0.3, 0.012, 0.01]} m={f.trim} />
      </group>
    );
  }
  if (v === 4) {
    return (
      <group>
        <B p={[0, 0.08, 0]} s={[w, h - 0.08, d]} m={m.primary} r={0.03} />
        <Cyl p={[-w / 2 + 0.06, 0, d / 2 - 0.06]} r={0.04} h={0.08} m={f.dark} seg={12} />
        <Cyl p={[w / 2 - 0.06, 0, d / 2 - 0.06]} r={0.04} h={0.08} m={f.dark} seg={12} />
        {Array.from({ length: 6 }, (_, i) => (
          <B key={i} p={[0, h * 0.25 + i * (h * 0.09), d / 2 + 0.003]} s={[w * 0.7, 0.012, 0.01]} m={f.dark} />
        ))}
        <B p={[0, h - 0.015, 0]} s={[w * 0.8, 0.02, d * 0.8]} m={f.dark} />
      </group>
    );
  }
  // 1: front-loading dishwasher / oven tower
  return (
    <group>
      <B p={[0, 0.0, 0]} s={[w, h, d]} m={m.primary} r={0.01} />
      <B p={[0, h * 0.9, d / 2 + 0.003]} s={[w - 0.04, h * 0.07, 0.012]} m={f.dark} />
      <B p={[0, h * 0.08, d / 2 + 0.004]} s={[w - 0.06, h * 0.7, 0.012]} m={m.accent} r={0.004} />
      <B p={[0, h * 0.74, d / 2 + 0.02]} s={[w * 0.6, 0.02, 0.025]} m={f.trim} />
      {h > 1.2 && <B p={[0, h * 0.4, d / 2 + 0.01]} s={[w * 0.7, h * 0.25, 0.012]} m={f.glass} />}
    </group>
  );
}

function Ac({ w, d, h, m }: MP) {
  const f = fixed();
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, h, d]} m={m.primary} r={Math.min(0.06, h * 0.3)} />
      <B p={[0, h * 0.12, d / 2 - 0.004]} s={[w * 0.88, h * 0.16, 0.012]} m={f.dark} />
      <B p={[w * 0.4, h * 0.62, d / 2 + 0.002]} s={[0.025, 0.012, 0.008]} m={f.trim} />
    </group>
  );
}

function CeilingFan({ w, h, m }: MP) {
  const f = fixed();
  const r = w / 2;
  return (
    <group>
      <Cyl p={[0, h - 0.04, 0]} r={0.06} h={0.04} m={f.trim} seg={16} />
      <Cyl p={[0, 0.14, 0]} r={0.012} h={h - 0.18} m={f.trim} seg={8} />
      <Cyl p={[0, 0.02, 0]} r={0.09} h={0.12} m={m.primary} rt={0.07} seg={20} />
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0.06, 0]} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <B p={[r * 0.55 + 0.05, 0, 0]} s={[r * 0.95, 0.012, 0.13]} m={m.accent} r={0.004} />
        </group>
      ))}
    </group>
  );
}

function StandFan({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={r * 0.55} h={0.04} m={m.primary} seg={24} />
      <Cyl p={[0, 0.04, 0]} r={0.02} h={h - 0.3} m={f.trim} seg={10} />
      <group position={[0, h - 0.17, 0.02]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={f.trim} castShadow>
          <torusGeometry args={[r * 0.78, 0.01, 8, 28]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={f.glass}>
          <cylinderGeometry args={[r * 0.78, r * 0.78, 0.02, 28]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <B p={[r * 0.22, -0.02, 0]} s={[r * 0.4, 0.04, 0.012]} m={m.accent} />
          </group>
        ))}
        <Cyl p={[0, -0.06, -0.06]} r={0.045} h={0.12} m={m.primary} seg={14} />
      </group>
    </group>
  );
}

function BeanBag({ w, d, h, m }: MP) {
  return (
    <mesh position={[0, h / 2, 0]} scale={[w / 2, h / 2, d / 2]} material={m.primary} castShadow receiveShadow>
      <sphereGeometry args={[1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
    </mesh>
  );
}

function Basket({ w, d, h, m }: MP) {
  const f = fixed();
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={r * 0.9} h={h} m={m.primary} rt={r} seg={28} />
      <Cyl p={[0, h - 0.012, 0]} r={r * 0.86} h={0.014} m={f.dark} seg={28} />
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent}>
        <torusGeometry args={[r * 0.97, 0.012, 8, 28]} />
      </mesh>
    </group>
  );
}

function Screen({ w, d, h, m }: MP) {
  const n = 3;
  const pw = w / n / 0.93;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        return (
          <group key={i} position={[-w / 2 + (w / n) * (i + 0.5), 0, side * d * 0.22]} rotation={[0, side * 0.42, 0]}>
            <B p={[0, 0.03, 0]} s={[pw, h - 0.03, 0.035]} m={m.primary} r={0.006} />
            <B p={[0, 0.1, side * 0.019]} s={[pw - 0.08, h - 0.2, 0.01]} m={m.accent} />
          </group>
        );
      })}
    </group>
  );
}

function Fireplace({ w, d, h, m }: MP) {
  const f = fixed();
  const fire = lm("fire", () => new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff8a1f", emissiveIntensity: 1.8 }));
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, 0.08, d]} m={f.dark} />
      {[-1, 1].map((sx) => (
        <B key={sx} p={[sx * (w / 2 - w * 0.075), 0.08, 0]} s={[w * 0.15, h * 0.78, d * 0.9]} m={m.primary} r={0.006} />
      ))}
      <B p={[0, h * 0.86, 0]} s={[w + 0.08, 0.07, d + 0.05]} m={m.accent} r={0.006} />
      <B p={[0, 0.08, -d / 2 + 0.06]} s={[w * 0.7, h * 0.78, 0.1]} m={m.primary} />
      <B p={[0, 0.2, -d / 2 + 0.12]} s={[w * 0.55, h * 0.45, 0.04]} m={f.dark} />
      <B p={[0, h * 0.86 + 0.07, -d / 2 + 0.1]} s={[w * 0.55, h * 0.16, 0.18]} m={m.primary} />
      {[-0.1, 0, 0.1].map((x, i) => (
        <mesh key={i} position={[x * (w / 1.4), 0.3, -d / 2 + 0.16]} material={fire}>
          <coneGeometry args={[0.05 - i * 0.004 * (i % 2), 0.2 - (i % 2) * 0.05, 8]} />
        </mesh>
      ))}
      <B p={[-w * 0.18, 0.1, -d / 2 + 0.16]} s={[w * 0.12, 0.05, 0.05]} m={f.soil} />
      <B p={[w * 0.18, 0.1, -d / 2 + 0.16]} s={[w * 0.12, 0.05, 0.05]} m={f.soil} />
    </group>
  );
}

function Jhula({ w, d, h, m }: MP) {
  const g = gold();
  const seatY = Math.min(0.55, h * 0.3);
  return (
    <group>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B p={[sx * (w / 2 - 0.04), 0, -d / 2 + 0.05]} s={[0.07, h, 0.07]} m={m.primary} r={0.01} />
          <B p={[sx * (w / 2 - 0.04), 0, d / 2 - 0.05]} s={[0.07, h, 0.07]} m={m.primary} r={0.01} />
          <B p={[sx * (w / 2 - 0.04), h * 0.55, 0]} s={[0.05, 0.05, d - 0.05]} m={m.primary} />
        </group>
      ))}
      <B p={[0, h - 0.07, -d / 2 + 0.05]} s={[w, 0.07, 0.07]} m={m.primary} />
      <B p={[0, h - 0.07, d / 2 - 0.05]} s={[w, 0.07, 0.07]} m={m.primary} />
      <B p={[0, h - 0.07, 0]} s={[w, 0.07, 0.07]} m={m.primary} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Cyl key={`${sx}${sz}`} p={[sx * (w * 0.4), seatY + 0.05, sz * (d * 0.36)]} r={0.008} h={h - 0.07 - seatY - 0.05} m={g} seg={6} />
      )))}
      <B p={[0, seatY, 0]} s={[w * 0.82, 0.07, d * 0.86]} m={m.primary} r={0.02} />
      <B p={[0, seatY + 0.07, 0.02]} s={[w * 0.78, 0.08, d * 0.7]} m={m.accent} r={0.03} />
      <B p={[0, seatY + 0.07, -d * 0.4]} s={[w * 0.8, 0.45, 0.06]} m={m.primary} r={0.02} />
    </group>
  );
}

function Curtain({ w, d, h, m }: MP) {
  const f = fixed();
  const n = Math.max(6, Math.round(w / 0.07));
  const step = w / n;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <B key={i} p={[-w / 2 + step * (i + 0.5), 0.05, Math.sin(i * 1.3) * d * 0.4]} s={[step * 1.15, h - 0.12, 0.025]} m={i % 2 ? m.accent : m.primary} />
      ))}
      <mesh position={[0, h - 0.04, 0]} rotation={[0, 0, Math.PI / 2]} material={f.trim} castShadow>
        <cylinderGeometry args={[0.014, 0.014, w + 0.12, 10]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (w / 2 + 0.07), h - 0.04, 0]} material={f.trim}>
          <sphereGeometry args={[0.03, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Treadmill({ w, d, h, m }: MP) {
  const f = fixed();
  return (
    <group>
      <B p={[0, 0.1, 0.02]} s={[w * 0.82, 0.12, d * 0.88]} m={m.primary} r={0.02} />
      <B p={[0, 0.22, 0.02]} s={[w * 0.66, 0.015, d * 0.8]} m={f.dark} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B p={[sx * (w * 0.4), 0.1, -d / 2 + 0.12]} s={[0.05, h - 0.1, 0.05]} m={f.trim} />
          <B p={[sx * (w * 0.4), h * 0.62, -d * 0.18]} s={[0.04, 0.04, d * 0.34]} m={f.trim} />
        </group>
      ))}
      <B p={[0, h - 0.34, -d / 2 + 0.1]} s={[w * 0.72, 0.28, 0.08]} m={f.dark} r={0.02} />
      <B p={[0, h - 0.24, -d / 2 + 0.145]} s={[w * 0.5, 0.1, 0.01]} m={f.glass} />
    </group>
  );
}

function Aquarium({ w, d, h, m }: MP) {
  const f = fixed();
  const stand = h * 0.4;
  const water = lm("water", () => new THREE.MeshStandardMaterial({ color: "#7fc4dc", transparent: true, opacity: 0.35, roughness: 0.1 }));
  const fish = lm("fish", () => new THREE.MeshStandardMaterial({ color: "#ff8a3d", roughness: 0.5 }));
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, stand, d]} m={m.primary} r={0.006} />
      <B p={[0, stand - 0.01, 0]} s={[w + 0.03, 0.03, d + 0.03]} m={f.dark} />
      <B p={[0, stand + 0.02, 0]} s={[w - 0.04, h - stand - 0.1, d - 0.04]} m={f.glass} />
      <B p={[0, stand + 0.03, 0]} s={[w - 0.06, (h - stand) * 0.75, d - 0.06]} m={water} />
      <B p={[0, stand + 0.025, 0]} s={[w - 0.06, 0.04, d - 0.06]} m={f.white} />
      {[-0.28, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x * w, stand + 0.18 + i * 0.07, 0.03 * (i - 1)]} scale={[1.8, 1, 0.8]} material={fish}>
          <sphereGeometry args={[0.025, 10, 8]} />
        </mesh>
      ))}
      {[-0.35, 0.2].map((x, i) => (
        <mesh key={i} position={[x * w, stand + 0.12, -d * 0.2]} material={f.green}>
          <coneGeometry args={[0.04, 0.18, 6]} />
        </mesh>
      ))}
      <B p={[0, h - 0.07, 0]} s={[w, 0.05, d]} m={f.dark} />
    </group>
  );
}

function Rack({ w, d, h, m }: MP) {
  const f = fixed();
  const n = Math.max(4, Math.round(w / 0.1));
  return (
    <group>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B p={[sx * (w / 2 - 0.02), 0.03, 0]} s={[0.03, h - 0.03, 0.03]} m={m.primary} />
          <B p={[sx * (w / 2 - 0.02), 0, 0]} s={[0.04, 0.03, d]} m={m.primary} />
        </group>
      ))}
      <mesh position={[0, h - 0.1, 0]} rotation={[0, 0, Math.PI / 2]} material={m.primary} castShadow>
        <cylinderGeometry args={[0.012, 0.012, w - 0.04, 10]} />
      </mesh>
      {Array.from({ length: n }, (_, i) => (
        <B key={i} p={[-w / 2 + 0.07 + ((w - 0.14) * i) / Math.max(1, n - 1), h * 0.32, 0]} s={[0.05, h * 0.62 - (i % 3) * 0.1, 0.1]} m={f.books[i % f.books.length]} />
      ))}
    </group>
  );
}

function Tree({ w, d, h }: MP & { m: Mats }) {
  const f = fixed();
  const star = lm("star", () => new THREE.MeshStandardMaterial({ color: "#ffe28a", emissive: "#ffd54a", emissiveIntensity: 1.4 }));
  const orn = [lm("orn-red", () => new THREE.MeshStandardMaterial({ color: "#c0392b", roughness: 0.25 })), gold()];
  const r = Math.min(w, d) / 2;
  const tiers = 4;
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={0.05} h={h * 0.12} m={f.soil} seg={10} />
      {Array.from({ length: tiers }, (_, i) => {
        const k = 1 - i * 0.22;
        const y = h * 0.1 + i * h * 0.19;
        return (
          <mesh key={i} position={[0, y + h * 0.15, 0]} material={f.green} castShadow>
            <coneGeometry args={[r * k, h * 0.34, 14]} />
          </mesh>
        );
      })}
      {Array.from({ length: 14 }, (_, i) => {
        const a = i * 2.4;
        const t = (i + 1) / 15;
        const rr = r * (1 - t * 0.85) * 0.8;
        return (
          <mesh key={i} position={[Math.cos(a) * rr, h * 0.14 + t * h * 0.62, Math.sin(a) * rr]} material={orn[i % 2]}>
            <sphereGeometry args={[0.028, 8, 6]} />
          </mesh>
        );
      })}
      <mesh position={[0, h - 0.04, 0]} material={star}>
        <octahedronGeometry args={[0.06, 0]} />
      </mesh>
    </group>
  );
}

function GrandClock({ w, d, h, m }: MP) {
  const f = fixed();
  const g = gold();
  return (
    <group>
      <B p={[0, 0, 0]} s={[w, h * 0.12, d]} m={m.primary} />
      <B p={[0, h * 0.12, 0]} s={[w * 0.82, h * 0.62, d * 0.9]} m={m.accent} />
      <B p={[0, h * 0.74, 0]} s={[w, h * 0.22, d]} m={m.primary} r={0.01} />
      <B p={[0, h * 0.96, 0]} s={[w * 1.06, h * 0.04, d * 1.06]} m={m.primary} />
      <mesh position={[0, h * 0.85, d / 2 + 0.004]} rotation={[Math.PI / 2, 0, 0]} material={f.white}>
        <cylinderGeometry args={[w * 0.36, w * 0.36, 0.012, 28]} />
      </mesh>
      <B p={[0, h * 0.85, d / 2 + 0.014]} s={[0.012, w * 0.28, 0.006]} m={f.dark} />
      <B p={[0.03, h * 0.85, d / 2 + 0.014]} s={[w * 0.2, 0.012, 0.006]} m={f.dark} />
      <B p={[0, h * 0.2, d / 2 + 0.003]} s={[w * 0.5, h * 0.46, 0.008]} m={f.glass} />
      <mesh position={[0, h * 0.28, d / 2 - 0.02]} rotation={[Math.PI / 2, 0, 0]} material={g}>
        <cylinderGeometry args={[w * 0.12, w * 0.12, 0.01, 18]} />
      </mesh>
    </group>
  );
}

/** Wall art. variant (catalogue `seats`): 0 framed painting, 1 round wall clock, 2 round mirror. */
function WallArt({ w, d, h, m, seats }: MP) {
  const f = fixed();
  const v = seats ?? 0;
  if (v === 0) {
    return (
      <group>
        <B p={[0, 0, 0]} s={[w, h, d]} m={m.primary} r={0.004} />
        <B p={[0, 0.03, d / 2 + 0.002]} s={[w - 0.07, h - 0.06, 0.006]} m={f.white} />
        <B p={[-w * 0.15, h * 0.2, d / 2 + 0.006]} s={[w * 0.32, h * 0.4, 0.004]} m={m.accent} />
        <B p={[w * 0.18, h * 0.32, d / 2 + 0.006]} s={[w * 0.26, h * 0.3, 0.004]} m={f.green} />
        <B p={[0, h * 0.12, d / 2 + 0.01]} s={[w * 0.6, 0.012, 0.004]} m={f.dark} />
      </group>
    );
  }
  const r = Math.min(w, h) / 2;
  return (
    <group position={[0, h / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.primary} castShadow>
        <cylinderGeometry args={[r, r, d, 36]} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.002]} rotation={[Math.PI / 2, 0, 0]} material={v === 2 ? lm("wall-mirror", () => new THREE.MeshStandardMaterial({ color: "#dfe8ec", metalness: 0.55, roughness: 0.08 })) : f.white}>
        <cylinderGeometry args={[r * 0.88, r * 0.88, 0.004, 36]} />
      </mesh>
      {v === 1 && (
        <>
          <B p={[0, 0, d / 2 + 0.006]} s={[0.012, r * 0.62, 0.004]} m={f.dark} />
          <B p={[r * 0.18, 0, d / 2 + 0.006]} s={[r * 0.46, 0.012, 0.004]} m={f.dark} />
        </>
      )}
    </group>
  );
}

/* ---------- registry ---------- */

export function FurnitureModel({ item }: { item: PlacedItem }) {
  const cat = getCatalogItem(item.catalogId);
  const m = useFurnitureMaterials(item.color, item.material, item.roughness, item.detail !== false, item.textureUrl);
  if (!cat) return null;
  const p: MP = { w: item.width, d: item.depth, h: item.height, m, seats: cat.seats };
  switch (cat.model) {
    case "sofa":
      return <SofaBlock {...p} seats={cat.seats ?? 3} />;
    case "armchair":
      return <SofaBlock {...p} seats={1} />;
    case "lsofa":
      return <LSofa {...p} flip={item.orientation === "left"} />;
    case "bed":
      return <Bed {...p} />;
    case "coffeeTable":
      return <Table {...p} shelf />;
    case "diningTable":
      return <Table {...p} top={0.05} />;
    case "sideTable":
      return <SideTable {...p} />;
    case "tvUnit":
      return <Cabinet {...p} legH={0.1} doors={2} />;
    case "sideboard":
      return <Cabinet {...p} legH={0.1} doors={3} drawers={1} />;
    case "storageCabinet":
      return <Cabinet {...p} legH={0.03} doors={2} tallHandles />;
    case "wardrobe":
      return <Cabinet {...p} legH={0.05} doors={Math.max(2, Math.round(item.width / 0.6))} tallHandles />;
    case "bedsideTable":
      return <Cabinet {...p} legH={0.12} doors={0} drawers={2} />;
    case "dressingTable":
      return <DressingTable {...p} />;
    case "officeDesk":
      return <OfficeDesk {...p} />;
    case "bookshelf":
      return <Bookshelf {...p} />;
    case "decorCabinet":
      return <DecorCabinet {...p} />;
    case "diningChairs": {
      const cw = item.width / 2 - 0.02;
      return (
        <group>
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * (item.width / 4), 0, 0]}>
              <Chair {...p} w={cw} />
            </group>
          ))}
        </group>
      );
    }
    case "officeChair":
      return <OfficeChair {...p} />;
    case "floorLamp":
      return <FloorLamp {...p} />;
    case "ceilingLight":
      return <CeilingLight {...p} />;
    case "rug":
      return <Rug {...p} />;
    case "plant":
      return <PlantWithPot {...p} />;
    case "ottoman":
      return <Ottoman {...p} />;
    case "barStool":
      return <BarStool {...p} />;
    case "chair":
      return <SingleChair {...p} />;
    case "lDesk":
      return <LDesk {...p} flip={item.orientation === "left"} />;
    case "drawers":
      return <Drawers {...p} />;
    case "fridge":
      return <Fridge {...p} />;
    case "stove":
      return <Stove {...p} />;
    case "washer":
      return <Washer {...p} />;
    case "kitchenBase":
      return <KitchenBase {...p} doors={Math.max(1, Math.round(item.width / 0.45))} />;
    case "sink":
      return <SinkUnit {...p} />;
    case "wallCabinet":
      return <WallCabinet {...p} />;
    case "bathtub":
      return <Bathtub {...p} />;
    case "shower":
      return <Shower {...p} />;
    case "toilet":
      return <Toilet {...p} />;
    case "vanity":
      return <Vanity {...p} />;
    case "crib":
      return <Crib {...p} />;
    case "bunkBed":
      return <BunkBed {...p} />;
    case "mirror":
      return <Mirror {...p} />;
    case "coatStand":
      return <CoatStand {...p} />;
    case "piano":
      return <Piano {...p} />;
    case "shoeRack":
      return <ShoeRack {...p} />;
    case "glb":
      return <GlbModel item={item} />;
    case "appliance":
      return <Appliance {...p} />;
    case "ac":
      return <Ac {...p} />;
    case "ceilingFan":
      return <CeilingFan {...p} />;
    case "standFan":
      return <StandFan {...p} />;
    case "beanbag":
      return <BeanBag {...p} />;
    case "basket":
      return <Basket {...p} />;
    case "screen":
      return <Screen {...p} />;
    case "fireplace":
      return <Fireplace {...p} />;
    case "jhula":
      return <Jhula {...p} />;
    case "curtain":
      return <Curtain {...p} />;
    case "treadmill":
      return <Treadmill {...p} />;
    case "aquarium":
      return <Aquarium {...p} />;
    case "rack":
      return <Rack {...p} />;
    case "tree":
      return <Tree {...p} />;
    case "grandClock":
      return <GrandClock {...p} />;
    case "wallArt":
      return <WallArt {...p} />;
    case "stairs":
      return <Stairs {...p} />;
    case "spiralStairs":
      return <SpiralStairs {...p} />;
    case "tv":
      return <Television {...p} wall={cat.seats === 1} />;
    case "mandir":
      return <Mandir {...p} wall={cat.seats === 1} />;
    case "chowki":
      return <Chowki {...p} />;
    case "deepam":
      return <Deepam {...p} />;
  }
}

function PlantWithPot(p: MP) {
  // Pot uses the item's primary material; the foliage stays green.
  const f = fixed();
  const r = Math.min(p.w, p.d) / 2;
  const potH = Math.min(0.35, p.h * 0.3);
  const span = p.h - potH;
  const leaves = [
    [0, 0.6, 0, 0.55],
    [0.4, 0.5, 0.15, 0.4],
    [-0.38, 0.52, -0.1, 0.42],
    [0.1, 0.4, -0.4, 0.38],
    [-0.12, 0.45, 0.4, 0.36],
    [0.05, 0.85, 0.05, 0.38],
  ];
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={r * 0.62} h={potH} m={p.m.primary} rt={r * 0.82} seg={24} />
      <Cyl p={[0, potH - 0.015, 0]} r={r * 0.78} h={0.02} m={f.soil} seg={24} />
      {leaves.map((l, i) => (
        <mesh key={i} position={[l[0] * r * 1.1, potH + l[1] * span, l[2] * r * 1.1]} scale={[1, 1.15, 1]} material={f.green} castShadow>
          <icosahedronGeometry args={[l[3] * r * 1.1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

