import React, { useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

const AppTabs: React.FC = () => {
  // إدارة الحالات للبيانات المستوردة ديناميكياً
  const [dataRows, setDataRows] = useState<any[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isImported, setIsImported] = useState<boolean>(false);

  // دالة معالجة رفع الملف وقراءته ديناميكياً بناءً على الهيكل الفعلي للملف المرسل
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
        // قراءة الملف ثنائياً
        const workbook = XLSX.read(binaryString, { type: "binary" });
        
        // جلب ورقة عمل النفقات المحددة
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // تحويل المحتوى إلى مصفوفة ثنائية الأبعاد [صفوف][أعمدة] للمحافظة على الترتيب والدمج ميكانيكياً
        const rawJsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rawJsonData.length > 1) {
          // الصف الثاني (المندرج تحت الفهرس 1) يحتوي على المسميات والأعمدة الفعلية مثل رقم الاستمارة والبيان...الخ
          const extractedHeaders = rawJsonData[1].map((header: any, index: number) => {
            return header !== undefined && header !== null ? String(header).trim() : `عمود فرعي ${index + 1}`;
          });

          // البيانات الفعلية تبدأ من الصف الثالث (الفهرس 2 فما فوق)
          const extractedRows = rawJsonData.slice(2).filter(row => row.length > 0).map((row) => {
            const rowObj: any = {};
            extractedHeaders.forEach((header: string, index: number) => {
              rowObj[header] = row[index] !== undefined && row[index] !== null ? row[index] : "";
            });
            return rowObj;
          });

          setColumnHeaders(extractedHeaders);
          setDataRows(extractedRows);
          setIsImported(true);
          setTimeout(() => setIsImported(false), 4000);
        } else {
          alert("بنية ملف النفقات غير متوافقة أو فارغة.");
        }
      } catch (error) {
        console.error("خطأ أثناء استيراد البيانات المكونة لسجل النفقات:", error);
        alert("تعذر استيراد الملف. يرجى التحقق من توافق ملف النفقات المالي.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // تفريغ سجل النفقات لإعادة الواجهة نظيفة
  const handleClearTable = () => {
    if (window.confirm("هل تود مسح السجلات الحالية المعروضة بالواجهة؟")) {
      setDataRows([]);
      setColumnHeaders([]);
    }
  };

  // تصفية أسطر النفقات بناءً على مربع البحث الشامل
  const filteredRows = dataRows.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800" dir="rtl">
      
      {/* هيدر ترويسة الواجهة المالية */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileSpreadsheet className="w-5 h-5 text-[#10528e]" />
        <h2 className="text-sm sm:text-base font-bold text-[#0b3d6d] font-cairo">
          دفتر اليومية التفصيلي ومفردات استخدامات النفقات العامة (2026م)
        </h2>
      </div>

      {/* شريط الإجراءات والبحث */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
        
        {/* حقل البحث */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث شامل برقم الاستمارة، التاريخ، أو البيان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-[#10528e] transition-all"
          />
        </div>

        {/* أزرار الاستيراد والتحكم */}
        <div className="flex items-center gap-2 flex-wrap">
          {isImported && (
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم استيراد ترويسة وبنية سجل المجلس بنجاح!</span>
            </div>
          )}

          <label className="flex items-center justify-center gap-1.5 bg-[#10528e] hover:bg-[#0b3d6d] text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>استيراد سجل النفقات المالي</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelImport}
              className="hidden"
            />
          </label>

          {dataRows.length > 0 && (
            <button
              onClick={handleClearTable}
              className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs md:text-sm font-bold px-3 py-2 rounded-lg transition-all border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>إفراغ الشاشة</span>
            </button>
          )}
        </div>
      </div>

      {/* وعاء عرض الجدول التفاعلي المرن القابل للتمرير الأفقي */}
      <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl shadow-sm bg-white max-h-[550px] overflow-y-auto">
        <table className="w-full text-right border-collapse text-xs md:text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0b3d6d] text-white font-bold font-cairo border-b border-slate-200">
              {columnHeaders.map((header, index) => (
                <th key={index} className="p-3 whitespace-nowrap font-semibold border-x border-white/10 shadow-sm text-center">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-slate-50/80 transition-colors odd:bg-slate-50/30 text-center"
                >
                  {columnHeaders.map((header, colIndex) => {
                    const cellValue = row[header];
                    // تمييز الحقول التعريفية عن الأرقام المالية بلون الخط والتنسيق
                    const isMetadata = ["رقم الاستمارة", "كشف التسوية", "التاريخ", "البيان"].some(keyword => header.includes(keyword));
                    return (
                      <td
                        key={colIndex}
                        className={`p-2.5 whitespace-nowrap border-x border-slate-100 ${
                          isMetadata ? "text-slate-900 font-medium bg-slate-50/40 text-right min-w-[150px]" : "text-emerald-700 font-bold"
                        }`}
                      >
                        {typeof cellValue === "number" ? cellValue.toLocaleString("ar-YE") : cellValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columnHeaders.length || 1}
                  className="p-12 text-center text-slate-400 font-medium text-sm"
                >
                  {columnHeaders.length > 0 
                    ? "لا توجد نتائج مطابقة لبحثك الحالي في دفاتر اليومية." 
                    : "الجدول بانتظار رفع ملف النفقات الأصلي للمجلس لعرض محتوياته بدقة تفاعلية."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* شريط الإحصائيات النهائي */}
      {columnHeaders.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-400 font-medium px-1 gap-1">
          <div>إجمالي البنود والحسابات التحليلية المرصودة: {columnHeaders.length} عموداً مالياً مفعلاً</div>
          <div>عدد قيود الاستمارات المستوردة حالياً: {filteredRows.length} قيد خطي</div>
        </div>
      )}

    </div>
  );
};

export default AppTabs;
