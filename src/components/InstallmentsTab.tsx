import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// المصفوفات الديناميكية للأشهر
const MONTHS_2025 = ["يونيو 2024", "يوليو 2024", "أغسطس 2024", "مارس 2025", "ابريل 2025", "مايو 2025", "يونيو 2025", "يوليو 2025", "أغسطس 2025", "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"];
const MONTHS_2026 = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  const str = String(val).replace(/[,،\s\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "").trim();
  return Number(str) || 0;
};

export default function InstallmentsTab() {
  const { installments, installments2025 } = useStore() as any;
  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ name: string; html: string } | null>(null);

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "totalPaid", "remaining"]);
  const controls2025 = useTableControls(installments2025 || [], ["name", "batch", "specialty", "fees", "totalPaid", "remaining"]);

  // دالة عرض الجدول الديناميكي
  const renderTable = (controls: any, year: 2025 | 2026) => {
    const months = year === 2025 ? MONTHS_2025 : MONTHS_2026;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 font-bold border-b">
            <tr>
              <th className="p-2">الاسم</th>
              {months.map(m => <th key={m} className="p-2 text-center">{m}</th>)}
              <th className="p-2">الإجمالي المسدد</th>
              <th className="p-2">المتبقي</th>
              <th className="p-2">تعديل</th>
            </tr>
          </thead>
          <tbody>
            {controls.rows.map((r: any, i: number) => (
              <tr key={i} className="border-t hover:bg-slate-50">
                <td className="p-2 font-semibold">{r.name}</td>
                {months.map(m => (
                  <td key={m} className="p-2 text-center font-mono">{fmt(r.payments?.[m] || 0)}</td>
                ))}
                <td className="p-2 font-mono text-emerald-600 font-bold">{fmt(r.totalPaid)}</td>
                <td className="p-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                <td className="p-2 text-center">
                  <button onClick={() => setEditingRow({ row: r, year })} className="text-blue-600">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // دالة توليد كشف حساب ديناميكي موحد
  const generateCombinedStatement = (studentName: string) => {
    const s25 = (installments2025 || []).find((i: any) => i.name === studentName);
    const s26 = (installments || []).find((i: any) => i.name === studentName);

    const renderMonthRows = (payments: any, months: string[]) => 
      months.map(m => (payments?.[m] ? `<div class="row"><span class="label">سداد ${m}</span><span class="value">${fmt(payments[m])}</span></div>` : "")).join('');

    return `
      <div style="direction:rtl; font-family: sans-serif; padding: 20px;">
        <h1>كشف حساب الطالب: ${studentName}</h1>
        <h3>عام 2025</h3>
        ${renderMonthRows(s25?.payments, MONTHS_2025)}
        <h3>عام 2026</h3>
        ${renderMonthRows(s26?.payments, MONTHS_2026)}
      </div>
    `;
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div className="bg-white p-5 rounded-xl shadow-sm border">
        <h2 className="font-bold text-teal-800 mb-4">أقساط 2025</h2>
        {renderTable(controls2025, 2025)}
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border">
        <h2 className="font-bold text-teal-800 mb-4">أقساط 2026</h2>
        {renderTable(controls2026, 2026)}
      </div>
      
      {editingRow && (
        <EditModal 
          title={`تعديل بيانات ${editingRow.row.name}`}
          fields={[{ key: "totalPaid", label: "المسدد الإجمالي", type: "number" }, { key: "remaining", label: "المتبقي", type: "number" }]}
          values={editingRow.row}
          onClose={() => setEditingRow(null)}
          onSave={(updated) => {
            const key = editingRow.year === 2025 ? "installments2025" : "installments";
            const data = (useStore.getState() as any)[key].map((i: any) => i.name === editingRow.row.name ? updated : i);
            useStore.setState({ [key]: data });
            toast.success("تم التحديث");
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
}
