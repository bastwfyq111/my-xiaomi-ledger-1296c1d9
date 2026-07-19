import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";  
import {  
  FileSpreadsheet, Plus, Trash2, CalendarDays,  
  Upload, Download, FileText, Printer, Eraser,  
} from "lucide-react";  
import * as XLSX from "xlsx";  
  
const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان"];  
const STORAGE_KEY = "app-tabs-usages-v1";  
  
const COLORS = { TOTAL_ALL: "#E5DFEC", BAB_TOTAL: "#DBEEF3", FASL: "#FDE9D9", BAND: "#C6D9F0" };  
  
const dataColumnsOrder = [  
  "اجمالي عام الاستخدامات",  
  "اجمالي الباب الاول",  
  "الفصل الاول_باب1",  
  "المرتبات الاساسية", "اجور تعاقدية", "اجور عمل اضافي", "مكافات", "طبيعة عمل", "بدل ريف", "بدل سكن", "بدل تحديث",  
  "الفصل الثاني_باب1",  
  "ح/حكومة", "اصابة عمل",  
  "اجمالي الباب الثاني",  
  "الفصل الاول_باب2",  
  "مياه", "انارة", "ادوات كتابية", "نشر واعلان", "اتصالات", "مؤتمرات واحتفالات", "نفقات النظافة", "اخرى", "نقل مهام", "انتقالات داخلية", "ايجار مباني", "ادوية ومستلزمات طبية", "اغذية وملبوسات", "اخرى_2",  
  "الفصل الثاني_باب2",  
  "صيانة مباني", "وقود وزيوت", "قطع غيار وصيانة وسائل النقل", "قطع غيار وصيانة الالات والمعدات والاثاث",  
  "اجمالي الباب الرابع",  
  "مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات",  
];  
  
const TOTAL_COLS = mainHeaders.length + dataColumnsOrder.length + 1; // = 47  
  
const isFormulaCol = (col: string) => col.includes("اجمالي") || col.includes("الفصل");  
  
const MONTHS = [  
  { id: 1, name: "يناير" }, { id: 2, name: "فبراير" }, { id: 3, name: "مارس" }, { id: 4, name: "أبريل" },  
  { id: 5, name: "مايو" }, { id: 6, name: "يونيو" }, { id: 7, name: "يوليو" }, { id: 8, name: "أغسطس" },  
  { id: 9, name: "سبتمبر" }, { id: 10, name: "أكتوبر" }, { id: 11, name: "نوفمبر" }, { id: 12, name: "ديسمبر" },  
];  
  
// تطبيع النص: إزالة الفراغات الزائدة (يحل مشكلة فراغ الخلايا عند الاستيراد)  
const norm = (s: any) => String(s ?? "").replace(/\s+/g, " ").trim();  
  
const formatNumberEn = (val: any) => {  
  if (val === "" || val === null || val === undefined) return "";  
  const num = Number(val);  
  if (isNaN(num)) return val;  
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);  
};  
  
const sumColumns = (row: any, cols: string[]): number =>  
  cols.reduce((acc, col) => {  
    const num = Number(row[col]);  
    return acc + (isNaN(num) ? 0 : num);  
  }, 0);  
  
const recomputeRow = (row: any) => {  
  const newRow = { ...row };  
  const fasl1Bab1 = sumColumns(newRow, ["المرتبات الاساسية", "اجور تعاقدية", "اجور عمل اضافي", "مكافات", "طبيعة عمل", "بدل ريف", "بدل سكن", "بدل تحديث"]);  
  const fasl2Bab1 = sumColumns(newRow, ["ح/حكومة", "اصابة عمل"]);  
  newRow["الفصل الاول_باب1"] = fasl1Bab1;  
  newRow["الفصل الثاني_باب1"] = fasl2Bab1;  
  newRow["اجمالي الباب الاول"] = fasl1Bab1 + fasl2Bab1;  
  
  const fasl1Bab2 = sumColumns(newRow, ["مياه", "انارة", "ادوات كتابية", "نشر واعلان", "اتصالات", "مؤتمرات واحتفالات", "نفقات النظافة", "اخرى", "نقل مهام", "انتقالات داخلية", "ايجار مباني", "ادوية ومستلزمات طبية", "اغذية وملبوسات", "اخرى_2"]);  
  const fasl2Bab2 = sumColumns(newRow, ["صيانة مباني", "وقود وزيوت", "قطع غيار وصيانة وسائل النقل", "قطع غيار وصيانة الالات والمعدات والاثاث"]);  
  newRow["الفصل الاول_باب2"] = fasl1Bab2;  
  newRow["الفصل الثاني_باب2"] = fasl2Bab2;  
  newRow["اجمالي الباب الثاني"] = fasl1Bab2 + fasl2Bab2;  
  
  newRow["اجمالي الباب الرابع"] = sumColumns(newRow, ["مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"]);  
  newRow["اجمالي عام الاستخدامات"] =  
    newRow["اجمالي الباب الاول"] + newRow["اجمالي الباب الثاني"] + newRow["اجمالي الباب الرابع"];  
  return newRow;  
};  
  
// --- خلية قابلة للتحرير (خارج المكوّن الرئيسي لتفادي فقدان التركيز) ---  
const EditableCell: React.FC<{  
  rowId: string; field: string; value: any;  
  onCommit: (rowId: string, field: string, value: string) => void;  
}> = React.memo(({ rowId, field, value, onCommit }) => {  
  const isDate = field === "التاريخ";  
  return (  
    <input  
      type={isDate ? "date" : "text"}  
      value={value ?? ""}  
      onChange={(e) => onCommit(rowId, field, e.target.value)}  
      dir={isDate ? "ltr" : /^[\d.,\-]*$/.test(String(value ?? "")) ? "ltr" : "rtl"}  
      className="w-full h-full min-w-[70px] bg-transparent focus:bg-amber-50 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center text-[12px] text-slate-800"  
    />  
  );  
});  
EditableCell.displayName = "EditableCell";  
  
const FormulaCell: React.FC<{ value: any }> = React.memo(({ value }) => (  
  <div className="font-bold text-center text-[12px] text-slate-800" dir="ltr">  
    {formatNumberEn(value)}  
  </div>  
));  
FormulaCell.displayName = "FormulaCell";  
  
const AppTabs: React.FC = () => {  
  const [dataRows, setDataRows] = useState<any[]>(() => {  
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }  
    catch { return []; }  
  });  
  // شهر الاستيراد الافتراضي (يمكن تغييره من قائمة الاستيراد)  
  const [importMonthId, setImportMonthId] = useState<number>(1);  
  const fileInputRef = useRef<HTMLInputElement>(null);  
  
  useEffect(() => {  
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataRows));  
  }, [dataRows]);  
  
  const rowsOfMonth = useCallback(  
    (id: number) => dataRows.filter((r) => r.monthId === id),  
    [dataRows]  
  );  
  
  const makeEmptyRow = (monthId: number) => {  
    const r: any = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, monthId };  
    mainHeaders.forEach((h) => (r[h] = ""));  
    dataColumnsOrder.forEach((h) => (r[h] = ""));  
    return recomputeRow(r);  
  };  
  
  // زرع صفّين فارغين لكل شهر لا يحتوي على بيانات (مرة واحدة عند الإقلاع)  
  useEffect(() => {  
    setDataRows((prev) => {  
      const counts: Record<number, number> = {};  
      prev.forEach((r) => (counts[r.monthId] = (counts[r.monthId] || 0) + 1));  
      const additions: any[] = [];  
      MONTHS.forEach((m) => {  
        if (!counts[m.id]) additions.push(makeEmptyRow(m.id), makeEmptyRow(m.id));  
      });  
      return additions.length ? [...prev, ...additions] : prev;  
    });  
  }, []); // eslint-disable-line react-hooks/exhaustive-deps  
  
  const updateCell = useCallback((rowId: string, key: string, rawValue: string) => {  
    setDataRows((prev) =>  
      prev.map((row) => (row.id === rowId ? recomputeRow({ ...row, [key]: rawValue }) : row))  
    );  
  }, []);  
  
  const handleAddRow = (monthId: number) => {  
    setDataRows((prev) => [...prev, makeEmptyRow(monthId)]);  
  };  
  
  const handleDeleteRow = (rowId: string) => {  
    if (!window.confirm("هل تريد حذف هذا السطر؟")) return;  
    setDataRows((prev) => prev.filter((row) => row.id !== rowId));  
  };  
  
  // مسح كامل محتويات الجدول (كل الأشهر)  
  const handleClearAll = () => {  
    if (!window.confirm("سيتم حذف جميع بيانات كل الأشهر نهائياً. هل أنت متأكد؟")) return;  
    // نعيد زرع صفّين فارغين لكل شهر بعد المسح  
    const fresh: any[] = [];  
    MONTHS.forEach((m) => fresh.push(makeEmptyRow(m.id), makeEmptyRow(m.id)));  
    setDataRows(fresh);  
  };  
  
  // --- إجماليات الشهر بالترتيب المطلوب ---  
  const sumOf = (rows: any[], col: string) =>  
    rows.reduce((acc, row) => acc + (Number(row[col]) || 0), 0);  
  
  const monthTotals = (id: number) => {  
    const cur = rowsOfMonth(id);  
    const before = dataRows.filter((r) => r.monthId < id);  // كل الأشهر السابقة  
    const cum = dataRows.filter((r) => r.monthId <= id);    // السابق + الحالي  
    return {  
      current: (c: string) => sumOf(cur, c),  
      before: (c: string) => sumOf(before, c),  
      cumulative: (c: string) => sumOf(cum, c),  
    };  
  };  
  
  // --- استيراد Excel (مع تطبيع الأعمدة) ---  
  const handleImportClick = () => fileInputRef.current?.click();  
  
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {  
    const file = e.target.files?.[0];  
    if (!file) return;  
    const reader = new FileReader();  
    reader.onload = (ev) => {  
      try {  
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);  
        const wb = XLSX.read(data, { type: "array" });  
        const ws = wb.Sheets[wb.SheetNames[0]];  
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });  
  
        const allCols = [...mainHeaders, ...dataColumnsOrder];  
        const imported = json.map((r) => {  
          const lookup: Record<string, any> = {};  
          Object.keys(r).forEach((k) => (lookup[norm(k)] = r[k]));  
          const row: any = {  
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,  
            monthId: importMonthId,  
          };  
          allCols.forEach((c) => {  
            const v = lookup[norm(c)];  
            row[c] = v === undefined ? "" : v;  
          });  
          return recomputeRow(row);  
        });  
  
        setDataRows((prev) => [...prev, ...imported]); // تحديث دفعة واحدة (أسرع)  
        alert(`تم استيراد ${imported.length} سطر إلى شهر ${MONTHS.find((m) => m.id === importMonthId)?.name}`);  
      } catch {  
        alert("تعذّر قراءة ملف Excel.");  
      } finally {  
        if (fileInputRef.current) fileInputRef.current.value = "";  
      }  
    };  
    reader.readAsArrayBuffer(file);  
  };  
  
  // --- تصدير Excel (كل الأشهر، كل شهر في ورقة) ---  
  const handleExportExcel = () => {  
    const allCols = [...mainHeaders, ...dataColumnsOrder];  
    const wb = XLSX.utils.book_new();  
    let any = false;  
    MONTHS.forEach((m) => {  
      const rows = rowsOfMonth(m.id).filter((r) =>  
        dataColumnsOrder.some((c) => Number(r[c]) > 0) || mainHeaders.some((h) => r[h] !== "")  
      );  
      if (!rows.length) return;  
      any = true;  
      const data = rows.map((row) => {  
        const out: Record<string, any> = {};  
        allCols.forEach((c) => {  
          const v = row[c];  
          out[c] = isFormulaCol(c) || (v !== "" && !isNaN(Number(v))) ? Number(v) || v : v;  
        });  
        return out;  
      });  
      const ws = XLSX.utils.json_to_sheet(data, { header: allCols });  
      XLSX.utils.book_append_sheet(wb, ws, m.name.slice(0, 30));  
    });  
    if (!any) { alert("لا توجد بيانات للتصدير"); return; }  
    XLSX.writeFile(wb, `الاستخدامات-كل-الاشهر.xlsx`);  
  };  
  
  // --- بناء HTML لكل الأشهر (للطباعة و PDF) A4 أفقي ---  
  const buildAllMonthsHtml = () => {  
    const allCols = [...mainHeaders, ...dataColumnsOrder];  
    const headRow = allCols.map((c) => `<th>${c}</th>`).join("");  
  
    const totalRow = (label: string, fn: (c: string) => number, cls: string) =>  
      `<tr class="${cls}"><td colspan="${mainHeaders.length}">${label}</td>${dataColumnsOrder  
        .map((c) => `<td class="num">${fn(c) ? formatNumberEn(fn(c)) : "-"}</td>`)  
        .join("")}<td></td></tr>`;  
  
    const bodyForMonth = (id: number) => {  
      const rows = rowsOfMonth(id);  
      if (!rows.length) return "";  
      const t = monthTotals(id);  
      const monthName = MONTHS.find((m) => m.id === id)?.name || "";  
      const dataRowsHtml = rows  
        .map(  
          (row) =>  
            `<tr>${allCols  
              .map((c) => {  
                const v = row[c];  
                const isNum = isFormulaCol(c) || (v !== "" && !isNaN(Number(v)));  
                return `<td class="${isNum ? "num" : ""}">${  
                  v === "" || v == null ? "" : isNum ? formatNumberEn(v) : v  
                }</td>`;  
              })  
              .join("")}<td></td></tr>`  
        )  
        .join("");  
      return (  
        `<tr class="month-sep"><td colspan="${allCols.length + 1}">شهر ${monthName}</td></tr>` +  
        dataRowsHtml +  
        totalRow(`إجمالي شهر ${monthName}`, t.current, "cur") +  
        totalRow(`إجمالي الأشهر السابقة (قبل ${monthName})`, t.before, "prev") +  
        totalRow(`الإجمالي العام (حتى ${monthName})`, t.cumulative, "tot")  
      );  
    };  
  
    const body = MONTHS.filter((m) => rowsOfMonth(m.id).length)  
      .map((m) => bodyForMonth(m.id))  
      .join("");  
  
    return `<!doctype html><html lang="ar" dir="rtl"><head>  
      <meta charset="utf-8" />  
      <title>سجل مفردات الاستخدامات - كل الأشهر</title>  
      <link rel="preconnect" href="https://fonts.googleapis.com">  
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap">  
      <style>  
        @page { size: A4 landscape; margin: 6mm; }  
        body { font-family: 'Cairo','Tajawal','Segoe UI',Tahoma,Arial,sans-serif; direction: rtl; color:#0f172a; padding:6px; }  
        h1 { text-align:center; font-size:16px; color:#0b3d6d; margin:0 0 4px; }  
        .meta { text-align:center; font-size:10px; color:#475569; margin-bottom:6px; }  
        table { width:100%; border-collapse:collapse; font-size:8px; table-layout:fixed; }  
        th, td { border:1px solid #94a3b8; padding:2px 3px; text-align:center; word-wrap:break-word; overflow-wrap:anywhere; }  
        thead th { background:#0b3d6d; color:#fff; }  
        .num { direction:ltr; font-family:'Courier New',monospace; }  
        tr.month-sep td { background:#0b3d6d; color:#fbbf24; font-weight:800; text-align:right; font-size:11px; padding:5px 8px; }  
        tr.cur td { background:#dbeafe; font-weight:700; color:#0b3d6d; }  
        tr.prev td { background:#e2e8f0; font-weight:700; }  
        tr.tot td { background:#0b3d6d; color:#fbbf24; font-weight:800; }  
      </style></head><body>  
      <h1>سجل مفردات الاستخدامات والنفقات العامة - كل الأشهر</h1>  
      <div class="meta">${new Date().toLocaleDateString("ar-EG-u-nu-latn")}</div>  
      <table><thead><tr>${headRow}<th>إجراء</th></tr></thead><tbody>${body}</tbody></table>  
    </body></html>`;  
  };  
  
  const openPrintWindow = () => {  
    if (dataRows.length === 0) { alert("لا توجد بيانات"); return; }  
    const w = window.open("", "_blank", "width=1200,height=800");  
    if (!w) return;  
    w.document.write(  
      buildAllMonthsHtml().replace(  
        "</body>",  
        "<script>window.onload=()=>setTimeout(()=>window.print(),500)</script></body>"  
      )  
    );  
    w.document.close();  
  };  
  
  const handlePrint = openPrintWindow;    // طباعة كل الأشهر A4 أفقي  
  const handleExportPdf = openPrintWindow; // PDF عبر "حفظ كـ PDF" من نافذة الطباعة  
  
  return (  
    <div className="space-y-4 font-tajawal text-slate-800 p-2" dir="rtl">  
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />  
  
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">  
        <div className="flex flex-wrap items-center justify-between gap-3">  
          <div className="flex items-center gap-2">  
            <FileSpreadsheet className="w-5 h-5 text-blue-800" />  
            <h2 className="text-base font-bold text-blue-900">سجل مفردات الاستخدامات والنفقات العامة</h2>  
          </div>  
          <div className="flex flex-wrap items-center gap-2">  
            {/* اختيار شهر الاستيراد */}  
            <select  
              value={importMonthId}  
              onChange={(e) => setImportMonthId(Number(e.target.value))}  
              className="text-xs border border-slate-300 rounded px-2 py-2 bg-white"  
              title="شهر الاستيراد"  
            >  
              {MONTHS.map((m) => (  
                <option key={m.id} value={m.id}>استيراد إلى: {m.name}</option>  
              ))}  
            </select>  
            <button onClick={handleImportClick} className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs px-4 py-2 rounded shadow-sm"><Upload className="w-4 h-4" /> استيراد Excel</button>  
            <button onClick={handleExportExcel} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded shadow-sm"><Download className="w-4 h-4" /> تصدير Excel</button>  
            <button onClick={handleExportPdf} className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 rounded shadow-sm"><FileText className="w-4 h-4" /> تحويل PDF</button>  
            <button onClick={handlePrint} className="flex items-center gap-1 bg-white text-blue-800 border border-blue-800/30 hover:bg-blue-50 text-xs px-4 py-2 rounded shadow-sm"><Printer className="w-4 h-4" /> طباعة</button>  
            <button onClick={handleClearAll} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded shadow-sm"><Eraser className="w-4 h-4" /> مسح الكل</button>  
          </div>  
        </div>  
      </div>  
  
      <div className="w-full overflow-x-auto border border-slate-300 shadow-sm bg-white rounded-b-lg" style={{ maxHeight: "70vh" }}>  
        <table className="w-full text-center border-collapse text-[11px] whitespace-nowrap">  
          <thead className="sticky top-0 z-20 bg-white shadow-sm">  
            <tr className="border-b border-slate-300">  
              <th colSpan={4} className="border border-slate-300 p-1 bg-slate-100">البيانات الأساسية</th>  
              <th rowSpan={4} className="border border-slate-300 p-1 font-bold shadow-inner" style={{ backgroundColor: COLORS.TOTAL_ALL }}>  
                <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-24">اجمالي عام الاستخدامات</div>  
              </th>  
              <th colSpan={13} className="border border-slate-300 p-1 font-bold" style={{ backgroundColor: COLORS.BAB_TOTAL }}>اجمالي الباب الاول</th>  
              <th colSpan={21} className="border border-slate-300 p-1 font-bold" style={{ backgroundColor: COLORS.BAB_TOTAL }}>اجمالي الباب الثاني</th>  
              <th colSpan={7} className="border border-slate-300 p-1 font-bold" style={{ backgroundColor: COLORS.BAB_TOTAL }}>اجمالي الباب الرابع</th>  
              <th rowSpan={4} className="border border-slate-300 p-1 bg-slate-100">إجراء</th>  
            </tr>  
            <tr className="border-b border-slate-300">  
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[70px]">رقم الاستمارة</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[70px]">كشف التسوية</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[120px]"><div className="flex items-center justify-center gap-1"><CalendarDays className="w-3 h-3" /> التاريخ</div></th>  
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[200px]">البيان</th>  
              <th colSpan={11} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>  
              <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>  
              <th colSpan={15} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>  
              <th colSpan={6} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>  
              <th rowSpan={3} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">الإجمالي</div></th>  
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مركز صحي قحزة</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">وحدة الغسيل الكلوي</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مشروع دعم الكلى</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">الصالة والمطبخ</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مركز صحي</th>  
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">الامانات</th>  
            </tr>  
            <tr className="border-b border-slate-300">  
              <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">الإجمالي</div></th>  
              <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">إجمالي ف1</div></th>  
              <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAND }}>البند الاول</th>  
              <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAND }}>البند الثالث</th>  
              <th colSpan={4} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAND }}>البند الرابع</th>  
              <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">إجمالي ف2</div></th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">ح/حكومة</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">اصابة عمل</th>  
              <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">الإجمالي</div></th>  
              <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">إجمالي ف1</div></th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">مياه</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">انارة</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">ادوات كتابية</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">نشر واعلان</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">اتصالات</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">مؤتمرات</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">نظافة</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">اخرى</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">نقل مهام</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">انتقالات</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">ايجار مباني</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">ادوية</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">اغذية</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">اخرى2</th>  
              <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">إجمالي ف2</div></th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">صيانة مباني</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">وقود وزيوت</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">قطع غيار نقل</th>  
              <th rowSpan={2} className="border border-slate-300 p-1 bg-white">قطع غيار معدات</th>  
            </tr>  
            <tr className="border-b border-slate-300 bg-white">  
              <th className="border border-slate-300 p-1">اساسية</th>  
              <th className="border border-slate-300 p-1">تعاقدية</th>  
              <th className="border border-slate-300 p-1">اضافي</th>  
              <th className="border border-slate-300 p-1">مكافات</th>  
              <th className="border border-slate-300 p-1">طبيعة عمل</th>  
              <th className="border border-slate-300 p-1">بدل ريف</th>  
              <th className="border border-slate-300 p-1">بدل سكن</th>  
              <th className="border border-slate-300 p-1">تحديث</th>  
            </tr>  
          </thead>  
  
          <tbody>  
            {MONTHS.map((month) => {  
              const rows = rowsOfMonth(month.id);  
              const t = monthTotals(month.id);  
              return (  
                <React.Fragment key={month.id}>  
                  {/* فاصل الشهر + زر إضافة صف لهذا الشهر */}  
                  <tr className="bg-[#0b3d6d] text-amber-300">  
                    <td colSpan={TOTAL_COLS} className="border border-white/20 p-2 font-bold text-right pr-4">  
                      <span>شهر {month.name}</span>  
                      <button onClick={() => handleAddRow(month.id)}  
                        className="mr-3 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2 py-1 rounded">  
                        <Plus className="w-3 h-3" /> إضافة سطر لهذا الشهر  
                      </button>  
                    </td>  
                  </tr>  
  
                  {rows.map((row) => (  
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">  
                      {mainHeaders.map((header) => (  
                        <td key={header} className="border border-slate-200 p-0">  
                          <EditableCell rowId={row.id} field={header} value={row[header]} onCommit={updateCell} />  
                        </td>  
                      ))}  
                      {dataColumnsOrder.map((col) => {  
                        const formula = isFormulaCol(col);  
                        return (  
                          <td key={col} className={`border border-slate-200 p-0 ${formula ? "bg-slate-50/50" : ""}`}  
                            style={{ backgroundColor:  
                              col === "اجمالي عام الاستخدامات" ? COLORS.TOTAL_ALL  
                              : col.includes("اجمالي الباب") ? COLORS.BAB_TOTAL  
                              : col.includes("الفصل") ? COLORS.FASL : undefined }}>  
                            {formula ? <FormulaCell value={row[col]} />  
                              : <EditableCell rowId={row.id} field={col} value={row[col]} onCommit={updateCell} />}  
                          </td>  
                        );  
                      })}  
                      <td className="border border-slate-200 p-1 text-center bg-white">  
                        <button onClick={() => handleDeleteRow(row.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4 mx-auto" /></button>  
                      </td>  
                    </tr>  
                  ))}  
  
                  {/* 1) إجمالي الشهر الحالي */}  
                  <tr className="bg-blue-100 border-b border-blue-200">  
                    <td colSpan={4} className="border border-blue-300 p-1 font-bold text-blue-900 text-right pr-4">إجمالي شهر {month.name}</td>  
                    {dataColumnsOrder.map((col) => (  
                      <td key={`c-${month.id}-${col}`} className="border border-blue-300 p-1 text-blue-900 font-bold" dir="ltr">  
                        {t.current(col) > 0 ? formatNumberEn(t.current(col)) : "-"}  
                      </td>  
                    ))}  
                    <td className="border border-blue-300 bg-blue-100"></td>  
                  </tr>  
  
                  {/* 2) إجمالي الأشهر السابقة للشهر الحالي */}  
                  <tr className="bg-slate-200 border-b border-slate-300">  
                    <td colSpan={4} className="border border-slate-300 p-1 font-bold text-slate-700 text-right pr-4">إجمالي الأشهر السابقة (قبل {month.name})</td>  
                    {dataColumnsOrder.map((col) => (  
                      <td key={`b-${month.id}-${col}`} className="border border-slate-300 p-1 text-slate-700 font-semibold" dir="ltr">  
                        {t.before(col) > 0 ? formatNumberEn(t.before(col)) : "-"}  
                      </td>  
                    ))}  
                    <td className="border border-slate-300 bg-slate-200"></td>  
                  </tr>  
  
                  {/* 3) الإجمالي العام (السابق + الحالي) */}  
                  <tr className="bg-[#0b3d6d] text-white">  
                    <td colSpan={4} className="border border-white/20 p-1 font-bold text-right pr-4">الإجمالي العام (حتى {month.name})</td>  
                    {dataColumnsOrder.map((col) => (  
                      <td key={`cum-${month.id}-${col}`} className="border border-white/20 p-1 font-bold text-amber-300" dir="ltr">  
                        {t.cumulative(col) > 0 ? formatNumberEn(t.cumulative(col)) : "-"}  
                      </td>  
                    ))}  
                    <td className="border border-white/20"></td>  
                  </tr>  
                </React.Fragment>  
              );  
            })}  
          </tbody>  
        </table>  
      </div>  
    </div>  
  );  
};  
  
export default AppTabs;
