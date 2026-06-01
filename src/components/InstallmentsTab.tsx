import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

const MONTHS_2025 = ["يونيو 2024", "يوليو 2024", "أغسطس 2024", "مارس 2025", "ابريل 2025", "مايو 2025", "يونيو 2025", "يوليو 2025", "أغسطس 2025", "سبتمبر 2025", "اكتوبر 2025", "نوفمبر 2025"];
const MONTHS_2026 = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
};

// مكون إعادة استخدام الإحصائيات
const StatsGrid = ({ stats, columns = 3 }: { stats: any[]; columns?: number }) => (
  <div className={`grid grid-cols-${columns} gap-2 mb-4`}>
    {stats.map((stat, idx) => (
      <div key={idx} className={`${stat.bgClass} p-3 rounded-lg text-center border ${stat.borderClass}`}>
        <div className="text-[9px] font-medium text-slate-600">{stat.label}</div>
        <div className="text-sm font-mono font-bold mt-1 text-slate-900">{stat.value}</div>
      </div>
    ))}
  </div>
);

export default function InstallmentsTab() {
  const { installments, installments2025 } = useStore() as any;
  const [paymentModal, setPaymentModal] = useState<{ row: any; month: string } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [previewModal, setPreviewModal] = useState<{ name: string; html: string } | null>(null);
  const [newPaymentModal, setNewPaymentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentAmount, setNewStudentAmount] = useState("");
  const [newStudentMonth, setNewStudentMonth] = useState("");
  const [editPaymentModal, setEditPaymentModal] = useState<{ row: any; month: string; amount: number } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"]);
  const controls2025 = useTableControls(installments2025 || [], ["name", "batch", "specialty", "fees", "totalPaid", "remaining", "notes", "phone"]);

  const totals2025 = useMemo(() => ({
    fees: controls2025.rows.reduce((s, r) => s + cleanNumber(r.fees), 0),
    paid: controls2025.rows.reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: controls2025.rows.reduce((s, r) => s + cleanNumber(r.remaining), 0),
  }), [controls2025.rows]);

  const totals2026 = useMemo(() => ({
    fees: controls2026.rows.reduce((s, r) => s + cleanNumber(r.fees), 0),
    prevDue: controls2026.rows.reduce((s, r) => s + cleanNumber(r.prevDue), 0),
    paid: controls2026.rows.reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: controls2026.rows.reduce((s, r) => s + cleanNumber(r.remaining), 0),
  }), [controls2026.rows]);

  const allNames = useMemo(() => {
    const names2025 = (installments2025 || []).map((s: any) => s.name);
    const names2026 = (installments || []).map((s: any) => s.name);
    return [...new Set([...names2025, ...names2026])];
  }, [installments2025, installments]);

  const handleNameChange = (value: string) => {
    setNewStudentName(value);
    if (value.length > 0) {
      setNameSuggestions(allNames.filter((n: string) => n.toLowerCase().includes(value.toLowerCase())));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const updateInstallments = (updatedList: any[]) => {
    useStore.setState({ installments: updatedList });
  };

  const addPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || !payAmount) return toast.error("يرجى إدخال المبلغ");

    const amount = Number(payAmount) || 0;
    if (amount <= 0) return toast.error("يرجى إدخال مبلغ صحيح");

    const list = [...(installments || [])];

    const updated = list.map((s: any) => {
      if (s.name !== paymentModal.row.name) return s;
      const payments = { ...s.payments, [paymentModal.month]: (Number(s.payments[paymentModal.month]) || 0) + amount };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      const remaining = cleanNumber(s.prevDue) - totalPaid;
      return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
    });

    updateInstallments(updated);
    toast.success(`تم تسجيل دفعة ${fmt(amount)} لشهر ${paymentModal.month}`);
    setPaymentModal(null);
    setPayAmount("");
  };

  const addNewPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentAmount || !newStudentMonth) return toast.error("يرجى إدخال جميع البيانات");

    const amount = Number(newStudentAmount) || 0;
    if (amount <= 0) return toast.error("يرجى إدخال مبلغ صحيح");

    const list = [...(installments || [])];
    const existing = list.find((s: any) => s.name === newStudentName);

    if (existing) {
      const updated = list.map((s: any) => {
        if (s.name !== newStudentName) return s;
        const payments = { ...s.payments, [newStudentMonth]: (Number(s.payments[newStudentMonth]) || 0) + amount };
        const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
        const remaining = cleanNumber(s.prevDue) - totalPaid;
        return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
      });
      updateInstallments(updated);
    } else {
      const payments = MONTHS_2026.reduce((acc: any, m) => (acc[m] = m === newStudentMonth ? amount : 0, acc), {});
      const newRecord = {
        name: newStudentName,
        batch: "",
        specialty: "",
        fees: 0,
        prevDue: 0,
        totalPaid: amount,
        remaining: 0,
        notes: "",
        phone: "",
        payments
      };
      updateInstallments([...list, newRecord]);
    }

    toast.success(`تم إضافة دفعة ${fmt(amount)} لـ ${newStudentName}`);
    setNewPaymentModal(false);
    setNewStudentName("");
    setNewStudentAmount("");
    setNewStudentMonth("");
  };

  const editPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentModal || !editAmount) return;

    const newAmount = Number(editAmount) || 0;
    if (newAmount <= 0) return toast.error("يرجى إدخال مبلغ صحيح");

    const list = [...(installments || [])];

    const updated = list.map((s: any) => {
      if (s.name !== editPaymentModal.row.name) return s;
      const payments = { ...s.payments, [editPaymentModal.month]: newAmount };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      const remaining = cleanNumber(s.prevDue) - totalPaid;
      return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
    });

    updateInstallments(updated);
    toast.success("تم تعديل القسط");
    setEditPaymentModal(null);
    setEditAmount("");
  };

  const deletePayment = (row: any, month: string) => {
    if (!confirm(`حذف قسط شهر ${month} للمتدرب ${row.name}؟`)) return;

    const list = [...(installments || [])];
    const updated = list.map((s: any) => {
      if (s.name !== row.name) return s;
      const payments = { ...s.payments, [month]: 0 };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      const remaining = cleanNumber(s.prevDue) - totalPaid;
      return { ...s, payments, totalPaid, remaining: Math.max(0, remaining) };
    });

    updateInstallments(updated);
    toast.success(`تم حذف قسط شهر ${month}`);
    if (editPaymentModal) setEditPaymentModal(null);
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>, year: 2025 | 2026) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) as any[];
        const headerIdx = rows.findIndex(r => r?.some((c: any) => ["متدرب", "الاسم", "المساق"].some(k => String(c).includes(k))));
        if (headerIdx === -1) return toast.error("لم يتم العثور على العناوين");

        const headers = rows[headerIdx].map((h: any) => String(h || "").trim());
        const data = rows.slice(headerIdx + 1)
          .map(r => headers.reduce((obj: any, h, i) => (obj[h] = r[i], obj), {}))
          .filter(r => {
            const name = String(Object.values(r).find((v: any) => String(v).includes("اسم") || String(v).includes("الاسم")) || "").trim();
            return name && name !== "الإجمالي" && !name.includes("كشف");
          })
          .map(r => {
            const find = (keys: string[]) => Object.entries(r).find(([k]) => keys.some(kw => k.includes(kw)))?.[1] || "";
            const name = String(find(["اسم", "الاسم"])).trim();
            const batch = String(find(["دفعة", "الدفعة"])).trim();
            const specialty = String(find(["مساق", "المساق"])).trim();
            const fees = cleanNumber(find(["رسوم", "مبلغ"]));
            const prevDue = year === 2026 ? cleanNumber(find(["2025", "السابق", "متبقي"])) : 0;
            const totalPaid = cleanNumber(find(["المسدد", "الإجمالي", "المدفوع"]));
            const remaining = cleanNumber(find(["المتبقي"]));
            const notes = String(find(["ملاحظات"])).trim();
            const phone = String(find(["هاتف", "تلفون"])).trim();
            const months = year === 2025 ? MONTHS_2025 : MONTHS_2026;
            const payments = months.reduce((acc: any, m) => {
              const key = Object.keys(r).find(k => String(k).replace(/\s/g, "") === m.replace(/\s/g, ""));
              acc[m] = key ? cleanNumber(r[key]) : 0;
              return acc;
            }, {});
            return { name, batch, specialty, fees, ...(year === 2026 && { prevDue }), totalPaid, remaining, notes, phone, payments };
          });

        useStore.setState(year === 2025 ? { installments2025: data } : { installments: data });
        toast.success(`تم استيراد ${data.length} سجل لعام ${year}`);
      } catch (error) {
        console.error("خطأ في استيراد الملف:", error);
        toast.error("خطأ في معالجة الملف");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const getStatusText = (remaining: number) => {
    if (remaining <= 0) return { text: "له", color: "text-emerald-600", bg: "bg-emerald-50" };
    return { text: "عليه", color: "text-rose-600", bg: "bg-rose-50" };
  };

  const generatePreview = (name: string) => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === name);
    const r2026 = (installments || []).find((i: any) => i.name === name);

    const buildTable = (r: any, months: string[], year: string, opening: number, color: string) => {
      if (!r) return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;opacity:0.5"><div style="background:${color};color:white;padding:8px 12px;font-size:14px;font-weight:bold">📅 ${year}</div><div style="padding:12px;text-align:center;color:#9ca3af">لا توجد بيانات</div></div>`;

      const paidMonths = months.filter(m => Number(r.payments?.[m]) > 0);
      if (paidMonths.length === 0) {
        return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden"><div style="background:${color};color:white;padding:8px 12px;font-size:14px;font-weight:bold">📅 ${year}</div><div style="padding:12px;text-align:center;color:#9ca3af">لم يتم تسجيل دفعات</div></div>`;
      }

      let balance = opening;
      const rows = paidMonths.map(m => {
        const paid = Number(r.payments?.[m]) || 0;
        balance -= paid;
        const status = balance <= 0 ? "له" : "عليه";
        const sc = balance <= 0 ? "#059669" : "#dc2626";
        const bg = balance <= 0 ? "#d1fae5" : "#fee2e2";
        return `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:6px 8px;font-size:12px;text-align:right;background:#f9fafb">${m}</td><td style="padding:6px 8px;font-size:12px;text-align:center;font-weight:bold">${fmt(paid)}</td><td style="padding:6px 8px;font-size:12px;text-align:center;font-weight:bold">${fmt(Math.abs(balance))}</td><td style="padding:6px 8px;font-size:12px;text-align:center;color:white;background:${bg};color:${sc};font-weight:bold">${status}</td></tr>`;
      }).join("");

      const finalBalance = Math.max(0, balance);
      return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;background:white"><div style="background:${color};color:white;padding:8px 12px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:bold">📅 ${year}</span><span style="font-size:12px">الرصيد الافتتاحي: ${fmt(opening)}</span></div><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb"><th style="padding:6px 8px;font-size:12px;font-weight:bold;text-align:right">الشهر</th><th style="padding:6px 8px;font-size:12px;font-weight:bold;text-align:center">المبلغ</th><th style="padding:6px 8px;font-size:12px;font-weight:bold;text-align:center">الرصيد</th><th style="padding:6px 8px;font-size:12px;font-weight:bold;text-align:center">الحالة</th></tr></thead><tbody>${rows}</tbody></table><div style="background:#f9fafb;padding:8px 12px;border-top:2px solid #e5e7eb;display:flex;justify-content:space-between;font-weight:bold"><span>الرصيد النهائي:</span><span style="color:${finalBalance > 0 ? "#dc2626" : "#059669"}">${fmt(finalBalance)}</span></div></div>`;
    };

    const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#f1f5f9;padding:12px;direction:rtl;line-height:1.6}.container{max-width:1100px;margin:0 auto;background:white;padding:16px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}.header{border-bottom:3px solid #0f766e;padding:12px 0;margin-bottom:16px;text-align:center}.header h1{font-size:18px;color:#0f766e;margin-bottom:4px}.header p{font-size:12px;color:#64748b}.content{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:800px){.content{grid-template-columns:1fr}}.table-wrapper{background:#fff}`;

    const opening2025 = r2025?.fees || 0;
    const opening2026 = r2026?.prevDue || 0;
    const table2025 = buildTable(r2025, MONTHS_2025, "أقساط ورسوم 2025", opening2025, "#0d9488");
    const table2026 = buildTable(r2026, MONTHS_2026, "أقساط ورسوم 2026", opening2026, "#7c3aed");

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body><div class="container"><div class="header"><h1>📊 كشف حساب المتدرب</h1><p>${name} - ${today()}</p></div><div class="content"><div class="table-wrapper">${table2025}</div><div class="table-wrapper">${table2026}</div></div></div></body></html>`;

    setPreviewModal({ name, html });
  };

  const stats2025 = [
    { label: "رسوم الدراسة", value: fmt(totals2025.fees), bgClass: "bg-slate-50", borderClass: "border-slate-200" },
    { label: "المسدد", value: fmt(totals2025.paid), bgClass: "bg-emerald-50", borderClass: "border-emerald-200" },
    { label: "المتبقي", value: fmt(totals2025.remaining), bgClass: "bg-rose-50", borderClass: "border-rose-200" }
  ];

  const stats2026 = [
    { label: "رسوم 2026", value: fmt(totals2026.fees), bgClass: "bg-slate-50", borderClass: "border-slate-200" },
    { label: "متبقي 2025", value: fmt(totals2026.prevDue), bgClass: "bg-amber-50", borderClass: "border-amber-200" },
    { label: "المسدد", value: fmt(totals2026.paid), bgClass: "bg-emerald-50", borderClass: "border-emerald-200" },
    { label: "الرصيد", value: fmt(totals2026.remaining), bgClass: "bg-rose-50", borderClass: "border-rose-200" }
  ];

  return (
    <div className="space-y-6 p-4" dir="rtl">
      {/* ========== جدول 2025 ========== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-base font-bold text-white">📊 أقساط ورسوم 2025</h2>
              <p className="text-xs text-teal-100 mt-1">الأرشيف - الرصيد الافتتاحي = رسوم الدراسة</p>
            </div>
            <label className="px-4 py-2 bg-white text-teal-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-teal-50 transition">
              📥 استيراد 2025
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2025)} className="hidden" />
            </label>
          </div>
        </div>
        <div className="p-4">
          <StatsGrid stats={stats2025} columns={3} />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-3 text-center text-slate-700 w-10">#</th>
                  <th className="p-3 text-right text-slate-700">الاسم</th>
                  <th className="p-3 text-center text-slate-700">الدفعة</th>
                  <th className="p-3 text-right text-slate-700">المساق</th>
                  <th className="p-3 text-center text-slate-700">رسوم 2025</th>
                  <th className="p-3 text-center text-emerald-700">المسدد</th>
                  <th className="p-3 text-center text-rose-700">المتبقي</th>
                  <th className="p-3 text-right text-slate-700">ملاحظات</th>
                  <th className="p-3 text-center text-slate-700">الهاتف</th>
                </tr>
              </thead>
              <tbody>
                {controls2025.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  controls2025.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-slate-200 hover:bg-slate-50 transition">
                      <td className="p-3 text-center text-slate-400 font-medium">{i + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{r.name}</td>
                      <td className="p-3 text-center text-slate-600">{r.batch || "—"}</td>
                      <td className="p-3 text-slate-700">{r.specialty || "—"}</td>
                      <td className="p-3 text-center font-mono text-slate-900">{fmt(r.fees)}</td>
                      <td className="p-3 text-center font-mono text-emerald-700 font-bold">{fmt(r.totalPaid)}</td>
                      <td className="p-3 text-center font-mono text-rose-700 font-bold">{fmt(r.remaining)}</td>
                      <td className="p-3 text-xs text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                      <td className="p-3 text-center text-xs text-slate-600">{r.phone || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== جدول 2026 ========== */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-base font-bold text-white">📊 أقساط ورسوم 2026</h2>
              <p className="text-xs text-purple-100 mt-1">الرصيد الافتتاحي = متبقي 2025 فقط</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setNewPaymentModal(true)} className="px-4 py-2 bg-white text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-50 transition">
                ➕ إضافة قسط
              </button>
              <label className="px-4 py-2 bg-white text-purple-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-purple-50 transition">
                📥 استيراد 2026
                <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2026)} className="hidden" />
              </label>
            </div>
          </div>
        </div>
        <div className="p-4">
          <StatsGrid stats={stats2026} columns={4} />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 sticky top-0">
                <tr>
                  <th className="p-2 text-center text-slate-700 w-8">#</th>
                  <th className="p-2 text-right text-slate-700 min-w-32">الاسم</th>
                  <th className="p-2 text-center text-slate-700 w-16">الدفعة</th>
                  <th className="p-2 text-right text-slate-700 min-w-24">المساق</th>
                  <th className="p-2 text-center text-slate-700 w-16">رسوم 2026</th>
                  <th className="p-2 text-center text-slate-700 w-16">متبقي 2025</th>
                  {MONTHS_2026.map(m => (
                    <th key={m} className="p-1.5 text-center text-slate-700 text-[10px] w-12 bg-slate-50">{m}</th>
                  ))}
                  <th className="p-2 text-center text-emerald-700 w-12">المسدد</th>
                  <th className="p-2 text-center text-rose-700 w-12">الرصيد</th>
                  <th className="p-2 text-center text-slate-700 w-12">الحالة</th>
                  <th className="p-2 text-center text-slate-700 w-12">كشف</th>
                </tr>
              </thead>
              <tbody>
                {controls2026.rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-6 text-center text-slate-400">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  controls2026.rows.map((r: any, i: number) => {
                    const status = getStatusText(r.remaining);
                    return (
                      <tr key={i} className="border-t border-slate-200 hover:bg-slate-50 transition">
                        <td className="p-2 text-center text-slate-400 font-medium">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-900">{r.name}</td>
                        <td className="p-2 text-center text-slate-600">{r.batch || "—"}</td>
                        <td className="p-2 text-slate-700">{r.specialty || "—"}</td>
                        <td className="p-2 text-center font-mono text-slate-900">{fmt(r.fees)}</td>
                        <td className="p-2 text-center font-mono text-amber-700 font-bold">{fmt(r.prevDue || 0)}</td>
                        {MONTHS_2026.map(m => {
                          const paid = Number(r.payments?.[m]) || 0;
                          const cellId = `${r.name}-${m}`;
                          return (
                            <td
                              key={m}
                              className="p-1.5 text-center relative bg-slate-50 hover:bg-slate-100 transition"
                              onMouseEnter={() => setHoveredCell(cellId)}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {paid > 0 ? (
                                <div className="relative">
                                  <span className="font-mono text-emerald-700 font-bold cursor-pointer">
                                    {fmt(paid)}
                                  </span>
                                  {hoveredCell === cellId && (
                                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex gap-1 bg-white shadow-lg border border-slate-300 rounded px-2 py-1 z-30 whitespace-nowrap">
                                      <button
                                        onClick={() => { setEditPaymentModal({ row: r, month: m, amount: paid }); setEditAmount(String(paid)); setHoveredCell(null); }}
                                        className="px-2 py-1 bg-blue-500 text-white rounded text-[8px] hover:bg-blue-600 font-bold transition"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => { deletePayment(r, m); setHoveredCell(null); }}
                                        className="px-2 py-1 bg-red-500 text-white rounded text-[8px] hover:bg-red-600 font-bold transition"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setPaymentModal({ row: r, month: m }); setPayAmount(""); }}
                                  className="text-slate-300 hover:text-emerald-600 hover:bg-emerald-100 rounded-full w-5 h-5 flex items-center justify-center font-bold transition duration-200 text-xs"
                                  title="إضافة قسط"
                                >
                                  +
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-mono text-emerald-700 font-bold">{fmt(r.totalPaid)}</td>
                        <td className="p-2 text-center font-mono text-rose-700 font-bold">{fmt(r.remaining)}</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${status.bg} ${status.color}`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => generatePreview(r.name)}
                            className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-100 transition"
                            title="عرض الكشف"
                          >
                            🖨️
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== نافذة إضافة قسط جديد ========== */}
      {newPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" dir="rtl">
            <h3 className="font-bold text-lg border-b pb-3 mb-4 text-slate-900">➕ إضافة قسط جديد - 2026</h3>
            <form onSubmit={addNewPayment} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المتدرب *</label>
                <input
                  type="text"
                  required
                  placeholder="ابحث أو أدخل الاسم"
                  value={newStudentName}
                  onChange={e => handleNameChange(e.target.value)}
                  onFocus={() => newStudentName.length > 0 && setShowSuggestions(true)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white"
                />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 left-0 bg-white border border-slate-300 rounded-b-lg shadow-lg z-20 max-h-40 overflow-y-auto mt-1">
                    {nameSuggestions.map((n, idx) => (
                      <div key={idx} onClick={() => { setNewStudentName(n); setShowSuggestions(false); }} className="p-2.5 text-sm hover:bg-purple-50 cursor-pointer border-b last:border-0 transition">
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ *</label>
                <input type="number" required placeholder="0.00" value={newStudentAmount} onChange={e => setNewStudentAmount(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white" min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الشهر *</label>
                <select required value={newStudentMonth} onChange={e => setNewStudentMonth(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white">
                  <option value="">-- اختر الشهر --</option>
                  {MONTHS_2026.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setNewPaymentModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة تسجيل دفعة ========== */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" dir="rtl">
            <h3 className="font-bold text-lg border-b pb-3 mb-4 text-slate-900">💵 تسجيل دفعة</h3>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-900"><b>المتدرب:</b> {paymentModal.row.name}</p>
              <p className="text-sm text-emerald-900"><b>الشهر:</b> {paymentModal.month}</p>
            </div>
            <form onSubmit={addPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white"
                  autoFocus
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة تعديل قسط ========== */}
      {editPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" dir="rtl">
            <h3 className="font-bold text-lg border-b pb-3 mb-4 text-slate-900">✏️ تعديل قسط</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900"><b>{editPaymentModal.row.name}</b></p>
              <p className="text-sm text-blue-900">{editPaymentModal.month}</p>
            </div>
            <form onSubmit={editPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ الجديد *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setEditPaymentModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
                  إلغاء
                </button>
                <button type="button" onClick={() => deletePayment(editPaymentModal.row, editPaymentModal.month)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition">
                  🗑️ حذف
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة المعاينة والطباعة ========== */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl" dir="rtl">
            <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-slate-100 to-slate-50">
              <h3 className="font-bold text-sm text-slate-900">📊 كشف حساب - {previewModal.name}</h3>
              <div className="flex gap-2">
                <button onClick={() => { const w = window.open('', '', 'width=1000,height=700'); if (w) { w.document.write(previewModal.html); w.document.close(); setTimeout(() => w.print(), 500); } }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition">
                  🖨️ طباعة
                </button>
                <button onClick={() => setPreviewModal(null)} className="px-3 py-1.5 bg-slate-500 text-white rounded-lg text-xs font-bold hover:bg-slate-600 transition">
                  ✕ إغلاق
                </button>
              </div>
            </div>
            <iframe srcDoc={previewModal.html} className="flex-1 w-full border-0 rounded-b-xl" title="معاينة الكشف" />
          </div>
        </div>
      )}
    </div>
  );
}
