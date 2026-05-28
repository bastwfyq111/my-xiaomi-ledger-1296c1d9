import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";

// التعديل الضروري 1: استيراد مكونات التبويبات (Tabs) لكي يعمل التطبيق ولا يتوقف
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import HafizaTab from "@/components/HafizaTab";
import AccountTab from "@/components/AccountTab";
import JournalTab from "@/components/JournalTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import MonthlyStatementTab from "@/components/MonthlyStatementTab";
import RevenueTab from "@/components/RevenueTab";

// استيراد ملف تبويب المصروفات المتواجد في مشروعك
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

// معرفات التبويبات المسموحة في نظام TypeScript لضمان عدم حدوث أخطاء توافقية
type Tab = "installments" | "hafiza" | "account" | "journal" | "monthly" | "revenue" | "Expenses" | "expenses-table";

function Index() {
  // حالة (State) لتتبع التبويب النشط حالياً
  const [activeTab, setActiveTab] = useState<Tab>("installments");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" dir="rtl">
      
      {/* الحاوية الرئيسية للتبويبات، ترتبط بالحالة activeTab وتقوم بتحديثها عند التغيير */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full">
        
        {/* شريط أزرار التبويبات العلوية */}
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-2">
          <TabsTrigger value="installments">الأقساط</TabsTrigger>
          <TabsTrigger value="hafiza">الحافظة</TabsTrigger>
          <TabsTrigger value="account">الكشف</TabsTrigger>
          <TabsTrigger value="journal">القيود</TabsTrigger>
          <TabsTrigger value="monthly">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="revenue">الإيرادات</TabsTrigger>
          
          {/* تبويب جدول المصروفات الجديد */}
          <TabsTrigger value="expenses-table">جدول المصروفات</TabsTrigger>
        </TabsList>

        {/* محتويات التبويبات الحالية والجديدة */}
        <TabsContent value="installments" className="mt-4"><InstallmentsTab /></TabsContent>
        <TabsContent value="hafiza" className="mt-4"><HafizaTab /></TabsContent>
        <TabsContent value="account" className="mt-4"><AccountTab /></TabsContent>
        <TabsContent value="journal" className="mt-4"><JournalTab /></TabsContent>
        <TabsContent value="monthly" className="mt-4"><MonthlyStatementTab /></TabsContent>
        <TabsContent value="revenue" className="mt-4"><RevenueTab /></TabsContent>

        {/* عرض ملف ExpensesTab المتاح لديك عند الضغط عليه */}
        <TabsContent value="expenses-table" className="mt-4">
          <ExpensesTab />
        </TabsContent>

      </Tabs>
      <Toaster position="top-center" />
    </div>
  );
}

// التعديل الضروري 2: تصدير المكون بشكل افتراضي ليتوافق مع نظام تتبع المسارات الـ Router
export default Index;
