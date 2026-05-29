import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";

// استيراد أيقونات حديثة لتعزيز شكل التبويبات
import { 
  WalletCards, 
  FileBox, 
  FileSpreadsheet, 
  BookOpenText, 
  PieChart, 
  TrendingUp, 
  ReceiptText 
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import HafizaTab from "@/components/HafizaTab";
import AccountTab from "@/components/AccountTab";
import JournalTab from "@/components/JournalTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import MonthlyStatementTab from "@/components/MonthlyStatementTab";
import RevenueTab from "@/components/RevenueTab";
import ExpensesTab from "@/components/ExpensesTab"; 

import { useStore } from "@/lib/store";
import { exportToExcel, importFromExcel } from "@/lib/exportImport";
import { canInstall, onInstallAvailability, promptInstall } from "@/lib/pwa";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "قيود اليومية - المجلس اليمني للاختصاصات الطبية" },
      { name: "description", content: "تطبيق إدارة قيود اليومية وحوافظ التوريد للمجلس اليمني للاختصاصات الطبية - يعمل بدون إنترنت" },
      { name: "theme-color", content: "#0f766e" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&family=JetBrains+Mono:wght@500;600&display=swap" },
    ],
  }),
});

type Tab = "installments" | "hafiza" | "account" | "journal" | "monthly" | "revenue" | "Expenses" | "expenses-table";

function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("installments");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8" dir="ltr">
      
      {/* عنوان الصفحة الترحيبي (إضافة لمسة جمالية) */}
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold text-teal-800">النظام المالي الشامل</h1>
        <p className="text-sm text-slate-500">اختر القسم الذي تريد إدارته من القائمة أدناه</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full">
        
        {/* شريط التبويبات بتصميم حديث:
          - flex و overflow-x-auto: للتمرير في الشاشات الصغيرة
          - bg-slate-100/70 و backdrop-blur: تأثير زجاجي حديث
          - p-1.5 و rounded-2xl: حواف دائرية أنيقة
        */}
        <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <TabsList className="flex w-max min-w-full md:w-full bg-slate-100/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm h-auto gap-1">
            
            <TabsTrigger 
              value="installments" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <WalletCards className="w-4 h-4" />
              <span>الأقساط</span>
            </TabsTrigger>

            <TabsTrigger 
              value="hafiza" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <FileBox className="w-4 h-4" />
              <span>الحافظة</span>
            </TabsTrigger>

            <TabsTrigger 
              value="account" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>الكشف</span>
            </TabsTrigger>

            <TabsTrigger 
              value="journal" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <BookOpenText className="w-4 h-4" />
              <span>القيود</span>
            </TabsTrigger>

            <TabsTrigger 
              value="monthly" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <PieChart className="w-4 h-4" />
              <span>التقرير الشهري</span>
            </TabsTrigger>

            <TabsTrigger 
              value="revenue" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <TrendingUp className="w-4 h-4" />
              <span>الإيرادات</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="expenses-table" 
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/50"
            >
              <ReceiptText className="w-4 h-4" />
              <span>جدول المصروفات</span>
            </TabsTrigger>

          </TabsList>
        </div>

        {/* إضافة حركة دخول ناعمة (Fade-in) لمحتوى التبويبات */}
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <TabsContent value="installments"><InstallmentsTab /></TabsContent>
          <TabsContent value="hafiza"><HafizaTab /></TabsContent>
          <TabsContent value="account"><AccountTab /></TabsContent>
          <TabsContent value="journal"><JournalTab /></TabsContent>
          <TabsContent value="monthly"><MonthlyStatementTab /></TabsContent>
          <TabsContent value="revenue"><RevenueTab /></TabsContent>
          <TabsContent value="expenses-table"><ExpensesTab /></TabsContent>
        </div>

      </Tabs>
      <Toaster position="top-center" />
    </div>
  );
}

export default Index;
