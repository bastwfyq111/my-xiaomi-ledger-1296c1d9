import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTableControls } from "@/hooks/useTableControls";
import { X, Printer, AlertCircle } from "lucide-react";
import TabActions from "./TabActions";

// مصفوفات الأشهر مطابقة تماماً للمسميات داخل ملفات الإكسيل المرفقة
const MONTHS_2025 = [
  "يونيو 2024", "يوليو 2024", "أغسطس 2024", 
  "مارس 2025", "ابريل 2025", "مايو 2025", 
  "يونيو 2025", "يوليو 2025", "أغسطس 2025", 
  "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"
];

const MONTHS_2026 = [
  "يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", 
  "يوليو", "اغسطس", "سبتمبر", "اكتوبر ", "نوفمبر", "ديسمبر"
];

// دالة لتنظيف وتحويل القيم النصية الفارغة إلى أرقام
const cleanNumber = (val: any): number => {
  if (!val || isNaN(Number(String(val).replace(/[^0-9.-]/g, "")))) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
};

// مكون لعرض الإحصائيات
const StatsGrid = ({ stats, columns = 3 }: { stats: any[]; columns?: number }) => {
  const colClass = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
  return (
    <div className={`grid ${colClass} gap-2 mb-4`}>
      {stats.map((stat, idx) => (
        <div key={idx} className={`${stat.bgClass} p-2 sm:p-3 rounded-lg text-center border ${stat.borderClass} shadow-sm`}>
          <div className="text-xs sm:text-sm font-medium text-slate-600">{stat.label}</div>
          <div className="text-sm sm:text-lg font-mono font-bold mt-1 text-slate-900 break-words">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};

// مكون النافذة المنبثقة
const Modal = ({ title, isOpen, onClose, children }: { title: string; isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-blue-50 to-slate-50 sticky top-0">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
};

export default function InstallmentsTab() {
  const { installments, installments2025, clearInstallments } = useStore() as any;
  const [paymentModal, setPaymentModal] = useState<{ row: any; month: string } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [newPaymentModal, setNewPaymentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentAmount, setNewStudentAmount] = useState("");
  const [newStudentMonth, setNewStudentMonth] = useState("");
  const [editPaymentModal, setEditPaymentModal] = useState<{ row: any; month: string; amount: number } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ربط أدوات التحكم بالبحث والفلترة
  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining"]);
  const controls2025 = useTableControls(installments2025 || [], ["name", "batch", "specialty", "fees", "totalPaid", "remaining"]);

  const totals2025 = useMemo(() => ({
    fees: (controls2025.rows || []).reduce((s, r) => s + cleanNumber(r.fees), 0),
    paid: (controls2025.rows || []).reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: (controls2025.rows || []).reduce((s, r) => s + cleanNumber(r.remaining), 0),
  }), [controls2025.rows]);

  const totals2026 = useMemo(() => ({
    prevDue: (controls2026.rows || []).reduce((s, r) => s + cleanNumber(r.prevDue), 0),
    paid: (controls2026.rows || []).reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: (controls2026.rows || []).reduce((s, r) => s + cleanNumber(r.remaining), 0),
  }), [controls2026.rows]);

  const allNames = useMemo(() => {
    const n1 = (installments2025 || []).map((s: any) => s.name);
    const n2 = (installments || []).map((s: any) => s.name);
    return [...new Set([...n1, ...n2])];
  }, [installments2025, installments]);

  const handleNameChange = (val: string) => {
    setNewStudentName(val);
    setShowSuggestions(val.length > 0);
    setNameSuggestions(val.length > 0 ? allNames.filter(n => n.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const updateInstallments = (list: any[]) => useStore.setState({ installments: list });

  const addPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || !payAmount) return toast.error("يرجى إدخل المبلغ");
    const amount = Number(payAmount) || 0;
    if (amount <= 0) return toast.error("مبلغ غير صحيح");
    const list = [...(installments || [])];
    const updated = list.map(s => {
      if (s.name !== paymentModal.row.name) return s;
      const payments = { ...s.payments, [paymentModal.month]: (Number(s.payments[paymentModal.month]) || 0) + amount };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      return { ...s, payments, totalPaid, remaining: Math.max(0, cleanNumber(s.prevDue) - totalPaid) };
    });
    updateInstallments(updated);
    toast.success(`تم تسجيل دفعة ${fmt(amount)}`);
    setPaymentModal(null);
    setPayAmount("");
  };

  const addNewPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentAmount || !newStudentMonth) return toast.error("يرجى إدخال جميع البيانات");
    const amount = Number(newStudentAmount) || 0;
    if (amount <= 0) return toast.error("مبلغ غير صحيح");
    const list = [...(installments || [])];
    const exist = list.find(s => s.name === newStudentName);
    if (exist) {
      const updated = list.map(s => {
        if (s.name !== newStudentName) return s;
        const payments = { ...s.payments, [newStudentMonth]: (Number(s.payments[newStudentMonth]) || 0) + amount };
        const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
        return { ...s, payments, totalPaid, remaining: Math.max(0, cleanNumber(s.prevDue) - totalPaid) };
      });
      updateInstallments(updated);
    } else {
      const payments = MONTHS_2026.reduce((acc, m) => ({ ...acc, [m]: m === newStudentMonth ? amount : 0 }), {} as any);
      const newRec = { name: newStudentName, batch: "", specialty: "", fees: 0, prevDue: 0, totalPaid: amount, remaining: Math.max(0, 0 - amount), notes: "", phone: "", payments };
      updateInstallments([...list, newRec]);
    }
    toast.success(`تم إضافة دفعة ${fmt(amount)}`);
    setNewPaymentModal(false);
    setNewStudentName("");
    setNewStudentAmount("");
    setNewStudentMonth("");
  };

  const editPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentModal || !editAmount) return;
    const newAmount = Number(editAmount) || 0;
    const list = [...(installments || [])];
    const updated = list.map(s => {
      if (s.name !== editPaymentModal.row.name) return s;
      const payments = { ...s.payments, [editPaymentModal.month]: newAmount };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      return { ...s, payments, totalPaid, remaining: Math.max(0, cleanNumber(s.prevDue) - totalPaid) };
    });
    updateInstallments(updated);
    toast.success("تم تعديل القسط");
    setEditPaymentModal(null);
    setEditAmount("");
  };

  const deletePayment = (row: any, month: string) => {
    if (!confirm(`حذف قسط شهر ${month}؟`)) return;
    const list = [...(installments || [])];
    const updated = list.map(s => {
      if (s.name !== row.name) return s;
      const payments = { ...s.payments, [month]: 0 };
      const totalPaid = MONTHS_2026.reduce((sum, m) => sum + (Number(payments[m]) || 0), 0);
      return { ...s, payments, totalPaid, remaining: Math.max(0, cleanNumber(s.prevDue) - totalPaid) };
    });
    updateInstallments(updated);
    toast.success(`تم حذف قسط شهر ${month}`);
    if (editPaymentModal) setEditPaymentModal(null);
  };

  // 📥 دالة استيراد وتوفيق الملفات المحدثة بالكامل
  const importFile = (e: React.ChangeEvent<HTMLInputElement>, year: 2025 | 2026) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const formattedData = json.map((row: any) => {
          const monthsList = year === 2025 ? MONTHS_2025 : MONTHS_2026;
          const payments: any = {};
          let totalPaid = 0;
          
          // البحث المرن والمطابقة للأعمدة مع إزالة المسافات الزائدة
          monthsList.forEach(m => {
            const cleanTarget = m.trim();
            // البحث عن المفتاح المطابق داخل سطر الإكسيل بشكل مرن
            const foundKey = Object.keys(row).find(k => k.trim() === cleanTarget || k === m);
            const amount = foundKey ? cleanNumber(row[foundKey]) : 0;
            payments[m] = amount;
            totalPaid += amount;
          });

          // العثور على المفاتيح الأساسية للبيانات باللغة العربية
          const nameKey = Object.keys(row).find(k => k.includes("اسم المتدرب")) || "name";
          const batchKey = Object.keys(row).find(k => k.includes("رقم الدفعة")) || "batch";
          const specialtyKey = Object.keys(row).find(k => k.includes("المساق")) || "specialty";
          const feesKey = Object.keys(row).find(k => k.includes("مبلغ الرسوم")) || "fees";
          const prevDueKey = Object.keys(row).find(k => k.includes("المتبقي عليهم من العام 2025")) || "prevDue";
          const remainingKey = Object.keys(row).find(k => k.trim() === "المتبقي") || "remaining";
          const notesKey = Object.keys(row).find(k => k.includes("ملاحظات")) || "notes";
          const phoneKey = Object.keys(row).find(k => k.includes("رقم الهاتف")) || "phone";

          return {
            name: row[nameKey] || "بدون اسم",
            batch: row[batchKey] || "",
            specialty: row[specialtyKey] || "",
            fees: cleanNumber(row[feesKey]),
            prevDue: cleanNumber(row[prevDueKey]),
            totalPaid: row['الإجمالي'] ? cleanNumber(row['الإجمالي']) : totalPaid,
            remaining: cleanNumber(row[remainingKey]),
            notes: row[notesKey] || "",
            phone: row[phoneKey] || "",
            payments
          };
        });

        if (year === 2025) {
            useStore.setState({ installments2025: formattedData });
        } else {
            useStore.setState({ installments: formattedData });
        }
        
        toast.success(`تم استيراد بيانات العام ${year} بنجاح من ملف التميز!`);
        setImportError(null);
      } catch (error) {
        setImportError("حدث خطأ في قراءة ملف الإكسيل، يرجى مراجعة ترويسة الجدول.");
        toast.error("فشل استيراد الملف");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const getStatusText = (rem: number) => rem <= 0 ? { text: "له", color: "text-emerald-600", bg: "bg-emerald-50" } : { text: "عليه", color: "text-rose-600", bg: "bg-rose-50" };

  const generateAccountStatement = (row: any, year: number) => {
    const monthsList = year === 2025 ? MONTHS_2025 : MONTHS_2026;
    const fees = cleanNumber(row.fees);
    const prevDue = cleanNumber(row.prevDue);
    const totalPaid = monthsList.reduce((s, m) => s + (Number(row.payments?.[m]) || 0), 0);
    const dueTotal = year === 2026 ? (prevDue || fees) : fees;
    const remaining = dueTotal - totalPaid;

    const paidRows = monthsList
      .map((m) => {
        const amount = Number(row.payments?.[m]) || 0;
        if (amount <= 0) return "";
        return `<tr><td class="lbl">سداد شهر ${m} (له)</td><td class="num pay">${fmt(amount)}</td></tr>`;
      })
      .join("");

    const infoCard = (label: string, value: string) =>
      `<div class="info"><div class="info-lbl">${label}</div><div class="info-val">${value || "—"}</div></div>`;

    const prevRow = year === 2026
      ? `<tr><td class="lbl">متبقي من العام 2025 (عليه)</td><td class="num due">${fmt(prevDue)}</td></tr>`
      : "";

    const remainingLabel = remaining > 0 ? "الرصيد المتبقي عليه" : remaining < 0 ? "الرصيد له" : "تم السداد بالكامل";
    const remainingClass = remaining > 0 ? "due" : "pay";

    return `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>كشف حساب - ${row.name}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800&family=Tajawal:wght@400;500;700&display=swap">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Cairo','Tajawal',Tahoma,Arial,sans-serif; direction: rtl; color: #0f172a; background: #fff; margin: 0; padding: 16px; }
          .wrap { max-width: 760px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
          .top { background: linear-gradient(90deg, #0f766e, #14b8a6); color: #fff; padding: 14px 20px; font-size: 20px; font-weight: 800; }
          .body { padding: 18px 20px 22px; }
          .title { text-align: right; }
          .title h2 { margin: 0; color: #0f172a; font-size: 18px; font-weight: 800; }
          .title p { margin: 4px 0 0; color: #64748b; font-size: 13px; font-weight: 500; }
          .divider { height: 1px; background: #e2e8f0; margin: 14px 0 16px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
          .info { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
          .info-lbl { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 2px; }
          .info-val { font-size: 14px; color: #0f172a; font-weight: 700; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; }
          thead th { background: #e0f2fe; color: #0c4a6e; font-weight: 800; padding: 10px; font-size: 14px; border-bottom: 1px solid #cbd5e1; text-align: center; }
          tbody td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          tbody tr:last-child td { border-bottom: none; }
          td.lbl { text-align: right; color: #1e293b; }
          td.num { text-align: center; font-family: 'Cairo', monospace; font-weight: 700; width: 38%; }
          td.due { color: #dc2626; }
          td.pay { color: #2563eb; }
          tr.sub td { background: #e0f2fe; font-weight: 800; color: #0c4a6e; }
          tr.sub-pay td { background: #dbeafe; font-weight: 800; color: #1d4ed8; }
          tr.final td { background: #fee2e2; font-weight: 800; }
          tr.final td.lbl { color: #991b1b; }
          @media print { body { padding: 0; } .wrap { border: none; } }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="top">كشف حساب</div>
          <div class="body">
            <div class="title">
              <h2>المجلس اليمني للاختصاصات الطبية - صعدة</h2>
              <p>كشف حساب أقساط - العام ${year}م</p>
            </div>
            <div class="divider"></div>
            <div class="grid">
              ${infoCard("الاسم", row.name)}
              ${infoCard("الدفعة", row.batch)}
              ${infoCard("المساق", row.specialty)}
              ${infoCard("رقم الهاتف", row.phone)}
            </div>
            <table>
              <thead><tr><th style="width:62%">البيان</th><th>المبلغ</th></tr></thead>
              <tbody>
                <tr><td class="lbl">رسوم الدراسة</td><td class="num">${fmt(fees)}</td></tr>
                ${prevRow}
                <tr class="sub"><td class="lbl">إجمالي المستحق عليه</td><td class="num">${fmt(dueTotal)}</td></tr>
                ${paidRows}
                <tr class="sub-pay"><td class="lbl">إجمالي المسدد (له)</td><td class="num pay">${fmt(totalPaid)}</td></tr>
                <tr class="final"><td class="lbl">${remainingLabel}</td><td class="num ${remainingClass}">${fmt(Math.abs(remaining))}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const printStatement = (row: any, year: number) => {
    const html = generateAccountStatement(row, year);
    const w = window.open("", "", "width=850,height=700");
    if (w) { 
      w.document.write(html); 
      w.document.close(); 
      setTimeout(() => w.print(), 250); 
    }
  };

  const stats2025 = [
    { label: "إجمالي الرسوم التقديرية", value: fmt(totals2025.fees), bgClass: "bg-slate-50", borderClass: "border-slate-200" },
    { label: "إجمالي الأقساط المسددة", value: fmt(totals2025.paid), bgClass: "bg-emerald-50", borderClass: "border-emerald-200" },
    { label: "إجمالي المتبقي والأرشيف", value: fmt(totals2025.remaining), bgClass: "bg-rose-50", borderClass: "border-rose-200" }
  ];

  const stats2026 = [
    { label: "المدور (متبقي 2025)", value: fmt(totals2026.prevDue), bgClass: "bg-amber-50", borderClass: "border-amber-200" },
    { label: "إجمالي مسدد 2026", value: fmt(totals2026.paid), bgClass: "bg-emerald-50", borderClass: "border-emerald-200" },
    { label: "صافي رصيد المتبقي", value: fmt(totals2026.remaining), bgClass: "bg-rose-50", borderClass: "border-rose-200" }
  ];

  return (
    <div className="w-full space-y-4 sm:space-y-6 p-0" dir="rtl">
      {/* ========== واجهة جدول 2025 ========== */}
      <div className="w-full bg-gradient-to-b from-teal-50 to-white shadow border border-teal-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-teal-600 to-teal-700 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">📊 أقساط ومستندات العام 2025</h2>
            <p className="text-xs text-teal-100">يشمل جميع الدفعات لعامي 2024 و 2025</p>
          </div>
          <label className="px-3 py-1.5 bg-white text-teal-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-teal-50 shadow">
            📥 استيراد الملف <input type="file" accept=".xlsx,.xls" onChange={e => importFile(e, 2025)} className="hidden" />
          </label>
        </div>
        {importError && <div className="bg-red-50 border-b border-red-200 p-3 flex gap-2"><AlertCircle className="w-5 h-5 text-red-600" /><p className="text-sm text-red-700">{importError}</p></div>}
        <div className="p-3 sm:p-4">
          <StatsGrid stats={stats2025} columns={3} />
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="p-2 text-center">#</th>
                  <th className="p-2 text-right min-w-[150px]">اسم المتدرب</th>
                  <th className="p-2 text-center">الدفعة</th>
                  <th className="p-2 text-right">المساق</th>
                  <th className="p-2 text-center">الرسوم</th>
                  {MONTHS_2025.map(m => <th key={m} className="p-1 text-center text-[11px] bg-slate-50 border-l border-slate-200 whitespace-nowrap">{m}</th>)}
                  <th className="p-2 text-center text-emerald-700">المسدد</th>
                  <th className="p-2 text-center text-rose-700">المتبقي</th>
                  <th className="p-2 text-center">طباعة</th>
                </tr>
              </thead>
              <tbody>
                {controls2025.rows.length === 0 ? (
                  <tr><td colSpan={8 + MONTHS_2025.length} className="p-6 text-center text-slate-400">يرجى استيراد ملف "الاقساط للعام 2025.xlsx"</td></tr>
                ) : (
                  <>
                    {controls2025.rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-200 hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 text-center text-slate-500">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-900">{r.name}</td>
                        <td className="p-2 text-center text-slate-600">{r.batch || "—"}</td>
                        <td className="p-2 text-slate-600">{r.specialty || "—"}</td>
                        <td className="p-2 text-center font-mono font-semibold text-slate-700">{fmt(r.fees)}</td>
                        {MONTHS_2025.map(m => {
                          const paid = Number(r.payments?.[m]) || 0;
                          return <td key={m} className="p-1 text-center bg-slate-50/50 border-l border-slate-200">{paid > 0 ? <span className="text-emerald-700 font-bold font-mono">{fmt(paid)}</span> : <span className="text-slate-300">—</span>}</td>;
                        })}
                        <td className="p-2 text-center font-mono text-emerald-700 font-bold bg-emerald-50/30">{fmt(r.totalPaid)}</td>
                        <td className="p-2 text-center font-mono text-rose-700 font-bold bg-rose-50/30">{fmt(r.remaining)}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => printStatement(r, 2025)} className="p-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-500 hover:text-white transition-colors">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-teal-300 bg-teal-50 font-bold text-teal-900">
                      <td className="p-2 text-center" colSpan={4}>الإجمالي العام</td>
                      <td className="p-2 text-center font-mono">{fmt(totals2025.fees)}</td>
                      {MONTHS_2025.map(m => {
                        const total = controls2025.rows.reduce((sum, r) => sum + (Number(r.payments?.[m]) || 0), 0);
                        return <td key={m} className="p-1 text-center bg-teal-50 border-l border-teal-200 font-mono text-emerald-800">{total > 0 ? fmt(total) : "—"}</td>;
                      })}
                      <td className="p-2 text-center font-mono text-emerald-700 bg-emerald-100/50">{fmt(totals2025.paid)}</td>
                      <td className="p-2 text-center font-mono text-rose-700 bg-rose-100/50">{fmt(totals2025.remaining)}</td>
                      <td></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== واجهة جدول 2026 ========== */}
      <div className="w-full bg-gradient-to-b from-purple-50 to-white shadow border border-purple-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-purple-600 to-purple-700 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">📊 سجل أقساط العام الحالي 2026</h2>
            <p className="text-xs text-purple-100">بيانات المسدد والرصيد المدور لعام 2026</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setNewPaymentModal(true)} className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold shadow hover:bg-purple-200 transition-colors">➕ إضافة قسط</button>
            <label className="px-3 py-1.5 bg-white text-purple-700 rounded-lg text-xs font-bold cursor-pointer shadow hover:bg-purple-50 transition-colors">
              📥 استيراد الملف <input type="file" accept=".xlsx,.xls" onChange={e => importFile(e, 2026)} className="hidden" />
            </label>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <StatsGrid stats={stats2026} columns={3} />
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="p-2 text-center">#</th>
                  <th className="p-2 text-right min-w-[150px]">اسم المتدرب</th>
                  <th className="p-2 text-center">دفعة</th>
                  <th className="p-2 text-right">المساق</th>
                  <th className="p-2 text-center bg-amber-50 text-amber-900">مدور 2025</th>
                  {MONTHS_2026.map(m => <th key={m} className="p-1 text-center text-xs bg-slate-50 border-l border-slate-200 whitespace-nowrap">{m.trim()}</th>)}
                  <th className="p-2 text-center text-emerald-700">مسدد 2026</th>
                  <th className="p-2 text-center text-rose-700">الرصيد المتبقي</th>
                  <th className="p-2 text-center">حالة</th>
                  <th className="p-2 text-center">طباعة</th>
                </tr>
              </thead>
              <tbody>
                {controls2026.rows.length === 0 ? (
                  <tr><td colSpan={6 + MONTHS_2026.length} className="p-6 text-center text-slate-400">يرجى استيراد ملف "الاقساط للعام 2026.xlsx"</td></tr>
                ) : (
                  <>
                    {controls2026.rows.map((r, i) => {
                      const status = getStatusText(r.remaining);
                      return (
                        <tr key={i} className="border-t border-slate-200 hover:bg-slate-50/80 transition-colors">
                          <td className="p-2 text-center text-slate-500">{i + 1}</td>
                          <td className="p-2 font-semibold text-slate-900">{r.name}</td>
                          <td className="p-2 text-center text-slate-600">{r.batch || "—"}</td>
                          <td className="p-2 text-slate-600">{r.specialty || "—"}</td>
                          <td className="p-2 text-center font-mono text-amber-700 font-bold bg-amber-50/20">{fmt(r.prevDue)}</td>
                          {MONTHS_2026.map(m => {
                            const paid = Number(r.payments?.[m]) || 0;
                            const cellId = `${r.name}-${m}`;
                            return (
                              <td key={m} className="p-1 text-center relative bg-slate-50/50 border-l border-slate-200 hover:bg-slate-100 cursor-pointer group transition-colors"
                                onMouseEnter={() => setHoveredCell(cellId)} onMouseLeave={() => setHoveredCell(null)}>
                                {paid > 0 ? (
                                  <div className="relative">
                                    <span className="font-mono text-emerald-700 font-bold">{fmt(paid)}</span>
                                    {hoveredCell === cellId && (
                                      <div className="absolute -top-7 right-0 flex gap-0.5 bg-white shadow-xl border rounded px-1 py-1 z-30">
                                        <button onClick={() => { setEditPaymentModal({ row: r, month: m, amount: paid }); setEditAmount(String(paid)); setHoveredCell(null); }} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px]">✏️</button>
                                        <button onClick={() => { deletePayment(r, m); setHoveredCell(null); }} className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px]">🗑️</button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <button onClick={() => { setPaymentModal({ row: r, month: m }); setPayAmount(""); }} className="text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-full w-5 h-5 flex items-center justify-center font-bold mx-auto">+</button>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-2 text-center font-mono text-emerald-700 font-bold bg-emerald-50/30">{fmt(r.totalPaid)}</td>
                          <td className="p-2 text-center font-mono text-rose-700 font-bold bg-rose-50/30">{fmt(r.remaining)}</td>
                          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>{status.text}</span></td>
                          <td className="p-2 text-center">
                            <button onClick={() => printStatement(r, 2026)} className="p-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-500 hover:text-white transition-colors">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold text-purple-900">
                      <td className="p-2 text-center" colSpan={4}>الإجمالي العام</td>
                      <td className="p-2 text-center font-mono text-amber-700 bg-amber-100/30">{fmt(totals2026.prevDue)}</td>
                      {MONTHS_2026.map(m => {
                        const total = controls2026.rows.reduce((sum, r) => sum + (Number(r.payments?.[m]) || 0), 0);
                        return <td key={m} className="p-1 text-center bg-purple-50 border-l border-purple-200 font-mono text-emerald-800">{total > 0 ? fmt(total) : "—"}</td>;
                      })}
                      <td className="p-2 text-center font-mono text-emerald-700 bg-emerald-100/50">{fmt(totals2026.paid)}</td>
                      <td className="p-2 text-center font-mono text-rose-700 bg-rose-100/50">{fmt(totals2026.remaining)}</td>
                      <td></td><td></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== النوافذ المنبثقة ========== */}
      <Modal title="➕ إضافة قسط جديد - 2026" isOpen={newPaymentModal} onClose={() => setNewPaymentModal(false)}>
        <form onSubmit={addNewPayment} className="space-y-3">
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المتدرب *</label>
            <input type="text" required placeholder="ابحث عن الاسم" value={newStudentName} onChange={e => handleNameChange(e.target.value)} onFocus={() => newStudentName.length > 0 && setShowSuggestions(true)} className="w-full p-2 border rounded-lg outline-none" />
            {showSuggestions && nameSuggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 bg-white border rounded-b-lg shadow-xl z-50 max-h-32 overflow-y-auto">
                {nameSuggestions.map((n, idx) => <div key={idx} onClick={() => { setNewStudentName(n); setShowSuggestions(false); }} className="p-2 text-sm hover:bg-purple-50 cursor-pointer text-slate-800">{n}</div>)}
              </div>
            )}
          </div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المالي *</label><input type="number" required value={newStudentAmount} onChange={e => setNewStudentAmount(e.target.value)} className="w-full p-2 border rounded-lg" min="0" step="0.01" /></div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">الشهر المستهدف *</label><select required value={newStudentMonth} onChange={e => setNewStudentMonth(e.target.value)} className="w-full p-2 border rounded-lg"><option value="">-- اختر الشهر --</option>{MONTHS_2026.map(m => <option key={m} value={m}>{m.trim()}</option>)}</select></div>
          <div className="flex justify-end gap-2 pt-3 border-t mt-4">
            <button type="button" onClick={() => setNewPaymentModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">إلغاء</button>
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold">حفظ</button>
          </div>
        </form>
      </Modal>

      <Modal title="💵 تسجيل دفعة مالية" isOpen={!!paymentModal} onClose={() => setPaymentModal(null)}>
        {paymentModal && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-slate-800">
              <p><b>المتدرب:</b> {paymentModal.row.name}</p>
              <p><b>شهر:</b> {paymentModal.month}</p>
            </div>
            <form onSubmit={addPayment} className="space-y-3 mt-3">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المدفوع *</label><input type="number" required value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full p-2 border rounded-lg" autoFocus min="0" step="0.01" /></div>
              <div className="flex justify-end gap-2 pt-3 border-t mt-4">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">تأكيد التوريد</button>
              </div>
            </form>
          </>
        )}
      </Modal>

      <Modal title="✏️ مراجعة وتعديل القسط" isOpen={!!editPaymentModal} onClose={() => setEditPaymentModal(null)}>
        {editPaymentModal && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-slate-800">
              <p className="font-bold">{editPaymentModal.row.name}</p>
              <p>بيان شهر: {editPaymentModal.month}</p>
            </div>
            <form onSubmit={editPayment} className="space-y-3 mt-3">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المعدل *</label><input type="number" required value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full p-2 border rounded-lg" min="0" step="0.01" /></div>
              <div className="flex justify-end gap-2 pt-3 border-t mt-4">
                <button type="button" onClick={() => setEditPaymentModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">إلغاء</button>
                <button type="button" onClick={() => deletePayment(editPaymentModal.row, editPaymentModal.month)} className="px-4 py-2 bg-red-600 text-white rounded-lg">🗑️ حذف القسط</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">حفظ التعديل</button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
