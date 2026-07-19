import React, { useEffect, useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Plus, Download } from "lucide-react";
import * as XLSX from "xlsx";

/**
 * نسخة "شبيهة بالإكسل" من AppTabs:
 * - كل خلية بيانات (غير المحسوبة) قابلة للتعديل مباشرة مثل خلية إكسل (input داخل الخلية).
 * - إمكانية إضافة سطر جديد فارغ وحذف أي سطر (مثل إدراج/حذف صف في إكسل).
 * - أعمدة "اجمالي الباب الاول/الثاني/الرابع" و"اجمالي عام الاستخدامات" أصبحت دوال (formulas)
 *   تُحسب تلقائياً من مجموع البنود التابعة لها، ولا يمكن كتابتها يدوياً (تماماً كخلية بها معادلة SUM في إكسل).
 * - زر تصدير إلى إكسل (XLSX) بنفس البنية.
 * - وضع الهاتف + تحميل متدرج للصفوف كما في الأصل.
 *
 * ملاحظة على الافتراض المتبع: تم اعتبار "اجمالي الباب الاول" = مجموع كل بنود bab1Columns
 * (بما فيها حقول "الفصل الاول"/"الفصل الثاني")، وكذلك الباب الثاني والرابع. إن كانت حقول
 * "الفصل" يُفترض أن تبقى عناوين فرعية غير مجمّعة ضمن الإجمالي، أخبرني لتعديل المعادلة.
 */

const SMALL_SCREEN_MAX_WIDTH = 640; // px
const ROW_LOAD_CHUNK = 100;

const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان", "اجمالي عام الاستخدامات"];

const bab1Columns = [
  "الفصل الاول",
  "البند الاول",
  "المرتبات الاساسية",
  "اجور تعاقدية",
  "البند الثالث",
  "اجور عمل اضافي",
  "مكافات",
  "البند الرابع",
  "طبيعة عمل",
  "بدل ريف",
  "بدل سكن",
  "بدل تحديث",
  "الفصل الثاني",
  "ح/حكومة",
  "اصابة عمل",
];

const bab2Columns = [
  "الفصل الاول_باب2",
  "مياه",
  "انارة",
  "ادوات كتابية",
  "نشر واعلان",
  "اتصالات",
  "مؤتمرات واحتفالات",
  "نفقات النظافة",
  "اخرى",
  "نقل مهام",
  "انتقالات داخلية",
  "ايجار مباني",
  "ادوية ومستلزمات طبية",
  "اغذية وملبوسات",
  "الفصل الثاني_باب2",
  "صيانة مباني",
  "وقود وزيوت",
  "قطع غيار وصيانة وسائل النقل",
  "قطع غيار وصيانة الالات والمعدات",
];

const bab4Columns = ["مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"];

const FORMULA_FIELDS = ["اجمالي الباب الاول", "اجمالي الباب الثاني", "اجمالي الباب الرابع", "اجمالي عام الاستخدامات"];

// جميع الحقول القابلة للإدخال اليدوي (غير المحسوبة)
const EDITABLE_MAIN_HEADERS = mainHeaders.filter((h) => h !== "اجمالي عام الاستخدامات");
const ALL_EXPORT_HEADERS = [
  ...EDITABLE_MAIN_HEADERS,
  "اجمالي الباب الاول",
  ...bab1Columns,
  "اجمالي الباب الثاني",
  ...bab2Columns,
  "اجمالي الباب الرابع",
  ...bab4Columns,
  "اجمالي عام الاستخدامات",
];

const toNumberOrRaw = (val: any): number | string => {
  if (val === undefined || val === null || String(val).trim() === "") return "";
  const num = Number(val);
  return !isNaN(num) ? num : String(val);
};

const sumColumns = (row: any, cols: string[]): number =>
  cols.reduce((acc, col) => {
    const v = row[col];
    const num = typeof v === "number" ? v : Number(v);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

// يعيد حساب كل حقول المعادلات (formulas) لسطر معين، تماماً كإعادة حساب صيغ إكسل
const recomputeRow = (row: any) => {
  const newRow = { ...row };
  newRow["اجمالي الباب الاول"] = sumColumns(newRow, bab1Columns);
  newRow["اجمالي الباب الثاني"] = sumColumns(newRow, bab2Columns);
  newRow["اجمالي الباب الرابع"] = sumColumns(newRow, bab4Columns);
  newRow["اجمالي عام الاستخدامات"] =
    (Number(newRow["اجمالي الباب الاول"]) || 0) +
    (Number(newRow["اجمالي الباب الثاني"]) || 0) +
    (Number(newRow["اجمالي الباب الرابع"]) || 0);
  return newRow;
};

const emptyRow = () => {
  const row: any = {};
  [...EDITABLE_MAIN_HEADERS, ...bab1Columns, ...bab2Columns, ...bab4Columns].forEach((h) => (row[h] = ""));
  return recomputeRow(row);
};

const AppTabs: React.FC = () => {
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isImported, setIsImported] = useState<boolean>(false);

  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    bab1: false,
    bab2: false,
    bab4: false,
  });

  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth <= SMALL_SCREEN_MAX_WIDTH : false);
  const [rowsToShow, setRowsToShow] = useState<number>(ROW_LOAD_CHUNK);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= SMALL_SCREEN_MAX_WIDTH);
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // تحديث خلية واحدة (مثل الكتابة داخل خلية إكسل) وإعادة حساب المعادلات لنفس السطر فوراً
  const updateCell = (originalIndex: number, key: string, rawValue: string) => {
    setDataRows((prev) => {
      const newRows = [...prev];
      const row = { ...newRows[originalIndex] };
      row[key] = toNumberOrRaw(rawValue);
      newRows[originalIndex] = recomputeRow(row);
      return newRows;
    });
  };

  const handleAddRow = () => {
    setDataRows((prev) => [...prev, emptyRow()]);
    if (columnHeaders.length === 0) setColumnHeaders(ALL_EXPORT_HEADERS);
    setRowsToShow((prev) => Math.max(prev, ROW_LOAD_CHUNK));
  };

  const handleDeleteRow = (originalIndex: number) => {
    if (!window.confirm("هل تريد حذف هذا السطر؟")) return;
    setDataRows((prev) => prev.filter((_, i) => i !== originalIndex));
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (!result) return;

        const data = new Uint8Array(result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawJsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });

        if (rawJsonData && rawJsonData.length > 0) {
          let headerRowIndex = rawJsonData.findIndex((r) => Array.isArray(r) && r.some((c) => c !== undefined && String(c).trim() !== ""));
          if (headerRowIndex === -1) headerRowIndex = 0;

          const rawHeaders = rawJsonData[headerRowIndex] as any[];

          const seen: Record<string, number> = {};
          const extractedHeaders = rawHeaders.map((header: any, idx: number) => {
            let name = header !== undefined && header !== null ? String(header).trim() : `عمود_${idx}`;
            if (seen[name] === undefined) seen[name] = 1;
            else {
              seen[name] = seen[name] + 1;
              name = `${name}_نسخة${seen[name]}`;
            }
            if (name === "الفصل الاول" && idx > 15) name = "الفصل الاول_باب2";
            if (name === "الفصل الثاني" && idx > 15) name = "الفصل الثاني_باب2";
            return name;
          });

          const temporaryRows: any[] = [];
          for (let i = headerRowIndex + 1; i < rawJsonData.length; i++) {
            const row = rawJsonData[i];
            if (!row || row.length === 0) continue;

            const hasData =
              (row[0] !== undefined && String(row[0]).trim() !== "") ||
              (row[1] !== undefined && String(row[1]).trim() !== "") ||
              (row[2] !== undefined && String(row[2]).trim() !== "") ||
              (row[3] !== undefined && String(row[3]).trim() !== "") ||
              (row[4] !== undefined && String(row[4]).trim() !== "");
            if (!hasData) continue;

            const rowObj: any = {};
            extractedHeaders.forEach((header: string, index: number) => {
              const cell = row[index];
              rowObj[header] = toNumberOrRaw(cell);
            });
            temporaryRows.push(recomputeRow(rowObj));
          }

          setColumnHeaders(extractedHeaders);
          setDataRows(temporaryRows);
          setIsImported(true);
          setTimeout(() => setIsImported(false), 2500);
          setRowsToShow(ROW_LOAD_CHUNK);
        } else {
          alert("الملف لا يحتوي على بيانات صالحة.");
        }
      } catch (error) {
        console.error("خطأ في معالجة الملف المحاسبي:", error);
        alert("حدث خطأ أثناء قراءة البيانات، يرجى التأكد من سلامة ملف الإكسل.");
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleExportExcel = () => {
    if (dataRows.length === 0) {
      alert("لا توجد بيانات لتصديرها.");
      return;
    }
    const wsData = [ALL_EXPORT_HEADERS, ...dataRows.map((row) => ALL_EXPORT_HEADERS.map((h) => (row[h] === undefined ? "" : row[h])))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "السجل المالي");
    XLSX.writeFile(wb, "السجل_المالي.xlsx");
  };

  const handleClearTable = () => {
    if (window.confirm("هل تود مسح السجلات الحالية؟")) {
      setDataRows([]);
      setColumnHeaders([]);
      setExpandedRows({});
      setRowsToShow(ROW_LOAD_CHUNK);
    }
  };

  // نحتفظ بالفهرس الأصلي لكل سطر (index في dataRows) حتى بعد الفلترة، لأن التعديل/الحذف يعتمد عليه
  const indexedRows = dataRows.map((row, i) => ({ row, i }));
  const filteredIndexedRows = indexedRows.filter(({ row }) =>
    mainHeaders.concat(["البيان"]).some((key) => String(row[key] || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const displayedIndexedRows = filteredIndexedRows.slice(0, rowsToShow);

  const handleLoadMore = () => setRowsToShow((prev) => Math.min(filteredIndexedRows.length, prev + ROW_LOAD_CHUNK));

  const fmt = (val: any) => (typeof val === "number" ? val.toLocaleString("ar-YE") : val || "");

  // خلية إدخال شبيهة بخلية إكسل: تعرض input مباشرة (مثل شبكة إكسل)، وتُحدّث السطر بفهرسه الأصلي
  const EditableCell: React.FC<{ originalIndex: number; field: string; value: any; align?: "right" | "center" }> = ({
    originalIndex,
    field,
    value,
    align = "center",
  }) => (
    <input
      type="text"
      defaultValue={value === "" || value === undefined ? "" : String(value)}
      key={`${originalIndex}-${field}-${value}`}
      onBlur={(e) => updateCell(originalIndex, field, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`w-full bg-transparent focus:bg-amber-50 focus:outline-none focus:ring-1 focus:ring-[#10528e] rounded px-1 py-0.5 text-${align}`}
    />
  );

  // خلية معادلة (formula) للقراءة فقط، بمظهر مميز مثل خلايا SUM في إكسل
  const FormulaCell: React.FC<{ value: any }> = ({ value }) => (
    <div className="italic text-emerald-800 font-bold flex items-center justify-center gap-1" title="حقل محسوب تلقائياً (مجموع)">
      <span className="text-[9px] text-emerald-500 font-normal">ƒ</span>
      <span>{fmt(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800" dir="rtl">
      {/* الترويسة */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileSpreadsheet className="w-5 h-5 text-[#10528e]" />
        <h2 className="text-sm sm:text-base font-bold text-[#0b3d6d] font-cairo">
          سجل مفردات الاستخدامات والنفقات العامة (وضع تحرير شبيه بالإكسل)
        </h2>
      </div>

      {/* شريط التحكم والرفع */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث سريع في السجل المالي المستورد..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setRowsToShow(ROW_LOAD_CHUNK);
            }}
            className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-[#10528e] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isImported && (
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم الاستيراد</span>
            </div>
          )}

          <button
            onClick={handleAddRow}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">إضافة سطر جديد</span>
            <span className="sm:hidden text-[11px]">إضافة</span>
          </button>

          <label className="flex items-center gap-2 bg-[#10528e] hover:bg-[#0b3d6d] text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-lg cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">استيراد ملف إكسل</span>
            <span className="sm:hidden text-[11px]">رفع</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">تصدير إلى إكسل</span>
            <span className="sm:hidden text-[11px]">تصدير</span>
          </button>

          {dataRows.length > 0 && (
            <button
              onClick={handleClearTable}
              className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs sm:text-sm font-bold px-3 py-2 rounded-lg transition-all border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>تفريغ</span>
            </button>
          )}
        </div>
      </div>

      {/* المحتوى: جدول كبير على الديسكتوب، بطاقات على الموبايل */}
      {isMobile ? (
        <div className="space-y-3">
          {displayedIndexedRows.length > 0 ? (
            displayedIndexedRows.map(({ row, i: originalIndex }) => (
              <div key={originalIndex} className="border border-slate-200 rounded-lg bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">رقم الاستمارة</div>
                      <EditableCell originalIndex={originalIndex} field="رقم الاستمارة" value={row["رقم الاستمارة"]} align="right" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">كشف التسوية</div>
                      <EditableCell originalIndex={originalIndex} field="كشف التسوية" value={row["كشف التسوية"]} align="right" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">التاريخ</div>
                      <EditableCell originalIndex={originalIndex} field="التاريخ" value={row["التاريخ"]} align="right" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">البيان</div>
                      <EditableCell originalIndex={originalIndex} field="البيان" value={row["البيان"]} align="right" />
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-[11px] text-slate-500">إجمالي عام</div>
                    <div className="bg-emerald-50/30 px-2 py-1 rounded text-sm whitespace-nowrap">
                      <FormulaCell value={row["اجمالي عام الاستخدامات"]} />
                    </div>

                    <button
                      onClick={() => toggleRow(originalIndex)}
                      className="mt-2 bg-[#0d477a] hover:bg-[#10528e] text-white text-[12px] px-2 py-1 rounded flex items-center gap-1"
                    >
                      {expandedRows[originalIndex] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span>{expandedRows[originalIndex] ? "إخفاء التفاصيل" : "تفاصيل"}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteRow(originalIndex)}
                      className="text-rose-500 hover:text-rose-700 text-[11px] flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف السطر</span>
                    </button>
                  </div>
                </div>

                {expandedRows[originalIndex] && (
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[13px]">
                    <div className="flex items-center justify-between bg-emerald-50/40 p-2 rounded">
                      <div className="text-slate-500">اجمالي الباب الاول</div>
                      <FormulaCell value={row["اجمالي الباب الاول"]} />
                    </div>
                    <div>
                      <div className="text-slate-500 text-sm mb-1 font-semibold">تفاصيل الباب الأول</div>
                      <div className="grid grid-cols-2 gap-2">
                        {bab1Columns.map((col) => (
                          <div key={col} className="flex justify-between items-center text-[13px] bg-slate-50 p-2 rounded">
                            <div className="text-slate-600 ml-1 shrink-0">{col}</div>
                            <EditableCell originalIndex={originalIndex} field={col} value={row[col]} align="right" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-emerald-50/40 p-2 rounded mt-2">
                      <div className="text-slate-500">اجمالي الباب الثاني</div>
                      <FormulaCell value={row["اجمالي الباب الثاني"]} />
                    </div>
                    <div>
                      <div className="text-slate-500 text-sm mb-1 font-semibold">تفاصيل الباب الثاني</div>
                      <div className="grid grid-cols-2 gap-2">
                        {bab2Columns.map((col) => (
                          <div key={col} className="flex justify-between items-center text-[13px] bg-slate-50 p-2 rounded">
                            <div className="text-slate-600 ml-1 shrink-0">{col.replace("_باب2", "")}</div>
                            <EditableCell originalIndex={originalIndex} field={col} value={row[col]} align="right" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-emerald-50/40 p-2 rounded mt-2">
                      <div className="text-slate-500">اجمالي الباب الرابع</div>
                      <FormulaCell value={row["اجمالي الباب الرابع"]} />
                    </div>
                    <div>
                      <div className="text-slate-500 text-sm mb-1 font-semibold">تفاصيل الباب الرابع</div>
                      <div className="grid grid-cols-2 gap-2">
                        {bab4Columns.map((col) => (
                          <div key={col} className="flex justify-between items-center text-[13px] bg-slate-50 p-2 rounded">
                            <div className="text-slate-600 ml-1 shrink-0">{col}</div>
                            <EditableCell originalIndex={originalIndex} field={col} value={row[col]} align="right" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-400">لا توجد سجلات مالية لعرضها. أضف سطراً جديداً أو ارفع ملف النفقات.</div>
          )}

          {displayedIndexedRows.length < filteredIndexedRows.length && (
            <div className="flex justify-center">
              <button onClick={handleLoadMore} className="px-4 py-2 bg-[#10528e] text-white rounded-md text-sm">
                تحميل المزيد ({Math.min(ROW_LOAD_CHUNK, filteredIndexedRows.length - displayedIndexedRows.length)})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl shadow-sm bg-white max-h-[560px] overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-[#0b3d6d] text-white font-cairo">
              <tr className="border-b border-white/10 text-center">
                <th colSpan={5} className="p-2 bg-[#082f55] text-slate-300 font-normal text-xs">
                  الأعمدة التعريفية
                </th>

                <th
                  className="p-2 bg-[#0d477a] hover:bg-[#10528e] cursor-pointer border-x border-white/10 transition-colors"
                  onClick={() => toggleGroup("bab1")}
                  colSpan={expandedGroups.bab1 ? bab1Columns.length + 1 : 1}
                >
                  <div className="flex items-center justify-center gap-1 font-bold">
                    <span>إجمالي الباب الأول</span>
                    {expandedGroups.bab1 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                  </div>
                </th>

                <th
                  className="p-2 bg-[#12538c] hover:bg-[#165f9e] cursor-pointer border-x border-white/10 transition-colors"
                  onClick={() => toggleGroup("bab2")}
                  colSpan={expandedGroups.bab2 ? bab2Columns.length + 1 : 1}
                >
                  <div className="flex items-center justify-center gap-1 font-bold">
                    <span>إجمالي الباب الثاني</span>
                    {expandedGroups.bab2 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                  </div>
                </th>

                <th
                  className="p-2 bg-[#175f9d] hover:bg-[#1c6fae] cursor-pointer border-x border-white/10 transition-colors"
                  onClick={() => toggleGroup("bab4")}
                  colSpan={expandedGroups.bab4 ? bab4Columns.length + 1 : 1}
                >
                  <div className="flex items-center justify-center gap-1 font-bold">
                    <span>إجمالي الباب الرابع</span>
                    {expandedGroups.bab4 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                  </div>
                </th>

                <th className="p-2 bg-[#082f55] text-slate-300 font-normal text-xs">إجراءات</th>
              </tr>

              <tr className="bg-[#0b3d6d] border-b border-slate-200">
                {mainHeaders.map((header, idx) => (
                  <th key={idx} className="p-2.5 font-semibold border-x border-white/5 whitespace-nowrap">
                    {header}
                  </th>
                ))}

                <th className="p-2.5 font-bold bg-[#0d477a] border-x border-white/5 whitespace-nowrap">اجمالي الباب الاول</th>
                {expandedGroups.bab1 &&
                  bab1Columns.map((col, idx) => (
                    <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">
                      {col}
                    </th>
                  ))}

                <th className="p-2.5 font-bold bg-[#12538c] border-x border-white/5 whitespace-nowrap">اجمالي الباب الثاني</th>
                {expandedGroups.bab2 &&
                  bab2Columns.map((col, idx) => (
                    <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">
                      {col.replace("_باب2", "")}
                    </th>
                  ))}

                <th className="p-2.5 font-bold bg-[#175f9d] border-x border-white/5 whitespace-nowrap">اجمالي الباب الرابع</th>
                {expandedGroups.bab4 &&
                  bab4Columns.map((col, idx) => (
                    <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">
                      {col}
                    </th>
                  ))}

                <th className="p-2.5 font-bold bg-[#082f55] border-x border-white/5 whitespace-nowrap">حذف</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-center text-xs">
              {displayedIndexedRows.length > 0 ? (
                displayedIndexedRows.map(({ row, i: originalIndex }) => (
                  <tr key={originalIndex} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/40">
                    {mainHeaders.map((header, idx) => (
                      <td key={idx} className="p-1 border-x border-slate-100 font-medium text-slate-900 text-right whitespace-nowrap">
                        {header === "اجمالي عام الاستخدامات" ? (
                          <FormulaCell value={row[header]} />
                        ) : (
                          <EditableCell originalIndex={originalIndex} field={header} value={row[header]} align="right" />
                        )}
                      </td>
                    ))}

                    <td className="p-1 border-x border-slate-100 bg-emerald-50/30 whitespace-nowrap">
                      <FormulaCell value={row["اجمالي الباب الاول"]} />
                    </td>
                    {expandedGroups.bab1 &&
                      bab1Columns.map((col, idx) => (
                        <td key={idx} className="p-1 border-x border-slate-100 text-slate-600 bg-slate-50/10 whitespace-nowrap">
                          <EditableCell originalIndex={originalIndex} field={col} value={row[col]} />
                        </td>
                      ))}

                    <td className="p-1 border-x border-slate-100 bg-emerald-50/30 whitespace-nowrap">
                      <FormulaCell value={row["اجمالي الباب الثاني"]} />
                    </td>
                    {expandedGroups.bab2 &&
                      bab2Columns.map((col, idx) => (
                        <td key={idx} className="p-1 border-x border-slate-100 text-slate-600 bg-slate-50/10 whitespace-nowrap">
                          <EditableCell originalIndex={originalIndex} field={col} value={row[col]} />
                        </td>
                      ))}

                    <td className="p-1 border-x border-slate-100 bg-emerald-50/30 whitespace-nowrap">
                      <FormulaCell value={row["اجمالي الباب الرابع"]} />
                    </td>
                    {expandedGroups.bab4 &&
                      bab4Columns.map((col, idx) => (
                        <td key={idx} className="p-1 border-x border-slate-100 text-slate-600 bg-slate-50/10 whitespace-nowrap">
                          <EditableCell originalIndex={originalIndex} field={col} value={row[col]} />
                        </td>
                      ))}

                    <td className="p-1 border-x border-slate-100 whitespace-nowrap">
                      <button onClick={() => handleDeleteRow(originalIndex)} className="text-rose-500 hover:text-rose-700 p-1">
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="p-12 text-slate-400 font-medium text-center">
                    لا توجد سجلات مالية لعرضها. أضف سطراً جديداً أو ارفع ملف النفقات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {displayedIndexedRows.length < filteredIndexedRows.length && (
            <div className="p-3 flex justify-center">
              <button onClick={handleLoadMore} className="px-4 py-2 bg-[#10528e] text-white rounded-md text-sm">
                تحميل المزيد ({Math.min(ROW_LOAD_CHUNK, filteredIndexedRows.length - displayedIndexedRows.length)})
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between px-1">
        <div>
          الأسطر المحملة حالياً: {displayedIndexedRows.length} / {filteredIndexedRows.length} — الحقول ذات علامة ƒ محسوبة تلقائياً.
        </div>
        <div>وضع العرض: {isMobile ? "هاتف (كروت)" : "سطح مكتب (جدول)"}.</div>
      </div>
    </div>
  );
};

export default AppTabs;
