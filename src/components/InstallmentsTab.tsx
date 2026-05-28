import React, { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// الأشهر المحددة لعام 2025 في ملفك المرفوع
const MONTHS_2025 = [
  "يونيو 2024", "يوليو 2024", "أغسطس 2024", 
  "مارس 2025", "ابريل 2025", "مايو 2025", 
  "يونيو 2025", "يوليو 2025", "أغسطس 2025", 
  "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"
];

// شهور عام 2026 كما هي مكتوبة تماماً وبأدق تفاصيلها في ملفك
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

  // دالة تطهير فائقة القوة تحذف الفواصل، الفراغات العربية، الأجنبية، والرموز المخفية تماماً
  const superCleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    let str = String(val);
    // حذف فواصل الآلاف، الفراغات العادية، والفراغات المشفرة الخاصة بملفات الـ CSV
    str = str.replace(/,/g, "")
             .replace(/\s+/g, "")
             .replace(/[\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "")
             .trim();
    return Number(str) || 0;
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

  // استيراد عام 2025
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
          return cStr.includes("متدرب") || cStr.includes("الاسم");
        }));
        
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على سطر العناوين (اسم المتدرب)");
          return;
        }

        const headers = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);

        const cleanJson = dataRows
          .map(row => {
            const rowData: any = {};
            headers.forEach((header, index) => { if (header) rowData[header] = row[index]; });
            return rowData;
          })
          .filter(row => row["اسم المتدرب"] && String(row["اسم المتدرب"]).trim() !== "" && String(row["اسم المتدرب"]).trim() !== "الإجمالي")
          .map(row => {
            const payments = MONTHS_2025.reduce((acc, m) => ({ ...acc, [m]: superCleanNumber(row[m]) }), {} as any);
            let totalPaid = superCleanNumber(row["الإجمالي"]);
            if (!totalPaid) {
              MONTHS_2025.forEach(m => { totalPaid += payments[m]; });
            }

            return {
              name: String(row["اسم المتدرب"] || "").trim(),
              batch: String(row["رقم الدفعة"] || "").trim(),
              specialty: String(row["المساق"] || "").trim(),
              fees: superCleanNumber(row["مبلغ الرسوم"]),
              totalPaid: totalPaid,
              remaining: superCleanNumber(row["المتبقي"]),
              notes: String(row["ملاحظات"] || "").trim(),
              phone: String(row["رقم الهاتف"] || "").trim(),
              payments: payments
            };
          });

        useStore.setState({ installments2025: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2025م`);
      } catch (error) {
        toast.error("حدث خطأ أثناء معالجة ملف 2025");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // استيراد عام 2026 الفائق والمطابق تماماً لملفك المرفوع
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
          return cStr.includes("متدرب") || cStr.includes("الاسم");
        }));
        
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على سطر العناوين في ملف 2026");
          return;
        }

        // قراءة العناوين مع تنظيف الفراغات
        const headers = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);

        const cleanJson = dataRows
          .map(row => {
            const rowData: any = {};
            headers.forEach((header, index) => { if (header) rowData[header] = row[index]; });
            return rowData;
          })
          .filter(row => {
            const nameVal = String(row["اسم المتدرب"] || row["الاسم"] || "").trim();
            return nameVal !== "" && nameVal !== "الإجمالي" && !nameVal.includes("كشف تفصيلي");
          })
          .map(row => {
            // البحث المرن عن المسميات داخل ملف الـ CSV التابع لك
            const name = String(row["اسم المتدرب"] || row["الاسم"] || "").trim();
            const batch = String(row["رقم الدفعة"] || row["الدفعة"] || "").trim();
            const specialty = String(row["المساق"] || "").trim();
            
            const fees = superCleanNumber(row["مبلغ الرسوم"] || row["رسوم الدراسة"]);
            const prevDue = superCleanNumber(row["المتبقي عليهم من العام 2025"]);
            const totalPaid = superCleanNumber(row["الإجمالي"] || row["المسدد"]);
            const remaining = superCleanNumber(row["المتبقي"] || row["المتبقي "]);

            const payments = MONTHS_2026_CLEAN.reduce((acc, m) => ({ ...acc, [m]: superCleanNumber(row[m]) }), {} as any);

            return {
              name, batch, specialty, fees, prevDue, totalPaid, remaining,
              notes: String(row["ملاحظات"] || "").trim(),
              phone: String(row["رقم الهاتف"] || "").trim(),
              payments
            };
          });

        useStore.setState({ installments: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2026م`);
      } catch (error) {
        console.error(error);
        toast.error("حدث خطأ أثناء معالجة ملف 2026");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const printComprehensiveStatement = (studentName: string) => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const r2026 = (installments || []).find((i: any) => i.name === studentName);

    if (!r2025 && !r2026) {
      toast.error("لا توجد سجلات مالية متوفرة لهذا الاسم");
      return;
    }

    const pdf = new jsPDF({ orientation: "landscape" });
    pdf.setFontSize(20);
    pdf.text(`المجلس اليمني للاختصاصات الطبية - كشف حساب مالي موحد`, 148, 15, { align: "center" });
    pdf.setFontSize(13);
    pdf.text(`اسم الطبيب المتدرب: ${studentName}`, 280, 24, { align: "right" });
    pdf.text(`تاريخ الاستخراج: ${today()}`, 20, 24, { align: "left" });

    let currentY = 30;

    if (r2025) {
      pdf.setFontSize(11);
      pdf.text(`■ بيان الأقساط والرسوم لعام 2025م:`, 280, currentY, { align: "right" });
      
      const head2025 = ["الدفعة", "المساق", "مبلغ الرسوم", "الإجمالي المسدد", "المتبقي", "رقم الهاتف", "ملاحظات"];
      const body2025 = [[r2025.batch, r2025.specialty, fmt(r2025.fees), fmt(r2025.totalPaid), fmt(r2025.remaining), r2025.phone, r2025.notes || "—"]];

      autoTable(pdf, {
        head: [head2025],
        body: body2025,
        startY: currentY + 3,
        styles: { halign: "right", fontSize: 9 },
        headStyles: { fillCountry: [13, 148, 136] }
      });
      currentY = (pdf as any).lastAutoTable.finalY + 10;
    }

    if (r2026) {
      pdf.setFontSize(11);
      pdf.text(`■ بيان الأقساط والرسوم لعام 2026م:`, 280, currentY, { align: "right" });
      
      const head2026 = ["الدفعة", "المساق", "رسوم الدراسة", "متبقي 2025", "المسدد 2026", "المتبقي الحالي", "رقم الهاتف", "ملاحظات"];
      const body2026 = [[r2026.batch, r2026.specialty, fmt(r2026.fees), fmt(r2026.prevDue), fmt(r2026.totalPaid), fmt(r2026.remaining), r2026.phone, r2026.notes || "—"]];

      autoTable(pdf, {
        head: [head2026],
        body: body2026,
        startY: currentY + 3,
        styles: { halign: "right", fontSize: 9 },
        headStyles: { fillCountry: [30, 41, 59] }
      });
    }

    pdf.save(`كشف_حساب_موحد_${studentName}.pdf`);
    toast.success("تم استخراج التقرير بنجاح");
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
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">كشف موحد</button>
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
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== نافذة تسجيل قسط يدوي (Payment Modal) ================== */}
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

      {/* ================== مودال التعديل الشامل والكامل ================== */}
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
