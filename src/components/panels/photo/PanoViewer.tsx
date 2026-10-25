"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

function Sphere({ src }: { src: string }) {
  const invalidate = useThree((s) => s.invalidate);
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(src, () => invalidate());
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [src, invalidate]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[10, 64, 48]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} />
    </mesh>
  );
}

/**
 * Interactive viewer for an equirectangular (2:1) 360° photo: drag to look around, wheel / buttons to zoom.
 * Not a video or a set of stills — the photo is mapped onto the inside of a sphere around the camera.
 */
export function PanoViewer({ src }: { src: string }) {
  const [fov, setFov] = useState(75);
  const [auto, setAuto] = useState(false);
  return (
    <div
      className="relative h-72 w-full touch-none overflow-hidden rounded-xl bg-black"
      onWheel={(e) => setFov((f) => Math.min(100, Math.max(25, f + e.deltaY * 0.05)))}
    >
      <Canvas frameloop={auto ? "always" : "demand"} dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault fov={fov} position={[0, 0, 0.01]} />
        <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.4} autoRotate={auto} autoRotateSpeed={-1.2} target={[0, 0, 0]} />
        <Sphere src={src} />
      </Canvas>
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">360° photo — drag to look around</div>
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button className="rounded bg-black/55 px-2 py-1 text-xs text-white hover:bg-black/75" onClick={() => setFov((f) => Math.max(25, f - 10))} aria-label="Zoom in">
          +
        </button>
        <button className="rounded bg-black/55 px-2 py-1 text-xs text-white hover:bg-black/75" onClick={() => setFov((f) => Math.min(100, f + 10))} aria-label="Zoom out">
          −
        </button>
        <button className={`rounded px-2 py-1 text-xs text-white ${auto ? "bg-accent" : "bg-black/55 hover:bg-black/75"}`} onClick={() => setAuto((a) => !a)}>
          Auto-rotate
        </button>
      </div>
    </div>
  );
}
