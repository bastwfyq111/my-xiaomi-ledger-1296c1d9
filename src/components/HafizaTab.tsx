import { useMemo, useState } from "react";
import { useStore, type Trainee } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { hafizaPdf } from "@/lib/exportPdf";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

const COLS = [
  { key: "name", label: "الاسم" },
  { key: "batch", label: "الدفعة" },
  { key: "specialty", label: "التخصص" },
  { key: "date", label: "التاريخ" },
  { key: "hafizaNo", label: "رقم الحافظة" },
  { key: "description", label: "البيان" },
  { key: "hafizaAmount", label: "المبلغ" },
  { key: "notifyDate", label: "تاريخ التوريد" },
  { key: "notifyNo", label: "رقم الاشعار" },
];

type Form = {
  name: string;
  batch: string;
  specialty: string;
  date: string;
  hafizaNo: string;
  description: string;
  hafizaAmount: string;
  notifyDate: string;
  notifyNo: string;
  notifyAmount: string;
};

const empty: Form = {
  name: "", batch: "", specialty: "", date: today(),
  hafizaNo: "", description: "", hafizaAmount: "",
  notifyDate: "", notifyNo: "", notifyAmount: "",
};

export default function HafizaTab() {
  const { trainees, hafiza, addHafiza, deleteHafiza, addTrainee, updateHafiza } = useStore();
  const [form, setForm] = useState<Form>(empty);
  const [nameQuery, setNameQuery] = useState("");
  const [showSugg, setShowSugg] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(hafiza, COLS.map((c) => c.key));

  const nameSuggestions = useMemo(() => {
    const q = nameQuery.trim();
    if (!q) return trainees.slice(0, 8);
    return trainees.filter((t) => t.name.includes(q)).slice(0, 8);
  }, [trainees, nameQuery]);

  const pickName = (t: Trainee) => {
    setForm((f) => ({ ...f, name: t.name, batch: t.batch, specialty: t.specialty }));
    setNameQuery(t.name);
    setShowSugg(false);
  };

  const submit = () => {
    const amount = Number(form.hafizaAmount) || 0;
    const notifyAmt = Number(form.notifyAmount) || 0;

    // Cascade is now handled inside the store: addHafiza creates the matching
    // account + journal entries automatically.
    addHafiza({
      name: form.name, batch: form.batch, specialty: form.specialty,
      date: form.date, hafizaNo: form.hafizaNo, description: form.description,
      hafizaAmount: amount, notifyDate: form.notifyDate, notifyNo: form.notifyNo,
      notifyAmount: notifyAmt,
    });
    // remember new trainee
    if (!trainees.find((t) => t.name === form.name)) {
      addTrainee({ name: form.name, batch: form.batch, specialty: form.specialty });
    }
    toast.success("تم الحفظ في الحوافظ والحساب واليومية");
    setForm(empty);
    setNameQuery("");
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 text-sm sm:text-base">
      <div className="flex justify-end">
        <ImportButton kind="hafiza" />
      </div>
      <div className="bg-card rounded-xl shadow-sm border p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-primary">إضافة حافظة توريد جديدة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="relative sm:col-span-2">
            <label className="text-xs text-muted-foreground">الاسم *</label>
            <input
              value={nameQuery}
              onChange={(e) => { setNameQuery(e.target.value); setForm({ ...form, name: e.target.value }); setShowSugg(true); }}
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 200)}
              placeholder="ابحث أو اكتب اسم المتدرب..."
              className="w-full px-3 py-2 text-sm border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {showSugg && nameSuggestions.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {nameSuggestions.map((t) => (
                  <li key={t.name}>
                    <button type="button" onMouseDown={() => pickName(t)} className="w-full text-right px-3 py-2 hover:bg-accent/30 text-sm">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.specialty} — {t.batch}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Field label="الدفعة" v={form.batch} on={(v) => setForm({ ...form, batch: v })} />
          <Field label="التخصص" v={form.specialty} on={(v) => setForm({ ...form, specialty: v })} />
          <Field label="التاريخ" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
          <Field label="رقم الحافظة *" v={form.hafizaNo} on={(v) => setForm({ ...form, hafizaNo: v })} />
          <Field label="مبلغ الحافظة *" type="number" v={form.hafizaAmount} on={(v) => setForm({ ...form, hafizaAmount: v })} />
          <div>
            <label className="text-xs text-muted-foreground">البيان</label>
            <input
              list="hafiza-descriptions"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="اكتب أو اختر..."
              className="w-full px-3 py-2 text-sm border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <datalist id="hafiza-descriptions">
              {Array.from(new Set([...DESCRIPTIONS, ...hafiza.map((h) => h.description).filter(Boolean)])).map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <Field label="تاريخ التوريد" type="date" v={form.notifyDate} on={(v) => setForm({ ...form, notifyDate: v })} />
          <Field label="رقم الاشعار" v={form.notifyNo} on={(v) => setForm({ ...form, notifyNo: v })} />
          <Field label="مبلغ التوريد" type="number" v={form.notifyAmount} on={(v) => setForm({ ...form, notifyAmount: v })} />
        </div>
        <div className="mt-3 sm:mt-4 flex gap-2 flex-wrap">
          <button onClick={submit} className="px-4 sm:px-5 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 active:scale-95 transition text-sm">
            حفظ + ترحيل تلقائي
          </button>
          <button onClick={() => { setForm(empty); setNameQuery(""); }} className="px-4 py-2 border rounded-lg hover:bg-secondary text-sm">
            مسح
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-primary">حوافظ التوريد ({hafiza.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearFilters} className="px-3 py-1.5 border rounded-lg text-xs sm:text-sm">مسح التصفية</button>
            <button onClick={() => hafizaPdf(filtered)} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs sm:text-sm font-semibold">
              طباعة / PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs sm:text-sm">
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
              {filtered.map((h, i) => (
                <tr key={h.id} className="border-t hover:bg-muted/40 text-xs sm:text-sm">
                  <td className="px-2 py-1.5">{i + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{h.name}</td>
                  <td className="px-2 py-1.5">{h.batch}</td>
                  <td className="px-2 py-1.5">{h.specialty}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{h.date}</td>
                  <td className="px-2 py-1.5">{h.hafizaNo}</td>
                  <td className="px-2 py-1.5">{h.description}</td>
                  <td className="px-2 py-1.5 font-mono">{fmt(h.hafizaAmount)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{h.notifyDate}</td>
                  <td className="px-2 py-1.5">{h.notifyNo}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button onClick={() => setEditing(h.id)} className="text-primary text-xs ml-2">تعديل</button>
                    <button onClick={() => { if (confirm("حذف؟")) deleteHafiza(h.id); }} className="text-destructive text-xs">حذف</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground text-sm">لا توجد بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (() => {
        const row = hafiza.find((h) => h.id === editing);
        if (!row) return null;
        const fields: EditField[] = [
          { key: "name", label: "الاسم", colSpan: 2 },
          { key: "batch", label: "الدفعة" },
          { key: "specialty", label: "التخصص" },
          { key: "date", label: "التاريخ", type: "date" },
          { key: "hafizaNo", label: "رقم ال��افظة" },
          { key: "hafizaAmount", label: "مبلغ الحافظة", type: "number" },
          { key: "description", label: "البيان", colSpan: 3 },
          { key: "notifyDate", label: "تاريخ التوريد", type: "date" },
          { key: "notifyNo", label: "رقم الاشعار" },
          { key: "notifyAmount", label: "مبلغ التوريد", type: "number" },
        ];
        return (
          <EditModal title="تعديل حافظة" fields={fields} values={row} onClose={() => setEditing(null)}
            onSave={(v) => {
              updateHafiza(row.id, {
                ...v,
                hafizaAmount: Number(v.hafizaAmount) || 0,
                notifyAmount: Number(v.notifyAmount) || 0,
              });
              toast.success("تم التعديل");
              setEditing(null);
            }} />
        );
      })()}
    </div>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}