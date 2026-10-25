"use client";

import { useEffect, useId, useState } from "react";
import { UNITS } from "@/lib/measurements";
import { useEditorStore } from "@/store/editor-store";

/**
 * Numeric input that edits a value in display units (cm or degrees) and commits on blur / Enter.
 * `factor` converts from the stored value to the displayed one (100 for metres -> cm).
 */
export function NumberField({
  label,
  value,
  onCommit,
  factor: factorProp,
  unit: unitProp,
  min,
  max,
  step = 1,
  error,
  className = "",
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  factor?: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  className?: string;
}) {
  const activeUnit = useEditorStore((s) => s.units);
  const factor = factorProp ?? UNITS[activeUnit].factor;
  const unit = unitProp ?? UNITS[activeUnit].label;
  const id = useId();
  const fmt = (v: number) => String(Math.round(v * factor * 100) / 100);
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!focused) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const commit = () => {
    const n = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(n)) {
      setText(fmt(value));
      return;
    }
    let v = n / factor;
    // min / max are given in the legacy display unit (cm, or the explicit unit when factor is passed)
    const lim = factorProp ?? 100;
    if (min !== undefined) v = Math.max(min / lim, v);
    if (max !== undefined) v = Math.min(max / lim, v);
    if (Math.abs(v - value) > 1e-9) onCommit(v);
    setText(fmt(v));
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <div
        className={`flex items-center rounded-md border bg-panel px-2 transition focus-within:ring-2 focus-within:ring-accent/30 ${
          error ? "border-red-400" : "border-line focus-within:border-accent"
        }`}
      >
        <input
          id={id}
          inputMode="decimal"
          value={text}
          step={step}
          onFocus={(e) => {
            setFocused(true);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setText(fmt(value));
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const n = parseFloat(text) || 0;
              const next = n + (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1);
              setText(String(Math.round(next * 100) / 100));
            }
          }}
          className="h-8 w-full min-w-0 bg-transparent text-sm tabular-nums outline-none"
        />
        <span className="pl-1 text-xs text-muted">{unit}</span>
      </div>
      {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
