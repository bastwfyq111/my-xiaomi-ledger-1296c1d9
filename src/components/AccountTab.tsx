import React, { useMemo, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { today } from "@/lib/format";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import {
  X, Plus, Edit, Trash2, Save, Eraser,
  FileSpreadsheet, RefreshCw, Calendar,
  Hash, FileText, User, Wallet, Search, FilterX
} from "lucide-react";
import schema from "@/data/revenueTemplate.json";

// تعريف الأعمدة
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
  { key: "hafizaAmount", label: "مبلغ التوريد" },
  { key: "income", label: "الإيرادات" },
  { key: "expense", label: "المصروفات" },
  { key: "revenueKey", label: "رمز الإيراد" },
  { key: "balance", label: "الرصيد" },
];

interface FormType {
  date: string; hafizaNo: string; notifyNo: string; notifyDate: string;
  checkNo: string; checkDate: string; description: string; specialty: string;
  name: string; hafizaAmount: string; income: string; expense: string; revenueKey: string;
}

const emptyForm: FormType = {
  date: today(), hafizaNo: "", notifyNo: "", notifyDate: "",
  checkNo: "", checkDate: "", description: "", specialty: "",
  name: "", hafizaAmount: "", income: "", expense: "", revenueKey: "",
};

// دالة آمنة لتحويل النص إلى رقم
const parseAmount = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  // إزالة كل شيء عدا الأرقام ونقطة عشرية واحدة فقط
  const cleaned = String(val).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// مكون النافذة المنبثقة
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

// مكون حقل الإدخال
const Field = ({ label, value, onChange, type = "text", icon, className = "" }: {
  label: string; value: string; onChange: (val: string) => void; type?: string; icon?: React.ReactNode; className?: string;
}) => (
  <div className="w-full">
    <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
    <div className="relative flex items-center">
      {icon && <span className="absolute right-3 text-slate-400">{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${icon ? 'pr-9' : 'pr-3'} pl-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all ${className}`}
      />
    </div>
  </div>
);

export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount, hafizas = [] } = useStore();

  const [form, setForm] = useState<FormType>(emptyForm);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // إدارة الجدول: ترشيح وفرز
  const {
    rows: filtered,
    sortKey,
    sortDir,
    toggleSort,
    filters,
    setFilter,
    clearFilters,
  } = useTableControls(accounts, COLS.map(c => c.key));

  // أنواع الإيرادات من المخطط
  const revenueTypes = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if (schema?.chapters) {
      schema.chapters.forEach((ch: any) =>
        ch.sections?.forEach((sec: any) =>
          sec.items?.forEach((it: any) =>
            it.types?.forEach((t: any) => {
              list.push({ key: `${ch.no}-${sec.no}-${it.no}-${t.no}`, label: `${ch.title} ← ${t.title}` });
            })
          )
        )
      );
    }
    return list;
  }, []);

  // المجاميع
  const totalIncome = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.income) || 0), 0), [accounts]);
  const totalExpense = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.expense) || 0), 0), [accounts]);
  const currentBalance = totalIncome - totalExpense;

  // حساب الرصيد التراكمي مع مراعاة الترتيب الزمني
  const filteredWithBalance = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (isNaN(da) || isNaN(db)) return 0;
      return da - db;
    });
    const balanceMap = new Map<string, number>();
    let running = 0;
    sorted.forEach(row => {
      running += (Number(row.income) || 0) - (Number(row.expense) || 0);
      balanceMap.set(row.id, running);
    });
    return filtered.map(row => ({ ...row, balance: balanceMap.get(row.id) ?? 0 }));
  }, [filtered, accounts]);

  // دالة مطابقة وترحيل من الحوافظ (2026) – محدثة وشاملة
  const handleSyncFromHafiza = useCallback(() => {
    if (!hafizas || hafizas.length === 0) {
      toast.error("لا توجد بيانات في تبويب حوافظ التوريد!");
      return;
    }

    const normalizeStr = (val: any) => String(val ?? "").trim();
    const normalizeNum = (val: any) => Number(val ?? 0);
    const cleanDate = (dateStr: string) => String(dateStr ?? "").replace(/[^\d]/g, "");

    const hafiza2026 = hafizas.filter((h: any) => cleanDate(h?.date).substring(0, 4) === "2026");

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const byHafizaId = new Map<string, any>();
    accounts.forEach((acc: any) => {
      if (acc.sourceHafizaId) byHafizaId.set(normalizeStr(acc.sourceHafizaId), acc);
    });

    hafiza2026.forEach((hafiza: any) => {
      const hafizaId = normalizeStr(hafiza.id);
      const supplyAmount = normalizeNum(hafiza.hafizaAmount || 0);
      const existing = byHafizaId.get(hafizaId);

      if (!existing) {
        addAccount({
          date: hafiza.date || today(),
          hafizaNo: normalizeStr(hafiza.hafizaNo),
          notifyNo: normalizeStr(hafiza.notifyNo),
          notifyDate: hafiza.notifyDate || "",
          checkNo: normalizeStr(hafiza.checkNo),
          checkDate: hafiza.checkDate || "",
          description: normalizeStr(hafiza.description),
          specialty: normalizeStr(hafiza.specialty),
          name: normalizeStr(hafiza.name),
          hafizaAmount: supplyAmount,
          income: supplyAmount,
          expense: 0,
          revenueKey: existing?.revenueKey || undefined,
          sourceHafizaId: hafiza.id,
        });
        addedCount++;
      } else {
        // تجهيز كائن جديد بجميع الحقول من الحافظة لمقارنة وتحديث كامل
        const newData = {
          date: hafiza.date || existing.date,
          hafizaNo: normalizeStr(hafiza.hafizaNo),
          notifyNo: normalizeStr(hafiza.notifyNo),
          notifyDate: hafiza.notifyDate || existing.notifyDate,
          checkNo: normalizeStr(hafiza.checkNo),
          checkDate: hafiza.checkDate || existing.checkDate,
          description: normalizeStr(hafiza.description),
          specialty: normalizeStr(hafiza.specialty),
          name: normalizeStr(hafiza.name),
          hafizaAmount: supplyAmount,
          income: supplyAmount,
          expense: 0,
          revenueKey: existing.revenueKey,
          sourceHafizaId: hafiza.id,
        };

        // التحقق من وجود أي اختلاف
        const hasDiff = Object.keys(newData).some(key => {
          if (key === 'revenueKey' || key === 'sourceHafizaId') return false;
          return normalizeStr((existing as any)[key]) !== normalizeStr((newData as any)[key]);
        });

        if (hasDiff) {
          updateAccount(existing.id, { ...existing, ...newData });
          updatedCount++;
        } else {
          skippedCount++;
        }
      }
    });

    toast.success(`تمت المطابقة: إضافة (${addedCount}) | تحديث (${updatedCount}) | تطابق (${skippedCount})`);
  }, [hafizas, accounts, addAccount, updateAccount]);

  // إضافة سجل جديد مع تحقق أساسي
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hafizaNo.trim() && !form.name.trim()) {
      toast.error("يرجى إدخال رقم الحافظة أو الاسم على الأقل.");
      return;
    }
    addAccount({
      date: form.date || today(),
      hafizaNo: form.hafizaNo.trim(),
      notifyNo: form.notifyNo.trim(),
      notifyDate: form.notifyDate,
      checkNo: form.checkNo.trim(),
      checkDate: form.checkDate,
      description: form.description.trim(),
      specialty: form.specialty.trim(),
      name: form.name.trim(),
      hafizaAmount: parseAmount(form.hafizaAmount),
      income: parseAmount(form.income),
      expense: parseAmount(form.expense),
      revenueKey: form.revenueKey || undefined,
    });
    setForm(emptyForm);
    setIsAddModalOpen(false);
    toast.success("تمت إضافة السجل بنجاح");
  };

  // حفظ التعديل على صف موجود
  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    // الاحتفاظ بـ sourceHafizaId وجميع الحقول
    updateAccount(editingRow.id, {
      ...editingRow,
      hafizaAmount: parseAmount(editingRow.hafizaAmount),
      income: parseAmount(editingRow.income),
      expense: parseAmount(editingRow.expense),
      date: editingRow.date || today(),
    });
    setEditingRow(null);
    toast.success("تم تحديث السجل");
  };

  // حذف سجل
  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا السجل؟")) {
      deleteAccount(id);
      toast.success("تم الحذف");
    }
  };

  // استيراد من Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
        const imported = json.map((row: any) => ({
          date: row["التاريخ"] || today(),
          hafizaNo: String(row["رقم الحافظة"] ?? ""),
          notifyNo: String(row["رقم الإشعار"] ?? ""),
          notifyDate: row["تاريخ التوريد"] ?? "",
          checkNo: String(row["رقم الشيك"] ?? ""),
          checkDate: row["تاريخ الشيك"] ?? "",
          description: String(row["البيان"] ?? ""),
          specialty: String(row["التخصص"] ?? ""),
          name: String(row["الاسم"] ?? ""),
          hafizaAmount: parseAmount(row["مبلغ التوريد"]),
          income: parseAmount(row["الإيرادات"]),
          expense: parseAmount(row["المصروفات"]),
          revenueKey: row["رمز الإيراد"] || undefined,
        }));
        if (imported.length > 0) {
          useStore.getState().importData({ accounts: imported });
          toast.success(`تم استيراد ${imported.length} سجل`);
        } else {
          toast.error("الملف فارغ أو لا يحتوي على بيانات صالحة");
        }
      } catch (err) {
        toast.error("فشل قراءة الملف، تأكد من الصيغة والمحتوى");
        console.error(err);
      } finally {
        setIsImporting(false);
        // إعادة تعيين input الملف
        e.target.value = "";
      }
    };
    reader.onerror = () => {
      toast.error("حدث خطأ أثناء قراءة الملف");
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // تصدير إلى Excel
  const handleExportExcel = () => {
    const data = filteredWithBalance.map(row => ({
      "التاريخ": row.date,
      "رقم الحافظة": row.hafizaNo,
      "رقم الإشعار": row.notifyNo,
      "تاريخ التوريد": row.notifyDate,
      "رقم الشيك": row.checkNo,
      "تاريخ الشيك": row.checkDate,
      "البيان": row.description,
      "التخصص": row.specialty,
      "الاسم": row.name,
      "مبلغ التوريد": row.hafizaAmount,
      "الإيرادات": row.income,
      "المصروفات": row.expense,
      "رمز الإيراد": row.revenueKey,
      "الرصيد": row.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الحسابات");
    XLSX.writeFile(wb, `الحسابات_${today()}.xlsx`);
    toast.success("تم التصدير بنجاح");
  };

  // مسح الكل
  const handleClearAll = () => {
    if (confirm("هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع.")) {
      clearAccounts();
      toast.success("تم مسح جميع السجلات");
    }
  };

  // بدء تحرير صف (ملء editingRow)
  const startEdit = (row: any) => {
    setEditingRow({ ...row });
  };

  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* شريط الأدوات العلوي */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> إضافة سجل
        </button>

        <button
          onClick={handleSyncFromHafiza}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4" /> مطابقة وترحيل 2026
        </button>

        <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-sm cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" /> استيراد Excel
          <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
        </label>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
        </button>

        {accounts.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-sm"
          >
            <Eraser className="w-4 h-4" /> مسح الكل
          </button>
        )}

        {isImporting && <span className="text-sm text-slate-500 animate-pulse">جارٍ المعالجة...</span>}
      </div>

      {/* ملخص المجاميع */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <div className="text-green-700 font-bold text-lg">{totalIncome.toLocaleString()}</div>
          <div className="text-green-600 text-sm">إجمالي الإيرادات</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <div className="text-red-700 font-bold text-lg">{totalExpense.toLocaleString()}</div>
          <div className="text-red-600 text-sm">إجمالي المصروفات</div>
        </div>
        <div className={`border rounded-2xl p-4 text-center ${currentBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className={`font-bold text-lg ${currentBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{currentBalance.toLocaleString()}</div>
          <div className={`text-sm ${currentBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>الرصيد الحالي</div>
        </div>
      </div>

      {/* منطقة الترشيح */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border">
        <Search className="w-5 h-5 text-slate-400" />
        {COLS.map(col => (
          <input
            key={col.key}
            type="text"
            placeholder={col.label}
            value={filters[col.key] || ""}
            onChange={(e) => setFilter(col.key, e.target.value)}
            className="w-32 px-2 py-1 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        ))}
        <button onClick={clearFilters} className="text-slate-400 hover:text-red-500 transition-colors" title="مسح الترشيحات">
          <FilterX className="w-5 h-5" />
        </button>
      </div>

      {/* الجدول */}
      <div className="overflow-x-auto border rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 sticky top-0">
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortIndicator(col.key, sortKey, sortDir)}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredWithBalance.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 1} className="text-center py-8 text-slate-400">
                  لا توجد سجلات لعرضها
                </td>
              </tr>
            ) : (
              filteredWithBalance.map((row: any) => (
                editingRow?.id === row.id ? (
                  // صف في وضع التحرير
                  <tr key={row.id} className="bg-blue-50">
                    <td className="px-2 py-1">
                      <input type="date" value={editingRow.date || ""} onChange={e => setEditingRow({ ...editingRow, date: e.target.value })} className="w-full px-2 py-1 border rounded" />
                    </td>
                    <td className="px-2 py-1"><input value={editingRow.hafizaNo} onChange={e => setEditingRow({ ...editingRow, hafizaNo: e.target.value })} className="w-20 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input value={editingRow.notifyNo} onChange={e => setEditingRow({ ...editingRow, notifyNo: e.target.value })} className="w-20 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input type="date" value={editingRow.notifyDate} onChange={e => setEditingRow({ ...editingRow, notifyDate: e.target.value })} className="w-28 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input value={editingRow.checkNo} onChange={e => setEditingRow({ ...editingRow, checkNo: e.target.value })} className="w-20 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input type="date" value={editingRow.checkDate} onChange={e => setEditingRow({ ...editingRow, checkDate: e.target.value })} className="w-28 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input value={editingRow.description} onChange={e => setEditingRow({ ...editingRow, description: e.target.value })} className="w-32 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input value={editingRow.specialty} onChange={e => setEditingRow({ ...editingRow, specialty: e.target.value })} className="w-28 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input value={editingRow.name} onChange={e => setEditingRow({ ...editingRow, name: e.target.value })} className="w-28 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input type="number" value={editingRow.hafizaAmount} onChange={e => setEditingRow({ ...editingRow, hafizaAmount: e.target.value })} className="w-24 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input type="number" value={editingRow.income} onChange={e => setEditingRow({ ...editingRow, income: e.target.value })} className="w-24 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1"><input type="number" value={editingRow.expense} onChange={e => setEditingRow({ ...editingRow, expense: e.target.value })} className="w-24 px-2 py-1 border rounded" /></td>
                    <td className="px-2 py-1">
                      <select value={editingRow.revenueKey || ""} onChange={e => setEditingRow({ ...editingRow, revenueKey: e.target.value })} className="w-32 px-2 py-1 border rounded">
                        <option value="">اختر</option>
                        {revenueTypes.map(rt => <option key={rt.key} value={rt.key}>{rt.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 font-mono">{parseAmount(row.balance).toLocaleString()}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={handleEditSave} className="p-1 text-green-600 hover:bg-green-100 rounded" title="حفظ"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditingRow(null)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="إلغاء"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // صف عادي
                  <tr key={row.id} className="hover:bg-slate-50 border-t">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.hafizaNo}</td>
                    <td className="px-3 py-2">{row.notifyNo}</td>
                    <td className="px-3 py-2">{row.notifyDate}</td>
                    <td className="px-3 py-2">{row.checkNo}</td>
                    <td className="px-3 py-2">{row.checkDate}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{row.description}</td>
                    <td className="px-3 py-2">{row.specialty}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 font-mono">{parseAmount(row.hafizaAmount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-green-700 font-mono">{parseAmount(row.income).toLocaleString()}</td>
                    <td className="px-3 py-2 text-red-600 font-mono">{parseAmount(row.expense).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{row.revenueKey}</td>
                    <td className="px-3 py-2 font-mono font-bold">{parseAmount(row.balance).toLocaleString()}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="تعديل"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(row.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="حذف"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة إضافة سجل جديد */}
      <Modal title="إضافة سجل حساب جديد" isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setForm(emptyForm); }}>
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="التاريخ" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" icon={<Calendar className="w-4 h-4" />} />
            <Field label="رقم الحافظة" value={form.hafizaNo} onChange={v => setForm({ ...form, hafizaNo: v })} icon={<Hash className="w-4 h-4" />} />
            <Field label="رقم الإشعار" value={form.notifyNo} onChange={v => setForm({ ...form, notifyNo: v })} icon={<Hash className="w-4 h-4" />} />
            <Field label="تاريخ التوريد" value={form.notifyDate} onChange={v => setForm({ ...form, notifyDate: v })} type="date" icon={<Calendar className="w-4 h-4" />} />
            <Field label="رقم الشيك" value={form.checkNo} onChange={v => setForm({ ...form, checkNo: v })} icon={<Hash className="w-4 h-4" />} />
            <Field label="تاريخ الشيك" value={form.checkDate} onChange={v => setForm({ ...form, checkDate: v })} type="date" icon={<Calendar className="w-4 h-4" />} />
            <Field label="البيان" value={form.description} onChange={v => setForm({ ...form, description: v })} icon={<FileText className="w-4 h-4" />} />
            <Field label="التخصص" value={form.specialty} onChange={v => setForm({ ...form, specialty: v })} icon={<User className="w-4 h-4" />} />
            <Field label="الاسم" value={form.name} onChange={v => setForm({ ...form, name: v })} icon={<User className="w-4 h-4" />} />
            <Field label="مبلغ التوريد" value={form.hafizaAmount} onChange={v => setForm({ ...form, hafizaAmount: v })} type="number" icon={<Wallet className="w-4 h-4" />} />
            <Field label="الإيرادات" value={form.income} onChange={v => setForm({ ...form, income: v })} type="number" icon={<Wallet className="w-4 h-4" />} />
            <Field label="المصروفات" value={form.expense} onChange={v => setForm({ ...form, expense: v })} type="number" icon={<Wallet className="w-4 h-4" />} />
            <div className="w-full">
              <label className="block text-xs font-bold text-slate-600 mb-1">رمز الإيراد</label>
              <select
                value={form.revenueKey}
                onChange={e => setForm({ ...form, revenueKey: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-100 outline-none"
              >
                <option value="">اختر</option>
                {revenueTypes.map(rt => (
                  <option key={rt.key} value={rt.key}>{rt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={() => { setIsAddModalOpen(false); setForm(emptyForm); }} className="px-5 py-2 rounded-xl border text-slate-600 hover:bg-slate-50 transition-colors">إلغاء</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-sm">إضافة</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
