import React, { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// الأشهر المحددة لعام 2025
const MONTHS_2025 = [
  "يونيو 2024", "يوليو 2024", "أغسطس 2024", 
  "مارس 2025", "ابريل 2025", "مايو 2025", 
  "يونيو 2025", "يوليو 2025", "أغسطس 2025", 
  "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"
];

// شهور عام 2026
const MONTHS_2026_CLEAN = [
  "يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", 
  "يوليو", "اغسطس", "سبتمبر", "اكتوبر ", "نوفمبر", "ديسمبر"
];

const BASE_COLS = [
  { key: "name", label: "الاسم" },
  { key: "batch", label: "الدفعة" },
  { key: "specialty", label: "المساق" },
  { key: "fees", label: "مبلغ الرسوم" },
  { key: "totalPaid", label: "الإجمالي المسدد" },
  { key: "remaining", label: "المتبقي" },
  { key: "notes", label: "ملاحظات" },
  { key: "phone", label: "رقم الهاتف" },
];

export default function InstallmentsTab() {
  const { 
    installments,       
    installments2025,   
  } = useStore() as any;

  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMonth, setPayMonth] = useState<string>("");

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"]);
  const controls2025 = useTableControls(installments2025 || [], BASE_COLS.map(c => c.key));

  // دالة تطهير الأرقام من الفواصل والفراغات المخفية
  const superCleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    let str = String(val);
    str = str.replace(/,/g, "").replace(/\s+/g, "").replace(/[\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "").trim();
    return Number(str) || 0;
  };

  const cleanKey = (str: any): string => {
    if (!str) return "";
    return String(str).replace(/\s+/g, "").replace(/[\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "").trim();
  };

  const totals2025 = useMemo(() => {
    const list = controls2025.rows || [];
    return {
      fees: list.reduce((s, r) => s + superCleanNumber(r.fees), 0),
      paid: list.reduce((s, r) => s + superCleanNumber(r.totalPaid), 0),
      remaining: list.reduce((s, r) => s + superCleanNumber(r.remaining), 0),
    };
  }, [controls2025.rows]);

  const totals2026 = useMemo(() => {
    const list = controls2026.rows || [];
    return {
      fees: list.reduce((s, r) => s + superCleanNumber(r.fees), 0),
      prevDue: list.reduce((s, r) => s + superCleanNumber(r.prevDue), 0),
      paid: list.reduce((s, r) => s + superCleanNumber(r.totalPaid), 0),
      remaining: list.reduce((s, r) => s + superCleanNumber(r.remaining), 0),
    };
  }, [controls2026.rows]);

  const handleAddManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || !payAmount || !payMonth) {
      toast.error("يرجى إدخال مبلغ القسط واختيار الشهر");
      return;
    }

    const amountNum = Number(payAmount) || 0;
    const is2025 = paymentModal.year === 2025;
    const currentList = is2025 ? (installments2025 || []) : (installments || []);

    const updatedList = currentList.map((student: any) => {
      if (student.name === paymentModal.row.name) {
        const updatedPayments = { ...student.payments };
        updatedPayments[payMonth] = (Number(updatedPayments[payMonth]) || 0) + amountNum;

        let newTotalPaid = 0;
        const targetMonths = is2025 ? MONTHS_2025 : MONTHS_2026_CLEAN;
        targetMonths.forEach(m => {
          newTotalPaid += Number(updatedPayments[m]) || 0;
        });

        let newRemaining = 0;
        if (is2025) {
          newRemaining = superCleanNumber(student.fees) - newTotalPaid;
        } else {
          newRemaining = (superCleanNumber(student.fees) + superCleanNumber(student.prevDue)) - newTotalPaid;
        }

        return {
          ...student,
          payments: updatedPayments,
          totalPaid: newTotalPaid,
          remaining: newRemaining < 0 ? 0 : newRemaining
        };
      }
      return student;
    });

    if (is2025) {
      useStore.setState({ installments2025: updatedList });
    } else {
      useStore.setState({ installments: updatedList });
    }

    toast.success(`تم تسجيل قسط بقيمة ${fmt(amountNum)} لشهر (${payMonth}) بنجاح`);
    setPaymentModal(null);
    setPayAmount("");
    setPayMonth("");
  };

  // ================== استيراد ملف 2025 ==================
  const handleImport2025 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
        
        const headerIndex = rows.findIndex(row => row && row.some((cell: any) => {
          const cStr = String(cell);
          return cStr.includes("متدرب") || cStr.includes("الاسم") || cStr.includes("المساق");
        }));
        
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على سطر العناوين في ملف 2025");
          return;
        }

        const rawHeaders = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);

        const cleanJson = dataRows
          .map(row => {
            const rowData: any = {};
            rawHeaders.forEach((header, index) => {
              if (header) rowData[header] = row[index];
            });
            return rowData;
          })
          .filter(row => {
            const actualNameKey = Object.keys(row).find(k => k.includes("اسم") || k.includes("الاسم"));
            const nameVal = actualNameKey ? String(row[actualNameKey]).trim() : "";
            return nameVal !== "" && nameVal !== "الإجمالي" && !nameVal.includes("كشف");
          })
          .map(row => {
            const findVal = (keywords: string[]) => {
              const foundKey = Object.keys(row).find(k => keywords.some(kw => k.includes(kw)));
              return foundKey ? row[foundKey] : "";
            };

            const name = String(findVal(["اسم", "الاسم"])).trim();
            const batch = String(findVal(["دفعة", "الدفعة"])).trim();
            const specialty = String(findVal(["مساق", "المساق"])).trim();
            const fees = superCleanNumber(findVal(["رسوم", "الرسوم", "مبلغ"]));
            const totalPaidFromExcel = superCleanNumber(findVal(["المسدد", "الإجمالي", "المدفوع"]));
            const remaining = superCleanNumber(findVal(["المتبقي"]));
            const notes = String(findVal(["ملاحظات"])).trim();
            const phone = String(findVal(["هاتف", "تلفون"])).trim();

            const payments = MONTHS_2025.reduce((acc, m) => {
              const exactMonthKey = Object.keys(row).find(k => cleanKey(k) === cleanKey(m));
              acc[m] = exactMonthKey ? superCleanNumber(row[exactMonthKey]) : 0;
              return acc;
            }, {} as any);

            let totalPaid = totalPaidFromExcel;
            if (!totalPaid) {
              MONTHS_2025.forEach(m => { totalPaid += payments[m]; });
            }

            return { name, batch, specialty, fees, totalPaid, remaining, notes, phone, payments };
          });

        if (cleanJson.length === 0) {
          toast.error("لم يتم استيراد أي بيانات، يرجى التحقق من صياغة ملف 2025");
          return;
        }

        useStore.setState({ installments2025: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2025م`);
      } catch (error) {
        toast.error("حدث خطأ أثناء معالجة ملف 2025");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ================== استيراد ملف 2026 ==================
  const handleImport2026 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
        
        const headerIndex = rows.findIndex(row => row && row.some((cell: any) => {
          const cStr = String(cell);
          return cStr.includes("متدرب") || cStr.includes("الاسم") || cStr.includes("المساق");
        }));
        
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على سطر العناوين في ملف 2026");
          return;
        }

        const rawHeaders = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);

        const cleanJson = dataRows
          .map(row => {
            const rowData: any = {};
            rawHeaders.forEach((header, index) => {
              if (header) rowData[header] = row[index];
            });
            return rowData;
          })
          .filter(row => {
            const actualNameKey = Object.keys(row).find(k => k.includes("اسم") || k.includes("الاسم"));
            const nameVal = actualNameKey ? String(row[actualNameKey]).trim() : "";
            return nameVal !== "" && nameVal !== "الإجمالي" && !nameVal.includes("كشف");
          })
          .map(row => {
            const findVal = (keywords: string[]) => {
              const foundKey = Object.keys(row).find(k => keywords.some(kw => k.includes(kw)));
              return foundKey ? row[foundKey] : "";
            };

            const name = String(findVal(["اسم", "الاسم"])).trim();
            const batch = String(findVal(["دفعة", "الدفعة"])).trim();
            const specialty = String(findVal(["مساق", "المساق"])).trim();
            const fees = superCleanNumber(findVal(["رسوم", "الرسوم", "مبلغ الرسوم"]));
            const prevDue = superCleanNumber(findVal(["2025", "السابق", "متبقي عليهم"]));
            const totalPaid = superCleanNumber(findVal(["المسدد", "الإجمالي"]));
            const remaining = superCleanNumber(findVal(["المتبقي"]));
            const notes = String(findVal(["ملاحظات"])).trim();
            const phone = String(findVal(["هاتف", "تلفون"])).trim();

            const payments = MONTHS_2026_CLEAN.reduce((acc, m) => {
              const exactMonthKey = Object.keys(row).find(k => cleanKey(k) === cleanKey(m));
              acc[m] = exactMonthKey ? superCleanNumber(row[exactMonthKey]) : 0;
              return acc;
            }, {} as any);

            return { name, batch, specialty, fees, prevDue, totalPaid, remaining, notes, phone, payments };
          });

        if (cleanJson.length === 0) {
          toast.error("لم يتم استيراد أي بيانات، يرجى التحقق من صياغة ملف 2026");
          return;
        }

        useStore.setState({ installments: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2026م`);
      } catch (error) {
        toast.error("حدث خطأ أثناء معالجة ملف 2026");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ================== تصدير كشف حساب PDF باستخدام نافذة الطباعة ==================
  const printComprehensiveStatement = (studentName: string) => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const r2026 = (installments || []).find((i: any) => i.name === studentName);

    if (!r2025 && !r2026) {
      toast.error("لا توجد سجلات مالية متوفرة لهذا الاسم");
      return;
    }

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للمتصفح");
      return;
    }

    let body = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #0f766e; margin-bottom: 5px;">كشف الحساب المالي الموحد</h1>
      <div style="color: #64748b; font-size: 14px;">المجلس اليمني للاختصاصات الطبية — فرع صعدة</div>
      <div style="color: #94a3b8; font-size: 12px; margin-top: 5px;">تاريخ الاستخراج: ${today()}</div>
    </div>
    <div class="student-info">
      <div><strong>الاسم:</strong> ${studentName}</div>
      <div><strong>التخصص:</strong> ${r2026?.specialty || r2025?.specialty || "—"}</div>
      <div><strong>الدفعة:</strong> ${r2026?.batch || r2025?.batch || "—"}</div>
      ${(r2026?.phone || r2025?.phone) ? `<div><strong>الهاتف:</strong> ${r2026?.phone || r2025?.phone}</div>` : ""}
    </div>
    `;

    if (r2025) {
      body += `
      <h3>📋 بيان أقساط ورسوم عام 2025م</h3>
      <table>
        <thead>
          <tr>
            <th>مبلغ الرسوم</th>
            <th>الإجمالي المسدد</th>
            <th>المتبقي</th>
            ${r2025.notes ? '<th>ملاحظات</th>' : ''}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="amount">${fmt(r2025.fees)}</td>
            <td class="amount paid">${fmt(r2025.totalPaid)}</td>
            <td class="amount remaining">${fmt(r2025.remaining)}</td>
            ${r2025.notes ? `<td>${r2025.notes}</td>` : ''}
          </tr>
        </tbody>
      </table>
      
      ${r2025.payments ? `
      <h4 style="margin-top: 15px; color: #475569;">تفاصيل الأقساط الشهرية 2025:</h4>
      <table>
        <thead>
          <tr>${MONTHS_2025.map(m => `<th>${m}</th>`).join('')}</tr>
        </thead>
        <tbody>
          <tr>${MONTHS_2025.map(m => `<td class="amount">${fmt(r2025.payments[m] || 0)}</td>`).join('')}</tr>
        </tbody>
      </table>
      ` : ''}
      `;
    }

    if (r2026) {
      body += `
      <h3>📋 بيان أقساط ورسوم عام 2026م</h3>
      <table>
        <thead>
          <tr>
            <th>رسوم الدراسة</th>
            <th>متبقي من 2025</th>
            <th>المسدد في 2026</th>
            <th>المتبقي الحالي</th>
            ${r2026.notes ? '<th>ملاحظات</th>' : ''}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="amount">${fmt(r2026.fees)}</td>
            <td class="amount prev-due">${fmt(r2026.prevDue || 0)}</td>
            <td class="amount paid">${fmt(r2026.totalPaid)}</td>
            <td class="amount remaining">${fmt(r2026.remaining)}</td>
            ${r2026.notes ? `<td>${r2026.notes}</td>` : ''}
          </tr>
        </tbody>
      </table>
      
      ${r2026.payments ? `
      <h4 style="margin-top: 15px; color: #475569;">تفاصيل الأقساط الشهرية 2026:</h4>
      <table>
        <thead>
          <tr>${MONTHS_2026_CLEAN.map(m => `<th>${m}</th>`).join('')}</tr>
        </thead>
        <tbody>
          <tr>${MONTHS_2026_CLEAN.map(m => `<td class="amount">${fmt(r2026.payments[m] || 0)}</td>`).join('')}</tr>
        </tbody>
      </table>
      ` : ''}
      `;
    }

    // تذييل الصفحة
    body += `
    <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
      <div>تم استخراج هذا الكشف آلياً من نظام إدارة الأقساط والرسوم</div>
      <div>المجلس اليمني للاختصاصات الطبية © ${new Date().getFullYear()}</div>
    </div>
    `;

    const head = `
    <meta charset="utf-8">
    <title>كشف حساب - ${studentName}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body { 
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; 
        direction: rtl; 
        padding: 30px; 
        color: #1e293b;
        background: white;
        max-width: 1000px;
        margin: 0 auto;
      }
      
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-bottom: 25px; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        page-break-inside: avoid;
      }
      
      th { 
        background: #0f766e; 
        color: white; 
        padding: 10px 8px; 
        font-weight: 600;
        font-size: 13px;
        text-align: center;
        border: 1px solid #0d6b63;
      }
      
      td { 
        border: 1px solid #e2e8f0; 
        padding: 8px; 
        text-align: center; 
        font-size: 13px;
      }
      
      tr:nth-child(even) { background: #f8fafc; }
      
      h1 { 
        color: #0f766e; 
        text-align: center; 
        margin-bottom: 5px;
        font-size: 22px;
      }
      
      h3 { 
        color: #0f766e; 
        margin: 25px 0 10px 0; 
        padding-bottom: 8px;
        border-bottom: 2px solid #0f766e;
        font-size: 16px;
      }
      
      h4 {
        color: #475569;
        margin: 15px 0 8px 0;
        font-size: 13px;
      }
      
      .student-info { 
        display: flex; 
        justify-content: space-around; 
        flex-wrap: wrap;
        background: #f1f5f9; 
        padding: 15px; 
        margin-bottom: 25px; 
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
      
      .student-info div {
        padding: 5px 15px;
        font-size: 14px;
      }
      
      .amount {
        font-family: 'Courier New', monospace;
        font-weight: 600;
        font-size: 14px;
      }
      
      .paid {
        color: #059669;
      }
      
      .remaining {
        color: #dc2626;
      }
      
      .prev-due {
        color: #d97706;
      }
      
      @media print {
        body { padding: 15px; }
        @page { margin: 15mm; }
        table { page-break-inside: avoid; }
        h3 { page-break-after: avoid; }
      }
    </style>`;

    w.document.write(`<html><head>${head}</head><body>${body}<script>
      window.onload = function() {
        // انتظار تحميل الخط من Google Fonts ثم الطباعة
        document.fonts.ready.then(function() {
          window.print();
        });
      }
    </script></body></html>`);
    w.document.close();
    
    toast.success("تم فتح نافذة الطباعة");
  };

  return (
    <div className="space-y-8" dir="rtl">
      
      {/* ================== عام 2025م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2025م</h2>
            <p className="text-xxs text-slate-500">الأرشيف المستورد والمعدّل لعام 2025</p>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 shadow-sm transition">
            <span>📥 استيراد ملف إكسل 2025</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport2025} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 max-w-xl">
          <div className="bg-slate-50 p-2 border rounded-lg"><span className="text-xxs text-slate-500 block">إجمالي رسوم 2025</span><span className="text-sm font-mono font-bold text-slate-800">{fmt(totals2025.fees)}</span></div>
          <div className="bg-emerald-50 p-2 border border-emerald-200 rounded-lg"><span className="text-xxs text-emerald-600 block">إجمالي المسدد 2025</span><span className="text-sm font-mono font-bold text-emerald-700">{fmt(totals2025.paid)}</span></div>
          <div className="bg-rose-50 p-2 border border-rose-100 rounded-lg"><span className="text-xxs text-rose-600 block">المتبقي الإجمالي 2025</span><span className="text-sm font-mono font-bold text-rose-700">{fmt(totals2025.remaining)}</span></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="p-2 text-center w-10">م</th>
                {BASE_COLS.map(c => (
                  <th key={c.key} className="p-2 text-right cursor-pointer" onClick={() => controls2025.toggleSort(c.key)}>
                    {c.label} {sortIndicator(controls2025.sortKey === c.key, controls2025.sortDir)}
                  </th>
                ))}
                <th className="p-2 text-center w-48">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold text-slate-800">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="p-2 text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="p-2 text-slate-600 font-mono">{r.phone || "—"}</td>
                  <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setPaymentModal({ row: r, year: 2025 })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold hover:bg-emerald-600 hover:text-white transition">💵 دفعة</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2025 })} className="text-blue-600 hover:underline font-bold px-1">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">🖨️ كشف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== عام 2026م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2026م (العام الحالي)</h2>
            <p className="text-xxs text-slate-500">يتضمن الربط المباشر مع متبقيات 2025 وعمليات الدفع المباشرة</p>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-800 shadow-sm transition">
            <span>📥 استيراد ملف إكسل 2026</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport2026} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
          <div className="bg-slate-50 p-2 border rounded-lg"><span className="text-xxs text-slate-500 block">رسوم 2026</span><span className="text-sm font-mono font-bold">{fmt(totals2026.fees)}</span></div>
          <div className="bg-amber-50 p-2 border border-amber-200 rounded-lg"><span className="text-xxs text-amber-600 block">متبقيات سابقة 2025</span><span className="text-sm font-mono font-bold text-amber-700">{fmt(totals2026.prevDue)}</span></div>
          <div className="bg-emerald-50 p-2 border border-emerald-200 rounded-lg"><span className="text-xxs text-emerald-600 block">المسدد 2026</span><span className="text-sm font-mono font-bold text-emerald-700">{fmt(totals2026.paid)}</span></div>
          <div className="bg-rose-50 p-2 border border-rose-100 rounded-lg"><span className="text-xxs text-rose-600 block">إجمالي المتبقي الحالي</span><span className="text-sm font-mono font-bold text-rose-700">{fmt(totals2026.remaining)}</span></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="p-2 text-center w-10">م</th>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-center">الدفعة</th>
                <th className="p-2">المساق</th>
                <th className="p-2 text-right">رسوم الدراسة</th>
                <th className="p-2 text-right">متبقي 2025</th>
                <th className="p-2 text-right">المسدد 2026</th>
                <th className="p-2 text-right">المتبقي الحالي</th>
                <th className="p-2">ملاحظات</th>
                <th className="p-2 text-center w-48">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold text-slate-800">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-amber-600 font-bold">{fmt(r.prevDue || 0)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="p-2 text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setPaymentModal({ row: r, year: 2026 })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold hover:bg-emerald-600 hover:text-white transition">💵 دفعة</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2026 })} className="text-blue-600 hover:underline font-bold px-1">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">🖨️ كشف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== نافذة تسجيل قسط يدوي ================== */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-md w-full text-right" dir="rtl">
            <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">
              ➕ تسجيل دفعة/قسط يدوياً لعام {paymentModal.year}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              المتدرب: <span className="font-bold text-slate-800">{paymentModal.row.name}</span>
            </p>

            <form onSubmit={handleAddManualPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ القسط (ريال)</label>
                <input 
                  type="number" 
                  required
                  placeholder="مثال: 30000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الشهر المستهدف بالسداد</label>
                <select 
                  required
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50"
                >
                  <option value="">-- اختر الشهر المالي --</option>
                  {(paymentModal.year === 2025 ? MONTHS_2025 : MONTHS_2026_CLEAN).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button 
                  type="button" 
                  onClick={() => { setPaymentModal(null); setPayAmount(""); setPayMonth(""); }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                >
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm">
                  حفظ القسط وتحديث الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================== مودال التعديل ================== */}
      {editingRow && (() => {
        const is2025 = editingRow.year === 2025;
        const fields: EditField[] = [
          { key: "name", label: "الاسم", colSpan: 2 },
          { key: "batch", label: "الدفعة" },
          { key: "specialty", label: "المساق" },
          { key: "fees", label: "مبلغ الرسوم", type: "number" },
          ...(!is2025 ? [{ key: "prevDue", label: "متبقي 2025", type: "number" as const }] : []),
          { key: "totalPaid", label: "الإجمالي المسدد", type: "number" },
          { key: "remaining", label: "المتبقي النهائي", type: "number" },
          { key: "phone", label: "رقم الهاتف" },
          { key: "notes", label: "ملاحظات", colSpan: 3 },
        ];

        return (
          <EditModal 
            title={`تعديل القيد لعام ${editingRow.year} — المتدرب: ${editingRow.row.name}`}
            fields={fields}
            values={editingRow.row}
            onClose={() => setEditingRow(null)}
            onSave={(updated) => {
              const cleaned = { ...updated };
              ["fees", "prevDue", "totalPaid", "remaining"].forEach(k => {
                if (cleaned[k] !== undefined) cleaned[k] = superCleanNumber(cleaned[k]);
              });

              if (is2025) {
                const list = (installments2025 || []).map((item: any) => item.name === editingRow.row.name ? cleaned : item);
                useStore.setState({ installments2025: list });
              } else {
                const list = (installments || []).map((item: any) => item.name === editingRow.row.name ? cleaned : item);
                useStore.setState({ installments: list });
              }
              toast.success("تم التحديث الحركي للمخزن بنجاح");
              setEditingRow(null);
            }}
          />
        );
      })()}
    </div>
  );
                                                                  }
