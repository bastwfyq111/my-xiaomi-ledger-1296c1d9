import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import schema from "@/data/revenueTemplate.json";
import { exportRevenueStatement } from "@/lib/exportImport";
import { revenuePdf } from "@/lib/exportPdf";

const MONTH_NAMES = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

type Type = { no: number; title: string };
type Item = { no: number; title: string; types: Type[] };
type Section = { no: number; title: string; items: Item[] };
type Chapter = { no: number; title: string; longTitle?: string; sections: Section[] };

const SCHEMA = schema as { title: string; office: string; chapters: Chapter[] };

// itemKey for storage: ch{c}-sec{s}-it{i}-typ{t}
export function typeKey(c: number, s: number, i: number, t: number) {
  return `${c}-${s}-${i}-${t}`;
}

export default function RevenueTab() {
  const { revenue, setRevenue } = useStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const get = (y: number, m: number, key: string) => revenue[`${y}-${m}-${key}`] || 0;

  // Aggregations
  const data = useMemo(() => {
    const sumPrev = (key: string) => {
      let s = 0;
      for (let m = 1; m < month; m++) s += get(year, m, key);
      return s;
    };
    const types: Record<string, { cur: number; prev: number; tot: number }> = {};
    SCHEMA.chapters.forEach((ch) =>
      ch.sections.forEach((sec) =>
        sec.items.forEach((it) =>
          it.types.forEach((t) => {
            const k = typeKey(ch.no, sec.no, it.no, t.no);
            const cur = get(year, month, k);
            const prev = sumPrev(k);
            types[k] = { cur, prev, tot: cur + prev };
          }),
        ),
      ),
    );
    const itemsAgg: Record<string, { cur: number; prev: number; tot: number }> = {};
    const sectionsAgg: Record<string, { cur: number; prev: number; tot: number }> = {};
    const chaptersAgg: Record<string, { cur: number; prev: number; tot: number }> = {};
    let grandCur = 0, grandPrev = 0;
    SCHEMA.chapters.forEach((ch) => {
      let cCur = 0, cPrev = 0;
      ch.sections.forEach((sec) => {
        let sCur = 0, sPrev = 0;
        sec.items.forEach((it) => {
          let iCur = 0, iPrev = 0;
          it.types.forEach((t) => {
            const v = types[typeKey(ch.no, sec.no, it.no, t.no)];
            iCur += v.cur; iPrev += v.prev;
          });
          itemsAgg[`${ch.no}-${sec.no}-${it.no}`] = { cur: iCur, prev: iPrev, tot: iCur + iPrev };
          sCur += iCur; sPrev += iPrev;
        });
        sectionsAgg[`${ch.no}-${sec.no}`] = { cur: sCur, prev: sPrev, tot: sCur + sPrev };
        cCur += sCur; cPrev += sPrev;
      });
      chaptersAgg[`${ch.no}`] = { cur: cCur, prev: cPrev, tot: cCur + cPrev };
      grandCur += cCur; grandPrev += cPrev;
    });
    return { types, itemsAgg, sectionsAgg, chaptersAgg, grandCur, grandPrev };
  }, [revenue, year, month]);

  const cellNum = (n: number) => (n ? fmt(n) : "-");

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl shadow-sm border p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">الشهر</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="block px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring">
            {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">السنة</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)}
            className="block w-28 px-3 py-2 border rounded-lg bg-input/30 focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex-1" />
        <button onClick={() => exportRevenueStatement(revenue, year)}
          className="px-4 py-2 bg-success text-success-foreground rounded-lg text-sm font-semibold">
          تصدير الإيرادات السنوي Excel
        </button>
        <button onClick={() => revenuePdf(revenue, year, month)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">
          تصدير PDF
        </button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-l from-primary to-primary/85 text-primary-foreground p-4 text-center">
          <h2 className="font-bold text-lg">{SCHEMA.title}</h2>
          <p className="text-sm opacity-90">{SCHEMA.office}</p>
          <p className="text-sm opacity-90 mt-1">عن شهر {MONTH_NAMES[month - 1]} من العام المالي {year}م</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th rowSpan={2} className="border px-2 py-2 text-right min-w-[280px]">بيان مفردات الموارد</th>
                <th rowSpan={2} className="border px-2 py-2">الباب</th>
                <th rowSpan={2} className="border px-2 py-2">الفصل</th>
                <th rowSpan={2} className="border px-2 py-2">البند</th>
                <th rowSpan={2} className="border px-2 py-2">النوع</th>
                <th colSpan={2} className="border px-2 py-2 text-center">الشهر الجاري</th>
                <th colSpan={2} className="border px-2 py-2 text-center">الأشهر السابقة</th>
                <th colSpan={2} className="border px-2 py-2 text-center">الجملــة</th>
              </tr>
              <tr>
                <th className="border px-2 py-1">ف</th><th className="border px-2 py-1">ريال</th>
                <th className="border px-2 py-1">ف</th><th className="border px-2 py-1">ريال</th>
                <th className="border px-2 py-1">ف</th><th className="border px-2 py-1">ريال</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-primary/10 font-bold text-primary">
                <td className="border px-3 py-2 text-right">إجمالي الموارد</td>
                <td colSpan={4} className="border"></td>
                <td className="border"></td><td className="border px-2 py-2 font-mono text-left">{cellNum(data.grandCur)}</td>
                <td className="border"></td><td className="border px-2 py-2 font-mono text-left">{cellNum(data.grandPrev)}</td>
                <td className="border"></td><td className="border px-2 py-2 font-mono text-left">{cellNum(data.grandCur + data.grandPrev)}</td>
              </tr>

              {SCHEMA.chapters.map((ch) =>
                ch.sections.length === 0 ? null : (
                  <Fragment key={`ch-${ch.no}`}>
                    <tr className="bg-accent/15 font-bold">
                      <td className="border px-3 py-1.5 text-right text-primary">{ch.longTitle || ch.title}</td>
                      <td className="border px-2 text-center">{ch.no}</td>
                      <td colSpan={3} className="border"></td>
                      <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.chaptersAgg[ch.no].cur)}</td>
                      <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.chaptersAgg[ch.no].prev)}</td>
                      <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.chaptersAgg[ch.no].tot)}</td>
                    </tr>
                    {ch.sections.map((sec) => (
                      <Fragment key={`sec-${ch.no}-${sec.no}`}>
                        <tr className="bg-muted/40 font-semibold">
                          <td className="border px-4 py-1 text-right">{sec.title}</td>
                          <td className="border"></td>
                          <td className="border px-2 text-center">{sec.no}</td>
                          <td colSpan={2} className="border"></td>
                          <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].cur)}</td>
                          <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].prev)}</td>
                          <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].tot)}</td>
                        </tr>
                        {sec.items.map((it) => (
                          <Fragment key={`it-${ch.no}-${sec.no}-${it.no}`}>
                            <tr className="bg-muted/20">
                              <td className="border px-6 py-1 text-right">{it.title}</td>
                              <td colSpan={2} className="border"></td>
                              <td className="border px-2 text-center">{it.no}</td>
                              <td className="border"></td>
                              <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].cur)}</td>
                              <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].prev)}</td>
                              <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].tot)}</td>
                            </tr>
                            {it.types.map((t) => {
                              const k = typeKey(ch.no, sec.no, it.no, t.no);
                              const v = data.types[k];
                              return (
                                <tr key={k} className="hover:bg-muted/30">
                                  <td className="border px-8 py-1 text-right">{t.title}</td>
                                  <td colSpan={3} className="border"></td>
                                  <td className="border px-2 text-center">{t.no}</td>
                                  <td className="border"></td>
                                  <td className="border px-1 py-0.5">
                                    <input
                                      type="number"
                                      value={v.cur || ""}
                                      onChange={(e) => setRevenue(year, month, k, Number(e.target.value) || 0)}
                                      className="w-full px-2 py-1 bg-input/30 border rounded font-mono text-left focus:outline-none focus:ring-1 focus:ring-ring"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(v.prev)}</td>
                                  <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(v.tot)}</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ),
              )}

              {/* Chapter subtotals (always shown for all 5 chapters) */}
              {SCHEMA.chapters.map((ch) => {
                const agg = data.chaptersAgg[ch.no] || { cur: 0, prev: 0, tot: 0 };
                const order = ["اﻷول","الثاني","الثالث","الرابع","الخامس"];
                return (
                  <tr key={`subt-${ch.no}`} className="bg-secondary/30 font-semibold">
                    <td colSpan={5} className="border px-3 py-1.5 text-right">جملة الباب {order[ch.no - 1]} : {ch.title}</td>
                    <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(agg.cur)}</td>
                    <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(agg.prev)}</td>
                    <td className="border"></td><td className="border px-2 font-mono text-left">{cellNum(agg.tot)}</td>
                  </tr>
                );
              })}
              <tr className="bg-primary/15 font-bold text-primary">
                <td colSpan={5} className="border px-3 py-2 text-right">اجمالي عام الموارد</td>
                <td className="border"></td><td className="border px-2 py-2 font-mono text-left">{cellNum(data.grandCur)}</td>
                <td className="border"></td><td className="border px-2 py-2 font-mono text-left">{cellNum(data.grandPrev)}</td>
                <td className="border"></td><td className="border px-2 py-2 font-mono text-left">{cellNum(data.grandCur + data.grandPrev)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
