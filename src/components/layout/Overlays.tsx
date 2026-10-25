"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useEditorStore, type Notice } from "@/store/editor-store";
import { Button } from "./ui";

const STYLE: Record<Notice["kind"], { icon: React.ReactNode; cls: string }> = {
  info: { icon: <Info size={16} />, cls: "border-sky-200 bg-sky-50 text-sky-900" },
  success: { icon: <CheckCircle2 size={16} />, cls: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  warning: { icon: <AlertTriangle size={16} />, cls: "border-amber-300 bg-amber-50 text-amber-900" },
  error: { icon: <XCircle size={16} />, cls: "border-red-300 bg-red-50 text-red-900" },
};

function Toast({ n }: { n: Notice }) {
  const dismiss = useEditorStore((s) => s.dismissNotice);
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), n.kind === "error" || n.kind === "warning" ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [n, dismiss]);
  const st = STYLE[n.kind];
  return (
    <div role="status" className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border p-3 text-sm shadow-lg ${st.cls}`}>
      <span className="mt-0.5 shrink-0">{st.icon}</span>
      <span className="flex-1">{n.message}</span>
      <button aria-label="Dismiss" onClick={() => dismiss(n.id)} className="opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastHost() {
  const notices = useEditorStore((s) => s.notices);
  return (
    <div className="pointer-events-none fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 px-3">
      {notices.map((n) => (
        <Toast key={n.id} n={n} />
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const req = useEditorStore((s) => s.confirm);
  const close = useEditorStore((s) => s.closeConfirm);
  const open = !!req;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useEditorStore.getState().closeConfirm();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={close}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-panel p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">{req.title}</h2>
        <p className="mt-1.5 text-sm text-muted">{req.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant={req.danger ? "danger" : "primary"}
            onClick={() => {
              close();
              req.onConfirm();
            }}
          >
            {req.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
