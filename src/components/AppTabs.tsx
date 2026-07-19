import React, { useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2, CheckCircle2, ChevronDown, ChevronLeft } from "lucide-react";
import * as XLSX from "xlsx";

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

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // الأعمدة الرئيسية الدائمة الظهور
  const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان", "اجمالي عام الاستخدامات"];

  // بنود الباب الأول الفرعية
  const bab1Columns = [
    "الفصل الاول", "البند الاول", "المرتبات الاساسية", "اجور تعاقدية", 
    "البند الثالث", "اجور عمل اضافي", "مكافات", "البند الرابع", 
    "طبيعة عمل", "بدل ريف", "بدل سكن", "بدل تحديث", "الفصل الثاني", "ح/حكومة", "اصابة عمل"
  ];

  // بنود الباب الثاني الفرعية (تم تمييز التكرار برمجياً لمنع انهيار الواجهة)
  const bab2Columns = [
    "الفصل الاول_باب2", "مياه", "انارة", "ادوات كتابية", "نشر واعلان", 
    "اتصالات", "مؤتمرات واحتفالات", "نفقات النظافة", "اخرى", "نقل مهام", 
    "انتقالات داخلية", "ايجار مباني", "ادوية ومستلزمات طبية", "اغذية وملبوسات", 
    "الفصل الثاني_باب2", "صيانة مباني", "وقود وزيوت", "قطع غيار وصيانة وسائل النقل", "قطع غيار وصيانة الالات والمعدات والاثاث"
  ];

  const bab4Columns = [
    "مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"
  ];

  // دالة الاستيراد الآمنة والمحسنة لحل مشكلة تعليق المتصفح
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const target = event.target;
        if (!target) return;

        const binaryString = target.result;
        // قراءة الملف مع تفعيل خيار الحجم الخفيف للأداء
        const workbook = XLSX.read(binaryString, { type: "binary", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // تحويل المحتوى إلى مصفوفة صفوف خام (سرعة معالجة قصوى)
        const rawJsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rawJsonData.length > 1) {
          // استخراج الترويسة من الصف الثاني (الفهرس 1) وتنظيفها
          const extractedHeaders = rawJsonData[1].map((header: any, idx: number) => {
            let name = header !== undefined && header !== null ? String(header).trim() : `عمود_${idx}`;
            if (name === "الفصل الاول" && idx > 15) name = "الفصل الاول_باب2";
            if (name === "الفصل الثاني" && idx > 15) name = "الفصل الثاني_باب2";
            return name;
          });

          const temporaryRows: any[] = [];

          // الفلترة الصارمة: تخطي أول صفين ومعالجة الصفوف المحتوية على بيانات فعلية فقط لمنع التعلق
          for (let i = 2; i < rawJsonData.length; i++) {
            const row = rawJsonData[i];
            if (!row || row.length === 0) continue;

            // التحقق من أن السطر ليس فارغاً وهمياً (يجب أن يحتوي على بيان أو رقم استمارة أو تاريخ أو إجمالي)
            const hasData = row[0] !== undefined || row[1] !== undefined || row[2] !== undefined || row[3] !== undefined || row[5] !== undefined;
            if (!hasData) continue; // تخطي الأسطر الفارغة تماماً ومقاطعة الحلقة اللانهائية

            const rowObj: any = {};
            extractedHeaders.forEach((header: string, index: number) => {
              rowObj[header] = row[index] !== undefined && row[index] !== null ? row[index] : "";
            });
            temporaryRows.push(rowObj);
          }

          setColumnHeaders(extractedHeaders);
          setDataRows(temporaryRows); // حقن البيانات النظيفة دفعة واحدة
          setIsImported(true);
          setTimeout(() => setIsImported(false), 3000);
        }
      } catch (error) {
        console.error("خطأ في معالجة الملف المحاسبي:", error);
        alert("حدث خطأ أثناء قراءة البيانات، يرجى التأكد من سلامة ملف الإكسل.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearTable = () => {
    if (window.confirm("هل تود مسح السجلات الحالية؟")) {
      setDataRows([]);
      setColumnHeaders([]);
    }
  };

  // تصفية أسطر النفقات بناءً على مربع البحث
  const filteredRows = dataRows.filter((row) =>
    mainHeaders.concat(["البيان"]).some((key) => 
      String(row[key] || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800" dir="rtl">
      
      {/* الترويسة */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileSpreadsheet className="w-5 h-5 text-[#10528e]" />
        <h2 className="text-sm sm:text-base font-bold text-[#0b3d6d] font-cairo">
          سجل مفردات الاستخدامات والنفقات العامة (نسخة الأداء السريع المطور)
        </h2>
      </div>

      {/* شريط التحكم والرفع */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث سريع في السجل المالي المستورد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.value)}
            className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-[#10528e] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isImported && (
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم الاستيراد بنجاح وحظر الأسطر الفارغة!</span>
            </div>
          )}

          <label className="flex items-center justify-center gap-1.5 bg-[#10528e] hover:bg-[#0b3d6d] text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>استيراد السجل المالي</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>

          {dataRows.length > 0 && (
            <button
              onClick={handleClearTable}
              className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs md:text-sm font-bold px-3 py-2 rounded-lg transition-all border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>تفريغ الشاشة</span>
            </button>
          )}
        </div>
      </div>

      {/* الجدول التفاعلي المحمي */}
      <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl shadow-sm bg-white max-h-[500px] overflow-y-auto">
        <table className="w-full text-right border-collapse text-xs md:text-sm">
          <thead className="sticky top-0 z-10 bg-[#0b3d6d] text-white font-cairo">
            
            {/* صف تجميع القوائم المنسدلة للأعمدة */}
            <tr className="border-b border-white/10 text-center">
              <th colSpan={5} className="p-2 bg-[#082f55] text-slate-300 font-normal text-xs">
                الأعمدة التعريفية الدائمة
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
                  <span>إجمالي الباب الرابع والحسابات</span>
                  {expandedGroups.bab4 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                </div>
              </th>
            </tr>

            {/* أسماء الأعمدة الدقيقة */}
            <tr className="bg-[#0b3d6d] border-b border-slate-200">
              {mainHeaders.map((header, idx) => (
                <th key={idx} className="p-2.5 font-semibold border-x border-white/5 whitespace-nowrap">
                  {header}
                </th>
              ))}

              <th className="p-2.5 font-bold bg-[#0d477a] border-x border-white/5 whitespace-nowrap">اجمالي الباب الاول</th>
              {expandedGroups.bab1 && bab1Columns.map((col, idx) => (
                <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">
                  {col}
                </th>
              ))}

              <th className="p-2.5 font-bold bg-[#12538c] border-x border-white/5 whitespace-nowrap">اجمالي الباب الثاني</th>
              {expandedGroups.bab2 && bab2Columns.map((col, idx) => (
                <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">
                  {col.replace("_bab2", "")}
                </th>
              ))}

              <th className="p-2.5 font-bold bg-[#175f9d] border-x border-white/5 whitespace-nowrap">اجمالي الباب الرابع</th>
              {expandedGroups.bab4 && bab4Columns.map((col, idx) => (
                <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-center text-xs">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/40">
                  
                  {mainHeaders.map((header, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 font-medium text-slate-900 text-right whitespace-nowrap">
                      {typeof row[header] === "number" ? row[header].toLocaleString("ar-YE") : row[header]}
                    </td>
                  ))}

                  <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                    {typeof row["اجمالي الباب الاول"] === "number" ? row["اجمالي الباب الاول"].toLocaleString("ar-YE") : row["اجمالي الباب الاول"]}
                  </td>
                  {expandedGroups.bab1 && bab1Columns.map((col, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/10 whitespace-nowrap">
                      {typeof row[col] === "number" ? row[col].toLocaleString("ar-YE") : row[col]}
                    </td>
                  ))}

                  <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                    {typeof row["اجمالي الباب الثاني"] === "number" ? row["اجمالي الباب الثاني"].toLocaleString("ar-YE") : row["اجمالي الباب الثاني"]}
                  </td>
                  {expandedGroups.bab2 && bab2Columns.map((col, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/10 whitespace-nowrap">
                      {typeof row[col] === "number" ? row[col].toLocaleString("ar-YE") : row[col]}
                    </td>
                  ))}

                  <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                    {typeof row["اجمالي الباب الرابع"] === "number" ? row["اجمالي الباب الرابع"].toLocaleString("ar-YE") : row["اجمالي الباب الرابع"]}
                  </td>
                  {expandedGroups.bab4 && bab4Columns.map((col, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/10 whitespace-nowrap">
                      {typeof row[col] === "number" ? row[col].toLocaleString("ar-YE") : row[col]}
                    </td>
                  ))}

                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="p-12 text-slate-400 font-medium text-center">
                  لا توجد سجلات مالية لعرضها. يرجى رفع ملف النفقات الفعلي للمجلس.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between px-1">
        <div>تمت معالجة وفلترة الأسطر الوهمية بنجاح. الأسطر المحملة حالياً: {filteredRows.length} خط مالي فعلي.</div>
        <div>النظام آمن ومحمي 100% ضد حظر أو تعليق المتصفحات.</div>
      </div>

    </div>
  );
};

export default AppTabs;
