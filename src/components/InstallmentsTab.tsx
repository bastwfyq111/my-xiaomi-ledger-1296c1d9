import React, { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// ========== إعداد الخط العربي للـ PDF ==========
const ARABIC_FONT_URL = '/fonts/Cairo-Regular.ttf'; // تأكد من وجود الملف في public/fonts

let arabicFontBase64: string | null = null;
let arabicFontLoaded = false;

const loadArabicFont = async (): Promise<string | null> => {
  if (arabicFontLoaded && arabicFontBase64) return arabicFontBase64;
  try {
    const response = await fetch(ARABIC_FONT_URL);
    if (!response.ok) throw new Error("فشل تحميل الخط");
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        arabicFontBase64 = (reader.result as string).split(',')[1];
        arabicFontLoaded = true;
        resolve(arabicFontBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("سيتم استخدام خط احتياطي للـ PDF، يفضل توفير خط عربي في /public/fonts/Cairo-Regular.ttf");
    return null;
  }
};

// إنشاء كائن PDF جاهز للغة العربية
const createArabicPDF = async (orientation: "portrait" | "landscape" = "landscape") => {
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const fontBase64 = await loadArabicFont();
  if (fontBase64) {
    pdf.addFileToVFS("Cairo-Regular.ttf", fontBase64);
    pdf.addFont("Cairo-Regular.ttf", "Cairo", "normal");
    pdf.setFont("Cairo");
    pdf.setR2L(true);
  } else {
    // بدون خط عربي، نستخدم الخط الافتراضي مع التنبيه
    pdf.setFont("Helvetica");
  }
  return pdf;
};

// الأشهر المحددة
const MONTHS_2025 = [
  "يونيو 2024", "يوليو 2024", "أغسطس 2024",
  "مارس 2025", "ابريل 2025", "مايو 2025",
  "يونيو 2025", "يوليو 2025", "أغسطس 2025",
  "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"
];

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
  const { installments, installments2025 } = useStore() as any;

  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMonth, setPayMonth] = useState<string>("");

  const controls2026 = useTableControls(installments || [], [
    "name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"
  ]);
  const controls2025 = useTableControls(installments2025 || [], BASE_COLS.map(c => c.key));

  // تنظيف الأرقام
  const superCleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let str = String(val);
    str = str.replace(/,/g, "").replace(/\s+/g, "")
             .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "")
             .replace(/[\u060C\u061B\u066B\u066C]/g, "").trim();
    if (str === "" || str === "-" || str === "--") return 0;
    const num = Number(str);
    return isNaN(num) ? 0 : num;
  };

  // الإجماليات
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

  // ========== دوال الاستيراد ==========
  const findHeaderIndex = (rows: any[], keywords: string[]): number => {
    return rows.findIndex(row =>
      row && row.some((cell: any) => {
        const cStr = String(cell || "").toLowerCase().trim();
        return keywords.some(kw => cStr.includes(kw.toLowerCase()));
      })
    );
  };

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
        const headerIndex = findHeaderIndex(rows, ["اسم المتدرب", "متدرب", "الاسم"]);
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على صف العناوين في ملف 2025");
          return;
        }
        const headers = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);
        const cleanJson = dataRows
          .map(row => {
            const obj: any = {};
            headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
            return obj;
          })
          .filter(row => {
            const name = String(row["اسم المتدرب"] || row["الاسم"] || "").trim();
            return name && !name.includes("الإجمالي") && !name.includes("المجموع");
          })
          .map(row => {
            const name = String(row["اسم المتدرب"] || row["الاسم"] || "").trim();
            const payments: any = {};
            MONTHS_2025.forEach(m => { payments[m] = superCleanNumber(row[m]); });
            const totalPaidFromMonths = Object.values(payments).reduce((s: number, v: any) => s + Number(v), 0);
            const fees = superCleanNumber(row["مبلغ الرسوم"] || row["الرسوم"]);
            const totalPaid = superCleanNumber(row["الإجمالي"]) || totalPaidFromMonths;
            const remaining = superCleanNumber(row["المتبقي"]) || (fees - totalPaid);
            return {
              name,
              batch: String(row["رقم الدفعة"] || row["الدفعة"] || "").trim(),
              specialty: String(row["المساق"] || row["التخصص"] || "").trim(),
              fees,
              totalPaid,
              remaining: remaining > 0 ? remaining : 0,
              notes: String(row["ملاحظات"] || "").trim(),
              phone: String(row["رقم الهاتف"] || row["الهاتف"] || "").trim(),
              payments
            };
          });
        useStore.setState({ installments2025: cleanJson });
        toast.success(`✅ تم استيراد ${cleanJson.length} سجل لعام 2025`);
      } catch (error) {
        console.error(error);
        toast.error("فشل استيراد ملف 2025");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

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
        const headerIndex = findHeaderIndex(rows, ["اسم المتدرب", "متدرب", "الاسم"]);
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على صف العناوين في ملف 2026");
          return;
        }
        const headers = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);
        const cleanJson = dataRows
          .map(row => {
            const obj: any = {};
            headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
            return obj;
          })
          .filter(row => {
            const name = String(row["اسم المتدرب"] || row["الاسم"] || "").trim();
            return name && !name.includes("الإجمالي") && !name.includes("المجموع") && !name.includes("كشف تفصيلي");
          })
          .map(row => {
            const name = String(row["اسم المتدرب"] || row["الاسم"] || "").trim();
            const payments: any = {};
            MONTHS_2026_CLEAN.forEach(m => { payments[m] = superCleanNumber(row[m]); });
            const totalPaidFromMonths = Object.values(payments).reduce((s: number, v: any) => s + Number(v), 0);
            const fees = superCleanNumber(row["مبلغ الرسوم"] || row["رسوم الدراسة"] || row["الرسوم"]);
            const prevDue = superCleanNumber(row["المتبقي عليهم من العام 2025"] || row["متبقي 2025"] || row["المتبقي السابق"]);
            const totalPaid = superCleanNumber(row["الإجمالي"] || row["المسدد"]) || totalPaidFromMonths;
            const totalDue = fees + prevDue;
            const remaining = superCleanNumber(row["المتبقي"]) || (totalDue - totalPaid);
            return {
              name,
              batch: String(row["رقم الدفعة"] || row["الدفعة"] || "").trim(),
              specialty: String(row["المساق"] || row["التخصص"] || "").trim(),
              fees,
              prevDue,
              totalPaid,
              remaining: remaining > 0 ? remaining : 0,
              notes: String(row["ملاحظات"] || "").trim(),
              phone: String(row["رقم الهاتف"] || row["الهاتف"] || "").trim(),
              payments
            };
          });
        useStore.setState({ installments: cleanJson });
        toast.success(`✅ تم استيراد ${cleanJson.length} سجل لعام 2026`);
      } catch (error) {
        console.error(error);
        toast.error("فشل استيراد ملف 2026");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ========== إضافة دفعة يدوية ==========
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
        targetMonths.forEach(m => { newTotalPaid += Number(updatedPayments[m]) || 0; });
        let newRemaining;
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
    toast.success(`تم تسجيل قسط بقيمة ${fmt(amountNum)} لشهر ${payMonth}`);
    setPaymentModal(null);
    setPayAmount("");
    setPayMonth("");
  };

  // ========== طباعة كشف فردي ==========
  const printComprehensiveStatement = async (studentName: string) => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const r2026 = (installments || []).find((i: any) => i.name === studentName);
    if (!r2025 && !r2026) {
      toast.error("لا توجد سجلات لهذا الاسم");
      return;
    }
    try {
      const pdf = await createArabicPDF("landscape");
      pdf.setFontSize(18);
      pdf.text("المجلس اليمني للاختصاصات الطبية", 148, 15, { align: "center" });
      pdf.setFontSize(14);
      pdf.text("كشف حساب مالي موحد", 148, 25, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(`اسم الطبيب: ${studentName}`, 280, 35, { align: "right" });
      pdf.text(`التاريخ: ${today()}`, 20, 35, { align: "left" });

      let y = 45;
      if (r2025) {
        pdf.setFontSize(11);
        pdf.text("■ بيان 2025", 280, y, { align: "right" });
        autoTable(pdf, {
          head: [["الدفعة", "المساق", "الرسوم", "المسدد", "المتبقي", "الهاتف", "ملاحظات"]],
          body: [[r2025.batch, r2025.specialty, fmt(r2025.fees), fmt(r2025.totalPaid), fmt(r2025.remaining), r2025.phone || "—", r2025.notes || "—"]],
          startY: y + 5,
          styles: { font: "Cairo", halign: "right", fontSize: 9 },
          headStyles: { fillColor: [13, 148, 136] }
        });
        y = (pdf as any).lastAutoTable.finalY + 10;
      }
      if (r2026) {
        pdf.setFontSize(11);
        pdf.text("■ بيان 2026", 280, y, { align: "right" });
        autoTable(pdf, {
          head: [["الدفعة", "المساق", "الرسوم", "متبقي 2025", "المسدد", "المتبقي", "الهاتف", "ملاحظات"]],
          body: [[r2026.batch, r2026.specialty, fmt(r2026.fees), fmt(r2026.prevDue||0), fmt(r2026.totalPaid), fmt(r2026.remaining), r2026.phone||"—", r2026.notes||"—"]],
          startY: y + 5,
          styles: { font: "Cairo", halign: "right", fontSize: 9 },
          headStyles: { fillColor: [30, 41, 59] }
        });
      }
      pdf.save(`كشف_حساب_${studentName}.pdf`);
      toast.success("تم استخراج الكشف");
    } catch (error) {
      toast.error("فشل إنشاء PDF");
    }
  };

  // ========== تصدير كشف عام ==========
  const printFullYearStatement = async (year: 2025 | 2026) => {
    const data = year === 2025 ? (installments2025 || []) : (installments || []);
    if (data.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    try {
      const pdf = await createArabicPDF("landscape");
      pdf.setFontSize(16);
      pdf.text(`المجلس اليمني - كشف عام ${year}`, 148, 15, { align: "center" });
      const headers = year === 2025
        ? [["الاسم", "الدفعة", "المساق", "الرسوم", "المسدد", "المتبقي", "الهاتف", "ملاحظات"]]
        : [["الاسم", "الدفعة", "المساق", "الرسوم", "متبقي 2025", "المسدد", "المتبقي", "الهاتف", "ملاحظات"]];
      const body = data.map((row: any) =>
        year === 2025
          ? [row.name, row.batch, row.specialty, fmt(row.fees), fmt(row.totalPaid), fmt(row.remaining), row.phone||"—", row.notes||"—"]
          : [row.name, row.batch, row.specialty, fmt(row.fees), fmt(row.prevDue||0), fmt(row.totalPaid), fmt(row.remaining), row.phone||"—", row.notes||"—"]
      );
      autoTable(pdf, {
        head: headers,
        body,
        startY: 25,
        styles: { font: "Cairo", halign: "right", fontSize: 8 },
        headStyles: { fillColor: year === 2025 ? [13, 148, 136] : [30, 41, 59] }
      });
      pdf.save(`كشف_عام_${year}.pdf`);
      toast.success("تم التصدير");
    } catch (error) {
      toast.error("فشل تصدير الكشف");
    }
  };

  // ========== واجهة المستخدم ==========
  return (
    <div className="space-y-8" dir="rtl">
      {/* قسم 2025 */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2025م</h2>
            <p className="text-xxs text-slate-500">الأرشيف المستورد والمعدّل لعام 2025</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printFullYearStatement(2025)} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold">📄 تصدير 2025</button>
            <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer">
              📥 استيراد 2025
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport2025} className="hidden" />
            </label>
          </div>
        </div>
        {/* جدول 2025 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="p-2 w-10">م</th>
                {BASE_COLS.map(c => (
                  <th key={c.key} className="p-2 text-right cursor-pointer" onClick={() => controls2025.toggleSort(c.key)}>
                    {c.label} {sortIndicator(controls2025.sortKey === c.key, controls2025.sortDir)}
                  </th>
                ))}
                <th className="p-2 w-48">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50">
                  <td className="p-2 text-center">{i + 1}</td>
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-emerald-600">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600">{fmt(r.remaining)}</td>
                  <td className="p-2 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="p-2 font-mono">{r.phone || "—"}</td>
                  <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setPaymentModal({ row: r, year: 2025 })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold hover:bg-emerald-600 hover:text-white">💵 دفعة</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2025 })} className="text-blue-600 hover:underline font-bold px-1">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* قسم 2026 */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2026م</h2>
            <p className="text-xxs text-slate-500">الربط مع متبقيات 2025 وعمليات الدفع</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printFullYearStatement(2026)} className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-bold">📄 تصدير 2026</button>
            <label className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer">
              📥 استيراد 2026
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport2026} className="hidden" />
            </label>
          </div>
        </div>
        {/* جدول 2026 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="p-2 w-10">م</th>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-center">الدفعة</th>
                <th className="p-2">المساق</th>
                <th className="p-2 text-right">رسوم الدراسة</th>
                <th className="p-2 text-right">متبقي 2025</th>
                <th className="p-2 text-right">المسدد 2026</th>
                <th className="p-2 text-right">المتبقي الحالي</th>
                <th className="p-2">ملاحظات</th>
                <th className="p-2 w-48">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50">
                  <td className="p-2 text-center">{i + 1}</td>
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-amber-600">{fmt(r.prevDue || 0)}</td>
                  <td className="p-2 font-mono text-emerald-600">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600">{fmt(r.remaining)}</td>
                  <td className="p-2 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setPaymentModal({ row: r, year: 2026 })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold hover:bg-emerald-600 hover:text-white">💵 دفعة</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2026 })} className="text-blue-600 hover:underline font-bold px-1">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال الدفع اليدوي */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-md w-full text-right">
            <h3 className="text-md font-bold border-b pb-2 mb-4">➕ تسجيل دفعة لعام {paymentModal.year}</h3>
            <p className="text-xs mb-4">المتدرب: <span className="font-bold">{paymentModal.row.name}</span></p>
            <form onSubmit={handleAddManualPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">المبلغ</label>
                <input type="number" required placeholder="مثال: 30000" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 text-left font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">الشهر</label>
                <select required value={payMonth} onChange={e => setPayMonth(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50">
                  <option value="">-- اختر الشهر --</option>
                  {(paymentModal.year === 2025 ? MONTHS_2025 : MONTHS_2026_CLEAN).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => { setPaymentModal(null); setPayAmount(""); setPayMonth(""); }} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال التعديل */}
      {editingRow && (() => {
        const is2025 = editingRow.year === 2025;
        const fields: EditField[] = [
          { key: "name", label: "الاسم", colSpan: 2 },
          { key: "batch", label: "الدفعة" },
          { key: "specialty", label: "المساق" },
          { key: "fees", label: "مبلغ الرسوم", type: "number" },
          ...(!is2025 ? [{ key: "prevDue", label: "متبقي 2025", type: "number" as const }] : []),
          { key: "totalPaid", label: "الإجمالي المسدد", type: "number" },
          { key: "remaining", label: "المتبقي", type: "number" },
          { key: "phone", label: "رقم الهاتف" },
          { key: "notes", label: "ملاحظات", colSpan: 3 },
        ];
        return (
          <EditModal
            title={`تعديل قيد ${editingRow.year} - ${editingRow.row.name}`}
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
              toast.success("تم التحديث");
              setEditingRow(null);
            }}
          />
        );
      })()}
    </div>
  );
                                    }
