import * as XLSX from "xlsx";
import { Printer, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/format";

export type TabCol = { key: string; label: string };

type Props = {
  title: string;
  rows: Record<string, any>[];
  columns: TabCol[];
  fileName: string;
  onClear?: () => void;
  numericKeys?: string[];
  className?: string;
};

export default function TabActions({
  title,
  rows,
  columns,
  fileName,
  onClear,
  numericKeys = [],
  className = "",
}: Props) {
  
  const handlePrint = () => {
    if (!rows.length) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }

    // 1. إنشاء حاوية طباعة ديناميكية داخل الصفحة الحالية (نفس أسلوب طباعة المتدرب لتجنب أخطاء الصيغة)
    const printRoot = document.createElement("div");
    printRoot.id = "dynamic-print-root";

    const today = new Date().toLocaleDateString("ar-EG-u-nu-latn");

    // 2. بناء الهيكل الداخلي للجدول مع تنسيقات CSS احترافية ومثبتة الألوان
    printRoot.innerHTML = `
      <style>
        @media screen {
          #dynamic-print-root { display: none !important; }
        }
        @media print {
          /* إخفاء كل عناصر الموقع ما عدا حاوية الطباعة الحالية */
          body > :not(#dynamic-print-root) {
            display: none !important;
          }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            direction: rtl !important;
          }
          #dynamic-print-root {
            display: block !important;
            width: 100% !important;
            padding: 20px !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
        
        /* تصميم الجدول والمظهر العام ليطابق جودة وشكل النظام */
        .print-container { 
          font-family: 'Tajawal', 'Cairo', Tahoma, Arial, sans-serif; 
          direction: rtl; 
          text-align: right; 
        }
        .print-header { 
          text-align: center; 
          margin-bottom: 20px; 
          border-bottom: 3px solid #10528e; 
          padding-bottom: 12px; 
        }
        .print-header h1 { 
          color: #10528e; 
          margin: 0 0 8px 0; 
          font-size: 24px; 
          font-weight: bold; 
        }
        .print-header .sub-title { 
          color: #475569; 
          font-size: 13px; 
        }
        
        .print-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px; 
          font-size: 12px; 
        }
        .print-table th, .print-table td { 
          border: 1px solid #cbd5e1; 
          padding: 8px 10px; 
          text-align: right; 
        }
        
        /* إجبار المتصفح على طباعة وحفظ الألوان والخلفيات في الـ PDF دون أي خطأ */
        .print-table th { 
          background-color: #10528e !important; 
          color: white !important; 
          font-weight: bold; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        }
        .print-table tr:nth-child(even) { 
          background-color: #f8fafc !important; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        }
        
        .text-num { 
          font-family: 'Courier New', monospace; 
          text-align: left; 
          direction: ltr; 
          font-weight: bold; 
        }
        .text-idx { 
          width: 40px; 
          text-align: center; 
          color: #64748b; 
          font-weight: bold; 
        }
      </style>
      
      <div class="print-container">
        <div class="print-header">
          <h1>${title}</h1>
          <div class="sub-title">المجلس اليمني للاختصاصات الطبية - صعدة • التاريخ: ${today} • إجمالي السجلات: ${rows.length}</div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th class="text-idx">م</th>
              ${columns.map(c => `<th>${c.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td class="text-idx">${i + 1}</td>
                ${columns.map(c => {
                  const v = r[c.key];
                  const isNum = numericKeys.includes(c.key) || typeof v === "number";
                  return `<td class="${isNum ? "text-num" : ""}">${
                    isNum ? fmt(Number(v) || 0) : (v ?? "—")
                  }</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    // 3. إدراج الحاوية في الصفحة الحالية واستدعاء نافذة الطباعة المستقرة للنظام
    document.body.appendChild(printRoot);
    
    // مهلة برمجية صغيرة جداً لتهيئة خطوط الصفحة وتنسيقات الألوان
    setTimeout(() => {
      window.print();
      
      // 4. إزالة الحاوية فوراً بعد إغلاق أمر الطباعة ليعود الموقع لحالته الطبيعية للمستخدم
      document.body.removeChild(printRoot);
    }, 50);
  };

  const handleExcel = () => {
    if (!rows.length) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const data = rows.map((r, i) => {
      const out: Record<string, any> = { م: i + 1 };
      columns.forEach((c) => {
        const v = r[c.key];
        out[c.label] =
          numericKeys.includes(c.key) || typeof v === "number" ? Number(v) || 0 : v ?? "";
      });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30) || "Sheet1");
    XLSX.writeFile(wb, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("تم تصدير الملف بنجاح");
  };

  const handleClear = () => {
    if (!onClear) return;
    if (!confirm(`هل أنت متأكد من مسح جميع بيانات: ${title}؟ لا يمكن التراجع.`)) return;
    onClear();
    toast.success("تم مسح البيانات");
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        onClick={handlePrint}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#10528e] border border-[#10528e]/30 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-50 active:scale-95 transition-all"
        title="طباعة وحفظ هذا التبويب كـ PDF بنفس جودة وشكل النظام"
      >
        <Printer className="w-4 h-4" /> طباعة / PDF
      </button>
      <button
        onClick={handleExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
        title="تصدير إلى Excel"
      >
        <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
      </button>
      {onClear && (
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-rose-700 active:scale-95 transition-all"
          title="مسح بيانات هذا التبويب"
        >
          <Trash2 className="w-4 h-4" /> مسح البيانات
        </button>
      )}
    </div>
  );
}
