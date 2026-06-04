import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";

// استيراد الأيقونات التوضيحية لكل تبويب في النظام المالي
import { 
  WalletCards, 
  FileBox, 
  FileSpreadsheet, 
  BookOpenText, 
  PieChart, 
  TrendingUp, 
  ReceiptText,
  DownloadCloud
} from "lucide-react";

// استيراد مكونات التبويبات من مكتبة الواجهات UI
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// استيراد ملفات التبويبات الفرعية المكونة للنظام
import HafizaTab from "@/components/HafizaTab";
import AccountTab from "@/components/AccountTab";
import JournalTab from "@/components/JournalTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import MonthlyStatementTab from "@/components/MonthlyStatementTab";
import RevenueTab from "@/components/RevenueTab";
import ExpensesTab from "@/components/ExpensesTab"; 

// استيراد وظائف الـ PWA
import { canInstall, onInstallAvailability, promptInstall } from "@/lib/pwa";

// إعداد مسار التوجيه والبيانات التعريفية للمتصفح
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

type Tab = "installments" | "hafiza" | "account" | "journal" | "monthly" | "revenue" | "expenses-table";

function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("installments");
  const [pwaInstallable, setPwaInstallable] = useState<boolean>(false);

  useEffect(() => {
    setPwaInstallable(canInstall());
    const unsubscribe = onInstallAvailability((available) => {
      setPwaInstallable(available);
    });
    return () => unsubscribe();
  }, []);

  const handlePWAInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast.success("يتم الآن تثبيت النظام على جهازك.");
      setPwaInstallable(false);
    }
  };

  return (
    // الحاوية الرئيسية ممتدة بالكامل من الحافة إلى الحافة وباتجاه عربي أصيل (RTL)
    <div className="w-full min-h-screen bg-[#f3f7fa] p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-6 font-tajawal selection:bg-[#10528e]/20 text-sm sm:text-base" dir="rtl">
      
      {/* قسم الهيدر العلوي والأزرار السريعة بالألوان الزرقاء الملكية */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-gradient-to-r from-[#10528e] to-[#0b3d6d] p-3 sm:p-5 sm:rounded-2xl border-b sm:border border-slate-200/40 shadow-md text-white">
        
        {/* الجزء الأيمن: الأيقونة، العنوان، والوصف */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 bg-white/10 rounded-xl text-white hidden sm:block">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-base sm:text-lg md:text-2xl font-bold tracking-wide font-cairo">
              المجلس اليمني للاختصاصات الطبية
            </h1>
            <p className="text-[10px] sm:text-xs md:text-sm opacity-85 font-medium flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              نظام الإدارة المالية وحوافظ التوريد - صعدة • 2026م
            </p>
          </div>
        </div>

        {/* الجزء الأيسر: زر التثبيت PWA */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-1 sm:px-0">
          {pwaInstallable && (
            <button
              onClick={handlePWAInstall}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all shadow-sm"
            >
              <DownloadCloud className="w-3 h-3" />
              <span>تثبيت</span>
            </button>
          )}
        </div>
      </div>

      {/* نظام التبويبات الرئيسي الممتد */}
      <Tabs dir="rtl" value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full space-y-3 sm:space-y-4">
        
        {/* شريط التبويبات: تم تحسين الحجم والمسافات لتناسب شاشات الهواتف الذكية (مثل شاومي وأندرويد) */}
        <div className="w-full overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full bg-[#0b3d6d] p-1 sm:p-1.5 sm:rounded-xl shadow-md h-auto gap-1.5 sm:gap-2 rounded-none border-b border-white/10 justify-start">
            
            {/* 1. الأقساط (في أول اليمين) */}
            <TabsTrigger 
              value="installments" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <WalletCards className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">كشف الأقساط</span>
              <span className="sm:hidden">أقساط</span>
            </TabsTrigger>

            {/* 2. حوافظ التوريد */}
            <TabsTrigger 
              value="hafiza" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <FileBox className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">حوافظ التوريد</span>
              <span className="sm:hidden">حوافظ</span>
            </TabsTrigger>

            {/* 3. الحساب الجاري */}
            <TabsTrigger 
              value="account" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">الحساب الجاري</span>
              <span className="sm:hidden">حساب</span>
            </TabsTrigger>

            {/* 4. القيود اليومية */}
            <TabsTrigger 
              value="journal" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <BookOpenText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">القيود اليومية</span>
              <span className="sm:hidden">قيود</span>
            </TabsTrigger>

            {/* 5. كشف حساب شهري */}
            <TabsTrigger 
              value="monthly" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">كشف حساب شهري</span>
              <span className="sm:hidden">شهري</span>
            </TabsTrigger>

            {/* 6. حركة الإيرادات */}
            <TabsTrigger 
              value="revenue" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">حركة الإيرادات</span>
              <span className="sm:hidden">إيرادات</span>
            </TabsTrigger>

            {/* 7. جدول المصروفات (في أقصى اليسار) */}
            <TabsTrigger 
              value="expenses-table" 
              className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all border-b-2 border-transparent data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400 text-white/70 hover:text-white hover:bg-white/5 rounded-none flex-1 justify-center min-w-max"
            >
              <ReceiptText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">جدول المصروفات</span>
              <span className="sm:hidden">مصروفات</span>
            </TabsTrigger>

          </TabsList>
        </div>

        {/* وعاء عرض المحتوى الداخلي الممتد بالكامل من الحافة إلى الحافة */}
        <div className="w-full bg-white p-2 sm:p-4 md:p-6 sm:rounded-2xl border-y sm:border border-slate-200/60 shadow-sm min-h-[450px]">
          <TabsContent value="installments" className="focus-visible:outline-none mt-0"><InstallmentsTab /></TabsContent>
          <TabsContent value="hafiza" className="focus-visible:outline-none mt-0"><HafizaTab /></TabsContent>
          <TabsContent value="account" className="focus-visible:outline-none mt-0"><AccountTab /></TabsContent>
          <TabsContent value="journal" className="focus-visible:outline-none mt-0"><JournalTab /></TabsContent>
          <TabsContent value="monthly" className="focus-visible:outline-none mt-0"><MonthlyStatementTab /></TabsContent>
          <TabsContent value="revenue" className="focus-visible:outline-none mt-0"><RevenueTab /></TabsContent>
          <TabsContent value="expenses-table" className="focus-visible:outline-none mt-0"><ExpensesTab /></TabsContent>
        </div>

      </Tabs>
      
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default Index;
