import React, { useEffect, useState, useMemo } from "react";
import { FileSpreadsheet, Plus, Trash2, CalendarDays } from "lucide-react";

// --- الهيكلة والألوان الأساسية ---
const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان"];

const COLORS = {
  TOTAL_ALL: "#E5DFEC",   // اجمالي عام
  BAB_TOTAL: "#DBEEF3",   // اجمالي باب
  FASL: "#FDE9D9",        // فصل
  BAND: "#C6D9F0",        // بند
};

// قائمة مصفوفة بأسماء جميع الأعمدة المالية بالترتيب (لتسهيل رسم الجدول وحساب المجاميع)
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
  "مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"
];

// أسماء الأشهر للتبويبات
const MONTHS = [
  { id: 1, name: "يناير" }, { id: 2, name: "فبراير" }, { id: 3, name: "مارس" }, { id: 4, name: "أبريل" },
  { id: 5, name: "مايو" }, { id: 6, name: "يونيو" }, { id: 7, name: "يوليو" }, { id: 8, name: "أغسطس" },
  { id: 9, name: "سبتمبر" }, { id: 10, name: "أكتوبر" }, { id: 11, name: "نوفمبر" }, { id: 12, name: "ديسمبر" }
];

// أداة تنسيق الأرقام باللغة الإنجليزية مع الفواصل
const formatNumberEn = (val: any) => {
  if (val === "" || val === null || val === undefined) return "";
  const num = Number(val);
  // إذا كان النص ليس رقماً (مثل البيان أو رقم الاستمارة)، نعيده كما هو
  if (isNaN(num)) return val; 
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
};

// دالة الجمع الرياضي
const sumColumns = (row: any, cols: string[]): number =>
  cols.reduce((acc, col) => {
    const num = Number(row[col]);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

// دالة إعادة الحساب للسطر الواحد
const recomputeRow = (row: any) => {
  const newRow = { ...row };

  // حساب الباب الأول
  const fasl1Bab1 = sumColumns(newRow, ["المرتبات الاساسية", "اجور تعاقدية", "اجور عمل اضافي", "مكافات", "طبيعة عمل", "بدل ريف", "بدل سكن", "بدل تحديث"]);
  const fasl2Bab1 = sumColumns(newRow, ["ح/حكومة", "اصابة عمل"]);
  newRow["الفصل الاول_باب1"] = fasl1Bab1;
  newRow["الفصل الثاني_باب1"] = fasl2Bab1;
  newRow["اجمالي الباب الاول"] = fasl1Bab1 + fasl2Bab1;

  // حساب الباب الثاني
  const fasl1Bab2 = sumColumns(newRow, ["مياه", "انارة", "ادوات كتابية", "نشر واعلان", "اتصالات", "مؤتمرات واحتفالات", "نفقات النظافة", "اخرى", "نقل مهام", "انتقالات داخلية", "ايجار مباني", "ادوية ومستلزمات طبية", "اغذية وملبوسات", "اخرى_2"]);
  const fasl2Bab2 = sumColumns(newRow, ["صيانة مباني", "وقود وزيوت", "قطع غيار وصيانة وسائل النقل", "قطع غيار وصيانة الالات والمعدات والاثاث"]);
  newRow["الفصل الاول_باب2"] = fasl1Bab2;
  newRow["الفصل الثاني_باب2"] = fasl2Bab2;
  newRow["اجمالي الباب الثاني"] = fasl1Bab2 + fasl2Bab2;

  // حساب الباب الرابع
  newRow["اجمالي الباب الرابع"] = sumColumns(newRow, ["مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"]);

  // الإجمالي العام
  newRow["اجمالي عام الاستخدامات"] = newRow["اجمالي الباب الاول"] + newRow["اجمالي الباب الثاني"] + newRow["اجمالي الباب الرابع"];

  return newRow;
};

// --- المكون الرئيسي ---
const AppTabs: React.FC = () => {
  // جميع البيانات لكل الأشهر محفوظة هنا
  const [dataRows, setDataRows] = useState<any[]>([]);
  // حالة التبويب النشط (الشهر الحالي)
  const [activeMonthId, setActiveMonthId] = useState<number>(1);

  // تصفية البيانات لعرض بيانات الشهر النشط فقط
  const currentMonthRows = dataRows.filter(row => row.monthId === activeMonthId);

  // تحديث خلية
  const updateCell = (rowId: string, key: string, rawValue: string) => {
    setDataRows((prev) => {
      return prev.map(row => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [key]: rawValue };
          return recomputeRow(updatedRow);
        }
        return row;
      });
    });
  };

  // إضافة سطر جديد يتبع للشهر النشط
  const handleAddRow = () => {
    const newEmptyRow: any = { id: Date.now().toString(), monthId: activeMonthId };
    mainHeaders.forEach(h => newEmptyRow[h] = "");
    dataColumnsOrder.forEach(h => newEmptyRow[h] = "");
    setDataRows((prev) => [...prev, recomputeRow(newEmptyRow)]);
  };

  // حذف سطر
  const handleDeleteRow = (rowId: string) => {
    if (!window.confirm("هل تريد حذف هذا السطر؟")) return;
    setDataRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  // --- حساب إجماليات الأشهر ---
  const totals = useMemo(() => {
    const previousMonthData = dataRows.filter(r => r.monthId === activeMonthId - 1);
    const cumulativeData = dataRows.filter(r => r.monthId <= activeMonthId);

    // دالة مساعدة لجمع عمود محدد من مجموعة بيانات
    const getSum = (data: any[], col: string) => data.reduce((acc, row) => acc + (Number(row[col]) || 0), 0);

    return {
      current: (col: string) => getSum(currentMonthRows, col),
      previous: (col: string) => getSum(previousMonthData, col),
      cumulative: (col: string) => getSum(cumulativeData, col)
    };
  }, [dataRows, activeMonthId, currentMonthRows]);


  // --- مكون الخلية القابلة للتحرير المخصص ---
  const EditableCell: React.FC<{ rowId: string; field: string; value: any }> = ({ rowId, field, value }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localVal, setLocalVal] = useState(value);

    // تحديث القيمة المحلية عند تغير الخصائص الخارجية
    useEffect(() => setLocalVal(value), [value]);

    const isDate = field === "التاريخ";

    // إذا كان المستخدم يحرر، نظهر القيمة الأصلية. وإلا ننسقها.
    const displayValue = isEditing 
        ? localVal 
        : isDate 
            ? localVal 
            : formatNumberEn(localVal);

    return (
      <input
        type={isDate ? "date" : "text"}
        value={displayValue || ""}
        onFocus={() => setIsEditing(true)}
        onBlur={() => {
          setIsEditing(false);
          updateCell(rowId, field, localVal);
        }}
        onChange={(e) => setLocalVal(e.target.value)}
        // نستخدم ltr للأرقام لتظهر بالإنجليزية بشكل صحيح
        dir={isDate || !isNaN(Number(localVal)) ? "ltr" : "rtl"}
        className="w-full h-full min-w-[70px] bg-transparent focus:bg-amber-50 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center text-[12px] text-slate-800"
      />
    );
  };

  // مكون لعرض المعادلات بشكل جميل (فقط للقراءة)
  const FormulaCell: React.FC<{ value: any }> = ({ value }) => (
    <div className="font-bold text-center text-[12px] text-slate-800" dir="ltr">
      {formatNumberEn(value)}
    </div>
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800 p-2" dir="rtl">
      
      {/* الترويسة وشريط التبويبات */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-800" />
              <h2 className="text-base font-bold text-blue-900">سجل مفردات الاستخدامات والنفقات العامة</h2>
          </div>
          <button onClick={handleAddRow} className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white text-xs px-4 py-2 rounded shadow-sm">
            <Plus className="w-4 h-4" /> إضافة سطر
          </button>
        </div>

        {/* أزرار الأشهر (Tabs) */}
        <div className="flex flex-wrap gap-1 border-t border-slate-200 pt-3">
            {MONTHS.map(month => (
                <button
                    key={month.id}
                    onClick={() => setActiveMonthId(month.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors border-b-2 ${
                        activeMonthId === month.id 
                            ? "bg-blue-100 text-blue-800 border-blue-600" 
                            : "bg-transparent text-slate-500 border-transparent hover:bg-slate-200"
                    }`}
                >
                    {month.name}
                </button>
            ))}
        </div>
      </div>

      {/* حاوية الجدول */}
      <div className="w-full overflow-x-auto border border-slate-300 shadow-sm bg-white rounded-b-lg" style={{ maxHeight: '70vh' }}>
        <table className="w-full text-center border-collapse text-[11px] whitespace-nowrap">
          {/* رأس الجدول (نفس التصميم السابق) */}
          <thead className="sticky top-0 z-20 bg-white shadow-sm">
            <tr className="border-b border-slate-300">
              <th colSpan={4} className="border border-slate-300 p-1 bg-slate-100">البيانات الأساسية</th>
              <th rowSpan={4} className="border border-slate-300 p-1 font-bold shadow-inner" style={{ backgroundColor: COLORS.TOTAL_ALL }}>
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-24">
                  اجمالي عام الاستخدامات
                </div>
              </th>
              <th colSpan={13} className="border border-slate-300 p-1 font-bold" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                اجمالي الباب الاول
              </th>
              <th colSpan={21} className="border border-slate-300 p-1 font-bold" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                اجمالي الباب الثاني
              </th>
              <th colSpan={7} className="border border-slate-300 p-1 font-bold" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                اجمالي الباب الرابع
              </th>
              <th rowSpan={4} className="border border-slate-300 p-1 bg-slate-100">إجراء</th>
            </tr>
            <tr className="border-b border-slate-300">
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[70px]">رقم الاستمارة</th>
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[70px]">كشف التسوية</th>
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[120px]">
                  <div className="flex items-center justify-center gap-1"><CalendarDays className="w-3 h-3"/> التاريخ</div>
              </th>
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[200px]">البيان</th>
              
              <th colSpan={11} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>
              <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>
              
              <th colSpan={15} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>
              <th colSpan={6} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>
              
              <th rowSpan={3} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">الإجمالي</div>
              </th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مركز صحي قحزة</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">وحدة الغسيل الكلوي</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مشروع دعم الكلى</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">الصالة والمطبخ</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مركز صحي</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">الامانات</th>
            </tr>
            <tr className="border-b border-slate-300">
                <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">الإجمالي</div>
                </th>
                <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>
                     <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">إجمالي ف1</div>
                </th>
                <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAND }}>البند الاول</th>
                <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAND }}>البند الثالث</th>
                <th colSpan={4} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAND }}>البند الرابع</th>
                <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>
                     <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">إجمالي ف2</div>
                </th>
                <th rowSpan={2} className="border border-slate-300 p-1 bg-white">ح/حكومة</th>
                <th rowSpan={2} className="border border-slate-300 p-1 bg-white">اصابة عمل</th>
                <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">الإجمالي</div>
                </th>
                <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>
                     <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">إجمالي ف1</div>
                </th>
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
                <th rowSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>
                     <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">إجمالي ف2</div>
                </th>
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

          {/* محتوى الجدول */}
          <tbody>
            {currentMonthRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                {/* الأعمدة الأساسية */}
                {mainHeaders.map(header => (
                  <td key={header} className="border border-slate-200 p-0">
                    <EditableCell rowId={row.id} field={header} value={row[header]} />
                  </td>
                ))}
                
                {/* الأعمدة المالية (مدخلات + معادلات) */}
                {dataColumnsOrder.map(col => {
                  const isFormula = col.includes("اجمالي") || col.includes("الفصل");
                  return (
                    <td key={col} className={`border border-slate-200 p-0 ${isFormula ? 'bg-slate-50/50' : ''}`}
                        style={{ backgroundColor: col === "اجمالي عام الاستخدامات" ? COLORS.TOTAL_ALL : (col.includes("اجمالي الباب") ? COLORS.BAB_TOTAL : (col.includes("الفصل") ? COLORS.FASL : undefined)) }}
                    >
                      {isFormula ? <FormulaCell value={row[col]} /> : <EditableCell rowId={row.id} field={col} value={row[col]} />}
                    </td>
                  );
                })}

                <td className="border border-slate-200 p-1 text-center bg-white">
                  <button onClick={() => handleDeleteRow(row.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </td>
              </tr>
            ))}
            {currentMonthRows.length === 0 && (
              <tr>
                <td colSpan={47} className="p-12 text-slate-400 text-center text-sm font-medium">
                  لا توجد سجلات لشهر {MONTHS.find(m => m.id === activeMonthId)?.name}. اضغط على "إضافة سطر" للبدء.
                </td>
              </tr>
            )}
          </tbody>

          {/* تذييل الجدول: المجاميع (يظهر بشكل ثابت أسفل الجدول) */}
          <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] text-[12px]">
            {/* إجمالي الشهر السابق */}
            <tr className="bg-slate-200 border-b border-slate-300">
              <td colSpan={4} className="border border-slate-300 p-2 font-bold text-slate-700 text-right pr-4">إجمالي الشهر السابق ({activeMonthId > 1 ? MONTHS[activeMonthId-2].name : 'لا يوجد'})</td>
              {dataColumnsOrder.map(col => (
                <td key={`prev-${col}`} className="border border-slate-300 p-1 text-slate-700 font-semibold" dir="ltr">
                  {totals.previous(col) > 0 ? formatNumberEn(totals.previous(col)) : "-"}
                </td>
              ))}
              <td className="border border-slate-300 bg-slate-200"></td>
            </tr>
            
            {/* إجمالي الشهر الحالي */}
            <tr className="bg-blue-100 border-b border-blue-200">
              <td colSpan={4} className="border border-blue-300 p-2 font-bold text-blue-900 text-right pr-4">إجمالي الشهر الحالي ({MONTHS.find(m => m.id === activeMonthId)?.name})</td>
              {dataColumnsOrder.map(col => (
                <td key={`curr-${col}`} className="border border-blue-300 p-1 text-blue-900 font-bold" dir="ltr">
                  {totals.current(col) > 0 ? formatNumberEn(totals.current(col)) : "-"}
                </td>
              ))}
              <td className="border border-blue-300 bg-blue-100"></td>
            </tr>

            {/* الإجمالي العام التراكمي */}
            <tr className="bg-[#0b3d6d] text-white">
              <td colSpan={4} className="border border-white/20 p-2 font-bold text-right pr-4">الإجمالي العام (حتى شهر {MONTHS.find(m => m.id === activeMonthId)?.name})</td>
              {dataColumnsOrder.map(col => (
                <td key={`cum-${col}`} className="border border-white/20 p-1 font-bold text-amber-300" dir="ltr">
                  {totals.cumulative(col) > 0 ? formatNumberEn(totals.cumulative(col)) : "-"}
                </td>
              ))}
              <td className="border border-white/20"></td>
            </tr>
          </tfoot>

        </table>
      </div>
    </div>
  );
};

export default AppTabs;
