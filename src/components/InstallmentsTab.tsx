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

export default function InstallmentsTab() {
  const { installments, addInstallmentPayment, updateInstallment } = useStore();
  const [selected, setSelected] = useState<Installment | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Add payment form
  const [pName, setPName] = useState("");
  const [pMonth, setPMonth] = useState<string>(INSTALLMENT_MONTHS[0]);
  const [pAmount, setPAmount] = useState("");

  // 2026 أقساط
  const installments2026 = useMemo(() => installments.filter(i => i.prevDue < i.fees), [installments]);
  // 2025 أقساط
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
    if (!pName || !pMonth) return;
    addInstallmentPayment(pName, pMonth, amt);
    toast.success(`تم إضافة قسط ${pMonth} للأخ/ة ${pName}`);
    setPAmount("");
  };

  return (
    <div className="space-y-8">
      {/* قسم أقساط 2025 */}
      <div className="bg-card rounded-xl shadow-sm border p-4">
        <h2 className="text-lg font-bold mb-4 text-primary">أقساط متبقية من عام 2025</h2>
        <div className="mb-3">
          <Stat label="إجمالي المتبقي من 2025" value={totals2025.prev} className="bg-secondary/20" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-2 py-2 text-right">م</th>
                <th className="px-2 py-2 text-right">الاسم</th>
                <th className="px-2 py-2 text-right">الدفعة</th>
                <th className="px-2 py-2 text-right">المساق</th>
                <th className="px-2 py-2 text-right">متبقي 2025</th>
                <th className="px-2 py-2 text-right">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-muted/40 align-top">
                  <td className="px-2 py-1.5">{r.no ?? i + 1}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5">{r.batch}</td>
                  <td className="px-2 py-1.5">{r.specialty}</td>
                  <td className="px-2 py-1.5 font-mono text-destructive">{fmt(r.prevDue)}</td>
                  <td className="px-2 py-1.5">{r.notes}</td>
                </tr>
              ))}
              {controls2025.rows.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد بيانات متأخرة من 2025</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* بقية أقساط 2026 والإدخالات النموذجية */}
      <div className="bg-card rounded-xl shadow-sm border p-4">
        <div className="flex justify-end mb-3">
          <ImportButton kind="installments" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Stat label="متبقي 2025" value={totals2026.prev} className="bg-secondary/30" />
          <Stat label="إجمالي المسدد 2026" value={totals2026.paid} className="bg-primary/10 border-primary/30" />
          <Stat label="إجمالي المتبقي" value={totals2026.remaining} className="bg-destructive/10 border-destructive/30" />
        </div>

        <div className="bg-card rounded-xl shadow-sm border p-4 mb-6">
          <h2 className="text-lg font-bold mb-3 text-primary">إضافة قسط جديد</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">الاسم</label>
              <select
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— اختر متدربًا —</option>
                {installments2026.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} ({i.batch} - {i.specialty})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">الشهر</label>
              <select
                value={pMonth}
                onChange={(e) => setPMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {INSTALLMENT_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">المبلغ</label>
              <input
                type="number"
                value={pAmount}
                onChange={(e) => setPAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="mt-3">
            <button onClick={submitPayment} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 active:scale-95 transition">
              إضافة القسط
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-primary">كشف تفصيلي بالقسط الشهري - 2026م</h2>
          <button onClick={controls2026.clearFilters} className="px-3 py-1.5 border rounded-lg text-sm">مسح التصفية</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-2 py-2 text-right">م</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => controls2026.toggleSort(c.key)}>
                    {c.label} <span className="text-xs opacity-60">{sortIndicator(controls2026.sortKey === c.key, controls2026.sortDir)}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-right">إجراءات</th>
              </tr>
              <tr className="bg-secondary/50">
                <th></th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-1 py-1">
                    <input value={controls2026.filters[c.key] || ""} onChange={(e) => controls2026.setFilter(c.key, e.target.value)}
                      placeholder="تصفية..." className="w-full px-2 py-1 text-xs border rounded bg-background/70" />
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-muted/40 align-top">
                  <td className="px-2 py-1.5">{r.no ?? i + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{r.name}</td>
                  <td className="px-2 py-1.5">{r.batch}</td>
                  <td className="px-2 py-1.5">{r.specialty}</td>
                  <td className="px-2 py-1.5 font-mono">{fmt(r.fees)}</td>
                  <td className="px-2 py-1.5 font-mono">{fmt(r.prevDue)}</td>
                  <td className="px-2 py-1.5 font-mono text-primary">{fmt(r.totalPaid)}</td>
                  <td className="px-2 py-1.5 font-mono text-destructive">{fmt(r.remaining)}</td>
                  <td className="px-2 py-1.5">{r.notes}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button onClick={() => setEditing(r.name)} className="text-primary text-xs ml-2">تعديل</button>
                    <button onClick={() => setSelected(r)} className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs font-semibold whitespace-nowrap">كشف</button>
                  </td>
                </tr>
              ))}
              {controls2026.rows.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد بيانات</td></tr>
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
            <EditModal title="تعديل بيانات قسط" fields={fields} values={values} onClose={() => setEditing(null)}
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
                toast.success("تم التعديل");
                setEditing(null);
              }} />
          );
        })()}
        <p className="text-xs text-muted-foreground text-center mt-4">آخر تحديث: {today()}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`bg-card border rounded-xl p-3 ${className}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base md:text-lg font-bold font-mono">{fmt(value)}</div>
    </div>
  );
}

import { StatementModal } from "./InstallmentsTab"; // يستخدم المودال الافتراضي إذا توفر
