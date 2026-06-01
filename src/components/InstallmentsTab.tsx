import React, { useMemo, useState } from "react";
import { useStore, INSTALLMENT_MONTHS } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import EditModal, { type EditField } from "./EditModal";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";

// الأشهر المحددة لعام 2025
const MONTHS_2025 = [
  "يونيو 2024", "يوليو 2024", "أغسطس 2024", 
  "مارس 2025", "ابريل 2025", "مايو 2025", 
  "يونيو 2025", "يوليو 2025", "أغسطس 2025", 
  "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"
];

// شهور عام 2026
const MONTHS_2026_CLEAN = [
  "يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", 
  "يوليو", "اغسطس", "سبتمبر", "اكتوبر ", "نوفمبر", "ديسمبر"
];

const BASE_COLS = [
  { key: "name", label: "الاسم" },
  { key: "batch", label: "الدفعة" },
  { key: "specialty", label: "المساق" },
  { key: "fees", label: "مبلغ الرسوم" },
  { key: "totalPaid", label: "الإجمالي المسدد" },
  { key: "remaining", label: "المتبقي" },
  { key: "notes", label: "ملاحظات" },
  { key: "phone", label: "رقم الهاتف" },
];

// دالة مساعدة لتحميل خط Google Fonts إلى jsPDF
async function loadGoogleFont(pdf: jsPDF): Promise<boolean> {
  try {
    const fontUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangtZmpcWmhzfH5lWWgcRiySJg.ttf';
    const response = await fetch(fontUrl);
    if (!response.ok) throw new Error("فشل تحميل الخط");
    
    const fontBuffer = await response.arrayBuffer();
    const fontBase64 = arrayBufferToBase64(fontBuffer);
    
    pdf.addFileToVFS('Cairo-Regular.ttf', fontBase64);
    pdf.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
    
    return true;
  } catch (error) {
    console.error('خطأ في تحميل الخط:', error);
    return false;
  }
}

// دالة مساعدة لتحويل ArrayBuffer إلى base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// دالة حساب المبلغ المستحق للشهر
function calculateMonthlyRequired(totalFees: number, prevDue: number = 0, totalMonths: number): number {
  const totalAmount = totalFees + prevDue;
  return Math.round(totalAmount / totalMonths);
}

// دالة حساب الحالة (له/عليه) للشهر
function calculateMonthStatus(
  paidAmount: number, 
  requiredAmount: number,
  accumulatedPaid: number,
  accumulatedRequired: number
): { status: 'له' | 'عليه' | 'متوازن', amount: number } {
  const difference = paidAmount - requiredAmount;
  
  if (Math.abs(difference) < 1) {
    return { status: 'متوازن', amount: 0 };
  } else if (difference > 0) {
    return { status: 'له', amount: difference };
  } else {
    return { status: 'عليه', amount: Math.abs(difference) };
  }
}

export default function InstallmentsTab() {
  const { 
    installments,       
    installments2025,   
  } = useStore() as any;

  const [editingRow, setEditingRow] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ row: any; year: 2025 | 2026 } | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMonth, setPayMonth] = useState<string>("");
  
  // حالة نافذة المعاينة
  const [previewModal, setPreviewModal] = useState<{
    studentName: string;
    htmlContent: string;
  } | null>(null);
  
  // حالة تحميل PDF
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<{
    studentName: string;
    type: 'preview' | 'download';
  } | null>(null);

  const controls2026 = useTableControls(installments || [], ["name", "batch", "specialty", "fees", "prevDue", "totalPaid", "remaining", "notes", "phone"]);
  const controls2025 = useTableControls(installments2025 || [], BASE_COLS.map(c => c.key));

  // دالة تطهير الأرقام من الفواصل والفراغات المخفية
  const superCleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    let str = String(val);
    str = str.replace(/,/g, "").replace(/\s+/g, "").replace(/[\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "").trim();
    return Number(str) || 0;
  };

  const cleanKey = (str: any): string => {
    if (!str) return "";
    return String(str).replace(/\s+/g, "").replace(/[\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, "").trim();
  };

  const totals2025 = useMemo(() => {
    const list = controls2025.rows || [];
    return {
      fees: list.reduce((s, r) => s + superCleanNumber(r.fees), 0),
      paid: list.reduce((s, r) => s + superCleanNumber(r.totalPaid), 0),
      remaining: list.reduce((s, r) => s + superCleanNumber(r.remaining), 0),
    };
  }, [controls2025.rows]);

  const totals2026 = useMemo(() => {
    const list = controls2026.rows || [];
    return {
      fees: list.reduce((s, r) => s + superCleanNumber(r.fees), 0),
      prevDue: list.reduce((s, r) => s + superCleanNumber(r.prevDue), 0),
      paid: list.reduce((s, r) => s + superCleanNumber(r.totalPaid), 0),
      remaining: list.reduce((s, r) => s + superCleanNumber(r.remaining), 0),
    };
  }, [controls2026.rows]);

  const handleAddManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || !payAmount || !payMonth) {
      toast.error("يرجى إدخال مبلغ القسط واختيار الشهر");
      return;
    }

    const amountNum = Number(payAmount) || 0;
    const is2025 = paymentModal.year === 2025;
    const currentList = is2025 ? (installments2025 || []) : (installments || []);

    const updatedList = currentList.map((student: any) => {
      if (student.name === paymentModal.row.name) {
        const updatedPayments = { ...student.payments };
        updatedPayments[payMonth] = (Number(updatedPayments[payMonth]) || 0) + amountNum;

        let newTotalPaid = 0;
        const targetMonths = is2025 ? MONTHS_2025 : MONTHS_2026_CLEAN;
        targetMonths.forEach(m => {
          newTotalPaid += Number(updatedPayments[m]) || 0;
        });

        let newRemaining = 0;
        if (is2025) {
          newRemaining = superCleanNumber(student.fees) - newTotalPaid;
        } else {
          newRemaining = (superCleanNumber(student.fees) + superCleanNumber(student.prevDue)) - newTotalPaid;
        }

        return {
          ...student,
          payments: updatedPayments,
          totalPaid: newTotalPaid,
          remaining: newRemaining < 0 ? 0 : newRemaining
        };
      }
      return student;
    });

    if (is2025) {
      useStore.setState({ installments2025: updatedList });
    } else {
      useStore.setState({ installments: updatedList });
    }

    toast.success(`تم تسجيل قسط بقيمة ${fmt(amountNum)} لشهر (${payMonth}) بنجاح`);
    setPaymentModal(null);
    setPayAmount("");
    setPayMonth("");
  };

  // ================== استيراد ملف 2025 ==================
  const handleImport2025 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
        
        const headerIndex = rows.findIndex(row => row && row.some((cell: any) => {
          const cStr = String(cell);
          return cStr.includes("متدرب") || cStr.includes("الاسم") || cStr.includes("المساق");
        }));
        
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على سطر العناوين في ملف 2025");
          return;
        }

        const rawHeaders = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);

        const cleanJson = dataRows
          .map(row => {
            const rowData: any = {};
            rawHeaders.forEach((header, index) => {
              if (header) rowData[header] = row[index];
            });
            return rowData;
          })
          .filter(row => {
            const actualNameKey = Object.keys(row).find(k => k.includes("اسم") || k.includes("الاسم"));
            const nameVal = actualNameKey ? String(row[actualNameKey]).trim() : "";
            return nameVal !== "" && nameVal !== "الإجمالي" && !nameVal.includes("كشف");
          })
          .map(row => {
            const findVal = (keywords: string[]) => {
              const foundKey = Object.keys(row).find(k => keywords.some(kw => k.includes(kw)));
              return foundKey ? row[foundKey] : "";
            };

            const name = String(findVal(["اسم", "الاسم"])).trim();
            const batch = String(findVal(["دفعة", "الدفعة"])).trim();
            const specialty = String(findVal(["مساق", "المساق"])).trim();
            const fees = superCleanNumber(findVal(["رسوم", "الرسوم", "مبلغ"]));
            const totalPaidFromExcel = superCleanNumber(findVal(["المسدد", "الإجمالي", "المدفوع"]));
            const remaining = superCleanNumber(findVal(["المتبقي"]));
            const notes = String(findVal(["ملاحظات"])).trim();
            const phone = String(findVal(["هاتف", "تلفون"])).trim();

            const payments = MONTHS_2025.reduce((acc, m) => {
              const exactMonthKey = Object.keys(row).find(k => cleanKey(k) === cleanKey(m));
              acc[m] = exactMonthKey ? superCleanNumber(row[exactMonthKey]) : 0;
              return acc;
            }, {} as any);

            let totalPaid = totalPaidFromExcel;
            if (!totalPaid) {
              MONTHS_2025.forEach(m => { totalPaid += payments[m]; });
            }

            return { name, batch, specialty, fees, totalPaid, remaining, notes, phone, payments };
          });

        if (cleanJson.length === 0) {
          toast.error("لم يتم استيراد أي بيانات، يرجى التحقق من صياغة ملف 2025");
          return;
        }

        useStore.setState({ installments2025: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2025م`);
      } catch (error) {
        toast.error("حدث خطأ أثناء معالجة ملف 2025");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ================== استيراد ملف 2026 ==================
  const handleImport2026 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
        
        const headerIndex = rows.findIndex(row => row && row.some((cell: any) => {
          const cStr = String(cell);
          return cStr.includes("متدرب") || cStr.includes("الاسم") || cStr.includes("المساق");
        }));
        
        if (headerIndex === -1) {
          toast.error("لم يتم العثور على سطر العناوين في ملف 2026");
          return;
        }

        const rawHeaders = rows[headerIndex].map((h: any) => String(h || "").trim());
        const dataRows = rows.slice(headerIndex + 1);

        const cleanJson = dataRows
          .map(row => {
            const rowData: any = {};
            rawHeaders.forEach((header, index) => {
              if (header) rowData[header] = row[index];
            });
            return rowData;
          })
          .filter(row => {
            const actualNameKey = Object.keys(row).find(k => k.includes("اسم") || k.includes("الاسم"));
            const nameVal = actualNameKey ? String(row[actualNameKey]).trim() : "";
            return nameVal !== "" && nameVal !== "الإجمالي" && !nameVal.includes("كشف");
          })
          .map(row => {
            const findVal = (keywords: string[]) => {
              const foundKey = Object.keys(row).find(k => keywords.some(kw => k.includes(kw)));
              return foundKey ? row[foundKey] : "";
            };

            const name = String(findVal(["اسم", "الاسم"])).trim();
            const batch = String(findVal(["دفعة", "الدفعة"])).trim();
            const specialty = String(findVal(["مساق", "المساق"])).trim();
            const fees = superCleanNumber(findVal(["رسوم", "الرسوم", "مبلغ الرسوم"]));
            const prevDue = superCleanNumber(findVal(["2025", "السابق", "متبقي عليهم"]));
            const totalPaid = superCleanNumber(findVal(["المسدد", "الإجمالي"]));
            const remaining = superCleanNumber(findVal(["المتبقي"]));
            const notes = String(findVal(["ملاحظات"])).trim();
            const phone = String(findVal(["هاتف", "تلفون"])).trim();

            const payments = MONTHS_2026_CLEAN.reduce((acc, m) => {
              const exactMonthKey = Object.keys(row).find(k => cleanKey(k) === cleanKey(m));
              acc[m] = exactMonthKey ? superCleanNumber(row[exactMonthKey]) : 0;
              return acc;
            }, {} as any);

            return { name, batch, specialty, fees, prevDue, totalPaid, remaining, notes, phone, payments };
          });

        if (cleanJson.length === 0) {
          toast.error("لم يتم استيراد أي بيانات، يرجى التحقق من صياغة ملف 2026");
          return;
        }

        useStore.setState({ installments: cleanJson });
        toast.success(`تم استيراد ${cleanJson.length} سجل بنجاح لعام 2026م`);
      } catch (error) {
        toast.error("حدث خطأ أثناء معالجة ملف 2026");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ================== إنشاء HTML للمعاينة بالتنسيق الجديد ==================
  const generatePreviewHTML = (studentName: string): string => {
    const r2025 = (installments2025 || []).find((i: any) => i.name === studentName);
    const r2026 = (installments || []).find((i: any) => i.name === studentName);

    // تجميع بيانات 2025
    let months2025HTML = '';
    let totalRequired2025 = 0;
    let totalPaid2025 = 0;
    let accumulatedPaid2025 = 0;
    let accumulatedRequired2025 = 0;
    
    if (r2025) {
      const monthlyRequired = calculateMonthlyRequired(r2025.fees, 0, 12);
      totalRequired2025 = monthlyRequired * 12;
      totalPaid2025 = r2025.totalPaid || 0;
      
      months2025HTML = MONTHS_2025.map((month, index) => {
        const paidAmount = r2025.payments?.[month] || 0;
        accumulatedPaid2025 += paidAmount;
        accumulatedRequired2025 += monthlyRequired;
        const status = calculateMonthStatus(paidAmount, monthlyRequired, accumulatedPaid2025, accumulatedRequired2025);
        
        const statusColor = status.status === 'له' ? '#059669' : status.status === 'عليه' ? '#dc2626' : '#6b7280';
        const statusBG = status.status === 'له' ? '#d1fae5' : status.status === 'عليه' ? '#fee2e2' : '#f3f4f6';
        const statusText = status.status === 'له' ? '💰 له' : status.status === 'عليه' ? '⚠️ عليه' : '✅ متوازن';
        
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${month}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-weight: 600;">${fmt(monthlyRequired)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-weight: 600;">${fmt(paidAmount)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="background: ${statusBG}; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block;">
                ${statusText}
              </span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-weight: 700; color: ${status.status === 'عليه' ? '#dc2626' : '#059669'};">
              ${status.status === 'متوازن' ? '0' : fmt(status.amount)}
            </td>
          </tr>
        `;
      }).join('');
    }

    // تجميع بيانات 2026
    let months2026HTML = '';
    let totalRequired2026 = 0;
    let totalPaid2026 = 0;
    let accumulatedPaid2026 = 0;
    let accumulatedRequired2026 = 0;
    
    if (r2026) {
      const totalAmount = (r2026.fees || 0) + (r2026.prevDue || 0);
      const monthlyRequired = calculateMonthlyRequired(r2026.fees || 0, r2026.prevDue || 0, 12);
      totalRequired2026 = monthlyRequired * 12;
      totalPaid2026 = r2026.totalPaid || 0;
      
      months2026HTML = MONTHS_2026_CLEAN.map((month, index) => {
        const paidAmount = r2026.payments?.[month] || 0;
        accumulatedPaid2026 += paidAmount;
        accumulatedRequired2026 += monthlyRequired;
        const status = calculateMonthStatus(paidAmount, monthlyRequired, accumulatedPaid2026, accumulatedRequired2026);
        
        const statusColor = status.status === 'له' ? '#059669' : status.status === 'عليه' ? '#dc2626' : '#6b7280';
        const statusBG = status.status === 'له' ? '#d1fae5' : status.status === 'عليه' ? '#fee2e2' : '#f3f4f6';
        const statusText = status.status === 'له' ? '💰 له' : status.status === 'عليه' ? '⚠️ عليه' : '✅ متوازن';
        
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${month}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-weight: 600;">${fmt(monthlyRequired)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-weight: 600;">${fmt(paidAmount)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="background: ${statusBG}; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block;">
                ${statusText}
              </span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-weight: 700; color: ${status.status === 'عليه' ? '#dc2626' : '#059669'};">
              ${status.status === 'متوازن' ? '0' : fmt(status.amount)}
            </td>
          </tr>
        `;
      }).join('');
    }

    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كشف حساب الأقساط الشهرية - ${studentName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Cairo', sans-serif;
            background: #f0f9ff;
            padding: 20px;
            direction: rtl;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.08);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #0891b2, #0e7490);
            color: white;
            padding: 30px 40px;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 300px;
            height: 300px;
            background: rgba(255,255,255,0.05);
            border-radius: 50%;
          }
          .header h1 {
            font-size: 26px;
            font-weight: 800;
            margin-bottom: 5px;
            position: relative;
          }
          .header h2 {
            font-size: 16px;
            font-weight: 400;
            opacity: 0.9;
            position: relative;
          }
          .student-info {
            background: #f8fafc;
            padding: 20px 40px;
            border-bottom: 2px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
          }
          .student-name {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
          }
          .date {
            font-size: 14px;
            color: #64748b;
            background: #f1f5f9;
            padding: 8px 16px;
            border-radius: 8px;
          }
          
          /* تنسيق العامودين */
          .years-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 20px 40px;
          }
          
          .year-section {
            background: #ffffff;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
          }
          .year-header {
            background: linear-gradient(135deg, #06b6d4, #0891b2);
            color: white;
            padding: 15px 20px;
            font-size: 18px;
            font-weight: 700;
            text-align: center;
          }
          .year-header.second {
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          }
          
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            padding: 15px;
            background: #f8fafc;
          }
          .summary-card {
            background: white;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }
          .summary-card .label {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .summary-card .value {
            font-size: 16px;
            font-weight: 700;
            font-family: monospace;
          }
          .summary-card .value.green { color: #059669; }
          .summary-card .value.red { color: #dc2626; }
          .summary-card .value.blue { color: #0891b2; }
          
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead th {
            background: #f1f5f9;
            color: #334155;
            padding: 12px 10px;
            font-weight: 700;
            font-size: 13px;
            border-bottom: 2px solid #cbd5e1;
          }
          tbody tr:hover {
            background: #f0f9ff;
          }
          tfoot td {
            background: #f8fafc;
            font-weight: 800;
            padding: 12px 10px;
            border-top: 2px solid #cbd5e1;
          }
          
          .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            display: inline-block;
          }
          
          .footer {
            background: #1e293b;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 13px;
          }
          .actions {
            padding: 20px 40px;
            background: #f8fafc;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            display: flex;
            gap: 10px;
            justify-content: center;
          }
          .btn {
            padding: 12px 30px;
            border: none;
            border-radius: 8px;
            font-family: 'Cairo', sans-serif;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .btn-print {
            background: #0891b2;
            color: white;
          }
          .btn-print:hover {
            background: #0e7490;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(8,145,178,0.3);
          }
          .btn-download {
            background: #7c3aed;
            color: white;
          }
          .btn-download:hover {
            background: #6d28d9;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(124,58,237,0.3);
          }
          .btn-close {
            background: #64748b;
            color: white;
          }
          .btn-close:hover {
            background: #475569;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(100,116,139,0.3);
          }
          
          @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; border-radius: 0; }
            .actions { display: none; }
            .years-container { gap: 10px; padding: 10px 20px; }
          }
          
          @media (max-width: 768px) {
            .years-container {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 المجلس اليمني للاختصاصات الطبية</h1>
            <h2>كشف حساب الأقساط الشهرية التفصيلي</h2>
          </div>
          
          <div class="student-info">
            <div class="student-name">👨‍⚕️ الطبيب المتدرب: ${studentName}</div>
            <div class="date">📅 ${today()}</div>
          </div>

          <div class="years-container">
            
            ${r2025 ? `
            <!-- عام 2025 -->
            <div class="year-section">
              <div class="year-header">
                📅 الأقساط الشهرية لعام 2025
                ${r2025.batch ? `<div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">الدفعة: ${r2025.batch} | المساق: ${r2025.specialty || ''}</div>` : ''}
              </div>
              
              <div class="summary-cards">
                <div class="summary-card">
                  <div class="label">إجمالي الرسوم</div>
                  <div class="value blue">${fmt(r2025.fees)}</div>
                </div>
                <div class="summary-card">
                  <div class="label">القسط الشهري</div>
                  <div class="value">${fmt(Math.round(r2025.fees / 12))}</div>
                </div>
                <div class="summary-card">
                  <div class="label">عدد الأشهر</div>
                  <div class="value">12 شهر</div>
                </div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>القسط المطلوب</th>
                    <th>المدفوع</th>
                    <th>الحالة</th>
                    <th>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  ${months2025HTML}
                </tbody>
                <tfoot>
                  <tr>
                    <td>الإجمالي</td>
                    <td style="text-align: center; font-family: monospace;">${fmt(totalRequired2025)}</td>
                    <td style="text-align: center; font-family: monospace; color: #059669;">${fmt(totalPaid2025)}</td>
                    <td style="text-align: center;">
                      <span class="status-badge" style="background: ${r2025.remaining > 0 ? '#fee2e2' : '#d1fae5'}; color: ${r2025.remaining > 0 ? '#dc2626' : '#059669'};">
                        ${r2025.remaining > 0 ? '⚠️ متبقي' : '✅ مكتمل'}
                      </span>
                    </td>
                    <td style="text-align: center; font-family: monospace; font-weight: 800; color: ${r2025.remaining > 0 ? '#dc2626' : '#059669'};">
                      ${fmt(r2025.remaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            ` : ''}

            ${r2026 ? `
            <!-- عام 2026 -->
            <div class="year-section">
              <div class="year-header second">
                📅 الأقساط الشهرية لعام 2026
                ${r2026.batch ? `<div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">الدفعة: ${r2026.batch} | المساق: ${r2026.specialty || ''}</div>` : ''}
              </div>
              
              <div class="summary-cards">
                <div class="summary-card">
                  <div class="label">رسوم 2026</div>
                  <div class="value blue">${fmt(r2026.fees)}</div>
                </div>
                <div class="summary-card">
                  <div class="label">متبقي 2025</div>
                  <div class="value" style="color: #d97706;">${fmt(r2026.prevDue || 0)}</div>
                </div>
                <div class="summary-card">
                  <div class="label">القسط الشهري</div>
                  <div class="value">${fmt(Math.round(((r2026.fees || 0) + (r2026.prevDue || 0)) / 12))}</div>
                </div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>القسط المطلوب</th>
                    <th>المدفوع</th>
                    <th>الحالة</th>
                    <th>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  ${months2026HTML}
                </tbody>
                <tfoot>
                  <tr>
                    <td>الإجمالي</td>
                    <td style="text-align: center; font-family: monospace;">${fmt(totalRequired2026)}</td>
                    <td style="text-align: center; font-family: monospace; color: #059669;">${fmt(totalPaid2026)}</td>
                    <td style="text-align: center;">
                      <span class="status-badge" style="background: ${r2026.remaining > 0 ? '#fee2e2' : '#d1fae5'}; color: ${r2026.remaining > 0 ? '#dc2626' : '#059669'};">
                        ${r2026.remaining > 0 ? '⚠️ متبقي' : '✅ مكتمل'}
                      </span>
                    </td>
                    <td style="text-align: center; font-family: monospace; font-weight: 800; color: ${r2026.remaining > 0 ? '#dc2626' : '#059669'};">
                      ${fmt(r2026.remaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            ` : ''}

            ${!r2025 && !r2026 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b; font-size: 18px;">
              ⚠️ لا توجد بيانات متاحة لهذا المتدرب
            </div>
            ` : ''}

          </div>

          <div class="actions">
            <button class="btn btn-print" onclick="window.print()">
              🖨️ طباعة الكشف
            </button>
            <button class="btn btn-download" onclick="window.parent.postMessage('download-pdf', '*')">
              📥 تحميل PDF
            </button>
            <button class="btn btn-close" onclick="window.parent.postMessage('close-preview', '*')">
              ✕ إغلاق
            </button>
          </div>

          <div class="footer">
            © ${new Date().getFullYear()} المجلس اليمني للاختصاصات الطبية - جميع الحقوق محفوظة
          </div>
        </div>
        
        <script>
          // الاستماع للرسائل من النافذة الأم
          window.addEventListener('message', function(event) {
            if (event.data === 'download-pdf') {
              window.parent.postMessage('trigger-download', '*');
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  // ================== تصدير كشف حساب PDF ==================
  const downloadComprehensivePDF = async (studentName: string) => {
    setIsGeneratingPDF({ studentName, type: 'download' });
    
    try {
      const r2025 = (installments2025 || []).find((i: any) => i.name === studentName);
      const r2026 = (installments || []).find((i: any) => i.name === studentName);

      if (!r2025 && !r2026) {
        toast.error("لا توجد سجلات مالية متوفرة لهذا الاسم");
        setIsGeneratingPDF(null);
        return;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // تحميل الخط من Google Fonts
      const fontLoaded = await loadGoogleFont(pdf);
      
      if (!fontLoaded) {
        toast.warning("تعذر تحميل الخط العربي، جاري التصدير بالخط الافتراضي");
      }

      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPos = 10;

      // العنوان
      if (fontLoaded) pdf.setFont('Cairo', 'bold');
      pdf.setFontSize(16);
      pdf.text('المجلس اليمني للاختصاصات الطبية', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      pdf.setFontSize(12);
      pdf.text('كشف حساب الأقساط الشهرية', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      
      if (fontLoaded) pdf.setFont('Cairo', 'normal');
      pdf.setFontSize(10);
      pdf.text(`الطبيب: ${studentName}`, 190, yPos, { align: 'right' });
      pdf.text(`التاريخ: ${today()}`, 20, yPos, { align: 'left' });
      yPos += 10;

      // جدول 2025
      if (r2025) {
        const monthlyRequired = calculateMonthlyRequired(r2025.fees, 0, 12);
        let accumulatedPaid = 0;
        let accumulatedRequired = 0;
        
        const tableData = MONTHS_2025.map(month => {
          const paidAmount = r2025.payments?.[month] || 0;
          accumulatedPaid += paidAmount;
          accumulatedRequired += monthlyRequired;
          const status = calculateMonthStatus(paidAmount, monthlyRequired, accumulatedPaid, accumulatedRequired);
          
          return [
            month,
            fmt(monthlyRequired),
            fmt(paidAmount),
            status.status === 'له' ? `له ${fmt(status.amount)}` : 
            status.status === 'عليه' ? `عليه ${fmt(status.amount)}` : 'متوازن',
            fmt(status.amount)
          ];
        });

        const tableConfig: any = {
          head: [['الشهر', 'القسط', 'المدفوع', 'الحالة', 'الفرق']],
          body: tableData,
          startY: yPos,
          theme: 'grid',
          styles: {
            fontSize: 8,
            halign: 'right',
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [8, 145, 178],
            textColor: 255,
            fontStyle: 'bold',
          },
        };

        if (fontLoaded) tableConfig.styles.font = 'Cairo';
        autoTable(pdf, tableConfig);
        yPos = (pdf as any).lastAutoTable.finalY + 10;
      }

      // جدول 2026
      if (r2026) {
        if (yPos > 200) {
          pdf.addPage();
          yPos = 10;
        }
        
        const totalAmount = (r2026.fees || 0) + (r2026.prevDue || 0);
        const monthlyRequired = calculateMonthlyRequired(r2026.fees || 0, r2026.prevDue || 0, 12);
        let accumulatedPaid = 0;
        let accumulatedRequired = 0;
        
        const tableData = MONTHS_2026_CLEAN.map(month => {
          const paidAmount = r2026.payments?.[month] || 0;
          accumulatedPaid += paidAmount;
          accumulatedRequired += monthlyRequired;
          const status = calculateMonthStatus(paidAmount, monthlyRequired, accumulatedPaid, accumulatedRequired);
          
          return [
            month,
            fmt(monthlyRequired),
            fmt(paidAmount),
            status.status === 'له' ? `له ${fmt(status.amount)}` : 
            status.status === 'عليه' ? `عليه ${fmt(status.amount)}` : 'متوازن',
            fmt(status.amount)
          ];
        });

        const tableConfig: any = {
          head: [['الشهر', 'القسط', 'المدفوع', 'الحالة', 'الفرق']],
          body: tableData,
          startY: yPos,
          theme: 'grid',
          styles: {
            fontSize: 8,
            halign: 'right',
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [124, 58, 237],
            textColor: 255,
            fontStyle: 'bold',
          },
        };

        if (fontLoaded) tableConfig.styles.font = 'Cairo';
        autoTable(pdf, tableConfig);
      }

      pdf.save(`كشف_الأقساط_الشهرية_${studentName}_${today()}.pdf`);
      toast.success('تم تحميل كشف الحساب بنجاح');
    } catch (error) {
      console.error('خطأ في التصدير:', error);
      toast.error('فشل تصدير كشف الحساب');
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  // ================== عرض المعاينة ==================
  const handlePreview = (studentName: string) => {
    const htmlContent = generatePreviewHTML(studentName);
    setPreviewModal({ studentName, htmlContent });
  };

  const handlePrint = (studentName: string) => {
    handlePreview(studentName);
  };

  return (
    <div className="space-y-8" dir="rtl">
      
      {/* ================== عام 2025م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2025م</h2>
            <p className="text-xxs text-slate-500">الأرشيف المستورد والمعدّل لعام 2025</p>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 shadow-sm transition">
            <span>📥 استيراد ملف إكسل 2025</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport2025} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 max-w-xl">
          <div className="bg-slate-50 p-2 border rounded-lg"><span className="text-xxs text-slate-500 block">إجمالي رسوم 2025</span><span className="text-sm font-mono font-bold text-slate-800">{fmt(totals2025.fees)}</span></div>
          <div className="bg-emerald-50 p-2 border border-emerald-200 rounded-lg"><span className="text-xxs text-emerald-600 block">إجمالي المسدد 2025</span><span className="text-sm font-mono font-bold text-emerald-700">{fmt(totals2025.paid)}</span></div>
          <div className="bg-rose-50 p-2 border border-rose-100 rounded-lg"><span className="text-xxs text-rose-600 block">المتبقي الإجمالي 2025</span><span className="text-sm font-mono font-bold text-rose-700">{fmt(totals2025.remaining)}</span></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="p-2 text-center w-10">م</th>
                {BASE_COLS.map(c => (
                  <th key={c.key} className="p-2 text-right cursor-pointer" onClick={() => controls2025.toggleSort(c.key)}>
                    {c.label} {sortIndicator(controls2025.sortKey === c.key, controls2025.sortDir)}
                  </th>
                ))}
                <th className="p-2 text-center w-48">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2025.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold text-slate-800">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="p-2 text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="p-2 text-slate-600 font-mono">{r.phone || "—"}</td>
                  <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setPaymentModal({ row: r, year: 2025 })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold hover:bg-emerald-600 hover:text-white transition">💵 دفعة</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2025 })} className="text-blue-600 hover:underline font-bold px-1">تعديل</button>
                    <button onClick={() => handlePrint(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== عام 2026م ================== */}
      <div className="bg-card rounded-xl shadow-sm border p-5 bg-white text-right">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-teal-800">أقساط ورسوم عام 2026م (العام الحالي)</h2>
            <p className="text-xxs text-slate-500">يتضمن الربط المباشر مع متبقيات 2025 وعمليات الدفع المباشرة</p>
          </div>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-800 shadow-sm transition">
            <span>📥 استيراد ملف إكسل 2026</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImport2026} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
          <div className="bg-slate-50 p-2 border rounded-lg"><span className="text-xxs text-slate-500 block">رسوم 2026</span><span className="text-sm font-mono font-bold">{fmt(totals2026.fees)}</span></div>
          <div className="bg-amber-50 p-2 border border-amber-200 rounded-lg"><span className="text-xxs text-amber-600 block">متبقيات سابقة 2025</span><span className="text-sm font-mono font-bold text-amber-700">{fmt(totals2026.prevDue)}</span></div>
          <div className="bg-emerald-50 p-2 border border-emerald-200 rounded-lg"><span className="text-xxs text-emerald-600 block">المسدد 2026</span><span className="text-sm font-mono font-bold text-emerald-700">{fmt(totals2026.paid)}</span></div>
          <div className="bg-rose-50 p-2 border border-rose-100 rounded-lg"><span className="text-xxs text-rose-600 block">إجمالي المتبقي الحالي</span><span className="text-sm font-mono font-bold text-rose-700">{fmt(totals2026.remaining)}</span></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b">
              <tr>
                <th className="p-2 text-center w-10">م</th>
                <th className="p-2 text-right">الاسم</th>
                <th className="p-2 text-center">الدفعة</th>
                <th className="p-2">المساق</th>
                <th className="p-2 text-right">رسوم الدراسة</th>
                <th className="p-2 text-right">متبقي 2025</th>
                <th className="p-2 text-right">المسدد 2026</th>
                <th className="p-2 text-right">المتبقي الحالي</th>
                <th className="p-2">ملاحظات</th>
                <th className="p-2 text-center w-48">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {controls2026.rows.map((r, i) => (
                <tr key={r.name + i} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-center text-slate-400">{i + 1}</td>
                  <td className="p-2 font-semibold text-slate-800">{r.name}</td>
                  <td className="p-2 text-center">{r.batch}</td>
                  <td className="p-2">{r.specialty}</td>
                  <td className="p-2 font-mono">{fmt(r.fees)}</td>
                  <td className="p-2 font-mono text-amber-600 font-bold">{fmt(r.prevDue || 0)}</td>
                  <td className="p-2 font-mono text-emerald-600 font-bold">{fmt(r.totalPaid)}</td>
                  <td className="p-2 font-mono text-rose-600 font-bold">{fmt(r.remaining)}</td>
                  <td className="p-2 text-slate-500 truncate max-w-xs">{r.notes || "—"}</td>
                  <td className="p-2 text-center space-x-1 space-x-reverse whitespace-nowrap">
                    <button onClick={() => setPaymentModal({ row: r, year: 2026 })} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold hover:bg-emerald-600 hover:text-white transition">💵 دفعة</button>
                    <button onClick={() => setEditingRow({ row: r, year: 2026 })} className="text-blue-600 hover:underline font-bold px-1">تعديل</button>
                    <button onClick={() => handlePrint(r.name)} className="px-1.5 py-0.5 bg-slate-50 border rounded hover:bg-teal-700 hover:text-white transition">كشف موحد</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================== نافذة تسجيل قسط يدوي ================== */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-md w-full text-right" dir="rtl">
            <h3 className="text-md font-bold text-slate-900 border-b pb-2 mb-4">
              ➕ تسجيل دفعة/قسط يدوياً لعام {paymentModal.year}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              المتدرب: <span className="font-bold text-slate-800">{paymentModal.row.name}</span>
            </p>

            <form onSubmit={handleAddManualPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ القسط (ريال)</label>
                <input 
                  type="number" 
                  required
                  placeholder="مثال: 30000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-0 py-2 border rounded-lg text-sm bg-slate-50 text-left font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الشهر المستهدف بالسداد</label>
                <select 
                  required
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  className="w-full px-0 py-2 border rounded-lg text-sm bg-slate-50"
                >
                  <option value="">-- اختر الشهر المالي --</option>
                  {(paymentModal.year === 2025 ? MONTHS_2025 : MONTHS_2026_CLEAN).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button 
                  type="button" 
                  onClick={() => { setPaymentModal(null); setPayAmount(""); setPayMonth(""); }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                >
                  إلغاء
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm">
                  حفظ القسط وتحديث الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================== نافذة معاينة الكشف ================== */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border w-full max-w-7xl h-[95vh] flex flex-col text-right" dir="rtl">
            {/* شريط العنوان */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-slate-900">
                📊 معاينة كشف الأقساط الشهرية - {previewModal.studentName}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'width=1200,height=800');
                    if (printWindow) {
                      printWindow.document.write(previewModal.htmlContent);
                      printWindow.document.close();
                      setTimeout(() => printWindow.print(), 500);
                    }
                  }}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition"
                >
                  🖨️ طباعة
                </button>
                <button
                  onClick={() => downloadComprehensivePDF(previewModal.studentName)}
                  disabled={isGeneratingPDF !== null}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {isGeneratingPDF?.studentName === previewModal.studentName && isGeneratingPDF?.type === 'download' 
                    ? '⏳ جاري التحميل...' 
                    : '📥 تحميل PDF'}
                </button>
                <button
                  onClick={() => setPreviewModal(null)}
               
