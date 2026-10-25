import { formatMoneyPlain } from "@/data/pricing";
import { useEditorStore } from "@/store/editor-store";
import type { ProjectFile } from "@/types/project";
import type { Bom } from "./estimate";
import { capture2DPlan, capture3DImage, has3DCapture, safeFileName } from "./export";
import { getRoomPolygon } from "./geometry";
import { polygonArea } from "./roomShape";

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataUrl;
  });
}

/** Re-encodes an image as a white-backed JPEG no wider than `maxW` px, keeping the PDF small. */
async function compress(dataUrl: string | null, maxW = 1500, quality = 0.86): Promise<string | null> {
  if (!dataUrl) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext("2d");
      if (!g) return resolve(dataUrl);
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Returns a PNG of the 3D view, opening the 3D view briefly if it has never been shown. */
export async function ensure3DImage(): Promise<string | null> {
  const st = useEditorStore.getState();
  const previous = st.mode;
  if (!has3DCapture()) {
    st.setMode("3d");
    for (let i = 0; i < 40 && !has3DCapture(); i++) await new Promise((r) => setTimeout(r, 150));
    await new Promise((r) => setTimeout(r, 700));
  }
  const url = capture3DImage();
  if (previous === "2d") useEditorStore.getState().setMode("2d");
  return url;
}

const hexRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return Number.isNaN(n) ? [160, 160, 160] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Builds and downloads a PDF design report: plan, 3D view, room facts, furniture list and cost. */
export async function downloadPdfReport(file: ProjectFile, bom: Bom): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const st = useEditorStore.getState();
  const active = file.levels.find((l) => l.id === st.activeLevelId) ?? file.levels[0];
  const plan = await compress(capture2DPlan(active.room), 1400);
  const view = await compress(await ensure3DImage(), 1400);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  let y = M;
  const ink: [number, number, number] = [28, 29, 31];
  const muted: [number, number, number] = [107, 110, 115];

  const ensureSpace = (h: number) => {
    if (y + h > 282) {
      doc.addPage();
      y = M;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...ink);
  doc.text(file.name || "Room design", M, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`FloorFlow 360 design report  |  ${new Date().toLocaleDateString()}`, M, y + 12);
  y += 20;

  // room facts per floor
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.text("Rooms", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const lv of file.levels) {
    const area = polygonArea(getRoomPolygon(lv.room));
    const line = `${lv.name}: ${Math.round(lv.room.length * 100)} x ${Math.round(lv.room.width * 100)} cm bounding box, ${area.toFixed(1)} m2 floor, wall height ${Math.round(lv.room.wallHeight * 100)} cm, ${lv.items.length} item(s), ${lv.room.openings.filter((o) => o.type === "door").length} door(s), ${lv.room.openings.filter((o) => o.type === "window").length} window(s)`;
    const wrapped = doc.splitTextToSize(line, W - 2 * M) as string[];
    ensureSpace(wrapped.length * 4.5);
    doc.text(wrapped, M, y);
    y += wrapped.length * 4.5;
  }
  y += 4;

  const addImage = async (title: string, url: string | null, maxH: number) => {
    if (!url) return;
    const { w, h } = await imageSize(url);
    let iw = W - 2 * M;
    let ih = (iw * h) / w;
    if (ih > maxH) {
      ih = maxH;
      iw = (ih * w) / h;
    }
    ensureSpace(ih + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(title, M, y);
    y += 3;
    doc.addImage(url, "JPEG", M + (W - 2 * M - iw) / 2, y, iw, ih);
    y += ih + 6;
  };
  await addImage(`Floor plan - ${active.name}`, plan, 92);
  await addImage("3D view", view, 88);

  // furniture + cost table
  doc.addPage();
  y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...ink);
  doc.text("Furniture & cost estimate", M, y + 4);
  y += 10;

  const cols = [
    { label: "Item", x: M + 7, w: 56 },
    { label: "Size (cm)", x: M + 65, w: 28 },
    { label: "Material", x: M + 95, w: 20 },
    { label: "Floor", x: M + 115, w: 20 },
    { label: "Qty", x: M + 137, w: 8 },
    { label: "Unit", x: M + 160, w: 18, right: true },
    { label: "Total", x: W - M, w: 22, right: true },
  ];
  const head = () => {
    doc.setFillColor(241, 240, 236);
    doc.rect(M, y - 4, W - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    for (const c of cols) doc.text(c.label, c.x, y, c.right ? { align: "right" } : undefined);
    y += 6;
  };
  head();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const l of bom.lines) {
    if (y > 270) {
      doc.addPage();
      y = M + 4;
      head();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }
    doc.setFillColor(...hexRgb(l.color));
    doc.setDrawColor(150, 150, 150);
    doc.rect(M + 1, y - 3, 4.5, 4.5, "FD");
    doc.setTextColor(...ink);
    doc.text((doc.splitTextToSize(l.name, cols[0].w) as string[])[0], cols[0].x, y);
    doc.setTextColor(...muted);
    doc.text(`${l.w} x ${l.d} x ${l.h}`, cols[1].x, y);
    doc.text(l.material, cols[2].x, y);
    doc.text((doc.splitTextToSize(l.floors.join(", "), cols[3].w) as string[])[0], cols[3].x, y);
    doc.setTextColor(...ink);
    doc.text(String(l.qty), cols[4].x, y);
    doc.text(formatMoneyPlain(l.unitPrice, bom.currency), cols[5].x, y, { align: "right" });
    doc.text(formatMoneyPlain(l.total, bom.currency), cols[6].x, y, { align: "right" });
    y += 6;
  }
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  y += 6;
  const total = (label: string, value: string, bold = false) => {
    ensureSpace(7);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(...ink);
    doc.text(label, W - M - 60, y);
    doc.text(value, W - M, y, { align: "right" });
    y += bold ? 7 : 5.5;
  };
  total(`Subtotal (${bom.quantity} pieces)`, formatMoneyPlain(bom.subtotal, bom.currency));
  if (bom.discount) total("Discount", `-${formatMoneyPlain(bom.discount, bom.currency)}`);
  if (bom.tax) total("Tax", formatMoneyPlain(bom.tax, bom.currency));
  total("Total", formatMoneyPlain(bom.total, bom.currency), true);

  y += 6;
  ensureSpace(20);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  const note = doc.splitTextToSize(
    "Prices are indicative placeholders based on generic furniture types and sizes unless you entered your own, and are not a quotation. Furniture shown is a simplified 3D representation, not the final product.",
    W - 2 * M,
  ) as string[];
  doc.text(note, M, y);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${p} / ${pages}`, W - M, 290, { align: "right" });
  }
  doc.save(`${safeFileName(file.name)}-report.pdf`);
}

