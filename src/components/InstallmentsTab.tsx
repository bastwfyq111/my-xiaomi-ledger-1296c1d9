import React, { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// الأشهر التاريخية المستخرجة من ملف إكسل 2025
const MONTHS_2025 = [
  "يونيو 2024", "يوليو 2024", "أغسطس 2024", 
  "مارس 2025", "ابريل 2025", "مايو 2025", 
  "يونيو 2025", "يوليو 2025", "أغسطس 2025", 
  "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"
];

// الأعمدة الأساسية المشتركة بين الجدولين
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
    installments,       // أقساط 2026
    installments2025,   // أقساط 2025 
    updateInstallment, 
    updateInstallment2025 
  } = useStore() as any;

  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);

  // إعداد أدوات التحكم والتصفية والترتيب للجداول
  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"]);
  const controls2025 = useTableControls(installments2025 || [], BASE_COLS.map(c => c.key));

  // حساب الإجماليات المالية لعام 2025
  const totals2025 = useMemo(() => {
    const list = controls2025.rows || [];
    return {
      fees: list.reduce((s, r) => s + (Number(r.fees) || 0), 0),
      paid: list.reduce((s, r) => s + (Number(r.totalPaid) || 0), 0),
      remaining: list.reduce((s, r) => s + (Number(r.remaining) || 0), 0),
    };
  }, [controls2025.rows]);

  // حساب الإجماليات المالية لعام 2026
  const totals2026 = useMemo(() => {
    const list = controls2026.rows || [];
    return {
      fees: list.reduce((s, r) => s + (Number(r.fees) || 0), 0),
      prevDue: list.reduce((s, r) => s + (Number(r.prevDue) || 0), 0),
      paid: list.reduce((s, r) => s + (Number(r.totalPaid) || 0), 0),
      remaining: list.reduce((s, r) => s + (Number(r.remaining) || 0), 0),
    };
  }, [controls2026.rows]);

  // دالة استيراد ملف إكسل لعام 2025
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

        const cleanJson = json
          .filter(row => row["اسم المتدرب"] && row["اسم المتدرب"] !== "الإجمالي")
          .map(row => {
            let calculatedPaid = Number(row["الإجمالي"]) || 0;
            if (!calculatedPaid) {
              MONTHS_2025.forEach(m => { calculatedPaid += Number(row[m]) || 0; });
            }
            return {
              name: row["اسم المتدرب"] || row["name"],
              batch: row["رقم الدفعة"] || row["batch"],
              specialty: row["المساق"] || row["specialty"],
              fees: Number(row["مبلغ الرسوم"]) || Number(row["fees"]) || 0,
              totalPaid: calculatedPaid,
              remaining: Number(row["المتبقي"]) || Number(row["remaining"]) || 0,
              notes: row["ملاحظات"] || row["notes"] || "",
              phone: row["رقم الهاتف"] || row["phone"] || "",
              payments: MONTHS_2025.reduce((acc, m) => ({ ...acc, [m]: Number(row[m]) || 0 }), {})
            };
          });

        useStore.setState({ installments2025: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2025م`);
      } catch (error) {
        toast.error("حدث خطأ في قراءة ملف 2025");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // دالة استيراد ملف إكسل لعام 2026
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

        const cleanJson = json
          .filter(row => row["الاسم"] || row["اسم المتدرب"])
          .filter(row => row["الاسم"] !== "الإجمالي" && row["اسم المتدرب"] !== "الإجمالي")
          .map(row => {
            return {
              name: row["الاسم"] || row["اسم المتدرب"] || row["name"],
              batch: row["الدفعة"] || row["رقم الدفعة"] || row["batch"],
              specialty: row["المساق"] || row["specialty"],
              fees: Number(row["رسوم الدراسة"]) || Number(row["مبلغ الرسوم"]) || Number(row["fees"]) || 0,
              prevDue: Number(row["متبقي 2025"]) || Number(row["prevDue"]) || 0,
              totalPaid: Number(row["المسدد"]) || Number(row["الإجمالي"]) || Number(row["totalPaid"]) || 0,
              remaining: Number(row["المتبقي"]) || Number(row["remaining"]) || 0,
              notes: row["ملاحظات"] || row["notes"] || "",
              phone: row["رقم الهاتف"] || row["phone"] || "",
              payments: INSTALLMENT_MONTHS.reduce((acc, m) => ({ ...acc, [m]: Number(row[m]) || 0 }), {})
            };
          });

        useStore.setState({ installments: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2026م`);
      } catch (error) {
        toast.error("حدث خطأ في قراءة ملف 2026");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // دالة طباعة كشف حساب موحد وتفصيلي للعامين معاً
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

    // جدول تفاصيل عام 2025م
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

    // جدول تفاصيل عام 2026م
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
    toast.success("تم استخراج وتحميل التقرير بنجاح");
  };

  return (
    <div className="space-y-8" dir="rtl">
      
      {/* ================== أولاً: قِسم عام 2025م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2025م</h2>
            <p className="text-xxs text-slate-500">عرض الأرشيف والبيانات المستوردة لعام 2025 (بدون عمود متبقي 2025)</p>
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
                <th className="p-2 text-center w-32">الإجراءات</th>
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
                  <td className="p-2 text-center whitespace-nowrap">
                    <button onClick={() => setEditingRow({ row: r, year: 2025 })} className="text-blue-600 hover:underline font-bold ml-2">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-2 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== ثانياً: قِسم عام 2026م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2026م (العام الحالي)</h2>
            <p className="text-xxs text-slate-500">يحتوي هذا الكشف على عمود الربط والمطابقة "متبقي 2025"</p>
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
                <th className="p-2 text-center w-32">الإجراءات</th>
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
                  <td className="p-2 text-center whitespace-nowrap">
                    <button onClick={() => setEditingRow({ row: r, year: 2026 })} className="text-blue-600 hover:underline font-bold ml-2">تعديل</button>
                    <button onClick={() => printComprehensiveStatement(r.name)} className="px-2 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== ثالثاً: مودال التعديل الفوري الفعّال ================== */}
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
            title={`تعديل القيد المالي لعام ${editingRow.year} — الطبيب: ${editingRow.row.name}`}
            fields={fields}
            values={editingRow.row}
            onClose={() => setEditingRow(null)}
            onSave={(updated) => {
              const cleaned = { ...updated };
              ["fees", "prevDue", "totalPaid", "remaining"].forEach(k => {
                if (cleaned[k] !== undefined) cleaned[k] = Number(cleaned[k]) || 0;
              });

              if (is2025) {
                const list = (installments2025 || []).map((item: any) => item.name === editingRow.row.name ? cleaned : item);
                useStore.setState({ installments2025: list });
              } else {
                const list = (installments || []).map((item: any) => item.name === editingRow.row.name ? cleaned : item);
                useStore.setState({ installments: list });
              }
              toast.success("تم الحفظ وتحديث البيانات اللحظية بنجاح");
              setEditingRow(null);
            }}
          />
        );
      })()}
    </div>
  );
}
