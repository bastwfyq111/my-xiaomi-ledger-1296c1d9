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
  const [paymentModal, setPaymentModal] = useState<{ row: any } | null>(null); // فقط للعام 2026
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
    const updated = (installments || []).map((s: any) => {
      if (s.name !== paymentModal.row.name) return s;
      const payments = { ...s.payments, [payMonth]: (Number(s.payments[payMonth]) || 0) + amount };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      const remaining = (cleanNumber(s.fees) + cleanNumber(s.prevDue)) - totalPaid;
      return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
    });

    useStore.setState({ installments: updated });
    toast.success(`تم تسجيل قسط ${fmt(amount)} لشهر ${payMonth}`);
    setPaymentModal(null); 
    setPayAmount(""); 
    setPayMonth("");
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

  // دالة إنشاء كشف حساب يجمع بيانات 2025 و 2026 بنفس تنسيق الصورة
  const generateCombinedStatement = (studentName: string) => {
    const student2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const student2026 = (installments || []).find((i: any) => i.name === studentName);
    
    // بيانات 2025
    const fees2025 = student2025 ? cleanNumber(student2025.fees) : 0;
    const paid2025 = student2025 ? cleanNumber(student2025.totalPaid) : 0;
    const remaining2025 = student2025 ? cleanNumber(student2025.remaining) : 0;
    
    // بيانات 2026
    const fees2026 = student2026 ? cleanNumber(student2026.fees) : 0;
    const prevDue2026 = student2026 ? cleanNumber(student2026.prevDue) : 0;
    const totalDue2026 = fees2026 + prevDue2026;
    const paid2026 = student2026 ? cleanNumber(student2026.totalPaid) : 0;
    const remaining2026 = student2026 ? cleanNumber(student2026.remaining) : 0;
    
    // دفعات محددة للعام 2026 (حسب الصورة: يناير ومارس)
    const janPaid = student2026 ? Number(student2026.payments?.["يناير"]) || 0 : 0;
    const marPaid = student2026 ? Number(student2026.payments?.["مارس"]) || 0 : 0;
    const totalPaidSoFar = janPaid + marPaid;
    
    // دفعات محددة للعام 2025 (إذا وجدت)
    const decPaid2025 = student2025 ? Number(student2025.payments?.["ديسمبر2025"]) || 0 : 0;
    
    const batch = student2026?.batch || student2025?.batch || "—";
    const phone = student2026?.phone || student2025?.phone || "—";
    const specialty = student2026?.specialty || student2025?.specialty || "—";

    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كشف حساب - ${studentName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Cairo', sans-serif;
            background: #e2e8f0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
          }
          .statement {
            max-width: 700px;
            width: 100%;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 35px -10px rgba(0,0,0,0.2);
          }
          .header {
            background: linear-gradient(135deg, #0f766e, #0d9488);
            padding: 25px 20px;
            text-align: center;
            color: white;
          }
          .header h3 {
            font-size: 18px;
            font-weight: 500;
            letter-spacing: 1px;
            margin-bottom: 8px;
            opacity: 0.9;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 5px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.85;
          }
          .student-info {
            background: #f0fdf4;
            padding: 16px 20px;
            border-bottom: 1px solid #dcfce7;
          }
          .student-info .name {
            font-size: 20px;
            font-weight: 800;
            color: #065f46;
            margin-bottom: 8px;
          }
          .student-info .details {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #166534;
            flex-wrap: wrap;
            gap: 10px;
          }
          .content {
            padding: 20px;
          }
          .section-title {
            font-size: 18px;
            font-weight: 800;
            color: #0f766e;
            border-right: 4px solid #0d9488;
            padding-right: 12px;
            margin: 15px 0 10px 0;
          }
          .section-title:first-of-type {
            margin-top: 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .label {
            font-weight: 600;
            color: #475569;
          }
          .value {
            font-weight: 700;
            font-family: monospace;
            font-size: 16px;
          }
          .due-row {
            background: #fef2f2;
            margin: 0 -20px;
            padding: 10px 20px;
            border-bottom: 1px solid #fecaca;
          }
          .paid-row {
            background: #f0fdf4;
            margin: 0 -20px;
            padding: 10px 20px;
            border-bottom: 1px solid #dcfce7;
          }
          .total-row {
            background: #f1f5f9;
            margin: 0 -20px;
            padding: 10px 20px;
            font-size: 18px;
          }
          .amount {
            font-size: 18px;
            font-weight: 800;
          }
          .red { color: #dc2626; }
          .green { color: #16a34a; }
          .blue { color: #2563eb; }
          .footer {
            background: #f8fafc;
            padding: 12px 20px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
          }
          .year-badge {
            display: inline-block;
            background: #e6f7f5;
            color: #0f766e;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
          }
          @media print {
            body { background: white; padding: 0; }
            .statement { box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="statement">
          <div class="header">
            <h3>المجلس اليمني للاختصاصات الطبية - صعدة</h3>
            <h1>كشف حساب أقساط</h1>
            <p>العامان 2025 - 2026م</p>
          </div>
          
          <div class="student-info">
            <div class="name">${studentName}</div>
            <div class="details">
              <span>الدفعة: ${batch}</span>
              <span>المساق: ${specialty}</span>
              <span>رقم الهاتف: ${phone}</span>
            </div>
          </div>
          
          <div class="content">
            <!-- قسم العام 2025 -->
            <div class="section-title">
              العام 2025م
              <span class="year-badge">أرشيف</span>
            </div>
            
            <div class="row">
              <span class="label">رسوم الدراسة</span>
              <span class="value">${fmt(fees2025)}</span>
            </div>
            
            <div class="row">
              <span class="label">المسدد</span>
              <span class="value green">${fmt(paid2025)}</span>
            </div>
            
            <div class="due-row">
              <span class="label">المتبقي (عليه)</span>
              <span class="value amount red">${fmt(remaining2025)}</span>
            </div>
            
            <!-- قسم العام 2026 بنفس تنسيق الصورة -->
            <div class="section-title" style="margin-top: 25px;">
              العام 2026م
              <span class="year-badge">الحالي</span>
            </div>
            
            <div class="row">
              <span class="label">رسوم الدراسة</span>
              <span class="value">${fmt(fees2026)}</span>
            </div>
            
            <div class="row">
              <span class="label">متبقي من العام 2025 (عليه)</span>
              <span class="value red">${fmt(prevDue2026)}</span>
            </div>
            
            <div class="due-row">
              <span class="label">إجمالي المستحق عليه</span>
              <span class="value amount red">${fmt(totalDue2026)}</span>
            </div>
            
            <div class="row">
              <span class="label">سداد شهر يناير (له)</span>
              <span class="value green">${fmt(janPaid)}</span>
            </div>
            
            <div class="row">
              <span class="label">سداد شهر مارس (له)</span>
              <span class="value green">${fmt(marPaid)}</span>
            </div>
            
            <div class="paid-row">
              <span class="label">إجمالي المسدد (له)</span>
              <span class="value amount green">${fmt(totalPaidSoFar)}</span>
            </div>
            
            <div class="total-row">
              <span class="label">الرصيد المتبقي عليه</span>
              <span class="value amount red">${fmt(remaining2026)}</span>
            </div>
          </div>
          
          <div class="footer">
            تم الإنشاء بتاريخ ${today()}
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const downloadCombinedPDF = async (studentName: string) => {
    try {
      const student2025 = (installments2025 || []).find((i: any) => i.name === studentName);
      const student2026 = (installments || []).find((i: any) => i.name === studentName);
      
      const pdf = new jsPDF({ orientation: "portrait", format: "a4" });
      
      // بيانات 2025
      const fees2025 = student2025 ? cleanNumber(student2025.fees) : 0;
      const paid2025 = student2025 ? cleanNumber(student2025.totalPaid) : 0;
      const remaining2025 = student2025 ? cleanNumber(student2025.remaining) : 0;
      
      // بيانات 2026
      const fees2026 = student2026 ? cleanNumber(student2026.fees) : 0;
      const prevDue2026 = student2026 ? cleanNumber(student2026.prevDue) : 0;
      const totalDue2026 = fees2026 + prevDue2026;
      const remaining2026 = student2026 ? cleanNumber(student2026.remaining) : 0;
      const janPaid = student2026 ? Number(student2026.payments?.["يناير"]) || 0 : 0;
      const marPaid = student2026 ? Number(student2026.payments?.["مارس"]) || 0 : 0;
      const totalPaidSoFar = janPaid + marPaid;
      
      const batch = student2026?.batch || student2025?.batch || "—";
      const phone = student2026?.phone || student2025?.phone || "—";

      pdf.setFontSize(14);
      pdf.text("المجلس اليمني للاختصاصات الطبية - صعدة", 105, 15, { align: "center" });
      pdf.setFontSize(16);
      pdf.text("كشف حساب أقساط - العامان 2025 و 2026م", 105, 25, { align: "center" });
      
      pdf.setFontSize(12);
      pdf.text(`الاسم: ${studentName}`, 20, 40);
      pdf.text(`الدفعة: ${batch}`, 20, 48);
      pdf.text(`رقم الهاتف: ${phone}`, 120, 48);
      
      // بيانات 2025
      pdf.setFontSize(14);
      pdf.text("العام 2025م", 20, 60);
      
      autoTable(pdf, {
        startY: 65,
        body: [
          ["رسوم الدراسة", fmt(fees2025)],
          ["المسدد", fmt(paid2025)],
          ["المتبقي (عليه)", fmt(remaining2025)],
        ],
        theme: "plain",
        styles: { fontSize: 11, cellPadding: 4, halign: "right" },
        columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "left", fontStyle: "bold" } },
        margin: { right: 20, left: 20 },
      });
      
      // بيانات 2026
      let finalY = (pdf as any).lastAutoTable?.finalY + 10 || 90;
      pdf.setFontSize(14);
      pdf.text("العام 2026م", 20, finalY);
      
      autoTable(pdf, {
        startY: finalY + 5,
        body: [
          ["رسوم الدراسة", fmt(fees2026)],
          ["متبقي من العام 2025 (عليه)", fmt(prevDue2026)],
          ["إجمالي المستحق عليه", fmt(totalDue2026)],
          ["سداد شهر يناير (له)", fmt(janPaid)],
          ["سداد شهر مارس (له)", fmt(marPaid)],
          ["إجمالي المسدد (له)", fmt(totalPaidSoFar)],
          ["الرصيد المتبقي عليه", fmt(remaining2026)],
        ],
        theme: "plain",
        styles: { fontSize: 11, cellPadding: 4, halign: "right" },
        columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "left", fontStyle: "bold" } },
        margin: { right: 20, left: 20 },
      });
      
      pdf.save(`كشف_حساب_${studentName}_2025_2026.pdf`);
      toast.success("تم تحميل كشف الحساب");
    } catch {
      toast.error("فشل التحميل");
    }
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
                {year === 2026 && (
                  <button onClick={() => setPaymentModal({ row: r })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold hover:bg-emerald-600 hover:text-white">💵</button>
                )}
                <button onClick={() => setEditingRow({ row: r, year })} className="text-blue-600 hover:underline font-bold px-1">✏️</button>
                <button onClick={() => setPreviewModal({ name: r.name, html: generateCombinedStatement(r.name) })} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded hover:bg-teal-600 hover:text-white">📄 كشف</button>
                <button onClick={() => downloadCombinedPDF(r.name)} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded hover:bg-purple-600 hover:text-white">📥 PDF</button>
               </td>
             </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8" dir="rtl">
      {/* جدول أقساط 2025 */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط 2025</h2>
            <p className="text-xs text-slate-500">الأرشيف</p>
          </div>
          <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700">
            📥 استيراد 2025
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2025)} className="hidden" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">إجمالي الرسوم</span>
            <span className="text-sm font-mono font-bold block">{fmt(totals2025.fees)}</span>
          </div>
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">المسدد</span>
            <span className="text-sm font-mono font-bold block text-green-600">{fmt(totals2025.paid)}</span>
          </div>
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">المتبقي</span>
            <span className="text-sm font-mono font-bold block text-red-600">{fmt(totals2025.remaining)}</span>
          </div>
        </div>
        {renderTable(controls2025, 2025)}
      </div>

      {/* جدول أقساط 2026 */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط 2026</h2>
            <p className="text-xs text-slate-500">العام الحالي</p>
          </div>
          <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700">
            📥 استيراد 2026
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2026)} className="hidden" />
          </label>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">إجمالي الرسوم</span>
            <span className="text-sm font-mono font-bold block">{fmt(totals2026.fees)}</span>
          </div>
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">متبقي 2025</span>
            <span className="text-sm font-mono font-bold block text-red-600">{fmt(totals2026.prevDue)}</span>
          </div>
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">المسدد</span>
            <span className="text-sm font-mono font-bold block text-green-600">{fmt(totals2026.paid)}</span>
          </div>
          <div className="bg-slate-50 p-2 border rounded-lg">
            <span className="text-xs text-slate-500">المتبقي</span>
            <span className="text-sm font-mono font-bold block text-red-600">{fmt(totals2026.remaining)}</span>
          </div>
        </div>
        {renderTable(controls2026, 2026)}
      </div>

      {/* نافذة تسجيل القسط اليدوي للعام 2026 فقط */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full" dir="rtl">
            <h3 className="font-bold border-b pb-2 mb-4">➕ تسجيل دفعة يدوية - 2026</h3>
            <p className="text-sm mb-4">المتدرب: <b>{paymentModal.row.name}</b></p>
            <form onSubmit={addPayment} className="space-y-4">
              <input 
                type="number" 
                required 
                placeholder="المبلغ" 
                value={payAmount} 
                onChange={e => setPayAmount(e.target.value)} 
                className="w-full p-2 border rounded bg-slate-50" 
              />
              <select 
                required 
                value={payMonth} 
                onChange={e => setPayMonth(e.target.value)} 
                className="w-full p-2 border rounded bg-slate-50"
              >
                <option value="">اختر الشهر</option>
                {MONTHS_2026.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-4 py-2 bg-slate-100 rounded">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة معاينة كشف الحساب الموحد */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl h-auto max-h-[95vh] flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold">📊 كشف حساب شامل - {previewModal.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => downloadCombinedPDF(previewModal.name)} className="px-4 py-2 bg-purple-600 text-white rounded text-sm">📥 تحميل PDF</button>
                <button onClick={() => setPreviewModal(null)} className="px-4 py-2 bg-slate-500 text-white rounded text-sm">✕ إغلاق</button>
              </div>
            </div>
            <iframe srcDoc={previewModal.html} className="w-full h-[85vh] border-0" title="كشف الحساب" />
          </div>
        </div>
      )}

      {/* نافذة التعديل */}
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
