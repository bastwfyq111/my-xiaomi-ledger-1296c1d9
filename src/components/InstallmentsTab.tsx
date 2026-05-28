import { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS, type Installment } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

const COLS = [
  { key: "name", label: "الاسم" },
  { key: "batch", label: "الدفعة" },
  { key: "specialty", label: "المساق" },
  { key: "fees", label: "رسوم الدراسة" },
  { key: "prevDue", label: "متبقي 2025" },
  { key: "totalPaid", label: "المسدد" },
  { key: "remaining", label: "المتبقي" },
  { key: "notes", label: "ملاحظات" },
];

// مكوّن النافذة المنبثقة لعرض كشف حساب المتدرب (تم دمجه هنا لحل مشكلة الـ Circular Import)
function StatementModal({ row, onClose }: { row: Installment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-background border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-teal-700 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold text-base">تفاصيل أقساط: {row.name}</h3>
          <button onClick={onClose} className="text-2xl line-none hover:opacity-80">×</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto text-right">
          <div className="grid grid-cols-2 gap-2 text-xs border-b pb-2">
            <div><span className="text-muted-foreground">الدفعة:</span> {row.batch}</div>
            <div><span className="text-muted-foreground">المساق:</span> {row.specialty}</div>
            <div><span className="text-muted-foreground">رقم الهاتف:</span> {row.phone || "—"}</div>
          </div>
          <h4 className="font-bold text-xs text-teal-800">الدفعات الشهرية المسجلة لعام 2026:</h4>
          <div className="grid grid-cols-2 gap-2 border rounded-lg p-2 bg-slate-50">
            {INSTALLMENT_MONTHS.map((m) => {
              const amt = row.payments?.[m] || 0;
              return (
                <div key={m} className="flex justify-between items-center p-1 border-b last:border-0 text-xs">
                  <span className="text-slate-600">{m}:</span>
                  <span className={`font-mono ${amt ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                    {amt ? fmt(amt) : "لم يسدد"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-3 bg-slate-50 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold">إغلاق الكشف</button>
        </div>
      </div>
    </div>
  );
}

export default function InstallmentsTab() {
  const { installments, addInstallmentPayment, updateInstallment } = useStore();
  const [selected, setSelected] = useState<Installment | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // إعداد نموذج إضافة قسط جديد
  const [pName, setPName] = useState("");
  const [pMonth, setPMonth] = useState<string>(INSTALLMENT_MONTHS[0]);
  const [pAmount, setPAmount] = useState("");

  // تصفية أقساط 2026 و 2025
  const installments2026 = useMemo(() => installments.filter(i => i.prevDue < i.fees), [installments]);
  const installments2025 = useMemo(() => installments.filter(i => i.prevDue > 0), [installments]);

  const controls2026 = useTableControls(installments2026, COLS.map((c) => c.key));
  const controls2025 = useTableControls(installments2025, COLS.map((c) => c.key));

  const totals2026 = useMemo(() => ({
    paid: controls2026.rows.reduce((s, r) => s + r.totalPaid, 0),
    remaining: controls2026.rows.reduce((s, r) => s + r.remaining, 0),
    prev: controls2026.rows.reduce((s, r) => s + r.prevDue, 0),
  }), [controls2026.rows]);

  const totals2025 = useMemo(() => ({
    prev: controls2025.rows.reduce((s, r) => s + r.prevDue, 0),
  }), [controls2025.rows]);

  const submitPayment = () => {
    const amt = Number(pAmount) || 0;
    if (!pName || !pMonth) {
      toast.error("يرجى اختيار المتدرب وتحديد القيمة بشكل صحيح");
      return;
    }
    addInstallmentPayment(pName, pMonth, amt);
    toast.success(`تم إضافة قسط ${pMonth} للأخ/ة ${pName}`);
    setPAmount("");
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* قسم أقساط 2025 المتبقية */}
      <div className="bg-card rounded-xl shadow-sm border p-4 text-right">
        <h2 className="text-base font-bold mb-3 text-teal-800">أقساط متبقية ومتأخرة من عام 2025م</h2>
        <div className="mb-3 max-w-xs">
          <Stat label="إجمالي المتبقي من 2025" value={totals2025.prev} className="bg-rose-50 border-rose-200 text-rose-900" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="px-2 py-2 text-center w-12">م</th>
                <th className="px-2 py-2 text-right">الاسم</th>
                <th className="px-2 py-2 text-center">الدفعة</th>
                <th className="px-2 py-2 text-center">المساق</th>
                <th className="px-2 py-2 text-center">متبقي 2025</th>
                <th className="px-2 py-2 text-right">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-1.5 text-center text-slate-500">{r.no ?? i + 1}</td>
                  <td className="px-2 py-1.5 font-medium text-slate-700">{r.name}</td>
                  <td className="px-2 py-1.5 text-center">{r.batch}</td>
                  <td className="px-2 py-1.5 text-center">{r.specialty}</td>
                  <td className="px-2 py-1.5 font-mono text-center text-rose-600 font-bold">{fmt(r.prevDue)}</td>
                  <td className="px-2 py-1.5 text-slate-500">{r.notes || "—"}</td>
                </tr>
              ))}
              {controls2025.rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 font-medium">لا توجد سجلات متأخرة أو متبقيات لعام 2025</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* قسم أقساط 2026 الرئيسي */}
      <div className="bg-card rounded-xl shadow-sm border p-4 text-right">
        <div className="flex justify-end mb-3">
          <ImportButton kind="installments" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <Stat label="متبقي سابق من 2025" value={totals2026.prev} className="bg-slate-50 text-slate-700" />
          <Stat label="إجمالي المسدد 2026" value={totals2026.paid} className="bg-emerald-50 border-emerald-200 text-emerald-800" />
          <Stat label="إجمالي المتبقي للعام" value={totals2026.remaining} className="bg-teal-50 border-teal-200 text-teal-800" />
        </div>

        {/* نموذج إضافة قسط مالي سريع */}
        <div className="border rounded-xl p-4 mb-6 bg-slate-50/50">
          <h3 className="text-sm font-bold mb-3 text-teal-900">تسجيل وتوريد قسط شهري جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">اسم المتدرب المقيد</label>
              <select
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
              >
                <option value="">— اختر متدربًا من القائمة —</option>
                {installments2026.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} ({i.batch} - {i.specialty})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">الشهر المستهدف</label>
              <select
                value={pMonth}
                onChange={(e) => setPMonth(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
              >
                {INSTALLMENT_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">المبلغ المودع</label>
              <input
                type="number"
                value={pAmount}
                onChange={(e) => setPAmount(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm font-mono"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="mt-3">
            <button onClick={submitPayment} className="px-5 py-2 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 shadow-sm transition">
              حفظ وتوريد القسط
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b pb-2">
          <h2 className="text-base font-bold text-teal-800">كشف تفصيلي بالقسط الشهري للعام الحالي — 2026م</h2>
          <button onClick={controls2026.clearFilters} className="px-3 py-1 border rounded-lg text-xs hover:bg-slate-50">مسح التصفية والبحث</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="px-2 py-2 text-center w-10">م</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => controls2026.toggleSort(c.key)}>
                    {c.label} <span className="text-xxs opacity-60">{sortIndicator(controls2026.sortKey === c.key, controls2026.sortDir)}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-center w-24">إجراءات</th>
              </tr>
              <tr className="bg-slate-50/60">
                <th></th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-1 py-1">
                    <input value={controls2026.filters[c.key] || ""} onChange={(e) => controls2026.setFilter(c.key, e.target.value)}
                      placeholder="تصفية سريع..." className="w-full px-2 py-1 text-xxs border rounded bg-white" />
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50/80 transition-colors align-top">
                  <td className="px-2 py-2 text-center text-slate-400">{r.no ?? i + 1}</td>
                  <td className="px-2 py-2 font-semibold text-slate-800">{r.name}</td>
                  <td className="px-2 py-2 text-slate-600">{r.batch}</td>
                  <td className="px-2 py-2 text-slate-600">{r.specialty}</td>
                  <td className="px-2 py-2 font-mono text-slate-700">{fmt(r.fees)}</td>
                  <td className="px-2 py-2 font-mono text-slate-500">{fmt(r.prevDue)}</td>
                  <td className="px-2 py-2 font-mono text-emerald-700 font-medium">{fmt(r.totalPaid)}</td>
                  <td className="px-2 py-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="px-2 py-2 text-slate-500 max-w-xs truncate">{r.notes || "—"}</td>
                  <td className="px-2 py-1.5 text-center whitespace-nowrap space-x-1 space-x-reverse">
                    <button onClick={() => setEditing(r.name)} className="text-teal-600 hover:text-teal-800 font-semibold text-xs ml-2">تعديل</button>
                    <button onClick={() => setSelected(r)} className="px-2 py-0.5 bg-slate-100 hover:bg-teal-700 hover:text-white text-slate-700 border rounded text-xs transition-all">كشف</button>
                  </td>
                </tr>
              ))}
              {controls2026.rows.length === 0 && (
                <tr><td colSpan={11} className="text-center py-8 text-slate-400 font-medium">لا توجد سجلات بيانات مطابقة للبحث</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && <StatementModal row={selected} onClose={() => setSelected(null)} />}
        
        {editing && (() => {
          const row = installments2026.find((r) => r.name === editing);
          if (!row) return null;
          const fields: EditField[] = [
            { key: "name", label: "الاسم", colSpan: 2 },
            { key: "phone", label: "رقم الهاتف" },
            { key: "batch", label: "الدفعة" },
            { key: "specialty", label: "المساق" },
            { key: "fees", label: "رسوم الدراسة", type: "number" },
            { key: "prevDue", label: "متبقي 2025", type: "number" },
            { key: "notes", label: "ملاحظات", colSpan: 3 },
            ...INSTALLMENT_MONTHS.map((m) => ({
              key: `pay_${m}`, label: `سداد ${m}`, type: "number" as const,
            })),
          ];
          const values: Record<string, any> = { ...row };
          INSTALLMENT_MONTHS.forEach((m) => { values[`pay_${m}`] = row.payments[m] || 0; });
          return (
            <EditModal title="تعديل بيانات قسط المتدرب" fields={fields} values={values} onClose={() => setEditing(null)}
              onSave={(v) => {
                const payments: Record<string, number> = {};
                INSTALLMENT_MONTHS.forEach((m) => {
                  const n = Number(v[`pay_${m}`]) || 0;
                  if (n) payments[m] = n;
                });
                updateInstallment(row.name, {
                  phone: v.phone, batch: v.batch, specialty: v.specialty,
                  fees: Number(v.fees) || 0, prevDue: Number(v.prevDue) || 0,
                  notes: v.notes, payments,
                });
                toast.success("تم تعديل سجل الأقساط بنجاح");
                setEditing(null);
              }} />
          );
        })()}
        <p className="text-xxs text-slate-400 text-center mt-4">نظام المجلس الطبي — آخر تحديث تلقائي: {today()}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`bg-card border rounded-xl p-3 ${className}`}>
      <div className="text-xxs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm md:text-base font-bold font-mono">{fmt(value)}</div>
    </div>
  );
}
