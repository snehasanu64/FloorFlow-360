"use client";

import { AlertTriangle, CheckCircle2, Compass, Info } from "lucide-react";
import { useMemo } from "react";
import { vastuReport, vastuScore, type CheckStatus } from "@/lib/vastu";
import { useEditorStore } from "@/store/editor-store";
import { Drawer } from "../layout/Panels";

const ICON: Record<CheckStatus, React.ReactNode> = {
  good: <CheckCircle2 size={16} className="text-emerald-600" />,
  warn: <AlertTriangle size={16} className="text-amber-600" />,
  info: <Info size={16} className="text-sky-600" />,
};

export function VastuPanel() {
  const s = useEditorStore();
  const checks = useMemo(() => vastuReport(s.items, s.room), [s.items, s.room]);
  const score = vastuScore(checks);
  const setNorth = (deg: number) => s.setRoom({ northAngle: deg });
  const order: CheckStatus[] = ["warn", "info", "good"];

  return (
    <Drawer title="Vastu check" onClose={() => s.openPanel(null)}>
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-line bg-sunken p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Compass size={16} className="text-accent" style={{ transform: `rotate(${s.room.northAngle}deg)` }} /> Which way is north?
          </div>
          <p className="mb-2 text-xs text-muted">Angle from the <b>top of the plan</b> to true north, clockwise. 0° means the top of the plan faces north.</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(s.room.northAngle)}
              onChange={(e) => setNorth(Number(e.target.value))}
              aria-label="North angle"
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <span className="w-10 text-right text-sm tabular-nums">{Math.round(s.room.northAngle)}°</span>
          </div>
          <div className="mt-2 flex gap-1">
            {[
              ["Up", 0],
              ["Right", 90],
              ["Down", 180],
              ["Left", 270],
            ].map(([label, deg]) => (
              <button key={label} onClick={() => setNorth(deg as number)} className="rounded-md border border-line px-2 py-0.5 text-xs hover:bg-hover">
                North is {String(label).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {s.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Add furniture to see placement hints.</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl border border-line p-3">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{score.pct === null ? "—" : `${score.pct}%`}</div>
                <div className="text-xs text-muted">guidelines met</div>
              </div>
              <div className="text-right text-xs text-muted">
                <div>{score.good} good</div>
                <div>{score.warn} to review</div>
              </div>
            </div>
            {order.map((st) => {
              const list = checks.filter((c) => c.status === st);
              if (!list.length) return null;
              return (
                <section key={st}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    {st === "warn" ? "Worth reviewing" : st === "info" ? "Acceptable" : "Looks good"} ({list.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {list.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => c.itemIds.length && s.selectMany(c.itemIds)}
                          className="flex w-full gap-2 rounded-lg border border-line p-2 text-left transition hover:bg-hover"
                        >
                          <span className="mt-0.5 shrink-0">{ICON[c.status]}</span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium">{c.title}</span>
                            <span className="block text-xs text-muted">{c.detail}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
        <p className="text-[11px] leading-snug text-muted">
          These are common Vastu Shastra guidelines offered for inspiration, not professional advice. Traditions vary — consult a Vastu expert for important decisions.
        </p>
      </div>
    </Drawer>
  );
}
