/* eslint-disable react-hooks/immutability -- OrbitControls is an imperative object */
"use client";

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getCatalogItem } from "@/data/furniture-catalog";
import { localRects } from "@/lib/footprint";
import { degToRad } from "@/lib/measurements";
import { resolvePlacement } from "@/lib/placement";
import { makeBlobTexture } from "@/lib/textures";
import { useEditorStore } from "@/store/editor-store";
import { useActiveElevation, useLayoutIssues } from "@/store/selectors";
import type { PlacedItem } from "@/types/furniture";
import { FurnitureModel } from "../furniture/procedural";

type Status = "ok" | "overlap" | "outside";
const STATUS_COLOR: Record<Status, string> = { ok: "#3b82f6", overlap: "#dc2626", outside: "#f59e0b" };

interface ObjProps {
  item: PlacedItem;
  selected: boolean;
  status: Status;
  ceilingY: number;
  blob: THREE.Texture;
  onSelect: (id: string, additive: boolean) => void;
  onDragStart: (e: ThreeEvent<PointerEvent>, item: PlacedItem) => void;
  /** Other floors: no selection, dragging or hover cursor. */
  inert?: boolean;
}

const FurnitureObject = memo(function FurnitureObject({ item, selected, status, ceilingY, blob, onSelect, onDragStart, inert }: ObjProps) {
  const cat = getCatalogItem(item.catalogId);
  const elevation = cat?.mount === "ceiling" ? ceilingY - item.height : (cat?.elevation ?? 0);
  const rects = useMemo(
    () => localRects({ model: cat?.model ?? "rug", width: item.width, depth: item.depth, seats: cat?.seats, orientation: item.orientation }),
    [cat, item.width, item.depth, item.orientation],
  );
  const edges = useMemo(() => {
    const box = new THREE.BoxGeometry(item.width, item.height, item.depth);
    const e = new THREE.EdgesGeometry(box);
    box.dispose();
    return e;
  }, [item.width, item.height, item.depth]);
  useEffect(() => () => edges.dispose(), [edges]);

  const flat = cat?.model === "rug" || cat?.mount === "ceiling" || (cat?.elevation ?? 0) > 0;
  const showMarker = selected || status !== "ok";
  const markerColor = STATUS_COLOR[status === "ok" ? "ok" : status];

  return (
    <group position={[item.x, 0, item.z]} rotation={[0, -degToRad(item.rotation), 0]}>
      {!flat &&
        rects.map((r, i) => (
          <mesh key={`ao${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[r.cx, 0.003, r.cz]} renderOrder={1}>
            <planeGeometry args={[r.hw * 2 + 0.25, r.hd * 2 + 0.25]} />
            <meshBasicMaterial map={blob} transparent opacity={0.55} depthWrite={false} />
          </mesh>
        ))}
      {showMarker &&
        rects.map((r, i) => (
          <mesh key={`m${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[r.cx, 0.006, r.cz]} renderOrder={2}>
            <planeGeometry args={[r.hw * 2, r.hd * 2]} />
            <meshBasicMaterial color={markerColor} transparent opacity={status === "ok" ? 0.22 : 0.4} depthWrite={false} />
          </mesh>
        ))}
      <group
        position={[0, elevation, 0]}
        onClick={inert ? undefined : (e) => {
          e.stopPropagation();
          if (useEditorStore.getState().walk) return;
          const ev = e.nativeEvent as MouseEvent;
          onSelect(item.id, ev.shiftKey || ev.ctrlKey || ev.metaKey);
        }}
        onPointerDown={inert ? undefined : (e) => {
          if (e.button === 0 && selected && !item.locked && !useEditorStore.getState().walk) onDragStart(e, item);
        }}
        onPointerOver={inert ? undefined : (e) => {
          e.stopPropagation();
          document.body.style.cursor = selected ? "move" : "pointer";
        }}
        onPointerOut={inert ? undefined : () => {
          document.body.style.cursor = "";
        }}
      >
        <FurnitureModel item={item} />
      </group>
      {selected && (
        <lineSegments geometry={edges} position={[0, elevation + item.height / 2, 0]}>
          <lineBasicMaterial color={status === "ok" ? "#2563eb" : markerColor} />
        </lineSegments>
      )}
    </group>
  );
});

export function Furniture3D() {
  const items = useEditorStore((s) => s.items);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const wallHeight = useEditorStore((s) => s.room.wallHeight);
  const { map: issues } = useLayoutIssues();
  const blob = useMemo(() => makeBlobTexture(), []);
  useEffect(() => () => blob.dispose(), [blob]);

  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const raycaster = useThree((s) => s.raycaster);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const elevation = useActiveElevation();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation), [elevation]);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const onSelect = useCallback((id: string, additive: boolean) => {
    const st = useEditorStore.getState();
    if (additive) st.toggleSelect(id);
    else st.select(id);
  }, []);

  const onDragStart = useCallback(
    (e: ThreeEvent<PointerEvent>, item: PlacedItem) => {
      e.stopPropagation();
      const toGround = (clientX: number, clientY: number) => {
        const rect = gl.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      };
      const start = toGround(e.nativeEvent.clientX, e.nativeEvent.clientY);
      if (!start) return;
      const offX = item.x - start.x;
      const offZ = item.z - start.z;
      const st = useEditorStore.getState();
      const origins: Record<string, { x: number; z: number }> = {};
      for (const it of st.items) if (st.selectedIds.includes(it.id) && !it.locked) origins[it.id] = { x: it.x, z: it.z };
      if (!origins[item.id]) origins[item.id] = { x: item.x, z: item.z };
      st.beginTransient();
      if (controls) controls.enabled = false;

      const move = (ev: PointerEvent) => {
        const hit = toGround(ev.clientX, ev.clientY);
        if (!hit) return;
        const s = useEditorStore.getState();
        const cur = s.items.find((i) => i.id === item.id);
        if (!cur) return;
        const res = resolvePlacement(
          { ...cur, x: origins[item.id].x, z: origins[item.id].z },
          hit.x + offX,
          hit.z + offZ,
          s.items.filter((o) => !(o.id in origins)),
          s.room,
          { snapGrid: s.snapGrid, snapWalls: s.snapWalls, align: s.alignGuides },
        );
        s.moveGroupTransient(origins, res.x - origins[item.id].x, res.z - origins[item.id].z);
        s.setGuides(res.guides);
      };
      const up = () => {
        cleanup.current?.();
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (controls) controls.enabled = true;
        useEditorStore.getState().endTransient();
        cleanup.current = null;
      };
      cleanup.current = stop;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [camera, gl, raycaster, controls, plane],
  );

  return (
    <group>
      {items.map((it) => {
        const iss = issues.get(it.id);
        const status: Status = iss?.overlaps.length ? "overlap" : iss?.outside ? "outside" : "ok";
        return (
          <FurnitureObject
            key={it.id}
            item={it}
            selected={selectedIds.includes(it.id)}
            status={status}
            ceilingY={wallHeight}
            blob={blob}
            onSelect={onSelect}
            onDragStart={onDragStart}
          />
        );
      })}
    </group>
  );
}

const noop = () => undefined;

/** Furniture of another floor: visible but not interactive. */
export function FurnitureStatic({ items, wallHeight }: { items: PlacedItem[]; wallHeight: number }) {
  const blob = useMemo(() => makeBlobTexture(), []);
  useEffect(() => () => blob.dispose(), [blob]);
  return (
    <group>
      {items.map((it) => (
        <FurnitureObject key={it.id} item={it} selected={false} status="ok" ceilingY={wallHeight} blob={blob} onSelect={noop} onDragStart={noop} inert />
      ))}
    </group>
  );
}
