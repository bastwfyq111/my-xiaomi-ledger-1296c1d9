import React, { useMemo, useState } from "react";
import { useStore, type Account } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { Printer, X, Plus, Edit, Trash2, Search, Save, Eraser, FileSpreadsheet } from "lucide-react";

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
  { key: "balance", label: "الرصيد" }, // عمود الرصيد كما في الملف المرفق
];

type FormType = {
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

const emptyForm: FormType = {
  date: today(), hafizaNo: "", notifyNo: "", notifyDate: "",
  checkNo: "", checkDate: "", description: "", specialty: "",
  name: "", hafizaAmount: "", income: "", expense: ""
};

// ==========================================
// 2. دالة تنظيف المبالغ المستوردة من الإكسل
// ==========================================
const parseAmount = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  const cleanString = String(val).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleanString);
  return isNaN(parsed) ? 0 : parsed;
};

// ==========================================
// 3. مكون النافذة المنبثقة (Modal)
// ==========================================
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

// ==========================================
// 4. المكون الرئيسي (AccountsTab)
// ==========================================
export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount, clearAccounts } = useStore();
  const [form, setForm] = useState<FormType>(emptyForm);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(accounts, COLS.map((c) => c.key));

  // حساب الإجماليات للأشرطة العلوية
  const totalIncome = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.income) || 0), 0), [accounts]);
  const totalExpense = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.expense) || 0), 0), [accounts]);
  const currentBalance = totalIncome - totalExpense;

  // 💡 حساب مصفوفة تحتوي على الرصيد التراكمي لكل صف بناءً على الترتيب الحالي المعروض
  const filteredWithBalance = useMemo(() => {
    let runningBalance = 0;
    // إذا كان هناك رصيد افتتاحي في الحسابات، سيتم مراعاته تلقائياً من خلال قيود الإيراد والمصروف
    return filtered.map((row) => {
      const inc = Number(row.income) || 0;
      const exp = Number(row.expense) || 0;
      runningBalance = runningBalance + inc - exp;
      return {
        ...row,
        balance: runningBalance
      };
    });
  }, [filtered]);

  const submit = () => {
    // السماح بحفظ الحركة بدون اسم إذا كان بياناً عاماً (مثل الرصيد الافتتاحي أو المصروفات العمومية بالملف)
    if (!form.description && !form.name) {
      toast.error("يرجى إدخال الاسم أو البيان على الأقل");
      return;
    }

    addAccount({
      date: form.date,
      hafizaNo: form.hafizaNo,
      notifyNo: form.notifyNo,
      notifyDate: form.notifyDate,
      checkNo: form.checkNo,
      checkDate: form.checkDate,
      description: form.description,
      specialty: form.specialty,
      name: form.name,
      hafizaAmount: Number(form.hafizaAmount) || 0,
      income: Number(form.income) || 0,
      expense: Number(form.expense) || 0,
    });

    toast.success("تم إضافة السجل المالي للحساب بنجاح");
    setForm(emptyForm);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    
    updateAccount(editingRow.id, {
      ...editingRow,
      hafizaAmount: Number(editingRow.hafizaAmount) || 0,
      income: Number(editingRow.income) || 0,
      expense: Number(editingRow.expense) || 0,
    });
    
    toast.success("تم تعديل السجل بنجاح");
    setEditingRow(null);
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

        if (json.length === 0) throw new Error("الملف فارغ أو لا يحتوي على بيانات");

        const importedAccounts = json
          .map((row: any) => {
            const cleanRow: any = {};
            for (const key in row) {
              cleanRow[key.trim()] = row[key];
            }
            return cleanRow;
          })
          // الفلترة بناء على وجود بيان أو اسم (لأن السجلات الأولى بالملف قد لا تحتوي على اسم بل بيان فقط)
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
          }));

        if (importedAccounts.length === 0) {
          toast.error("لم يتم العثور على بيانات متوافقة. تأكد من مطابقة أسماء الأعمدة.");
          return;
        }

        useStore.getState().importData({ accounts: importedAccounts });
        toast.success(`تم استيراد ${importedAccounts.length} سجل مالي بنجاح`);
      } catch (err) {
        console.error("Error reading excel:", err);
        toast.error("فشل الاستيراد. تأكد من صحة تنسيق ملف الإكسل ومطابقة الأعمدة.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleClearAllData = () => {
    if (accounts.length === 0) {
      toast.info("لا توجد بيانات لمسحها");
      return;
    }
    const confirmDelete = window.confirm("⚠️ تحذير: هل أنت متأكد من رغبتك في مسح جميع السجلات المالية بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.");
    if (confirmDelete) {
      if (clearAccounts) {
        clearAccounts();
        toast.success("تم مسح جميع السجلات المالية بنجاح");
      } else {
        toast.error("عذراً، دالة مسح البيانات غير معرفة في الـ Store.");
      }
    }
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

      {/* ========== الإحصائيات ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-xs text-slate-500 font-semibold">إجمالي الإيرادات</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 font-mono">{fmt(totalIncome)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-xs text-slate-500 font-semibold">إجمالي المصروفات</span>
          <span className="text-xl font-bold text-rose-600 mt-1 font-mono">{fmt(totalExpense)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20 flex flex-col">
          <span className="text-xs text-emerald-700 font-semibold">الرصيد الحالي المتوفر</span>
          <span className="text-xl font-bold text-emerald-800 mt-1 font-mono">{fmt(currentBalance)}</span>
        </div>
      </div>

      {/* ========== جدول حركات السجل ========== */}
      <div className="w-full bg-white shadow border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">📊 كشف سجل الحساب ({accounts.length})</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearFilters} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
              مسح التصفية
            </button>
            {accounts.length > 0 && (
              <button 
                onClick={handleClearAllData} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors border border-rose-500 shadow-sm"
              >
                <Trash2 className="w-4 h-4" /> مسح كافة البيانات
              </button>
            )}
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
                {filteredWithBalance.map((acc, index) => (
                  <tr key={acc.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-center text-slate-500 font-mono">{index + 1}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600 font-mono">{acc.date}</td>
                    <td className="p-2 font-mono text-slate-600">{acc.hafizaNo || "—"}</td>
                    <td className="p-2 font-mono text-slate-600">{acc.notifyNo || "—"}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600 font-mono">{acc.notifyDate || "—"}</td>
                    <td className="p-2 font-mono text-slate-600">{acc.checkNo || "—"}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600 font-mono">{acc.checkDate || "—"}</td>
                    <td className="p-2 text-slate-700 truncate max-w-[180px]" title={acc.description}>{acc.description || "—"}</td>
                    <td className="p-2 text-slate-600">{acc.specialty || "—"}</td>
                    <td className="p-2 font-bold text-slate-900">{acc.name || "—"}</td>
                    
                    <td className="p-2 font-mono text-slate-600">
                      {Number(acc.hafizaAmount) > 0 ? fmt(Number(acc.hafizaAmount)) : "—"}
                    </td>
                    <td className="p-2 font-mono font-bold text-emerald-600 bg-emerald-50/20">
                      {Number(acc.income) > 0 ? fmt(Number(acc.income)) : "—"}
                    </td>
                    <td className="p-2 font-mono font-bold text-rose-600 bg-rose-50/20">
                      {Number(acc.expense) > 0 ? fmt(Number(acc.expense)) : "—"}
                    </td>
                    {/* عمود الرصيد التراكمي الذكي المحسوب ديناميكياً لكل صف */}
                    <td className="p-2 font-mono font-bold text-blue-700 bg-blue-50/10">
                      {fmt(acc.balance)}
                    </td>

                    <td className="p-2 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => setEditingRow(acc)} className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-600 hover:text-white transition-colors" title="تعديل">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm("هل أنت متأكد من حذف هذا السجل المالي للحساب؟")) deleteAccount(acc.id); }} className="p-1 bg-rose-50 text-rose-600 rounded hover:bg-rose-500 hover:text-white transition-colors" title="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredWithBalance.length === 0 && (
                  <tr>
                    <td colSpan={15} className="p-8 text-center text-slate-400 bg-slate-50">
                      لا توجد سجلات مطابقة لخيارات التصفية الحالية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal title="✏️ تعديل السجل المالي للحساب" isOpen={!!editingRow} onClose={() => setEditingRow(null)}>
        {editingRow && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">التاريخ</label>
                <input type="date" value={editingRow.date} onChange={(e) => setEditingRow({...editingRow, date: e.target.value})} className="w-full p-2 border rounded-lg outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الحافظة</label>
                <input value={editingRow.hafizaNo} onChange={(e) => setEditingRow({...editingRow, hafizaNo: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الإشعار</label>
                <input value={editingRow.notifyNo} onChange={(e) => setEditingRow({...editingRow, notifyNo: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ التوريد</label>
                <input type="date" value={editingRow.notifyDate} onChange={(e) => setEditingRow({...editingRow, notifyDate: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الشيك</label>
                <input value={editingRow.checkNo || ""} onChange={(e) => setEditingRow({...editingRow, checkNo: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الشيك</label>
                <input type="date" value={editingRow.checkDate || ""} onChange={(e) => setEditingRow({...editingRow, checkDate: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">البيان</label>
                <input value={editingRow.description} onChange={(e) => setEditingRow({...editingRow, description: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">التخصص</label>
                <input value={editingRow.specialty} onChange={(e) => setEditingRow({...editingRow, specialty: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم</label>
                <input value={editingRow.name} onChange={(e) => setEditingRow({...editingRow, name: e.target.value})} className="w-full p-2 border rounded-lg bg-slate-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">مبلغ الحافظة</label>
                <input type="number" value={editingRow.hafizaAmount} onChange={(e) => setEditingRow({...editingRow, hafizaAmount: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الإيرادات</label>
                <input type="number" value={editingRow.income} onChange={(e) => setEditingRow({...editingRow, income: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-emerald-600 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المصروفات</label>
                <input type="number" value={editingRow.expense} onChange={(e) => setEditingRow({...editingRow, expense: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-rose-600 outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">إلغاء</button>
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-md">حفظ التعديلات</button>
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
