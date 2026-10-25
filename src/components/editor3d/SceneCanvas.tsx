"use client";

import { Environment, Lightformer, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { getCatalogItem } from "@/data/furniture-catalog";
import { lampsActive, sunState } from "@/lib/lighting";
import { setLampGlow } from "../furniture/procedural";
import { presetPose } from "@/lib/camera";
import { useEditorStore } from "@/store/editor-store";
import { CameraRig } from "./CameraRig";
import { WalkControls } from "./WalkControls";
import { Levels3D } from "./Levels3D";
import { Overlay3D } from "./Overlay3D";

const MAX_LAMPS = 6;

function Lights() {
  const length = useEditorStore((s) => s.room.length);
  const width = useEditorStore((s) => s.room.width);
  const wallHeight = useEditorStore((s) => s.room.wallHeight);
  const items = useEditorStore((s) => s.items);
  const hour = useEditorStore((s) => s.timeOfDay);
  const lampsMode = useEditorStore((s) => s.lampsMode);
  const invalidate = useThree((st) => st.invalidate);
  const span = Math.max(length, width);
  const sun = sunState(hour);
  const lampsOn = lampsActive(lampsMode, sun);

  const lamps = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const it of items) {
      const cat = getCatalogItem(it.catalogId);
      if (cat?.model === "floorLamp") out.push([it.x, it.height * 0.85, it.z]);
      else if (cat?.model === "ceilingLight") out.push([it.x, wallHeight - it.height - 0.1, it.z]);
      if (out.length >= MAX_LAMPS) break;
    }
    return out;
  }, [items, wallHeight]);

  useEffect(() => {
    setLampGlow(lampsOn);
    invalidate();
  }, [lampsOn, invalidate]);

  const c: [number, number, number] = [length / 2, 0, width / 2];
  const R = span * 2 + 6;
  const sunPos: [number, number, number] = [c[0] + sun.dir[0] * R, sun.dir[1] * R, c[2] + sun.dir[2] * R];
  return (
    <>
      <ambientLight intensity={sun.ambient} />
      <hemisphereLight args={["#ffffff", "#c9c2b6", sun.hemisphere]} />
      <directionalLight
        castShadow={sun.sunIntensity > 0.02}
        intensity={sun.sunIntensity}
        color={sun.sunColor}
        position={sunPos}
        target-position={c}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span * 1.1}
        shadow-camera-right={span * 1.1}
        shadow-camera-top={span * 1.1}
        shadow-camera-bottom={-span * 1.1}
        shadow-camera-near={0.5}
        shadow-camera-far={R * 2 + 10}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {sun.moonIntensity > 0.01 && <directionalLight intensity={sun.moonIntensity} color="#8fa6ff" position={[c[0] - span, span * 2, c[2] + span]} />}
      {/* lamp lights: a fixed pool, so the shader never recompiles when lamps are added or removed */}
      {Array.from({ length: MAX_LAMPS }, (_, i) => (
        <pointLight
          key={i}
          position={lamps[i] ?? [c[0], 1, c[2]]}
          intensity={lampsOn && lamps[i] ? 7 : 0}
          distance={7}
          decay={1.6}
          color="#ffd9a0"
        />
      ))}
      {/* procedural reflections for metal / leather — no remote HDRI */}
      <Environment resolution={128} frames={1} environmentIntensity={sun.environment}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
      </Environment>
    </>
  );
}

export default function SceneCanvas() {
  const room = useEditorStore((s) => s.room);
  const cameraType = useEditorStore((s) => s.cameraType);
  const autoRotate = useEditorStore((s) => s.autoRotate);
  const walk = useEditorStore((s) => s.walk);
  const inspect = useEditorStore((s) => s.inspect);
  const theme = useEditorStore((s) => s.theme);
  const hour = useEditorStore((s) => s.timeOfDay);
  const bg = sunState(hour).background;
  const initial = useMemo(() => presetPose("default", room), []); // eslint-disable-line react-hooks/exhaustive-deps
  const span = Math.max(room.length, room.width);

  return (
    <div className="relative h-full w-full touch-none" style={{ touchAction: "none" }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={autoRotate || walk ? "always" : "demand"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => useEditorStore.getState().select(null)}
      >
        <color attach="background" args={[theme === "dark" && hour >= 6 && hour <= 18 ? "#17181b" : bg]} />
        {cameraType === "perspective" ? (
          <PerspectiveCamera makeDefault fov={45} near={0.1} far={200} position={initial.position} />
        ) : (
          <OrthographicCamera makeDefault near={-50} far={200} zoom={60} position={[room.length / 2, 40, room.width / 2 + 0.001]} />
        )}
        <OrbitControls
          makeDefault
          enabled={!walk}
          enableDamping
          dampingFactor={0.12}
          autoRotate={autoRotate}
          autoRotateSpeed={1.6}
          minPolarAngle={0.02}
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={inspect === "furniture" ? 0.5 : 1}
          maxDistance={span * 4 + 6}
          zoomToCursor={false}
          target={initial.target}
        />
        <Lights />
        <Levels3D />
        <CameraRig />
        <WalkControls />
      </Canvas>
      <Overlay3D />
    </div>
  );
}
