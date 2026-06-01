import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { BookOpenText, Upload, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
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
        if (!arrayBuffer) throw new Error("فشل في قراءة الملف");

        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        if (wb.SheetNames.length === 0) throw new Error("الملف فارغ");

        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[];

        if (!rows || rows.length === 0) throw new Error("لم يتم العثور على بيانات في الملف");

        // البحث عن صف العناوين
        const headerIdx = rows.findIndex(r => 
          r?.some((c: any) => {
            const cell = String(c || "").trim();
            return ["قيد", "القيد", "التاريخ", "البيان", "مدين", "دائن", "حساب"].some(k => cell.includes(k));
          })
        );

        if (headerIdx === -1) throw new Error("لم يتم العثور على صف العناوين في الملف");

        const headers = rows[headerIdx].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIdx + 1);

        const data = dataRows
          .filter((r: any[]) => r && r.length > 0)
          .map((r: any[]) => {
            const rowObj: any = {};
            headers.forEach((h, i) => {
              rowObj[h] = r[i];
            });
            return rowObj;
          })
          .filter((r: any) => {
            // تصفية الصفوف الفارغة والتجميعات
            const firstValue = Object.values(r).find(v => v);
            return firstValue && String(firstValue).trim() !== "";
          })
          .map((r: any, idx: number) => {
            const findByKey = (keys: string[]) => {
              const entry = Object.entries(r).find(([k]) => 
                keys.some(kw => k.toLowerCase().includes(kw.toLowerCase()))
              );
              return entry ? String(entry[1] || "").trim() : "";
            };

            const formNo = findByKey(["قيد", "القيد", "رقم"]) || String(idx + 1);
            const date = findByKey(["تاريخ", "التاريخ"]) || "";
            const description = findByKey(["بيان", "البيان", "الشرح"]) || "";
            const debit = findByKey(["منه", "مدين"]) || "0";
            const credit = findByKey(["له", "دائن"]) || "0";
            const account = findByKey(["حساب", "الحساب"]) || "";

            if (!description) throw new Error(`صف بدون بيان: ${JSON.stringify(r)}`);

            return {
              id: Date.now() + idx,
              formNo,
              date,
              description,
              debit: fmt(cleanNumber(debit)),
              credit: fmt(cleanNumber(credit)),
              account
            };
          });

        if (data.length === 0) throw new Error("لم يتم العثور على سجلات صحيحة في الملف");

        useStore.setState({ journal: [...journalList, ...data] });
        toast.success(`تم استيراد ${data.length} قيد يومي بنجاح`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "خطأ غير معروف";
        console.error("خطأ في استيراد الملف:", error);
        setImportError(errorMsg);
        toast.error(errorMsg);
      }
    };

    reader.onerror = () => {
      setImportError("فشل في قراءة الملف");
      toast.error("فشل في قراءة الملف");
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const fmt = (num: number): string => {
    return new Intl.NumberFormat("ar-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const clearJournal = () => {
    if (confirm("هل تريد حذف جميع القيود؟")) {
      useStore.setState({ journal: [] });
      toast.success("تم حذف جميع القيود");
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 text-right" dir="rtl">
      {/* رأس القسم */}
      <div className="flex justify-between items-start gap-3 flex-wrap p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-transparent border-b border-slate-200/60 rounded-lg">
        <div className="flex items-center gap-2">
          <BookOpenText className="w-5 h-5 sm:w-6 sm:h-6 text-teal-700" />
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-800">دفتر قيود اليومية العامة والبلدية</h3>
            <p className="text-xs text-slate-600 mt-0.5">إجمالي القيود: {journalList.length}</p>
          </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
          <label className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-teal-600 text-white rounded-lg text-xs sm:text-sm font-bold cursor-pointer hover:bg-teal-700 transition active:scale-95 flex items-center gap-1.5">
            <Upload className="w-4 h-4" />
            <span>📥 استيراد</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importJournalFile} className="hidden" />
          </label>
          {journalList.length > 0 && (
            <button onClick={clearJournal} className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-red-700 transition active:scale-95">
              🗑️ حذف
            </button>
          )}
        </div>
      </div>

      {/* رسالة الخطأ */}
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 flex gap-2 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold">خطأ في الاستيراد:</p>
            <p className="text-xs mt-1">{importError}</p>
          </div>
        </div>
      )}

      {/* جدول القيود */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 sticky top-0">
                <th className="p-2 sm:p-3 text-center text-slate-700 font-bold min-w-12">#</th>
                <th className="p-2 sm:p-3 text-center text-slate-700 font-bold min-w-20">رقم القيد</th>
                <th className="p-2 sm:p-3 text-center text-slate-700 font-bold min-w-20">التاريخ</th>
                <th className="p-2 sm:p-3 text-right text-slate-700 font-bold min-w-32">البيان والشرح</th>
                <th className="p-2 sm:p-3 text-center text-emerald-700 font-bold min-w-16 bg-emerald-50/40">منه (مدين)</th>
                <th className="p-2 sm:p-3 text-center text-rose-700 font-bold min-w-16 bg-rose-50/40">له (دائن)</th>
                <th className="p-2 sm:p-3 text-right text-slate-700 font-bold min-w-24">اسم الحساب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journalList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 text-sm font-medium">
                    لا توجد قيود يومية مسجلة في هذا الدفتر
                  </td>
                </tr>
              ) : (
                journalList.map((j, index) => (
                  <tr key={j.id || index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 sm:p-3 text-center text-slate-400 font-medium text-xs sm:text-sm">{index + 1}</td>
                    <td className="p-2 sm:p-3 text-center text-slate-600 font-semibold text-xs sm:text-sm">{j.formNo}</td>
                    <td className="p-2 sm:p-3 text-center text-slate-600 text-xs sm:text-sm">{j.date}</td>
                    <td className="p-2 sm:p-3 text-right font-medium text-slate-800 text-xs sm:text-sm">{j.description}</td>
                    <td className="p-2 sm:p-3 text-center font-bold text-emerald-600 bg-emerald-50/10 text-xs sm:text-sm font-mono">{j.debit}</td>
                    <td className="p-2 sm:p-3 text-center font-bold text-rose-600 bg-rose-50/10 text-xs sm:text-sm font-mono">{j.credit}</td>
                    <td className="p-2 sm:p-3 text-right font-semibold text-slate-700 text-xs sm:text-sm">{j.account}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ملخص إحصائي */}
      {journalList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-slate-600">إجمالي المدين</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-700 mt-2">
              {fmt(journalList.reduce((sum, j) => sum + cleanNumber(j.debit), 0))}
            </p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-slate-600">إجمالي الدائن</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-rose-700 mt-2">
              {fmt(journalList.reduce((sum, j) => sum + cleanNumber(j.credit), 0))}
            </p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm font-medium text-slate-600">عدد القيود</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-700 mt-2">
              {journalList.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
