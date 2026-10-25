"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { shade } from "@/lib/color";
import { formatLen } from "@/lib/measurements";
import { getRoomPolygon } from "@/lib/geometry";
import { SLAB } from "@/lib/levels";
import { outerCorners, roomEdges, type Edge, type P2 } from "@/lib/roomShape";
import { makeFloorTexture, makeWallTexture } from "@/lib/textures";
import { useEditorStore } from "@/store/editor-store";
import type { Opening, RoomConfig, WallMode } from "@/types/room";

/* ---------- wall geometry ---------- */

interface Piece {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Splits a wall into solid rectangles around its door / window openings. */
function wallPieces(len: number, H: number, openings: Opening[]): Piece[] {
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const out: Piece[] = [];
  let cursor = 0;
  for (const o of sorted) {
    const u0 = Math.max(cursor, o.offset - o.width / 2);
    const u1 = Math.min(len, o.offset + o.width / 2);
    if (u1 <= u0) continue;
    if (u0 > cursor + 1e-4) out.push({ u0: cursor, u1: u0, v0: 0, v1: H });
    if (o.sill > 1e-3) out.push({ u0, u1, v0: 0, v1: o.sill });
    if (o.sill + o.height < H - 1e-3) out.push({ u0, u1, v0: o.sill + o.height, v1: H });
    cursor = u1;
  }
  if (cursor < len - 1e-4) out.push({ u0: cursor, u1: len, v0: 0, v1: H });
  return out;
}

type V = [number, number, number];

/** Prism over a plan quad (A,B inner side, C,D outer side) between heights v0..v1. Group 0 = inner face, group 1 = the rest. */
function buildPrism(A: P2, B: P2, C: P2, D: P2, v0: number, v1: number, u0: number, u1: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const groups: { start: number; count: number; mat: number }[] = [];
  const centre: V = [(A.x + B.x + C.x + D.x) / 4, (v0 + v1) / 2, (A.z + B.z + C.z + D.z) / 4];
  const add = (pts: V[], uvs: [number, number][], mat: number) => {
    let p = pts;
    let t = uvs;
    const e1: V = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const e2: V = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    let n: V = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const fc: V = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, (p[0][2] + p[2][2]) / 2];
    if (n[0] * (fc[0] - centre[0]) + n[1] * (fc[1] - centre[1]) + n[2] * (fc[2] - centre[2]) < 0) {
      p = [p[0], p[3], p[2], p[1]];
      t = [t[0], t[3], t[2], t[1]];
      n = [-n[0], -n[1], -n[2]];
    }
    const len = Math.hypot(...n) || 1;
    const base = pos.length / 3;
    const start = idx.length;
    p.forEach((q, i) => {
      pos.push(...q);
      nor.push(n[0] / len, n[1] / len, n[2] / len);
      uv.push(...t[i]);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    const last = groups[groups.length - 1];
    if (last && last.mat === mat && last.start + last.count === start) last.count += 6;
    else groups.push({ start, count: 6, mat });
  };
  const at = (q: P2, y: number): V => [q.x, y, q.z];
  const q0: [number, number][] = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const flat: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  // collect inner face last-added groups ordering: draw inner first so group 0 comes first
  add([at(A, v0), at(B, v0), at(B, v1), at(A, v1)], q0, 0);
  add([at(D, v0), at(C, v0), at(C, v1), at(D, v1)], flat, 1);
  add([at(A, v0), at(D, v0), at(D, v1), at(A, v1)], flat, 1);
  add([at(B, v0), at(C, v0), at(C, v1), at(B, v1)], flat, 1);
  add([at(A, v1), at(B, v1), at(C, v1), at(D, v1)], flat, 1);
  if (v0 > 1e-3) add([at(A, v0), at(B, v0), at(C, v0), at(D, v0)], flat, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // merge consecutive groups of the same material only; keep original order requirement (inner = group 0)
  g.clearGroups();
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.mat);
  return g;
}

const pointAt = (e: Edge, u: number, n = 0): P2 => ({
  x: e.a.x + e.dir.x * u + e.normal.x * n,
  z: e.a.z + e.dir.z * u + e.normal.z * n,
});

function skirtingSegments(len: number, doors: { c: number; w: number }[]) {
  const cuts = [...doors].sort((a, b) => a.c - b.c);
  const segs: [number, number][] = [];
  let cursor = 0;
  for (const d of cuts) {
    const a = d.c - d.w / 2;
    if (a > cursor) segs.push([cursor, a]);
    cursor = Math.max(cursor, d.c + d.w / 2);
  }
  if (cursor < len) segs.push([cursor, len]);
  return segs;
}

interface WallProps {
  edge: Edge;
  room: RoomConfig;
  outerStart: P2;
  outerEnd: P2;
}

const Wall = memo(function Wall({ edge, room, outerStart, outerEnd }: WallProps) {
  const t = room.wallThickness;
  const H = room.wallHeight;
  const openings = useMemo(() => room.openings.filter((o) => o.edge === edge.index), [room.openings, edge.index]);
  const color = room.wallColors[String(edge.index)] ?? room.wallColor;
  const pattern = room.wallPatterns[String(edge.index)] ?? room.wallPattern;

  const geometries = useMemo(() => {
    const pieces = wallPieces(edge.length, H, openings);
    return pieces.map((pc) => {
      const A = pointAt(edge, pc.u0);
      const B = pointAt(edge, pc.u1);
      const D = pc.u0 <= 1e-6 ? outerStart : pointAt(edge, pc.u0, t);
      const C = pc.u1 >= edge.length - 1e-6 ? outerEnd : pointAt(edge, pc.u1, t);
      return buildPrism(A, B, C, D, pc.v0, pc.v1, pc.u0, pc.u1);
    });
  }, [edge, H, openings, outerStart, outerEnd, t]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  const tex = useMemo(() => makeWallTexture(pattern, color, H), [pattern, color, H]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const inner = useMemo(() => new THREE.MeshStandardMaterial({ color: tex ? "#ffffff" : color, map: tex, roughness: 0.95 }), [color, tex]);
  const plain = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }), [color]);
  const skirt = useMemo(() => new THREE.MeshStandardMaterial({ color: shade(color, 0.35), roughness: 0.6 }), [color]);
  useEffect(() => () => inner.dispose(), [inner]);
  useEffect(() => () => plain.dispose(), [plain]);
  useEffect(() => () => skirt.dispose(), [skirt]);

  const segs = skirtingSegments(
    edge.length,
    openings.filter((o) => o.type === "door").map((o) => ({ c: o.offset, w: o.width })),
  );
  const rotY = (-edge.angleDeg * Math.PI) / 180;

  return (
    <group name={`wall-${edge.index}`}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={[inner, plain]} castShadow receiveShadow />
      ))}
      {segs.map(([a, b], i) => {
        const mid = pointAt(edge, (a + b) / 2, -0.007);
        return (
          <mesh key={i} position={[mid.x, 0.045, mid.z]} rotation={[0, rotY, 0]} material={skirt} receiveShadow castShadow>
            <boxGeometry args={[b - a, 0.09, 0.014]} />
          </mesh>
        );
      })}
      {openings.map((o) => {
        const c = pointAt(edge, o.offset);
        return (
          <group key={o.id} position={[c.x, 0, c.z]} rotation={[0, rotY, 0]}>
            <OpeningMesh o={o} t={t} />
          </group>
        );
      })}
    </group>
  );
});

const frameMat = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.5 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: "#bcd8e6", transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0 });
const doorMat = new THREE.MeshStandardMaterial({ color: "#a47850", roughness: 0.55 });
const handleMat = new THREE.MeshStandardMaterial({ color: "#b8bcc2", roughness: 0.3, metalness: 0.9 });

/** Local frame: x along the wall, y up, z toward the room interior; the wall slab occupies z ∈ [-t, 0]. */
function OpeningMesh({ o, t }: { o: Opening; t: number }) {
  const fw = 0.05;
  const depth = t + 0.02;
  return (
    <group position={[0, o.sill + o.height / 2, -t / 2]}>
      <mesh material={frameMat} position={[0, o.height / 2 - fw / 2, 0]} castShadow>
        <boxGeometry args={[o.width, fw, depth]} />
      </mesh>
      {o.type === "window" && (
        <mesh material={frameMat} position={[0, -o.height / 2 + fw / 2, 0.03]} castShadow>
          <boxGeometry args={[o.width, fw, depth + 0.06]} />
        </mesh>
      )}
      <mesh material={frameMat} position={[-o.width / 2 + fw / 2, 0, 0]} castShadow>
        <boxGeometry args={[fw, o.height, depth]} />
      </mesh>
      <mesh material={frameMat} position={[o.width / 2 - fw / 2, 0, 0]} castShadow>
        <boxGeometry args={[fw, o.height, depth]} />
      </mesh>
      {o.type === "window" ? (
        <>
          <mesh material={glassMat}>
            <boxGeometry args={[o.width - 2 * fw, o.height - 2 * fw, 0.012]} />
          </mesh>
          <mesh material={frameMat}>
            <boxGeometry args={[0.03, o.height - 2 * fw, 0.03]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh material={doorMat} position={[0, -fw / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[o.width - 2 * fw, o.height - fw, 0.04]} />
          </mesh>
          <mesh material={handleMat} position={[o.width / 2 - fw - 0.08, -0.05, 0.05]}>
            <boxGeometry args={[0.12, 0.025, 0.03]} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Text label drawn to a canvas and shown as a sprite (no DOM overlay, no remote fonts). */
function Label3D({ text, position, size = 0.2 }: { text: string; position: [number, number, number]; size?: number }) {
  const { texture, aspect } = useMemo(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    const font = "600 44px ui-sans-serif, system-ui, sans-serif";
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 40;
    c.width = w;
    c.height = 76;
    g.font = font;
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath();
    g.roundRect(0, 0, w, 76, 16);
    g.fill();
    g.fillStyle = "#404040";
    g.textBaseline = "middle";
    g.fillText(text, 20, 40);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: w / 76 };
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  );
}

function usePolygonGeometry(room: RoomConfig, up: boolean, holes: P2[][] = []) {
  const poly = getRoomPolygon(room);
  const key = holes.map((h) => h.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join(";")).join("|");
  const geo = useMemo(() => {
    const sign = up ? -1 : 1;
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, sign * p.z)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, sign * p.z))));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poly, up, key]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/** The concrete slab under an upper floor (with the stairwell cut out). */
function useSlabGeometry(room: RoomConfig, holes: P2[][]) {
  const poly = getRoomPolygon(room);
  const key = holes.map((h) => h.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join(";")).join("|");
  const geo = useMemo(() => {
    const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.z)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.z))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poly, key]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

interface RoomProps {
  room: RoomConfig;
  /** Height of this level's floor above the ground, metres. */
  y?: number;
  wallMode: WallMode;
  ceiling?: boolean;
  labels?: boolean;
  /** Stairwell openings cut through this floor (from the staircase on the floor below). */
  floorHoles?: P2[][];
  /** Stairwell openings cut through this floor's ceiling (this floor's own staircase). */
  ceilingHoles?: P2[][];
  /** Draw the slab under this floor (upper floors). */
  slab?: boolean;
}

export function RoomView({ room, y = 0, wallMode, ceiling = true, labels = true, floorHoles = [], ceilingHoles = [], slab = false }: RoomProps) {
  const refs = useRef<Record<number, THREE.Group | null>>({});
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const edges = useMemo(() => roomEdges(room), [room]);
  const corners = useMemo(() => outerCorners(edges, room.wallThickness), [edges, room.wallThickness]);
  const floorGeo = usePolygonGeometry(room, true, floorHoles);
  const ceilGeo = usePolygonGeometry(room, false, ceilingHoles);
  const slabGeo = useSlabGeometry(room, floorHoles);

  const floorTex = useMemo(() => makeFloorTexture(room.floorMaterial, room.floorColor), [room.floorMaterial, room.floorColor]);
  useEffect(() => () => floorTex?.dispose(), [floorTex]);

  // In "auto" mode, hide walls between the camera and the room so the interior stays visible.
  useFrame(() => {
    const p = camera.position;
    for (const e of edges) {
      const g = refs.current[e.index];
      if (!g) continue;
      const outside = (p.x - e.a.x) * e.normal.x + (p.z - e.a.z) * e.normal.z > room.wallThickness * 0.5;
      const visible = wallMode === "hidden" ? false : wallMode === "auto" ? !outside : true;
      if (g.visible !== visible) g.visible = visible;
      const sy = wallMode === "low" ? 0.12 : 1;
      if (g.scale.y !== sy) g.scale.y = sy;
    }
  });
  useEffect(() => {
    invalidate();
  }, [wallMode, room, invalidate]);

  const showCeiling = ceiling && (wallMode === "full" || wallMode === "auto");
  const t = room.wallThickness;

  return (
    <group position={[0, y, 0]}>
      <mesh geometry={floorGeo} receiveShadow>
        <meshStandardMaterial
          key={floorTex ? "tex" : "plain"}
          map={floorTex}
          color={floorTex ? "#ffffff" : room.floorColor}
          roughness={room.floorMaterial === "wood" ? 0.55 : room.floorMaterial === "tile" ? 0.3 : 0.9}
        />
      </mesh>
      {slab && (
        <mesh geometry={slabGeo} position={[0, -SLAB, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#d6d3cd" roughness={0.95} />
        </mesh>
      )}
      {showCeiling && (
        <mesh geometry={ceilGeo} position={[0, room.wallHeight, 0]}>
          <meshStandardMaterial color="#f7f5f1" roughness={1} />
        </mesh>
      )}
      {edges.map((e, i) => (
        <group
          key={e.index}
          ref={(g) => {
            refs.current[e.index] = g;
          }}
        >
          <Wall edge={e} room={room} outerStart={corners[i]} outerEnd={corners[(i + 1) % corners.length]} />
        </group>
      ))}
      {labels && (
        <>
          <Label3D text={formatLen(room.length)} position={[room.length / 2, 0.05, room.width + t + 0.35]} />
          <Label3D text={formatLen(room.width)} position={[-t - 0.5, 0.05, room.width / 2]} />
        </>
      )}
    </group>
  );
}

export function Room3D({ y = 0, floorHoles = [], ceilingHoles = [], ceiling = true }: { y?: number; floorHoles?: P2[][]; ceilingHoles?: P2[][]; ceiling?: boolean }) {
  const room = useEditorStore((s) => s.room);
  const wallMode = useEditorStore((s) => s.wallMode);
  const walk = useEditorStore((s) => s.walk);
  useEditorStore((s) => s.units); // re-render labels when the unit changes
  return <RoomView room={room} y={y} wallMode={wallMode} labels={!walk} floorHoles={floorHoles} ceilingHoles={ceilingHoles} slab={y > 0} ceiling={ceiling} />;
}
