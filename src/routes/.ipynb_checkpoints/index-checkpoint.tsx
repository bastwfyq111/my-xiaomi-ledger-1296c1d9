import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import HafizaTab from "@/components/HafizaTab";
import AccountTab from "@/components/AccountTab";
import JournalTab from "@/components/JournalTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import MonthlyStatementTab from "@/components/MonthlyStatementTab";
import RevenueTab from "@/components/RevenueTab";
import CustomTab from "@/components/CustomTab";
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

type Tab = "installments" | "hafiza" | "account" | "journal" | "monthly" | "revenue" | string;

function Index() {
  const [tab, setTab] = useState<Tab>("installments");
  const fileRef = useRef<HTMLInputElement>(null);
  const store = useStore();
  const customTabs = useStore((s) => s.customTabs);
  const [installable, setInstallable] = useState(false);
  useEffect(() => {
    setInstallable(canInstall());
    return onInstallAvailability(setInstallable);
  }, []);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = await importFromExcel(f);
      store.importData(data);
      toast.success(
        `استيراد: ${data.hafiza.length} حافظة، ${data.accounts.length} حساب، ${data.journal.length} قيد، ${data.installments.length} قسط`,
      );
    } catch (err) {
      toast.error("فشل استيراد الملف");
      console.error(err);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const onExport = () =>
    exportToExcel({
      hafiza: store.hafiza,
      accounts: store.accounts,
      journal: store.journal,
      installments: store.installments,
      openingBalance: store.openingBalance,
    });

  const onClear = () => {
    const labels: Record<string, string> = {
      hafiza: "الحوافظ", accounts: "الحساب", journal: "اليومية",
      installments: "الأقساط", revenue: "الإيرادات", all: "كل البيانات",
    };
    const map: Record<string, string> = { installments: "installments", hafiza: "hafiza", account: "accounts", journal: "journal", revenue: "revenue", monthly: "all" };
    const target = map[tab] || tab;
    const ct = customTabs.find((t) => t.id === target);
    const label = ct ? ct.name : labels[target] || "هذا التبويب";
    if (confirm(`سيتم حذف بيانات ${label} فقط. متابعة؟`)) {
      store.clearTab(target);
      toast.success(`تم مسح ${label}`);
    }
  };

  const addNewTab = () => {
    const name = prompt("اسم التبويب الجديد:", "تبويب جديد");
    if (!name) return;
    const t = store.addCustomTab(name);
    setTab(t.id);
    toast.success("تمت إضافة التبويب");
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <Toaster position="top-center" richColors />
      <header className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground shadow-md no-print sticky top-0 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 safe-pad-x">
          <h1 className="text-xl md:text-2xl font-bold text-center">المجلس اليمني للاختصاصات الطبية - صعدة</h1>
          <p className="text-center text-xs md:text-sm opacity-90 mt-1">قيود اليومية العامة وحوافظ التوريد - 2026م</p>
        </div>
        <nav className="bg-primary/95 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-2 flex overflow-x-auto md:overflow-visible scrollbar-thin snap-x snap-mandatory">
            {([
              ["installments", "الأقساط", "الأقساط 2026"],
              ["hafiza", "الحوافظ", "حوافظ التوريد"],
              ["account", "الحساب", "الحساب"],
              ["journal", "اليومية", "اليومية العامة"],
              ["monthly", "كشف شهري", "كشف الحساب الشهري"],
              ["revenue", "الإيرادات", "الإيرادات الشهرية"],
            ] as [Tab, string, string][]).map(([k, shortL, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-shrink-0 md:flex-1 snap-start px-3 py-3 text-sm md:text-base font-semibold whitespace-nowrap transition border-b-2 ${
                  tab === k ? "border-accent text-accent bg-white/5" : "border-transparent text-white/80 hover:bg-white/5"
                }`}
              >
                <span className="md:hidden">{shortL}</span>
                <span className="hidden md:inline">{l}</span>
              </button>
            ))}
            {customTabs.map((ct) => (
              <button
                key={ct.id}
                onClick={() => setTab(ct.id)}
                className={`flex-shrink-0 snap-start px-3 py-3 text-sm md:text-base font-semibold whitespace-nowrap transition border-b-2 ${
                  tab === ct.id ? "border-accent text-accent bg-white/5" : "border-transparent text-white/80 hover:bg-white/5"
                }`}
              >
                {ct.name}
              </button>
            ))}
            <button
              onClick={addNewTab}
              title="إضافة تبويب جديد"
              className="flex-shrink-0 snap-start px-4 py-3 text-lg font-bold text-white/80 hover:bg-white/10"
            >+</button>
          </div>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 no-print safe-pad-x" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4 sm:justify-end">
          {installable && (
            <button
              onClick={async () => { await promptInstall(); setInstallable(canInstall()); }}
              className="col-span-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90"
            >
              تثبيت التطبيق
            </button>
          )}
          <button onClick={onExport} className="px-3 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-semibold hover:opacity-90">
            تصدير Excel
          </button>
          <label className="px-3 py-2.5 border-2 border-primary text-primary rounded-lg text-sm font-semibold cursor-pointer hover:bg-primary/5 text-center">
            استيراد Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onImport} className="hidden" />
          </label>
          <button onClick={onClear} className="col-span-2 sm:col-span-1 px-3 py-2.5 border border-destructive text-destructive rounded-lg text-sm font-semibold hover:bg-destructive/5">
            مسح بيانات هذا التبويب
          </button>
        </div>

        {tab === "installments" && <InstallmentsTab />}
        {tab === "hafiza" && <HafizaTab />}
        {tab === "account" && <AccountTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "monthly" && <MonthlyStatementTab />}
        {tab === "revenue" && <RevenueTab />}
        {customTabs.find((ct) => ct.id === tab) && <CustomTab tabId={tab} />}
      </div>
    </div>
  );
}
