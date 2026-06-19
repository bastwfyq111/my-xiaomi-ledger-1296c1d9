import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useTableControls } from "@/hooks/useTableControls";
// 🆕 تم إضافة أيقونات Edit و Plus و Trash
import { X, Printer, AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown, Edit, Plus, Trash } from "lucide-react";
import TabActions from "./TabActions";

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

const cleanNumber = (val: any): number => {
  if (!val || isNaN(Number(String(val).replace(/[^0-9.-]/g, "")))) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, "")) || 0;
};

const StatsGrid = ({ stats, columns = 3 }: { stats: any[]; columns?: number }) => {
  const colClass = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
  return (
    <div className={`grid ${colClass} gap-2 mb-4`}>
      {stats.map((stat, idx) => (
        <div key={idx} className={`${stat.bgClass} p-2 sm:p-3 rounded-lg text-center border ${stat.borderClass} shadow-sm`}>
          <div className="text-xs sm:text-sm font-medium text-slate-600">{stat.label}</div>
          <div className="text-sm sm:text-lg font-mono font-bold mt-1 text-slate-900 truncate">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};

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

const SortIcon = ({ sortConfig, columnKey }: { sortConfig: { key: string; direction: 'asc' | 'desc' } | null, columnKey: string }) => {
  if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50" />;
  return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />;
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

  const [search2025, setSearch2025] = useState("");
  const [search2026, setSearch2026] = useState("");

  const [sortConfig2025, setSortConfig2025] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [sortConfig2026, setSortConfig2026] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 🆕 متغيرات حالة جديدة للتعديل وإضافة الأعمدة والصفوف
  const [editRowModal, setEditRowModal] = useState<{ year: number, row: any, index: number } | null>(null);
  const [editRowData, setEditRowData] = useState<any>({});
  
  const [extraCols2026, setExtraCols2026] = useState<string[]>([]);
  const [newColModal, setNewColModal] = useState(false);
  const [newColName, setNewColName] = useState("");

  const [newRowModal2026, setNewRowModal2026] = useState(false);
  const [newRowData2026, setNewRowData2026] = useState({ name: "", batch: "", specialty: "", prevDue: 0, fees: 0 });

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining"]);
  const controls2025 = useTableControls(installments2025 || [], ["name", "batch", "specialty", "fees", "totalPaid", "remaining"]);

  const filteredRows2025 = useMemo(() => {
    let result = controls2025.rows || [];
    if (search2025) {
      const term = search2025.toLowerCase();
      result = result.filter((r: any) => 
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.batch && String(r.batch).toLowerCase().includes(term)) ||
        (r.specialty && r.specialty.toLowerCase().includes(term))
      );
    }
    if (sortConfig2025) {
      result = [...result].sort((a: any, b: any) => {
        let aVal = a[sortConfig2025.key];
        let bVal = b[sortConfig2025.key];
        if (['fees', 'totalPaid', 'remaining'].includes(sortConfig2025.key)) {
          aVal = cleanNumber(aVal);
          bVal = cleanNumber(bVal);
        } else {
          aVal = aVal ? String(aVal).toLowerCase() : "";
          bVal = bVal ? String(bVal).toLowerCase() : "";
        }
        if (aVal < bVal) return sortConfig2025.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig2025.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [controls2025.rows, search2025, sortConfig2025]);

  const filteredRows2026 = useMemo(() => {
    let result = controls2026.rows || [];
    if (search2026) {
      const term = search2026.toLowerCase();
      result = result.filter((r: any) => 
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.batch && String(r.batch).toLowerCase().includes(term)) ||
        (r.specialty && r.specialty.toLowerCase().includes(term))
      );
    }
    if (sortConfig2026) {
      result = [...result].sort((a: any, b: any) => {
        let aVal = a[sortConfig2026.key];
        let bVal = b[sortConfig2026.key];
        if (['prevDue', 'fees', 'totalPaid', 'remaining'].includes(sortConfig2026.key)) {
          aVal = cleanNumber(aVal);
          bVal = cleanNumber(bVal);
        } else {
          aVal = aVal ? String(aVal).toLowerCase() : "";
          bVal = bVal ? String(bVal).toLowerCase() : "";
        }
        if (aVal < bVal) return sortConfig2026.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig2026.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [controls2026.rows, search2026, sortConfig2026]);

  const handleSort2025 = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig2025 && sortConfig2025.key === key && sortConfig2025.direction === 'asc') direction = 'desc';
    setSortConfig2025({ key, direction });
  };

  const handleSort2026 = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig2026 && sortConfig2026.key === key && sortConfig2026.direction === 'asc') direction = 'desc';
    setSortConfig2026({ key, direction });
  };

  const totals2025 = useMemo(() => ({
    fees: (filteredRows2025 || []).reduce((s, r) => s + cleanNumber(r.fees), 0),
    paid: (filteredRows2025 || []).reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: (filteredRows2025 || []).reduce((s, r) => s + cleanNumber(r.remaining), 0),
  }), [filteredRows2025]);

  const totals2026 = useMemo(() => ({
    prevDue: (filteredRows2026 || []).reduce((s, r) => s + cleanNumber(r.prevDue), 0),
    paid: (filteredRows2026 || []).reduce((s, r) => s + cleanNumber(r.totalPaid), 0),
    remaining: (filteredRows2026 || []).reduce((s, r) => s + cleanNumber(r.remaining), 0),
  }), [filteredRows2026]);

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
  const updateInstallments2025 = (list: any[]) => useStore.setState({ installments2025: list });

  // 🆕 دالة لحفظ تعديلات الصف للعامين
  const saveRowEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRowModal) return;

    if (editRowModal.year === 2025) {
      const list = [...(installments2025 || [])];
      // تحديث المتبقي بناءً على الرسوم الجديدة والمسدد
      const updatedRow = { ...editRowData, remaining: Math.max(0, cleanNumber(editRowData.fees) - cleanNumber(editRowData.totalPaid)) };
      list[editRowModal.index] = updatedRow;
      updateInstallments2025(list);
    } else {
      const list = [...(installments || [])];
      // تحديث المتبقي بناءً على المتبقي السابق الجديد والمسدد
      const updatedRow = { ...editRowData, remaining: Math.max(0, cleanNumber(editRowData.prevDue) - cleanNumber(editRowData.totalPaid)) };
      list[editRowModal.index] = updatedRow;
      updateInstallments(list);
    }

    toast.success("تم تحديث البيانات بنجاح");
    setEditRowModal(null);
  };

  // 🆕 دالة لإضافة عمود جديد 2026
  const addCustomColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    if (extraCols2026.includes(newColName)) return toast.error("اسم العمود موجود مسبقاً");
    
    setExtraCols2026([...extraCols2026, newColName]);
    toast.success(`تم إضافة العمود: ${newColName}`);
    setNewColModal(false);
    setNewColName("");
  };

  // 🆕 دالة لتحديث قيم الأعمدة الإضافية
  const updateCustomColValue = (rowIndex: number, colName: string, value: string) => {
    const list = [...(installments || [])];
    const row = list[rowIndex];
    if (!row.customData) row.customData = {};
    row.customData[colName] = value;
    list[rowIndex] = row;
    updateInstallments(list);
  };

  // 🆕 دالة لإضافة صف جديد لعام 2026
  const addNewRow2026 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRowData2026.name) return toast.error("يرجى إدخال اسم المتدرب");

    const payments = MONTHS_2026.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as any);
    const newRec = { 
      name: newRowData2026.name, 
      batch: newRowData2026.batch, 
      specialty: newRowData2026.specialty, 
      fees: Number(newRowData2026.fees) || 0, 
      prevDue: Number(newRowData2026.prevDue) || 0, 
      totalPaid: 0, 
      remaining: Number(newRowData2026.prevDue) || 0, 
      notes: "", 
      phone: "", 
      payments,
      customData: {} 
    };
    
    updateInstallments([...(installments || []), newRec]);
    toast.success("تم إضافة الصف بنجاح");
    setNewRowModal2026(false);
    setNewRowData2026({ name: "", batch: "", specialty: "", prevDue: 0, fees: 0 });
  };


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
          
          monthsList.forEach(m => {
            const cleanTarget = m.trim();
            const foundKey = Object.keys(row).find(k => k.trim() === cleanTarget || k === m);
            const amount = foundKey ? cleanNumber(row[foundKey]) : 0;
            payments[m] = amount;
            totalPaid += amount;
          });

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
            payments,
            customData: {} // 🆕 للبيانات المخصصة الجديدة
          };
        });

        if (year === 2025) {
            useStore.setState({ installments2025: formattedData });
        } else {
            useStore.setState({ installments: formattedData });
        }
        
        toast.success(`تم استيراد بيانات العام ${year} بنجاح!`);
        setImportError(null);
      } catch (error) {
        setImportError("حدث خطأ في قراءة الملف.");
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
        return `
          <tr>
            <td class="lbl">سداد شهر ${m}</td>
            <td class="num">${fmt(amount)}</td>
          </tr>`;
      })
      .join("");

    const infoCard = (label: string, value: string) =>
      `<div class="info-box">
        <div class="info-lbl">${label}</div>
        <div class="info-val">${value || "—"}</div>
      </div>`;

    const prevRow = year === 2026
      ? `<tr class="row-due-old">
          <td class="lbl">متبقي من العام 2025 (مدور)</td>
          <td class="num">${fmt(prevDue)}</td>
        </tr>`
      : "";

    const remainingLabel = remaining > 0 ? "الرصيد المتبقي (عليه)" : remaining < 0 ? "الرصيد الإضافي (له)" : "الحالة: تم السداد بالكامل";

    return `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>كشف حساب - ${row.name}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&display=swap">
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', sans-serif; direction: rtl; margin: 0; padding: 0; background-color: white; display: flex; justify-content: center; }
          .container { width: 210mm; min-height: 297mm; background: white; padding: 15mm; }
          .header { background: #15803d !important; color: white; padding: 25px; border-radius: 8px; text-align: center; margin-bottom: 25px; border: 1px solid #000; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
          .header p { margin: 10px 0 0; font-size: 18px; opacity: 1; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
          .info-box { border: 1px solid #000; padding: 12px; border-radius: 8px; text-align: center; }
          .info-lbl { font-size: 14px; color: #1e293b; font-weight: 800; }
          .info-val { font-size: 18px; color: #000; font-weight: 800; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background-color: #166534 !important; color: #ffffff !important; padding: 12px; font-size: 18px; border: 1px solid #000; text-align: center; font-weight: 800; }
          td { padding: 12px; border: 1px solid #000; text-align: center; font-size: 18px; }
          .lbl { text-align: right; padding-right: 15px; font-weight: 800; color: #000; }
          .num { text-align: left; padding-left: 15px; font-weight: 800; color: #000; font-family: monospace; font-size: 20px; }
          .row-due-old { background-color: #f1f5f9 !important; }
          .row-total-due { background-color: #e2e8f0 !important; }
          .row-total-paid { background-color: #f0fdf4 !important; }
          .row-final { background-color: #fef2f2 !important; font-size: 22px; border: 2px solid #000 !important; }
          @media print { 
            body { background: white; } 
            .container { box-shadow: none; padding: 10mm; width: 100%; }
            .header { background: #15803d !important; -webkit-print-color-adjust: exact; }
            th { background-color: #166534 !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>المجلس اليمني للاختصاصات الطبية</h1>
            <p>كشف حساب رسمي - العام ${year}م</p>
          </div>
          <div class="info-grid">
            ${infoCard("اسم المتدرب", row.name)}
            ${infoCard("الدفعة", row.batch)}
            ${infoCard("المساق", row.specialty)}
            ${infoCard("رقم الهاتف", row.phone)}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 60%">البيان</th>
                <th style="width: 40%">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="lbl">إجمالي الرسوم المستحقة</td><td class="num">${fmt(fees)}</td></tr>
              ${prevRow}
              <tr class="row-total-due"><td class="lbl">إجمالي المبلغ المطلوب</td><td class="num">${fmt(dueTotal)}</td></tr>
              ${paidRows}
              <tr class="row-total-paid"><td class="lbl">إجمالي المسدد (له)</td><td class="num">${fmt(totalPaid)}</td></tr>
              <tr class="row-final"><td class="lbl">${remainingLabel}</td><td class="num">${fmt(Math.abs(remaining))}</td></tr>
            </tbody>
          </table>
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
      setTimeout(() => w.print(), 500); 
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
        <div className="bg-gradient-to-l from-teal-600 to-teal-700 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">📊 أقساط ومستندات العام 2025</h2>
            <p className="text-xs text-teal-100">يشمل جميع الدفعات لعامي 2024 و 2025</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-2.5 top-2 text-teal-500" />
              <input 
                type="text" 
                placeholder="بحث (الاسم، الدفعة، المساق)..." 
                value={search2025}
                onChange={e => setSearch2025(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-lg text-xs border border-teal-300 outline-none focus:ring-2 focus:ring-teal-300 w-48 text-slate-800 shadow-sm"
              />
            </div>
            
            <label className="px-3 py-1.5 bg-white text-teal-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-teal-50 shadow">
              📥 استيراد الملف <input type="file" accept=".xlsx,.xls" onChange={e => importFile(e, 2025)} className="hidden" />
            </label>
            <TabActions
              title="أقساط العام 2025"
              rows={installments2025 || []}
              columns={[
                { key: "name", label: "اسم المتدرب" },
                { key: "batch", label: "الدفعة" },
                { key: "specialty", label: "المساق" },
                { key: "fees", label: "الرسوم" },
                { key: "totalPaid", label: "المسدد" },
                { key: "remaining", label: "المتبقي" },
              ]}
              fileName="اقساط-2025"
              numericKeys={["fees","totalPaid","remaining"]}
              onClear={() => clearInstallments('2025')}
            />
          </div>
        </div>
        {importError && <div className="bg-red-50 border-b border-red-200 p-3 flex gap-2"><AlertCircle className="w-5 h-5 text-red-600" /><p className="text-sm text-red-700">{importError}</p></div>}
        <div className="p-3 sm:p-4">
          <StatsGrid stats={stats2025} columns={3} />
          <div className="overflow-auto max-h-[65vh] rounded-lg border border-slate-200 shadow-sm relative">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-2 text-center whitespace-nowrap">#</th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2025('name')}>
                    <div className="flex items-center justify-center gap-1">اسم المتدرب <SortIcon sortConfig={sortConfig2025} columnKey="name" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2025('batch')}>
                    <div className="flex items-center justify-center gap-1">الدفعة <SortIcon sortConfig={sortConfig2025} columnKey="batch" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2025('specialty')}>
                    <div className="flex items-center justify-center gap-1">المساق <SortIcon sortConfig={sortConfig2025} columnKey="specialty" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2025('fees')}>
                    <div className="flex items-center justify-center gap-1">الرسوم <SortIcon sortConfig={sortConfig2025} columnKey="fees" /></div>
                  </th>
                  {MONTHS_2025.map(m => <th key={m} className="p-1 text-center text-[11px] bg-slate-50 border-l border-slate-200 whitespace-nowrap">{m}</th>)}
                  <th className="p-2 text-center text-emerald-700 whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2025('totalPaid')}>
                    <div className="flex items-center justify-center gap-1">المسدد <SortIcon sortConfig={sortConfig2025} columnKey="totalPaid" /></div>
                  </th>
                  <th className="p-2 text-center text-rose-700 whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2025('remaining')}>
                    <div className="flex items-center justify-center gap-1">المتبقي <SortIcon sortConfig={sortConfig2025} columnKey="remaining" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows2025.length === 0 ? (
                  <tr><td colSpan={9 + MONTHS_2025.length} className="p-6 text-center text-slate-400">لا توجد بيانات (يرجى التأكد من استيراد الملف أو تعديل البحث)</td></tr>
                ) : (
                  <>
                    {filteredRows2025.map((r: any, i: number) => {
                      // 🆕 إيجاد الفهرس الأصلي في المصفوفة الكلية للتعديل الدقيق
                      const originalIndex = (installments2025 || []).findIndex((orig: any) => orig.name === r.name);
                      return (
                      <tr key={i} className="border-t border-slate-200 hover:bg-slate-50/80 transition-colors">
                        <td className="p-2 text-center text-slate-500 whitespace-nowrap">{i + 1}</td>
                        <td className="p-2 text-center font-semibold text-slate-900 whitespace-nowrap">{r.name}</td>
                        <td className="p-2 text-center text-slate-600 whitespace-nowrap">{r.batch || "—"}</td>
                        <td className="p-2 text-center text-slate-600 whitespace-nowrap">{r.specialty || "—"}</td>
                        <td className="p-2 text-center font-mono font-semibold text-slate-700 whitespace-nowrap">{fmt(r.fees)}</td>
                        {MONTHS_2025.map(m => {
                          const paid = Number(r.payments?.[m]) || 0;
                          return <td key={m} className="p-1 text-center bg-slate-50/50 border-l border-slate-200 whitespace-nowrap">{paid > 0 ? <span className="text-emerald-700 font-bold font-mono">{fmt(paid)}</span> : <span className="text-slate-300">—</span>}</td>;
                        })}
                        <td className="p-2 text-center font-mono text-emerald-700 font-bold bg-emerald-50/30 whitespace-nowrap">{fmt(r.totalPaid)}</td>
                        <td className="p-2 text-center font-mono text-rose-700 font-bold bg-rose-50/30 whitespace-nowrap">{fmt(r.remaining)}</td>
                        <td className="p-2 text-center whitespace-nowrap flex justify-center gap-1">
                          <button onClick={() => { setEditRowData(r); setEditRowModal({ year: 2025, row: r, index: originalIndex }); }} className="p-1 bg-amber-50 text-amber-600 rounded border border-amber-200 hover:bg-amber-500 hover:text-white transition-colors" title="تعديل الصف">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => printStatement(r, 2025)} className="p-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-500 hover:text-white transition-colors" title="طباعة الكشف">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )})}
                    <tr className="border-t-2 border-teal-300 bg-teal-50 font-bold text-teal-900">
                      <td className="p-2 text-center whitespace-nowrap" colSpan={4}>الإجمالي العام</td>
                      <td className="p-2 text-center font-mono whitespace-nowrap">{fmt(totals2025.fees)}</td>
                      {MONTHS_2025.map(m => {
                        const total = filteredRows2025.reduce((sum: number, r: any) => sum + (Number(r.payments?.[m]) || 0), 0);
                        return <td key={m} className="p-1 text-center bg-teal-50 border-l border-teal-200 font-mono text-emerald-800 whitespace-nowrap">{total > 0 ? fmt(total) : "—"}</td>;
                      })}
                      <td className="p-2 text-center font-mono text-emerald-700 bg-emerald-100/50 whitespace-nowrap">{fmt(totals2025.paid)}</td>
                      <td className="p-2 text-center font-mono text-rose-700 bg-rose-100/50 whitespace-nowrap">{fmt(totals2025.remaining)}</td>
                      <td className="whitespace-nowrap"></td>
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
        <div className="bg-gradient-to-l from-purple-600 to-purple-700 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">📊 سجل أقساط العام الحالي 2026</h2>
            <p className="text-xs text-purple-100">بيانات المسدد والرصيد المدور لعام 2026</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-2.5 top-2 text-purple-500" />
              <input 
                type="text" 
                placeholder="بحث (الاسم، الدفعة، المساق)..." 
                value={search2026}
                onChange={e => setSearch2026(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-lg text-xs border border-purple-300 outline-none focus:ring-2 focus:ring-purple-300 w-48 text-slate-800 shadow-sm"
              />
            </div>
            
            {/* 🆕 زر إضافة صف جديد لعام 2026 */}
            <button onClick={() => setNewRowModal2026(true)} className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold shadow hover:bg-blue-200 transition-colors flex items-center gap-1">
              <Plus className="w-3 h-3" /> طالب جديد
            </button>

            {/* 🆕 زر إضافة عمود جديد لعام 2026 */}
            <button onClick={() => setNewColModal(true)} className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold shadow hover:bg-amber-200 transition-colors flex items-center gap-1">
              <Plus className="w-3 h-3" /> عمود جديد
            </button>

            <button onClick={() => setNewPaymentModal(true)} className="px-3 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold shadow hover:bg-purple-200 transition-colors">➕ إضافة قسط</button>
            <label className="px-3 py-1.5 bg-white text-purple-700 rounded-lg text-xs font-bold cursor-pointer shadow hover:bg-purple-50 transition-colors">
              📥 استيراد <input type="file" accept=".xlsx,.xls" onChange={e => importFile(e, 2026)} className="hidden" />
            </label>
            <TabActions
              title="أقساط العام 2026"
              rows={installments || []}
              columns={[
                { key: "name", label: "اسم المتدرب" },
                { key: "batch", label: "الدفعة" },
                { key: "specialty", label: "المساق" },
                { key: "prevDue", label: "المتبقي من 2025" },
                { key: "fees", label: "الرسوم" },
                { key: "totalPaid", label: "المسدد" },
                { key: "remaining", label: "المتبقي" },
                ...extraCols2026.map(c => ({ key: c, label: c })) // إضافة الأعمدة للتصدير
              ]}
              fileName="اقساط-2026"
              numericKeys={["prevDue","fees","totalPaid","remaining"]}
              onClear={() => clearInstallments()}
            />
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <StatsGrid stats={stats2026} columns={3} />
          <div className="overflow-auto max-h-[65vh] rounded-lg border border-slate-200 shadow-sm relative">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="p-2 text-center whitespace-nowrap">#</th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2026('name')}>
                    <div className="flex items-center justify-center gap-1">اسم المتدرب <SortIcon sortConfig={sortConfig2026} columnKey="name" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2026('batch')}>
                    <div className="flex items-center justify-center gap-1">دفعة <SortIcon sortConfig={sortConfig2026} columnKey="batch" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2026('specialty')}>
                    <div className="flex items-center justify-center gap-1">المساق <SortIcon sortConfig={sortConfig2026} columnKey="specialty" /></div>
                  </th>
                  <th className="p-2 text-center bg-amber-50 text-amber-900 whitespace-nowrap cursor-pointer hover:bg-amber-100" onClick={() => handleSort2026('prevDue')}>
                    <div className="flex items-center justify-center gap-1">المتبقي من 2025 <SortIcon sortConfig={sortConfig2026} columnKey="prevDue" /></div>
                  </th>
                  {MONTHS_2026.map(m => <th key={m} className="p-1 text-center text-xs bg-slate-50 border-l border-slate-200 whitespace-nowrap">{m.trim()}</th>)}
                  
                  {/* 🆕 عناوين الأعمدة المخصصة */}
                  {extraCols2026.map(col => (
                    <th key={col} className="p-2 text-center text-xs bg-blue-50 border-l border-slate-200 whitespace-nowrap text-blue-800">{col}</th>
                  ))}

                  <th className="p-2 text-center text-emerald-700 whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2026('totalPaid')}>
                    <div className="flex items-center justify-center gap-1">مسدد 2026 <SortIcon sortConfig={sortConfig2026} columnKey="totalPaid" /></div>
                  </th>
                  <th className="p-2 text-center text-rose-700 whitespace-nowrap cursor-pointer hover:bg-slate-200" onClick={() => handleSort2026('remaining')}>
                    <div className="flex items-center justify-center gap-1">الرصيد المتبقي <SortIcon sortConfig={sortConfig2026} columnKey="remaining" /></div>
                  </th>
                  <th className="p-2 text-center whitespace-nowrap">حالة</th>
                  <th className="p-2 text-center whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows2026.length === 0 ? (
                  <tr><td colSpan={8 + MONTHS_2026.length + extraCols2026.length} className="p-6 text-center text-slate-400">لا توجد بيانات (يرجى التأكد من استيراد الملف أو تعديل البحث)</td></tr>
                ) : (
                  <>
                    {filteredRows2026.map((r: any, i: number) => {
                      const status = getStatusText(r.remaining);
                      // 🆕 إيجاد الفهرس الأصلي في المصفوفة الكلية
                      const originalIndex = (installments || []).findIndex((orig: any) => orig.name === r.name);
                      
                      return (
                        <tr key={i} className="border-t border-slate-200 hover:bg-slate-50/80 transition-colors">
                          <td className="p-2 text-center text-slate-500 whitespace-nowrap">{i + 1}</td>
                          <td className="p-2 text-center font-semibold text-slate-900 whitespace-nowrap">{r.name}</td>
                          <td className="p-2 text-center text-slate-600 whitespace-nowrap">{r.batch || "—"}</td>
                          <td className="p-2 text-center text-slate-600 whitespace-nowrap">{r.specialty || "—"}</td>
                          <td className="p-2 text-center font-mono text-amber-700 font-bold bg-amber-50/20 whitespace-nowrap">{fmt(r.prevDue)}</td>
                          {MONTHS_2026.map(m => {
                            const paid = Number(r.payments?.[m]) || 0;
                            const cellId = `${r.name}-${m}`;
                            return (
                              <td key={m} className="p-1 text-center relative bg-slate-50/50 border-l border-slate-200 hover:bg-slate-100 cursor-pointer group transition-colors whitespace-nowrap"
                                onMouseEnter={() => setHoveredCell(cellId)} onMouseLeave={() => setHoveredCell(null)}>
                                {paid > 0 ? (
                                  <div className="relative flex justify-center">
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

                          {/* 🆕 حقول الأعمدة المخصصة (قابلة للتعديل المباشر) */}
                          {extraCols2026.map(col => (
                            <td key={col} className="p-1 border-l border-slate-200">
                              <input 
                                type="text"
                                className="w-full text-center bg-transparent outline-none focus:bg-white focus:ring-1 ring-blue-300 rounded px-1 py-1 text-xs"
                                value={r.customData?.[col] || ""}
                                onChange={(e) => updateCustomColValue(originalIndex, col, e.target.value)}
                                placeholder="—"
                              />
                            </td>
                          ))}

                          <td className="p-2 text-center font-mono text-emerald-700 font-bold bg-emerald-50/30 whitespace-nowrap">{fmt(r.totalPaid)}</td>
                          <td className="p-2 text-center font-mono text-rose-700 font-bold bg-rose-50/30 whitespace-nowrap">{fmt(r.remaining)}</td>
                          <td className="p-2 text-center whitespace-nowrap"><span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>{status.text}</span></td>
                          <td className="p-2 text-center whitespace-nowrap flex justify-center gap-1">
                            {/* 🆕 زر تعديل بيانات الصف */}
                            <button onClick={() => { setEditRowData(r); setEditRowModal({ year: 2026, row: r, index: originalIndex }); }} className="p-1 bg-amber-50 text-amber-600 rounded border border-amber-200 hover:bg-amber-500 hover:text-white transition-colors" title="تعديل الصف">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => printStatement(r, 2026)} className="p-1 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-500 hover:text-white transition-colors" title="طباعة الكشف">
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-purple-300 bg-purple-50 font-bold text-purple-900">
                      <td className="p-2 text-center whitespace-nowrap" colSpan={4}>الإجمالي العام</td>
                      <td className="p-2 text-center font-mono text-amber-700 bg-amber-100/30 whitespace-nowrap">{fmt(totals2026.prevDue)}</td>
                      {MONTHS_2026.map(m => {
                        const total = filteredRows2026.reduce((sum: number, r: any) => sum + (Number(r.payments?.[m]) || 0), 0);
                        return <td key={m} className="p-1 text-center bg-purple-50 border-l border-purple-200 font-mono text-emerald-800 whitespace-nowrap">{total > 0 ? fmt(total) : "—"}</td>;
                      })}
                      {extraCols2026.map(col => <td key={col} className="bg-purple-50 border-l border-purple-200"></td>)}
                      <td className="p-2 text-center font-mono text-emerald-700 bg-emerald-100/50 whitespace-nowrap">{fmt(totals2026.paid)}</td>
                      <td className="p-2 text-center font-mono text-rose-700 bg-rose-100/50 whitespace-nowrap">{fmt(totals2026.remaining)}</td>
                      <td className="whitespace-nowrap"></td><td className="whitespace-nowrap"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== النوافذ المنبثقة ========== */}

      {/* 🆕 نافذة تعديل بيانات الصف (شاملة للعامين) */}
      <Modal title={`✏️ تعديل بيانات المتدرب (${editRowModal?.year})`} isOpen={!!editRowModal} onClose={() => setEditRowModal(null)}>
        <form onSubmit={saveRowEdit} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">اسم المتدرب</label><input type="text" required value={editRowData?.name || ''} onChange={e => setEditRowData({...editRowData, name: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">الدفعة</label><input type="text" value={editRowData?.batch || ''} onChange={e => setEditRowData({...editRowData, batch: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">المساق</label><input type="text" value={editRowData?.specialty || ''} onChange={e => setEditRowData({...editRowData, specialty: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
          </div>
          {editRowModal?.year === 2025 && (
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">الرسوم الكلية</label><input type="number" value={editRowData?.fees || 0} onChange={e => setEditRowData({...editRowData, fees: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
          )}
          {editRowModal?.year === 2026 && (
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">المتبقي من 2025 (المدور)</label><input type="number" value={editRowData?.prevDue || 0} onChange={e => setEditRowData({...editRowData, prevDue: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t mt-4">
            <button type="button" onClick={() => setEditRowModal(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">إلغاء</button>
            <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold">حفظ التعديلات</button>
          </div>
        </form>
      </Modal>

      {/* 🆕 نافذة إضافة عمود جديد 2026 */}
      <Modal title="➕ إضافة عمود جديد (2026)" isOpen={newColModal} onClose={() => setNewColModal(false)}>
        <form onSubmit={addCustomColumn} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم العمود الجديد (مثل: ملاحظات، غرامة...)</label>
            <input type="text" required value={newColName} onChange={e => setNewColName(e.target.value)} className="w-full p-2 border rounded-lg" autoFocus placeholder="أدخل اسم العمود" />
          </div>
          <p className="text-[10px] text-slate-500">ملاحظة: هذا العمود سيكون قابلاً للكتابة النصية المباشرة داخل الجدول.</p>
          <div className="flex justify-end gap-2 pt-3 border-t mt-4">
            <button type="button" onClick={() => setNewColModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">إلغاء</button>
            <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold">إضافة العمود</button>
          </div>
        </form>
      </Modal>

      {/* 🆕 نافذة إضافة صف جديد لعام 2026 */}
      <Modal title="➕ إضافة طالب جديد لعام 2026" isOpen={newRowModal2026} onClose={() => setNewRowModal2026(false)}>
        <form onSubmit={addNewRow2026} className="space-y-3">
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">اسم المتدرب *</label><input type="text" required value={newRowData2026.name} onChange={e => setNewRowData2026({...newRowData2026, name: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">الدفعة</label><input type="text" value={newRowData2026.batch} onChange={e => setNewRowData2026({...newRowData2026, batch: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">المساق</label><input type="text" value={newRowData2026.specialty} onChange={e => setNewRowData2026({...newRowData2026, specialty: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">الرسوم الكلية</label><input type="number" value={newRowData2026.fees} onChange={e => setNewRowData2026({...newRowData2026, fees: Number(e.target.value)})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-xs font-semibold text-slate-700 mb-1">المتبقي من 2025</label><input type="number" value={newRowData2026.prevDue} onChange={e => setNewRowData2026({...newRowData2026, prevDue: Number(e.target.value)})} className="w-full p-2 border rounded-lg" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t mt-4">
            <button type="button" onClick={() => setNewRowModal2026(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg">إلغاء</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">إضافة المتدرب</button>
          </div>
        </form>
      </Modal>

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
