import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { accountsPdf } from "@/lib/exportPdf";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { Printer, X, Plus, Edit, Trash2, Save, Eraser, Wallet, ArrowDownToLine, ArrowUpFromLine, Landmark } from "lucide-react";

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

// مكون النافذة المنبثقة الموحد
const Modal = ({ title, isOpen, onClose, children }: { title: string; isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-blue-50 to-slate-50 sticky top-0 z-10">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
};

export default function AccountTab() {
  const { accounts, openingBalance, setOpeningBalance, deleteAccount, addAccount, updateAccount } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [editingRow, setEditingRow] = useState<any | null>(null);

  const { rows: filteredAccounts, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(accounts, COLS.map((c) => c.key));

  const submitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const inc = Number(entry.income) || 0;
    const exp = Number(entry.expense) || 0;
    
    if (!entry.description && !entry.name) {
      toast.error("يرجى إدخال البيان أو الاسم على الأقل");
      return;
    }

    addAccount({
      date: entry.date, hafizaNo: entry.hafizaNo, notifyNo: entry.notifyNo,
      notifyDate: entry.notifyDate, checkNo: entry.checkNo, checkDate: entry.checkDate,
      description: entry.description, specialty: entry.specialty, name: entry.name,
      hafizaAmount: Number(entry.hafizaAmount) || 0, income: inc, expense: exp,
    });
    toast.success("تم إضافة القيد بنجاح");
    setEntry(emptyEntry());
    setShowForm(false);
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
    toast.success("تم تعديل القيد بنجاح");
    setEditingRow(null);
  };

  const rows = useMemo(() => {
    let bal = openingBalance;
    return filteredAccounts.map((a) => {
      bal = bal + (Number(a.income) || 0) - (Number(a.expense) || 0);
      return { ...a, balance: bal };
    });
  }, [filteredAccounts, openingBalance]);

  const totalIn = accounts.reduce((s, a) => s + (Number(a.income) || 0), 0);
  const totalOut = accounts.reduce((s, a) => s + (Number(a.expense) || 0), 0);
  const finalBalance = openingBalance + totalIn - totalOut;

  return (
    <div className="w-full space-y-4 sm:space-y-6 p-0 text-sm sm:text-base" dir="rtl">
      
      {/* ========== الإحصائيات العلوية ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="الرصيد الافتتاحي" icon={<Wallet className="w-5 h-5 text-slate-500"/>} value={openingBalance} editable onChange={setOpeningBalance} className="bg-white border-slate-200 shadow-sm" />
        <Stat label="إجمالي الإيرادات" icon={<ArrowDownToLine className="w-5 h-5 text-emerald-500"/>} value={totalIn} className="bg-emerald-50 border-emerald-200 shadow-sm text-emerald-900" />
        <Stat label="إجمالي المصروفات" icon={<ArrowUpFromLine className="w-5 h-5 text-rose-500"/>} value={totalOut} className="bg-rose-50 border-rose-200 shadow-sm text-rose-900" />
        <Stat label="الرصيد النهائي (الحالي)" icon={<Landmark className="w-5 h-5 text-blue-500"/>} value={finalBalance} className="bg-blue-50 border-blue-200 shadow-sm text-blue-900" />
      </div>

      {/* ========== جدول الحساب ========== */}
      <div className="w-full bg-gradient-to-b from-blue-50 to-white shadow border border-blue-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-blue-700 to-blue-800 px-4 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">📑 حساب المجلس ({accounts.length})</h2>
            <p className="text-xs text-blue-100 mt-0.5">سجل الحركات المالية من إيرادات ومصروفات</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={clearFilters} className="px-3 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-white rounded-lg text-xs font-bold transition-colors border border-blue-500/30">
              مسح التصفية
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold shadow hover:bg-emerald-600 transition-colors">
              <Plus className="w-4 h-4" /> إضافة قيد خارجي
            </button>
            <button onClick={() => accountsPdf(accounts, openingBalance)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-xs font-bold shadow hover:bg-blue-50 transition-colors">
              <Printer className="w-4 h-4" /> طباعة / PDF
            </button>
            <div className="bg-white/10 rounded-lg p-0.5">
              <ImportButton kind="account" />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="p-2 text-center w-10">م</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-2 text-right whitespace-nowrap cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => toggleSort(c.key)}>
                      <div className="flex items-center gap-1">
                        {c.label} <span className="text-[10px] opacity-50">{sortIndicator(sortKey === c.key, sortDir)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-right">الرصيد</th>
                  <th className="p-2 text-center">إجراءات</th>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <th className="p-1"></th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-1">
                      <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="بحث..." className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded outline-none focus:border-blue-400 bg-white" />
                    </th>
                  ))}
                  <th className="p-1"></th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {/* صف الرصيد الافتتاحي المدور */}
                <tr className="border-t border-slate-200 bg-blue-50/50 font-bold text-slate-700">
                  <td className="p-2 text-center">1</td>
                  <td colSpan={8} className="p-2 text-center text-blue-800">رصيد افتتاحي مدور للعام 2025</td>
                  <td className="p-2 font-mono text-emerald-700">{fmt(openingBalance)}</td>
                  <td className="p-2 font-mono text-rose-700">0</td>
                  <td className="p-2 font-mono text-blue-700 bg-blue-100/30">{fmt(openingBalance)}</td>
                  <td></td>
                </tr>
                
                {/* الحركات المالية */}
                {rows.map((a, i) => (
                  <tr key={a.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-center text-slate-500 font-mono">{i + 2}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600">{a.date}</td>
                    <td className="p-2 font-mono text-slate-600">{a.hafizaNo}</td>
                    <td className="p-2 font-mono text-slate-600">{a.notifyNo}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600">{a.notifyDate}</td>
                    <td className="p-2 font-mono text-slate-600">{a.checkNo}</td>
                    <td className="p-2 text-slate-800 font-medium truncate max-w-[200px]" title={a.description}>{a.description}</td>
                    <td className="p-2 text-slate-600">{a.specialty}</td>
                    <td className="p-2 font-bold text-slate-900">{a.name}</td>
                    <td className="p-2 font-mono text-slate-600">{fmt(a.hafizaAmount)}</td>
                    <td className="p-2 font-mono font-bold text-emerald-600 bg-emerald-50/30">{fmt(a.income)}</td>
                    <td className="p-2 font-mono font-bold text-rose-600 bg-rose-50/30">{fmt(a.expense)}</td>
                    <td className="p-2 font-mono font-bold text-blue-700 bg-blue-50/30">{fmt(a.balance)}</td>
                    <td className="p-2 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => setEditingRow(a)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-500 hover:text-white transition-colors" title="تعديل">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm("هل أنت متأكد من حذف هذا القيد؟")) deleteAccount(a.id); }} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-500 hover:text-white transition-colors" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400 bg-slate-50 font-medium">
                      لا توجد حركات مالية مسجلة بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== نافذة إضافة قيد خارجي ========== */}
      <Modal title="➕ إضافة قيد خارجي جديد" isOpen={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={submitEntry} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormField label="التاريخ *" type="date" v={entry.date} on={(v) => setEntry({ ...entry, date: v })} />
            <FormField label="رقم الحافظة" v={entry.hafizaNo} on={(v) => setEntry({ ...entry, hafizaNo: v })} />
            <FormField label="رقم الاشعار" v={entry.notifyNo} on={(v) => setEntry({ ...entry, notifyNo: v })} />
            <FormField label="تاريخ التوريد" type="date" v={entry.notifyDate} on={(v) => setEntry({ ...entry, notifyDate: v })} />
            
            <FormField label="رقم الشيك" v={entry.checkNo} on={(v) => setEntry({ ...entry, checkNo: v })} />
            <FormField label="تاريخ الشيك" type="date" v={entry.checkDate} on={(v) => setEntry({ ...entry, checkDate: v })} />
            <FormField label="التخصص" v={entry.specialty} on={(v) => setEntry({ ...entry, specialty: v })} />
            <FormField label="الاسم" v={entry.name} on={(v) => setEntry({ ...entry, name: v })} />
            
            <div className="sm:col-span-2 lg:col-span-4">
              <FormField label="البيان *" v={entry.description} on={(v) => setEntry({ ...entry, description: v })} />
            </div>
            
            <FormField label="مبلغ الحافظة" type="number" v={entry.hafizaAmount} on={(v) => setEntry({ ...entry, hafizaAmount: v })} />
            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
              <FormField label="الإيرادات (مقبوضات)" type="number" v={entry.income} on={(v) => setEntry({ ...entry, income: v })} />
            </div>
            <div className="bg-rose-50 p-2 rounded-lg border border-rose-100">
              <FormField label="المصروفات (مدفوعات)" type="number" v={entry.expense} on={(v) => setEntry({ ...entry, expense: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <button type="button" onClick={() => setEntry(emptyEntry())} className="flex items-center gap-2 px-5 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm">
              <Eraser className="w-4 h-4" /> مسح
            </button>
            <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-sm shadow-md">
              <Save className="w-4 h-4" /> حفظ القيد
            </button>
          </div>
        </form>
      </Modal>

      {/* ========== نافذة تعديل قيد ========== */}
      <Modal title="✏️ تعديل قيد الحساب" isOpen={!!editingRow} onClose={() => setEditingRow(null)}>
        {editingRow && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField label="التاريخ *" type="date" v={editingRow.date} on={(v) => setEditingRow({ ...editingRow, date: v })} />
              <FormField label="رقم الحافظة" v={editingRow.hafizaNo} on={(v) => setEditingRow({ ...editingRow, hafizaNo: v })} />
              <FormField label="رقم الاشعار" v={editingRow.notifyNo} on={(v) => setEditingRow({ ...editingRow, notifyNo: v })} />
              <FormField label="تاريخ التوريد" type="date" v={editingRow.notifyDate} on={(v) => setEditingRow({ ...editingRow, notifyDate: v })} />
              
              <FormField label="رقم الشيك" v={editingRow.checkNo} on={(v) => setEditingRow({ ...editingRow, checkNo: v })} />
              <FormField label="تاريخ الشيك" type="date" v={editingRow.checkDate} on={(v) => setEditingRow({ ...editingRow, checkDate: v })} />
              <FormField label="التخصص" v={editingRow.specialty} on={(v) => setEditingRow({ ...editingRow, specialty: v })} />
              <FormField label="الاسم" v={editingRow.name} on={(v) => setEditingRow({ ...editingRow, name: v })} />
              
              <div className="sm:col-span-2 lg:col-span-4">
                <FormField label="البيان *" v={editingRow.description} on={(v) => setEditingRow({ ...editingRow, description: v })} />
              </div>
              
              <FormField label="مبلغ الحافظة" type="number" v={editingRow.hafizaAmount} on={(v) => setEditingRow({ ...editingRow, hafizaAmount: v })} />
              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                <FormField label="الإيرادات" type="number" v={editingRow.income} on={(v) => setEditingRow({ ...editingRow, income: v })} />
              </div>
              <div className="bg-rose-50 p-2 rounded-lg border border-rose-100">
                <FormField label="المصروفات" type="number" v={editingRow.expense} on={(v) => setEditingRow({ ...editingRow, expense: v })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">إلغاء</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md">حفظ التعديلات</button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}

// مكون فرعي لعرض الإحصائيات (محدث)
function Stat({ label, value, className = "", editable, onChange, icon }: { label: string; value: number; className?: string; editable?: boolean; onChange?: (n: number) => void, icon?: React.ReactNode }) {
  return (
    <div className={`border rounded-xl p-3 sm:p-4 flex flex-col justify-between h-full ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="text-xs sm:text-sm font-bold opacity-80">{label}</div>
      </div>
      {editable ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value) || 0)}
          className="text-lg sm:text-xl font-bold font-mono w-full bg-slate-100/50 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all border border-transparent"
        />
      ) : (
        <div className="text-lg sm:text-xl font-bold font-mono px-2 py-1">{fmt(value)}</div>
      )}
    </div>
  );
}

// مكون فرعي لتقليل تكرار كود الحقول
function FormField({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white transition-colors"
      />
    </div>
  );
}
