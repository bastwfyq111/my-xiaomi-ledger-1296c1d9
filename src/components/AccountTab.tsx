/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import * as XLSX from "xlsx";

/* أيقونات lucide‑react المطلوبة */
import {
  X,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Hash,
  FileText,
  User,
  Save,
  Eraser,
  Edit,
  Trash2,
  Link,
  ArrowDownLeft,
  Wallet,
} from "lucide-react";

import TabActions from "./TabActions";
import schema from "@/data/revenueTemplate.json";

/* ------------------------------------------------------------------ */
/* تعريف دالة ‎sortIndicator‎ (ليس من lucide‑react)                     */
const sortIndicator = (isActive: boolean, dir: "asc" | "desc" | null) => {
  if (!isActive) return "";
  return dir === "asc" ? "↑" : "↓";
};
/* ------------------------------------------------------------------ */

/* --------------------------- الأعمدة ----------------------------- */
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

/* --------------------------- الأنواع ----------------------------- */
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
  revenueKey: string;
};

const emptyForm: FormType = {
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
  revenueKey: "",
};

/* --------------------------- دوال مساعدة --------------------------- */
const parseAmount = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/[^\d.-]/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

/* --------------------------- مودال ------------------------------ */
const Modal = ({
  title,
  isOpen,
  onClose,
  children,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 border border-slate-100">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-slate-50 to-white sticky top-0 z-10">
          <h3 className="font-bold text-base sm:text-lg text-slate-800 flex items-center gap-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

/* --------------------------- حقل إدخال -------------------------- */
function Field({
  label,
  v,
  on,
  type = "text",
  placeholder = "",
  icon,
  className = "",
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-slate-600 mb-1.5 mr-1">
        {label}
      </label>
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

/* --------------------------- المكوّن الرئيسي --------------------- */
export default function AccountsTab() {
  /* ---------- Zustand store ---------- */
  const {
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    clearAccounts,
    hafiza = [],
  } = useStore();

  /* ---------- حالة النموذج ---------- */
  const [form, setForm] = useState<FormType>(emptyForm);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  /* ---------- مطابقة الحافظات (2026) ---------- */
  const handleSyncFromHafiza = () => {
    const source = hafiza.length > 0 ? hafiza : useStore.getState().hafiza || [];
    if (!source || source.length === 0) {
      toast.error("لا توجد بيانات في تبويب حوافظ التوريد!");
      return;
    }

    const normalizeStr = (val: any) => String(val ?? "").trim();
    const normalizeNum = (val: any) => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };
    const cleanDate = (dateStr: string) => String(dateStr ?? "").replace(/[^\d]/g, "");

    const hafiza2026 = source.filter(
      (h: any) => cleanDate(h?.date).substring(0, 4) === "2026"
    );

    if (hafiza2026.length === 0) {
      toast.info("لا توجد حوافظ لعام 2026.");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const currentAccounts = useStore.getState().accounts;
    const byHafizaId = new Map<string, any>();
    const byHafizaNo = new Map<string, any>();
    const linkedIds = new Set<string>();

    currentAccounts.forEach((acc: any) => {
      if (acc.sourceHafizaId) {
        byHafizaId.set(normalizeStr(acc.sourceHafizaId), acc);
        linkedIds.add(acc.id);
      }
    });

    currentAccounts.forEach((acc: any) => {
      if (acc.hafizaNo && !linkedIds.has(acc.id) && !byHafizaNo.has(normalizeStr(acc.hafizaNo))) {
        byHafizaNo.set(normalizeStr(acc.hafizaNo), acc);
      }
    });

    hafiza2026.forEach((row: any) => {
      if (!row?.id) return;
      const hafizaId = normalizeStr(row.id);

      const incomeValue = normalizeNum(
        row.notifyAmount ?? row.supplyAmount ?? row.tawreedAmount ?? 0
      );

      const mapped = {
        date: row.date || today(),
        hafizaNo: normalizeStr(row.hafizaNo),
        notifyNo: normalizeStr(row.notifyNo),
        notifyDate: row.notifyDate || "",
        description: normalizeStr(row.description),
        specialty: normalizeStr(row.specialty),
        name: normalizeStr(row.name),
        hafizaAmount: normalizeNum(row.hafizaAmount ?? row.amount),
        income: incomeValue,
      };

      let existing = byHafizaId.get(hafizaId);
      if (!existing && mapped.hafizaNo) {
        existing = byHafizaNo.get(mapped.hafizaNo);
        if (existing) byHafizaNo.delete(mapped.hafizaNo);
      }

      if (!existing) {
        const created = addAccount({
          ...mapped,
          checkNo: "",
          checkDate: "",
          expense: 0,
          revenueKey: undefined,
          sourceHafizaId: row.id,
        });
        byHafizaId.set(hafizaId, created);
        addedCount++;
        return;
      }

      const hasDiff =
        cleanDate(existing.date) !== cleanDate(mapped.date) ||
        normalizeStr(existing.hafizaNo) !== mapped.hafizaNo ||
        normalizeStr(existing.notifyNo) !== mapped.notifyNo ||
        normalizeStr(existing.notifyDate) !== mapped.notifyDate ||
        normalizeStr(existing.description) !== mapped.description ||
        normalizeStr(existing.specialty) !== mapped.specialty ||
        normalizeStr(existing.name) !== mapped.name ||
        normalizeNum(existing.hafizaAmount) !== mapped.hafizaAmount ||
        normalizeNum(existing.income) !== mapped.income ||
        existing.sourceHafizaId !== row.id;

      if (hasDiff) {
        updateAccount(existing.id, {
          ...existing,
          ...mapped,
          expense: Number(existing.expense) || 0,
          checkNo: existing.checkNo || "",
          checkDate: existing.checkDate || "",
          revenueKey: existing.revenueKey,
          sourceHafizaId: row.id,
        });
        byHafizaId.set(hafizaId, { ...existing, ...mapped, sourceHafizaId: row.id });
        updatedCount++;
      } else {
        skippedCount++;
      }
    });

    if (addedCount || updatedCount) {
      toast.success(`المطابقة: إضافة ${addedCount} | تحديث ${updatedCount} | تطابق ${skippedCount}`);
    } else {
      toast.info(`جميع السجلات (${skippedCount}) متطابقة.`);
    }
  };

  /* ---------- جدول التحكم (فرز، تصفية …) ---------- */
  const {
    rows: filtered,
    sortKey,
    sortDir,
    toggleSort,
    filters,
    setFilter,
    clearFilters,
  } = useTableControls(accounts, COLS.map((c) => c.key));

  /* ---------- استخراج أنواع الإيرادات من القالب ---------- */
  const revenueTypes = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if (schema && schema.chapters) {
      schema.chapters.forEach((ch: any) =>
        ch.sections.forEach((sec: any) =>
          sec.items.forEach((it: any) =>
            it.types.forEach((t: any) => {
              list.push({
                key: `${ch.no}-${sec.no}-${it.no}-${t.no}`,
                label: `${ch.title} ← ${t.title}`,
              });
            })
          )
        )
      );
    }
    return list;
  }, []);

  /* ---------- حساب الإجماليات ---------- */
  const totalIncome = useMemo(
    () => accounts.reduce((s, a) => s + (Number(a.income) || 0), 0),
    [accounts]
  );
  const totalExpense = useMemo(
    () => accounts.reduce((s, a) => s + (Number(a.expense) || 0), 0),
    [accounts]
  );
  const currentBalance = totalIncome - totalExpense;

  /* ---------- حساب الرصيد المتراكم بطريقة ثابتة (حسب التاريخ) ---------- */
  const filteredWithBalance = useMemo(() => {
    // 1️⃣ ترتيب السجلات المصفاة زمنياً
    const sortedByDate = [...filtered].sort((a, b) => {
      const da = a.date ? String(a.date).replace(/[^\d]/g, "") : "";
      const db = b.date ? String(b.date).replace(/[^\d]/g, "") : "";
      return da.localeCompare(db);
    });

    // 2️⃣ حساب رصيد متراكم
    const balanceMap = new Map<string, number>();
    let running = 0;
    sortedByDate.forEach((row) => {
      running += (Number(row.income) || 0) - (Number(row.expense) || 0);
      if (row.id) balanceMap.set(row.id, running);
    });

    // 3️⃣ إرجاع السجلات التي تم عرضها (مع الحفاظ على ترتيب العرض الأصلي)
    return filtered.map((row) => ({
      ...row,
      balance: row.id ? balanceMap.get(row.id) ?? 0 : 0,
    }));
  }, [filtered]);

  /* ---------- عمليات الإدخال اليدوي ---------- */
  const submit = () => {
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
      revenueKey: form.revenueKey || undefined,
    });
    toast.success("تم حفظ القيد يدوياً");
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

  /* ---------- استيراد ملف Excel ---------- */
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });

        if (json.length === 0) throw new Error("الملف فارغ");

        const imported = json
          .map((row: any) => {
            const clean: any = {};
            for (const k in row) clean[k.trim()] = row[k];
            return clean;
          })
          .filter(
            (r: any) =>
              r["الاسم"] ||
              r["البيان"] ||
              r["name"] ||
              r["description"]
          )
          .map((r: any) => ({
            date: r["التاريخ"] || r["date"] || today(),
            hafizaNo: String(r["رقم الحافظة"] || r["hafizaNo"] || ""),
            notifyNo: String(
              r["رقم الإشعار"] ||
                r["رقم الاشعار"] ||
                r["notifyNo"] ||
                ""
            ),
            notifyDate: r["تاريخ التوريد"] || r["notifyDate"] || "",
            checkNo: String(r["رقم الشيك"] || r["checkNo"] || ""),
            checkDate: r["تاريخ الشيك"] || r["checkDate"] || "",
            description: r["البيان"] || r["description"] || "",
            specialty: r["التخصص"] || r["specialty"] || "",
            name: r["الاسم"] || r["name"] || "",
            hafizaAmount: parseAmount(
              r["مبلغ الحافظة"] || r["hafizaAmount"]
            ),
            income: parseAmount(
              r["الإيرادات"] ||
                r["الايرادات"] ||
                r["income"]
            ),
            expense: parseAmount(
              r["المصروفات"] ||
                r["المصروف"] ||
                r["مصروفات"] ||
                r["مصروف"] ||
                r["expense"] ||
                r["expenses"]
            ),
            revenueKey: String(r["رمز الإيراد"] || r["revenueKey"] || ""),
          }));

        useStore.getState().importData({ accounts: imported });
        toast.success(`تم استيراد ${imported.length} سجل مالي`);
      } catch (err) {
        console.error(err);
        toast.error("فشل استيراد ملف الإكسل");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  /* ---------- JSX ------------------------------- */
  return (
    <div className="w-full space-y-6" dir="rtl">
      {/* --------- بطاقات الإحصائيات --------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* إجمالي الإيرادات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold">
              إجمالي الإيرادات
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-2 font-mono">
              {fmt(totalIncome)}
            </span>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-2xl text-emerald-600">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* إجمالي المصروفات */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold">
              إجمالي المصروفات
            </span>
            <span className="text-2xl font-black text-rose-600 mt-2 font-mono">
              {fmt(totalExpense)}
            </span>
          </div>
          <div className="p-3.5 bg-rose-50 rounded-2xl text-rose-600">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* الرصيد الحالي */}
        <div className="bg-gradient-to-br from-[#10528e] to-[#0b3d6d] p-5 rounded-2xl text-white shadow-md flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-white/70 font-bold">
              الرصيد الحالي المتوفر
            </span>
            <span className="text-2xl font-black mt-2 font-mono">
              {fmt(currentBalance)}
            </span>
          </div>
          <div className="p-3.5 bg-white/10 rounded-2xl text-amber-400">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* --------- لوحة الإدخال --------- */}
      <div className="w-full bg-white shadow-sm border border-slate-100 rounded-2xl overflow-hidden">
        {/* رأس اللوحة */}
        <div className="bg-gradient-to-r from-[#10528e] to-[#0f467a] px-5 py-4 flex flex-wrap justify-between items-center gap-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg text-white">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              إضافة حركة مالية يدويّة أو ترحيل مطابق
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* زر المطابقة الشاملة */}
            <button
              onClick={handleSyncFromHafiza}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>مطابقة شاملة 2026 ⚡</span>
            </button>

            {/* زر استيراد Excel */}
            <label className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>استيراد Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* نموذج الإدخال */}
        <div className="p-4 bg-slate-50/40">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
            <Field
              label="التاريخ"
              type="date"
              icon={<Calendar className="w-4 h-4 text-slate-400" />}
              v={form.date}
              on={(v) => setForm({ ...form, date: v })}
            />
            <Field
              label="رقم الحافظة"
              icon={<Hash className="w-4 h-4 text-slate-400" />}
              v={form.hafizaNo}
              on={(v) => setForm({ ...form, hafizaNo: v })}
            />
            <Field
              label="رقم الإشعار"
              icon={<Hash className="w-4 h-4 text-slate-400" />}
              v={form.notifyNo}
              on={(v) => setForm({ ...form, notifyNo: v })}
            />
            <Field
              label="تاريخ التوريد"
              type="date"
              icon={<Calendar className="w-4 h-4 text-slate-400" />}
              v={form.notifyDate}
              on={(v) => setForm({ ...form, notifyDate: v })}
            />
            <Field
              label="رقم الشيك"
              icon={<Hash className="w-4 h-4 text-slate-400" />}
              v={form.checkNo}
              on={(v) => setForm({ ...form, checkNo: v })}
            />
            <Field
              label="تاريخ الشيك"
              type="date"
              icon={<Calendar className="w-4 h-4 text-slate-400" />}
              v={form.checkDate}
              on={(v) => setForm({ ...form, checkDate: v })}
            />

            {/* البيان */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1">
                البيان والشرح
              </label>
              <div className="relative flex items-center">
                <span className="absolute right-3 z-10">
                  <FileText className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  list="account-descriptions"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="اكتب أو اختر البيان..."
                  className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-[#10528e] bg-white text-slate-700 font-medium"
                />
              </div>
              <datalist id="account-descriptions">
                {Array.from(
                  new Set([
                    ...DESCRIPTIONS,
                    ...accounts.map((a) => a.description).filter(Boolean),
                  ])
                ).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <Field
              label="التخصص الطبي"
              icon={<FileText className="w-4 h-4 text-slate-400" />}
              v={form.specialty}
              on={(v) => setForm({ ...form, specialty: v })}
            />
            <Field
              label="الاسم الكامل"
              icon={<User className="w-4 h-4 text-slate-400" />}
              v={form.name}
              on={(v) => setForm({ ...form, name: v })}
              placeholder="اسم المتدرب..."
            />
            <Field
              label="مبلغ الحافظة"
              type="number"
              icon={<span className="text-xs text-slate-400 font-bold">ر.ي</span>}
              v={form.hafizaAmount}
              on={(v) => setForm({ ...form, hafizaAmount: v })}
            />
            <Field
              label="الإيرادات"
              type="number"
              icon={<span className="text-xs text-emerald-500 font-bold">ر.ي</span>}
              v={form.income}
              on={(v) => setForm({ ...form, income: v })}
              placeholder="0.00"
              className="text-emerald-600 font-bold bg-emerald-50/5 focus:border-emerald-500"
            />
            <Field
              label="المصروفات"
              type="number"
              icon={<span className="text-xs text-rose-500 font-bold">ر.ي</span>}
              v={form.expense}
              on={(v) => setForm({ ...form, expense: v })}
              placeholder="0.00"
              className="text-rose-600 font-bold bg-rose-50/5 focus:border-rose-500"
            />

            {/* ربط برمز الإيراد */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#10528e] mb-1.5 mr-1 flex items-center gap-1">
                <Link className="w-3.5 h-3.5" /> ربط بدليل هيكل الإيرادات
              </label>
              <select
                value={form.revenueKey}
                onChange={(e) =>
                  setForm({ ...form, revenueKey: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-blue-100 rounded-xl outline-none bg-blue-50/20 text-slate-700 font-medium"
              >
                <option value="">-- بدون ربط --</option>
                {revenueTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.key} | {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* أزرار الإجراء */}
            <div className="sm:col-span-2 flex gap-2 pt-2">
              {/* زر حفظ السجل */}
              <button
                onClick={submit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#10528e] hover:bg-[#0b3d6d] text-white rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" />
                حفظ السجل
              </button>

              {/* زر مسح الحقول */}
              <button
                onClick={() => setForm(emptyForm)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs active:scale-95 transition-all"
              >
                <Eraser className="w-4 h-4" />
                مسح
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --------- جدول القيود --------- */}
      <div className="w-full bg-white shadow-sm border border-black rounded-xl overflow-hidden">
        {/* رأس الجدول */}
        <div className="bg-slate-800 px-5 py-3.5 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <h2 className="text-xs sm:text-sm font-bold text-white">
              جدول مراقبة الحساب الجاري ({accounts.length})
            </h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.values(filters).some(Boolean) && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                مسح مرشحات التصفية
              </button>
            )}
            <TabActions
              title="كشف الحساب الجاري"
              rows={accounts}
              columns={COLS}
              fileName="الحساب-الجاري"
              numericKeys={[
                "hafizaAmount",
                "income",
                "expense",
                "balance",
              ]}
              onClear={clearAccounts}
            />
          </div>
        </div>

        {/* محتوى الجدول */}
        <div className="bg-white">
          <div className="overflow-x-auto overflow-y-auto max-h-[550px] relative">
            <table className="w-full text-xs sm:text-sm text-right border-collapse border border-black table-auto">
              <thead className="sticky top-0 z-20 shadow-sm text-slate-900 font-bold text-xs bg-slate-100">
                <tr>
                  <th className="p-2 border border-black text-center w-10 bg-slate-100 sticky top-0 z-20">
                    م
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className="p-2 border border-black whitespace-normal break-words min-w-[80px] cursor-pointer hover:bg-slate-200 transition-colors select-none bg-slate-100"
                      onClick={() => toggleSort(c.key)}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{c.label}</span>
                        <span className="text-[10px] text-[#10528e] font-mono">
                          {sortIndicator(sortKey === c.key, sortDir)}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 border border-black text-center bg-slate-100 min-w-[60px]">
                    إجراءات
                  </th>
                </tr>

                {/* صف الفلاتر */}
                <tr className="bg-slate-50">
                  <th className="p-1 border border-black bg-slate-50"></th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-1 border border-black bg-slate-50">
                      <input
                        value={filters[c.key] || ""}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="تصفية..."
                        className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white outline-none focus:border-black font-medium transition-colors"
                      />
                    </th>
                  ))}
                  <th className="p-1 border border-black bg-slate-50"></th>
                </tr>
              </thead>

              <tbody className="text-slate-700 font-medium bg-white">
                {filteredWithBalance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={COLS.length + 2}
                      className="p-12 text-center text-slate-500 font-bold border border-black"
                    >
                      لا توجد بيانات تطابق مرشحات البحث.
                    </td>
                  </tr>
                ) : (
                  filteredWithBalance.map((acc, idx) => (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-100 transition-colors group"
                    >
                      <td className="p-2 border border-black text-center font-mono bg-slate-50/50">
                        {idx + 1}
                      </td>

                      {/* البيانات الأساسية */}
                      <td className="p-2 border border-black whitespace-normal break-words font-mono min-w-[85px] text-center">
                        {acc.date}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono font-bold text-center">
                        {acc.hafizaNo || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono text-center">
                        {acc.notifyNo || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono min-w-[85px] text-center">
                        {acc.notifyDate || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono text-center">
                        {acc.checkNo || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words font-mono min-w-[85px] text-center">
                        {acc.checkDate || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words min-w-[140px] text-slate-800">
                        {acc.description || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words min-w-[100px]">
                        {acc.specialty || "—"}
                      </td>
                      <td className="p-2 border border-black whitespace-normal break-words font-bold min-w-[120px]">
                        {acc.name || "—"}
                      </td>

                      {/* القيم المالية */}
                      <td className="p-2 border border-black font-mono text-center">
                        {Number(acc.hafizaAmount) > 0 ? fmt(Number(acc.hafizaAmount)) : "—"}
                      </td>
                      <td className="p-2 border border-black font-mono font-bold text-emerald-700 text-center bg-emerald-50/30">
                        {Number(acc.income) > 0 ? fmt(Number(acc.income)) : "—"}
                      </td>
                      <td className="p-2 border border-black font-mono font-bold text-rose-700 text-center bg-rose-50/30">
                        {Number(acc.expense) > 0 ? fmt(Number(acc.expense)) : "—"}
                      </td>

                      {/* ربط رمز الإيراد */}
                      <td className="p-1 border border-black text-center bg-slate-50 min-w-[110px]">
                        <select
                          value={acc.revenueKey || ""}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            updateAccount(acc.id, {
                              ...acc,
                              revenueKey: newKey || undefined,
                            });
                            toast.success("تم ربط رمز الإيراد بنجاح 📊");
                          }}
                          className="w-full p-1 text-[11px] font-bold text-teal-900 bg-teal-50/30 border border-teal-200 rounded outline-none focus:border-black cursor-pointer"
                        >
                          <option value="">— ربط الرمز —</option>
                          {revenueTypes.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.key}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* الرصيد المتراكم */}
                      <td className="p-2 border border-black font-mono font-black text-[#10528e] text-center bg-blue-50/30">
                        {fmt(acc.balance)}
                      </td>

                      {/* إجراءات السطر */}
                      <td className="p-2 border border-black text-center bg-slate-50/50">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => setEditingRow(acc)}
                            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("هل أنت متأكد من الحذف؟"))
                                deleteAccount(acc.id);
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* ---------- مودال تعديل ---------- */}
      <Modal
        title="✏️ تعديل وتدقيق السجل المالي"
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
      >
        {editingRow && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  التاريخ
                </label>
                <input
                  type="date"
                  value={editingRow.date}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, date: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  رقم الحافظة
                </label>
                <input
                  value={editingRow.hafizaNo}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, hafizaNo: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  رقم الإشعار
                </label>
                <input
                  value={editingRow.notifyNo}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, notifyNo: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  تاريخ التوريد
                </label>
                <input
                  type="date"
                  value={editingRow.notifyDate}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, notifyDate: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  البيان والشرح
                </label>
                <input
                  value={editingRow.description}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, description: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  الاسم
                </label>
                <input
                  value={editingRow.name}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, name: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  مبلغ الحافظة
                </label>
                <input
                  type="number"
                  value={editingRow.hafizaAmount}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, hafizaAmount: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-slate-300 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-600 mb-1">
                  الإيرادات
                </label>
                <input
                  type="number"
                  value={editingRow.income}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, income: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-emerald-300 bg-emerald-50/30 rounded-xl text-emerald-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-600 mb-1">
                  المصروفات
                </label>
                <input
                  type="number"
                  value={editingRow.expense}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, expense: e.target.value })
                  }
                  className="w-full p-2 text-sm border border-rose-300 bg-rose-50/30 rounded-xl text-rose-700 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              {/* زر إلغاء */}
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-all"
              >
                إلغاء
              </button>

              {/* زر حفظ */}
              <button
                type="submit"
                className="px-5 py-2 bg-[#10528e] hover:bg-[#0b3d6d] text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                حفظ التعديلات
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
