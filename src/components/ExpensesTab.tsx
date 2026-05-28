import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// تعريف نوع البيانات لكل سطر في الجدول لضمان سلامة كود TypeScript
interface BudgetRow {
  id: string;
  bab?: string;    // الباب
  band?: string;   // البند
  type?: string;   // النوع
  statement: string; // البيان / مفردات الاستخدامات
  currentMonthFals?: number; // الشهر الجاري - فلس
  currentMonthRiyal?: number; // الشهر الجاري - ريال
  totalMonthsFals?: number;  // إجمالي الأشهر السابقة - فلس
  totalMonthsRiyal?: number; // إجمالي الأشهر السابقة - ريال
  rowType: "header" | "bab-title" | "band-title" | "normal" | "total"; // نوع السطر للتحكم باللون
}

export default function ExpensesTab() {
  // البيانات والكلمات مأخوذة بدقة من الصور المرفقة
  const budgetData: BudgetRow[] = [
    { id: "1", statement: "إجمالي الاستخدامات", rowType: "header" },
    
    // الباب الأول
    { id: "2", bab: "1", statement: "أجور وتعويضات العاملين", rowType: "bab-title" },
    { id: "3", bab: "1", band: "1", statement: "المرتبات والأجور وما في حكمها", rowType: "band-title" },
    { id: "4", bab: "1", band: "1", type: "1", statement: "المرتبات الأساسية", rowType: "normal" },
    { id: "5", bab: "1", band: "1", type: "2", statement: "نفقات والأجور التعاقدية والمؤقتة", rowType: "normal" },
    { id: "6", bab: "1", band: "1", type: "3", statement: "أجور تعاقدية ومؤقتة", rowType: "normal" },
    { id: "7", bab: "1", band: "1", type: "5", statement: "المكافآت وأجور العمل الإضافي", rowType: "normal" },
    { id: "8", bab: "1", band: "1", type: "4", statement: "البدلات (بدل طبيعة عمل، مظهر، ريف، سكن...)", rowType: "normal" },
    
    // المساهمات الاجتماعية
    { id: "9", bab: "1", band: "2", statement: "المساهمات الاجتماعية (ضمان اجتماعي ورعاية)", rowType: "band-title" },
    
    // الباب الثاني
    { id: "10", bab: "2", statement: "نفقات السلع والخدمات والممتلكات", rowType: "bab-title" },
    { id: "11", bab: "2", band: "1", statement: "السلع والخدمات", rowType: "band-title" },
    { id: "12", bab: "2", band: "1", type: "1", statement: "خدمات المرافق (مياه، إنارة)", rowType: "normal" },
    { id: "13", bab: "2", band: "1", type: "2", statement: "مستلزمات المكاتب (أدوات كتابية ومطبوعات)", rowType: "normal" },
    { id: "14", bab: "2", band: "1", type: "3", statement: "الاتصالات والبريد ونشر وإعلان", rowType: "normal" },
    { id: "15", bab: "2", band: "1", type: "4", statement: "الضيافة، المؤتمرات، والاحتفالات", rowType: "normal" },
    { id: "16", bab: "2", band: "1", type: "5", statement: "نقل ومهمات وانتقالات عامة", rowType: "normal" },
    { id: "17", bab: "2", band: "1", type: "6", statement: "إيجارات الأصول المنتجة (إيجار المباني)", rowType: "normal" },
    
    // الصيانة
    { id: "18", bab: "2", band: "2", statement: "الصيانة (مباني، طرق، وسائط نقل، أجهزة)", rowType: "band-title" },
    
    // الإجماليات في أسفل الصورة الأولى
    { id: "19", statement: "جملة الباب الأول: أجور وتعويضات العاملين", rowType: "total" },
    { id: "20", statement: "جملة الباب الثاني: نفقات على السلع والخدمات والممتلكات", rowType: "total" },
    { id: "21", statement: "اجمالي عام الاستخدامات", rowType: "header" },
  ];

  // دالة برمجية فرعية لتحديد تلوين السطر بناءً على نوعه تماماً مثل الصور
  const getRowClass = (type: string) => {
    switch (type) {
      case "header":
        return "bg-teal-700 text-white font-bold text-center";
      case "bab-title":
        return "bg-green-200 text-teal-900 font-bold";
      case "band-title":
        return "bg-yellow-100 text-amber-950 font-semibold";
      case "total":
        return "bg-slate-200 font-bold border-t-2 border-b-2 border-slate-400";
      default:
        return "bg-white hover:bg-slate-50";
    }
  };

  return (
    <div className="w-full space-y-4 p-4 bg-slate-50 rounded-xl shadow-inner" dir="rtl">
      
      {/* ترويسة الجدول العلوية */}
      <div className="text-center bg-teal-800 text-white p-3 rounded-t-lg shadow">
        <h2 className="text-lg font-bold">جدول المصروفات... للعام 2025م</h2>
        <p className="text-sm opacity-90">كشف الحساب الشهري - عن شهر يناير من العام المالي</p>
        <span className="text-xs bg-teal-600 px-2 py-0.5 rounded mt-1 inline-block">الاختصاصات الطبية فرع - صعدة</span>
      </div>

      {/* حاوية الجدول مع ميزة التمرير الأفقي للشاشات الصغيرة */}
      <div className="overflow-x-auto border rounded-b-lg shadow-sm bg-white">
        <Table className="w-full text-sm text-right border-collapse">
          <TableHeader className="bg-slate-100 text-slate-700 font-bold">
            <TableRow className="border-b-2 border-slate-300">
              <TableHead className="w-12 text-center border-l">الباب</TableHead>
              <TableHead className="w-12 text-center border-l">البند</TableHead>
              <TableHead className="w-12 text-center border-l">النوع</TableHead>
              <TableHead className="text-right font-bold text-slate-900 border-l min-w-[250px]">مفردات الاستخدامات</TableHead>
              <TableHead colSpan={2} className="text-center border-l bg-slate-200/50">الشهر الجاري</TableHead>
              <TableHead colSpan={2} className="text-center bg-slate-200/50">الأشهر السابقة</TableHead>
            </TableRow>
            <TableRow className="bg-slate-50 text-xs text-center border-b">
              <TableHead colSpan={4} className="border-l"></TableHead>
              <TableHead className="border-l text-center font-medium">ريال</TableHead>
              <TableHead className="border-l text-center font-medium">فلس</TableHead>
              <TableHead className="border-l text-center font-medium">ريال</TableHead>
              <TableHead className="text-center font-medium">فلس</TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {budgetData.map((row) => (
              <TableRow key={row.id} className={`${getRowClass(row.rowType)} border-b transition-colors`}>
                <TableCell className="text-center font-mono border-l">{row.bab || ""}</TableCell>
                <TableCell className="text-center font-mono border-l">{row.band || ""}</TableCell>
                <TableCell className="text-center font-mono border-l">{row.type || ""}</TableCell>
                <TableCell className="font-medium px-4 py-2 border-l">{row.statement}</TableCell>
                
                {/* حقول المبالغ المالية (تظهر 0 كقيمة افتراضية ممتلئة تماماً مثل كشف الحساب بالصور) */}
                <TableCell className="text-center font-mono border-l text-slate-600">0</TableCell>
                <TableCell className="text-center font-mono border-l text-slate-400">0</TableCell>
                <TableCell className="text-center font-mono border-l text-slate-600">0</TableCell>
                <TableCell className="text-center font-mono text-slate-400">0</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
