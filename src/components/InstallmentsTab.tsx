import React, { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS, type Installment } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// 1. تعريف الأعمدة الموحدة للنظام
const COLS_CONFIG = [
  { key: "name", label: "الاسم" },
  { key: "batch", label: "الدفعة" },
  { key: "specialty", label: "المساق" },
  { key: "fees", label: "رسوم الدراسة" },
  { key: "prevDue", label: "متبقي 2025" }, // سيتم إخفاؤه برمجياً في جدول 2025
  { key: "totalPaid", label: "المسدد" },
  { key: "remaining", label: "المتبقي" },
  { key: "notes", label: "ملاحظات" },
];

export default function InstallmentsTab() {
  // استدعاء البيانات والدوال من مخزن Zustand
  const { 
    installments, // مصفوفة أقساط 2026
    installments2025, // مصفوفة أقساط 2025
    importInstallments2025,
    updateInstallment,
    updateInstallment2025 
  } = useStore() as any;

  // حالات التحكم في النوافذ المنبثقة (التعديل)
  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);

  // 2. ربط جلب أدوات التحكم والتصفية والفرع للجداول
  const controls2026 = useTableControls(installments || [], COLS_CONFIG.map(c => c.key));
  // لجدول 2025 نقوم باستثناء عمود "prevDue" من مصفوفة المفاتيح
  const cols2025Keys = COLS_CONFIG.filter(c => c.key !== "prevDue").map(c => c.key);
  const controls2025 = useTableControls(installments2025 || [], cols2025Keys);

  // 3. معالجة وحساب الإجماليات المالية للعامين
  const totals2026 = useMemo(() => ({
    paid: controls2026.rows.reduce((s, r) => s + (r.totalPaid || 0), 0),
    remaining: controls2026.rows.reduce((s, r) => s + (r.remaining || 0), 0),
  }), [controls2026.rows]);

  const totals2025 = useMemo(() => ({
    paid: controls2025.rows.reduce((s, r) => s + (r.totalPaid || 0), 0),
    remaining: controls2025.rows.reduce((s, r) => s + (r.remaining || 0), 0),
  }), [controls2025.rows]);

  // 4. دالة معالجة استيراد ملف إكسل لعام 2025
  const handleImport2025 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];
        importInstallments2025(json);
        toast.success("تم استيراد بيانات أقساط عام 2025 بنجاح");
      } catch (error) {
        toast.error("حدث خطأ أثناء تحليل ملف إكسل 2025");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // 5. دالة معالجة استيراد ملف إكسل لعام 2026
  const handleImport2026 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];
        // نقوم بحقن البيانات في مصفوفة 2026 المباشرة
        useStore.setState({ installments: json });
        toast.success("تم استيراد بيانات أقساط عام 2026 بنجاح");
      } catch (error) {
        toast.error("حدث خطأ أثناء تحليل ملف إكسل 2026");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // 6. دالة إنشاء وطباعة كشف الحساب الموحد والشامل (PDF) للعامين معاً
  const printComprehensiveStatement = (studentName: string) => {
    // تصفية جلب السجلات الخاصة بالمتدرب من مصفوفات العامين
    const record2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const record2026 = (installments || []).find((i: any) => i.name === studentName);

    if (!record2025 && !record2026) {
      toast.error("لم يتم العثور على أي بيانات مسجلة لهذا المتدرب في كلا العامين");
      return;
    }

    const pdf = new jsPDF({ orientation: "landscape" });
    
    // إعداد العناوين الرئيسية للكشف باللغة العربية
    pdf.setFontSize(18);
    pdf.text(`كشف الحساب المالي الموحد للمتدرب`, 148, 15, { align: "center" });
    pdf.setFontSize(14);
    pdf.text(`اسم المتدرب: ${studentName}`, 280, 25, { align: "right" });
    pdf.setFontSize(10);
    pdf.text(`تاريخ استخراج الكشف: ${today()}`, 15, 25, { align: "left" });

    let currentY = 32;

    // أولاً: بناء جدول عام 2025 إذا توفرت بياناته
    if (record2025) {
      pdf.setFontSize(12);
      pdf.text(`■ بيان أقساط وحسابات عام 2025م:`, 280, currentY, { align: "right" });
      
      const headers2025 = COLS_CONFIG.filter(c => c.key !== "prevDue").map(c => c.label);
      const body2025 = [
        COLS_CONFIG.filter(c => c.key !== "prevDue").map(c => {
          const val = record2025[c.key];
          return typeof val === "number" && c.key !== "batch" ? fmt(val) : (val || "—");
        })
      ];

      autoTable(pdf, {
        head: [headers2025],
        body: body2025,
        startY: currentY + 3,
        styles: { halign: "right", fontSize: 10 },
        headStyles: { fillCountry: [13, 148, 136] } // لون تيل متناسق لـ 2025
      });
      currentY = (pdf as any).lastAutoTable.finalY + 12;
    }

    // ثانياً: بناء جدول عام 2026 إذا توفرت بياناته
    if (record2026) {
      pdf.setFontSize(12);
      pdf.text(`■ بيان أقساط وحسابات عام 2026م:`, 280, currentY, { align: "right" });

      const headers2026 = COLS_CONFIG.map(c => c.label);
      const body2026 = [
        COLS_CONFIG.map(c => {
          const val = record2026[c.key];
          return typeof val === "number" && c.key !== "batch" ? fmt(val) : (val || "—");
        })
      ];

      autoTable(pdf, {
        head: [headers2026],
        body: body2026,
        startY: currentY + 3,
        styles: { halign: "right", fontSize: 10 },
        headStyles: { fillCountry: [30, 41, 59] } // لون كحلي غامق متناسق لـ 2026
      });
    }

    // حفظ وتنزيل الملف بصيغة PDF
    pdf.save(`كشف_حساب_موحد_${studentName}.pdf`);
    toast.success(`تم استخراج كشف الحساب الموحد للأخ/ة ${studentName}`);
  };

  return (
    <div className="space-y-8" dir="rtl">
      
      {/* ==================== أولاً: قِسم عام 2025م ==================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 text-right bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">سجلات وأقساط عام 2025م</h2>
            <p className="text-xxs text-slate-500">إدارة الأرشيف المالي القديم واستيراد كشوفات الطلاب لسنة 2025</p>
          </div>
          
          {/* زر استيراد مخصص لملف 2025 */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer hover:bg-emerald-700 transition">
            <span>استيراد إكسل 2025 (Excel)</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleImport2025} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 max-w-md">
          <div className="bg-slate-50 p-2.5 border rounded-lg">
            <span className="text-xxs text-slate-500 block">إجمالي مسدد 2025</span>
            <span className="text-sm font-mono font-bold text-emerald-700">{fmt(totals2025.paid)}</span>
          </div>
          <div className="bg-rose-50 p-2.5 border border-rose-100 rounded-lg">
            <span className="text-xxs text-rose-600 block">إجمالي متبقي 2025</span>
            <span className="text-sm font-mono font-bold text-rose-700">{fmt(totals2025.remaining)}</span>
          </div>
        </div>

        {/* جدول عرض بيانات 2025 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="px-2 py-2 text-center w-10">م</th>
                {COLS_CONFIG.filter(c => c.key !== "prevDue").map(c => (
                  <th key={c.key} className="px-2 py-2 text-right cursor-pointer" onClick={() => controls2025.toggleSort(c.key)}>
                    {c.label} {sortIndicator(controls2025.sortKey === c.key, controls2025.sortDir)}
                  </th>
                ))}
                <th className="px-2 py-2 text-center w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r, idx) => (
                <tr key={r.name + idx} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-2 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2">{r.batch}</td>
                  <td className="px-2 py-2">{r.specialty}</td>
                  <td className="px-2 py-2 font-mono">{fmt(r.fees)}</td>
                  <td className="px-2 py-2 font-mono text-emerald-600 font-medium">{fmt(r.totalPaid)}</td>
                  <td className="px-2 py-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="px-2 py-2 text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="px-2 py-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setEditingRow({ row: r, year: 2025 })} className="text-blue-600 hover:underline font-bold ml-2">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-2 py-0.5 border rounded bg-slate-50 hover:bg-teal-700 hover:text-white transition-all">كشف موحد</button>
                  </td>
                </tr>
              ))}
              {controls2025.rows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-6 text-slate-400">لا توجد بيانات لعام 2025، قم بالاستيراد الآن.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* ==================== ثانياً: قِسم عام 2026م ==================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 text-right bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">سجلات وأقساط عام 2026م (العام الحالي)</h2>
            <p className="text-xxs text-slate-500">إدارة القيود المالية الحالية مع عمود ربط متبقيات السنة السابقة</p>
          </div>
          
          {/* زر استيراد مخصص لملف 2026 */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer hover:bg-slate-800 transition">
            <span>استيراد إكسل 2026 (Excel)</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleImport2026} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 max-w-md">
          <div className="bg-slate-50 p-2.5 border rounded-lg">
            <span className="text-xxs text-slate-500 block">إجمالي مسدد 2026</span>
            <span className="text-sm font-mono font-bold text-emerald-700">{fmt(totals2026.paid)}</span>
          </div>
          <div className="bg-rose-50 p-2.5 border border-rose-100 rounded-lg">
            <span className="text-xxs text-rose-600 block">إجمالي متبقي للعام الحالي</span>
            <span className="text-sm font-mono font-bold text-rose-700">{fmt(totals2026.remaining)}</span>
          </div>
        </div>

        {/* جدول عرض بيانات 2026 البنية الكاملة مع المتبقي السابق */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="px-2 py-2 text-center w-10">م</th>
                {COLS_CONFIG.map(c => (
                  <th key={c.key} className="px-2 py-2 text-right cursor-pointer" onClick={() => controls2026.toggleSort(c.key)}>
                    {c.label} {sortIndicator(controls2026.sortKey === c.key, controls2026.sortDir)}
                  </th>
                ))}
                <th className="px-2 py-2 text-center w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r, idx) => (
                <tr key={r.name + idx} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-2 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-2 py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2">{r.batch}</td>
                  <td className="px-2 py-2">{r.specialty}</td>
                  <td className="px-2 py-2 font-mono">{fmt(r.fees)}</td>
                  <td className="px-2 py-2 font-mono text-amber-600 font-medium">{fmt(r.prevDue || 0)}</td>
                  <td className="px-2 py-2 font-mono text-emerald-600 font-medium">{fmt(r.totalPaid)}</td>
                  <td className="px-2 py-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="px-2 py-2 text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="px-2 py-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setEditingRow({ row: r, year: 2026 })} className="text-blue-600 hover:underline font-bold ml-2">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-2 py-0.5 border rounded bg-slate-50 hover:bg-teal-700 hover:text-white transition-all">كشف موحد</button>
                  </td>
                </tr>
              ))}
              {controls2026.rows.length === 0 && (
                <tr><td colSpan={10} className="text-center py-6 text-slate-400">لا توجد بيانات لعام 2026، قم بالاستيراد الآن.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== ثالثاً: مودال التعديل الديناميكي ==================== */}
      {editingRow && (() => {
        const is2025 = editingRow.year === 2025;
        // تصفية الأعمدة حسب السنة المحددة للتعديل
        const targetCols = is2025 ? COLS_CONFIG.filter(c => c.key !== "prevDue") : COLS_CONFIG;

        const fields: EditField[] = targetCols.map(c => {
          const isNum = c.key === "fees" || c.key === "prevDue" || c.key === "totalPaid" || c.key === "remaining";
          return {
            key: c.key,
            label: c.label,
            type: isNum ? "number" : "text",
            colSpan: c.key === "name" || c.key === "notes" ? 2 : 1
          };
        });

        return (
          <EditModal 
            title={`تعديل سجل عام ${editingRow.year} — للمتدرب: ${editingRow.row.name}`}
            fields={fields}
            values={editingRow.row}
            onClose={() => setEditingRow(null)}
            onSave={(updatedData) => {
              // تطهير البيانات الرقمية وتحويلها
              const sanitized = { ...updatedData };
              targetCols.forEach(c => {
                if (typeof sanitized[c.key] !== "undefined" && c.key !== "name" && c.key !== "notes" && c.key !== "batch" && c.key !== "specialty") {
                  sanitized[c.key] = Number(sanitized[c.key]) || 0;
                }
              });

              // حفظ التعديل بناءً على مستودع السنة المستهدفة
              if (is2025) {
                if (typeof updateInstallment2025 === "function") {
                  updateInstallment2025(editingRow.row.name, sanitized);
                } else {
                  // حل فوري لتحديث مصفوفة الـ Store
                  const updatedList = (installments2025 || []).map((item: any) => item.name === editingRow.row.name ? sanitized : item);
                  useStore.setState({ installments2025: updatedList });
                }
              } else {
                if (typeof updateInstallment === "function") {
                  updateInstallment(editingRow.row.name, sanitized);
                } else {
                  const updatedList = (installments || []).map((item: any) => item.name === editingRow.row.name ? sanitized : item);
                  useStore.setState({ installments: updatedList });
                }
              }

              toast.success(`تم تحديث بيانات سجل ${editingRow.year} بنجاح`);
              setEditingRow(null);
            }}
          />
        );
      })()}

    </div>
  );
}
