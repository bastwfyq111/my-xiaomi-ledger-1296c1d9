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
  Download,
  Upload,
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

// استيراد إدارة الحالة ووظائف الإكسيل والـ PWA
import { useStore } from "@/lib/store";
import { exportToExcel, importFromExcel } from "@/lib/exportImport";
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

  const importData = useStore((state) => state.importData);
  const fullState = useStore((state) => state);

  useEffect(() => {
    setPwaInstallable(canInstall());
    const unsubscribe = onInstallAvailability((available) => {
      setPwaInstallable(available);
    });
    return () => unsubscribe();
  }, []);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const loadingToast = toast.loading("جاري قراءة ومعالجة ملف الإكسل...");
      const data = await importFromExcel(file);
      importData(data);
      toast.dismiss(loadingToast);
      toast.success("تم استيراد البيانات بنجاح!");
    } catch (error) {
      toast.error("فشل استيراد الملف.");
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(fullState);
      toast.success("تم تصدير التقرير بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء التصدير");
    }
  };

  const handlePWAInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast.success("يتم الآن تثبيت النظام على جهازك.");
      setPwaInstallable(false);
    }
  };

  return (
    // تم تغيير الحاوية هنا من container إلى w-full وإلغاء البادينج الجانبي للهاتف لملء كامل عرض الشاشة
    <div className="w-full min-h-screen bg-[#f3f7fa] p-0 sm:p-4 md:p-6 space-y-4 sm:space-y-6 font-tajawal selection:bg-[#10528e]/20" dir="rtl">
      
      {/* قسم الهيدر العلوي: يمتد بالكامل من الحافة إلى الحافة في الهاتف (rounded-none في الشاشات الصغيرة) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-[#10528e] to-[#0b3d6d] p-5 sm:rounded-2xl border-b sm:border border-slate-200/40 shadow-md text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl text-white hidden sm:block">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg md:text-2xl font-bold tracking-wide font-cairo">
              المجلس اليمني للاختصاصات الطبية
            </h1>
            <p className="text-[11px] md:text-sm opacity-85 font-medium flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              نظام الإدارة المالية وحوافظ التوريد - صعدة • 2026م
            </p>
          </div>
        </div>

        {/* أزرار العمليات الحيوية: تأخذ حشوة خفيفة ومناسبة على أطراف شاشة الهاتف */}
        <div className="flex flex-wrap items-center gap-2 px-1 sm:px-0">
          {pwaInstallable && (
            <button
              onClick={handlePWAInstall}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] sm:text-xs px-3 py-2 rounded-lg transition-all shadow-sm"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>تثبيت النظام</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#10528e] border-2 border-[#10528e] font-bold text-[11px] sm:text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            <span>استيراد Excel</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] sm:text-xs px-3 py-2 rounded-lg transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* نظام التبويبات الرئيسي الممتد */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full space-y-3 sm:space-y-4">
        
        {/* شريط التبويبات: يلتصق بالحواف تماماً في الهاتف لمنحك أقصى مساحة تصفح ممكنة */}
        <div className="w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full bg-[#0b3d6d] p-0.5 sm:p-1 sm:rounded-xl shadow-md h-auto gap-0.5 sm:gap-1 rounded-none border-b border-white/10">
            
            {[
              { id: "installments", label: "كشف الأقساط", icon: WalletCards },       // 1. يظهر في أقصى اليمين
              { id: "hafiza", label: "حوافظ التوريد", icon: FileBox },              // 2. يليه ثانياً
              { id: "account", label: "الحساب الجاري", icon: FileSpreadsheet },       // 3. يليه ثالثاً
              { id: "journal", label: "القيود اليومية", icon: BookOpenText },          // 4. يليه رابعاً
              { id: "monthly", label: "كشف حساب شهري", icon: PieChart },          // 5. يليه خامساً
              { id: "revenue", label: "حركة الإيرادات", icon: TrendingUp },          // 6. يليه سادساً
              { id: "expenses-table", label: "جدول المصروفات", icon: ReceiptText },  // 7. يظهر في أقصى اليسار
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="flex items-center gap-1.5 px-3 py-3 sm:rounded-lg text-[11px] sm:text-xs font-bold transition-all border-b-2 border-transparent
                             data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-amber-400
                             text-white/70 hover:text-white hover:bg-white/5 rounded-none
                             flex-1 justify-center min-w-[115px] sm:min-w-[125px] lg:min-w-0"
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}

          </TabsList>
        </div>

        {/* وعاء عرض المحتوى الداخلي: ممتد بالكامل من الحافة إلى الحافة على شاشات الهاتف لتوفير مساحة قصوى للجداول */}
        <div className="w-full bg-white p-3 sm:p-5 md:p-6 sm:rounded-2xl border-y sm:border border-slate-200/60 shadow-sm min-h-[450px]">
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
