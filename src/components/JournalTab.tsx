import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { journalPdf } from "@/lib/exportPdf";
import { DESCRIPTIONS } from "@/lib/accounts";
import { DEBIT_OPTIONS, CREDIT_OPTIONS, optionLabel, type TemplateCol } from "@/lib/journalTemplate";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

type Form = {
  date: string;
  formNo: string;
  settlement: string;
  description: string;
  debitCol: string;
  creditCol: string;
  amount: string;
};

const LS_DEBIT = "journal:lastDebitCol";
const LS_CREDIT = "journal:lastCreditCol";

const getInitial = (): Form => ({
  date: today(),
  formNo: "",
  settlement: "",
  description: "",
  debitCol: (typeof window !== "undefined" && localStorage.getItem(LS_DEBIT)) || "",
  creditCol: (typeof window !== "undefined" && localStorage.getItem(LS_CREDIT)) || "",
  amount: "",
});

const COLS = [
  { key: "formNo", label: "رقم الاستمارة" },
  { key: "settlement", label: "كشف التسوية" },
  { key: "date", label: "التاريخ" },
  { key: "description", label: "البيان" },
  { key: "debitAccount", label: "ح/ مدين" },
  { key: "creditAccount", label: "ح/ دائن" },
  { key: "debit", label: "مدين" },
  { key: "credit", label: "دائن" },
];

const findOpt = (col: string, side: "debit" | "credit"): TemplateCol | undefined => {
  const list = side === "debit" ? DEBIT_OPTIONS : CREDIT_OPTIONS;
  return list.find((o) => o.col === col);
};

export default function JournalTab() {
  const { journal, addJournal, deleteJournal, updateJournal } = useStore();
  const [form, setForm] = useState<Form>(getInitial);
  const [editing, setEditing] = useState<string | null>(null);

  const { rows, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(journal, COLS.map((c) => c.key));

  const totalDebit = journal.reduce((s, j) => s + (j.debit || 0), 0);
  const totalCredit = journal.reduce((s, j) => s + (j.credit || 0), 0);

  const setDebit = (v: string) => {
    setForm((f) => ({ ...f, debitCol: v }));
    try { localStorage.setItem(LS_DEBIT, v); } catch { /* ignore */ }
  };
  const setCredit = (v: string) => {
    setForm((f) => ({ ...f, creditCol: v }));
    try { localStorage.setItem(LS_CREDIT, v); } catch { /* ignore */ }
  };

  const submit = () => {
    const amt = Number(form.amount) || 0;
    const dOpt = findOpt(form.debitCol, "debit");
    const cOpt = findOpt(form.creditCol, "credit");
    addJournal({
      date: form.date, formNo: form.formNo, settlement: form.settlement,
      description: form.description, account: dOpt?.name || "",
      debitAccount: dOpt?.name || "", creditAccount: cOpt?.name || "",
      debitCol: form.debitCol, creditCol: form.creditCol,
      debit: amt, credit: amt,
    });
    toast.success("تم إضافة القيد");
    setForm((f) => ({ ...f, formNo: "", settlement: "", description: "", amount: "" }));
  };

  const editingRow = editing ? journal.find((j) => j.id === editing) : null;
  const debitColValues = DEBIT_OPTIONS.map((o) => o.col);
  const creditColValues = CREDIT_OPTIONS.map((o) => o.col);
  const debitLabels = Object.fromEntries(DEBIT_OPTIONS.map((o) => [o.col, optionLabel(o)]));
  const creditLabels = Object.fromEntries(CREDIT_OPTIONS.map((o) => [o.col, optionLabel(o)]));
  const editFields: EditField[] = [
    { key: "date", label: "التاريخ", type: "date" },
    { key: "formNo", label: "رقم الاستمارة" },
    { key: "settlement", label: "كشف التسوية" },
    { key: "description", label: "البيان", colSpan: 3 },
    { key: "debitCol", label: "الحساب المدين", type: "select", options: debitColValues, optionLabels: debitLabels },
    { key: "creditCol", label: "الحساب الدائن", type: "select", options: creditColValues, optionLabels: creditLabels },
    { key: "debit", label: "مدين", type: "number" },
    { key: "credit", label: "دائن", type: "number" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ImportButton kind="journal" /></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="عدد القيود" value={journal.length} />
        <Stat label="إجمالي المدين" value={totalDebit} className="bg-primary/10 border-primary/30" />
        <Stat label="إجمالي الدائن" value={totalCredit} className="bg-accent/10 border-accent/30" />
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-4">
        <h2 className="text-lg font-bold mb-3 text-primary">إضافة قيد يدوي</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="التاريخ" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
          <Field label="رقم الاستمارة" v={form.formNo} on={(v) => setForm({ ...form, formNo: v })} />
          <Field label="كشف التسوية" v={form.settlement} on={(v) => setForm({ ...form, settlement: v })} />
          <div className="md:col-span-3">
            <label className="text-xs text-muted-foreground">البيان</label>
            <input list="journal-descriptions" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring" />
            <datalist id="journal-descriptions">
              {Array.from(new Set([...DESCRIPTIONS, ...journal.map((j) => j.description).filter(Boolean)])).map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <TplSelect label="الحساب المدين" v={form.debitCol} on={setDebit} options={DEBIT_OPTIONS} />
          <TplSelect label="الحساب الدائن" v={form.creditCol} on={setCredit} options={CREDIT_OPTIONS} />
          <Field label="المبلغ" type="number" v={form.amount} on={(v) => setForm({ ...form, amount: v })} />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={submit} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 active:scale-95 transition">حفظ القيد</button>
          <button onClick={() => setForm(getInitial())} className="px-4 py-2 border rounded-lg hover:bg-secondary">مسح</button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-primary">دفتر اليومية العامة - 2026م</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearFilters} className="px-3 py-1.5 border rounded-lg text-sm">مسح التصفية</button>
            <button onClick={() => journalPdf(journal)} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-semibold">طباعة / PDF</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-2 py-2 text-right">م</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort(c.key)}>
                    {c.label} <span className="text-xs opacity-60">{sortIndicator(sortKey === c.key, sortDir)}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-right">إجراءات</th>
              </tr>
              <tr className="bg-secondary/50">
                <th></th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-1 py-1">
                    <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)}
                      placeholder="تصفية..." className="w-full px-2 py-1 text-xs border rounded bg-background/70" />
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j, i) => (
                <tr key={j.id} className="border-t hover:bg-muted/40 align-top">
                  <td className="px-2 py-1.5">{i + 1}</td>
                  <td className="px-2 py-1.5">{j.formNo}</td>
                  <td className="px-2 py-1.5">{j.settlement}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{j.date}</td>
                  <td className="px-2 py-1.5">{j.description}</td>
                  <td className="px-2 py-1.5 text-primary">{j.debitAccount || j.account}</td>
                  <td className="px-2 py-1.5 text-accent-foreground">{j.creditAccount || ""}</td>
                  <td className="px-2 py-1.5 font-mono">{fmt(j.debit)}</td>
                  <td className="px-2 py-1.5 font-mono">{fmt(j.credit)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button onClick={() => setEditing(j.id)} className="text-primary text-xs ml-2">تعديل</button>
                    <button onClick={() => { if (confirm("حذف؟")) deleteJournal(j.id); }} className="text-destructive text-xs">حذف</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد قيود</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editingRow && (
        <EditModal
          title="تعديل قيد يومية"
          fields={editFields}
          values={editingRow}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const dOpt = v.debitCol ? findOpt(String(v.debitCol), "debit") : undefined;
            const cOpt = v.creditCol ? findOpt(String(v.creditCol), "credit") : undefined;
            updateJournal(editingRow.id, {
              date: v.date, formNo: v.formNo, settlement: v.settlement, description: v.description,
              debitCol: v.debitCol || undefined, creditCol: v.creditCol || undefined,
              debitAccount: dOpt?.name || editingRow.debitAccount,
              creditAccount: cOpt?.name || editingRow.creditAccount,
              account: dOpt?.name || editingRow.account,
              debit: Number(v.debit) || 0,
              credit: Number(v.credit) || 0,
            });
            try {
              if (v.debitCol) localStorage.setItem(LS_DEBIT, String(v.debitCol));
              if (v.creditCol) localStorage.setItem(LS_CREDIT, String(v.creditCol));
            } catch { /* ignore */ }
            setForm((f) => ({
              ...f,
              debitCol: v.debitCol || f.debitCol,
              creditCol: v.creditCol || f.creditCol,
            }));
            toast.success("تم التعديل");
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`bg-card border rounded-xl p-3 ${className}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold font-mono">{fmt(value)}</div>
    </div>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

function TplSelect({ label, v, on, options }: { label: string; v: string; on: (v: string) => void; options: readonly TemplateCol[] }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select value={v} onChange={(e) => on(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="">— اختر —</option>
        {options.map((o) => <option key={o.col} value={o.col}>{optionLabel(o)}</option>)}
      </select>
    </div>
  );
}
