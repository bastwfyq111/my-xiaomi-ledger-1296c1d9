import React, { useState } from "react";
import { FileSpreadsheet, Upload, Search, Trash2 } from "lucide-react";
import * as XLSX from "xlsx"; // استيراد مكتبة تحليل ملفات Excel لقراءة الملف المرفوع

// 1. توثيق واجهة TypeScript لشكل بيانات الصف المالي بناءً على أعمدة ملفك الفعلي
interface ExpenseItem {
  "الباب": string;
  "المجموعة": string;
  "الفصل": string;
  "البند": string;
  "النوع": string;
  "البيان": string;
  "اعتماد السنة الحالية 2026": string | number;
}

const AppTabs: React.FC = () => {
  // 2. إعداد الحالات (States) لإدارة البيانات الحية وحقل البحث
  // قمنا بإنشاء سطر افتراضي فارغ ليوضح للمستخدم شكل وأسماء الأعمدة قبل الاستيراد
  const [expenseData, setExpenseData] = useState<ExpenseItem[]>([
    {
      "الباب": "مثال: 2",
      "المجموعة": "1",
      "الفصل": "1",
      "البند": "1",
      "النوع": "0",
      "البيان": "نفقات التشغيل والصيانة العامة",
      "اعتماد السنة الحالية 2026": 0
    }
  ]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // أسماء الأعمدة الثابتة والمطابقة تماماً لملفك المرفق لتنظيم العرض والتأكد من صحة البيانات
  const columns: (keyof ExpenseItem)[] = [
    "الباب",
    "المجموعة",
    "الفصل",
    "البند",
    "النوع",
    "البيان",
    "اعتماد السنة الحالية 2026"
  ];

  // 3. دالة معالجة واستيراد ملف الـ Excel عند رفعه من الجهاز
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    // عند اكتمال قراءة ملف النظام الثنائي من الجهاز
    reader.onload = (event) => {
      try {
        const target = event.target;
        if (!target) return;

        const binaryString = target.result;
        // قراءة كتاب العمل (Workbook)
        const workbook = XLSX.read(binaryString, { type: "binary" });
        
        // اختيار ورقة البيانات الأولى
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // تحويل أسطر جدول الـ Excel إلى مصفوفة كائنات JSON
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

        // تنظيف البيانات المستوردة لضمان مطابقتها للحقول المالية المطلوبة وتفادي الحقول العشوائية
        const formattedData: ExpenseItem[] = rawData.map((row: any) => ({
          "الباب": row["الباب"] !== undefined ? String(row["الباب"]) : "",
          "المجموعة": row["المجموعة"] !== undefined ? String(row["المجموعة"]) : "",
          "الفصل": row["الفصل"] !== undefined ? String(row["الفصل"]) : "",
          "البند": row["البند"] !== undefined ? String(row["البند"]) : "",
          "النوع": row["النوع"] !== undefined ? String(row["النوع"]) : "",
          "البيان": row["البيان"] !== undefined ? String(row["البيان"]) : "",
          "اعتماد السنة الحالية 2026": row["اعتماد السنة الحالية 2026"] !== undefined ? row["اعتماد السنة الحالية 2026"] : ""
        }));

        if (formattedData.length > 0) {
          setExpenseData(formattedData); // تحديث الواجهة فوراً بالبيانات الجديدة
        }
      } catch (error) {
        console.error("خطأ أثناء قراءة واستيراد ملف الإكسل:", error);
        alert("حدث خطأ أثناء معالجة الملف، يرجى التأكد من اختيار ملف إكسل مالي صحيح.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // 4. دالة مسح كافة البيانات لتنظيف الجدول وإعادته فارغاً
  const clearTable = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في مسح كافة الصفوف الحالية من الجدول؟")) {
      setExpenseData([]);
    }
  };

  // 5. تصفية صفوف الجدول بناءً على كلمة البحث المكتوبة
  const filteredData = expenseData.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-4 font-tajawal text-slate-800">
      
      {/* عنوان الواجهة الفرعية */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <FileSpreadsheet className="w-5 h-5 text-[#10528e]" />
        <h2 className="text-base font-bold text-[#0b3d6d] font-cairo">
          واجهة سجل مفردات الاستخدامات والنفقات العامة للمجلس
        </h2>
      </div>

      {/* لوحة التحكم: استيراد وبحث ومسح */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
        
        {/* مربع البحث الذكي */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث سريع في بيانات السجل المستورد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-[#10528e] focus:ring-1 focus:ring-[#10528e] transition-all"
          />
        </div>

        {/* أزرار العمليات (استيراد وإفراغ) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* زر الاستيراد المخفي برمجياً والمربوط بعنصر تحكم label جذاب */}
          <label className="flex items-center justify-center gap-1.5 bg-[#10528e] hover:bg-[#0b3d6d] text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>استيراد من إكسل</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* زر مسح البيانات الحالية */}
          {expenseData.length > 0 && (
            <button
              onClick={clearTable}
              className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs md:text-sm font-bold px-3 py-2 rounded-lg transition-all border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>إفراغ الجدول</span>
            </button>
          )}
        </div>
      </div>

      {/* منطقة عرض الشبكة والصفوف التفاعلية */}
      <div className="w-full overflow-x-auto border border-slate-200/80 rounded-xl shadow-sm bg-white">
        <table className="w-full text-right border-collapse text-xs md:text-sm">
          <thead>
            <tr className="bg-[#0b3d6d] text-white font-bold font-cairo border-b border-slate-200">
              {columns.map((col, index) => (
                <th key={index} className="p-3 whitespace-nowrap font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-slate-50/80 transition-colors odd:bg-slate-50/30"
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`p-3 whitespace-nowrap ${
                        col === "البيان" ? "font-medium text-slate-900" : "text-slate-600"
                      } ${col === "اعتماد السنة الحالية 2026" ? "font-bold text-emerald-700" : ""}`}
                    >
                      {/* عرض القيمة المالية، وإذا كانت رقماً يتم تنسيقها بشكل منسق */}
                      {col === "اعتماد السنة الحالية 2026" && typeof row[col] === "number"
                        ? row[col].toLocaleString("ar-YE")
                        : row[col]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-8 text-center text-slate-400 font-medium"
                >
                  الجدول فارغ حالياً، يرجى النقر على زر الاستيراد لرفع البيانات وتحديث الواجهة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* عداد الأسطر التوضيحي للنظام */}
      <div className="text-left text-[11px] text-slate-400 font-medium px-1">
        إجمالي عدد القيود المفتوحة: {filteredData.length} قيد مالي
      </div>
    </div>
  );
};

export default AppTabs;
