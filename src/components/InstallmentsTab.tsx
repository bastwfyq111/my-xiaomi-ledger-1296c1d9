import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

const MONTHS_2025 = ["يونيو 2024", "يوليو 2024", "أغسطس 2024", "مارس 2025", "ابريل 2025", "مايو 2025", "يونيو 2025", "يوليو 2025", "أغسطس 2025", "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"];
const MONTHS_2026 = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر ", "نوفمبر", "ديسمبر"];
const BASE_COLS = [{ key: "name", label: "الاسم" }, { key: "batch", label: "الدفعة" }, { key: "specialty", label: "المساق" }, { key: "fees", label: "مبلغ الرسوم" }, { key: "totalPaid", label: "الإجمالي المسدد" }, { key: "remaining", label: "المتبقي" }, { key: "notes", label: "ملاحظات" }, { key: "phone", label: "رقم الهاتف" }];

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  const str = String(val).replace(/[,،\s\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "").trim();
  return Number(str) || 0;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
};

export default function InstallmentsTab() {
  const { installments, installments2025 } = useStore() as any;
  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMonth, setPayMonth] = useState("");
  const [previewModal, setPreviewModal] = useState<{ name: string; html: string } | null>(null);

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"]);
  const controls2025 = useTableControls(installments2025 || [], BASE_COLS.map(c => c.key));

  const totals = (list: any[]) => ({
    fees: list.reduce((s, r) => s + cleanNumber(r.fees), 0),
    paid: list.reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: list.reduce((s, r) => s + cleanNumber(r.remaining), 0),
    prevDue: list.reduce((s, r) => s + cleanNumber(r.prevDue), 0),
  });

  const totals2025 = useMemo(() => totals(controls2025.rows), [controls2025.rows]);
  const totals2026 = useMemo(() => totals(controls2026.rows), [controls2026.rows]);

  const addPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || !payAmount || !payMonth) return toast.error("يرجى إدخال المبلغ واختيار الشهر");
    
    const amount = Number(payAmount) || 0;
    const is2025 = paymentModal.year === 2025;
    const list = is2025 ? installments2025 : installments;
    const months = is2025 ? MONTHS_2025 : MONTHS_2026;

    const updated = list.map((s: any) => {
      if (s.name !== paymentModal.row.name) return s;
      const payments = { ...s.payments, [payMonth]: (Number(s.payments[payMonth]) || 0) + amount };
      const totalPaid = months.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      const remaining = is2025 ? cleanNumber(s.fees) - totalPaid : (cleanNumber(s.fees) + cleanNumber(s.prevDue)) - totalPaid;
      return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
    });

    useStore.setState(is2025 ? { installments2025: updated } : { installments: updated });
    toast.success(`تم تسجيل قسط ${fmt(amount)} لشهر ${payMonth}`);
    setPaymentModal(null); setPayAmount(""); setPayMonth("");
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>, year: 2025 | 2026) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) as any[];
        const headerIdx = rows.findIndex(r => r?.some((c: any) => ["متدرب", "الاسم", "المساق"].some(k => String(c).includes(k))));
        if (headerIdx === -1) return toast.error("لم يتم العثور على العناوين");

        const headers = rows[headerIdx].map((h: any) => String(h || "").trim());
        const data = rows.slice(headerIdx + 1)
          .map(r => headers.reduce((obj: any, h, i) => (obj[h] = r[i], obj), {}))
          .filter(r => {
            const name = String(Object.values(r).find((v: any) => String(v).includes("اسم") || String(v).includes("الاسم")) || "").trim();
            return name && name !== "الإجمالي" && !name.includes("كشف");
          })
          .map(r => {
            const find = (keys: string[]) => Object.entries(r).find(([k]) => keys.some(kw => k.includes(kw)))?.[1] || "";
            const name = String(find(["اسم", "الاسم"])).trim();
            const batch = String(find(["دفعة", "الدفعة"])).trim();
            const specialty = String(find(["مساق", "المساق"])).trim();
            const fees = cleanNumber(find(["رسوم", "مبلغ"]));
            const prevDue = year === 2026 ? cleanNumber(find(["2025", "السابق", "متبقي"])) : 0;
            const totalPaid = cleanNumber(find(["المسدد", "الإجمالي", "المدفوع"]));
            const remaining = cleanNumber(find(["المتبقي"]));
            const notes = String(find(["ملاحظات"])).trim();
            const phone = String(find(["هاتف", "تلفون"])).trim();
            const months = year === 2025 ? MONTHS_2025 : MONTHS_2026;
            const payments = months.reduce((acc: any, m) => {
              const key = Object.keys(r).find(k => String(k).replace(/\s/g, "") === m.replace(/\s/g, ""));
              acc[m] = key ? cleanNumber(r[key]) : 0;
              return acc;
            }, {});
            return { name, batch, specialty, fees, ...(year === 2026 && { prevDue }), totalPaid, remaining, notes, phone, payments };
          });

        useStore.setState(year === 2025 ? { installments2025: data } : { installments: data });
        toast.success(`تم استيراد ${data.length} سجل لعام ${year}`);
      } catch { toast.error("خطأ في معالجة الملف"); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const generatePreview = (name: string) => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === name);
    const r2026 = (installments || []).find((i: any) => i.name === name);
    const monthlyRequired = (total: number, months = 12) => Math.round(total / months);

    const buildTable = (r: any, months: string[], year: string, color: string) => {
      if (!r) return "";
      const total = cleanNumber(r.fees) + (year === "2026" ? cleanNumber(r.prevDue) : 0);
      const monthly = monthlyRequired(total);
      let accPaid = 0, accReq = 0;
      
      const rows = months.map(m => {
        const paid = Number(r.payments?.[m]) || 0;
        accPaid += paid; accReq += monthly;
        const diff = paid - monthly;
        const status = Math.abs(diff) < 1 ? ["متوازن", "#6b7280", "#f3f4f6"] : diff > 0 ? ["💰 له", "#059669", "#d1fae5"] : ["⚠️ عليه", "#dc2626", "#fee2e2"];
        return `<tr><td>${m}</td><td>${fmt(monthly)}</td><td>${fmt(paid)}</td><td><span style="background:${status[2]};color:${status[1]};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700">${status[0]}</span></td><td style="color:${status[1]}">${fmt(Math.abs(diff))}</td></tr>`;
      }).join("");

      return `
        <div style="border:2px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:${color};color:white;padding:12px;text-align:center;font-size:18px;font-weight:700">📅 ${year}</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;background:#f8fafc">
            <div style="text-align:center"><small>الإجمالي</small><br><b>${fmt(total)}</b></div>
            <div style="text-align:center"><small>القسط الشهري</small><br><b>${fmt(monthly)}</b></div>
            <div style="text-align:center"><small>المتبقي</small><br><b style="color:#dc2626">${fmt(r.remaining)}</b></div>
          </div>
          <table width="100%" style="border-collapse:collapse">
            <thead><tr style="background:#f1f5f9">${["الشهر","القسط","المدفوع","الحالة","الفرق"].map(h => `<th style="padding:10px">${h}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    };

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"><style>
      body{font-family:'Cairo',sans-serif;background:#f0f9ff;padding:20px;direction:rtl}.container{max-width:1200px;margin:0 auto;background:white;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden}
      .header{background:linear-gradient(135deg,#0891b2,#0e7490);color:white;padding:25px;text-align:center}.header h1{font-size:24px;margin:0}.header h2{font-size:14px;opacity:0.9}
      .info{background:#f8fafc;padding:15px 25px;display:flex;justify-content:space-between;border-bottom:2px solid #e2e8f0}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px}
      .btn{padding:10px 25px;border:none;border-radius:8px;font-family:'Cairo';font-size:14px;font-weight:700;cursor:pointer;color:white;margin:0 5px}
      @media print{body{background:white;padding:0}.container{box-shadow:none}}</style></head><body><div class="container">
      <div class="header"><h1>المجلس اليمني للاختصاصات الطبية</h1><h2>كشف الأقساط الشهرية التفصيلي</h2></div>
      <div class="info"><b>👨‍⚕️ ${name}</b><span>📅 ${today()}</span></div>
      <div class="grid">${buildTable(r2025, MONTHS_2025, "2025", "#0891b2")}${buildTable(r2026, MONTHS_2026, "2026", "#7c3aed")}</div>
      <div style="text-align:center;padding:20px;background:#f8fafc">
        <button class="btn" style="background:#0891b2" onclick="window.print()">🖨️ طباعة</button>
        <button class="btn" style="background:#7c3aed" onclick="window.parent.postMessage('download','*')">📥 PDF</button>
      </div></div></body></html>`;

    setPreviewModal({ name, html });
  };

  const downloadPDF = async (name: string) => {
    try {
      const pdf = new jsPDF({ orientation: "portrait", format: "a4" });
      try {
        const res = await fetch('https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangtZmpcWmhzfH5lWWgcRiySJg.ttf');
        const buf = await res.arrayBuffer();
        pdf.addFileToVFS('Cairo.ttf', toBase64(buf));
        pdf.addFont('Cairo.ttf', 'Cairo', 'normal');
        pdf.setFont('Cairo');
      } catch {}

      const r = (installments2025 || []).find((i: any) => i.name === name) || (installments || []).find((i: any) => i.name === name);
      if (!r) return toast.error("لا توجد بيانات");
      
      pdf.setFontSize(16);
      pdf.text(`كشف حساب - ${name}`, 105, 15, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(today(), 105, 22, { align: 'center' });

      const months = MONTHS_2025.includes(Object.keys(r.payments || {})[0]) ? MONTHS_2025 : MONTHS_2026;
      const monthly = Math.round(cleanNumber(r.fees) / 12);
      const data = months.map(m => {
        const paid = Number(r.payments?.[m]) || 0;
        const diff = paid - monthly;
        return [m, fmt(monthly), fmt(paid), diff > 0 ? `له ${fmt(diff)}` : diff < 0 ? `عليه ${fmt(-diff)}` : "متوازن"];
      });

      autoTable(pdf, { head: [['الشهر', 'القسط', 'المدفوع', 'الحالة']], body: data, startY: 25, styles: { fontSize: 9, halign: 'right' } });
      pdf.save(`كشف_${name}.pdf`);
      toast.success("تم التحميل");
    } catch { toast.error("فشل التحميل"); }
  };

  const renderTable = (controls: any, year: 2025 | 2026) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs md:text-sm">
        <thead className="bg-slate-100 font-bold border-b">
          <tr>
            <th className="p-2 w-10">م</th>
            {BASE_COLS.map(c => (
              <th key={c.key} className="p-2 text-right cursor-pointer" onClick={() => controls.toggleSort(c.key)}>
                {c.label} {sortIndicator(controls.sortKey === c.key, controls.sortDir)}
              </th>
            ))}
            <th className="p-2 w-48">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {controls.rows.map((r: any, i: number) => (
            <tr key={i} className="border-t hover:bg-slate-50">
              <td className="p-2 text-center">{i + 1}</td>
              <td className="p-2 font-semibold">{r.name}</td>
              <td className="p-2 text-center">{r.batch}</td>
              <td className="p-2">{r.specialty}</td>
              <td className="p-2 font-mono">{fmt(r.fees)}</td>
              <td className="p-2 font-mono text-emerald-600 font-bold">{fmt(r.totalPaid)}</td>
              <td className="p-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
              <td className="p-2 truncate max-w-xs">{r.notes || "—"}</td>
              <td className="p-2 font-mono">{r.phone || "—"}</td>
              <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                <button onClick={() => setPaymentModal({ row: r, year })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold hover:bg-emerald-600 hover:text-white">💵</button>
                <button onClick={() => setEditingRow({ row: r, year })} className="text-blue-600 hover:underline font-bold px-1">✏️</button>
                <button onClick={() => generatePreview(r.name)} className="px-2 py-0.5 bg-slate-50 rounded hover:bg-teal-700 hover:text-white">📄</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8" dir="rtl">
      {[2025, 2026].map(year => (
        <div key={year} className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-teal-800">أقساط {year}</h2>
              <p className="text-xs text-slate-500">{year === 2025 ? "الأرشيف" : "العام الحالي"}</p>
            </div>
            <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700">
              📥 استيراد {year}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, year as 2025 | 2026)} className="hidden" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {["إجمالي الرسوم", "المسدد", year === 2026 ? "متبقي 2025" : "المتبقي"].map((label, i) => {
              const t = year === 2025 ? totals2025 : totals2026;
              const vals = [t.fees, t.paid, year === 2026 ? t.prevDue : t.remaining];
              return (
                <div key={i} className="bg-slate-50 p-2 border rounded-lg">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm font-mono font-bold block">{fmt(vals[i])}</span>
                </div>
              );
            })}
          </div>
          {renderTable(year === 2025 ? controls2025 : controls2026, year as 2025 | 2026)}
        </div>
      ))}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full" dir="rtl">
            <h3 className="font-bold border-b pb-2 mb-4">➕ تسجيل دفعة - {paymentModal.year}</h3>
            <p className="text-sm mb-4">المتدرب: <b>{paymentModal.row.name}</b></p>
            <form onSubmit={addPayment} className="space-y-4">
              <input type="number" required placeholder="المبلغ" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full p-2 border rounded bg-slate-50" />
              <select required value={payMonth} onChange={e => setPayMonth(e.target.value)} className="w-full p-2 border rounded bg-slate-50">
                <option value="">اختر الشهر</option>
                {(paymentModal.year === 2025 ? MONTHS_2025 : MONTHS_2026).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-4 py-2 bg-slate-100 rounded">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-7xl h-[95vh] flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold">📊 معاينة - {previewModal.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => { const w = window.open('', '', 'width=1200,height=800'); w?.document.write(previewModal.html); w?.document.close(); setTimeout(() => w?.print(), 500); }} className="px-4 py-2 bg-teal-600 text-white rounded">🖨️</button>
                <button onClick={() => downloadPDF(previewModal.name)} className="px-4 py-2 bg-purple-600 text-white rounded">📥</button>
                <button onClick={() => setPreviewModal(null)} className="px-4 py-2 bg-slate-500 text-white rounded">✕</button>
              </div>
            </div>
            <iframe srcDoc={previewModal.html} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}

      {editingRow && (
        <EditModal 
          title={`تعديل - ${editingRow.row.name}`}
          fields={[
            { key: "name", label: "الاسم", colSpan: 2 },
            { key: "batch", label: "الدفعة" },
            { key: "specialty", label: "المساق" },
            { key: "fees", label: "الرسوم", type: "number" },
            ...(editingRow.year === 2026 ? [{ key: "prevDue", label: "متبقي 2025", type: "number" as const }] : []),
            { key: "totalPaid", label: "المسدد", type: "number" },
            { key: "remaining", label: "المتبقي", type: "number" },
            { key: "phone", label: "الهاتف" },
            { key: "notes", label: "ملاحظات", colSpan: 3 },
          ]}
          values={editingRow.row}
          onClose={() => setEditingRow(null)}
          onSave={(updated) => {
            const cleaned = { ...updated };
            ["fees", "prevDue", "totalPaid", "remaining"].forEach(k => { if (cleaned[k]) cleaned[k] = cleanNumber(cleaned[k]); });
            const key = editingRow.year === 2025 ? "installments2025" : "installments";
            useStore.setState({ [key]: (useStore.getState() as any)[key].map((i: any) => i.name === editingRow.row.name ? cleaned : i) });
            toast.success("تم التحديث");
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
          }
