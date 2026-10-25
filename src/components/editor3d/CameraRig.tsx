/* eslint-disable react-hooks/immutability -- R3F cameras/controls are imperative objects */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getCatalogItem } from "@/data/furniture-catalog";
import { inspectPose, orthoZoomToFit, presetPose, type CameraPose } from "@/lib/camera";
import { register3DCapture } from "@/lib/export";
import { useEditorStore } from "@/store/editor-store";
import { useActiveElevation } from "@/store/selectors";

interface OrbitLike {
  target: THREE.Vector3;
  update: () => void;
  enabled: boolean;
}

export const CAM_EVENT = "roomcraft-camera";
export type CamEventDetail = { type: "zoom"; factor: number } | { type: "orbit"; deg: number };

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Moves the camera for presets, inspect mode and on-screen zoom / rotate buttons. */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const room = useEditorStore((s) => s.room);
  const camCommand = useEditorStore((s) => s.camCommand);
  const cameraType = useEditorStore((s) => s.cameraType);
  const inspect = useEditorStore((s) => s.inspect);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selected = useEditorStore((s) => s.items.find((i) => i.id === s.selectedId));
  const anim = useRef<{ fp: THREE.Vector3; tp: THREE.Vector3; ft: THREE.Vector3; tt: THREE.Vector3; t: number } | null>(null);
  const elevation = useActiveElevation();
  const elevRef = useRef(elevation);
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
    elevRef.current = elevation;
  }, [room, elevation]);

  // screenshot hook for the toolbar
  useEffect(() => {
    register3DCapture(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
    return () => register3DCapture(null);
  }, [gl, scene, camera]);

  const applyPose = (pose: CameraPose, animate: boolean) => {
    if (!controls) return;
    const tp = new THREE.Vector3(pose.position[0], pose.position[1] + elevRef.current, pose.position[2]);
    const tt = new THREE.Vector3(pose.target[0], pose.target[1] + elevRef.current, pose.target[2]);
    if (!animate) {
      camera.position.copy(tp);
      controls.target.copy(tt);
      controls.update();
      anim.current = null;
      invalidate();
      return;
    }
    anim.current = { fp: camera.position.clone(), tp, ft: controls.target.clone(), tt, t: 0 };
    invalidate();
  };

  const fitOrtho = () => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = orthoZoomToFit(roomRef.current, size.width, size.height);
      camera.updateProjectionMatrix();
    }
  };

  // Camera type switched: place the new camera immediately.
  useEffect(() => {
    if (!controls) return;
    const r = roomRef.current;
    if (cameraType === "orthographic") {
      applyPose(presetPose("top", r), false);
      fitOrtho();
    } else {
      applyPose(presetPose("default", r), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, camera, cameraType]);

  // Switching floors: fly to the new floor
  useEffect(() => {
    if (!controls) return;
    applyPose(presetPose("default", roomRef.current), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevation]);

  // Preset buttons / reset
  useEffect(() => {
    if (!controls || camCommand.nonce === 0) return;
    applyPose(presetPose(camCommand.preset, roomRef.current), true);
    if (cameraType === "orthographic") fitOrtho();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camCommand.nonce]);

  // Furniture inspection
  useEffect(() => {
    if (!controls) return;
    if (inspect === "furniture" && selected) {
      const cat = getCatalogItem(selected.catalogId);
      const elev = cat?.mount === "ceiling" ? roomRef.current.wallHeight - selected.height : (cat?.elevation ?? 0);
      applyPose(inspectPose(selected.x, selected.z, selected.height, Math.max(selected.width, selected.depth), elev), true);
    } else if (inspect === "room") {
      applyPose(presetPose("default", roomRef.current), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspect, selectedId]);

  // Keep the room fitted when its size changes and the ortho view is active.
  useEffect(() => {
    if (cameraType === "orthographic") fitOrtho();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.length, room.width, size.width, size.height]);

  useEffect(() => {
    const onEvent = (e: Event) => {
      if (!controls) return;
      const d = (e as CustomEvent<CamEventDetail>).detail;
      if (d.type === "zoom") {
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = Math.min(400, Math.max(5, camera.zoom / d.factor));
          camera.updateProjectionMatrix();
        } else {
          const off = camera.position.clone().sub(controls.target).multiplyScalar(d.factor);
          camera.position.copy(controls.target).add(off);
        }
      } else {
        const off = camera.position.clone().sub(controls.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (d.deg * Math.PI) / 180);
        camera.position.copy(controls.target).add(off);
      }
      controls.update();
      invalidate();
    };
    window.addEventListener(CAM_EVENT, onEvent);
    return () => window.removeEventListener(CAM_EVENT, onEvent);
  }, [controls, camera, invalidate]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.65);
    const k = ease(a.t);
    camera.position.lerpVectors(a.fp, a.tp, k);
    controls.target.lerpVectors(a.ft, a.tt, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return null;
}
