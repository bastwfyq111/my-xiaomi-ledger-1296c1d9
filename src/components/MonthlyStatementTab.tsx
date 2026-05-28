import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import schema from "@/data/monthlyStatement.json";
import { exportMonthlyStatement } from "@/lib/exportImport";
import { monthlyStatementPdf } from "@/lib/exportPdf";
import ImportButton from "./ImportButton";

const MONTH_NAMES = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

type Group = { title: string; accounts: string[] };
const GROUPS = schema.groups as Group[];
const ALL_ACCOUNTS = GROUPS.flatMap((g) => g.accounts);

// Aggressive Arabic name normalization so journal account names
// match the monthly-statement schema even with small spelling
// variations (alef/ya/ta-marbuta forms, diacritics, "ح/" prefix,
// stray spaces inside parentheses, etc.)
const norm = (s: string) => {
  if (!s) return "";
  let x = s
    // strip Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    // unify alef forms
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    // unify ya
    .replace(/[\u0649\u064A]/g, "\u064A")
    // unify ta marbuta / ha
    .replace(/\u0629/g, "\u0647")
    // expand "ح/" abbreviation to "حساب"
    .replace(/\u062D\s*\/\s*/g, "\u062D\u0633\u0627\u0628 ")
    // remove punctuation we don't want to match on
    .replace(/[()\[\]./\\،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return x;
};

export default function MonthlyStatementTab() {
  const { journal } = useStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<"month" | "quarter">("month");
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1..12
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1); // 1..4

  // current period range [startMonth..endMonth] inclusive (1..12)
  const startMonth = mode === "month" ? month : (quarter - 1) * 3 + 1;
  const endMonth = mode === "month" ? month : quarter * 3;

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

      const dKey = norm(j.debitAccount || j.account || "");
      const cKey = norm(j.creditAccount || "");
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

  const handleExport = () => exportMonthlyStatement(journal, year);
  const handlePdf = () =>
    monthlyStatementPdf({ journal, year, startMonth, endMonth, mode, quarter });

  const periodLabel =
    mode === "month"
      ? `شهر ${MONTH_NAMES[month - 1]} ${year}م`
      : `حساب المدة - الربع ${["الأول","الثاني","الثالث","الرابع"][quarter - 1]} ${year}م (${MONTH_NAMES[startMonth - 1]} - ${MONTH_NAMES[endMonth - 1]})`;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl shadow-sm border p-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto sm:order-last sm:ml-auto">
          <ImportButton kind="monthly" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">طريقة العرض</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "month" | "quarter")}
            className="block px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="month">شهري</option>
            <option value="quarter">حساب المدة (ربع سنوي)</option>
          </select>
        </div>
        {mode === "month" ? (
          <div>
            <label className="text-xs text-muted-foreground">الشهر</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="block px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring">
              {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted-foreground">الربع</label>
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}
              className="block px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring">
              <option value={1}>الربع الأول (يناير - مارس)</option>
              <option value={2}>الربع الثاني (أبريل - يونيو)</option>
              <option value={3}>الربع الثالث (يوليو - سبتمبر)</option>
              <option value={4}>الربع الرابع (أكتوبر - ديسمبر)</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">السنة</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)}
            className="block w-28 px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex-1" />
        <button onClick={handleExport}
          className="px-4 py-2 bg-success text-success-foreground rounded-lg text-sm font-semibold">
          تصدير الكشف السنوي Excel
        </button>
        <button onClick={handlePdf}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">
          تصدير PDF
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-l from-primary to-primary/85 text-primary-foreground p-4 text-center">
          <h2 className="font-bold text-lg">{schema.title}</h2>
          <p className="text-sm opacity-90">{schema.office} — {schema.governorate}</p>
          <p className="text-sm opacity-90 mt-1">عن {periodLabel}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th rowSpan={2} className="border px-2 py-2 text-right min-w-[260px]">بيان أنواع الحسابات الوسيطة</th>
                <th colSpan={2} className="border px-2 py-2 text-center">
                  الرصيد في {startMonth === 1 ? `1/1/${year}` : `${year}/${startMonth}/1`} م
                </th>
                <th colSpan={2} className="border px-2 py-2 text-center">
                  {mode === "month"
                    ? `عمليات شهر ${MONTH_NAMES[month - 1]} ${year}م`
                    : `حساب المدة - الربع ${["الأول","الثاني","الثالث","الرابع"][quarter - 1]} ${year}م`}
                </th>
                <th colSpan={2} className="border px-2 py-2 text-center">الجملــــــــــــة</th>
                <th colSpan={2} className="border px-2 py-2 text-center">
                  الرصيد في {year}/{endMonth}/{lastDayOfMonth(year, endMonth)}م
                </th>
              </tr>
              <tr>
                <th className="border px-2 py-1 text-center">مدين</th>
                <th className="border px-2 py-1 text-center">دائن</th>
                <th className="border px-2 py-1 text-center">مدين</th>
                <th className="border px-2 py-1 text-center">دائن</th>
                <th className="border px-2 py-1 text-center">مدين</th>
                <th className="border px-2 py-1 text-center">دائن</th>
                <th className="border px-2 py-1 text-center">مدين</th>
                <th className="border px-2 py-1 text-center">دائن</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                let gPD = 0, gPC = 0, gCD = 0, gCC = 0;
                return (
                  <Fragment key={g.title}>
                    <tr className="bg-accent/15 font-bold">
                      <td colSpan={9} className="border px-3 py-1.5 text-primary">{g.title}</td>
                    </tr>
                    {g.accounts.map((a) => {
                      const r = data[norm(a)] || { prevDebit: 0, prevCredit: 0, curDebit: 0, curCredit: 0 };
                      const totD = r.prevDebit + r.curDebit;
                      const totC = r.prevCredit + r.curCredit;
                      const balD = Math.max(0, totD - totC);
                      const balC = Math.max(0, totC - totD);
                      gPD += r.prevDebit; gPC += r.prevCredit; gCD += r.curDebit; gCC += r.curCredit;
                      return (
                        <tr key={a} className="border-t hover:bg-muted/40">
                          <td className="border px-2 py-1 whitespace-nowrap">{a}</td>
                          <td className="border px-2 py-1 font-mono text-left">{r.prevDebit ? fmt(r.prevDebit) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{r.prevCredit ? fmt(r.prevCredit) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{r.curDebit ? fmt(r.curDebit) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{r.curCredit ? fmt(r.curCredit) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{totD ? fmt(totD) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{totC ? fmt(totC) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{balD ? fmt(balD) : "-"}</td>
                          <td className="border px-2 py-1 font-mono text-left">{balC ? fmt(balC) : "-"}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-secondary/40 font-semibold">
                      <td className="border px-2 py-1 text-left">الجملة</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(gPD)}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(gPC)}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(gCD)}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(gCC)}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(gPD + gCD)}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(gPC + gCC)}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(Math.max(0, gPD + gCD - (gPC + gCC)))}</td>
                      <td className="border px-2 py-1 font-mono text-left">{fmt(Math.max(0, gPC + gCC - (gPD + gCD)))}</td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="bg-primary/15 font-bold text-primary">
                <td className="border px-2 py-2 text-left">الإجمالي العام</td>
                <td className="border px-2 py-2 font-mono text-left">{fmt(totals.prevDebit)}</td>
                <td className="border px-2 py-2 font-mono text-left">{fmt(totals.prevCredit)}</td>
                <td className="border px-2 py-2 font-mono text-left">{fmt(totals.curDebit)}</td>
                <td className="border px-2 py-2 font-mono text-left">{fmt(totals.curCredit)}</td>
                <td className="border px-2 py-2 font-mono text-left">{fmt(totals.prevDebit + totals.curDebit)}</td>
                <td className="border px-2 py-2 font-mono text-left">{fmt(totals.prevCredit + totals.curCredit)}</td>
                <td className="border px-2 py-2 font-mono text-left">
                  {fmt(Math.max(0, totals.prevDebit + totals.curDebit - (totals.prevCredit + totals.curCredit)))}
                </td>
                <td className="border px-2 py-2 font-mono text-left">
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

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}
