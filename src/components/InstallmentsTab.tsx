import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

const MONTHS_2025 = ["يونيو 2024", "يوليو 2024", "أغسطس 2024", "مارس 2025", "ابريل 2025", "مايو 2025", "يونيو 2025", "يوليو 2025", "أغسطس 2025", "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"];
const MONTHS_2026 = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر ", "نوفمبر", "ديسمبر"];

const cleanNumber = (val: any): number => {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
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
  const [hoveredCell, setHoveredCell] = useState<string | null>(null); // تتبع الخلية النشطة

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
    paid: controwhite2026.rows.reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
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
      setNameSuggestions(allNames.filter((n: string) => n.includes(value)));
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
    setPaymentModal(null); setPayAmount("");
  };

  const addNewPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentAmount || !newStudentMonth) return toast.error("يرجى إدخال جميع البيانات");
    
    const amount = Number(newStudentAmount) || 0;
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
    setNewStudentName(""); setNewStudentAmount(""); setNewStudentMonth("");
  };

  const editPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPaymentModal || !editAmount) return;
    
    const newAmount = Number(editAmount) || 0;
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
    setEditPaymentModal(null); setEditAmount("");
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
      } catch { toast.error("خطأ في معالجة الملف"); }
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
      if (!r) return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;opacity:0.5"><div style="background:${color};color:white;padding:6px 12px;font-size:14px">📅 ${year}</div><div style="padding:15px;text-align:center;color:#94a3b8;font-size:10px">لا توجد بيانات</div></div>`;

      const paidMonths = months.filter(m => Number(r.payments?.[m]) > 0);
      if (paidMonths.length === 0) {
        return `<div style="border:2px solid #e2e8f0;bordradiusius:8px;overflow:hidden"><div style="background:${color};color:white;padding:6px 12px;font-size:14px">📅 ${year}</div><div style="padding:10px;text-align:center;color:#94a3b8;font-size:10px">الرصيد: ${fmt(opening)}<br>لا توجد مدفوعات</div></div>`;
      }

      let balance = opening;
      const rows = paidMonths.map(m => {
        const paid = Number(r.payments?.[m]) || 0;
        balance -= paid;
        const status = balance <= 0 ? "له" : "عليه";
        const sc = balance <= 0 ? "#059669" : "#dc2626";
        const bg = balance <= 0 ? "#d1fae5" : "#fee2e2";
        return `<tr><td style="padding:4px 8px;font-size:9px">${m}</td><td style="padding:4px 8px;font-size:9px;text-align:center">${fmt(paid)}</td><td style="padding:4px 8px;font-size:9px;text-align:center;color:${sc}">${fmt(Math.max(0, balance))}</td><td style="padding:4px 8px;text-align:center"><span style="background:${bg};color:${sc};padding:1px 8px;border-radius:8px;font-size:8px;font-weight:700">${status}</span></td></tr>`;
      }).join("");

      const finalBalance = Math.max(0, balance);
      return `<div style="border:2px solid #e2e8f0;border-radius:8px;overflow:hidden;background:white"><div style="background:${color};color:white;padding:6px 12px;display:flex;justify-content:space-between"><span style="font-size:11px;font-weight:700">📅 ${year}</span><span style="font-size:9px">${r.specialty||''} ${r.batch||''}</span></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#e2e8f0;text-align:center"><div style="background:#f8fafc;padding:5px"><div style="font-size:13px;color:#64748b">الرصيد الافتتاحي</div><div style="font-size:14px;font-weight:1000">${fmt(opening)}</div></div><div style="background:#f8fafc;padding:5px"><div style="font-size:7px;color:#64748b">المسدد</div><div style="font-size:14px;font-weight:1000;color:#059669">${fmt(r.totalPaid||0)}</div></div><div style="background:#f8fafc;padding:5px"><div style="font-size: 14;color:#64748b">الرصيد</div><div divle="font-size:11px;font-weigweight;color:${finalBalance > 0 ? '#dc2626' : '#059669'}">${fmt(finalBalance)}</div></div></div><table width="100%" style="border-collapse:collapse"><thead><tr style="background:#f8fafc"><th style="padding:4px 8px;font-size:8px;color:#64748b">الشهر</th><th style="padding:4px 8px;font-size:8px;color:#64748b">المبلغ</th><th style="padding:4px 8px;font-size:8px;color:#64748b">الرصيد</th><th style="padding:4px 8px;font-size:8px;color:#64748b">الحالة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    };

    const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo',sans-serif;background:#f1f5f9;padding:8px;direction:rtl}.container{max-width:1100px;margin:0 auto;background:white;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.04);overflow:hidden}.header{background:#1e293b;color:white;padding:10px 18px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:13px;font-weight:700}.header .date{font-size:9px;opacity:0.8}.student-bar{background:linear-gradient(135deg,#0891b2,#06b6d4);color:white;padding:8px 18px;display:flex;justify-content:space-between}.student-bar .name{font-size:13px;font-weight:700}.student-bar .phone{font-size:9px;opacity:0.9}.content{padding:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.btn{padding:5px 15px;border:none;border-radius:5px;font-family:'Cairo';font-size:10px;font-weight:700;cursor:pointer;color:white}@media print{body{background:white;padding:0}.container{box-shadow:none}.btn{display:none}}@media(max-width:768px){.grid{grid-template-columns:1fr}}`;

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body><div class="container"><div class="header"><h1>📊 المجلس اليمني للاختصاصات الطبية</h1><span class="date">📅 ${today()}</span></div><div class="student-bar"><span class="name">👨‍⚕️ ${name}</span><span class="phone">📱 ${r2025?.phone || r2026?.phone || ''}</span></div><div class="content"><div class="grid">${buildTable(r2025, MONTHS_2025, "2025", cleanNumber(r2025?.fees||0), "#0891b2")}${buildTable(r2026, MONTHS_2026, "2026", cleanNumber(r2026?.prevDue||0), "#7c3aed")}</div></div><div style="padding:10px;background:#f8fafc;border-top:2px solid #e2e8f0;text-align:center"><button class="btn" style="background:#0891b2" onclick="window.print()">🖨️ طباعة</button></div></div></body></html>`;
    
    setPreviewModal({ name, html });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ========== جدول 2025 ========== */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-teal-800">أقساط ورسوم 2025</h2>
            <p className="text-[10px] text-slate-400">الأرشيف - الرصيد الافتتاحي = رسوم الدراسة</p>
          </div>
          <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-emerald-700">
            📥 استيراد 2025
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2025)} className="hidden" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-50 p-2 rounded-lg text-center border"><div className="text-[9px] text-slate-500">رسوم الدراسة</div><div className="text-xs font-mono font-bold">{fmt(totals2025.fees)}</div></div>
          <div className="bg-emerald-50 p-2 rounded-lg text-center border border-emerald-100"><div className="text-[9px] text-emerald-600">المسدد</div><div className="text-xs font-mono font-bold text-emerald-700">{fmt(totals2025.paid)}</div></div>
          <div className="bg-rose-50 p-2 rounded-lg text-center border border-rose-100"><div className="text-[9px] text-rose-600">المتبقي</div><div className="text-xs font-mono font-bold text-rose-700">{fmt(totals2025.remaining)}</div></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-2 w-10">م</th>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-center">الدفعة</th>
                <th className="p-2">المساق</th>
                <th className="p-2 text-center">رسوم 2025</th>
                <th className="p-2 text-center">المسدد</th>
                <th className="p-2 text-center">المتبقي</th>
                <th className="p-2">ملاحظات</th>
                <th className="p-2 text-center">الهاتف</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r: any, i: number) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono text-center">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold text-center">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold text-center">{fmt(r.remaining)}</td>
                  <td className="p-2 truncate max-w-[100px] text-[10px] text-slate-500">{r.notes || "—"}</td>
                  <td className="p-2 text-[10px] text-center">{r.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== جدول 2026 ========== */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-purple-800">أقساط ورسوم 2026</h2>
            <p className="text-[10px] text-slate-400">الرصيد الافتتاحي = متبقي 2025 فقط</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setNewPaymentModal(true)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold hover:bg-purple-700">
              ➕ إضافة قسط
            </button>
            <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-emerald-700">
              📥 استيراد 2026
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => importFile(e, 2026)} className="hidden" />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-slate-50 p-2 rounded-lg text-center border"><div className="text-[9px] text-slate-500">رسوم 2026</div><div className="text-xs font-mono font-bold">{fmt(totals2026.fees)}</div></div>
          <div className="bg-amber-50 p-2 rounded-lg text-center border border-amber-100"><div className="text-[9px] text-amber-600">متبقي 2025</div><div className="text-xs font-mono font-bold text-amber-700">{fmt(totals2026.prevDue)}</div></div>
          <div className="bg-emerald-50 p-2 rounded-lg text-center border border-emerald-100"><div className="text-[9px] text-emerald-600">المسدد</div><div className="text-xs font-mono font-bold text-emerald-700">{fmt(totals2026.paid)}</div></div>
          <div className="bg-rose-50 p-2 rounded-lg text-center border border-rose-100"><div className="text-[9px] text-rose-600">الرصيد</div><div className="text-xs font-mono font-bold text-rose-700">{fmt(totals2026.remaining)}</div></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-2 w-10">م</th>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-center">الدفعة</th>
                <th className="p-2">المساق</th>
                <th className="p-2 text-center">رسوم 2026</th>
                <th className="p-2 text-center">متبقي 2025</th>
                {MONTHS_2026.map(m => (
                  <th key={m} className="p-1 text-center text-[9px] w-[75px]">{m}</th>
                ))}
                <th className="p-2 text-center">المسدد</th>
                <th className="p-2 text-center">الرصيد</th>
                <th className="p-2 text-center">الحالة</th>
                <th className="p-2 text-center w-16">كشف</th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r: any, i: number) => {
                const status = getStatusText(r.remaining);
                return (
                  <tr key={i} className="border-t hover:bg-slate-50">
                    <td className="p-2 text-center text-slate-400">{i + 1}</td>
                    <td className="p-2 font-semibold">{r.name}</td>
                    <td className="p-2 text-center">{r.batch}</td>
                    <td className="p-2">{r.specialty}</td>
                    <td className="p-2 font-mono text-center">{fmt(r.fees)}</td>
                    <td className="p-2 font-mono text-amber-600 font-bold text-center">{fmt(r.prevDue || 0)}</td>
                    {MONTHS_2026.map(m => {
                      const paid = Number(r.payments?.[m]) || 0;
                      const cellId = `${r.name}-${m}`;
                      return (
                        <td 
                          key={m} 
                          className="p-1 text-center relative"
                          onMouseEnter={() => setHoveredCell(cellId)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {paid > 0 ? (
                            <div className="relative">
                              <span className="font-mono text-[10px] text-emerald-600 font-bold cursor-pointer">
                                {fmt(paid)}
                              </span>
                              {hoveredCell === cellId && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 bg-white shadow-lg border rounded px-1 py-0.5 z-20">
                                  <button 
                                    onClick={() => { setEditPaymentModal({ row: r, month: m, amount: paid }); setEditAmount(String(paid)); setHoveredCell(null); }} 
                                    className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] hover:bg-blue-600 font-bold whitespace-nowrap"
                                  >
                                    ✏️ تعديل
                                  </button>
                                  <button 
                                    onClick={() => { deletePayment(r, m); setHoveredCell(null); }} 
                                    className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[9px] hover:bg-red-600 font-bold whitespace-nowrap"
                                  >
                                    🗑️ حذف
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setPaymentModal({ row: r, month: m }); setPayAmount(""); }} 
                              className="text-[11px] text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded w-6 h-6 flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 font-mono text-emerald-600 font-bold text-center">{fmt(r.totalPaid)}</td>
                    <td className="p-2 font-mono text-rose-600 font-bold text-center">{fmt(r.remaining)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${status.bg} ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => generatePreview(r.name)} 
                        className="px-2 py-1 bg-teal-50 text-teal-600 rounded text-[10px] font-bold hover:bg-teal-100 hover:text-teal-700"
                      >
                        🖨️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== نافذة إضافة قسط جديد ========== */}
      {newPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full" dir="rtl">
            <h3 className="font-bold text-sm border-b pb-2 mb-3">➕ إضافة قسط جديد - 2026</h3>
            <form onSubmit={addNewPayment} className="space-y-3">
              <div className="relative">
                <input type="text" required placeholder="اسم المتدرب" value={newStudentName} onChange={e => handleNameChange(e.target.value)} onFocus={() => newStudentName.length > 0 && setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full p-2 border rounded text-sm bg-slate-50" />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 left-0 bg-white border rounded-b-lg shadow-lg z-20 max-h-32 overflow-auto">
                    {nameSuggestions.map((n, idx) => (
                      <div key={idx} onClick={() => { setNewStudentName(n); setShowSuggestions(false); }} className="p-2 text-xs hover:bg-slate-50 cursor-pointer border-b last:border-0">{n}</div>
                    ))}
                  </div>
                )}
              </div>
              <input type="number" required placeholder="المبلغ" value={newStudentAmount} onChange={e => setNewStudentAmount(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50" />
              <select required value={newStudentMonth} onChange={e => setNewStudentMonth(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50">
                <option value="">اختر الشهر (البيان)</option>
                {MONTHS_2026.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setNewPaymentModal(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs">إلغاء</button>
                <button type="submit" className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-bold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة تسجيل دفعة ========== */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full" dir="rtl">
            <h3 className="font-bold text-sm border-b pb-2 mb-3">💵 دفعة - {paymentModal.row.name}</h3>
            <p className="text-xs text-slate-500 mb-2">الشهر: <b>{paymentModal.month}</b></p>
            <form onSubmit={addPayment} className="space-y-3">
              <input type="number" required placeholder="المبلغ" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50" autoFocus />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setPaymentModal(null)} className="px-3 py-1.5 bg-slate-100 rounded text-xs">إلغاء</button>
                <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة تعديل قسط ========== */}
      {editPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full" dir="rtl">
            <h3 className="font-bold text-sm border-b pb-2 mb-3">✏️ تعديل قسط</h3>
            <p className="text-xs text-slate-500 mb-2">{editPaymentModal.row.name} - {editPaymentModal.month}</p>
            <form onSubmit={editPayment} className="space-y-3">
              <input type="number" required placeholder="المبلغ الجديد" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full p-2 border rounded text-sm bg-slate-50" autoFocus />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setEditPaymentModal(null)} className="px-3 py-1.5 bg-slate-100 rounded text-xs">إلغاء</button>
                <button type="button" onClick={() => deletePayment(editPaymentModal.row, editPaymentModal.month)} className="px-3 py-1.5 bg-red-500 text-white rounded text-xs font-bold">🗑️ حذف</button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== نافذة المعاينة والطباعة ========== */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-3 border-b bg-gray-50">
              <h3 className="font-bold text-xs">📊 كشف حساب - {previewModal.name}</h3>
              <div className="flex gap-1.5">
                <button onClick={() => { const w = window.open('', '', 'width=1000,height=700'); w?.document.write(previewModal.html); w?.document.close(); setTimeout(() => w?.print(), 500); }} className="px-3 py-1.5 bg-teal-600 text-white rounded text-[10px] font-bold">🖨️ طباعة</button>
                <button onClick={() => setPreviewModal(null)} className="px-3 py-1.5 bg-slate-500 text-white rounded text-[10px] font-bold">✕ إغلاق</button>
              </div>
            </div>
            <iframe srcDoc={previewModal.html} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
    }
