import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import schema from "@/data/monthlyStatement.json";
import { exportMonthlyStatement } from "@/lib/exportImport";
import { monthlyStatementPdf } from "@/lib/exportPdf";
import { AlertOctagon, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import ImportButton from "./ImportButton";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type Group = { title: string; accounts: string[] };
const GROUPS = schema.groups as Group[];
const ALL_ACCOUNTS = GROUPS.flatMap((g) => g.accounts);

// تكييف الأسماء العربية لضمان مطابقة الحسابات بالرغم من اختلاف طريقة الكتابة
const norm = (s: string) => {
  if (!s) return "";
  return s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/[\u0649\u064A]/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u062D\s*\/\s*/g, "\u062D\u0633\u0627\u0628 ")
    .replace(/[()\[\]./\\،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// إزالة الكلمات العامة لمقارنة أكثر مرونة ومطابقة ملف الإكسل
const STOP_WORDS = new Set(["حساب", "حسابات", "ح", "محلية", "محليه", "عامة", "عامه"]);
const tokens = (s: string) =>
  norm(s).split(" ").filter((w) => w && !STOP_WORDS.has(w));

const ALL_NORM = ALL_ACCOUNTS.map((a) => ({ name: a, norm: norm(a), toks: tokens(a) }));

const matchAccount = (raw: string): string | null => {
  if (!raw) return null;
  const n = norm(raw);
  if (!n) return null;
  
  const exact = ALL_NORM.find((a) => a.norm === n);
  if (exact) return exact.name;
  
  const contains = ALL_NORM.find((a) => a.norm.includes(n) || n.includes(a.norm));
  if (contains) return contains.name;
  
  const rawToks = tokens(raw);
  if (!rawToks.length) return null;
  let best: { name: string; score: number } | null = null;
  for (const a of ALL_NORM) {
    if (!a.toks.length) continue;
    const common = a.toks.filter((t) => rawToks.includes(t)).length;
    if (!common) continue;
    const score = common / Math.max(a.toks.length, rawToks.length);
    if (!best || score > best.score) best = { name: a.name, score };
  }
  return best && best.score >= 0.6 ? best.name : null;
};

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

export default function MonthlyStatementTab() {
  const { journal, clearJournal } = useStore(); // استدعاء دالة مسح البيانات من المخزن
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<"month" | "quarter">("month");
  const [month, setMonth] = useState(new Date().getMonth() + 1); 
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1); 

  const startMonth = mode === "month" ? month : (quarter - 1) * 3 + 1;
  const endMonth = mode === "month" ? month : quarter * 3;

  // معالجة البيانات وبناء أرصدة الحسابات (الأرصدة الافتتاحية وعمليات الفترة)
  const data = useMemo(() => {
    const map: Record<string, { prevDebit: number; prevCredit: number; curDebit: number; curCredit: number }> = {};
    ALL_ACCOUNTS.forEach((a) => (map[norm(a)] = { prevDebit: 0, prevCredit: 0, curDebit: 0, curCredit: 0 }));

    journal.forEach((j) => {
      const d = new Date(j.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== year) return;
      const m = d.getMonth() + 1;
      const isCurrent = m >= startMonth && m <= endMonth;
      const isPrev = m < startMonth;
      if (!isCurrent && !isPrev) return;

      const dMatch = matchAccount(j.debitAccount || j.account || "");
      const cMatch = matchAccount(j.creditAccount || "");
      const dKey = dMatch ? norm(dMatch) : "";
      const cKey = cMatch ? norm(cMatch) : "";

      if (dKey && map[dKey]) {
        if (isCurrent) map[dKey].curDebit += Number(j.debit) || 0;
        else map[dKey].prevDebit += Number(j.debit) || 0;
      }
      if (cKey && map[cKey]) {
        if (isCurrent) map[cKey].curCredit += Number(j.credit) || 0;
        else map[cKey].prevCredit += Number(j.credit) || 0;
      }
    });
    return map;
  }, [journal, year, startMonth, endMonth]);

  // حساب الإجماليات العامة لكافة الأعمدة بالتوافق مع ذيل الجدول في الملف المرسل
  const totals = useMemo(() => {
    return Object.values(data).reduce(
      (a, r) => ({
        prevDebit: a.prevDebit + r.prevDebit,
        prevCredit: a.prevCredit + r.prevCredit,
        curDebit: a.curDebit + r.curDebit,
        curCredit: a.curCredit + r.curCredit,
      }),
      { prevDebit: 0, prevCredit: 0, curDebit: 0, curCredit: 0 },
    );
  }, [data]);

  // دالة مسح البيانات مع التأكيد
  const handleClearAllData = () => {
    if (journal.length === 0) {
      toast.info("لا توجد بيانات حالية لمسحها");
      return;
    }

    const confirmClear = window.confirm(
      "⚠️ تنبيه حرج: هل أنت متأكد تماماً من رغبتك في مسح كافة القيود والبيانات المالية لهذا التبويب؟ لن تتمكن من استعادتها إلا بإعادة الاستيراد."
    );

    if (confirmClear) {
      if (clearJournal) {
        clearJournal();
        toast.success("تم تصفير ومسح كافة البيانات المالية بنجاح");
      } else {
        toast.error("حدث خطأ: دالة clearJournal غير معرفة بالـ Store الخاص بك.");
      }
    }
  };

  const handleExport = () => exportMonthlyStatement(journal, year);
  const handlePdf = () =>
    monthlyStatementPdf({ journal, year, startMonth, endMonth, mode, quarter });

  const periodLabel =
    mode === "month"
      ? `شهر ${MONTH_NAMES[month - 1]} ${year}م`
      : `حساب المدة - الربع ${["الأول", "الثاني", "الثالث", "الرابع"][quarter - 1]} ${year}م (${MONTH_NAMES[startMonth - 1]} - ${MONTH_NAMES[endMonth - 1]})`;

  return (
    <div className="space-y-5" dir="rtl">
      {/* لوحة التحكم العلوية والخلفية المطابقة */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto sm:order-last sm:ml-auto flex gap-2">
          <ImportButton kind="monthly" />
          {journal.length > 0 && (
            <button
              onClick={handleClearAllData}
              className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-sm rounded-lg hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2"
              title="مسح كامل القيود الحالية"
            >
              <AlertOctagon className="w-4 h-4" /> مسح البيانات
            </button>
          )}
        </div>
        
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">طريقة العرض المالي</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "month" | "quarter")}
            className="block px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm">
            <option value="month">كشف شهري تفصيلي</option>
            <option value="quarter">حساب المدة (ربع سنوي)</option>
          </select>
        </div>

        {mode === "month" ? (
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">الفترة الزمنية (الشهر)</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="block px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm">
              {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">الربع المالي</label>
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}
              className="block px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm">
              <option value={1}>الربع الأول (يناير - مارس)</option>
              <option value={2}>الربع الثاني (أبريل - يونيو)</option>
              <option value={3}>الربع الثالث (يوليو - سبتمبر)</option>
              <option value={4}>الربع الرابع (أكتوبر - ديسمبر)</option>
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">السنة المالية</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)}
            className="block w-28 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono text-center" />
        </div>

        <div className="flex-1" />
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleExport}
            className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm transition flex items-center justify-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
          </button>
          <button onClick={handlePdf}
            className="flex-1 sm:flex-initial px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-bold hover:bg-teal-800 shadow-sm transition flex items-center justify-center gap-1.5">
            <FileText className="w-4 h-4" /> تصدير PDF
          </button>
        </div>
      </div>

      {/* جدول البيانات المالي المطابق للمجلس الطبي ويومية عام 2026 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-950 text-white p-5 text-center">
          <h2 className="font-bold text-xl tracking-wide">{schema.title || "المجلس اليمني للاختصاصات الطبية"}</h2>
          <p className="text-xs opacity-80 mt-1">{schema.office || "دفتر اليومية العامة والبيانات المساعدة"} — {schema.governorate || "العام المالي 2026م"}</p>
          <div className="inline-block bg-teal-600/40 text-teal-300 text-xs px-3 py-1 rounded-full font-medium mt-2 border border-teal-500/20">
            تقرير مالي عن: {periodLabel}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse text-right">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
              <tr>
                <th rowSpan={2} className="border-b border-l border-slate-300 px-3 py-3 text-right min-w-[280px] bg-slate-100 text-slate-900 font-extrabold">
                  بيان الحسابات (طبقاً للنظام المحاسبي الموحد)
                </th>
                <th colSpan={2} className="border px-2 py-2 text-center bg-slate-200/60 font-bold text-slate-800">
                  الرصيد الافتتاحي / السابق في {startMonth === 1 ? `1/1/${year}` : `${year}/${startMonth}/1`}م
                </th>
                <th colSpan={2} className="border px-2 py-2 text-center bg-teal-50 text-teal-900 font-bold">
                  حركة عمليات التبويب الحالية ({mode === "month" ? `شهر ${MONTH_NAMES[month - 1]}` : `الربع ${quarter}`})
                </th>
                <th colSpan={2} className="border px-2 py-2 text-center bg-slate-200/60 font-bold text-slate-800">الجملــــــــــــة التراكمية</th>
                <th colSpan={2} className="border px-2 py-2 text-center bg-amber-50 text-amber-900 font-extrabold">
                  الرصيد الختامي في {year}/{endMonth}/{lastDayOfMonth(year, endMonth)}م
                </th>
              </tr>
              <tr className="bg-slate-50 text-xs text-slate-600 border-b border-slate-300">
                <th className="border px-2 py-1.5 text-center font-semibold bg-slate-50">إيرادات / مدين</th>
                <th className="border px-2 py-1.5 text-center font-semibold bg-slate-50">مصروفات / دائن</th>
                <th className="border px-2 py-1.5 text-center font-semibold bg-teal-50/50 text-teal-950">إيرادات / مدين</th>
                <th className="border px-2 py-1.5 text-center font-semibold bg-teal-50/50 text-teal-950">مصروفات / دائن</th>
                <th className="border px-2 py-1.5 text-center font-semibold bg-slate-50">إيرادات / مدين</th>
                <th className="border px-2 py-1.5 text-center font-semibold bg-slate-50">مصروفات / دائن</th>
                <th className="border px-2 py-1.5 text-center font-bold bg-amber-50/50 text-amber-950">أرصدة مدينة</th>
                <th className="border px-2 py-1.5 text-center font-bold bg-amber-50/50 text-amber-950">أرصدة دائنة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {GROUPS.map((g) => {
                let gPD = 0, gPC = 0, gCD = 0, gCC = 0;
                return (
                  <Fragment key={g.title}>
                    {/* ترويسة المجموعة الفرعية */}
                    <tr className="bg-slate-100/80 font-bold">
                      <td colSpan={9} className="border-y border-slate-300 px-3 py-2 text-slate-900 font-bold text-sm bg-slate-200/50">
                        📁 {g.title}
                      </td>
                    </tr>
                    {g.accounts.map((a) => {
                      const r = data[norm(a)] || { prevDebit: 0, prevCredit: 0, curDebit: 0, curCredit: 0 };
                      
                      // العمليات المحاسبية للدوال الشبيهة بالإكسل في التقرير
                      const totD = r.prevDebit + r.curDebit; // إجمالي المدين
                      const totC = r.prevCredit + r.curCredit; // إجمالي الدائن
                      const balD = Math.max(0, totD - totC);  // صافي الرصيد المدين
                      const balC = Math.max(0, totC - totD);  // صافي الرصيد الدائن
                      
                      gPD += r.prevDebit; 
                      gPC += r.prevCredit; 
                      gCD += r.curDebit; 
                      gCC += r.curCredit;
                      
                      return (
                        <tr key={a} className="hover:bg-slate-50/80 transition-colors">
                          <td className="border-l border-slate-200 px-3 py-2 whitespace-nowrap font-medium text-slate-700">{a}</td>
                          <td className="border px-2 py-2 font-mono text-left text-slate-600">{r.prevDebit ? fmt(r.prevDebit) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-slate-600">{r.prevCredit ? fmt(r.prevCredit) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-teal-700 bg-teal-50/10">{r.curDebit ? fmt(r.curDebit) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-teal-700 bg-teal-50/10">{r.curCredit ? fmt(r.curCredit) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-slate-800 font-medium">{totD ? fmt(totD) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-slate-800 font-medium">{totC ? fmt(totC) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-emerald-700 font-bold bg-emerald-50/20">{balD ? fmt(balD) : "—"}</td>
                          <td className="border px-2 py-2 font-mono text-left text-rose-700 font-bold bg-rose-50/20">{balC ? fmt(balC) : "—"}</td>
                        </tr>
                      );
                    })}
                    {/* جملة الفرع لكل مجموعة تبويب استناداً لمعادلات الإكسل الحسابية SUM */}
                    <tr className="bg-slate-50 font-bold text-slate-900 border-b border-slate-300">
                      <td className="border-l border-slate-300 px-3 py-2 text-right text-slate-800 font-bold">جملة بند: {g.title}</td>
                      <td className="border px-2 py-2 font-mono text-left text-slate-700 bg-slate-100/50">{fmt(gPD)}</td>
                      <td className="border px-2 py-2 font-mono text-left text-slate-700 bg-slate-100/50">{fmt(gPC)}</td>
                      <td className="border px-2 py-2 font-mono text-left text-teal-800 bg-teal-50/40">{fmt(gCD)}</td>
                      <td className="border px-2 py-2 font-mono text-left text-teal-800 bg-teal-50/40">{fmt(gCC)}</td>
                      <td className="border px-2 py-2 font-mono text-left text-slate-900">{fmt(gPD + gCD)}</td>
                      <td className="border px-2 py-2 font-mono text-left text-slate-900">{fmt(gPC + gCC)}</td>
                      <td className="border px-2 py-2 font-mono text-left text-emerald-800 bg-emerald-100/20">{fmt(Math.max(0, gPD + gCD - (gPC + gCC)))}</td>
                      <td className="border px-2 py-2 font-mono text-left text-rose-800 bg-rose-100/20">{fmt(Math.max(0, gPC + gCC - (gPD + gCD)))}</td>
                    </tr>
                  </Fragment>
                );
              })}
              
              {/* الإجمالي العام النهائي لكافة الحسابات الموازية لملف اليومية العام */}
              <tr className="bg-slate-900 text-white font-extrabold text-sm border-t-2 border-slate-900">
                <td className="border px-3 py-3 text-right bg-slate-950 font-black">الإجمالي العام النهائي للحسابات الكلية</td>
                <td className="border px-2 py-3 font-mono text-left text-slate-200">{fmt(totals.prevDebit)}</td>
                <td className="border px-2 py-3 font-mono text-left text-slate-200">{fmt(totals.prevCredit)}</td>
                <td className="border px-2 py-3 font-mono text-left text-teal-300 bg-slate-800">{fmt(totals.curDebit)}</td>
                <td className="border px-2 py-3 font-mono text-left text-teal-300 bg-slate-800">{fmt(totals.curCredit)}</td>
                <td className="border px-2 py-3 font-mono text-left text-slate-100">{fmt(totals.prevDebit + totals.curDebit)}</td>
                <td className="border px-2 py-3 font-mono text-left text-slate-100">{fmt(totals.prevCredit + totals.curCredit)}</td>
                <td className="border px-2 py-3 font-mono text-left text-emerald-400 bg-teal-950/50">
                  {fmt(Math.max(0, totals.prevDebit + totals.curDebit - (totals.prevCredit + totals.curCredit)))}
                </td>
                <td className="border px-2 py-3 font-mono text-left text-rose-400 bg-teal-950/50">
                  {fmt(Math.max(0, totals.prevCredit + totals.curCredit - (totals.prevDebit + totals.curDebit)))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
