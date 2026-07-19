import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";  
import {  
  FileSpreadsheet, Plus, Trash2, Upload, Download, FileText, Printer, Eraser,  
} from "lucide-react";  
import * as XLSX from "xlsx";  
import ExcelJS from "exceljs";  
  
const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان"];  
const STORAGE_KEY = "app-tabs-usages-v1";  
  
const COLORS = { TOTAL_ALL: "#E5DFEC", BAB_TOTAL: "#DBEEF3", FASL: "#FDE9D9", BAND: "#C6D9F0" };  
// نفس الألوان بصيغة ARGB لمكتبة exceljs (بدون #، مع بادئة FF للعتامة الكاملة)  
const ARGB = { TOTAL_ALL: "FFE5DFEC", BAB_TOTAL: "FFDBEEF3", FASL: "FFFDE9D9", BAND: "FFC6D9F0",  
  DARK: "FF0B3D6D", GOLD: "FFFFD54A", CUR: "FFDBEAFE", PREV: "FFE2E8F0" };  
  
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
  
const allCols = [...mainHeaders, ...dataColumnsOrder];  
const TOTAL_COLS = allCols.length + 1; // = 47 (مع عمود الإجراء)  
  
const isFormulaCol = (col: string) => col.includes("اجمالي") || col.includes("الفصل");  
  
// لون خلفية العمود (واجهة + تصدير)  
const colHex = (col: string) =>  
  col === "اجمالي عام الاستخدامات" ? COLORS.TOTAL_ALL  
  : col.includes("اجمالي الباب") ? COLORS.BAB_TOTAL  
  : col.includes("الفصل") ? COLORS.FASL : undefined;  
const colArgb = (col: string) =>  
  col === "اجمالي عام الاستخدامات" ? ARGB.TOTAL_ALL  
  : col.includes("اجمالي الباب") ? ARGB.BAB_TOTAL  
  : col.includes("الفصل") ? ARGB.FASL : undefined;  
  
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
  
// ====== ترويسة الجدول متعددة المستويات (تُعاد نفسها في الواجهة والطباعة) ======  
const THEAD_HTML = `  
<tr>  
  <th rowspan="4">رقم الاستمارة</th><th rowspan="4">كشف التسوية</th>  
  <th rowspan="4">التاريخ</th><th rowspan="4">البيان</th>  
  <th rowspan="4" class="c-total">اجمالي عام الاستخدامات</th>  
  <th colspan="13" class="c-bab">اجمالي الباب الاول</th>  
  <th colspan="21" class="c-bab">اجمالي الباب الثاني</th>  
  <th colspan="7" class="c-bab">اجمالي الباب الرابع</th>  
  <th rowspan="4">إجراء</th>  
</tr>  
<tr>  
  <th rowspan="3" class="c-bab">الإجمالي</th>  
  <th colspan="10" class="c-fasl">الفصل الاول</th>  
  <th colspan="2" class="c-fasl">الفصل الثاني</th>  
  <th rowspan="3" class="c-bab">الإجمالي</th>  
  <th colspan="15" class="c-fasl">الفصل الاول</th>  
  <th colspan="5" class="c-fasl">الفصل الثاني</th>  
  <th rowspan="3" class="c-bab">الإجمالي</th>  
  <th rowspan="3">مركز صحي قحزة</th><th rowspan="3">وحدة الغسيل الكلوي</th>  
  <th rowspan="3">مشروع دعم الكلى</th><th rowspan="3">الصالة والمطبخ</th>  
  <th rowspan="3">مركز صحي</th><th rowspan="3">الامانات</th>  
</tr>  
<tr>  
  <th rowspan="2" class="c-fasl">إجمالي ف1</th>  
  <th colspan="8" class="c-band">المرتبات والأجور</th>  
  <th rowspan="2" class="c-fasl">إجمالي ف2</th>  
  <th rowspan="2">ح/حكومة</th><th rowspan="2">اصابة عمل</th>  
  <th rowspan="2" class="c-fasl">إجمالي ف1</th>  
  <th rowspan="2">مياه</th><th rowspan="2">انارة</th><th rowspan="2">ادوات كتابية</th>  
  <th rowspan="2">نشر واعلان</th><th rowspan="2">اتصالات</th><th rowspan="2">مؤتمرات</th>  
  <th rowspan="2">نظافة</th><th rowspan="2">اخرى</th><th rowspan="2">نقل مهام</th>  
  <th rowspan="2">انتقالات</th><th rowspan="2">ايجار مباني</th><th rowspan="2">ادوية</th>  
  <th rowspan="2">اغذية</th><th rowspan="2">اخرى2</th>  
  <th rowspan="2" class="c-fasl">إجمالي ف2</th>  
  <th rowspan="2">صيانة مباني</th><th rowspan="2">وقود وزيوت</th>  
  <th rowspan="2">قطع غيار نقل</th><th rowspan="2">قطع غيار معدات</th>  
</tr>  
<tr>  
  <th>اساسية</th><th>تعاقدية</th><th>اضافي</th><th>مكافات</th>  
  <th>طبيعة عمل</th><th>بدل ريف</th><th>بدل سكن</th><th>تحديث</th>  
</tr>`;  
  
const AppTabs: React.FC = () => {  
  const [dataRows, setDataRows] = useState<any[]>(() => {  
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }  
    catch { return []; }  
  });  
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
  
  // زرع صفّين فارغين لكل شهر لا يحتوي على بيانات (عند الإقلاع)  
  useEffect(() => {  
    setDataRows((prev) => {  
      const counts: Record<number, number> = {};  
      prev.forEach((r) => (counts[r.monthId] = (counts[r.monthId] || 0) + 1));  
      const additions: any[] = [];  
      MONTHS.forEach((m) => { if (!counts[m.id]) additions.push(makeEmptyRow(m.id), makeEmptyRow(m.id)); });  
      return additions.length ? [...prev, ...additions] : prev;  
    });  
  }, []); // eslint-disable-line react-hooks/exhaustive-deps  
  
  const updateCell = useCallback((rowId: string, key: string, rawValue: string) => {  
    setDataRows((prev) =>  
      prev.map((row) => (row.id === rowId ? recomputeRow({ ...row, [key]: rawValue }) : row))  
    );  
  }, []);  
  
  const handleAddRow = (monthId: number) => setDataRows((prev) => [...prev, makeEmptyRow(monthId)]);  
  
  const handleDeleteRow = (rowId: string) => {  
    if (!window.confirm("هل تريد حذف هذا السطر؟")) return;  
    setDataRows((prev) => prev.filter((row) => row.id !== rowId));  
  };  
  
  const handleClearAll = () => {  
    if (!window.confirm("سيتم حذف جميع بيانات كل الأشهر نهائياً. هل أنت متأكد؟")) return;  
    const fresh: any[] = [];  
    MONTHS.forEach((m) => fresh.push(makeEmptyRow(m.id), makeEmptyRow(m.id)));  
    setDataRows(fresh);  
  };  
  
  // --- إجماليات الشهر بالترتيب المطلوب ---  
  const sumOf = (rows: any[], col: string) =>  
    rows.reduce((acc, row) => acc + (Number(row[col]) || 0), 0);  
  
  const monthTotals = (id: number) => {  
    const cur = rowsOfMonth(id);  
    const before = dataRows.filter((r) => r.monthId < id);  
    const cum = dataRows.filter((r) => r.monthId <= id);  
    return {  
      current: (c: string) => sumOf(cur, c),  
      before: (c: string) => sumOf(before, c),  
      cumulative: (c: string) => sumOf(cum, c),  
    };  
  };  
  
  // ================= استيراد Excel (من الورقة المسطّحة) =================  
  const handleImportClick = () => fileInputRef.current?.click();  
  
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {  
    const file = e.target.files?.[0];  
    if (!file) return;  
    const reader = new FileReader();  
    reader.onload = (ev) => {  
      try {  
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);  
        const wb = XLSX.read(data, { type: "array" });  
        // نبحث عن ورقة "بيانات" المسطّحة، وإلا نأخذ أول ورقة  
        const wsName = wb.SheetNames.includes("بيانات") ? "بيانات" : wb.SheetNames[0];  
        const ws = wb.Sheets[wsName];  
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });  
  
        const imported = json.map((r) => {  
          // فهرس مطبّع لرؤوس ملف Excel  
          const lookup: Record<string, any> = {};  
          Object.keys(r).forEach((k) => (lookup[norm(k)] = r[k]));  
          const row: any = {  
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,  
            monthId: Number(lookup[norm("monthId")]) || importMonthId,  
          };  
          allCols.forEach((c) => {  
            const v = lookup[norm(c)];  
            // تحويل الأرقام النصية إلى أرقام حتى تُجمع  
            row[c] = v === "" || v === undefined || v === null  
              ? ""  
              : isNaN(Number(v)) ? v : Number(v);  
          });  
          return recomputeRow(row);  
        });  
  
        // نستبدل بيانات الأشهر الموجودة في الملف المستورد فقط  
        const importedMonths = new Set(imported.map((r) => r.monthId));  
        setDataRows((prev) => [  
          ...prev.filter((r) => !importedMonths.has(r.monthId)),  
          ...imported,  
        ]);  
      } catch (err) {  
        console.error(err);  
        window.alert("تعذّر قراءة الملف. تأكد أنه ملف Excel صادر من هذا الجدول.");  
      } finally {  
        if (fileInputRef.current) fileInputRef.current.value = "";  
      }  
    };  
    reader.readAsArrayBuffer(file);  
  };  
  
  // ================= تصدير Excel ملوّن (exceljs) + ورقة مسطّحة =================  
  const border = {  
    top: { style: "thin" as const, color: { argb: "FF94A3B8" } },  
    left: { style: "thin" as const, color: { argb: "FF94A3B8" } },  
    bottom: { style: "thin" as const, color: { argb: "FF94A3B8" } },  
    right: { style: "thin" as const, color: { argb: "FF94A3B8" } },  
  };  
  
  const handleExportExcel = async () => {  
    const wb = new ExcelJS.Workbook();  
  
    // ---------- ورقة العرض المنسّقة بالألوان ----------  
    const disp = wb.addWorksheet("عرض", { views: [{ rightToLeft: true }] });  
  
    // عنوان  
    disp.mergeCells(1, 1, 1, allCols.length);  
    const title = disp.getCell(1, 1);  
    title.value = "سجل مفردات الاستخدامات والنفقات العامة";  
    title.font = { bold: true, size: 14, color: { argb: ARGB.DARK } };  
    title.alignment = { horizontal: "center", vertical: "middle" };  
  
    // رؤوس الأعمدة (ملوّنة حسب المجموعة)  
    const hdr = disp.getRow(2);  
    allCols.forEach((c, i) => {  
      const cell = hdr.getCell(i + 1);  
      cell.value = c;  
      cell.font = { bold: true, size: 9 };  
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };  
      cell.border = border;  
      const argb = colArgb(c);  
      if (argb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };  
    });  
    disp.getColumn(1).width = 12;  
    allCols.forEach((_, i) => (disp.getColumn(i + 1).width = i < 4 ? 14 : 11));  
  
    let r = 3;  
    MONTHS.forEach((m) => {  
      const rows = rowsOfMonth(m.id);  
      const t = monthTotals(m.id);  
  
      // فاصل الشهر  
      disp.mergeCells(r, 1, r, allCols.length);  
      const mc = disp.getCell(r, 1);  
      mc.value = `شهر ${m.name}`;  
      mc.font = { bold: true, color: { argb: ARGB.GOLD } };  
      mc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB.DARK } };  
      mc.alignment = { horizontal: "right" };  
      r++;  
  
      // صفوف البيانات  
      rows.forEach((row) => {  
        allCols.forEach((c, i) => {  
          const cell = disp.getCell(r, i + 1);  
          const v = row[c];  
          cell.value = (typeof v === "number") ? v : (v === "" ? "" : (isNaN(Number(v)) ? v : Number(v)));  
          cell.alignment = { horizontal: "center" };  
          cell.font = { size: 9, bold: isFormulaCol(c) };  
          cell.border = border;  
          const argb = colArgb(c);  
          if (argb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };  
        });  
        r++;  
      });  
  
      // 1) إجمالي الشهر الحالي  
      const rowCur = (label: string, getter: (c: string) => number, fillArgb: string, fontArgb: string) => {  
        disp.mergeCells(r, 1, r, 4);  
        const lc = disp.getCell(r, 1);  
        lc.value = label; lc.font = { bold: true, color: { argb: fontArgb } };  
        lc.alignment = { horizontal: "right" };  
        lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };  
        dataColumnsOrder.forEach((c, i) => {  
          const cell = disp.getCell(r, 5 + i);  
          const val = getter(c);  
          cell.value = val || "";  
          cell.font = { bold: true, size: 9, color: { argb: fontArgb } };  
          cell.alignment = { horizontal: "center" };  
          cell.border = border;  
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };  
        });  
        r++;  
      };  
      rowCur(`إجمالي شهر ${m.name}`, t.current, ARGB.CUR, ARGB.DARK);  
      rowCur(`إجمالي الأشهر السابقة (قبل ${m.name})`, t.before, ARGB.PREV, "FF334155");  
      rowCur(`الإجمالي العام (حتى ${m.name})`, t.cumulative, ARGB.DARK, ARGB.GOLD);  
    });  
  
    // ---------- ورقة مسطّحة للاستيراد ----------  
    const flat = wb.addWorksheet("بيانات");  
    flat.addRow(["monthId", ...allCols]);  
    MONTHS.forEach((m) =>  
      rowsOfMonth(m.id).forEach((row) => flat.addRow([m.id, ...allCols.map((c) => row[c])]))  
    );  
  
    const buf = await wb.xlsx.writeBuffer();  
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });  
    const url = URL.createObjectURL(blob);  
    const a = document.createElement("a");  
    a.href = url;  
    a.download = `الاستخدامات-${new Date().toISOString().slice(0, 10)}.xlsx`;  
    a.click();  
    URL.revokeObjectURL(url);  
  };  
  
  // ================= بناء HTML لكل الأشهر (طباعة + PDF) =================  
  const buildAllMonthsHtml = () => {  
    const numCell = (v: number) => (v > 0 ? formatNumberEn(v) : "-");  
    let body = "";  
    MONTHS.forEach((m) => {  
      const rows = rowsOfMonth(m.id);  
      const t = monthTotals(m.id);  
      body += `<tr class="month"><td colspan="${TOTAL_COLS}">شهر ${m.name}</td></tr>`;  
      rows.forEach((row) => {  
        body += "<tr>";  
        mainHeaders.forEach((h) => (body += `<td>${row[h] ?? ""}</td>`));  
        dataColumnsOrder.forEach((c) => {  
          const cls = isFormulaCol(c) ? "formula" : "";  
          body += `<td class="${cls}">${row[c] === "" || row[c] === undefined ? "" : formatNumberEn(row[c])}</td>`;  
        });  
        body += `<td></td></tr>`;  
      });  
      const totalRow = (label: string, cls: string, getter: (c: string) => number) => {  
        let tr = `<tr class="${cls}"><td colspan="4">${label}</td>`;  
        dataColumnsOrder.forEach((c) => (tr += `<td>${numCell(getter(c))}</td>`));  
        tr += `<td></td></tr>`;  
        return tr;  
      };  
      body += totalRow(`إجمالي شهر ${m.name}`, "t-cur", t.current);  
      body += totalRow(`إجمالي الأشهر السابقة (قبل ${m.name})`, "t-prev", t.before);  
      body += totalRow(`الإجمالي العام (حتى ${m.name})`, "t-cum", t.cumulative);  
    });  
  
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">  
    <title>سجل مفردات الاستخدامات والنفقات العامة</title>  
    <link rel="preconnect" href="https://fonts.googleapis.com">  
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap">  
    <style>  
      @page { size: A4 landscape; margin: 6mm; }  
      body { font-family:'Cairo','Tajawal','Segoe UI',Tahoma,Arial,sans-serif; direction:rtl; color:#0f172a; margin:0; padding:6px; }  
      h2 { text-align:center; color:#0b3d6d; margin:4px 0 8px; }  
      table { width:100%; border-collapse:collapse; font-size:8px; }  
      th, td { border:1px solid #94a3b8; padding:2px 3px; text-align:center; white-space:nowrap; }  
      thead th { background:#fff; font-weight:700; }  
      thead .c-total { background:${COLORS.TOTAL_ALL}; }  
      thead .c-bab   { background:${COLORS.BAB_TOTAL}; }  
      thead .c-fasl  { background:${COLORS.FASL}; }  
      thead .c-band  { background:${COLORS.BAND}; }  
      td.formula { background:#f8fafc; font-weight:700; }  
      tr.month td { background:#0b3d6d; color:#ffd54a; font-weight:700; text-align:right; padding:4px 8px; }  
      tr.t-cur td  { background:#dbeafe; color:#0b3d6d; font-weight:700; }  
      tr.t-prev td { background:#e2e8f0; color:#334155; font-weight:700; }  
      tr.t-cum td  { background:#0b3d6d; color:#ffd54a; font-weight:700; }  
      tr.t-cur td:first-child, tr.t-prev td:first-child, tr.t-cum td:first-child { text-align:right; padding-right:8px; }  
    </style></head><body>  
    <h2>سجل مفردات الاستخدامات والنفقات العامة</h2>  
    <table><thead>${THEAD_HTML}</thead><tbody>${body}</tbody></table>  
    </body></html>`;  
  };  
  
  const handlePrint = () => {  
    const w = window.open("", "_blank", "width=1200,height=800");  
    if (!w) return;  
    w.document.write(buildAllMonthsHtml());  
    w.document.close();  
    w.onload = () => setTimeout(() => w.print(), 400);  
  };  
  
  const handlePdf = () => {  
    // نفس نافذة الطباعة؛ يختار المستخدم "حفظ كـ PDF" من وجهة الطباعة  
    handlePrint();  
  };  
  
  return (  
    <div className="space-y-4 font-tajawal text-slate-800 p-2" dir="rtl">  
      {/* الترويسة وأزرار الأدوات */}  
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">  
        <div className="flex flex-wrap items-center justify-between gap-3">  
          <div className="flex items-center gap-2">  
            <FileSpreadsheet className="w-5 h-5 text-blue-800" />  
            <h2 className="text-base font-bold text-blue-900">سجل مفردات الاستخدامات والنفقات العامة</h2>  
          </div>  
          <div className="flex flex-wrap items-center gap-2">  
            <select  
              value={importMonthId}  
              onChange={(e) => setImportMonthId(Number(e.target.value))}  
              className="text-xs border border-slate-300 rounded px-2 py-1.5"  
              title="الشهر الافتراضي للاستيراد (إن لم يحتوِ الملف عمود monthId)"  
            >  
              {MONTHS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}  
            </select>  
            <button onClick={handleImportClick} className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-2 rounded shadow-sm">  
              <Upload className="w-4 h-4" /> استيراد Excel  
            </button>  
            <button onClick={handleExportExcel} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 rounded shadow-sm">  
              <Download className="w-4 h-4" /> تصدير Excel  
            </button>  
            <button onClick={handlePdf} className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-2 rounded shadow-sm">  
              <FileText className="w-4 h-4" /> تحويل PDF  
            </button>  
            <button onClick={handlePrint} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-sm">  
              <Printer className="w-4 h-4" /> طباعة  
            </button>  
            <button onClick={handleClearAll} className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded shadow-sm">  
              <Eraser className="w-4 h-4" /> مسح الكل  
            </button>  
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />  
          </div>  
        </div>  
      </div>  
  
      {/* حاوية الجدول */}  
      <div className="w-full overflow-x-auto border border-slate-300 shadow-sm bg-white rounded-b-lg" style={{ maxHeight: "70vh" }}>  
        <table className="w-full text-center border-collapse text-[11px] whitespace-nowrap">  
          <thead className="sticky top-0 z-10 bg-white">  
            {/* الصف الأول */}  
            <tr className="border-b border-slate-300">  
              <th rowSpan={4} className="border border-slate-300 p-1 bg-white">رقم الاستمارة</th>  
              <th rowSpan={4} className="border border-slate-300 p-1 bg-white">كشف التسوية</th>  
              <th rowSpan={4} className="border border-slate-300 p-1 bg-white">التاريخ</th>  
              <th rowSpan={4} className="border border-slate-300 p-1 bg-white">البيان</th>  
              <th rowSpan={4} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.TOTAL_ALL }}>  
                <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-20">اجمالي عام الاستخدامات</div>  
              </th>  
              <th colSpan={13} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>اجمالي الباب الاول</th>  
              <th colSpan={21} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>اجمالي الباب الثاني</th>  
              <th colSpan={7} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>اجمالي الباب الرابع</th>  
              <th rowSpan={4} className="border border-slate-300 p-1 bg-white">إجراء</th>  
            </tr>  
            {/* الصف الثاني */}  
            <tr className="border-b border-slate-300">  
              <th rowSpan={3} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>  
                <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="mx-auto h-16">الإجمالي</div>  
              </th>  
              <th colSpan={10} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>  
              <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>  
              <th rowSpan={3} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>  
                <div style={{ writingMode: "vertical-rl", transform: "
