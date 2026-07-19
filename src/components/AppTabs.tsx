import React, { useEffect, useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Plus, Download } from "lucide-react";
import * as XLSX from "xlsx";

// --- هيكلة البيانات المستوحاة من ملف الإكسل ---

const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان"];

// هيكلة الباب الأول
const bab1Structure = {
  "الفصل الاول": {
    "البند الاول": ["المرتبات الاساسية", "اجور تعاقدية"],
    "البند الثالث": ["اجور عمل اضافي", "مكافات"],
    "البند الرابع": ["طبيعة عمل", "بدل ريف", "بدل سكن", "بدل تحديث"]
  },
  "الفصل الثاني": {
    "بدون_بند": ["ح/حكومة", "اصابة عمل"]
  }
};

// هيكلة الباب الثاني
const bab2Structure = {
  "الفصل الاول": ["مياه", "انارة", "ادوات كتابية", "نشر واعلان", "اتصالات", "مؤتمرات واحتفالات", "نفقات النظافة", "اخرى", "نقل مهام", "انتقالات داخلية", "ايجار مباني", "ادوية ومستلزمات طبية", "اغذية وملبوسات", "اخرى_2"],
  "الفصل الثاني": ["صيانة مباني", "وقود وزيوت", "قطع غيار وصيانة وسائل النقل", "قطع غيار وصيانة الالات والمعدات والاثاث"]
};

// هيكلة الباب الرابع
const bab4Columns = ["مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"];

// استخراج جميع حقول الإدخال المسطحة من الهيكلة
const flattenStructure = () => {
  const fields: string[] = [];
  
  // الباب الأول
  for (const fasl in bab1Structure) {
    for (const band in (bab1Structure as any)[fasl]) {
      fields.push(...(bab1Structure as any)[fasl][band]);
    }
  }
  
  // الباب الثاني
  for (const fasl in bab2Structure) {
    fields.push(...(bab2Structure as any)[fasl]);
  }
  
  // الباب الرابع
  fields.push(...bab4Columns);
  
  return fields;
};

const inputFields = flattenStructure();

// الألوان المستخرجة من الإكسل لتطبيقها في الجدول
const COLORS = {
  TOTAL_ALL: "#E5DFEC",   // اجمالي عام
  BAB_TOTAL: "#DBEEF3",   // اجمالي باب
  FASL: "#FDE9D9",        // فصل
  BAND: "#C6D9F0",        // بند
};

const ROW_LOAD_CHUNK = 100;

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

// دالة إعادة الحساب تحاكي معادلات الإكسل تماماً
const recomputeRow = (row: any) => {
  const newRow = { ...row };

  // حساب الباب الأول
  let bab1Total = 0;
  for (const fasl in bab1Structure) {
    let faslTotal = 0;
    for (const band in (bab1Structure as any)[fasl]) {
      const bandCols = (bab1Structure as any)[fasl][band];
      const bandTotal = sumColumns(newRow, bandCols);
      newRow[band] = bandTotal; // حفظ مجموع البند (رغم أننا قد لا نعرضه كخلية مستقلة لكنه مفيد)
      faslTotal += bandTotal;
    }
    newRow[fasl + "_باب1"] = faslTotal;
    bab1Total += faslTotal;
  }
  newRow["اجمالي الباب الاول"] = bab1Total;

  // حساب الباب الثاني
  let bab2Total = 0;
  for (const fasl in bab2Structure) {
    const faslCols = (bab2Structure as any)[fasl];
    const faslTotal = sumColumns(newRow, faslCols);
    newRow[fasl + "_باب2"] = faslTotal;
    bab2Total += faslTotal;
  }
  newRow["اجمالي الباب الثاني"] = bab2Total;

  // حساب الباب الرابع
  newRow["اجمالي الباب الرابع"] = sumColumns(newRow, bab4Columns);

  // الإجمالي العام
  newRow["اجمالي عام الاستخدامات"] = bab1Total + bab2Total + (newRow["اجمالي الباب الرابع"] || 0);

  return newRow;
};

const emptyRow = () => {
  const row: any = {};
  mainHeaders.forEach(h => row[h] = "");
  inputFields.forEach(h => row[h] = "");
  return recomputeRow(row);
};

const AppTabs: React.FC = () => {
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [rowsToShow, setRowsToShow] = useState<number>(ROW_LOAD_CHUNK);

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
  };

  const handleDeleteRow = (originalIndex: number) => {
    if (!window.confirm("هل تريد حذف هذا السطر؟")) return;
    setDataRows((prev) => prev.filter((_, i) => i !== originalIndex));
  };

  const fmt = (val: any) => (typeof val === "number" ? val.toLocaleString("ar-YE") : val || "");

  const EditableCell: React.FC<{ originalIndex: number; field: string; value: any }> = ({
    originalIndex,
    field,
    value,
  }) => (
    <input
      type="text"
      defaultValue={value === "" || value === undefined ? "" : String(value)}
      key={`${originalIndex}-${field}-${value}`}
      onBlur={(e) => updateCell(originalIndex, field, e.target.value)}
      className="w-full bg-transparent focus:bg-amber-50 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-center text-xs"
    />
  );

  const FormulaCell: React.FC<{ value: any; color?: string }> = ({ value, color }) => (
    <div className={`font-bold text-center text-xs`} style={{ color: '#333' }}>
      {fmt(value)}
    </div>
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800 p-2" dir="rtl">
      
      {/* شريط الأدوات العلوي */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-800" />
            <h2 className="text-base font-bold text-blue-900">سجل مفردات الاستخدامات والنفقات العامة</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAddRow} className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1.5 rounded">
            <Plus className="w-4 h-4" /> إضافة سطر
          </button>
        </div>
      </div>

      {/* حاوية الجدول الأفقي */}
      <div className="w-full overflow-x-auto border border-slate-300 shadow-sm bg-white" style={{ maxHeight: '75vh' }}>
        <table className="w-full text-center border-collapse text-[11px] whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-white">
            
            {/* الصف الأول من الترويسة (الأبواب والإجمالي) */}
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

            {/* الصف الثاني من الترويسة (الفصول) */}
            <tr className="border-b border-slate-300">
              <th rowSpan={3} className="border border-slate-300 p-1">رقم الاستمارة</th>
              <th rowSpan={3} className="border border-slate-300 p-1">كشف التسوية</th>
              <th rowSpan={3} className="border border-slate-300 p-1">التاريخ</th>
              <th rowSpan={3} className="border border-slate-300 p-1 min-w-[150px]">البيان</th>
              
              {/* فصول الباب الأول */}
              <th colSpan={11} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>
              <th colSpan={2} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>
              
              {/* فصول الباب الثاني */}
              <th colSpan={15} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الاول</th>
              <th colSpan={6} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.FASL }}>الفصل الثاني</th>
              
              {/* الباب الرابع ليس له فصول، ندمج للأسفل */}
              <th rowSpan={3} className="border border-slate-300 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}>
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="mx-auto h-16">
                  الإجمالي
                </div>
              </th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مركز صحي قحزة</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">وحدة الغسيل الكلوي</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مشروع دعم الكلى</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">الصالة والمطبخ</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">مركز صحي</th>
              <th rowSpan={3} className="border border-slate-300 p-1 bg-white">الامانات</th>
            </tr>

            {/* الصف الثالث (البنود) - يطبق فقط على الباب الأول والثاني */}
            <tr className="border-b border-slate-300">
                {/* إجمالي الباب الأول (العمود الخاص بالمجموع) */}
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

                {/* إجمالي الباب الثاني (العمود الخاص بالمجموع) */}
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

            {/* الصف الرابع (التفاصيل الدقيقة للبنود) */}
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
            {dataRows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                {/* الأساسية */}
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="رقم الاستمارة" value={row["رقم الاستمارة"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="كشف التسوية" value={row["كشف التسوية"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="التاريخ" value={row["التاريخ"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="البيان" value={row["البيان"]} /></td>
                
                {/* اجمالي عام */}
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.TOTAL_ALL }}><FormulaCell value={row["اجمالي عام الاستخدامات"]} /></td>
                
                {/* الباب الأول */}
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}><FormulaCell value={row["اجمالي الباب الاول"]} /></td>
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.FASL }}><FormulaCell value={row["الفصل الاول_باب1"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="المرتبات الاساسية" value={row["المرتبات الاساسية"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اجور تعاقدية" value={row["اجور تعاقدية"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اجور عمل اضافي" value={row["اجور عمل اضافي"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="مكافات" value={row["مكافات"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="طبيعة عمل" value={row["طبيعة عمل"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="بدل ريف" value={row["بدل ريف"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="بدل سكن" value={row["بدل سكن"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="بدل تحديث" value={row["بدل تحديث"]} /></td>
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.FASL }}><FormulaCell value={row["الفصل الثاني_باب1"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="ح/حكومة" value={row["ح/حكومة"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اصابة عمل" value={row["اصابة عمل"]} /></td>

                {/* الباب الثاني */}
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}><FormulaCell value={row["اجمالي الباب الثاني"]} /></td>
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.FASL }}><FormulaCell value={row["الفصل الاول_باب2"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="مياه" value={row["مياه"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="انارة" value={row["انارة"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="ادوات كتابية" value={row["ادوات كتابية"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="نشر واعلان" value={row["نشر واعلان"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اتصالات" value={row["اتصالات"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="مؤتمرات واحتفالات" value={row["مؤتمرات واحتفالات"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="نفقات النظافة" value={row["نفقات النظافة"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اخرى" value={row["اخرى"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="نقل مهام" value={row["نقل مهام"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="انتقالات داخلية" value={row["انتقالات داخلية"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="ايجار مباني" value={row["ايجار مباني"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="ادوية ومستلزمات طبية" value={row["ادوية ومستلزمات طبية"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اغذية وملبوسات" value={row["اغذية وملبوسات"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="اخرى_2" value={row["اخرى_2"]} /></td>
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.FASL }}><FormulaCell value={row["الفصل الثاني_باب2"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="صيانة مباني" value={row["صيانة مباني"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="وقود وزيوت" value={row["وقود وزيوت"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="قطع غيار وصيانة وسائل النقل" value={row["قطع غيار وصيانة وسائل النقل"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="قطع غيار وصيانة الالات والمعدات والاثاث" value={row["قطع غيار وصيانة الالات والمعدات والاثاث"]} /></td>

                {/* الباب الرابع */}
                <td className="border border-slate-200 p-1" style={{ backgroundColor: COLORS.BAB_TOTAL }}><FormulaCell value={row["اجمالي الباب الرابع"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="مركز صحي قحزة" value={row["مركز صحي قحزة"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="وحدة الغسيل الكلوي" value={row["وحدة الغسيل الكلوي"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="مشروع دعم الكلى" value={row["مشروع دعم الكلى"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="الصالة والمطبخ" value={row["الصالة والمطبخ"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="مركز صحي" value={row["مركز صحي"]} /></td>
                <td className="border border-slate-200 p-0"><EditableCell originalIndex={index} field="الامانات" value={row["الامانات"]} /></td>

                <td className="border border-slate-200 p-1 text-center">
                  <button onClick={() => handleDeleteRow(index)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </td>
              </tr>
            ))}
            {dataRows.length === 0 && (
              <tr>
                <td colSpan={45} className="p-8 text-slate-400 text-center">
                  الجدول فارغ. اضغط على "إضافة سطر" للبدء.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AppTabs;
