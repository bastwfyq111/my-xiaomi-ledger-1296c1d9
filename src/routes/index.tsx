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
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap" },
    ],
  }),
});

// تعريف الأنواع الصارمة للتبويبات
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
      toast.success("تم استيراد البيانات المكونة وتوليد المعرفات بنجاح!");
    } catch (error) {
      toast.error("فشل استيراد الملف، يرجى التأكد من مطابقة الأعمدة للهيكل المعتمد.");
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(fullState);
      toast.success("تم تصدير التقرير المالي الشامل إلى ملف Excel بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء محاولة تصدير البيانات");
    }
  };

  const handlePWAInstall = async () => {
    const success = await promptInstall();
    if (success) {
      toast.success("شكراً لك! يتم الآن تثبيت النظام على جهازك.");
      setPwaInstallable(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-gradient-to-b from-slate-50 to-slate-100/80 min-h-screen font-tajawal selection:bg-teal-500/20" dir="rtl">
      
      {/* القسم العلوي: الهيدر والأزرار السريعة بتصميم زجاجي فاخر */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-100/50 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/40">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-teal-600 to-cyan-700 rounded-2xl text-white shadow-lg shadow-teal-600/20 hidden sm:block">
            <FileSpreadsheet className="w-7 h-7 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight font-cairo bg-gradient-to-r from-slate-900 to-teal-950 bg-clip-text text-transparent">
              المجلس اليمني للاختصاصات الطبية
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              نظام الإدارة المالية الذكي والقيود اليومية المحاسبية • يعمل بدون إنترنت
            </p>
          </div>
        </div>

        {/* أزرار العمليات الحيوية بنمط عصري وموحد */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* زر تثبيت التطبيق PWA */}
          {pwaInstallable && (
            <button
              onClick={handlePWAInstall}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all duration-300 shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>تثبيت النظام على الجهاز</span>
            </button>
          )}

          {/* زر استيراد إكسل */}
          <label className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 font-bold text-xs px-5 py-3 rounded-xl cursor-pointer transition-all duration-300 shadow-sm hover:border-teal-500/30 hover:text-teal-700 hover:scale-[1.02] active:scale-[0.98]">
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
            className="flex items-center gap-2 bg-gradient-to-r from-teal-700 to-emerald-800 hover:from-teal-800 hover:to-emerald-900 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all duration-300 shadow-md shadow-teal-700/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>تصدير البيانات الشاملة</span>
          </button>
        </div>
      </div>

      {/* نظام التبويبات الفاخر */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full space-y-6">
        
        {/* شريط الخيارات مع إخفاء شريط التمرير مع الحفاظ على مرونته */}
        <div className="w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full lg:w-full bg-slate-200/70 p-1.5 rounded-2xl border border-slate-300/30 shadow-inner h-auto gap-1.5 backdrop-blur-sm">
            
            {[
              { id: "installments", label: "كشف الأقساط", icon: WalletCards },
              { id: "hafiza", label: "حوافظ التوريد", icon: FileBox },
              { id: "account", label: "الحساب الجاري", icon: FileSpreadsheet },
              { id: "journal", label: "قيود اليومية", icon: BookOpenText },
              { id: "monthly", label: "التقرير الشهري", icon: PieChart },
              { id: "revenue", label: "حركة الإيرادات", icon: TrendingUp },
              { id: "expenses-table", label: "بيان المصروفات", icon: ReceiptText },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 
                             data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-700 data-[state=active]:to-teal-800
                             data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-teal-700/20 
                             text-slate-600 hover:text-slate-900 hover:bg-white/60 data-[state=active]:hover:bg-teal-700 
                             flex-1 justify-center min-w-[130px] lg:min-w-0"
                >
                  <IconComponent className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}

          </TabsList>
        </div>

        {/* عرض محتويات التبويبات بحركة انسيابية ناعمة وجذابة */}
        <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-100/40 min-h-[450px] animate-in fade-in slide-in-from-bottom-4 duration-300 focus-visible:outline-none">
          <TabsContent value="installments" className="focus-visible:outline-none mt-0"><InstallmentsTab /></TabsContent>
          <TabsContent value="hafiza" className="focus-visible:outline-none mt-0"><HafizaTab /></TabsContent>
          <TabsContent value="account" className="focus-visible:outline-none mt-0"><AccountTab /></TabsContent>
          <TabsContent value="journal" className="focus-visible:outline-none mt-0"><JournalTab /></TabsContent>
          <TabsContent value="monthly" className="focus-visible:outline-none mt-0"><MonthlyStatementTab /></TabsContent>
          <TabsContent value="revenue" className="focus-visible:outline-none mt-0"><RevenueTab /></TabsContent>
          <TabsContent value="expenses-table" className="focus-visible:outline-none mt-0"><ExpensesTab /></TabsContent>
        </div>

      </Tabs>
      
      {/* نظام التنبيهات المنبثقة */}
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default Index;
