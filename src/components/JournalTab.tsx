import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Edit, Save, Trash2, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import ImportButton from "@/components/ImportButton";
import type { Journal } from "@/lib/store";

// بناء خيارات القوائم المنسدلة الموحدة والمطابقة لكشف الحساب الشهري والملفات المرفقة لعام 2026
const ACCOUNT_DROPDOWN_OPTIONS = {
  resources: [
    "الباب الأول: الموارد الجارية (المحلية والمشتركة)",
    "الباب الثاني: المنح والإعانات والدعم الخارجي",
    "الباب الثالث: الإيرادات الرأسمالية والتمويلية",
    "حساب البنك - موارد محلية",
    "حساب البنك - موارد عامة مشتركة"
  ],
  uses: [
    "الباب الأول: الأجور والمرتبات وما في حكمها",
    "الباب الثاني: النفقات التشغيلية والمستلزمات السلعية والخدمية",
    "الباب الثالث: الصيانة والنفقات الرأسمالية",
    "الباب الرابع: اكتساب الأصول غير المالية",
    "حساب البنك - نفقات تشغيلية محلية",
    "حساب البنك - اكتساب اصول غير مالية"
  ],
  subsidiary: [
    "الحسابات المساعدة المدينة - حساب البنك حسابات جارية",
    "الحسابات المساعدة المدينة - ح/ النقدية للصندوق",
    "الحسابات المساعدة المدينة - حسابات سلف الحسابات الجارية",
    "الحسابات المساعدة المدينة - حساب السلف على الأجور",
    "الحسابات المساعدة الدائنة - حساب المبالغ الدائنة تحت التسوية",
    "الحسابات المساعدة الدائنة - حساب الدائنين (مالية)",
    "الحسابات المساعدة الدائنة - حساب البنك امانات"
  ]
};

export default function JournalTab() {
  const { journal, addJournal, updateJournal, deleteJournal, clearJournal } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Journal>>({});

  // دمج كافة الحسابات والترتيب لإنشاء قائمة منسدلة شاملة لكل طرف محاسبي
  const allDropdownAccounts = useMemo(() => {
    return [
      ...ACCOUNT_DROPDOWN_OPTIONS.resources,
      ...ACCOUNT_DROPDOWN_OPTIONS.uses,
      ...ACCOUNT_DROPDOWN_OPTIONS.subsidiary
    ];
  }, []);

  // دالة حفظ القيود والتحقق من الحقول الإلزامية
  const handleSave = () => {
    if (!form.description) {
      toast.error("يرجى تعبئة حقل 'البيان' لتوضيح المعاملة المحاسبية");
      return;
    }
    if (!form.debitAccount && !form.creditAccount) {
      toast.error("يرجى اختيار الحساب المدين أو الدائن من القائمة المنسدلة");
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
      toast.success("تم تحديث قيد اليومية بنجاح");
    } else {
      addJournal(payload);
      toast.success("تم إدراج قيد اليومية بنجاح في المنظومة");
    }
    setForm({});
    setEditingId(null);
  };

  const handleClearData = () => {
    if (journal.length === 0) {
      toast.info("لا توجد قيود مسجلة لمسحها");
      return;
    }
    const confirmDelete = window.confirm(
      "⚠️ تحذير محاسبي: هل تريد مسح كافة القيود؟ سيؤثر هذا الإجراء مباشرة على كشف الحساب الشهري."
    );
    if (confirmDelete && clearJournal) {
      clearJournal();
      toast.success("تم مسح تبيان القيود الحالية وتصفير الواجهة");
    }
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* نموذج إدخال القيود المحاسبية */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-800">
            {editingId ? "✏️ تعديل قيد اليومية الحالي" : "➕ إنشاء قيد جديد بـ القوائم المنسدلة الموحدة"}
          </h3>
          <div className="flex gap-2">
            <ImportButton kind="journal" />
            {journal.length > 0 && (
              <button 
                onClick={handleClearData} 
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-lg text-sm font-bold transition-all"
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
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none" 
          />
          <input 
            placeholder="كشف التسوية المالي" 
            value={form.settlement || ""} 
            onChange={(e) => setForm({ ...form, settlement: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none" 
          />
          <input 
            type="date" 
            value={form.date || ""} 
            onChange={(e) => setForm({ ...form, date: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none md:col-span-2" 
          />
          <input 
            placeholder="البيان (شرح تفصيلي للعملية المالية)" 
            value={form.description || ""} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none col-span-1 md:col-span-4" 
          />

          {/* قائمة منسدلة تفاعلية للحساب المدين وتوحيد الأبواب والموارد */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-600">الجانب المديـن (اختيار حساب الاستخدامات/البواب)</label>
            <input
              list="all-accounts-list"
              placeholder="اضغط لاختيار أو البحث عن الحساب المدين..."
              value={form.debitAccount || ""}
              onChange={(e) => setForm({ ...form, debitAccount: e.target.value })}
              className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 bg-slate-50 font-medium outline-none"
            />
          </div>

          {/* قائمة منسدلة تفاعلية للحساب الدائن وتوحيد الأبواب والموارد */}
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-600">الجانب الدائـن (اختيار حساب الموارد/البواب)</label>
            <input
              list="all-accounts-list"
              placeholder="اضغط لاختيار أو البحث عن الحساب الدائن..."
              value={form.creditAccount || ""}
              onChange={(e) => setForm({ ...form, creditAccount: e.target.value })}
              className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 bg-slate-50 font-medium outline-none"
            />
          </div>

          {/* الدليل الموحد المرتبط بـ الـ Input كقائمة خيارات منسدلة تظهر عند الضغط */}
          <datalist id="all-accounts-list">
            {allDropdownAccounts.map((accountName) => (
              <option key={accountName} value={accountName} />
            ))}
          </datalist>

          <input 
            type="number" 
            placeholder="المبلغ المدين" 
            value={form.debit || ""} 
            onChange={(e) => setForm({ ...form, debit: Number(e.target.value) })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none text-emerald-700 font-bold md:col-span-2" 
          />
          <input 
            type="number" 
            placeholder="المبلغ الدائن" 
            value={form.credit || ""} 
            onChange={(e) => setForm({ ...form, credit: Number(e.target.value) })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none text-rose-700 font-bold md:col-span-2" 
          />

          <div className="md:col-span-4 flex gap-3 pt-2">
            <button 
              onClick={handleSave} 
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-sm flex-1"
            >
              <Save className="w-5 h-5" /> {editingId ? "تحديث التعديلات" : "حفظ وإدراج القيد"}
            </button>
            {editingId && (
              <button 
                onClick={() => { setForm({}); setEditingId(null); }} 
                className="border border-slate-300 hover:bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-semibold"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </div>
      </div>

      {/* جدول القيود الحالي للتأكد من المخرجات */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-right font-semibold">رقم الاستمارة</th>
                <th className="p-3 text-right font-semibold">التسوية</th>
                <th className="p-3 text-right font-semibold">التاريخ</th>
                <th className="p-3 text-right font-semibold min-w-[180px]">البيان</th>
                <th className="p-3 text-right font-semibold">الحساب المدين</th>
                <th className="p-3 text-right font-semibold">الحساب الدائن</th>
                <th className="p-3 text-right font-semibold">مدين</th>
                <th className="p-3 text-right font-semibold">دائن</th>
                <th className="p-3 text-center font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {journal.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono text-slate-600">{j.formNo || "—"}</td>
                  <td className="p-3 text-slate-600">{j.settlement || "—"}</td>
                  <td className="p-3 whitespace-nowrap font-mono text-slate-600">{j.date || "—"}</td>
                  <td className="p-3 text-slate-800 font-medium">{j.description || "—"}</td>
                  <td className="p-3 text-emerald-700 font-bold">{j.debitAccount || "—"}</td>
                  <td className="p-3 text-rose-700 font-bold">{j.creditAccount || "—"}</td>
                  <td className="p-3 font-mono font-bold text-emerald-600 bg-emerald-50/20">{j.debit ? j.debit.toLocaleString() : "—"}</td>
                  <td className="p-3 font-mono font-bold text-rose-600 bg-rose-50/20">{j.credit ? j.credit.toLocaleString() : "—"}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button onClick={() => { setEditingId(j.id); setForm(j); }} className="p-1 text-blue-600 bg-blue-50 rounded hover:bg-blue-600 hover:text-white transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteJournal(j.id)} className="p-1 text-rose-600 bg-rose-50 rounded hover:bg-rose-600 hover:text-white transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
