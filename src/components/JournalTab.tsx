import React from "react";
import { useStore } from "@/lib/store";
import { BookOpenText } from "lucide-react";

export default function JournalTab() {
  const journalList = useStore((state) => state.journal);

  return (
    <div className="w-full space-y-6 text-right" dir="rtl">
      <div className="p-4 bg-gradient-to-r from-teal-50 to-transparent border-b border-slate-200/60 flex items-center gap-2">
        <BookOpenText className="w-5 h-5 text-teal-700" />
        <h3 className="font-bold text-base text-slate-800">دفتر قيود اليومية العامة والبلدية</h3>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[850px] text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 border-b border-slate-200">
                <th className="p-4">رقم القيد</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">البيان والشرح</th>
                <th className="p-4 text-emerald-700 bg-emerald-50/40">منه (مدين)</th>
                <th className="p-4 text-rose-700 bg-rose-50/40">له (دائن)</th>
                <th className="p-4">اسم الحساب المختص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {journalList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">لا توجد قيود يومية مسجلة في هذا الدفتر.</td>
                </tr>
              ) : (
                journalList.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-500">{j.formNo}</td>
                    <td className="p-4 text-slate-600">{j.date}</td>
                    <td className="p-4 font-medium text-slate-800">{j.description}</td>
                    <td className="p-4 font-bold text-emerald-600 bg-emerald-50/10">{j.debit}</td>
                    <td className="p-4 font-bold text-rose-600 bg-rose-50/10">{j.credit}</td>
                    <td className="p-4 font-semibold text-slate-700">{j.account}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
