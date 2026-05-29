import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls } from "@/hooks/useTableControls";

// ========== إضافة الخط العربي ==========
const ARABIC_FONT_URL = '/fonts/Cairo-Regular.ttf'; 

let arabicFontLoaded = false;
let arabicFontBase64: string | null = null;

const loadArabicFont = async () => {
  if (arabicFontLoaded && arabicFontBase64) return arabicFontBase64;
  
  try {
    const response = await fetch(ARABIC_FONT_URL);
    const blob = await response.blob();
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        arabicFontBase64 = (reader.result as string).split(',')[1];
        arabicFontLoaded = true;
        resolve(arabicFontBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('فشل تحميل الخط العربي:', error);
    return null;
  }
};

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

  // إعداد عناصر التحكم بالجداول عبر الـ Hook المخصص
  const controls2026 = useTableControls(installments || [], [
    "name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"
  ]);
  const controls2025 = useTableControls(installments2025 || [], BASE_COLS.map(c => c.key));

  // دالة تطهير الأرقام
  const superCleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    
    let str = String(val);
    str = str.replace(/,/g, "")
             .replace(/\s+/g, "")
             .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "")
             .replace(/[\u060C\u061B\u066B\u066C]/g, "")
             .trim();
    
    if (str === "" || str === "-" || str === "--") return 0;
    
    const num = Number(str);
    return isNaN(num) ? 0 : num;
  };

  // دالة إنشاء PDF بدعم عربي
  const createArabicPDF = async (orientation: "portrait" | "landscape" = "landscape") => {
    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: "a4"
    });

    const fontBase64 = await loadArabicFont();
    
    if (fontBase64) {
      pdf.addFileToVFS("Cairo-Regular.ttf", fontBase64);
      pdf.addFont("Cairo-Regular.ttf", "Cairo", "normal");
      pdf.setFont("Cairo");
      pdf.setR2L(true); 
    } else {
      console.warn("لم يتم تحميل الخط العربي، قد لا تظهر النصوص العربية بشكل صحيح");
      pdf.setFont("Helvetica");
    }

    return pdf;
  };

  // احتساب الإجماليات مع حماية ضد القيمة الفارغة (Fallback to empty array)
  const totals2025 = useMemo(() => {
    const list = controls2025?.rows || controls2025 || [];
    return {
      fees: list.reduce((s: number, r: any) => s + superCleanNumber(r.fees), 0),
      paid: list.reduce((s: number, r: any) => s + superCleanNumber(r.totalPaid), 0),
      remaining: list.reduce((s: number, r: any) => s + superCleanNumber(r.remaining), 0),
    };
  }, [controls2025]);

  const totals2026 = useMemo(() => {
    const list = controls2026?.rows || controls2026 || [];
    return {
      fees: list.reduce((s: number, r: any) => s + superCleanNumber(r.fees), 0),
      prevDue: list.reduce((s: number, r: any) => s + superCleanNumber(r.prevDue), 0),
      paid: list.reduce((s: number, r: any) => s + superCleanNumber(r.totalPaid), 0),
      remaining: list.reduce((s: number, r: any) => s + superCleanNumber(r.remaining), 0),
    };
  }, [controls2026]);

  // دالتان مضافتان لمنع خطأ عدم التعريف أثناء الاستيراد
  const handleImport2025 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("جاري معالجة ملف استيراد 2025...");
    // يمكنك هنا كتابة منطق مكتبة XLSX لقراءة الملف وتحديث الستور
  };

  const handleImport2026 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("جاري معالجة ملف استيراد 2026...");
    // يمكنك هنا كتابة منطق مكتبة XLSX لقراءة الملف وتحديث الستور
  };

  // طباعة كشف الحساب الموحد للطبيب
  const printComprehensiveStatement = async (studentName: string) => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const r2026 = (installments || []).find((i: any) => i.name === studentName);

    if (!r2025 && !r2026) {
      toast.error("لا توجد سجلات مالية متوفرة لهذا الاسم");
      return;
    }

    try {
      const pdf = await createArabicPDF("landscape");
      
      pdf.setFontSize(18);
      pdf.text("المجلس اليمني للاختصاصات الطبية", 148, 15, { align: "center" });
      
      pdf.setFontSize(14);
      pdf.text("كشف حساب مالي موحد", 148, 25, { align: "center" });
      
      pdf.setLineWidth(0.5);
      pdf.line(20, 30, 280, 30);
      
      pdf.setFontSize(12);
      pdf.text(`اسم الطبيب المتدرب: ${studentName}`, 280, 38, { align: "right" });
      pdf.text(`تاريخ الاستخراج: ${today()}`, 20, 38, { align: "left" });

      let currentY = 45;

      if (r2025) {
        pdf.setFontSize(11);
        pdf.text("■ بيان الأقساط والرسوم لعام 2025م:", 280, currentY, { align: "right" });
        currentY += 5;
        
        const head2025 = [
          "الدفعة", "المساق", "مبلغ الرسوم", "الإجمالي المسدد", 
          "المتبقي", "رقم الهاتف", "ملاحظات"
        ];
        
        const body2025 = [[
          r2025.batch || "—",
          r2025.specialty || "—",
          fmt(r2025.fees),
          fmt(r2025.totalPaid),
          fmt(r2025.remaining),
          r2025.phone || "—",
          r2025.notes || "—"
        ]];

        autoTable(pdf, {
          head: [head2025],
          body: body2025,
          startY: currentY,
          styles: { 
            font: "Cairo",
            halign: "right", 
            fontSize: 9,
            cellPadding: 3,
            lineColor: [44, 62, 80],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [13, 148, 136],
            textColor: 255,
            fontStyle: "bold",
            halign: "center"
          },
          bodyStyles: { textColor: 50 },
          tableWidth: "auto",
          margin: { left: 10, right: 10 }
        });
        
        currentY = (pdf as any).lastAutoTable.finalY + 10;
      }

      if (r2026) {
        if (r2025) {
          pdf.setLineWidth(0.3);
          pdf.setDrawColor(200);
          pdf.line(20, currentY - 5, 280, currentY - 5);
        }
        
        pdf.setFontSize(11);
        pdf.text("■ بيان الأقساط والرسوم لعام 2026م:", 280, currentY, { align: "right" });
        currentY += 5;
        
        const head2026 = [
          "الدفعة", "المساق", "رسوم الدراسة", "متبقي 2025", 
          "المسدد 2026", "المتبقي الحالي", "رقم الهاتف", "ملاحظات"
        ];
        
        const body2026 = [[
          r2026.batch || "—",
          r2026.specialty || "—",
          fmt(r2026.fees),
          fmt(r2026.prevDue || 0),
          fmt(r2026.totalPaid),
          fmt(r2026.remaining),
          r2026.phone || "—",
          r2026.notes || "—"
        ]];

        autoTable(pdf, {
          head: [head2026],
          body: body2026,
          startY: currentY,
          styles: { 
            font: "Cairo",
            halign: "right", 
            fontSize: 9,
            cellPadding: 3,
            lineColor: [44, 62, 80],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: "bold",
            halign: "center"
          },
          bodyStyles: { textColor: 50 },
          tableWidth: "auto",
          margin: { left: 10, right: 10 }
        });
        
        currentY = (pdf as any).lastAutoTable.finalY + 15;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(128);
      pdf.text("تم إنشاء هذا التقرير بواسطة النظام المالي - المجلس اليمني للاختصاصات الطبية", 148, currentY, { align: "center" });
      
      const fileName = `كشف_حساب_${studentName.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
      toast.success("✅ تم استخراج التقرير بنجاح");
      
    } catch (error) {
      console.error("خطأ في إنشاء PDF:", error);
      toast.error("❌ حدث خطأ أثناء إنشاء ملف PDF");
    }
  };

  // تصدير كشف كامل لعام معين
  const printFullYearStatement = async (year: 2025 | 2026) => {
    const data = year === 2025 ? (installments2025 || []) : (installments || []);
    
    if (!data || data.length === 0) {
      toast.error(`لا توجد بيانات لعام ${year}`);
      return;
    }

    try {
      const pdf = await createArabicPDF("landscape");
      
      pdf.setFontSize(18);
      pdf.text(`المجلس اليمني للاختصاصات الطبية`, 148, 15, { align: "center" });
      pdf.setFontSize(14);
      pdf.text(`كشف الأقساط والرسوم لعام ${year}م`, 148, 25, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.text(`تاريخ الاستخراج: ${today()}`, 20, 35, { align: "left" });
      pdf.text(`إجمالي السجلات: ${data.length}`, 280, 35, { align: "right" });

      const headers = year === 2025 
        ? [["الاسم", "الدفعة", "المساق", "الرسوم", "المسدد", "المتبقي", "الهاتف", "ملاحظات"]]
        : [["الاسم", "الدفعة", "المساق", "الرسوم", "متبقي 2025", "المسدد", "المتبقي", "الهاتف", "ملاحظات"]];

      const body = data.map((row: any) => 
        year === 2025
          ? [
              row.name, row.batch, row.specialty, 
              fmt(row.fees), fmt(row.totalPaid), fmt(row.remaining),
              row.phone || "—", row.notes || "—"
            ]
          : [
              row.name, row.batch, row.specialty,
              fmt(row.fees), fmt(row.prevDue || 0), 
              fmt(row.totalPaid), fmt(row.remaining),
              row.phone || "—", row.notes || "—"
            ]
      );

      autoTable(pdf, {
        head: headers,
        body: body,
        startY: 40,
        styles: { 
          font: "Cairo",
          halign: "right", 
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: { 
          fillColor: year === 2025 ? [13, 148, 136] : [30, 41, 59],
          textColor: 255,
          fontStyle: "bold",
          halign: "center"
        },
        tableWidth: "auto",
        margin: { left: 5, right: 5 }
      });

      pdf.save(`كشف_عام_${year}.pdf`);
      toast.success(`✅ تم تصدير كشف عام ${year} بنجاح`);
      
    } catch (error) {
      console.error("خطأ في التصدير:", error);
      toast.error("❌ فشل تصدير الكشف");
    }
  };

  // إضافة قسط يدوي لشهر محدد
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

  return (
    <div className="space-y-8" dir="rtl">
      
      {/* ================== عام 2025م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2025م</h2>
            <p className="text-xs text-slate-500">الأرشيف المستورد والمعدّل لعام 2025</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => printFullYearStatement(2025)}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 shadow-sm transition"
            >
              📄 تصدير كامل 2025
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 shadow-sm transition">
              <span>📥 استيراد 2025</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport2025} className="hidden" />
            </label>
          </div>
        </div>
        {/* سيتم رندرة جدول 2025 هنا بناءً على الـ controls2025 الخاص بك */}
      </div>

      {/* ================== عام 2026م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2026م (العام الحالي)</h2>
            <p className="text-xs text-slate-500">يتضمن الربط المباشر مع متبقيات 2025 وعمليات الدفع المباشرة</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => printFullYearStatement(2026)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-bold hover:bg-slate-700 shadow-sm transition"
            >
              📄 تصدير كامل 2026
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-800 shadow-sm transition">
              <span>📥 استيراد 2026</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport2026} className="hidden" />
            </label>
          </div>
        </div>
        {/* سيتم رندرة جدول 2026 هنا بناءً على الـ controls2026 الخاص بك */}
      </div>

    </div>
  );
}
