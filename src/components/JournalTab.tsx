import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Edit, Save, Trash2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import ImportButton from "@/components/ImportButton";
import TabActions from "@/components/TabActions";
import type { Journal } from "@/lib/store";

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

// سطر مدين أو دائن داخل القيد المركب
interface EntryLine {
  id: string;
  account: string;
  amount: number;
  type: "debit" | "credit";
  showList?: boolean;
}

// حقل بحث منسدل مشترك
function AccountDropdown({
  value,
  onChange,
  placeholder,
  colorClass,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colorClass: string;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q ? ALL_EXCEL_ACCOUNTS.filter((a) => a.toLowerCase().includes(q)) : ALL_EXCEL_ACCOUNTS;
  }, [value]);

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <input
        placeholder={placeholder}
        value={value}
        onFocus={() => setShow(true)}
        onChange={(e) => { onChange(e.target.value); setShow(true); }}
        className={`w-full border border-black p-2 rounded-lg outline-none text-sm font-medium bg-slate-50 ${colorClass}`}
      />
      {show && (
        <div className="absolute z-50 w-full mt-1 max-h-52 overflow-y-auto bg-white border border-black rounded-lg shadow-xl divide-y divide-slate-100">
          {filtered.length > 0 ? filtered.map((acc) => (
            <div
              key={acc}
              onClick={() => { onChange(acc); setShow(false); }}
              className="p-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-900 cursor-pointer text-right transition-colors whitespace-normal"
            >
              {acc}
            </div>
          )) : (
            <div className="p-2 text-sm text-slate-400 text-center">لا توجد حسابات مطابقة</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JournalTab() {
  const { journal, addJournal, updateJournal, deleteJournal, clearJournal } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  // بيانات رأس القيد
  const [formNo, setFormNo] = useState("");
  const [settlement, setSettlement] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  // أسطر القيد المركب
  const [lines, setLines] = useState<EntryLine[]>([
    { id: "d1", account: "", amount: 0, type: "debit" },
    { id: "c1", account: "", amount: 0, type: "credit" },
  ]);

  const genId = () => Math.random().toString(36).slice(2, 8);

  const addLine = (type: "debit" | "credit") => {
    setLines((prev) => [...prev, { id: genId(), account: "", amount: 0, type }]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof EntryLine, value: any) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  // إجماليات للتحقق من التوازن
  const totalDebit = lines.filter((l) => l.type === "debit").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const totalCredit = lines.filter((l) => l.type === "credit").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const isBalanced = totalDebit > 0 && totalCredit > 0 && totalDebit === totalCredit;

  const resetForm = () => {
    setFormNo(""); setSettlement(""); setDate(""); setDescription("");
    setLines([
      { id: "d1", account: "", amount: 0, type: "debit" },
      { id: "c1", account: "", amount: 0, type: "credit" },
    ]);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!description) { toast.error("يرجى تعبئة حقل البيان"); return; }
    if (!isBalanced) { toast.error("القيد غير متوازن — يجب أن يتساوى إجمالي المدين والدائن"); return; }

    const debitLines = lines.filter((l) => l.type === "debit");
    const creditLines = lines.filter((l) => l.type === "credit");

    // حفظ كل تركيبة (مدين × دائن) كسطر في اليومية
    debitLines.forEach((dl) => {
      creditLines.forEach((cl) => {
        const ratio = (Number(cl.amount) || 0) / totalCredit;
        const payload: Omit<Journal, "id"> = {
          date,
          formNo,
          settlement,
          description,
          account: dl.account,
          debitAccount: dl.account,
          creditAccount: cl.account,
          debit: Number(dl.amount) || 0,
          credit: Math.round((Number(dl.amount) || 0) * ratio),
        };
        if (editingId) {
          updateJournal(editingId, payload);
        } else {
          addJournal(payload);
        }
      });
    });

    toast.success(editingId ? "تم تحديث القيد المركب بنجاح" : "تم حفظ القيد المركب بنجاح");
    resetForm();
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* لوحة إدخال القيد المركب */}
      <div className="bg-white p-5 rounded-xl border border-black shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-black">
          <h3 className="font-bold text-lg text-slate-800">
            {editingId ? "✏️ تعديل القيد المركب" : "➕ إضافة قيد يومية مركب"}
          </h3>
          <div className="flex gap-2 flex-wrap">
            <ImportButton kind="journal" />
            <TabActions
              title="قيود اليومية"
              rows={journal}
              columns={[
                { key: "date", label: "التاريخ" },
                { key: "formNo", label: "رقم الاستمارة" },
                { key: "description", label: "البيان" },
                { key: "debitAccount", label: "الحساب المدين" },
                { key: "debit", label: "مدين" },
                { key: "creditAccount", label: "الحساب الدائن" },
                { key: "credit", label: "دائن" },
              ]}
              fileName="قيود-اليومية"
              numericKeys={["debit","credit"]}
              onClear={clearJournal}
            />
          </div>
        </div>

        {/* بيانات رأس القيد */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <input
            placeholder="رقم الاستمارة"
            value={formNo}
            onChange={(e) => setFormNo(e.target.value)}
            className="border border-black p-2.5 rounded-lg focus:border-teal-500 outline-none text-sm text-center"
          />
          <input
            placeholder="كشف التسوية"
            value={settlement}
            onChange={(e) => setSettlement(e.target.value)}
            className="border border-black p-2.5 rounded-lg focus:border-teal-500 outline-none text-sm text-center"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-black p-2.5 rounded-lg focus:border-teal-500 outline-none text-sm text-center"
          />
          <input
            placeholder="البيان"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-black p-2.5 rounded-lg focus:border-teal-500 outline-none text-sm text-center sm:col-span-4"
          />
        </div>

        {/* جدول أسطر القيد المركب */}
        <div className="rounded-xl overflow-hidden border border-black mb-4">
          <table className="w-full text-sm border-collapse text-center ">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border border-black px-3 py-2 text-center whitespace-normal min-w-[120px]">النوع</th>
                <th className="border border-black px-3 py-2 text-center whitespace-normal min-w-[120px]">اسم الحساب</th>
                <th className="border border-black px-3 py-2 text-center whitespace-normal min-w-[120px]">المبلغ</th>
                <th className="border border-black px-3 py-2 text-center whitespace-normal min-w-[120px]">حذف</th>
              </tr>
            </thead>
            <tbody>
              {/* أسطر المدين */}
              {lines.filter((l) => l.type === "debit").map((l) => (
                <tr key={l.id} className="bg-emerald-50/40 hover:bg-emerald-50 transition-colors">
                  <td className="border border-black px-2 py-2 text-center whitespace-normal min-w-[120px]">
                    <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full whitespace-normal">مدين</span>
                  </td>
                  <td className="border border-black px-2 py-2 whitespace-normal min-w-[120px]">
                    <AccountDropdown
                      value={l.account}
                      onChange={(v) => updateLine(l.id, "account", v)}
                      placeholder="اختر أو ابحث عن الحساب المدين..."
                      colorClass="focus:border-emerald-500 text-emerald-800"
                    />
                  </td>
                  <td className="border border-black px-2 py-2 whitespace-normal min-w-[120px]">
                    <input
                      type="number"
                      value={l.amount || ""}
                      onChange={(e) => updateLine(l.id, "amount", e.target.value)}
                      className="w-full border border-black p-2 rounded-lg outline-none text-center font-mono font-bold text-emerald-700 bg-white"
                      placeholder="0"
                    />
                  </td>
                  <td className="border border-black px-2 py-2 text-center whitespace-normal min-w-[120px]">
                    <button onClick={() => removeLine(l.id)} className="p-1 text-rose-500 hover:bg-rose-100 rounded transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* زر إضافة سطر مدين */}
              <tr className="bg-emerald-50/20">
                <td colSpan={4} className="border border-black px-3 py-1.5 text-center">
                  <button
                    onClick={() => addLine("debit")}
                    className="text-emerald-700 hover:bg-emerald-100 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1 mx-auto transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة سطر مدين
                  </button>
                </td>
              </tr>

              {/* فاصل */}
              <tr className="bg-slate-200">
                <td colSpan={4} className="border border-black px-3 py-1 text-center text-xs font-bold text-slate-600">— الجانب الدائن (الموارد) —</td>
              </tr>

              {/* أسطر الدائن */}
              {lines.filter((l) => l.type === "credit").map((l) => (
                <tr key={l.id} className="bg-rose-50/40 hover:bg-rose-50 transition-colors">
                  <td className="border border-black px-2 py-2 text-center whitespace-normal min-w-[120px]">
                    <span className="inline-block bg-rose-100 text-rose-800 text-xs font-bold px-2 py-0.5 rounded-full whitespace-normal">دائن</span>
                  </td>
                  <td className="border border-black px-2 py-2 whitespace-normal min-w-[120px]">
                    <AccountDropdown
                      value={l.account}
                      onChange={(v) => updateLine(l.id, "account", v)}
                      placeholder="اختر أو ابحث عن الحساب الدائن..."
                      colorClass="focus:border-rose-500 text-rose-800"
                    />
                  </td>
                  <td className="border border-black px-2 py-2 whitespace-normal min-w-[120px]">
                    <input
                      type="number"
                      value={l.amount || ""}
                      onChange={(e) => updateLine(l.id, "amount", e.target.value)}
                      className="w-full border border-black p-2 rounded-lg outline-none text-center font-mono font-bold text-rose-700 bg-white"
                      placeholder="0"
                    />
                  </td>
                  <td className="border border-black px-2 py-2 text-center whitespace-normal min-w-[120px]">
                    <button onClick={() => removeLine(l.id)} className="p-1 text-rose-500 hover:bg-rose-100 rounded transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* زر إضافة سطر دائن */}
              <tr className="bg-rose-50/20">
                <td colSpan={4} className="border border-black px-3 py-1.5 text-center">
                  <button
                    onClick={() => addLine("credit")}
                    className="text-rose-700 hover:bg-rose-100 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1 mx-auto transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة سطر دائن
                  </button>
                </td>
              </tr>

              {/* صف الإجماليات */}
              <tr className="bg-slate-900 text-white font-extrabold">
                <td colSpan={2} className="border border-black px-3 py-2 text-center whitespace-normal">
                  {isBalanced
                    ? "✅ القيد متوازن"
                    : totalDebit !== totalCredit && (totalDebit > 0 || totalCredit > 0)
                    ? "⚠️ القيد غير متوازن"
                    : "— أدخل المبالغ —"}
                </td>
                <td className="border border-black px-2 py-2 text-center font-mono whitespace-normal min-w-[120px]">
                  <span className="text-emerald-300">م: {totalDebit.toLocaleString()}</span>
                  <span className="mx-2 text-slate-400">|</span>
                  <span className="text-rose-300">د: {totalCredit.toLocaleString()}</span>
                </td>
                <td className="border border-black px-2 py-2 text-center whitespace-normal min-w-[120px]">
                  <span className={isBalanced ? "text-emerald-400 text-lg" : "text-rose-400 text-lg"}>
                    {isBalanced ? "✓" : "✗"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-sm flex-1"
          >
            <Save className="w-5 h-5" /> {editingId ? "تحديث القيد المركب" : "حفظ القيد المركب"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-lg font-bold transition-all"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* جدول استعراض قيود اليومية */}
      <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh] relative">
          <table className="w-full text-sm border-collapse text-center ">
            <thead className="bg-slate-800 text-white sticky top-0 z-20 shadow-md">
              <tr>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">رقم الاستمارة</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">التسوية</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">التاريخ</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">البيان</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">الحساب المدين</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">الحساب الدائن</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">مدين</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">دائن</th>
                <th className="border border-black p-3 text-center font-semibold whitespace-normal min-w-[120px]">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {journal.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400 font-medium">
                    لا توجد قيود يومية — ابدأ بإضافة قيد جديد أو استيراد ملف
                  </td>
                </tr>
              ) : journal.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-black p-3 font-mono text-slate-600 text-center whitespace-normal min-w-[120px]">{j.formNo || "—"}</td>
                  <td className="border border-black p-3 text-slate-600 text-center whitespace-normal min-w-[120px]">{j.settlement || "—"}</td>
                  <td className="border border-black p-3 font-mono text-slate-600 text-center whitespace-normal min-w-[120px]">{j.date || "—"}</td>
                  <td className="border border-black p-3 text-slate-800 font-medium text-center whitespace-normal min-w-[120px]">{j.description || "—"}</td>
                  <td className="border border-black p-3 text-emerald-700 font-bold text-center whitespace-normal min-w-[120px]">{j.debitAccount || "—"}</td>
                  <td className="border border-black p-3 text-rose-700 font-bold text-center whitespace-normal min-w-[120px]">{j.creditAccount || "—"}</td>
                  <td className="border border-black p-3 font-mono font-bold text-emerald-600 bg-emerald-50/20 text-center whitespace-normal min-w-[120px]">{j.debit ? j.debit.toLocaleString() : "—"}</td>
                  <td className="border border-black p-3 font-mono font-bold text-rose-600 bg-rose-50/20 text-center whitespace-normal min-w-[120px]">{j.credit ? j.credit.toLocaleString() : "—"}</td>
                  <td className="border border-black p-3 text-center whitespace-normal min-w-[120px]">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => { setEditingId(j.id); setFormNo(j.formNo || ""); setSettlement(j.settlement || ""); setDate(j.date || ""); setDescription(j.description || "");
                          setLines([
                            { id: genId(), account: j.debitAccount || "", amount: j.debit || 0, type: "debit" },
                            { id: genId(), account: j.creditAccount || "", amount: j.credit || 0, type: "credit" },
                          ]);
                        }}
                        className="p-1 text-blue-600 bg-blue-50 rounded hover:bg-blue-600 hover:text-white transition-colors"
                      >
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
