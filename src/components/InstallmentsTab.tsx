import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { X, ChevronDown } from "lucide-react";

const MONTHS_2025 = ["يونيو 2024", "يوليو 2024", "أغسطس 2024", "مارس 2025", "ابريل 2025", "مايو 2025", "يونيو 2025", "يوليو 2025", "أغسطس 2025", "سبتمبر"];
const MONTHS_2026 = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
};

// مكون إعادة استخدام الإحصائيات - محسّن للجوال
const StatsGrid = ({ stats, columns = 3 }: { stats: any[]; columns?: number }) => {
  const colClass = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
  return (
    <div className={`grid ${colClass} gap-2 mb-4`}>
      {stats.map((stat, idx) => (
        <div key={idx} className={`${stat.bgClass} p-2 sm:p-3 rounded-lg text-center border ${stat.borderClass} shadow-sm`}>
          <div className="text-xs sm:text-sm font-medium text-slate-600">{stat.label}</div>
          <div className="text-sm sm:text-base font-mono font-bold mt-1 text-slate-900 break-words">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};

// نافذة جديدة محسّنة للجوال
const Modal = ({ title, isOpen, onClose, children }: { title: string; isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        {/* رأس النافذة */}
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-blue-50 to-slate-50 sticky top-0">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        {/* محتوى النافذة */}
        <div className="p-4 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
};

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
    toast.success(`تم تسجيل دفعة ${fmt(amount)}`);
    setPaymentModal(null);
    setPayAmount("");
  };

  const addNewPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentAmount || !newStudentMonth) return toast.error("يرجى إدخال جميع البيانات");

    const amount = Number(newStudentAmount) || 0;
    if (amount <= 0) return toast.error("يرجى إدخال ��بلغ صحيح");

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
    if (!confirm(`حذف قسط شهر ${month}؟`)) return;

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
        toast.success(`تم استيراد ${data.length} سجل`);
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
    <div className="space-y-4 sm:space-y-6 p-0 w-full" dir="rtl">
      {/* ========== جدول 2025 ========== */}
      <div className="bg-gradient-to-b from-teal-50 to-white shadow border border-teal-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-teal-600 to-teal-700 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white">📊 أقساط 2025</h2>
              <p className="text-xs text-teal-100 mt-1">الأرشيف</p>
            </div>
            <label className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white text-teal-700 rounded-lg text-xs sm:text-sm font-bold cursor-pointer hover:bg-teal-50 transition active:scale-95 flex-shrink-0">
              📥 استيراد
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2025)} className="hidden" />
            </label>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <StatsGrid stats={stats2025} columns={3} />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 sticky top-0">
                <tr>
                  <th className="p-2 sm:p-3 text-center text-slate-700">#</th>
                  <th className="p-2 sm:p-3 text-right text-slate-700 min-w-24">الاسم</th>
                  <th className="p-2 sm:p-3 text-center text-slate-700">الدفعة</th>
                  <th className="p-2 sm:p-3 text-right text-slate-700 min-w-20">المساق</th>
                  <th className="p-2 sm:p-3 text-center text-slate-700">رسوم</th>
                  <th className="p-2 sm:p-3 text-center text-emerald-700">مسدد</th>
                  <th className="p-2 sm:p-3 text-center text-rose-700">متبقي</th>
                </tr>
              </thead>
              <tbody>
                {controls2025.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 text-sm">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  controls2025.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-slate-200 hover:bg-slate-50 transition">
                      <td className="p-2 sm:p-3 text-center text-slate-400 font-medium">{i + 1}</td>
                      <td className="p-2 sm:p-3 font-semibold text-slate-900 truncate">{r.name}</td>
                      <td className="p-2 sm:p-3 text-center text-slate-600 text-xs">{r.batch || "—"}</td>
                      <td className="p-2 sm:p-3 text-slate-700 text-xs truncate">{r.specialty || "—"}</td>
                      <td className="p-2 sm:p-3 text-center font-mono text-slate-900 text-xs">{fmt(r.fees)}</td>
                      <td className="p-2 sm:p-3 text-center font-mono text-emerald-700 font-bold text-xs">{fmt(r.totalPaid)}</td>
                      <td className="p-2 sm:p-3 text-center font-mono text-rose-700 font-bold text-xs">{fmt(r.remaining)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== جدول 2026 ========== */}
      <div className="bg-gradient-to-b from-purple-50 to-white shadow border border-purple-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-purple-600 to-purple-700 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white">📊 أقساط 2026</h2>
              <p className="text-xs text-purple-100 mt-1">العام الحالي</p>
            </div>
            <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-end flex-shrink-0">
              <button onClick={() => setNewPaymentModal(true)} className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white text-purple-700 rounded-lg text-xs sm:text-sm font-bold hover:bg-purple-50 transition active:scale-95">
                ➕ إضافة
              </button>
              <label className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white text-purple-700 rounded-lg text-xs sm:text-sm font-bold cursor-pointer hover:bg-purple-50 transition active:scale-95">
                📥 استيراد
                <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2026)} className="hidden" />
              </label>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <StatsGrid stats={stats2026} columns={4} />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 sticky top-0">
                <tr>
                  <th className="p-1.5 sm:p-2 text-center text-slate-700">#</th>
                  <th className="p-1.5 sm:p-2 text-right text-slate-700 min-w-20">الاسم</th>
                  <th className="p-1.5 sm:p-2 text-center text-slate-700 w-14">دفعة</th>
                  <th className="p-1.5 sm:p-2 text-center text-slate-700 w-12">2026</th>
                  <th className="p-1.5 sm:p-2 text-center text-slate-700 w-12">2025</th>
                  {MONTHS_2026.map(m => (
                    <th key={m} className="p-1 text-center text-slate-700 text-xs w-10 bg-slate-50 border-l border-slate-200 font-semibold">{m.substring(0, 3)}</th>
                  ))}
                  <th className="p-1.5 sm:p-2 text-center text-emerald-700 w-10">مسدد</th>
                  <th className="p-1.5 sm:p-2 text-center text-rose-700 w-10">رصيد</th>
                  <th className="p-1.5 sm:p-2 text-center text-slate-700 w-10">حالة</th>
                </tr>
              </thead>
              <tbody>
                {controls2026.rows.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-4 text-center text-slate-400 text-sm">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  controls2026.rows.map((r: any, i: number) => {
                    const status = getStatusText(r.remaining);
                    return (
                      <tr key={i} className="border-t border-slate-200 hover:bg-slate-50 transition">
                        <td className="p-1.5 sm:p-2 text-center text-slate-400 font-medium">{i + 1}</td>
                        <td className="p-1.5 sm:p-2 font-semibold text-slate-900 truncate text-xs">{r.name}</td>
                        <td className="p-1.5 sm:p-2 text-center text-slate-600 text-xs">{r.batch || "—"}</td>
                        <td className="p-1.5 sm:p-2 text-center font-mono text-slate-900 text-xs">{fmt(r.fees)}</td>
                        <td className="p-1.5 sm:p-2 text-center font-mono text-amber-700 font-bold text-xs">{fmt(r.prevDue || 0)}</td>
                        {MONTHS_2026.map(m => {
                          const paid = Number(r.payments?.[m]) || 0;
                          const cellId = `${r.name}-${m}`;
                          return (
                            <td
                              key={m}
                              className="p-1 text-center relative bg-slate-50 border-l border-slate-200 hover:bg-slate-100 transition cursor-pointer group"
                              onMouseEnter={() => setHoveredCell(cellId)}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {paid > 0 ? (
                                <div className="relative">
                                  <span className="font-mono text-emerald-700 font-bold text-xs block">{fmt(paid).substring(0, 5)}</span>
                                  {hoveredCell === cellId && (
                                    <div className="absolute -top-7 right-0 flex gap-0.5 bg-white shadow-lg border border-slate-300 rounded px-1 py-1 z-30 whitespace-nowrap">
                                      <button
                                        onClick={() => { setEditPaymentModal({ row: r, month: m, amount: paid }); setEditAmount(String(paid)); setHoveredCell(null); }}
                                        className="px-1 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 font-bold transition"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => { deletePayment(r, m); setHoveredCell(null); }}
                                        className="px-1 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 font-bold transition"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setPaymentModal({ row: r, month: m }); setPayAmount(""); }}
                                  className="text-slate-300 hover:text-emerald-600 hover:bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center font-bold transition text-xs"
                                  title="إضافة"
                                >
                                  +
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-1.5 sm:p-2 text-center font-mono text-emerald-700 font-bold text-xs">{fmt(r.totalPaid)}</td>
                        <td className="p-1.5 sm:p-2 text-center font-mono text-rose-700 font-bold text-xs">{fmt(r.remaining)}</td>
                        <td className="p-1.5 sm:p-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.color} block truncate`}>
                            {status.text}
                          </span>
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
      <Modal title="➕ إضافة قسط جديد - 2026" isOpen={newPaymentModal} onClose={() => setNewPaymentModal(false)}>
        <form onSubmit={addNewPayment} className="space-y-3">
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">اسم المتدرب *</label>
            <input
              type="text"
              required
              placeholder="ابحث أو أدخل الاسم"
              value={newStudentName}
              onChange={e => handleNameChange(e.target.value)}
              onFocus={() => newStudentName.length > 0 && setShowSuggestions(true)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white"
            />
            {showSuggestions && nameSuggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 bg-white border border-slate-300 rounded-b-lg shadow-lg z-20 max-h-32 overflow-y-auto mt-1">
                {nameSuggestions.map((n, idx) => (
                  <div key={idx} onClick={() => { setNewStudentName(n); setShowSuggestions(false); }} className="p-2 text-sm hover:bg-purple-50 cursor-pointer border-b last:border-0 transition">
                    {n}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">المبلغ *</label>
            <input type="number" required placeholder="0.00" value={newStudentAmount} onChange={e => setNewStudentAmount(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">الشهر *</label>
            <select required value={newStudentMonth} onChange={e => setNewStudentMonth(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white">
              <option value="">-- اختر الشهر --</option>
              {MONTHS_2026.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={() => setNewPaymentModal(false)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
              إلغاء
            </button>
            <button type="submit" className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition">
              حفظ
            </button>
          </div>
        </form>
      </Modal>

      {/* ========== نافذة تسجيل دفعة ========== */}
      <Modal title="💵 تسجيل دفعة" isOpen={!!paymentModal} onClose={() => setPaymentModal(null)}>
        {paymentModal && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm text-emerald-900"><b>المتدرب:</b> {paymentModal.row.name}</p>
              <p className="text-sm text-emerald-900"><b>الشهر:</b> {paymentModal.month}</p>
            </div>
            <form onSubmit={addPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">المبلغ *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                  autoFocus
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
                  إلغاء
                </button>
                <button type="submit" className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition">
                  حفظ
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* ========== نافذة تعديل قسط ========== */}
      <Modal title="✏️ تعديل قسط" isOpen={!!editPaymentModal} onClose={() => setEditPaymentModal(null)}>
        {editPaymentModal && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-bold text-blue-900">{editPaymentModal.row.name}</p>
              <p className="text-sm text-blue-900">{editPaymentModal.month}</p>
            </div>
            <form onSubmit={editPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">المبلغ الجديد *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setEditPaymentModal(null)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
                  إلغاء
                </button>
                <button type="button" onClick={() => deletePayment(editPaymentModal.row, editPaymentModal.month)} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition">
                  🗑️ حذف
                </button>
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">
                  حفظ
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
