import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { 
  Printer, X, Plus, Edit, Trash2, Save, Eraser, 
  FileSpreadsheet, Link, RefreshCw, Calendar, 
  Hash, FileText, User, ArrowUpRight, ArrowDownLeft, Wallet
} from "lucide-react";
import TabActions from "./TabActions";
import schema from "@/data/revenueTemplate.json";

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 border border-slate-100">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-slate-50 to-white sticky top-0 z-10">
          <h3 className="font-bold text-base sm:text-lg text-slate-800 flex items-center gap-2">
            <span>{title}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount, clearAccounts, hafizas = [] } = useStore();
  const [form, setForm] = useState<FormType>(emptyForm);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  // دالة المطابقة الذكية والتطهير لعام 2026
  const handleSyncFromHafiza = () => {
    if (!hafizas || hafizas.length === 0) {
      toast.error("لا توجد بيانات في تبويب حوافظ التوريد لجلبها!");
      return;
    }

    const cleanDate = (dateStr: string) => {
      if (!dateStr) return "";
      return String(dateStr).replace(/[^\d]/g, ""); 
    };

    const hafiza2026 = hafizas.filter((h: any) => {
      const cleaned = cleanDate(h?.date);
      return cleaned.substring(0, 4) === "2026";
    });

    if (hafiza2026.length === 0) {
      toast.info("لا توجد حوافظ تعود للعام 2026 لمزامنتها.");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    const byHafizaId = new Map<string, any>();
    const byHafizaNo = new Map<string, any>();
    
    accounts.forEach((acc: any) => {
      if (acc.sourceHafizaId) byHafizaId.set(String(acc.sourceHafizaId), acc);
      if (acc.hafizaNo) byHafizaNo.set(String(acc.hafizaNo), acc);
    });

    const activeHafizaIds = new Set(hafiza2026.map((h: any) => String(h.id)));
    
    accounts.forEach((acc: any) => {
      if (acc.sourceHafizaId && !activeHafizaIds.has(String(acc.sourceHafizaId))) {
        deleteAccount(acc.id);
        deletedCount++;
      }
    });

    hafiza2026.forEach((hafiza: any) => {
      if (!hafiza?.id) return; 

      const supplyAmount = Number(hafiza.hafizaAmount || hafiza.amount || hafiza.income || 0);

      const existing =
        byHafizaId.get(String(hafiza.id)) ||
        (hafiza.hafizaNo ? byHafizaNo.get(String(hafiza.hafizaNo)) : undefined);

      if (!existing) {
        addAccount({
          date: hafiza.date || today(),
          hafizaNo: hafiza.hafizaNo || "",
          notifyNo: hafiza.notifyNo || "",
          notifyDate: hafiza.notifyDate || "",
          checkNo: hafiza.checkNo || "",
          checkDate: hafiza.checkDate || "",
          description: String(hafiza.description || "").trim(),
          specialty: hafiza.specialty || "",
          name: hafiza.name || "",
          hafizaAmount: supplyAmount, 
          income: supplyAmount, 
          expense: 0,
          revenueKey: undefined, 
          sourceHafizaId: hafiza.id,
        });
        addedCount++;
        return;
      }

      const isDateChanged = cleanDate(existing.date) !== cleanDate(hafiza.date);
      const isNotifyDateChanged = cleanDate(existing.notifyDate) !== cleanDate(hafiza.notifyDate);
      const isCheckDateChanged = cleanDate(existing.checkDate) !== cleanDate(hafiza.checkDate);

      const isChanged =
        isDateChanged ||
        isNotifyDateChanged ||
        isCheckDateChanged ||
        existing.hafizaNo !== (hafiza.hafizaNo || existing.hafizaNo) ||
        existing.notifyNo !== (hafiza.notifyNo || existing.notifyNo) ||
        existing.checkNo !== (hafiza.checkNo || existing.checkNo) ||
        existing.description !== String(hafiza.description || existing.description || "").trim() ||
        existing.specialty !== (hafiza.specialty || existing.specialty) ||
        existing.name !== (hafiza.name || existing.name) ||
        Number(existing.income) !== supplyAmount;

      if (isChanged) {
        updateAccount(existing.id, {
          ...existing, 
          date: hafiza.date || existing.date,
          hafizaNo: hafiza.hafizaNo || existing.hafizaNo,
          notifyNo: hafiza.notifyNo || existing.notifyNo,
          notifyDate: hafiza.notifyDate || existing.notifyDate,
          checkNo: hafiza.checkNo || existing.checkNo,
          checkDate: hafiza.checkDate || existing.checkDate,
          description: String(hafiza.description || "").trim(),
          specialty: hafiza.specialty || existing.specialty,
          name: hafiza.name || existing.name,
          hafizaAmount: supplyAmount,
          income: supplyAmount, 
          sourceHafizaId: hafiza.id,
        });
        updatedCount++;
      }
    });

    if (addedCount > 0 || updatedCount > 0 || deletedCount > 0) {
      toast.success(
        `اكتملت المطابقة لعام 2026: إضافة (${addedCount})، تحديث (${updatedCount})، وحذف وتطهير (${deletedCount}) سجلات قديمة.`
      );
    } else {
      toast.info("تطابق تام وموزون! لا توجد فروقات مالية أو قيود معلقة.");
    }
  };

  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(accounts, COLS.map((c) => c.key));

  const revenueTypes = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if(schema && schema.chapters) {
      schema.chapters.forEach((ch: any) =>
        ch.sections.forEach((sec: any) =>
          sec.items.forEach((it: any) =>
            it.types.forEach((t: any) => {
              list.push({ key: `${ch.no}-${sec.no}-${it.no}-${t.no}`, label: `${ch.title} ← ${t.title}` });
            })
          )
        )
      );
    }
    return list;
  }, []);

  const totalIncome = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.income) || 0), 0), [accounts]);
  const totalExpense = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.expense) || 0), 0), [accounts]);
  const currentBalance = totalIncome - totalExpense;

  // احتساب الرصيد التراكمي الموزون محاسبياً حسب الأرشيف الكامل
  const filteredWithBalance = useMemo(() => {
    const sortedAccounts = [...accounts].sort((a, b) => new Set([a.date]).has(b.date) ? 0 : a.date > b.date ? 1 : -1);
    
    const balanceMap = new Map<string, number>();
    let runningBalance = 0;
    sortedAccounts.forEach((row) => {
      const inc = Number(row.income) || 0;
      const exp = Number(row.expense) || 0;
      runningBalance = runningBalance + inc - exp;
      balanceMap.set(row.id, runningBalance);
    });

    return filtered.map((row) => ({
      ...row,
      balance: balanceMap.get(row.id) ?? 0
    }));
  }, [filtered, accounts]);

  const submit = () => {
    if (!form.description && !form.name) {
      toast.error("يرجى إدخال الاسم أو البيان على الأقل");
      return;
    }
    addAccount({
      date: form.date, hafizaNo: form.hafizaNo, notifyNo: form.notifyNo, notifyDate: form.notifyDate,
      checkNo: form.checkNo, checkDate: form.checkDate, description: form.description, specialty: form.specialty,
      name: form.name, hafizaAmount: Number(form.hafizaAmount) || 0, income: Number(form.income) || 0,
      expense: Number(form.expense) || 0, revenueKey: form.revenueKey || undefined,
    });
    toast.success("تم إضافة القيود وترحيلها بنجاح");
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
    toast.success("تم التحديث والترحيل الفوري للسجل المالي");
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
        if (json.length === 0) throw new Error("الملف فارغ");

        const importedAccounts = json
          .map((row: any) => {
            const cleanRow: any = {};
            for (const key in row) { cleanRow[key.trim()] = row[key]; }
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
            revenueKey: String(row["رمز الإيراد"] || row["revenueKey"] || ""),
          }));

        useStore.getState().importData({ accounts: importedAccounts });
        toast.success(`تم استيراد ${importedAccounts.length} سجل مالي بنجاح`);
      } catch (err) {
        toast.error("فشل استيراد ملف الإكسل");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* قسم البطاقات الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold">إجمالي الإيرادات</span>
            <span className="text-2xl font-black text-emerald-600 mt-2 font-mono">{fmt(totalIncome)}</span>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-2xl text-emerald-600"><ArrowUpRight className="w-6 h-6" /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold">إجمالي المصروفات</span>
            <span className="text-2xl font-black text-rose-600 mt-2 font-mono">{fmt(totalExpense)}</span>
          </div>
          <div className="p-3.5 bg-rose-50 rounded-2xl text-rose-600"><ArrowDownLeft className="w-6 h-6" /></div>
        </div>
        <div className="bg-gradient-to-br from-[#10528e] to-[#0b3d6d] p-5 rounded-2xl text-white shadow-md flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-white/70 font-bold">الرصيد الحالي المتوفر</span>
            <span className="text-2xl font-black mt-2 font-mono">{fmt(currentBalance)}</span>
          </div>
          <div className="p-3.5 bg-white/10 rounded-2xl text-amber-400"><Wallet className="w-6 h-6" /></div>
        </div>
      </div>

      {/* نموذج الإدخال والمطابقة */}
      <div className="w-full bg-white shadow-sm border border-slate-100 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#10528e] to-[#0f467a] px-5 py-4 flex flex-wrap justify-between items-center gap-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg text-white"><Plus className="w-4 h-4" /></div>
            <h2 className="text-sm sm:text-base font-bold text-white">إضافة حركة مالية أو مزامنة وتطهير القيود</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSyncFromHafiza} className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-xl text-xs font-black hover:from-amber-400 hover:to-amber-500 transition-all active:scale-95 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" /> 
              <span>تحديث ومطابقة فورية لعام 2026 ⚡</span>
            </button>
            <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold cursor-pointer hover:bg-white/20 transition-all">
              <FileSpreadsheet className="w-3.5 h-3.5" /> <span>استيراد Excel</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} className="hidden" />
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-50/40">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
            <Field label="التاريخ" type="date" icon={<Calendar className="w-4 h-4 text-slate-400" />} v={form.date} on={(v) => setForm({ ...form, date: v })} />
            <Field label="رقم الحافظة" icon={<Hash className="w-4 h-4 text-slate-400" />} v={form.hafizaNo} on={(v) => setForm({ ...form, hafizaNo: v })} />
            <Field label="رقم الإشعار" icon={<Hash className="w-4 h-4 text-slate-400" />} v={form.notifyNo} on={(v) => setForm({ ...form, notifyNo: v })} />
            <Field label="تاريخ التوريد" type="date" icon={<Calendar className="w-4 h-4 text-slate-400" />} v={form.notifyDate} on={(v) => setForm({ ...form, notifyDate: v })} />
            <Field label="رقم الشيك" icon={<Hash className="w-4 h-4 text-slate-400" />} v={form.checkNo} on={(v) => setForm({ ...form, checkNo: v })} />
            <Field label="تاريخ الشيك" type="date" icon={<Calendar className="w-4 h-4 text-slate-400" />} v={form.checkDate} on={(v) => setForm({ ...form, checkDate: v })} />
            
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1">البيان والشرح</label>
              <div className="relative flex items-center">
                <span className="absolute right-3 z-10"><FileText className="w-4 h-4 text-slate-400" /></span>
                <input list="account-descriptions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="اكتب أو اختر البيان..." className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-[#10528e] bg-white text-slate-700 font-medium" />
              </div>
              <datalist id="account-descriptions">
                {Array.from(new Set([...DESCRIPTIONS, ...accounts.map((a) => a.description).filter(Boolean)])).map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>

            <Field label="التخصص الطبي" icon={<FileText className="w-4 h-4 text-slate-400" />} v={form.specialty} on={(v) => setForm({ ...form, specialty: v })} />
            <Field label="الاسم الكامل" icon={<User className="w-4 h-4 text-slate-400" />} v={form.name} on={(v) => setForm({ ...form, name: v })} placeholder="اسم المتدرب..." />
            <Field label="مبلغ الحافظة" type="number" icon={<span className="text-xs text-slate-400 font-bold">ر.ي</span>} v={form.hafizaAmount} on={(v) => setForm({ ...form, hafizaAmount: v })} />
            <Field label="الإيرادات" type="number" icon={<span className="text-xs text-emerald-500 font-bold">ر.ي</span>} v={form.income} on={(v) => setForm({ ...form, income: v })} placeholder="0.00" className="text-emerald-600 font-bold bg-emerald-50/5 focus:border-emerald-500" />
            <Field label="المصروفات" type="number" icon={<span className="text-xs text-rose-500 font-bold">ر.ي</span>} v={form.expense} on={(v) => setForm({ ...form, expense: v })} placeholder="0.00" className="text-rose-600 font-bold bg-rose-50/5 focus:border-rose-500" />
            
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#10528e] mb-1.5 mr-1 flex items-center gap-1"><Link className="w-3.5 h-3.5" /> ربط بدليل هيكل الإيرادات المعتمد</label>
              <select value={form.revenueKey} onChange={(e) => setForm({ ...form, revenueKey: e.target.value })} className="w-full px-3 py-2 text-sm border border-blue-100 rounded-xl outline-none bg-blue-50/20 text-slate-700 font-medium">
                <option value="">-- بدون ربط بهيكل الإيرادات --</option>
                {revenueTypes.map((t) => <option key={t.key} value={t.key}>{t.key} | {t.label}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 flex gap-2 pt-2">
              <button onClick={submit} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#10528e] text-white rounded-xl font-bold hover:bg-[#0b3d6d] text-xs shadow-sm active:scale-95 transition-transform"><Save className="w-4 h-4" /> حفظ السجل</button>
              <button onClick={() => setForm(emptyForm)} className="flex items-center justify-center gap-2 px-3 py-2 border text-slate-500 bg-white rounded-xl font-bold text-xs active:scale-95 transition-transform"><Eraser className="w-4 h-4" /> مسح</button>
            </div>
          </div>
        </div>
      </div>

      {/* جدول مراقبة القيود المحسن بحدود سوداء */}
      <div className="w-full bg-white shadow-sm border border-black rounded-xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-3.5 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <h2 className="text-xs sm:text-sm font-bold text-white">جدول مراقبة قيود الحساب الجاري ({accounts.length})</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.values(filters).some(Boolean) && (
              <button onClick={clearFilters} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all">مسح مرشحات التصفية</button>
            )}
            <TabActions title="كشف الحساب الجاري" rows={accounts} columns={COLS} fileName="الحساب-الجاري" numericKeys={["hafizaAmount","income","expense","balance"]} onClear={clearAccounts} />
          </div>
        </div>

        <div className="bg-white">
          <div className="overflow-x-auto overflow-y-auto max-h-[550px] relative">
            <table className="w-full text-xs sm:text-sm text-right border-collapse border border-black table-auto">
              <thead className="sticky top-0 z-20 shadow-sm text-slate-900 font-bold text-xs bg-slate-100">
                <tr>
                  <th className="p-2 border border-black text-center w-10 bg-slate-100 sticky top-0 z-20">م</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-2 border border-black whitespace-normal break-words min-w-[80px] cursor-pointer hover:bg-slate-200 transition-colors select-none sticky top-0 z-20 bg-slate-100" onClick={() => toggleSort(c.key)}>
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{c.label}</span> 
                        <span className="text-[10px] text-[#10528e] font-mono">{sortIndicator(sortKey === c.key, sortDir)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 border border-black text-center bg-slate-100 sticky top-0 z-20 min-w-[60px]">إجراءات</th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="p-1 border border-black bg-slate-50"></th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-1 border border-black bg-slate-50">
                      <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)} placeholder={`تصفية...`} className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white outline-none focus:border-black font-medium transition-colors" />
                    </th>
                  ))}
                  <th className="p-1 border border-black bg-slate-50"></th>
                </tr>
              </thead>
              
              <tbody className="text-slate-700 font-medium bg-white">
                {filteredWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length + 2} className="p-12 text-center text-slate-500 font-bold border border-black">لا توجد بيانات تطابق مرشحات البحث المحددة حالياً.</td>
                  </tr>
                ) : (
                  filteredWithBalance.map((acc, index) => (
                    <tr key={acc.id} className="hover:bg-slate-100 transition-colors group">
                      <td className="p-2 border border-black text-center font-mono bg-slate-50/50">{index + 1}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono min-w-[85px] text-center">{acc.date}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono font-bold text-center">{acc.hafizaNo || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono text-center">{acc.notifyNo || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono min-w-[85px] text-center">{acc.notifyDate || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono text-center">{acc.checkNo || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono min-w-[85px] text-center">{acc.checkDate || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words min-w-[140px] text-slate-800">{acc.description || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words min-w-[100px]">{acc.specialty || "—"}</td>
                      <td className="p-2 border border-black whitespace-normal break-words font-bold min-w-[120px]">{acc.name || "—"}</td>
                      <td className="p-2 border border-black font-mono text-center">{Number(acc.hafizaAmount) > 0 ? fmt(Number(acc.hafizaAmount)) : "—"}</td>
                      <td className="p-2 border border-black font-mono font-bold text-emerald-700 text-center bg-emerald-50/30">{Number(acc.income) > 0 ? fmt(Number(acc.income)) : "—"}</td>
                      <td className="p-2 border border-black font-mono font-bold text-rose-700 text-center bg-rose-50/30">{Number(acc.expense) > 0 ? fmt(Number(acc.expense)) : "—"}</td>
                      
                      {/* 🌟 تعديل جوهري لربط وترحيل المبالغ للكشف الشهري فورياً عند تغيير الاختيار */}
                      <td className="p-1 border border-black text-center bg-slate-50 min-w-[110px]">
                        <select
                          value={acc.revenueKey || ""}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            updateAccount(acc.id, { ...acc, revenueKey: newKey || undefined });
                            toast.success("تم ربط رمز الإيراد وترحيله للكشف الشهري بنجاح 📊");
                          }}
                          className="w-full p-1 text-[11px] font-bold text-teal-900 bg-teal-50/30 border border-teal-200 rounded outline-none focus:border-black cursor-pointer"
                        >
                          <option value="">— ربط الرمز —</option>
                          {revenueTypes.map((t) => (
                            <option key={t.key} value={t.key}>{t.key}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 border border-black font-mono font-black text-[#10528e] text-center bg-blue-50/30">{fmt(acc.balance)}</td>
                      <td className="p-2 border border-black text-center bg-slate-50/50">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => setEditingRow(acc)} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("هل أنت متأكد من الحذف؟")) deleteAccount(acc.id); }} className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* نافذة التعديل المنبثقة */}
      <Modal title="✏️ تعديل وتدقيق السجل المالي" isOpen={!!editingRow} onClose={() => setEditingRow(null)}>
        {editingRow && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label><input type="date" value={editingRow.date} onChange={(e) => setEditingRow({...editingRow, date: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">رقم الحافظة</label><input value={editingRow.hafizaNo} onChange={(e) => setEditingRow({...editingRow, hafizaNo: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">رقم الإشعار</label><input value={editingRow.notifyNo} onChange={(e) => setEditingRow({...editingRow, notifyNo: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">تاريخ التوريد</label><input type="date" value={editingRow.notifyDate} onChange={(e) => setEditingRow({...editingRow, notifyDate: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" /></div>
              <div className="sm:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">البيان والشرح</label><input value={editingRow.description} onChange={(e) => setEditingRow({...editingRow, description: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">الاسم</label><input value={editingRow.name} onChange={(e) => setEditingRow({...editingRow, name: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">مبلغ الحافظة</label><input type="number" value={editingRow.hafizaAmount} onChange={(e) => setEditingRow({...editingRow, hafizaAmount: e.target.value})} className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-emerald-600 mb-1">الإيرادات</label><input type="number" value={editingRow.income} onChange={(e) => setEditingRow({...editingRow, income: e.target.value})} className="w-full p-2 text-sm border border-emerald-300 bg-emerald-50/30 rounded-xl text-emerald-700 font-bold" /></div>
              <div><label className="block text-xs font-bold text-rose-600 mb-1">المصروفات</label><input type="number" value={editingRow.expense} onChange={(e) => setEditingRow({...editingRow, expense: e.target.value})} className="w-full p-2 text-sm border border-rose-300 bg-rose-50/30 rounded-xl text-rose-700 font-bold" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs sm:text-sm hover:bg-slate-200">إلغاء</button>
              <button type="submit" className="px-5 py-2 bg-[#10528e] text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-[#0b3d6d] shadow-sm">حفظ التعديلات المدققة</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, v, on, type = "text", placeholder = "", icon, className = "" }: { label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-slate-600 mb-1.5 mr-1">{label}</label>
      <div className="relative flex items-center">
        {icon && <span className="absolute right-3 z-10">{icon}</span>}
        <input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} className={`w-full ${icon ? "pr-9" : "px-3"} pl-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-[#10528e] bg-white text-slate-800 font-medium shadow-sm ${className}`} />
      </div>
    </div>
  );
}
