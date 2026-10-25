/* eslint-disable react-hooks/immutability -- R3F cameras are imperative objects */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getCatalogItem } from "@/data/furniture-catalog";
import { getRoomPolygon, itemRects, rotateLocal } from "@/lib/geometry";
import { pointInPolygon, polygonEdges } from "@/lib/roomShape";
import { useEditorStore } from "@/store/editor-store";
import { useActiveElevation } from "@/store/selectors";

export const WALK_EVENT = "roomcraft-walk";
export type WalkKey = "f" | "b" | "l" | "r";
export type WalkEventDetail = { key: WalkKey; down: boolean };

const EYE = 1.6;
const RADIUS = 0.25;

/**
 * First-person walkthrough: WASD / arrow keys (Shift to run) move at eye height, dragging looks around.
 * Walls and standing furniture block movement; the on-screen pad (touch) dispatches the same keys.
 */
export function WalkControls() {
  const eyeBase = useActiveElevation();
  const walk = useEditorStore((s) => s.walk);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef({ yaw: 0, pitch: 0, x: 0, z: 0, keys: new Set<string>(), virtual: new Set<WalkKey>() });
  const savedFov = useRef<number | null>(null);

  // enter / leave
  useEffect(() => {
    if (!walk) return;
    const st = useEditorStore.getState();
    const room = st.room;
    const poly = getRoomPolygon(room);
    // start just inside the first door (or the middle of the room), looking into the room
    let x = poly.reduce((a, p) => a + p.x, 0) / poly.length;
    let z = poly.reduce((a, p) => a + p.z, 0) / poly.length;
    let yaw = 0;
    const door = room.openings.find((o) => o.type === "door");
    const edges = polygonEdges(poly);
    if (door && edges[door.edge]) {
      const e = edges[door.edge];
      x = e.a.x + e.dir.x * door.offset - e.normal.x * 0.7;
      z = e.a.z + e.dir.z * door.offset - e.normal.z * 0.7;
      // look along the inward normal (camera forward is (-sin yaw, -cos yaw))
      yaw = Math.atan2(e.normal.x, e.normal.z);
    } else {
      yaw = Math.PI;
    }
    const s = state.current;
    s.x = x;
    s.z = z;
    s.yaw = yaw;
    s.pitch = -0.05;
    if (camera instanceof THREE.PerspectiveCamera) {
      savedFov.current = camera.fov;
      camera.fov = 72;
      camera.near = 0.05;
      camera.updateProjectionMatrix();
    }
    camera.rotation.order = "YXZ";
    invalidate();
    return () => {
      if (camera instanceof THREE.PerspectiveCamera && savedFov.current !== null) {
        camera.fov = savedFov.current;
        camera.near = 0.1;
        camera.updateProjectionMatrix();
      }
      camera.rotation.order = "XYZ";
      camera.up.set(0, 1, 0);
    };
  }, [walk, camera, invalidate]);

  // keyboard + drag-to-look + on-screen pad
  useEffect(() => {
    if (!walk) return;
    const s = state.current;
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        s.keys.add(k);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => s.keys.delete(e.key.toLowerCase());
    const blur = () => s.keys.clear();
    let drag: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY };
      gl.domElement.setPointerCapture?.(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      if (!drag) return;
      s.yaw -= (e.clientX - drag.x) * 0.0045;
      s.pitch = Math.max(-1.25, Math.min(1.25, s.pitch - (e.clientY - drag.y) * 0.0045));
      drag = { x: e.clientX, y: e.clientY };
      invalidate();
    };
    const pu = () => {
      drag = null;
    };
    const pad = (e: Event) => {
      const d = (e as CustomEvent<WalkEventDetail>).detail;
      if (d.down) s.virtual.add(d.key);
      else s.virtual.delete(d.key);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener(WALK_EVENT, pad);
    const el = gl.domElement;
    el.addEventListener("pointerdown", pd);
    el.addEventListener("pointermove", pm);
    el.addEventListener("pointerup", pu);
    el.addEventListener("pointercancel", pu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener(WALK_EVENT, pad);
      el.removeEventListener("pointerdown", pd);
      el.removeEventListener("pointermove", pm);
      el.removeEventListener("pointerup", pu);
      el.removeEventListener("pointercancel", pu);
      s.keys.clear();
      s.virtual.clear();
    };
  }, [walk, gl, invalidate]);

  useFrame((_, dt) => {
    if (!walk) return;
    const s = state.current;
    const k = s.keys;
    const v = s.virtual;
    const fwd = (k.has("w") || k.has("arrowup") || v.has("f") ? 1 : 0) - (k.has("s") || k.has("arrowdown") || v.has("b") ? 1 : 0);
    const strafe = (k.has("d") || k.has("arrowright") || v.has("r") ? 1 : 0) - (k.has("a") || k.has("arrowleft") || v.has("l") ? 1 : 0);
    if (fwd || strafe) {
      const speed = (k.has("shift") ? 3.2 : 1.4) * Math.min(dt, 0.05);
      const fx = -Math.sin(s.yaw);
      const fz = -Math.cos(s.yaw);
      const rx = Math.cos(s.yaw);
      const rz = -Math.sin(s.yaw);
      const len = Math.hypot(fwd, strafe) || 1;
      const mx = ((fx * fwd + rx * strafe) / len) * speed;
      const mz = ((fz * fwd + rz * strafe) / len) * speed;
      const st = useEditorStore.getState();
      const free = (px: number, pz: number) => canStand(px, pz, st.room, st.items);
      if (free(s.x + mx, s.z + mz)) {
        s.x += mx;
        s.z += mz;
      } else if (free(s.x + mx, s.z)) s.x += mx;
      else if (free(s.x, s.z + mz)) s.z += mz;
      invalidate();
    }
    camera.position.set(s.x, eyeBase + EYE, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");
  });

  return null;
}

function canStand(x: number, z: number, room: ReturnType<typeof useEditorStore.getState>["room"], items: ReturnType<typeof useEditorStore.getState>["items"]) {
  const poly = getRoomPolygon(room);
  for (const [dx, dz] of [
    [0, 0],
    [RADIUS, 0],
    [-RADIUS, 0],
    [0, RADIUS],
    [0, -RADIUS],
  ]) {
    if (!pointInPolygon({ x: x + dx, z: z + dz }, poly, 0.02)) return false;
  }
  for (const it of items) {
    const cat = getCatalogItem(it.catalogId);
    if (!cat || cat.ignoreCollision || (cat.elevation ?? 0) > 0 || it.height < 0.3) continue;
    for (const r of itemRects(it)) {
      const p = rotateLocal(x - r.cx, z - r.cz, -r.rot);
      if (Math.abs(p.x) < r.hw + RADIUS && Math.abs(p.z) < r.hd + RADIUS) return false;
    }
  }
  return true;
}
