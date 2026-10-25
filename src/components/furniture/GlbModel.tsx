"use client";

import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { modelUrl } from "@/lib/custom-models";
import type { PlacedItem } from "@/types/furniture";

/** Stand-in box shown while a model loads, or when its file is missing / unreadable. */
function Placeholder({ item, tone }: { item: PlacedItem; tone: "loading" | "missing" }) {
  return (
    <mesh position={[0, item.height / 2, 0]} castShadow>
      <boxGeometry args={[item.width, item.height, item.depth]} />
      <meshStandardMaterial color={tone === "missing" ? "#c0605a" : "#b9b6b0"} transparent opacity={0.45} wireframe={tone === "missing"} />
    </mesh>
  );
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Loaded({ url, item }: { url: string; item: PlacedItem }) {
  // draco=false: never fetch the decoder from a CDN (the app loads no remote assets)
  const gltf = useGLTF(url, false);
  const { box, root } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(gltf.scene);
    return { box: b, root: gltf.scene.clone(true) };
  }, [gltf]);
  useEffect(() => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [root]);
  const size = box.getSize(new THREE.Vector3());
  const sx = item.width / Math.max(size.x, 1e-6);
  const sy = item.height / Math.max(size.y, 1e-6);
  const sz = item.depth / Math.max(size.z, 1e-6);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  return (
    <group scale={[sx, sy, sz]} position={[-cx * sx, -box.min.y * sy, -cz * sz]}>
      <primitive object={root} />
    </group>
  );
}

/** A user-uploaded GLB model, scaled to the item's width / depth / height. */
export function GlbModel({ item }: { item: PlacedItem }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void modelUrl(item.catalogId).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [item.catalogId]);
  if (url === undefined) return <Placeholder item={item} tone="loading" />;
  if (url === null) return <Placeholder item={item} tone="missing" />;
  return (
    <Boundary fallback={<Placeholder item={item} tone="missing" />}>
      <Suspense fallback={<Placeholder item={item} tone="loading" />}>
        <Loaded url={url} item={item} />
      </Suspense>
    </Boundary>
  );
}
