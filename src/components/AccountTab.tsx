import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { accountsPdf } from "@/lib/exportPdf";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

const COLS = [
  { key: "date", label: "التاريخ" },
  { key: "hafizaNo", label: "رقم الحافظة" },
  { key: "notifyNo", label: "رقم الاشعار" },
  { key: "notifyDate", label: "تاريخ التوريد" },
  { key: "checkNo", label: "رقم الشيك" },
  { key: "description", label: "البيان" },
  { key: "specialty", label: "التخصص" },
  { key: "name", label: "الاسم" },
  { key: "hafizaAmount", label: "مبلغ الحافظة" },
  { key: "income", label: "الإيرادات" },
  { key: "expense", label: "المصروفات" },
];

type EntryForm = {
  date: string;
  hafizaNo: string;
  notifyNo: string;
  notifyDate: string;
  checkNo: string;
  checkDate: string;
  description: string;
  specialty: string;
  name: string;
  hafizaAmount: string;
  income: string;
  expense: string;
};

const emptyEntry = (): EntryForm => ({
  date: today(),
  hafizaNo: "",
  notifyNo: "",
  notifyDate: "",
  checkNo: "",
  checkDate: "",
  description: "",
  specialty: "",
  name: "",
  hafizaAmount: "",
  income: "",
  expense: "",
});

export default function AccountTab() {
  const { accounts, openingBalance, setOpeningBalance, deleteAccount, addAccount, updateAccount } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState<EntryForm>(emptyEntry);
  const [editing, setEditing] = useState<string | null>(null);

  const submitEntry = () => {
    const inc = Number(entry.income) || 0;
    const exp = Number(entry.expense) || 0;
    addAccount({
      date: entry.date, hafizaNo: entry.hafizaNo, notifyNo: entry.notifyNo,
      notifyDate: entry.notifyDate, checkNo: entry.checkNo, checkDate: entry.checkDate,
      description: entry.description, specialty: entry.specialty, name: entry.name,
      hafizaAmount: Number(entry.hafizaAmount) || 0, income: inc, expense: exp,
    });
    toast.success("تم إضافة القيد");
    setEntry(emptyEntry());
    setShowForm(false);
  };

  const { rows: filteredAccounts, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(accounts, COLS.map((c) => c.key));

  const rows = useMemo(() => {
    let bal = openingBalance;
    return filteredAccounts.map((a) => {
      bal = bal + (a.income || 0) - (a.expense || 0);
      return { ...a, balance: bal };
    });
  }, [filteredAccounts, openingBalance]);

  const totalIn = accounts.reduce((s, a) => s + (a.income || 0), 0);
  const totalOut = accounts.reduce((s, a) => s + (a.expense || 0), 0);
  const finalBalance = openingBalance + totalIn - totalOut;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ImportButton kind="account" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="الرصيد الافتتاحي" value={openingBalance} editable onChange={setOpeningBalance} />
        <Stat label="إجمالي الإيرادات" value={totalIn} className="bg-success/10 border-success/30" />
        <Stat label="إجمالي المصروفات" value={totalOut} className="bg-destructive/10 border-destructive/30" />
        <Stat label="الرصيد النهائي" value={finalBalance} className="bg-primary/10 border-primary/30" />
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-primary">حساب المجلس ({accounts.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearFilters} className="px-3 py-1.5 border rounded-lg text-sm">مسح التصفية</button>
            <button onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">
              {showForm ? "إغلاق" : "+ إضافة قيد خارجي"}
            </button>
            <button onClick={() => accountsPdf(accounts, openingBalance)} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-semibold">
              طباعة / PDF
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border rounded-lg p-3 mb-3 bg-muted/30">
            <h3 className="font-bold text-sm mb-2 text-primary">قيد خارجي جديد</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <FormField label="التاريخ" type="date" v={entry.date} on={(v) => setEntry({ ...entry, date: v })} />
              <FormField label="رقم الحافظة" v={entry.hafizaNo} on={(v) => setEntry({ ...entry, hafizaNo: v })} />
              <FormField label="رقم الاشعار" v={entry.notifyNo} on={(v) => setEntry({ ...entry, notifyNo: v })} />
              <FormField label="تاريخ التوريد" type="date" v={entry.notifyDate} on={(v) => setEntry({ ...entry, notifyDate: v })} />
              <FormField label="رقم الشيك" v={entry.checkNo} on={(v) => setEntry({ ...entry, checkNo: v })} />
              <FormField label="تاريخ الشيك" type="date" v={entry.checkDate} on={(v) => setEntry({ ...entry, checkDate: v })} />
              <FormField label="التخصص" v={entry.specialty} on={(v) => setEntry({ ...entry, specialty: v })} />
              <FormField label="الاسم" v={entry.name} on={(v) => setEntry({ ...entry, name: v })} />
              <div className="col-span-2 md:col-span-4">
                <FormField label="البيان" v={entry.description} on={(v) => setEntry({ ...entry, description: v })} />
              </div>
              <FormField label="مبلغ الحافظة" type="number" v={entry.hafizaAmount} on={(v) => setEntry({ ...entry, hafizaAmount: v })} />
              <FormField label="الإيرادات" type="number" v={entry.income} on={(v) => setEntry({ ...entry, income: v })} />
              <FormField label="المصروفات" type="number" v={entry.expense} on={(v) => setEntry({ ...entry, expense: v })} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={submitEntry} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold">حفظ القيد</button>
              <button onClick={() => setEntry(emptyEntry())} className="px-3 py-2 border rounded-lg">مسح</button>
            </div>
          </div>
        )}
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
                <th className="px-2 py-2 text-right">الرصيد</th>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-2 py-1.5">1</td>
                <td colSpan={6}></td>
                <td colSpan={2} className="px-2 py-1.5">رصيد افتتاحي للعام 2025</td>
                <td></td>
                <td className="px-2 py-1.5 font-mono text-success">{fmt(openingBalance)}</td>
                <td></td>
                <td className="px-2 py-1.5 font-mono text-primary">{fmt(openingBalance)}</td>
                <td></td>
              </tr>
              {rows.map((a, i) => (
                <tr key={a.id} className="border-t hover:bg-muted/40">
                  <td className="px-2 py-1.5">{i + 2}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{a.date}</td>
                  <td className="px-2 py-1.5">{a.hafizaNo}</td>
                  <td className="px-2 py-1.5">{a.notifyNo}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{a.notifyDate}</td>
                  <td className="px-2 py-1.5">{a.checkNo}</td>
                  <td className="px-2 py-1.5">{a.description}</td>
                  <td className="px-2 py-1.5">{a.specialty}</td>
                  <td className="px-2 py-1.5 font-medium">{a.name}</td>
                  <td className="px-2 py-1.5 font-mono">{fmt(a.hafizaAmount)}</td>
                  <td className="px-2 py-1.5 font-mono text-success">{fmt(a.income)}</td>
                  <td className="px-2 py-1.5 font-mono text-destructive">{fmt(a.expense)}</td>
                  <td className="px-2 py-1.5 font-mono font-semibold">{fmt(a.balance)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button onClick={() => setEditing(a.id)} className="text-primary text-xs ml-2">تعديل</button>
                    <button onClick={() => { if (confirm("حذف؟")) deleteAccount(a.id); }} className="text-destructive text-xs">حذف</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={14} className="text-center py-8 text-muted-foreground">لا توجد حركات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (() => {
        const row = accounts.find((a) => a.id === editing);
        if (!row) return null;
        const fields: EditField[] = [
          { key: "date", label: "التاريخ", type: "date" },
          { key: "hafizaNo", label: "رقم الحافظة" },
          { key: "notifyNo", label: "رقم الاشعار" },
          { key: "notifyDate", label: "تاريخ التوريد", type: "date" },
          { key: "checkNo", label: "رقم الشيك" },
          { key: "checkDate", label: "تاريخ الشيك", type: "date" },
          { key: "name", label: "الاسم" },
          { key: "specialty", label: "التخصص" },
          { key: "description", label: "البيان", colSpan: 3 },
          { key: "hafizaAmount", label: "مبلغ الحافظة", type: "number" },
          { key: "income", label: "الإيرادات", type: "number" },
          { key: "expense", label: "المصروفات", type: "number" },
        ];
        return (
          <EditModal title="تعديل قيد الحساب" fields={fields} values={row} onClose={() => setEditing(null)}
            onSave={(v) => {
              updateAccount(row.id, {
                ...v,
                hafizaAmount: Number(v.hafizaAmount) || 0,
                income: Number(v.income) || 0,
                expense: Number(v.expense) || 0,
              });
              toast.success("تم التعديل");
              setEditing(null);
            }} />
        );
      })()}
    </div>
  );
}

function Stat({ label, value, className = "", editable, onChange }: { label: string; value: number; className?: string; editable?: boolean; onChange?: (n: number) => void }) {
  return (
    <div className={`bg-card border rounded-xl p-3 ${className}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      {editable ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value) || 0)}
          className="text-lg font-bold font-mono w-full bg-transparent focus:outline-none"
        />
      ) : (
        <div className="text-lg font-bold font-mono">{fmt(value)}</div>
      )}
    </div>
  );
}

function FormField({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg bg-input/30 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
