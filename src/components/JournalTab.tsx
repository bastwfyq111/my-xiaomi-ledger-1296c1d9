import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Edit, Save, Trash2, AlertOctagon, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import ImportButton from "@/components/ImportButton";
import TabActions from "@/components/TabActions";
import type { Journal } from "@/lib/store";

// قائمة الـ 59 حساباً كاملة والمستخرجة حرفياً من رؤوس أعمدة ملف "القيود2026.xlsx"
const ALL_EXCEL_ACCOUNTS = [
  "الباب الاول (الأجور والمرتبات)",
  "الباب الثاني (النفقات التشغيلية)",
  "الباب الثالث (الدعم والموارد)",
  "الباب الرابع (اكتساب الأصول غير المالية)",
  "حساب البنك نفقات تشغيلية محلية",
  "حساب البنك اكتساب اصول غير مالية",
  "حساب البنك موارد محلية",
  "حساب البنك موارد عامة مشتركة",
  "حساب البنك حسابات جارية",
  "ح/ النقدية للصندوق",
  "حسابات سلف الحسابات الجارية",
  "حساب السلف على الأجور",
  "حساب السلف المؤقتة",
  "حساب المبالغ المدفوعة مقدما",
  "ح/ المدينين مالية",
  "ح/ الدائنين مالية",
  "حساب الموارد العامة المشتركة",
  "حساب الموارد المشتركة",
  "حساب الحسابات الجارية",
  "حساب المساهمات الذاتية",
  "حساب المبالغ الدائنة تحت التسوية",
  "حساب البنك امانات",
  "حساب التزامات سلع وخدمات وممتلكات",
  "حساب التزامات اكتساب اصول ثابتة",
  "حساب التزامات اكتساب اصول غير منتجة",
  "حساب تسوية الموارد المحصلة مقدما",
  "حساب الموارد المستحقة",
  "حساب النفقات المقدمة عن سلع وخدمات",
  "حساب مرتجع الاجور",
  "حساب التامينات المتنوعة",
  "حساب المبالغ الدائنة المحصلة للغير",
  "حساب دائنون التزمات قائمة",
  "حساب تسوية المستحقات والمقدمات المدينة",
  "حساب الكفالات",
  "حساب امانات الكفالات",
  "حساب الديون المستحقة للحكومة",
  "حساب متابعة مطلوبات الحكومة",
  "حساب اكتساب الاصول غير المالية",
  "حساب مراقبة اكتساب الاصول غير المالية",
  "حساب الاستخدامات",
  "حساب الموارد"
];

export default function JournalTab() {
  const { journal, addJournal, updateJournal, deleteJournal, clearJournal } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Journal>>({});

  // حالات التحكم في إظهار القوائم المنسدلة المخصصة عند الضغط
  const [showDebitList, setShowDebitList] = useState(false);
  const [showCreditList, setShowCreditList] = useState(false);

  // مراجع لتأمين إغلاق القوائم عند الضغط خارجها
  const debitRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (debitRef.current && !debitRef.current.contains(event.target as Node)) {
        setShowDebitList(false);
      }
      if (creditRef.current && !creditRef.current.contains(event.target as Node)) {
        setShowCreditList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ترشيح الحسابات ديناميكياً للجانب المدين بناءً على ما يكتبه المستخدم
  const filteredDebitAccounts = useMemo(() => {
    const q = (form.debitAccount || "").trim().toLowerCase();
    if (!q) return ALL_EXCEL_ACCOUNTS;
    return ALL_EXCEL_ACCOUNTS.filter((acc) => acc.toLowerCase().includes(q));
  }, [form.debitAccount]);

  // ترشيح الحسابات ديناميكياً للجانب الدائن بناءً على ما يكتبه المستخدم
  const filteredCreditAccounts = useMemo(() => {
    const q = (form.creditAccount || "").trim().toLowerCase();
    if (!q) return ALL_EXCEL_ACCOUNTS;
    return ALL_EXCEL_ACCOUNTS.filter((acc) => acc.toLowerCase().includes(q));
  }, [form.creditAccount]);

  // دالة الحفظ والتحقق المحاسبي
  const handleSave = () => {
    if (!form.description) {
      toast.error("يرجى تعبئة حقل 'البيان' أولاً");
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
      toast.success("تم إضافة قيد اليومية بنجاح");
    }
    setForm({});
    setEditingId(null);
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* لوحة إدخال القيد الجديد */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-800">
            {editingId ? "✏️ تعديل القيد المحدد" : "➕ إضافة قيد يومية (قوائم منسدلة شاملة لكامل رؤوس ملف القيود)"}
          </h3>
          <div className="flex gap-2">
            <ImportButton kind="journal" />
            {journal.length > 0 && (
              <button 
                onClick={() => { if(window.confirm("هل أنت متأكد من مسح البيانات؟")) clearJournal(); }} 
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-lg text-sm font-bold transition-colors"
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
            placeholder="كشف التسوية" 
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
            placeholder="البيان" 
            value={form.description || ""} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none col-span-1 md:col-span-4" 
          />

          {/* القائمة المنسدلة المخصصة للجانب المدين - تفتح بمجرد الضغط */}
          <div className="md:col-span-2 relative" ref={debitRef}>
            <label className="text-xs font-bold text-slate-600 block mb-1">الجانب المدين (الاستخدامات)</label>
            <div className="relative">
              <input
                placeholder="اضغط هنا لعرض كافة الحسابات المدينة الحالية..."
                value={form.debitAccount || ""}
                onFocus={() => setShowDebitList(true)}
                onChange={(e) => { setForm({ ...form, debitAccount: e.target.value }); setShowDebitList(true); }}
                className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 bg-slate-50 font-medium outline-none pl-10"
              />
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>
            {showDebitList && (
              <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-100">
                {filteredDebitAccounts.length > 0 ? (
                  filteredDebitAccounts.map((acc) => (
                    <div
                      key={acc}
                      onClick={() => { setForm({ ...form, debitAccount: acc }); setShowDebitList(false); }}
                      className="p-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-900 cursor-pointer text-right transition-colors"
                    >
                      {acc}
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 text-sm text-slate-400 text-center">لا توجد حسابات مطابقة للبحث</div>
                )}
              </div>
            )}
          </div>

          {/* القائمة المنسدلة المخصصة للجانب الدائن - تفتح بمجرد الضغط */}
          <div className="md:col-span-2 relative" ref={creditRef}>
            <label className="text-xs font-bold text-slate-600 block mb-1">الجانب الدائن (الموارد)</label>
            <div className="relative">
              <input
                placeholder="اضغط هنا لعرض كافة الحسابات الدائنة الحالية..."
                value={form.creditAccount || ""}
                onFocus={() => setShowCreditList(true)}
                onChange={(e) => { setForm({ ...form, creditAccount: e.target.value }); setShowCreditList(true); }}
                className="w-full border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 bg-slate-50 font-medium outline-none pl-10"
              />
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
            </div>
            {showCreditList && (
              <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-100">
                {filteredCreditAccounts.length > 0 ? (
                  filteredCreditAccounts.map((acc) => (
                    <div
                      key={acc}
                      onClick={() => { setForm({ ...form, creditAccount: acc }); setShowCreditList(false); }}
                      className="p-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-900 cursor-pointer text-right transition-colors"
                    >
                      {acc}
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 text-sm text-slate-400 text-center">لا توجد حسابات مطابقة للبحث</div>
                )}
              </div>
            )}
          </div>

          <input 
            type="number" 
            placeholder="المبلغ (مدين)" 
            value={form.debit || ""} 
            onChange={(e) => setForm({ ...form, debit: Number(e.target.value) })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none text-emerald-700 font-bold md:col-span-2" 
          />
          <input 
            type="number" 
            placeholder="المبلغ (دائن)" 
            value={form.credit || ""} 
            onChange={(e) => setForm({ ...form, credit: Number(e.target.value) })} 
            className="border border-slate-300 p-2.5 rounded-lg focus:border-teal-500 outline-none text-rose-700 font-bold md:col-span-2" 
          />

          <div className="md:col-span-4 flex gap-3 pt-2">
            <button 
              onClick={handleSave} 
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-sm flex-1"
            >
              <Save className="w-5 h-5" /> {editingId ? "تحديث القيد الحسابي" : "حفظ القيد بالمنظومة"}
            </button>
          </div>
        </div>
      </div>

      {/* جدول استعراض قيود اليومية العامة */}
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
