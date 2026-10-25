"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { TEMPLATES, buildTemplate } from "@/data/templates";
import { FurnitureStatic } from "../editor3d/Furniture3D";
import { RoomView } from "../editor3d/Room3D";

/** A real, slowly rotating 3D room for the landing page (the living-room template). */
export default function Hero3D() {
  const { room, items } = useMemo(() => buildTemplate(TEMPLATES.find((t) => t.id === "living-room")!), []);
  const cx = room.length / 2;
  const cz = room.width / 2;
  return (
    <Canvas shadows dpr={[1, 1.6]} gl={{ alpha: true, antialias: true }} aria-label="Rotating 3D living room">
      <PerspectiveCamera makeDefault fov={36} position={[cx + 5.2, 4.6, cz + 6.4]} />
      <OrbitControls target={[cx, 0.7, cz]} autoRotate autoRotateSpeed={1.1} enablePan={false} enableZoom={false} minPolarAngle={0.7} maxPolarAngle={1.3} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#ffffff", "#d8cdbd", 0.6]} />
      <directionalLight
        castShadow
        position={[cx + 5, 7, cz + 3]}
        intensity={2.1}
        color="#fff1dc"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <RoomView room={room} wallMode="auto" labels={false} ceiling={false} />
      <FurnitureStatic items={items} wallHeight={room.wallHeight} />
    </Canvas>
  );
}
