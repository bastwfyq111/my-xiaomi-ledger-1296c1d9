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
const BASE_COLS = [{ key: "name", label: "الاسم" }, { key: "batch", label: "الدفعة" }, { key: "specialty", label: "المساق" }, { key: "fees", label: "رسوم 2026" }, { key: "prevDue", label: "متبقي 2025" }, { key: "totalPaid", label: "المسدد 2026" }, { key: "remaining", label: "الرصيد" }, { key: "notes", label: "ملاحظات" }, { key: "phone", label: "الهاتف" }];

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
};

const toBase64 = (buffer: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buffer)));

export default function InstallmentsTab() {
  const { installments, installments2025 } = useStore() as any;
  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMonth, setPayMonth] = useState("");
  const [previewModal, setPreviewModal] = useState<{ name: string; html: string } | null>(null);
  const [newStudentPayment, setNewStudentPayment] = useState<{ show: boolean; year: 2025 | 2026 }>({ show: false, year: 2026 });
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentAmount, setNewStudentAmount] = useState("");
  const [newStudentMonth, setNewStudentMonth] = useState("");

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"]);
  const controls2025 = useTableControls(installments2025 || [], ["name", "batch", "specialty", "fees", "totalPaid", "remaining", "notes", "phone"]);

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
      const remaining = is2025 
        ? cleanNumber(s.fees) - totalPaid 
        : cleanNumber(s.prevDue) - totalPaid;
      return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
    });

    useStore.setState(is2025 ? { installments2025: updated } : { installments: updated });
    toast.success(`تم تسجيل دفعة ${fmt(amount)} لشهر ${payMonth}`);
    setPaymentModal(null); setPayAmount(""); setPayMonth("");
  };

  const addNewStudentPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentAmount || !newStudentMonth) return toast.error("يرجى إدخال جميع البيانات");
    
    const amount = Number(newStudentAmount) || 0;
    const year = newStudentPayment.year;
    const list = year === 2025 ? installments2025 : installments;
    const months = year === 2025 ? MONTHS_2025 : MONTHS_2026;

    const existing = list.find((s: any) => s.name === newStudentName);
    
    if (existing) {
      const updated = list.map((s: any) => {
        if (s.name !== newStudentName) return s;
        const payments = { ...s.payments, [newStudentMonth]: (Number(s.payments[newStudentMonth]) || 0) + amount };
        const totalPaid = months.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
        const remaining = year === 2025 
          ? cleanNumber(s.fees) - totalPaid 
          : cleanNumber(s.prevDue) - totalPaid;
        return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
      });
      useStore.setState(year === 2025 ? { installments2025: updated } : { installments: updated });
    } else {
      const payments = months.reduce((acc: any, m) => (acc[m] = m === newStudentMonth ? amount : 0, acc), {});
      const newRecord = {
        name: newStudentName,
        batch: "",
        specialty: "",
        fees: year === 2026 ? 0 : 0,
        ...(year === 2026 && { prevDue: 0 }),
        totalPaid: amount,
        remaining: year === 2025 ? 0 : 0,
        notes: "",
        phone: "",
        payments
      };
      useStore.setState(year === 2025 
        ? { installments2025: [...(installments2025 || []), newRecord] }
        : { installments: [...(installments || []), newRecord] }
      );
    }

    toast.success(`تم إضافة دفعة ${fmt(amount)} لـ ${newStudentName}`);
    setNewStudentPayment({ show: false, year: 2026 });
    setNewStudentName(""); setNewStudentAmount(""); setNewStudentMonth("");
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

    const buildStatementTable = (r: any, months: string[], year: string, openingBalance: number, color: string) => {
      if (!r) return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;opacity:0.5">
        <div style="background:${color};color:white;padding:6px 12px;font-size:11px;font-weight:700">📅 ${year}</div>
        <div style="padding:15px;text-align:center;color:#94a3b8;font-size:10px">لا توجد بيانات</div>
      </div>`;

      const fees = year === "2026" ? cleanNumber(r.fees) : 0;
      const prevDue = year === "2026" ? cleanNumber(r.prevDue) : 0;
      const opening = year === "2025" ? cleanNumber(r.fees) : cleanNumber(r.prevDue);
      
      const paidMonths = months.filter(m => Number(r.payments?.[m]) > 0);
      
      if (paidMonths.length === 0) {
        return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <div style="background:${color};color:white;padding:6px 12px;font-size:11px;font-weight:700">📅 ${year}</div>
          <div style="padding:10px;text-align:center;color:#94a3b8;font-size:10px">
            ${year === "2025" ? `رسوم الدراسة: ${fmt(opening)}` : `متبقي 2025: ${fmt(opening)}${fees > 0 ? ` | رسوم 2026: ${fmt(fees)}` : ''}`}
            <br>لا توجد مدفوعات مسجلة
          </div>
        </div>`;
      }

      let balance = opening;
      
      const rows = paidMonths.map(m => {
        const paid = Number(r.payments?.[m]) || 0;
        balance -= paid;
        const status = balance <= 0 ? "✅ مكتمل" : "⚠️ متبقي";
        const statusColor = balance <= 0 ? "#059669" : "#dc2626";
        const statusBG = balance <= 0 ? "#d1fae5" : "#fee2e2";
        
        return `<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:4px 8px;font-size:9px">${m}</td>
          <td style="padding:4px 8px;font-size:9px;text-align:center;font-family:monospace;font-weight:600">${fmt(paid)}</td>
          <td style="padding:4px 8px;font-size:9px;text-align:center;font-family:monospace;font-weight:700;color:${statusColor}">${fmt(Math.max(0, balance))}</td>
          <td style="padding:4px 8px;text-align:center">
            <span style="background:${statusBG};color:${statusColor};padding:1px 8px;border-radius:8px;font-size:8px;font-weight:700">${status}</span>
          </td>
        </tr>`;
      }).join("");

      const finalBalance = Math.max(0, balance);

      return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;background:white">
        <div style="background:${color};color:white;padding:6px 12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700">📅 ${year}</span>
          <span style="font-size:9px;opacity:0.9">${r.specialty || ''} ${r.batch ? '- ' + r.batch : ''}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${year === "2026" ? '4' : '3'},1fr);gap:1px;background:#e2e8f0;text-align:center">
          ${year === "2026" ? `<div style="background:#f8fafc;padding:5px">
            <div style="font-size:7px;color:#64748b">رسوم 2026</div>
            <div style="font-size:11px;font-weight:700;color:#1e293b">${fmt(fees)}</div>
          </div>` : ''}
          <div style="background:#f8fafc;padding:5px">
            <div style="font-size:7px;color:#64748b">${year === "2025" ? "رسوم الدراسة" : "متبقي 2025"}</div>
            <div style="font-size:11px;font-weight:700;color:#0891b2">${fmt(opening)}</div>
          </div>
          <div style="background:#f8fafc;padding:5px">
            <div style="font-size:7px;color:#64748b">المسدد</div>
            <div style="font-size:11px;font-weight:700;color:#059669">${fmt(r.totalPaid || 0)}</div>
          </div>
          <div style="background:#f8fafc;padding:5px">
            <div style="font-size:7px;color:#64748b">الرصيد</div>
            <div style="font-size:11px;font-weight:700;color:${finalBalance > 0 ? '#dc2626' : '#059669'}">${fmt(finalBalance)}</div>
          </div>
        </div>
        <table width="100%" style="border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
              <th style="padding:4px 8px;font-size:8px;color:#64748b;text-align:right">الشهر</th>
              <th style="padding:4px 8px;font-size:8px;color:#64748b;text-align:center">المبلغ</th>
              <th style="padding:4px 8px;font-size:8px;color:#64748b;text-align:center">الرصيد</th>
              <th style="padding:4px 8px;font-size:8px;color:#64748b;text-align:center">الحالة</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${finalBalance > 0 ? `<div style="padding:6px;background:#fef2f2;text-align:center;font-size:9px;color:#dc2626;font-weight:700">⚠️ متبقي: ${fmt(finalBalance)}</div>` : 
          `<div style="padding:6px;background:#f0fdf4;text-align:center;font-size:9px;color:#059669;font-weight:700">✅ تم السداد</div>`}
      </div>`;
    };

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Cairo',sans-serif;background:#f1f5f9;padding:8px;direction:rtl}
.container{max-width:1100px;margin:0 auto;background:white;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.04);overflow:hidden}
.header{background:#1e293b;color:white;padding:10px 18px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:13px;font-weight:700}
.header .date{font-size:9px;opacity:0.8}
.student-bar{background:linear-gradient(135deg,#0891b2,#06b6d4);color:white;padding:8px 18px;display:flex;justify-content:space-between}
.student-bar .name{font-size:13px;font-weight:700}
.student-bar .phone{font-size:9px;opacity:0.9}
.content{padding:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{padding:5px 15px;border:none;border-radius:5px;font-family:'Cairo';font-size:10px;font-weight:700;cursor:pointer;color:white;margin:0 2px}
@media print{body{background:white;padding:0}.container{box-shadow:none}.btn{display:none}}
@media(max-width:768px){.grid{grid-template-columns:1fr}}
</style></head><body>
<div class="container">
  <div class="header"><h1>📊 المجلس اليمني للاختصاصات الطبية</h1><span class="date">📅 ${today()}</span></div>
  <div class="student-bar"><span class="name">👨‍⚕️ ${name}</span><span class="phone">📱 ${r2025?.phone || r2026?.phone || ''}</span></div>
  <div class="content">
    <div class="grid">
      ${buildStatementTable(r2025, MONTHS_2025, "2025", cleanNumber(r2025?.fees || 0), "#0891b2")}
      ${buildStatementTable(r2026, MONTHS_2026, "2026", cleanNumber(r2026?.prevDue || 0), "#7c3aed")}
    </div>
  </div>
  <div style="padding:10px 18px;background:#f8fafc;border-top:2px solid #e2e8f0;text-align:center">
    <button class="btn" style="background:#0891b2" onclick="window.print()">🖨️ طباعة</button>
    <button class="btn" style="background:#7c3aed" onclick="window.parent.postMessage('download','*')">📥 PDF</button>
  </div>
</div></body></html>`;

    setPreviewModal({ name, html });
  };

  const downloadPDF = async (name: string) => {
    try {
      const pdf = new jsPDF({ orientation: "portrait", format: "a4" });
      try {
        const res = await fetch('https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangtZmpcWmhzfH5lWWgcRiySJg.ttf');
        pdf.addFileToVFS('Cairo.ttf', toBase64(await res.arrayBuffer()));
        pdf.addFont('Cairo.ttf', 'Cairo', 'normal');
        pdf.setFont('Cairo');
      } catch {}

      const r2025 = (installments2025 || []).find((i: any) => i.name === name);
      const r2026 = (installments || []).find((i: any) => i.name === name);
      if (!r2025 && !r2026) return toast.error("لا توجد بيانات");

      pdf.setFontSize(13);
      pdf.text(`كشف حساب - ${name}`, 105, 10, { align: 'center' });
      let yPos = 18;

      const addYearTable = (data: any, months: string[], year: string, opening: number) => {
        if (!data) return;
        pdf.setFontSize(9);
        pdf.text(`${year} - ${year === "2025" ? "رسوم الدراسة" : "متبقي 2025"}: ${fmt(opening)}`, 14, yPos);
        yPos += 4;
        
        let balance = opening;
        const rows = months
          .filter(m => Number(data.payments?.[m]) > 0)
          .map(m => {
            const paid = Number(data.payments?.[m]) || 0;
            balance -= paid;
            return [m, fmt(paid), fmt(Math.max(0, balance))];
          });

        if (rows.length > 0) {
          autoTable(pdf, {
            head: [['الشهر', 'المبلغ', 'الرصيد']],
            body: rows,
            startY: yPos,
            styles: { fontSize: 7, halign: 'right', cellPadding: 1.5 },
            headStyles: { fillColor: [30, 41, 59], fontSize: 7 },
            margin: { left: 14, right: 14 }
          });
          yPos = (pdf as any).lastAutoTable.finalY + 4;
        }
      };

      addYearTable(r2025, MONTHS_2025, "2025", cleanNumber(r2025?.fees || 0));
      addYearTable(r2026, MONTHS_2026, "2026", cleanNumber(r2026?.prevDue || 0));

      pdf.save(`كشف_${name}.pdf`);
      toast.success("تم التحميل");
    } catch { toast.error("فشل التحميل"); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ========== جدول 2025 ========== */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-teal-800">أقساط ورسوم 2025</h2>
            <p className="text-[10px] text-slate-400">الأرشيف - الرصيد الافتتاحي = رسوم الدراسة</p>
          </div>
          <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-emerald-700">
            📥 استيراد 2025
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2025)} className="hidden" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-50 p-2 rounded-lg text-center border"><div className="text-[9px] text-slate-500">رسوم الدراسة</div><div className="text-xs font-mono font-bold">{fmt(totals2025.fees)}</div></div>
          <div className="bg-emerald-50 p-2 rounded-lg text-center border border-emerald-100"><div className="text-[9px] text-emerald-600">المسدد</div><div className="text-xs font-mono font-bold text-emerald-700">{fmt(totals2025.paid)}</div></div>
          <div className="bg-rose-50 p-2 rounded-lg text-center border border-rose-100"><div className="text-[9px] text-rose-600">الرصيد المتبقي</div><div className="text-xs font-mono font-bold text-rose-700">{fmt(totals2025.remaining)}</div></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-2 w-10">م</th>
                {BASE_COLS.filter(c => c.key !== 'prevDue').map(c => (
                  <th key={c.key} className="p-2 text-right cursor-pointer hover:bg-slate-200" onClick={() => controls2025.toggleSort(c.key)}>
                    {c.key === 'fees' ? 'رسوم 2025' : c.key === 'totalPaid' ? 'المسدد' : c.label}
                    {sortIndicator(controls2025.sortKey === c.key, controls2025.sortDir)}
                  </th>
                ))}
                <th className="p-2 w-36">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r: any, i: number) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono text-center">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold text-center">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold text-center">{fmt(r.remaining)}</td>
                  <td className="p-2 truncate max-w-[100px] text-[10px] text-slate-500">{r.notes || "—"}</td>
                  <td className="p-2 text-[10px] text-center">{r.phone || "—"}</td>
                  <td className="p-2 text-center space-x-1">
                    <button onClick={() => setPaymentModal({ row: r, year: 2025 })} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold hover:bg-emerald-600 hover:text-white">💵</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2025 })} className="text-blue-600 hover:underline font-bold text-[10px] px-1">✏️</button>
                    <button onClick={() => generatePreview(r.name)} className="px-1.5 py-0.5 bg-slate-50 rounded text-[10px] hover:bg-teal-700 hover:text-white">📄</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== جدول 2026 ========== */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-purple-800">أقساط ورسوم 2026</h2>
            <p className="text-[10px] text-slate-400">الرصيد الافتتاحي = متبقي 2025 فقط</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setNewStudentPayment({ show: true, year: 2026 })}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold hover:bg-purple-700"
            >
              ➕ إضافة قسط جديد
            </button>
            <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-emerald-700">
              📥 استيراد 2026
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2026)} className="hidden" />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-slate-50 p-2 rounded-lg text-center border"><div className="text-[9px] text-slate-500">رسوم 2026</div><div className="text-xs font-mono font-bold">{fmt(totals2026.fees)}</div></div>
          <div className="bg-amber-50 p-2 rounded-lg text-center border border-amber-100"><div className="text-[9px] text-amber-600">متبقي 2025</div><div className="text-xs font-mono font-bold text-amber-700">{fmt(totals2026.prevDue)}</div></div>
          <div className="bg-emerald-50 p-2 rounded-lg text-center border border-emerald-100"><div className="text-[9px] text-emerald-600">المسدد</div><div className="text-xs font-mono font-bold text-emerald-700">{fmt(totals2026.paid)}</div></div>
          <div className="bg-rose-50 p-2 rounded-lg text-center border border-rose-100"><div className="text-[9px] text-rose-600">الرصيد</div><div className="text-xs font-mono font-bold text-rose-700">{fmt(totals2026.remaining)}</div></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-2 w-10">م</th>
                {BASE_COLS.map(c => (
                  <th key={c.key} className="p-2 text-right cursor-pointer hover:bg-slate-200" onClick={() => controls2026.toggleSort(c.key)}>
                    {c.key === 'remaining' ? 'الرصيد' : c.key === 'totalPaid' ? 'المسدد 2026' : c.label}
                    {sortIndicator(controls2026.sortKey === c.key, controls2026.sortDir)}
                  </th>
                ))}
                <th className="p-2 w-36">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r: any, i: number) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono text-center">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-amber-600 font-bold text-center">{fmt(r.prevDue || 0)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold text-center">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold text-center">{fmt(r.remaining)}</td>
                  <td className="p-2 truncate max-w-[100px] text-[10px] text-slate-500">{r.notes || "—"}</td>
                  <td className="p-2 text-[10px] text-center">{r.phone || "—"}</td>
                  <td className="p-2 text-center space-x-1">
                    <button onClick={() => setPaymentModal({ row: r, year: 2026 })} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold hover:bg-purple-600 hover:text-white">💵</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2026 })} className="text-blue-600 hover:underline font-bold text-[10px] px-1">✏️</button>
                    <button onClick={() => generatePreview(r.name)} className="px-1.5 py-0.5 bg-slate-50 rounded text-[10px] hover:bg-teal-700 hover:text-white">📄</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== نافذة إضافة قسط جديد ========== */}
      {newStudentPayment.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full" dir="rtl">
            <h3 className="font-bold text-sm border-b pb-2 mb-3">➕ إضافة قسط جديد - {newStudentPayment.year}</h3>
            <form onSubmit={addNewStudentPayment} className="space-y-3">
              <input type="text" required placeholder="اسم المتدرب" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50" />
              <input type="number" required placeholder="المبلغ" value={newStudentAmount} onChange={e => setNewStudentAmount(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50" />
              <select required value={newStudentMonth} onChange={e => setNewStudentMonth(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50">
                <option value="">اختر الشهر</option>
                {MONTHS_2026.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setNewStudentPayment({ show: false, year: 2026 })} className="px-3 py-1.5 bg-slate-100 rounded text-xs">إلغاء</button>
                <button type="submit" className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-bold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة تسجيل دفعة ========== */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full" dir="rtl">
            <h3 className="font-bold text-sm border-b pb-2 mb-3">💵 دفعة - {paymentModal.row.name}</h3>
            <form onSubmit={addPayment} className="space-y-3">
              <input type="number" required placeholder="المبلغ" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50" />
              <select required value={payMonth} onChange={e => setPayMonth(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50">
                <option value="">اختر الشهر</option>
                {(paymentModal.year === 2025 ? MONTHS_2025 : MONTHS_2026).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-3 py-1.5 bg-slate-100 rounded text-xs">إلغاء</button>
                <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة المعاينة ========== */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-3 border-b bg-gray-50">
              <h3 className="font-bold text-xs">📊 كشف حساب - {previewModal.name}</h3>
              <div className="flex gap-1.5">
                <button onClick={() => { const w = window.open('', '', 'width=1000,height=700'); w?.document.write(previewModal.html); w?.document.close(); setTimeout(() => w?.print(), 500); }} className="px-3 py-1.5 bg-teal-600 text-white rounded text-[10px] font-bold">🖨️ طباعة</button>
                <button onClick={() => downloadPDF(previewModal.name)} className="px-3 py-1.5 bg-purple-600 text-white rounded text-[10px] font-bold">📥 PDF</button>
                <button onClick={() => setPreviewModal(null)} className="px-3 py-1.5 bg-slate-500 text-white rounded text-[10px] font-bold">✕</button>
              </div>
            </div>
            <iframe srcDoc={previewModal.html} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}

      {/* ========== نافذة التعديل ========== */}
      {editingRow && (
        <EditModal 
          title={`تعديل - ${editingRow.row.name}`}
          fields={[
            { key: "name", label: "الاسم", colSpan: 2 },
            { key: "batch", label: "الدفعة" },
            { key: "specialty", label: "المساق" },
            ...(editingRow.year === 2026 
              ? [{ key: "fees", label: "رسوم 2026", type: "number" as const }, { key: "prevDue", label: "متبقي 2025", type: "number" as const }]
              : [{ key: "fees", label: "رسوم 2025", type: "number" as const }]
            ),
            { key: "totalPaid", label: "المسدد", type: "number" },
            { key: "remaining", label: "الرصيد", type: "number" },
            { key: "phone", label: "الهاتف" },
            { key: "notes", label: "ملاحظات", colSpan: 3 },
          ]}
          values={editingRow.row}
          onClose={() => setEditingRow(null)}
          onSave={(updated) => {
            const cleaned = { ...updated };
            ["fees", "prevDue", "totalPaid", "remaining"].forEach(k => { if (cleaned[k] !== undefined) cleaned[k] = cleanNumber(cleaned[k]); });
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
