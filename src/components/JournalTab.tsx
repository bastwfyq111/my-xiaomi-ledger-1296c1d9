import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { BookOpenText, Upload, TrendingUp, TrendingDown, FileSpreadsheet, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// دالة تنسيق الأرقام
const fmt = (num: number): string => {
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// دالة تنظيف الأرقام من النصوص أو الرموز
const cleanNumber = (val: any): number => {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
};

export default function JournalTab() {
  const journalList = useStore((state) => state.journal);
  const [importError, setImportError] = useState<string | null>(null);

  const importJournalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportError(null);
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        
        // تحويل البيانات لصفوف (Header: 1 يعني السطر الأول هو العناوين)
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

        // البحث عن صف العناوين بذكاء (الذي يحتوي على كلمة "بيان")
        const headerIdx = rows.findIndex(r => r.some((c: any) => String(c).includes("بيان")));
        if (headerIdx === -1) throw new Error("لم يتم العثور على أعمدة البيانات المناسبة في الملف.");

        // معالجة البيانات
        const data = rows.slice(headerIdx + 1)
          .filter(r => r.length > 0 && r[0] !== "") // تصفية الصفوف الفارغة
          .map((r, idx) => ({
            id: Date.now() + idx,
            formNo: String(r[0] || ""),
            date: String(r[1] || ""),
            description: String(r[2] || ""),
            account: String(r[3] || ""),
            debit: cleanNumber(r[4]),
            credit: cleanNumber(r[5]),
          }));

        if (data.length === 0) throw new Error("لا توجد بيانات صالحة للاستيراد في الملف.");

        useStore.setState({ journal: [...journalList, ...data] });
        toast.success(`تم استيراد ${data.length} قيد بنجاح`);
      } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : "خطأ غير معروف";
        setImportError(msg);
        toast.error("فشل استيراد الملف: " + msg);
      }
    };
    
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // إعادة تعيين الحقل للسماح باختيار الملف مرة أخرى
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* رأس التبويب */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 p-3 rounded-xl">
            <BookOpenText className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">دفتر اليومية العامة</h2>
            <p className="text-sm text-slate-500">إجمالي القيود المسجلة: {journalList.length}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition cursor-pointer font-bold shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> استيراد Excel
            <input type="file" accept=".xlsx,.csv" onChange={importJournalFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* رسالة الخطأ */}
      {importError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-semibold">{importError}</p>
        </div>
      )}

      {/* الجدول */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["رقم القيد", "التاريخ", "البيان", "اسم الحساب", "مدين", "دائن"].map(h => (
                  <th key={h} className="p-4 text-right font-bold text-slate-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journalList.length > 0 ? (
                journalList.map((j: any) => (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-slate-600">{j.formNo}</td>
                    <td className="p-3 text-slate-600">{j.date}</td>
                    <td className="p-3 text-slate-800">{j.description}</td>
                    <td className="p-3 text-slate-700">{j.account}</td>
                    <td className="p-3 font-bold text-emerald-600 font-mono">{fmt(j.debit)}</td>
                    <td className="p-3 font-bold text-rose-600 font-mono">{fmt(j.credit)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">لا توجد بيانات لعرضها</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* الملخص الإحصائي */}
      {journalList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-600 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 opacity-70" />
              <span className="font-bold text-lg">إجمالي المدين</span>
            </div>
            <span className="text-2xl font-mono font-bold">
              {fmt(journalList.reduce((s, j) => s + cleanNumber(j.debit), 0))}
            </span>
          </div>
          <div className="bg-rose-600 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-8 h-8 opacity-70" />
              <span className="font-bold text-lg">إجمالي الدائن</span>
            </div>
            <span className="text-2xl font-mono font-bold">
              {fmt(journalList.reduce((s, j) => s + cleanNumber(j.credit), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
