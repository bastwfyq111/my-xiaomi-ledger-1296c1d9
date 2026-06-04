import React, { useMemo, useState } from "react";
import { useStore, type Account } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { Printer, X, Plus, Edit, Trash2, Search, Save, Eraser, FileSpreadsheet, Link } from "lucide-react";
import TabActions from "./TabActions";
// 💡 ملاحظة: يجب التأكد من توفر مسار هذا الملف لكي يعمل القائمة المنسدلة للربط بشكل صحيح.
import schema from "@/data/revenueTemplate.json";

// ==========================================
// 1. الثوابت والإعدادات الأساسية (مطابقة تماماً لملف الإكسل)
// ==========================================
const COLS = [
  { key: "date", label: "التاريخ" },
  { key: "hafizaNo", label: "رقم الحافظة" },
  { key: "notifyNo", label: "رقم الإشعار" },
  { key: "notifyDate", label: "تاريخ التوريد" },
  { key: "checkNo", label: "رقم الشيك" },
  { key: "checkDate", label: "تاريخ الشيك" },
  { key: "description", label: "البيان" },
  { key: "specialty", label: "التخصص" },
  { key: "name", label: "الاسم" },
  { key: "hafizaAmount", label: "مبلغ الحافظة" },
  { key: "income", label: "الإيرادات" },
  { key: "expense", label: "المصروفات" },
  { key: "revenueKey", label: "رمز الإيراد" }, 
  { key: "balance", label: "الرصيد" },
];

type FormType = {
  date: string; hafizaNo: string; notifyNo: string; notifyDate: string;
  checkNo: string; checkDate: string; description: string; specialty: string;
  name: string; hafizaAmount: string; income: string; expense: string; revenueKey: string;
};

const emptyForm: FormType = {
  date: today(), hafizaNo: "", notifyNo: "", notifyDate: "",
  checkNo: "", checkDate: "", description: "", specialty: "",
  name: "", hafizaAmount: "", income: "", expense: "", revenueKey: ""
};

const parseAmount = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  const cleanString = String(val).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
};

const Modal = ({ title, isOpen, onClose, children }: { title: string; isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-emerald-50 to-slate-50 sticky top-0 z-10">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default function AccountsTab() {
  // 💡 قمنا بسحب مصفوفة الحوافظ (hafiza) لربطها تلقائياً بجدول كشف الحساب الجاري
  const { accounts, hafiza, addAccount, updateAccount, deleteAccount, clearAccounts } = useStore();
  const [form, setForm] = useState<FormType>(emptyForm);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  // حالات التحكم بالتعديل الفوري المباشر داخل الخلايا
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [cellValue, setCellValue] = useState("");

  // 💡 الدمج الذكي: نقوم بدمج الحسابات اليدوية والمستوردة مع بيانات الحوافظ بشكل تلقائي
  const combinedData = useMemo(() => {
    // 1. تحويل بيانات الحوافظ إلى شكل متوافق مع أعمدة كشف الحساب
    const hafizaMapped = hafiza.map((h) => ({
      id: `hafiza-${h.id}`, // معرف مميز للحماية من تكرار المفاتيح
      isFromHafiza: true,    // علامة استرشادية لمنع الحذف العشوائي من هنا
      date: h.date || today(),
      hafizaNo: h.hafizaNo || "",
      notifyNo: h.notifyNo || "",
      notifyDate: h.notifyDate || "",
      checkNo: "",
      checkDate: "",
      description: h.description || "توريد حافظة تلقائي",
      specialty: h.specialty || "",
      name: h.name || "",
      hafizaAmount: Number(h.hafizaAmount) || 0,
      income: Number(h.notifyAmount) || 0, // مبلغ التوريد يرحل تلقائياً كإيراد
      expense: 0,
      revenueKey: h.revenueKey || "", 
    }));

    return [...accounts, ...hafizaMapped];
  }, [accounts, hafiza]);

  // استخدام عناصر التصفية والتحكم على المصفوفة المدمجة بالكامل
  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(combinedData, COLS.map((c) => c.key));

  const revenueTypes = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if(schema && schema.chapters) {
      schema.chapters.forEach((ch: any) =>
        ch.sections.forEach((sec: any) =>
          sec.items.forEach((it: any) =>
            it.types.forEach((t: any) => {
              list.push({
                key: `${ch.no}-${sec.no}-${it.no}-${t.no}`,
                label: `${ch.title} ← ${t.title}`
              });
            })
          )
        )
      );
    }
    return list;
  }, []);

  // حساب الإجماليات للأشرطة العلوية بناءً على الحسابات المدمجة شاملة الحوافظ
  const totalIncome = useMemo(() => combinedData.reduce((sum, a) => sum + (Number(a.income) || 0), 0), [combinedData]);
  const totalExpense = useMemo(() => combinedData.reduce((sum, a) => sum + (Number(a.expense) || 0), 0), [combinedData]);
  const currentBalance = totalIncome - totalExpense;

  // حساب الرصيد التراكمي المتحرك للأسطر الظاهرة والمفلترة
  const filteredWithBalance = useMemo(() => {
    let runningBalance = 0;
    return filtered.map((row) => {
      const inc = Number(row.income) || 0;
      const exp = Number(row.expense) || 0;
      runningBalance = runningBalance + inc - exp;
      return { ...row, balance: runningBalance };
    });
  }, [filtered]);

  const submit = () => {
    if (!form.description && !form.name) {
      toast.error("يرجى إدخال الاسم أو البيان على الأقل");
      return;
    }

    addAccount({
      date: form.date, hafizaNo: form.hafizaNo, notifyNo: form.notifyNo,
      notifyDate: form.notifyDate, checkNo: form.checkNo, checkDate: form.checkDate,
      description: form.description, specialty: form.specialty, name: form.name,
      hafizaAmount: Number(form.hafizaAmount) || 0,
      income: Number(form.income) || 0,
      expense: Number(form.expense) || 0,
      revenueKey: form.revenueKey || undefined,
    });

    toast.success("تم إضافة السجل المالي للحساب بنجاح وتحديث الإيرادات");
    setForm(emptyForm);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    
    // إذا كان السجل قادم من الحوافظ، نوجه المستخدم لتعديله من تبويبه الأصلي لمنع تعارض البيانات
    if (editingRow.isFromHafiza) {
      toast.error("هذا السجل مرتبط بتبويب الحوافظ، يرجى تعديله من تبويب الحوافظ مباشرة لتحديثه تلقائياً هنا.");
      setEditingRow(null);
      return;
    }

    updateAccount(editingRow.id, {
      ...editingRow,
      hafizaAmount: Number(editingRow.hafizaAmount) || 0,
      income: Number(editingRow.income) || 0,
      expense: Number(editingRow.expense) || 0,
    });
    
    toast.success("تم تعديل السجل بنجاح وتحديث الإيرادات");
    setEditingRow(null);
  };

  // التحكم بالتعديل الفوري المباشر عند النقر فوق الخلية
  const handleCellClick = (row: any, colKey: string, currentVal: any) => {
    if (row.isFromHafiza) {
      toast.info("هذه الخلية مرتبطة بجدول الحوافظ. أي تعديل هناك سيحدثها هنا فوراً ⚡");
      return;
    }
    setActiveCell({ rowId: row.id, colKey });
    setCellValue(String(currentVal ?? ""));
  };

  // حفظ التعديل الفوري المباشر للخلية ونقله للستور
  const handleCellSave = (row: any) => {
    if (!activeCell) return;
    const { colKey, rowId } = activeCell;
    let finalVal: any = cellValue;
    
    if (colKey === "hafizaAmount" || colKey === "income" || colKey === "expense") {
      finalVal = Number(cellValue) || 0;
    }

    updateAccount(rowId, { ...row, [colKey]: finalVal });
    setActiveCell(null);
    toast.success("تم التحديث التلقائي للخلية");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

        if (json.length === 0) throw new Error("الملف فارغ");

        const importedAccounts = json
          .map((row: any) => {
            const cleanRow: any = {};
            for (const key in row) cleanRow[key.trim()] = row[key];
            return cleanRow;
          })
          .filter((row: any) => row["الاسم"] || row["البيان"] || row["name"] || row["description"])
          .map((row: any) => ({
            date: row["التاريخ"] || row["date"] || today(),
            hafizaNo: String(row["رقم الحافظة"] || row["hafizaNo"] || ""),
            notifyNo: String(row["رقم الإشعار"] || row["رقم الاشعار"] || row["notifyNo"] || ""),
            notifyDate: row["تاريخ التوريد"] || row["notifyDate"] || "",
            checkNo: String(row["رقم الشيك"] || row["checkNo"] || ""),
            checkDate: row["تاريخ الشيك"] || row["checkDate"] || "",
            description: row["البيان"] || row["description"] || "",
            specialty: row["التخصص"] || row["specialty"] || "",
            name: row["الاسم"] || row["name"] || "",
            hafizaAmount: parseAmount(row["مبلغ الحافظة"] || row["hafizaAmount"]),
            income: parseAmount(row["الإيرادات"] || row["الايرادات"] || row["income"]),
            expense: parseAmount(row["المصروفات"] || row["expense"]),
            revenueKey: String(row["رمز الإيراد"] || row["رمز الايراد"] || row["revenueKey"] || ""),
          }));

        useStore.getState().importData({ accounts: importedAccounts });
        toast.success(`تم استيراد ${importedAccounts.length} سجل مالي بنجاح`);
      } catch (err) {
        toast.error("فشل الاستيراد، يرجى مراجعة التنسيق والأعمدة.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* ========== الإدخال اليدوي والاستيراد ========== */}
      <div className="w-full bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-700 to-emerald-800 px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-white" />
            <h2 className="text-sm sm:text-lg font-bold text-white">إضافة حركة مالية جديدة للحساب</h2>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-white text-emerald-800 rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-50 transition-all shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> استيراد حساب Excel
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} className="hidden" />
          </label>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="التاريخ" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
            <Field label="رقم الحافظة" v={form.hafizaNo} on={(v) => setForm({ ...form, hafizaNo: v })} />
            <Field label="رقم الإشعار" v={form.notifyNo} on={(v) => setForm({ ...form, notifyNo: v })} />
            <Field label="تاريخ التوريد" type="date" v={form.notifyDate} on={(v) => setForm({ ...form, notifyDate: v })} />
            <Field label="رقم الشيك" v={form.checkNo} on={(v) => setForm({ ...form, checkNo: v })} />
            <Field label="تاريخ الشيك" type="date" v={form.checkDate} on={(v) => setForm({ ...form, checkDate: v })} />
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">البيان</label>
              <input
                list="account-descriptions"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="اكتب أو اختر البيان..."
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-emerald-500 bg-slate-50 transition-colors"
              />
              <datalist id="account-descriptions">
                {Array.from(new Set([...DESCRIPTIONS, ...accounts.map((a) => a.description).filter(Boolean)])).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <Field label="التخصص" v={form.specialty} on={(v) => setForm({ ...form, specialty: v })} />
            <Field label="الاسم" v={form.name} on={(v) => setForm({ ...form, name: v })} placeholder="اسم الحركة أو المتدرب..." />
            <Field label="مبلغ الحافظة" type="number" v={form.hafizaAmount} on={(v) => setForm({ ...form, hafizaAmount: v })} />
            <Field label="الإيرادات" type="number" v={form.income} on={(v) => setForm({ ...form, income: v })} placeholder="0.00" />
            <Field label="المصروفات" type="number" v={form.expense} on={(v) => setForm({ ...form, expense: v })} placeholder="0.00" />
            
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-teal-800 mb-1 flex items-center gap-1">
                <Link className="w-3.5 h-3.5" /> ربط بنوع الإيراد (اختياري)
              </label>
              <select
                value={form.revenueKey}
                onChange={(e) => setForm({ ...form, revenueKey: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg outline-none focus:border-teal-500 bg-teal-50/40 text-slate-700"
              >
                <option value="">-- بدون ربط --</option>
                {revenueTypes.map((t) => (
                  <option key={t.key} value={t.key}>{t.key} | {t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap border-t pt-4">
            <button onClick={submit} className="flex items-center gap-2 px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-600 active:scale-95 transition-all text-sm shadow-md">
              <Save className="w-4 h-4" /> حفظ السجل المالي
            </button>
            <button onClick={() => setForm(emptyForm)} className="flex items-center gap-2 px-5 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm">
              <Eraser className="w-4 h-4" /> مسح الحقول
            </button>
          </div>
        </div>
      </div>

      {/* ========== الأشرطة الإحصائية المدمجة والتلقائية ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-xs text-slate-500 font-semibold">إجمالي الإيرادات (شامل الحوافظ الموردة ⚡)</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 font-mono">{fmt(totalIncome)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-xs text-slate-500 font-semibold">إجمالي المصروفات</span>
          <span className="text-xl font-bold text-rose-600 mt-1 font-mono">{fmt(totalExpense)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20 flex flex-col">
          <span className="text-xs text-emerald-700 font-semibold">الرصيد الكلي المتوفر حالياً</span>
          <span className="text-xl font-bold text-emerald-800 mt-1 font-mono">{fmt(currentBalance)}</span>
        </div>
      </div>

      {/* ========== جدول حركات السجل المدمج والمباشر ========== */}
      <div className="w-full bg-white shadow border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              📊 كشف سجل الحساب المدمج <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{combinedData.length}</span>
            </h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearFilters} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
              مسح التصفية
            </button>
            <TabActions
              title="كشف الحساب الجاري المدمج" rows={combinedData} columns={COLS} fileName="الحساب-الجاري-المدمج"
              numericKeys={["hafizaAmount","income","expense","balance"]} onClear={clearAccounts}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="p-2 text-center w-10">م</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-2 text-right whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleSort(c.key)}>
                      <div className="flex items-center gap-1">
                        {c.label} <span className="text-[10px] opacity-50">{sortIndicator(sortKey === c.key, sortDir)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-center">خيارات</th>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <th className="p-1"></th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-1">
                      <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="بحث..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:border-emerald-400 bg-white" />
                    </th>
                  ))}
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {filteredWithBalance.map((acc, index) => {
                  return (
                    <tr key={acc.id} className={`border-t border-slate-200 hover:bg-slate-50 transition-colors ${acc.isFromHafiza ? 'bg-amber-50/20' : ''}`}>
                      <td className="p-2 text-center text-slate-500 font-mono">{index + 1}</td>
                      
                      {COLS.map((col) => {
                        const isEditing = activeCell?.rowId === acc.id && activeCell?.colKey === col.key;
                        if (col.key === "balance") {
                          return <td key={col.key} className="p-2 font-mono font-bold text-blue-700 bg-blue-50/10">{fmt(acc.balance)}</td>;
                        }
                        return (
                          <td 
                            key={col.key}
                            onClick={() => handleCellClick(acc, col.key, acc[col.key])}
                            className={`p-2 transition-all border border-transparent cursor-pointer ${
                              col.key === 'income' ? 'font-mono font-bold text-emerald-600 bg-emerald-50/10' :
                              col.key === 'expense' ? 'font-mono font-bold text-rose-600 bg-rose-50/10' : 'text-slate-600'
                            }`}
                          >
                            {isEditing ? (
                              <input 
                                type={col.key === 'hafizaAmount' || col.key === 'income' || col.key === 'expense' ? 'number' : col.key === 'date' || col.key === 'notifyDate' || col.key === 'checkDate' ? 'date' : 'text'}
                                value={cellValue}
                                autoFocus
                                onChange={(e) => setCellValue(e.target.value)}
                                onBlur={() => handleCellSave(acc)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleCellSave(acc); if (e.key === 'Escape') setActiveCell(null); }}
                                className="p-0.5 border border-emerald-500 rounded outline-none bg-white text-slate-900 text-xs w-full"
                              />
                            ) : (
                              col.key === "hafizaAmount" || col.key === "income" || col.key === "expense"
                                ? (Number(acc[col.key]) > 0 ? fmt(Number(acc[col.key])) : "—")
                                : (acc[col.key] || "—")
                            )}
                          </td>
                        );
                      })}

                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => setEditingRow(acc)} className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors" title={acc.isFromHafiza ? "عرض ارتباط الحافظة" : "تعديل"}>
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => { 
                              if (acc.isFromHafiza) {
                                toast.error("لا يمكن حذف هذا السجل من هنا لأنه مسجل في الحوافظ؛ احذفه من تبويب الحوافظ ليختفي تلقائياً.");
                                return;
                              }
                              if (confirm("هل أنت متأكد من حذف هذا السجل المالي للحساب؟")) deleteAccount(acc.id); 
                            }} 
                            className={`p-1 rounded transition-colors ${acc.isFromHafiza ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white'}`}
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredWithBalance.length === 0 && (
                  <tr>
                    <td colSpan={16} className="p-8 text-center text-slate-400 bg-slate-50">
                      لا توجد سجلات مطابقة لخيارات التصفية الحالية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* النافذة المنبثقة للتعديل التقليدي الكامل */}
      <Modal title="✏️ تعديل السجل المالي للحساب" isOpen={!!editingRow} onClose={() => setEditingRow(null)}>
        {editingRow && (
          <form onSubmit={handleEditSave} className="space-y-4">
            {editingRow.isFromHafiza && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-semibold mb-2">
                ⚠️ تنبيه: هذا السجل مستورد تلقائياً وبشكل حي ومباشر من تبويب "حوافظ التوريد". أي تعديل عليه يجب أن يتم في شاشة الحوافظ ليظهر هنا.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">التاريخ</label>
                <input type="date" disabled={editingRow.isFromHafiza} value={editingRow.date} onChange={(e) => setEditingRow({...editingRow, date: e.target.value})} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الحافظة</label>
                <input disabled={editingRow.isFromHafiza} value={editingRow.hafizaNo} onChange={(e) => setEditingRow({...editingRow, hafizaNo: e.target.value})} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الإشعار</label>
                <input disabled={editingRow.isFromHafiza} value={editingRow.notifyNo} onChange={(e) => setEditingRow({...editingRow, notifyNo: e.target.value})} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ التوريد</label>
                <input type="date" disabled={editingRow.isFromHafiza} value={editingRow.notifyDate} onChange={(e) => setEditingRow({...editingRow, notifyDate: e.target.value})} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">البيان</label>
                <input disabled={editingRow.isFromHafiza} value={editingRow.description} onChange={(e) => setEditingRow({...editingRow, description: e.target.value})} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم</label>
                <input disabled={editingRow.isFromHafiza} value={editingRow.name} onChange={(e) => setEditingRow({...editingRow, name: e.target.value})} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الإيرادات</label>
                <input type="number" disabled={editingRow.isFromHafiza} value={editingRow.income} onChange={(e) => setEditingRow({...editingRow, income: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-emerald-600 bg-white disabled:bg-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المصروفات</label>
                <input type="number" disabled={editingRow.isFromHafiza} value={editingRow.expense} onChange={(e) => setEditingRow({...editingRow, expense: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-rose-600 bg-white disabled:bg-slate-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">إلغاء</button>
              {!editingRow.isFromHafiza && (
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md">حفظ التعديلات</button>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, v, on, type = "text", placeholder = "" }: { label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-emerald-500 bg-slate-50 transition-colors"
      />
    </div>
  );
}
