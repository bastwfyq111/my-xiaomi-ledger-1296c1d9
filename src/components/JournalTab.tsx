import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Edit, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ImportButton from "@/components/ImportButton";
import { DEBIT_OPTIONS, CREDIT_OPTIONS } from "@/lib/journalTemplate";
import type { Journal } from "@/lib/store";

export default function JournalTab() {
  const { journal, addJournal, updateJournal, deleteJournal } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Journal>>({});

  const debitSuggestions = useMemo(() => {
    const fromTpl = DEBIT_OPTIONS.map((c) => c.name!).filter(Boolean);
    const fromData = journal.map((j) => j.debitAccount || "").filter(Boolean);
    return Array.from(new Set([...fromTpl, ...fromData]));
  }, [journal]);

  const creditSuggestions = useMemo(() => {
    const fromTpl = CREDIT_OPTIONS.map((c) => c.name!).filter(Boolean);
    const fromData = journal.map((j) => j.creditAccount || "").filter(Boolean);
    return Array.from(new Set([...fromTpl, ...fromData]));
  }, [journal]);

  const handleSave = () => {
    if (!form.description) {
      toast.error("يرجى تعبئة البيان على الأقل");
      return;
    }
    const payload: Omit<Journal, "id"> = {
      date: form.date || "",
      formNo: form.formNo || "",
      settlement: form.settlement || "",
      description: form.description || "",
      account: form.debitAccount || form.account || "",
      debitAccount: form.debitAccount || "",
      creditAccount: form.creditAccount || "",
      debit: Number(form.debit) || 0,
      credit: Number(form.credit) || 0,
    };

    if (editingId) {
      updateJournal(editingId, payload);
      toast.success("تم تعديل القيد");
    } else {
      addJournal(payload);
      toast.success("تم إضافة القيد");
    }
    setForm({});
    setEditingId(null);
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* منطقة الإضافة */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{editingId ? "تعديل قيد" : "إضافة قيد جديد"}</h3>
          <ImportButton kind="journal" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="رقم الاستمارة" value={form.formNo || ""} onChange={(e) => setForm({ ...form, formNo: e.target.value })} className="border p-2 rounded" />
          <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border p-2 rounded" />
          <input placeholder="البيان" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border p-2 rounded col-span-2" />

          <input
            list="debit-accounts"
            placeholder="الحساب المدين"
            value={form.debitAccount || ""}
            onChange={(e) => setForm({ ...form, debitAccount: e.target.value })}
            className="border p-2 rounded col-span-2"
          />
          <datalist id="debit-accounts">
            {debitSuggestions.map((a) => <option key={a} value={a} />)}
          </datalist>

          <input
            list="credit-accounts"
            placeholder="الحساب الدائن"
            value={form.creditAccount || ""}
            onChange={(e) => setForm({ ...form, creditAccount: e.target.value })}
            className="border p-2 rounded col-span-2"
          />
          <datalist id="credit-accounts">
            {creditSuggestions.map((a) => <option key={a} value={a} />)}
          </datalist>

          <input type="number" placeholder="مدين" value={form.debit || ""} onChange={(e) => setForm({ ...form, debit: Number(e.target.value) })} className="border p-2 rounded" />
          <input type="number" placeholder="دائن" value={form.credit || ""} onChange={(e) => setForm({ ...form, credit: Number(e.target.value) })} className="border p-2 rounded" />

          <button onClick={handleSave} className="bg-teal-600 text-white p-2 rounded flex items-center justify-center gap-2 col-span-2">
            <Save className="w-4 h-4" /> حفظ
          </button>
          {editingId && (
            <button onClick={() => { setForm({}); setEditingId(null); }} className="border p-2 rounded col-span-2">
              إلغاء التعديل
            </button>
          )}
        </div>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white border rounded-xl overflow-hidden text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-right">التاريخ</th>
              <th className="p-3 text-right">رقم الاستمارة</th>
              <th className="p-3 text-right">البيان</th>
              <th className="p-3 text-right">ح/ مدين</th>
              <th className="p-3 text-right">ح/ دائن</th>
              <th className="p-3 text-right">مدين</th>
              <th className="p-3 text-right">دائن</th>
              <th className="p-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {journal.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{j.date}</td>
                <td className="p-3">{j.formNo}</td>
                <td className="p-3">{j.description}</td>
                <td className="p-3">{j.debitAccount || j.account}</td>
                <td className="p-3">{j.creditAccount}</td>
                <td className="p-3">{j.debit || ""}</td>
                <td className="p-3">{j.credit || ""}</td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => { setEditingId(j.id); setForm(j); }} className="text-blue-600"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => deleteJournal(j.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
