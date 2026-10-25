"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../layout/ui";

/** Live camera preview with a shutter button. Frames are downscaled to JPEG data URLs; nothing leaves the browser. */
export function CameraCapture({ onShot, onClose, count }: { onShot: (dataUrl: string) => void; onClose: () => void; count: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot access a camera (it needs HTTPS or localhost). Use Upload photos instead.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in the browser's address bar, or use Upload photos."
            : name === "NotFoundError"
              ? "No camera was found on this device. Use Upload photos instead."
              : "The camera could not be started. Use Upload photos instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * k);
    c.height = Math.round(v.videoHeight * k);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    onShot(c.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Take photos — turn around the room to cover every wall</span>
        <button aria-label="Close camera" onClick={onClose} className="rounded p-1 hover:bg-hover">
          <X size={16} />
        </button>
      </div>
      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{error}</p>
      ) : (
        <>
          <video ref={video} playsInline muted className="aspect-video w-full rounded-lg bg-black object-cover" />
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={shoot} disabled={!ready}>
              <Camera size={15} /> Capture
            </Button>
            <span className="text-xs text-muted">{count} photo{count === 1 ? "" : "s"} so far</span>
            <Button className="ml-auto" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
