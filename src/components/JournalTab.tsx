import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { BookOpenText, Plus, Trash2, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";

// واجهة القيد
type JournalEntry = {
  id: string;
  formNo: string;
  date: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
};

export default function JournalTab() {
  const { journal, addJournal, updateJournal, deleteJournal } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<JournalEntry>>({});

  // استخراج الحسابات الفريدة للإكمال التلقائي
  const accountSuggestions = useMemo(() => {
    return Array.from(new Set(journal.map((j) => j.account))).filter(Boolean);
  }, [journal]);

  const handleSave = () => {
    if (!form.description || !form.account) {
      toast.error("يرجى تعبئة الحقول الأساسية");
      return;
    }

    if (editingId) {
      updateJournal(editingId, form as JournalEntry);
      toast.success("تم تعديل القيد");
    } else {
      addJournal({ ...form, id: Date.now().toString() } as JournalEntry);
      toast.success("تم إضافة القيد");
    }
    setForm({});
    setEditingId(null);
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* منطقة الإضافة */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <h3 className="font-bold mb-4">{editingId ? "تعديل قيد" : "إضافة قيد جديد"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="رقم القيد" value={form.formNo || ""} onChange={(e) => setForm({...form, formNo: e.target.value})} className="border p-2 rounded" />
          <input type="date" value={form.date || ""} onChange={(e) => setForm({...form, date: e.target.value})} className="border p-2 rounded" />
          <input placeholder="البيان" value={form.description || ""} onChange={(e) => setForm({...form, description: e.target.value})} className="border p-2 rounded col-span-2" />
          
          {/* الإكمال التلقائي */}
          <input 
            list="accounts" 
            placeholder="اسم الحساب" 
            value={form.account || ""} 
            onChange={(e) => setForm({...form, account: e.target.value})} 
            className="border p-2 rounded" 
          />
          <datalist id="accounts">
            {accountSuggestions.map(acc => <option key={acc} value={acc} />)}
          </datalist>

          <input type="number" placeholder="مدين" value={form.debit || ""} onChange={(e) => setForm({...form, debit: Number(e.target.value)})} className="border p-2 rounded" />
          <input type="number" placeholder="دائن" value={form.credit || ""} onChange={(e) => setForm({...form, credit: Number(e.target.value)})} className="border p-2 rounded" />
          
          <button onClick={handleSave} className="bg-teal-600 text-white p-2 rounded flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> حفظ
          </button>
        </div>
      </div>

      {/* الجدول */}
      <table className="w-full bg-white border rounded-xl overflow-hidden">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-3 text-right">التاريخ</th>
            <th className="p-3 text-right">البيان</th>
            <th className="p-3 text-right">الحساب</th>
            <th className="p-3 text-right">مدين</th>
            <th className="p-3 text-right">دائن</th>
            <th className="p-3 text-right">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {journal.map((j) => (
            <tr key={j.id} className="border-t">
              <td className="p-3">{j.date}</td>
              <td className="p-3">{j.description}</td>
              <td className="p-3">{j.account}</td>
              <td className="p-3">{j.debit}</td>
              <td className="p-3">{j.credit}</td>
              <td className="p-3 flex gap-2">
                <button onClick={() => { setEditingId(j.id); setForm(j); }} className="text-blue-600"><Edit className="w-4 h-4"/></button>
                <button onClick={() => deleteJournal(j.id)} className="text-red-600"><Trash2 className="w-4 h-4"/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
