import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";

// 1. استيراد الأيقونات التوضيحية لكل تبويب وزر في النظام
import { 
  WalletCards, 
  FileBox, 
  FileSpreadsheet, 
  BookOpenText, 
  PieChart, 
  TrendingUp, 
  ReceiptText,
  Download,
  Upload,
  DownloadCloud
} from "lucide-react";

// 2. استيراد مكونات التبويبات الجاهزة من مكتبة الشاشات UI
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// 3. استيراد الصفحات والملفات الفرعية لكل قسم محاسبي
import HafizaTab from "@/components/HafizaTab";
import AccountTab from "@/components/AccountTab";
import JournalTab from "@/components/JournalTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import MonthlyStatementTab from "@/components/MonthlyStatementTab";
import RevenueTab from "@/components/RevenueTab";
import ExpensesTab from "@/components/ExpensesTab"; 

// 4. استيراد مخزن البيانات المحتفظ به في ذاكرة التطبيق المحلية
import { useStore } from "@/lib/store";
import { exportToExcel, importFromExcel } from "@/lib/exportImport";
import { canInstall, onInstallAvailability, promptInstall } from "@/lib/pwa";

// إعداد مسار التوجيه ومعلومات الترويسة لمتصفحات الويب
export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "قيادة النظام المالي - المجلس اليمني للاختصاصات الطبية" },
      { name: "description", content: "تطبيق إدارة قيود اليومية وحوافظ التوريد للمجلس اليمني للاختصاصات الطبية - يعمل بدون إنترنت" },
      { name: "theme-color", content: "#10528e" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap" },
    ],
  }),
});

// تعريف دقيق للأنواع المقبولة للتبويبات لمنع الأخطاء الإملائية أثناء البرمجة
type Tab = "installments" | "hafiza" | "account" | "journal" | "monthly" | "revenue" | "expenses-table";

function Index() {
  // التبويب الافتراضي الذي يفتح عند تشغيل التطبيق هو "كشف الأقساط"
  const [activeTab, setActiveTab] = useState<Tab>("installments");
  const [pwaInstallable, setPwaInstallable] = useState<boolean>(false);

  const importData = useStore((state) => state.importData);
  const fullState = useStore((state) => state);

  // مراقبة جاهزية التطبيق للتثبيت على الهواتف والأجهزة الذكية
  useEffect(() => {
    setPwaInstallable(canInstall());
    const unsubscribe = onInstallAvailability((available) => {
      setPwaInstallable(available);
    });
    return () => unsubscribe();
  }, []);

  // دالة التعامل مع استيراد ملفات الإكسيل وتحويلها لبيانات مالية داخل النظام
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loadingToast = toast.loading("جاري قراءة ومعالجة ملف الإكسل...");
      const data = await importFromExcel(file);
      importData(data);
      toast.dismiss(loadingToast);
      toast.success("تم استيراد البيانات المكونة وتوليد المعرفات بنجاح!");
    } catch (error) {
      toast.error("فشل استيراد الملف، يرجى التأكد من مطابقة الأعمدة للهيكل المعتمد.");
    }
  };

  // دالة تصدير التقارير وجداول البيانات إلى ملف إكسيل خارجي
  const handleExportExcel = () => {
    try {
      exportToExcel(fullState);
      toast.success("تم تصدير التقرير المالي الشامل إلى ملف Excel بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء محاولة تصدير البيانات");
    }
  };

  // دالة تثبيت التطبيق كنظام مستقل يعمل بدون متصفح وبدون إنترنت
  const handlePWAInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast.success("شكراً لك! يتم الآن تثبيت النظام على جهازك.");
      setPwaInstallable(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 bg-[#f3f7fa] min-h-screen font-tajawal selection:bg-[#10528e]/20" dir="rtl">
      
      {/* هيدر النظام المالي بالألوان الزرقاء الملكية المستوحاة من الصورة */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 bg-gradient-to-r from-[#10528e] to-[#0b3d6d] p-6 rounded-2xl border border-slate-200/40 shadow-md text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl text-white hidden sm:block">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl md:text-2xl font-bold tracking-wide font-cairo">
              المجلس اليمني للاختصاصات الطبية
            </h1>
            <p className="text-xs opacity-85 font-medium flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              نظام الإدارة المالية وحوافظ التوريد - صعدة • 2026م
            </p>
          </div>
        </div>

        {/* أزرار العمليات (التثبيت، الاستيراد، التصدير) بتصميم مستدير الحواف ومتناسق */}
        <div className="flex flex-wrap items-center gap-2">
          {pwaInstallable && (
            <button
              onClick={handlePWAInstall}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>تثبيت النظام على الهاتف</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#10528e] border-2 border-[#10528e] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-sm">
            <Upload className="w-4 h-4" />
            <span>استيراد ملف Excel</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>تصدير ملف Excel</span>
          </button>
        </div>
      </div>

      {/* نظام ومكونات التبويبات الفاخر */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full space-y-4">
        
        {/* شريط الخيارات والتبويبات مرتب ترتيباً دقيقاً حسب طلبك */}
        <div className="w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full lg:w-full bg-[#0b3d6d] p-1 rounded-xl border border-white/10 shadow-md h-auto gap-1">
            
            {[
              { id: "installments", label: "كشف الأقساط", icon: WalletCards },       // 1. أقساط
              { id: "hafiza", label: "حوافظ التوريد", icon: FileBox },              // 2. حوافظ التوريد
              { id: "account", label: "الحساب الجاري", icon: FileSpreadsheet },       // 3. الحساب اليومي
              { id: "journal", label: "القيود اليومية", icon: BookOpenText },          // 4. القيود اليومية
              { id: "monthly", label: "كشف حساب شهري", icon: PieChart },          // 5. كشف حساب شهري
              { id: "revenue", label: "حركة الإيرادات", icon: TrendingUp },          // 6. الإيرادات
              { id: "expenses-table", label: "جدول المصروفات", icon: ReceiptText },  // 7. جدول المصروفات
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-xs font-bold transition-all border-b-2 border-transparent
                             data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400
                             text-white/70 hover:text-white hover:bg-white/5 
                             flex-1 justify-center min-w-[125px] lg:min-w-0"
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}

          </TabsList>
        </div>

        {/* الحاوية البيضاء المستديرة لعرض محتويات الصفحة الفعالة */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/60 shadow-sm min-h-[450px]">
          {/* تم ترتيب عرض المكونات هنا ليتزامن ويتطابق تماماً مع الاختيار العلوي */}
          <TabsContent value="installments" className="focus-visible:outline-none mt-0"><InstallmentsTab /></TabsContent>
          <TabsContent value="hafiza" className="focus-visible:outline-none mt-0"><HafizaTab /></TabsContent>
          <TabsContent value="account" className="focus-visible:outline-none mt-0"><AccountTab /></TabsContent>
          <TabsContent value="journal" className="focus-visible:outline-none mt-0"><JournalTab /></TabsContent>
          <TabsContent value="monthly" className="focus-visible:outline-none mt-0"><MonthlyStatementTab /></TabsContent>
          <TabsContent value="revenue" className="focus-visible:outline-none mt-0"><RevenueTab /></TabsContent>
          <TabsContent value="expenses-table" className="focus-visible:outline-none mt-0"><ExpensesTab /></TabsContent>
        </div>

      </Tabs>
      
      {/* نظام رسائل النجاح والخطأ المنبثقة */}
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default Index;
