import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";

// استيراد الأيقونات الحديثة لتعزيز الواجهة التفاعلية
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

// استيراد مكونات التبويبات الأساسية من النظام
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// استيراد التبويبات الفرعية الخاصة بكل قسم مالي
import HafizaTab from "@/components/HafizaTab";
import AccountTab from "@/components/AccountTab";
import JournalTab from "@/components/JournalTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import MonthlyStatementTab from "@/components/MonthlyStatementTab";
import RevenueTab from "@/components/RevenueTab";
import ExpensesTab from "@/components/ExpensesTab"; 

// استيراد إدارة الحالة والوظائف المساعدة (الملفات المحلية)
import { useStore } from "@/lib/store";
import { exportToExcel, importFromExcel } from "@/lib/exportImport";
import { canInstall, onInstallAvailability, promptInstall } from "@/lib/pwa";

// إعداد مسار التوجيه (Route) والبيانات التعريفية للموقع (Meta Data)
export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "قيادة النظام المالي - المجلس اليمني للاختصاصات الطبية" },
      { name: "description", content: "تطبيق إدارة قيود اليومية وحوافظ التوريد للمجلس اليمني للاختصاصات الطبية - يعمل بدون إنترنت" },
      { name: "theme-color", content: "#0f766e" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2 family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap" },
    ],
  }),
});

// تعريف الأنواع الصارمة للتبويبات لضمان عدم حدوث أخطاء إملائية أثناء التنقل
type Tab = "installments" | "hafiza" | "account" | "journal" | "monthly" | "revenue" | "expenses-table";

function Index() {
  // الحالة الخاصة بالتبويب النشط حالياً
  const [activeTab, setActiveTab] = useState<Tab>("installments");
  
  // حالة تMemory للتحقق مما إذا كان التطبيق متاحاً للتثبيت كبرنامج مستقيل (PWA)
  const [pwaInstallable, setPwaInstallable] = useState<boolean>(false);

  // استدعاء دالة استيراد البيانات الآمنة التي قمنا بإصلاحها في الـ Store
  const importData = useStore((state) => state.importData);
  const fullState = useStore((state) => state);

  // مراقبة جاهزية التطبيق للتثبيت فور تشغيله
  useEffect(() => {
    // التحقق الأولي
    setPwaInstallable(canInstall());

    // الاشتراك في حدث توفر التثبيت لتحديث الواجهة تلقائياً
    const unsubscribe = onInstallAvailability((available) => {
      setPwaInstallable(available);
    });

    return () => unsubscribe();
  }, []);

  // دالة التعامل مع رفع ملف الإكسل وتحليله
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // تفجير إشعار انتظار للمستخدم لتعزيز تجربة الاستخدام
      const loadingToast = toast.loading("جاري قراءة ومعالجة ملف الإكسل...");
      
      // استدعاء الدالة المساعدة لتحويل الإكسل إلى كائن بيانات
      const data = await importFromExcel(file);
      
      // تمرير البيانات المصفاة إلى المخزن المصلح
      importData(data);
      
      toast.dismiss(loadingToast);
      toast.success("تم استيراد البيانات المكونة وتوليد المعرفات بنجاح!");
    } catch (error) {
      toast.error("فشل استيراد الملف، يرجى التأكد من مطابقة الأعمدة للهيكل المعتمد.");
    }
  };

  // دالة تصدير البيانات الشاملة إلى ملف إكسل بضغطة زر واحدة
  const handleExportExcel = () => {
    try {
      exportToExcel(fullState);
      toast.success("تم تصدير التقرير المالي الشامل إلى ملف Excel بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء محاولة تصدير البيانات");
    }
  };

  // دالة تشغيل تثبيت التطبيق على الجهاز
  const handlePWAInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast.success("شكراً لك! يتم الآن تثبيت النظام على جهازك.");
      setPwaInstallable(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen" dir="rtl">
      
      {/* القسم العلوي: الهيدر والأزرار السريعة بالتصميم الزجاجي العصري */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-teal-900 tracking-tight font-cairo">المجلس اليمني للاختصاصات الطبية</h1>
          <p className="text-sm text-slate-500 font-medium">نظام الإدارة المالية الذكي والقيود اليومية المحاسبية</p>
        </div>

        {/* أزرار العمليات الحيوية المستوردة */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* زر تثبيت التطبيق PWA - يظهر ديناميكياً فقط عند الحاجة */}
          {pwaInstallable && (
            <button
              onClick={handlePWAInstall}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-sm animate-pulse"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>تثبيت النظام على الجهاز</span>
            </button>
          )}

          {/* زر استيراد إكسل المخفي خلف تصميم زر عصري */}
          <label className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition shadow-sm">
            <Upload className="w-4 h-4 text-teal-600" />
            <span>استيراد ملف Excel</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleImportExcel} 
            />
          </label>

          {/* زر التصدير الفوري */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>تصدير البيانات الشاملة</span>
          </button>
        </div>
      </div>

      {/* نظام التبويبات الفاخر */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full">
        
        {/* شريط الخيارات مع خاصية التمرير الذكي للشاشات الصغيرة */}
        <div className="w-full overflow-x-auto pb-2 scrollbar-none">
          <TabsList className="flex w-max min-w-full md:w-full bg-slate-200/60 p-1.5 rounded-2xl border border-slate-300/40 shadow-inner h-auto gap-1">
            
            <TabsTrigger 
              value="installments" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <WalletCards className="w-4 h-4" />
              <span>كشف الأقساط</span>
            </TabsTrigger>

            <TabsTrigger 
              value="hafiza" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <FileBox className="w-4 h-4" />
              <span>حوافظ التوريد</span>
            </TabsTrigger>

            <TabsTrigger 
              value="account" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>الحساب الجاري</span>
            </TabsTrigger>

            <TabsTrigger 
              value="journal" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <BookOpenText className="w-4 h-4" />
              <span>قيود اليومية</span>
            </TabsTrigger>

            <TabsTrigger 
              value="monthly" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <PieChart className="w-4 h-4" />
              <span>التقرير الشهري</span>
            </TabsTrigger>

            <TabsTrigger 
              value="revenue" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <TrendingUp className="w-4 h-4" />
              <span>حركة الإيرادات</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="expenses-table" 
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 data-[state=active]:bg-teal-700 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 hover:bg-white/50"
            >
              <ReceiptText className="w-4 h-4" />
              <span>بيان المصروفات</span>
            </TabsTrigger>

          </TabsList>
        </div>

        {/* عرض محتويات التبويبات بحركة انسيابية ناعمة جدًا */}
        <div className="mt-6 bg-white p-4 md:p-6 rounded-2xl border border-slate-200/60 shadow-sm min-h-[400px] animate-in fade-in slide-in-from-bottom-3 duration-300">
          <TabsContent value="installments" className="focus-visible:outline-none"><InstallmentsTab /></TabsContent>
          <TabsContent value="hafiza" className="focus-visible:outline-none"><HafizaTab /></TabsContent>
          <TabsContent value="account" className="focus-visible:outline-none"><AccountTab /></TabsContent>
          <TabsContent value="journal" className="focus-visible:outline-none"><JournalTab /></TabsContent>
          <TabsContent value="monthly" className="focus-visible:outline-none"><MonthlyStatementTab /></TabsContent>
          <TabsContent value="revenue" className="focus-visible:outline-none"><RevenueTab /></TabsContent>
          <TabsContent value="expenses-table" className="focus-visible:outline-none"><ExpensesTab /></TabsContent>
        </div>

      </Tabs>
      
      {/* نظام التنبيهات المنبثقة العلوي */}
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default Index;
