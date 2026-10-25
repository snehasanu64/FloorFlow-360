"use client";

import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CURRENCIES, convertPrice, formatMoney, type CurrencyCode } from "@/data/pricing";
import { bomToCsv, buildBom, isCurrency } from "@/lib/estimate";
import { downloadBlob, safeFileName } from "@/lib/export";
import { downloadPdfReport } from "@/lib/report";
import { useEditorStore } from "@/store/editor-store";
import { Button } from "../layout/ui";
import { Modal } from "../layout/Panels";

export function EstimateDialog() {
  const s = useEditorStore();
  const [busy, setBusy] = useState(false);
  const est = s.estimate;
  const currency: CurrencyCode = isCurrency(est.currency) ? est.currency : "USD";
  // rebuild whenever the layout or settings change
  const file = useMemo(() => s.buildFile(), [s.items, s.room, s.levels, s.levelData, s.projectName, est]); // eslint-disable-line react-hooks/exhaustive-deps
  const bom = useMemo(() => buildBom(file.levels, est), [file, est]);

  const changeCurrency = (next: CurrencyCode) => {
    // keep typed prices meaningful: convert them to the new currency
    const ratio = CURRENCIES[next].rate / CURRENCIES[currency].rate;
    const overrides = Object.fromEntries(Object.entries(est.overrides).map(([k, v]) => [k, convertPrice(v / CURRENCIES[currency].rate, next) || Math.round(v * ratio)]));
    s.setEstimate({ currency: next, overrides });
  };
  const setPrice = (catalogId: string, raw: string) => {
    const n = parseFloat(raw);
    const next = { ...est.overrides };
    if (raw.trim() === "" || !Number.isFinite(n) || n < 0) delete next[catalogId];
    else next[catalogId] = n;
    s.setEstimate({ overrides: next });
  };

  const csv = () => {
    downloadBlob(new Blob([bomToCsv(bom, s.projectName)], { type: "text/csv;charset=utf-8" }), `${safeFileName(s.projectName)}-estimate.csv`);
    s.notify("success", "Estimate exported as CSV — opens in Excel or Google Sheets.");
  };
  const pdf = async () => {
    setBusy(true);
    try {
      await downloadPdfReport(file, bom);
      s.notify("success", "PDF report created — check your Downloads folder.");
    } catch (e) {
      s.notify("error", `Could not create the PDF (${e instanceof Error ? e.message : "unknown error"}).`);
    } finally {
      setBusy(false);
    }
  };

  const M = (v: number) => formatMoney(v, currency);

  return (
    <Modal title="Cost estimate" onClose={() => s.openPanel(null)}>
      <div className="p-5">
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Prices are <b>indicative placeholders</b> (generic prices by furniture type and size, converted at approximate rates). Type your own unit price on any line to replace it.
        </div>

        {bom.lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No furniture yet — add pieces to the plan and the bill of materials appears here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-sunken text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Size (cm)</th>
                  <th className="px-3 py-2 font-medium">Floor</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit price</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {bom.lines.map((l) => (
                  <tr key={l.key} className="border-t border-line">
                    <td className="px-3 py-1.5">
                      <span className="mr-2 inline-block h-3 w-3 rounded-full border border-black/15 align-middle" style={{ background: l.color }} />
                      {l.name}
                      <span className="ml-1 text-xs text-muted">{l.material}</span>
                    </td>
                    <td className="px-3 py-1.5 text-xs tabular-nums text-muted">
                      {l.w} × {l.d} × {l.h}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted">{l.floors.join(", ")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.qty}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        aria-label={`Unit price for ${l.name}`}
                        inputMode="decimal"
                        defaultValue={l.unitPrice}
                        key={`${l.key}-${l.unitPrice}-${currency}`}
                        onBlur={(e) => setPrice(l.catalogId, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className={`w-24 rounded-md border px-2 py-0.5 text-right text-sm tabular-nums ${l.custom ? "border-accent bg-accent-soft" : "border-line bg-panel"}`}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{M(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted">
              Currency
              <select
                value={currency}
                onChange={(e) => changeCurrency(e.target.value as CurrencyCode)}
                className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink"
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                  <option key={c} value={c}>
                    {c} — {CURRENCIES[c].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-muted">
                Discount %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={est.discountPct}
                  onChange={(e) => s.setEstimate({ discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink"
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Tax / GST %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={est.taxPct}
                  onChange={(e) => s.setEstimate({ taxPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="mt-1 h-9 w-full rounded-md border border-line bg-panel px-2 text-sm text-ink"
                />
              </label>
            </div>
          </div>
          <dl className="space-y-1 rounded-xl border border-line p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal ({bom.quantity} pieces)</dt>
              <dd className="tabular-nums">{M(bom.subtotal)}</dd>
            </div>
            {bom.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Discount</dt>
                <dd className="tabular-nums">−{M(bom.discount)}</dd>
              </div>
            )}
            {bom.tax > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd className="tabular-nums">{M(bom.tax)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{M(bom.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={csv} disabled={!bom.lines.length}>
            <FileSpreadsheet size={15} /> Download CSV (Excel)
          </Button>
          <Button variant="primary" onClick={pdf} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Download PDF report
          </Button>
          <span className="self-center text-xs text-muted">The PDF includes the floor plan, a 3D view, room facts, the furniture list and this estimate.</span>
        </div>
      </div>
    </Modal>
  );
}
