import React, { useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2, CheckCircle2, ChevronDown, ChevronLeft } from "lucide-react";
import * as XLSX from "xlsx";

const AppTabs: React.FC = () => {
  // إدارة حالات البيانات المستوردة من ملف المجلس
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isImported, setIsImported] = useState<boolean>(false);

  // 1. التوثيق: إدارة حالة فتح وإغلاق القوائم المنسدلة للأعمدة (مغلقة افتراضياً لتوفير المساحة)
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    bab1: false, // الباب الأول: المرتبات والأجور
    bab2: false, // الباب الثاني: النفقات التشغيلية
    bab4: false, // الباب الرابع والحسابات الأخرى
  });

  // دالة برمجية لتبديل حالة المجموعة (فتح / إغلاق) عند النقر عليها
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // 2. التوثيق: تعريف الأعمدة الرئيسية الثابتة دائماً في ملف المجلس
  const mainHeaders = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان", "اجمالي عام الاستخدامات"];

  // 3. التوثيق: تقسيم وتجميع الأعمدة الفرعية بناءً على بنية ملفك الفعلي لتجنب التعارض
  const bab1Columns = [
    "الفصل الاول", "البند الاول", "المرتبات الاساسية", "اجور تعاقدية", 
    "البند الثالث", "اجور عمل اضافي", "مكافات", "البند الرابع", 
    "طبيعة عمل", "بدل ريف", "بدل سكن", "بدل تحديث", "الفصل الثاني", "ح/حكومة", "اصابة عمل"
  ];

  const bab2Columns = [
    "الفصل الاول_باب2", "مياه", "انارة", "ادوات كتابية", "نشر واعلان", 
    "اتصالات", "مؤتمرات واحتفالات", "نفقات النظافة", "اخرى", "نقل مهام", 
    "انتقالات داخلية", "ايجار مباني", "ادوية ومستلزمات طبية", "اغذية وملبوسات", 
    "الفصل الثاني_باب2", "صيانة مباني", "وقود وزيوت", "قطع غيار وصيانة وسائل النقل", "قطع غيار وصيانة الالات والمعدات والاثاث"
  ];

  const bab4Columns = [
    "مركز صحي قحزة", "وحدة الغسيل الكلوي", "مشروع دعم الكلى", "الصالة والمطبخ", "مركز صحي", "الامانات"
  ];

  // 4. دالة معالجة واستيراد ملف الإكسل ميكانيكياً ومطابقة الصفوف
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
        const workbook = XLSX.read(binaryString, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // جلب البيانات كصفوف خام مصفوفة ثنائية الأبعاد
        const rawJsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rawJsonData.length > 1) {
          // الصف الثاني (فهرس 1) يحتوي على المسميات الدقيقة للأعمدة
          const extractedHeaders = rawJsonData[1].map((header: any, idx: number) => {
            let name = header !== undefined && header !== null ? String(header).trim() : `عمود_${idx}`;
            // تمييز الفصول المتكررة المسميات برمجياً لتجنب تداخل الحقول
            if (name === "الفصل الاول" && idx > 15) name = "الفصل الاول_باب2";
            if (name === "الفصل الثاني" && idx > 15) name = "الفصل الثاني_باب2";
            return name;
          });

          // تحويل الصفوف المالية إلى كائنات برمجية معرفة بمفاتيح الأعمدة
          const extractedRows = rawJsonData.slice(2).filter(row => row.length > 0).map((row) => {
            const rowObj: any = {};
            extractedHeaders.forEach((header: string, index: number) => {
              rowObj[header] = row[index] !== undefined && row[index] !== null ? row[index] : "";
            });
            return rowObj;
          });

          setDataRows(extractedRows);
          setIsImported(true);
          setTimeout(() => setIsImported(false), 4000);
        }
      } catch (error) {
        console.error("حدث تعارض أثناء معالجة وقراءة الهيكل المالي للجدول:", error);
        alert("فشل الاستيراد، يرجى التأكد من رفع ملف سجل النفقات الصحيح للمجلس.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // تصفية السطور بناءً على مربع البحث الشامل
  const filteredRows = dataRows.filter((row) =>
    mainHeaders.concat(["البيان"]).some((key) => String(row[key] || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800" dir="rtl">
      
      {/* عنوان الواجهة */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileSpreadsheet className="w-5 h-5 text-[#10528e]" />
        <h2 className="text-sm sm:text-base font-bold text-[#0b3d6d] font-cairo">
          لوحة تحكم وعرض سجل النفقات العامة بقوائم منسدلة للأعمدة
        </h2>
      </div>

      {/* شريط التحكم */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث سريع برقم الاستمارة، التاريخ، أو البيان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-[#10528e] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isImported && (
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم تجميع وهيكلة الأعمدة بنجاح!</span>
            </div>
          )}

          <label className="flex items-center justify-center gap-1.5 bg-[#10528e] hover:bg-[#0b3d6d] text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>استيراد السجل المالي</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* وعاء عرض الجدول الذكي */}
      <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl shadow-sm bg-white max-h-[550px] overflow-y-auto">
        <table className="w-full text-right border-collapse text-xs md:text-sm">
          <thead className="sticky top-0 z-10 bg-[#0b3d6d] text-white font-cairo">
            
            {/* الصف العلوي للتحكم في المجموعات المنسدلة */}
            <tr className="border-b border-white/10">
              {/* خلايا فارغة للأعمدة الرئيسية الدائمة لكي يتوازن التصميم */}
              <th colSpan={5} className="p-2 text-right text-[11px] bg-[#082f55] text-slate-300 font-normal">
                الأعمدة التعريفية الرئيسية (ظاهرة دائماً)
              </th>
              
              {/* عمود تحكم منسدل للباب الأول */}
              <th 
                className="p-2 bg-[#0d477a] hover:bg-[#10528e] text-center cursor-pointer border-x border-white/10 transition-colors"
                onClick={() => toggleGroup("bab1")}
                colSpan={expandedGroups.bab1 ? bab1Columns.length + 1 : 1}
              >
                <div className="flex items-center justify-center gap-1 font-bold">
                  <span>إجمالي الباب الأول</span>
                  {expandedGroups.bab1 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                </div>
              </th>

              {/* عمود تحكم منسدل للباب الثاني */}
              <th 
                className="p-2 bg-[#12538c] hover:bg-[#165f9e] text-center cursor-pointer border-x border-white/10 transition-colors"
                onClick={() => toggleGroup("bab2")}
                colSpan={expandedGroups.bab2 ? bab2Columns.length + 1 : 1}
              >
                <div className="flex items-center justify-center gap-1 font-bold">
                  <span>إجمالي الباب الثاني</span>
                  {expandedGroups.bab2 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                </div>
              </th>

              {/* عمود تحكم منسدل للباب الرابع */}
              <th 
                className="p-2 bg-[#175f9d] hover:bg-[#1c6fae] text-center cursor-pointer border-x border-white/10 transition-colors"
                onClick={() => toggleGroup("bab4")}
                colSpan={expandedGroups.bab4 ? bab4Columns.length + 1 : 1}
              >
                <div className="flex items-center justify-center gap-1 font-bold">
                  <span>إجمالي الباب الرابع والحسابات الأخرى</span>
                  {expandedGroups.bab4 ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronLeft className="w-4 h-4 text-slate-300" />}
                </div>
              </th>
            </tr>

            {/* الصف الثاني: المسميات الفعلية للأعمدة وتعتمد على حالة القائمة المنسدلة */}
            <tr className="bg-[#0b3d6d] border-b border-slate-200 text-center">
              {/* 1. الأعمدة الرئيسية الدائمة */}
              {mainHeaders.map((header, idx) => (
                <th key={idx} className="p-2.5 font-semibold border-x border-white/5 whitespace-nowrap">
                  {header}
                </th>
              ))}

              {/* 2. بنود الباب الأول (تظهر فقط إذا كانت حالة المنسدلة مفتوحة) */}
              <th className="p-2.5 font-bold bg-[#0d477a] border-x border-white/5 whitespace-nowrap">اجمالي الباب الاول</th>
              {expandedGroups.bab1 && bab1Columns.map((col, idx) => (
                <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap animate-fade-in">
                  {col.replace("_bab2", "")}
                </th>
              ))}

              {/* 3. بنود الباب الثاني (تظهر فقط إذا كانت حالة المنسدلة مفتوحة) */}
              <th className="p-2.5 font-bold bg-[#12538c] border-x border-white/5 whitespace-nowrap">اجمالي الباب الثاني</th>
              {expandedGroups.bab2 && bab2Columns.map((col, idx) => (
                <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap animate-fade-in">
                  {col.replace("_bab2", "")}
                </th>
              ))}

              {/* 4. بنود الباب الرابع (تظهر فقط إذا كانت حالة المنسدلة مفتوحة) */}
              <th className="p-2.5 font-bold bg-[#175f9d] border-x border-white/5 whitespace-nowrap">اجمالي الباب الرابع</th>
              {expandedGroups.bab4 && bab4Columns.map((col, idx) => (
                <th key={idx} className="p-2.5 font-normal bg-slate-800/40 border-x border-white/5 text-[11px] whitespace-nowrap animate-fade-in">
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-center text-xs">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50 transition-colors odd:bg-slate-50/40">
                  
                  {/* طباعة بيانات الأعمدة الرئيسية الدائمة */}
                  {mainHeaders.map((header, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 font-medium text-slate-900 text-right whitespace-nowrap">
                      {typeof row[header] === "number" ? row[header].toLocaleString("ar-YE") : row[header]}
                    </td>
                  ))}

                  {/* خلايا الباب الأول المالية */}
                  <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                    {typeof row["اجمالي الباب الاول"] === "number" ? row["اجمالي الباب الاول"].toLocaleString("ar-YE") : row["اجمالي الباب الاول"]}
                  </td>
                  {expandedGroups.bab1 && bab1Columns.map((col, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/20 whitespace-nowrap animate-fade-in">
                      {typeof row[col] === "number" ? row[col].toLocaleString("ar-YE") : row[col]}
                    </td>
                  ))}

                  {/* خلايا الباب الثاني المالية */}
                  <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                    {typeof row["اجمالي الباب الثاني"] === "number" ? row["اجمالي الباب الثاني"].toLocaleString("ar-YE") : row["اجمالي الباب الثاني"]}
                  </td>
                  {expandedGroups.bab2 && bab2Columns.map((col, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/20 whitespace-nowrap animate-fade-in">
                      {typeof row[col] === "number" ? row[col].toLocaleString("ar-YE") : row[col]}
                    </td>
                  ))}

                  {/* خلايا الباب الرابع المالية */}
                  <td className="p-2 border-x border-slate-100 font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                    {typeof row["اجمالي الباب الرابع"] === "number" ? row["اجمالي الباب الرابع"].toLocaleString("ar-YE") : row["اجمالي الباب الرابع"]}
                  </td>
                  {expandedGroups.bab4 && bab4Columns.map((col, idx) => (
                    <td key={idx} className="p-2 border-x border-slate-100 text-slate-500 bg-slate-50/20 whitespace-nowrap animate-fade-in">
                      {typeof row[col] === "number" ? row[col].toLocaleString("ar-YE") : row[col]}
                    </td>
                  ))}

                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={15} className="p-12 text-slate-400 font-medium text-center">
                  الجدول بانتظار استيراد ملف النفقات المالي للمجلس لتفعيل عرض القوائم المنسدلة للأعمدة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ذيل السجل التوضيحي */}
      <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between px-1">
        <div>ملاحظة: يمكنك الضغط على ترويسة "إجمالي الباب" لعرض أو إخفاء البنود التفصيلية التابعة له.</div>
        <div>النظام متوافق وآمن 100% مع ملف المجلس اليمني.</div>
      </div>

    </div>
  );
};

export default AppTabs;
