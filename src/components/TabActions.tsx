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

const escapeHtml = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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
    
    // 1. إنشاء عنصر iframe مخفي تماماً في الخلفية
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.zIndex = "-9999";
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      toast.error("تعذر تهيئة محرك الطباعة الداخلي");
      document.body.removeChild(iframe);
      return;
    }
    
    // تنظيف اسم الملف لتجنب أي أخطاء في التسمية أثناء حفظ الـ PDF
    const cleanTitle = escapeHtml(title.replace(/[/\\?%*:|"<>]/g, ""));
    
    const head = `
      <meta charset="utf-8" />
      <title>${cleanTitle}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Tajawal','Cairo',Tahoma,Arial,sans-serif; padding: 16px; color: #0f172a; background: #fff; }
        h1 { text-align: center; color: #10528e; margin: 0 0 6px; font-size: 22px; }
        .sub { text-align: center; color: #64748b; margin-bottom: 14px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
        thead th { background: #10528e; color: #fff; font-weight: 700; }
        tbody tr:nth-child(even) { background: #f1f5f9; }
        .num { font-family: 'Courier New', monospace; text-align: left; direction: ltr; }
        .idx { width: 36px; text-align: center; color: #64748b; }
      </style>
    `;
    
    const head2 = `<tr><th class="idx">م</th>${columns
      .map((c) => `<th>${escapeHtml(c.label)}</th>`)
      .join("")}</tr>`;
      
    const body2 = rows
      .map(
        (r, i) =>
          `<tr><td class="idx">${i + 1}</td>${columns
            .map((c) => {
              const v = r[c.key];
              const isNum = numericKeys.includes(c.key) || typeof v === "number";
              return `<td class="${isNum ? "num" : ""}">${
                isNum ? escapeHtml(fmt(Number(v) || 0)) : escapeHtml(v)
              }</td>`;
            })
            .join("")}</tr>`
      )
      .join("");
      
    const today = new Date().toLocaleDateString("ar-EG-u-nu-latn");
    
    // 2. كتابة المحتوى داخل الـ Iframe المخفي
    doc.write(`<!doctype html><html lang="ar" dir="rtl"><head>${head}</head><body>
      <h1>${cleanTitle}</h1>
      <div class="sub">المجلس اليمني للاختصاصات الطبية - صعدة • ${today} • عدد السجلات: ${rows.length}</div>
      <table><thead>${head2}</thead><tbody>${body2}</tbody></table>
    </body></html>`);
    doc.close();
    
    // 3. الانتظار نصف ثانية حتى يستقر الجدول تماماً في المتصفح ثم تشغيل الطباعة والحفظ
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // 4. حذف الـ iframe بعد إغلاق نافذة الطباعة/الحفظ للحفاظ على أداء الذاكرة
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    }, 500);
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
        title="طباعة وحفظ هذا التبويب كـ PDF"
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
