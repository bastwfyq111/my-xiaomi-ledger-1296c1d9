import React, { useEffect, useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";

/**
 * إعادة تصميم AppTabs لتكون صديقة للهواتف (بما في ذلك شاومي) وتتعامل مع جداول كبيرة:
 * - تفعيل "وضع الهاتف" الذي يعرض كل صف في كارت عمودي مع إمكانية فتح التفاصيل.
 * - تحميل متدرج للصفوف (pagination على شكل load more) لتقليل ضغط الرندرة.
 * - إبقاء جروبات الأعمدة مطوية افتراضياً (للديسكتوب).
 * - تحسينات عرض/تجاوب Tailwind CSS صغيرة.
 */

const SMALL_SCREEN_MAX_WIDTH = 640; // px
const ROW_LOAD_CHUNK = 100;

const AppTabs: React.FC = () => {
  // إدارة حالات البيانات
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isImported, setIsImported] = useState<boolean>(false);

  // إدارة حالة فتح وإغلاق المجموعات المنسدلة للأعمدة (مغلقة افتراضياً لتسريع الرندرة)
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    bab1: false,
    bab2: false,
    bab4: false,
  });

  // وضع الجوال
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth <= SMALL_SCREEN_MAX_WIDTH : false);

  // تحميل متدرج للصفوف لتقليل ضغط الرندرة عند وجود عدد كبير من الأسطر
  const [rowsToShow, setRowsToShow] = useState<number>(ROW_LOAD_CHUNK);

  // لكل صف على الهاتف: حالة توسيع التفاصيل
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

  // الأعمدة الرئيسية الدائمة الظهور
  const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان", "اجمالي عام الاستخدامات"];

  // بنود الباب الأول الفرعية
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

  // بنود الباب الثاني الفرعية
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

  const bab4Columns = [
    "مركز صحي قحزة",
    "وحدة الغسيل الكلوي",
    "مشروع دعم الكلى",
    "الصالة والمطبخ",
    "مركز صحي",
    "الامانات",
  ];

  // دالة الاستيراد (مثل الأصل)
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

            const hasData = (row[0] !== undefined && String(row[0]).trim() !== "") ||
                            (row[1] !== undefined && String(row[1]).trim() !== "") ||
                            (row[2] !== undefined && String(row[2]).trim() !== "") ||
                            (row[3] !== undefined && String(row[3]).trim() !== "") ||
                            (row[4] !== undefined && String(row[4]).trim() !== "");
            if (!hasData) continue;

            const rowObj: any = {};
            extractedHeaders.forEach((header: string, index: number) => {
              const cell = row[index];
              if (cell !== undefined && cell !== null && cell !== "") {
                const num = Number(cell);
                rowObj[header] = !isNaN(num) && String(cell).trim() !== "" ? num : String(cell);
              } else {
                rowObj[header] = "";
              }
            });
            temporaryRows.push(rowObj);
          }

          setColumnHeaders(extractedHeaders);
          setDataRows(temporaryRows);
          setIsImported(true);
          setTimeout(() => setIsImported(false), 2500);
          // إعادة تعيين تحميل متدرج عند استيراد جديد
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
  };

  const handleClearTable = () => {
    if (window.confirm("هل تود مسح السجلات الحالية؟")) {
      setDataRows([]);
      setColumnHeaders([]);
      setExpandedRows({});
      setRowsToShow(ROW_LOAD_CHUNK);
    }
  };

  // تصفية أسطر النفقات بناءً على مربع البحث
  const filteredRows = dataRows.filter((row) =>
    mainHeaders.concat(["البيان"]).some((key) =>
      String(row[key] || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const displayedRows = filteredRows.slice(0, rowsToShow);

  const handleLoadMore = () => setRowsToShow((prev) => Math.min(filteredRows.length, prev + ROW_LOAD_CHUNK));

  // تنسيق رقمي بالعربية إن أمكن
  const fmt = (val: any) => (typeof val === "number" ? val.toLocaleString("ar-YE") : val || "");

  return (
    <div className="space-y-4 font-tajawal text-slate-800" dir="rtl">
      {/* الترويسة */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileSpreadsheet className="w-5 h-5 text-[#10528e]" />
        <h2 className="text-sm sm:text-base font-bold text-[#0b3d6d] font-cairo">
          سجل مفردات الاستخدامات والنفقات العامة (نسخة الجوال المحسنة)
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
            onChange={(e) => { setSearchTerm(e.target.value); setRowsToShow(ROW_LOAD_CHUNK); }}
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

          <label className="flex items-center gap-2 bg-[#10528e] hover:bg-[#0b3d6d] text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-lg cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">استيراد السجل المالي</span>
            <span className="sm:hidden text-[11px]">رفع</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>

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
        // عرض على شكل بطاقات للهواتف (مناسب لشاشات صغيرة وعدد أعمدة كبير)
        <div className="space-y-3">
          {displayedRows.length > 0 ? (
            displayedRows.map((row, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">رقم الاستمارة</div>
                    <div className="font-medium text-slate-900">{fmt(row["رقم الاستمارة"])}</div>
                    <div className="text-xs text-slate-500 mt-2">التاريخ</div>
                    <div className="text-sm text-slate-700">{fmt(row["التاريخ"])}</div>
                    <div className="text-xs text-slate-500 mt-2">البيان</div>
                    <div className="text-sm text-slate-700 line-clamp-3">{fmt(row["البيان"])}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-[11px] text-slate-500">إجمالي عام</div>
                    <div className="font-bold text-emerald-800 bg-emerald-50/30 px-2 py-1 rounded text-sm whitespace-nowrap">{fmt(row["اجمالي عام الاستخدامات"])}</div>

                    <button
                      onClick={() => toggleRow(idx)}
                      className="mt-2 bg-[#0d477a] hover:bg-[#10528e] text-white text-[12px] px-2 py-1 rounded flex items-center gap-1"
                    >
                      {expandedRows[idx] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span>{expandedRows[idx] ? "إخفاء التفاصيل" : "تفاصيل"}</span>
                    </button>
                  </div>
                </div>

                {expandedRows[idx] && (
                  <div className="mt-3 grid grid-cols-1 gap-2 text-[13px]">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-500">اجمالي الباب الاول</div>
                      <div className="font-bold text-emerald-800">{fmt(row["اجمالي الباب الاول"])}</div>
                    </div>

                    {/* عرض جروبات الباب 1 و 2 و 4 (مخفية افتراضياً في الواجهة الكلية) */}
                    <div>
                      <div className="text-slate-500 text-sm mb-1 font-semibold">تفاصيل الباب الأول</div>
                      <div className="grid grid-cols-2 gap-2">
                        {bab1Columns.map((col) => (
                          <div key={col} className="flex justify-between text-[13px] bg-slate-50 p-2 rounded">
                            <div className="text-slate-600">{col}</div>
                            <div className="font-medium">{fmt(row[col])}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-slate-500 text-sm mb-1 font-semibold">تفاصيل الباب الثاني</div>
                      <div className="grid grid-cols-2 gap-2">
                        {bab2Columns.map((col) => (
                          <div key={col} className="flex justify-between text-[13px] bg-slate-50 p-2 rounded">
                            <div className="text-slate-600">{col.replace("_باب2", "")}</div>
                            <div className="font-medium">{fmt(row[col])}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-slate-500 text-sm mb-1 font-semibold">تفاصيل الباب الرابع</div>
                      <div className="grid grid-cols-2 gap-2">
                        {bab4Columns.map((col) => (
                          <div key={col} className="flex justify-between text-[13px] bg-slate-50 p-2 rounded">
                            <div className="text-slate-600">{col}</div>
                            <div className="font-medium">{fmt(row[col])}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-400">لا توجد سجلات مالية لعرضها. يرجى رفع ملف النفقات.</div>
          )}

          {displayedRows.length < filteredRows.length && (
            <div className="flex justify-center">
              <button onClick={handleLoadMore} className="px-4 py-2 bg-[#10528e] text-white rounded-md text-sm">
                تحميل المزيد ({Math.min(ROW_LOAD_CHUNK, filteredRows.length - displayedRows.length)})
              </button>
            </div>
          )}
        </div>
      ) : (
        // تصميم الجدول للديسكتوب (مع جروبات مطوية)
        <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl shadow-sm bg-white max-h-[560px] overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-[#0b3d6d] text-white font-cairo">
              <tr className="border-b border-white/10 text-center">
                <th colSpan={5} className="p-2 bg-[#082f55] text-slate-300 font-normal text-xs">الأعمدة التعريفية</th>

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
              </tr>

              <tr className="bg-[#0b3d6d] border-b border-slate-200">
                {mainHeaders.map((header, idx) => (
                  <th key={idx} className="p-2.5 font-semibold border-x border-white/5 whitespace-nowrap">{header}</th>
                ))}

                <th className="p-2.5 font-bold bg-[#0d477a] border-x border-white/5 whitespace-nowrap">اجمالي الباب الاول</th>
                {expandedGroups.bab1 && bab1Columns.map((col, idx) => (
                  <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">{col}</th>
                ))}

                <th className="p-2.5 font-bold bg-[#12538c] border-x border-white/5 whitespace-nowrap">اجمالي الباب الثاني</th>
                {expandedGroups.bab2 && bab2Columns.map((col, idx) => (
                  <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">{col.replace("_باب2", "")}</th>
                ))}

                <th className="p-2.5 font-bold bg-[#175f9d] border-x border-white/5 whitespace-nowrap">اجمالي الباب الرابع</th>
                {expandedGroups.bab4 && bab4Columns.map((col, idx) => (
                  <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-center text-xs">
              {displayedRows.length > 0 ? (
                displayedRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/40">
                    {mainHeaders.map((header, idx) => (
                      <td key={idx} className="p-2 border-x border-slate-100 font-medium text-slate-900 text-right whitespace-nowrap">
                        {fmt(row[header])}
                      </td>
                    ))}

                    <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">{fmt(row["اجمالي الباب الاول"])}</td>
                    {expandedGroups.bab1 && bab1Columns.map((col, idx) => (
                      <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/10 whitespace-nowrap">{fmt(row[col])}</td>
                    ))}

                    <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">{fmt(row["اجمالي الباب الثاني"])}</td>
                    {expandedGroups.bab2 && bab2Columns.map((col, idx) => (
                      <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/10 whitespace-nowrap">{fmt(row[col])}</td>
                    ))}

                    <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">{fmt(row["اجمالي الباب الرابع"])}</td>
                    {expandedGroups.bab4 && bab4Columns.map((col, idx) => (
                      <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/10 whitespace-nowrap">{fmt(row[col])}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-12 text-slate-400 font-medium text-center">لا توجد سجلات مالية لعرضها. يرجى رفع ملف النفقات الفعلي.</td>
                </tr>
              )}
            </tbody>
          </table>

          {displayedRows.length < filteredRows.length && (
            <div className="p-3 flex justify-center">
              <button onClick={handleLoadMore} className="px-4 py-2 bg-[#10528e] text-white rounded-md text-sm">تحميل المزيد ({Math.min(ROW_LOAD_CHUNK, filteredRows.length - displayedRows.length)})</button>
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between px-1">
        <div>الأسطر المحملة حالياً: {displayedRows.length} / {filteredRows.length} — يتم تحميل الباقي تدريجياً لتجنب تعليق المتصفح.</div>
        <div>وضع العرض: {isMobile ? "هاتف (كروت)" : "سطح مكتب (جدول)"}.</div>
      </div>
    </div>
  );
};

export default AppTabs;
