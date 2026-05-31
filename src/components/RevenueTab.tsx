import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { TrendingUp, Calendar, DollarSign } from "lucide-react";

export default function RevenueTab() {
  // 1. استدعاء البيانات والوظائف من المخزن (Store)
  const revenue = useStore((state) => state.revenue);
  const setRevenue = useStore((state) => state.setRevenue);

  // 2. حالات التحكم المحلية (Local States) لفلترة وتحديد التاريخ
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(1); // يناير كمثال أولي

  // قائمة بنود الإيرادات المعتمدة في المجلس اليمني
  const revenueItems = [
    { key: "tuition", label: "رسوم المقاعد الدراسية" },
    { key: "exams", label: "رسوم الامتحانات" },
    { key: "certificates", label: "رسوم استخراج الشهادات" },
    { key: "others", label: "إيرادات أخرى متنوعة" },
  ];

  // دالة التعامل مع تحديث مبالغ الإيرادات وتخزينها كأرقام
  const handleAmountChange = (itemKey: string, value: string) => {
    const numValue = Number(value) || 0;
    setRevenue(selectedYear, selectedMonth, itemKey, numValue);
  };

  return (
    // الحاوية الرئيسية: تم ضبطها لتكون مرنة بالكامل من اليمين إلى اليسار وتستغل 100% من الشاشة
    <div className="w-full space-y-6 text-right" dir="rtl">
      
      {/* بطاقة العناوين والتحكم بالتاريخ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
        
        {/* اختيار السنة المالية */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-teal-600" />
            <span>السنة المالية</span>
          </label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-semibold focus:outline-none focus:border-teal-500 transition-all"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* اختيار الشهر */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-teal-600" />
            <span>الشهر المحاسبي</span>
          </label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-semibold focus:outline-none focus:border-teal-500 transition-all"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>الشهر ({m})</option>
            ))}
          </select>
        </div>

      </div>

      {/* جدول وفورم إدخال بنود الإيرادات المتجاوب */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-teal-50 to-transparent border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-700" />
          <h3 className="font-bold text-sm text-slate-800">تفاصيل حركة الإيرادات للشهر المحدد</h3>
        </div>

        {/* كلاس الحماية للهواتف: يمنع الضيق ويسمح بالتمرير الأفقي الذكي فقط عند الحاجة */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[500px] text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-500">
                <th className="p-4">بند الإيراد</th>
                <th className="p-4 w-1/3">المبلغ المورد (ريال)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {revenueItems.map((item) => {
                // استخراج القيمة الحالية من المخزن بناءً على المفتاح المركب
                const storageKey = `${selectedYear}-${selectedMonth}-${item.key}`;
                const currentAmount = revenue[storageKey] || "";

                return (
                  <tr key={item.key} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm font-semibold text-slate-700">
                      {item.label}
                    </td>
                    <td className="p-4">
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={currentAmount}
                          onChange={(e) => handleAmountChange(item.key, e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-sm font-bold bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:outline-none transition-all text-left"
                        />
                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-3" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
