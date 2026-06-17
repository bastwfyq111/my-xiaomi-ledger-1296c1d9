import React, { useMemo, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import {
  X, Plus, Edit, Trash2, Save, Eraser,
  FileSpreadsheet, Link, RefreshCw, Calendar,
  Hash, FileText, User, ArrowUpRight, ArrowDownLeft, Wallet
} from "lucide-react";
import TabActions from "./TabActions";
import schema from "@/data/revenueTemplate.json";

// --- Types ---
type FormType = {
  date: string; hafizaNo: string; notifyNo: string; notifyDate: string;
  checkNo: string; checkDate: string; description: string; specialty: string;
  name: string; hafizaAmount: string; income: string; expense: string; revenueKey: string;
};

type AccountRow = {
  id: string;
  date: string;
  hafizaNo: string;
  notifyNo: string;
  notifyDate: string;
  checkNo: string;
  checkDate: string;
  description: string;
  specialty: string;
  name: string;
  hafizaAmount: number;
  income: number;
  expense: number;
  revenueKey?: string;
  balance: number;
  sourceHafizaId?: string;
};

// --- Constants ---
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

const emptyForm: FormType = {
  date: today(), hafizaNo: "", notifyNo: "", notifyDate: "",
  checkNo: "", checkDate: "", description: "", specialty: "",
  name: "", hafizaAmount: "", income: "", expense: "", revenueKey: ""
};

// --- Helper Components ---
const Modal = ({ title, isOpen, onClose, children }: { title: string; isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 border border-slate-100">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-slate-50 to-white sticky top-0 z-10">
          <h3 className="font-bold text-base sm:text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

function Field({ label, v, on, type = "text", placeholder = "", icon, className = "" }: { label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-slate-600 mb-1.5 mr-1">{label}</label>
      <div className="relative flex items-center">
        {icon && <span className="absolute right-3 z-10">{icon}</span>}
        <input 
          type={type} 
          value={v} 
          onChange={(e) => on(e.target.value)} 
          placeholder={placeholder} 
          className={`w-full ${icon ? "pr-9" : "px-3"} pl-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-[#10528e] bg-white text-slate-800 font-medium shadow-sm ${className}`} 
        />
      </div>
    </div>
  );
}

// --- Main Component ---
export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount, clearAccounts, hafiza = [] } = useStore();
  const [form, setForm] = useState<FormType>(emptyForm);
  const [editingRow, setEditingRow] = useState<AccountRow | null>(null);

  // 1. Logic: Calculate Running Balance based on ALL accounts (Correct Accounting Approach)
  const accountsWithBalance = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => {
      const dA = a.date ? String(a.date).replace(/[^\d]/g, "") : "";
      const dB = b.date ? String(b.date).replace(/[^\d]/g, "") : "";
      return dA.localeCompare(dB);
    });

    let running = 0;
    return sorted.map(acc => {
      running += (Number(acc.income) || 0) - (Number(acc.expense) || 0);
      return { ...acc, balance: running };
    });
  }, [accounts]);

  // 2. Logic: Table Controls (Filtering/Sorting)
  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(accountsWithBalance, COLS.map((c) => c.key));

  // 3. Logic: Sync from Hafiza
  const handleSyncFromHafiza = useCallback(() => {
    if (!hafiza || hafiza.length === 0) {
      toast.error("لا توجد بيانات في تبويب حوافظ التوريد!");
      return;
    }

    const normalize = (v: any) => String(v ?? "").trim();
    const cleanDate = (d: string) => d.replace(/[^\d]/g, "");

    let added = 0, updated = 0, skipped = 0;

    // Filter 2026 only
    const hafiza2026 = hafiza.filter((h: any) => cleanDate(h.date).startsWith("2026"));

    if (hafiza2026.length === 0) {
      toast.info("لا توجد حوافظ لعام 2026.");
      return;
    }

    hafiza2026.forEach((hRow: any) => {
      const hid = normalize(hRow.id);
      const hNo = normalize(hRow.hafizaNo);
      
      // Find existing by ID or HafizaNo
      const existing = accounts.find(a => a.id === hid || a.hafizaNo === hNo);

      const mappedData = {
        date: hRow.date || today(),
        hafizaNo: hNo,
        notifyNo: normalize(hRow.notifyNo),
        notifyDate: hRow.notifyDate || "",
        description: normalize(hRow.description),
        specialty: normalize(hRow.specialty),
        name: normalize(hRow.name),
        hafizaAmount: Number(hRow.hafizaAmount || hRow.amount || 0),
        income: Number(hRow.notifyAmount || hRow.supplyAmount || hRow.tawreedAmount || 0),
        expense: 0,
        sourceHafizaId: hid,
      };

      if (!existing) {
        addAccount({ ...mappedData, checkNo: "", checkDate: "", revenueKey: undefined });
        added++;
      } else {
        // Check if anything changed
        const hasDiff = 
          normalize(existing.description) !== mappedData.description ||
          Number(existing.income) !== mappedData.income ||
          normalize(existing.hafizaNo) !== mappedData.hafizaNo;

        if (hasDiff) {
          updateAccount(existing.id, { ...existing, ...mappedData });
          updated++;
        } else {
          skipped++;
        }
      }
    });

    toast.success(`تمت العملية: +${added} | ~${updated} | =${skipped}`);
  }, [hafiza, accounts, addAccount, updateAccount]);

  // 4. Logic: Import Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        
        const imported = json.map((row: any) => ({
          date: row["التاريخ"] || row["date"] || today(),
          hafizaNo: String(row["رقم الحافظة"] || ""),
          notifyNo: String(row["رقم الإشعار"] || ""),
          notifyDate: row["تاريخ التوريد"] || "",
          description: row["البيان"] || "",
          specialty: row["التخصص"] || "",
          name: row["الاسم"] || "",
          hafizaAmount: Number(row["مبلغ الحافظة"]) || 0,
          income: Number(row["الإيرادات"]) || 0,
          expense: Number(row["المصروفات"]) || 0,
          revenueKey: String(row["رمز الإيراد"] || ""),
        }));

        useStore.getState().importData({ accounts: imported });
        toast.success(`تم استيراد ${imported.length} سجل`);
      } catch (err) {
        toast.error("خطأ في الملف");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 5. Helpers for Summary
  const totalIncome = accounts.reduce((s, a) => s + (Number(a.income) || 0), 0);
  const totalExpense = accounts.reduce((s, a) => s + (Number(a.expense) || 0), 0);
  const currentBalance = totalIncome - totalExpense;

  const revenueTypes = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if (schema?.chapters) {
      schema.chapters.forEach((ch: any) =>
        ch.sections.forEach((sec: any) =>
          sec.items.forEach((it: any) =>
            it.types.forEach((t: any) =>
              list.push({ key: `${ch.no}-${sec.no}-${it.no}-${t.no}`, label: `${ch.title} ← ${t.title}` })
            )
          )
        )
      );
    }
    return list;
  }, []);

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SummaryCard label="إجمالي الإيرادات" value={fmt(totalIncome)} color="text-emerald-600" bg="bg-emerald-50" icon={<ArrowUpRight className="w-6 h-6" />} />
        <SummaryCard label="إجمالي المصروفات" value={fmt(totalExpense)} color="text-rose-600" bg="bg-rose-50" icon={<ArrowDownLeft className="w-6 h-6" />} />
        <div className="bg-gradient-to-br from-[#10528e] to-[#0b3d6d] p-5 rounded-2xl text-white shadow-md flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-white/70 font-bold">الرصيد الحالي المتوفر</span>
            <span className="text-2xl font-black mt-2 font-mono">{fmt(currentBalance)}</span>
          </div>
          <div className="p-3.5 bg-white/10 rounded-2xl text-amber-400"><Wallet className="w-6 h-6" /></div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="w-full bg-white shadow-sm border border-slate-100 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#10528e] to-[#0f467a] px-5 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2.5 text-white">
            <Plus className="w-4 h-4" />
            <h2 className="text-sm font-bold">إضافة حركة مالية</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSyncFromHafiza} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> <span>مطابقة 2026 ⚡</span>
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
              <FileSpreadsheet className="w-3.5 h-3.5" /> <span>Excel</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50/40">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
            <Field label="التاريخ" type="date" v={form.date} on={(v) => setForm({...form, date: v})} icon={<Calendar className="w-4 h-4 text-slate-400"/>} />
            <Field label="رقم الحافظة" v={form.hafizaNo} on={(v) => setForm({...form, hafizaNo: v})} icon={<Hash className="w-4 h-4 text-slate-400"/>} />
            <Field label="الاسم" v={form.name} on={(v) => setForm({...form, name: v})} icon={<User className="w-4 h-4 text-slate-400"/>} />
            <Field label="الإيرادات" type="number" v={form.income} on={(v) => setForm({...form, income: v})} icon={<span className="text-xs text-emerald-500 font-bold">ر.ي</span>} className="text-emerald-600 font-bold" />
            <Field label="المصروفات" type="number" v={form.expense} on={(v) => setForm({...form, expense: v})} icon={<span className="text-xs text-rose-500 font-bold">ر.ي</span>} className="text-rose-600 font-bold" />
            
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#10528e] mb-1.5">ربط الإيراد</label>
              <select value={form.revenueKey} onChange={(e) => setForm({...form, revenueKey: e.target.value})} className="w-full px-3 py-2 text-sm border border-blue-100 rounded-xl bg-blue-50/20">
                <option value="">-- بدون ربط --</option>
                {revenueTypes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 flex gap-2">
              <button onClick={() => {
                addAccount({ ...form, hafizaAmount: Number(form.hafizaAmount) || 0, income: Number(form.income) || 0, expense: Number(form.expense) || 0 });
                setForm(emptyForm);
                toast.success("تم الحفظ");
              }} className="flex-1 py-2 bg-[#10528e] text-white rounded-xl font-bold text-xs">حفظ</button>
              <button onClick={() => setForm(emptyForm)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs">مسح</button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="w-full bg-white shadow-sm border border-black rounded-xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-3 flex justify-between items-center">
          <h2 className="text-sm font-bold text-white">جدول الحساب الجاري ({accounts.length})</h2>
          <div className="flex gap-2">
             {Object.values(filters).some(Boolean) && (
               <button onClick={clearFilters} className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs">مسح الفلاتر</button>
             )}
             <TabActions title="كشف الحساب" rows={accounts} columns={COLS} fileName="كشف-حساب" numericKeys={["hafizaAmount","income","expense","balance"]} onClear={clearAccounts} />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-right border-collapse border border-black">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr>
                <th className="p-2 border border-black text-center w-10">م</th>
                {COLS.map(c => (
                  <th key={c.key} className="p-2 border border-black cursor-pointer hover:bg-slate-200" onClick={() => toggleSort(c.key)}>
                    <div className="flex items-center justify-center gap-1">
                      {c.label} {sortIndicator(sortKey === c.key, sortDir)}
                    </div>
                  </th>
                ))}
                <th className="p-2 border border-black text-center">إجراءات</th>
              </tr>
              <tr className="bg-slate-50">
                <th className="border border-black"></th>
                {COLS.map(c => (
                  <th key={c.key} className="p-1 border border-black">
                    <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)} className="w-full p-1 border rounded text-[10px]" placeholder="تصفية..." />
                  </th>
                ))}
                <th className="border border-black"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={COLS.length + 2} className="p-10 text-center">لا توجد بيانات</td></tr>
              ) : (
                filtered.map((acc, idx) => (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="p-2 border border-black text-center">{idx + 1}</td>
                    <td className="p-2 border border-black text-center font-mono">{acc.date}</td>
                    <td className="p-2 border border-black font-bold">{acc.hafizaNo}</td>
                    <td className="p-2 border border-black">{acc.notifyNo}</td>
                    <td className="p-2 border border-black">{acc.notifyDate}</td>
                    <td className="p-2 border border-black">{acc.checkNo}</td>
                    <td className="p-2 border border-black">{acc.checkDate}</td>
                    <td className="p-2 border border-black">{acc.description}</td>
                    <td className="p-2 border border-black">{acc.specialty}</td>
                    <td className="p-2 border border-black font-bold">{acc.name}</td>
                    <td className="p-2 border border-black text-center font-mono">{fmt(acc.hafizaAmount)}</td>
                    <td className="p-2 border border-black text-center font-bold text-emerald-700 bg-emerald-50/30">{fmt(acc.income)}</td>
                    <td className="p-2 border border-black text-center font-bold text-rose-700 bg-rose-50/30">{fmt(acc.expense)}</td>
                    <td className="p-2 border border-black text-center">
                       <select 
                        value={acc.revenueKey || ""} 
                        onChange={(e) => updateAccount(acc.id, { ...acc, revenueKey: e.target.value || undefined })}
                        className="text-[10px] border rounded p-1"
                       >
                         <option value="">--</option>
                         {revenueTypes.map(t => <option key={t.key} value={t.key}>{t.key}</option>)}
                       </select>
                    </td>
                    <td className="p-2 border border-black text-center font-black text-[#10528e] bg-blue-50/30">{fmt(acc.balance)}</td>
                    <td className="p-2 border border-black text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setEditingRow(acc)} className="text-emerald-600"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => { if(confirm("حذف؟")) deleteAccount(acc.id) }} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal title="✏️ تعديل السجل" isOpen={!!editingRow} onClose={() => setEditingRow(null)}>
        {editingRow && (
          <form onSubmit={(e) => {
            e.preventDefault();
            updateAccount(editingRow.id, {
              ...editingRow,
              hafizaAmount: Number(editingRow.hafizaAmount),
              income: Number(editingRow.income),
              expense: Number(editingRow.expense)
            });
            setEditingRow(null);
            toast.success("تم التعديل");
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="التاريخ" type="date" v={editingRow.date} on={(v) => setEditingRow({...editingRow, date: v})} />
              <Field label="الاسم" v={editingRow.name} on={(v) => setEditingRow({...editingRow, name: v})} />
              <Field label="الإيرادات" type="number" v={String(editingRow.income)} on={(v) => setEditingRow({...editingRow, income: Number(v)})} />
              <Field label="المصروفات" type="number" v={String(editingRow.expense)} on={(v) => setEditingRow({...editingRow, expense: Number(v)})} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 bg-slate-200 rounded-xl">إلغاء</button>
              <button type="submit" className="px-4 py-2 bg-[#10528e] text-white rounded-xl font-bold">حفظ</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// --- Sub-Component ---
function SummaryCard({ label, value, color, bg, icon }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-xs text-slate-400 font-bold">{label}</span>
        <span className={`text-2xl font-black mt-2 font-mono ${color}`}>{value}</span>
      </div>
      <div className={`p-3.5 ${bg} ${color} rounded-2xl`}>{icon}</div>
    </div>
  );
}
