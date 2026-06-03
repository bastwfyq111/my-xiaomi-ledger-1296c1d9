import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Edit, Save, Trash2, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import ImportButton from "@/components/ImportButton";
import { DEBIT_OPTIONS, CREDIT_OPTIONS } from "@/lib/journalTemplate";
import type { Journal } from "@/lib/store";

export default function JournalTab() {
  // افترضنا هنا وجود دالة clearJournal في الـ store الخاص بك لمسح البيانات
  const { journal, addJournal, updateJournal, deleteJournal, clearJournal } = useStore();
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

  // دالة حفظ أو تعديل القيد
  const handleSave = () => {
    if (!form.description) {
      toast.error("يرجى تعبئة حقل 'البيان' على الأقل");
      return;
    }
    const payload: Omit<Journal, "id"> = {
      date: form.date || "",
      formNo: form.formNo || "",
      settlement: form.settlement || "", // تم إضافته ليتوافق مع القيود2026.xlsx
      description: form.description || "",
      account: form.debitAccount || form.account || "",
      debitAccount: form.debitAccount || "",
      creditAccount: form.creditAccount || "",
      debit: Number(form.debit) || 0,
      credit: Number(form.credit) || 0,
    };

    if (editingId) {
      updateJournal(editingId, payload);
      toast.success("تم تعديل القيد بنجاح");
    } else {
      addJournal(payload);
      toast.success("تم إضافة القيد بنجاح");
    }
    setForm({});
    setEditingId(null);
  };

  // دالة مسح كافة البيانات الجديدة
  const handleClearData = () => {
    if (journal.length === 0) {
      toast.info("لا توجد قيود حالياً لمسحها");
      return;
    }
    // رسالة تأكيدية لمنع الحذف بالخطأ
    const confirmDelete = window.confirm(
      "⚠️ تحذير: هل أنت متأكد من رغبتك في مسح كافة بيانات القيود بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء."
    );
    
    if (confirmDelete) {
      if (clearJournal) {
        clearJournal();
        toast.success("تم مسح كافة البيانات بنجاح");
      } else {
        toast.error("عذراً، دالة مسح البيانات (clearJournal) غير معرفة في المخزن (store).");
      }
    }
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* منطقة الإضافة والتحكم العلوية */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-800">
            {editingId ? "✏️ تعديل القيد" : "➕ إضافة قيد يومية جديد"}
          </h3>
          <div className="flex gap-2">
            <ImportButton kind="journal" />
            {journal.length > 0 && (
              <button 
                onClick={handleClearData} 
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-lg text-sm font-bold transition-colors"
                title="مسح كافة القيود"
              >
                <AlertOctagon className="w-4 h-4" /> مسح البيانات
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <input 
            placeholder="رقم الاستمارة" 
            value={form.formNo || ""} 
            onChange={(e) => setForm({ ...form, formNo: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors" 
          />
          <input 
            placeholder="كشف التسوية" 
            value={form.settlement || ""} 
            onChange={(e) => setForm({ ...form, settlement: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors" 
          />
          <input 
            type="date" 
            value={form.date || ""} 
            onChange={(e) => setForm({ ...form, date: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors md:col-span-2" 
          />
          
          <input 
            placeholder="البيان" 
            value={form.description || ""} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors col-span-1 md:col-span-4" 
          />

          <input
            list="debit-accounts"
            placeholder="الجانب المديـن (حساب)"
            value={form.debitAccount || ""}
            onChange={(e) => setForm({ ...form, debitAccount: e.target.value })}
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors md:col-span-2 bg-slate-50"
          />
          <datalist id="debit-accounts">
            {debitSuggestions.map((a) => <option key={a} value={a} />)}
          </datalist>

          <input
            list="credit-accounts"
            placeholder="الجانب الدائـن (حساب)"
            value={form.creditAccount || ""}
            onChange={(e) => setForm({ ...form, creditAccount: e.target.value })}
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors md:col-span-2 bg-slate-50"
          />
          <datalist id="credit-accounts">
            {creditSuggestions.map((a) => <option key={a} value={a} />)}
          </datalist>

          <input 
            type="number" 
            placeholder="المبلغ (مدين)" 
            value={form.debit || ""} 
            onChange={(e) => setForm({ ...form, debit: Number(e.target.value) })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors md:col-span-2 text-emerald-700 font-bold" 
          />
          <input 
            type="number" 
            placeholder="المبلغ (دائن)" 
            value={form.credit || ""} 
            onChange={(e) => setForm({ ...form, credit: Number(e.target.value) })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none transition-colors md:col-span-2 text-rose-700 font-bold" 
          />

          <div className="md:col-span-4 flex gap-3 pt-2">
            <button 
              onClick={handleSave} 
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-colors shadow-sm flex-1"
            >
              <Save className="w-5 h-5" /> {editingId ? "تحديث القيد" : "حفظ القيد"}
            </button>
            {editingId && (
              <button 
                onClick={() => { setForm({}); setEditingId(null); }} 
                className="border border-slate-300 hover:bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-semibold transition-colors"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </div>
      </div>

      {/* جدول عرض البيانات المطابق لملف القيود2026.xlsx */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-right font-semibold whitespace-nowrap">رقم الاستمارة</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">كشف التسوية</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">التاريخ</th>
                <th className="p-3 text-right font-semibold min-w-[200px]">البيان</th>
                <th className="p-3 text-right font-semibold">ح/ مدين</th>
                <th className="p-3 text-right font-semibold">ح/ دائن</th>
                <th className="p-3 text-right font-semibold">المبلغ (مدين)</th>
                <th className="p-3 text-right font-semibold">المبلغ (دائن)</th>
                <th className="p-3 text-center font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {journal.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono text-slate-600">{j.formNo || "—"}</td>
                  <td className="p-3 text-slate-600">{j.settlement || "—"}</td>
                  <td className="p-3 whitespace-nowrap font-mono text-slate-600">{j.date || "—"}</td>
                  <td className="p-3 text-slate-800">{j.description || "—"}</td>
                  <td className="p-3 text-emerald-700 font-medium">{j.debitAccount || j.account || "—"}</td>
                  <td className="p-3 text-rose-700 font-medium">{j.creditAccount || "—"}</td>
                  <td className="p-3 font-mono font-bold text-emerald-600 bg-emerald-50/30">
                    {Number(j.debit) > 0 ? Number(j.debit).toLocaleString() : "—"}
                  </td>
                  <td className="p-3 font-mono font-bold text-rose-600 bg-rose-50/30">
                    {Number(j.credit) > 0 ? Number(j.credit).toLocaleString() : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => { setEditingId(j.id); setForm(j); }} 
                        className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-600 hover:text-white transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteJournal(j.id)} 
                        className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-600 hover:text-white transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {journal.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 bg-slate-50">
                    لا توجد قيود يومية مدخلة حالياً. استخدم النموذج أعلاه لإضافة قيد أو قم بالاستيراد من ملف "القيود2026.xlsx".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
