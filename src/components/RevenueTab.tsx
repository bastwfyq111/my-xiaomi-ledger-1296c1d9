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

export function typeKey(c: number, s: number, i: number, t: number) {
  return `${c}-${s}-${i}-${t}`;
}

export default function RevenueTab() {
  const { revenue, setRevenue } = useStore() as any;
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const get = (y: number, m: number, key: string) => revenue[`${y}-${m}-${key}`] || 0;

  const data = useMemo(() => {
    const sumPrev = (key: string) => {
      let s = 0;
      for (let m = 1; m < month; m++) {
        s += get(year, m, key);
      }
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
    <div className="space-y-4 text-right" dir="rtl">
      
      {/* الفلاتر والأزرار */}
      <div className="flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded-lg">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-600">من تاريخ:</label>
          <div className="px-3 py-2 bg-gray-200 text-gray-600 rounded text-sm font-medium">
            يناير (بداية العام المالي)
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-600">إلى شهر:</label>
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border p-2 rounded text-sm bg-white"
          >
            {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-600">السنة:</label>
          <input 
            type="number" 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value) || year)}
            className="border p-2 rounded text-sm w-24 text-center bg-white" 
          />
        </div>

        <button 
          onClick={() => exportRevenueStatement(revenue, year)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-bold"
        >
          تصدير Excel
        </button>
        
        <button 
          onClick={() => revenuePdf(revenue, year, month)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold"
        >
          طباعة PDF
        </button>

        <button
          onClick={() => {
            if (!confirm("هل أنت متأكد من مسح جميع البيانات؟")) return;
            useStore.setState({ revenue: {} });
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold"
        >
          مسح البيانات
        </button>
      </div>

      {/* ترويسة الجدول */}
      <div className="text-center my-4">
        <h2 className="text-xl font-bold text-gray-800">{SCHEMA.title}</h2>
        <p className="text-sm text-gray-600">{SCHEMA.office}</p>
        <p className="text-xs text-gray-500 font-semibold mt-1">
          الفترة: من يناير {year}م إلى نهاية شهر {MONTH_NAMES[month - 1]} {year}م
        </p>
      </div>

      {/* حاوية الجدول وجسم الجدول */}
      <div className="w-full overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-max w-full table-auto text-right border-collapse text-sm border-gray-300">
          <thead>
            {/* تنسيق ألوان هيدر الجدول الرئيسي كأعمدة مستقلة */}
            <tr className="bg-slate-700 text-white font-bold">
              <th rowSpan={2} className="border border-slate-600 p-0 whitespace-nowrap bg-slate-800">بيان مفردات الموارد</th>
              <th rowSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-neutral-700">الباب</th>
              <th rowSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-neutral-700">الفصل</th>
              <th rowSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-neutral-700">البند</th>
              <th rowSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-neutral-700">النوع</th>
              <th colSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-teal-800">الشهر الجاري</th>
              <th colSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-amber-800">الأشهر السابقة</th>
              <th colSpan={2} className="border border-slate-600 p-0 text-center whitespace-nowrap bg-emerald-800">الجمله</th>
            </tr>
            <tr className="bg-slate-600 text-white font-bold">
              <th className="border border-slate-500 p-0 text-center whitespace-nowrap bg-teal-700">ف</th>
              <th className="border border-slate-500 p-0 text-center whitespace-nowrap bg-teal-700">ريال</th>
              <th className="border border-slate-500 p-0 text-center whitespace-nowrap bg-amber-700">ف</th>
              <th className="border border-slate-500 p-0 text-center whitespace-nowrap bg-amber-700">ريال</th>
              <th className="border border-slate-500 p-0 text-center whitespace-nowrap bg-emerald-700">ف</th>
              <th className="border border-slate-500 p-0 text-center whitespace-nowrap bg-emerald-700">ريال</th>
            </tr>
          </thead>
          <tbody>
            
            {/* تمييز صف الإجمالي الرئيسي الأول (لون نيلي محاسبي ملكي) */}
            <tr className="bg-indigo-900 text-white font-black">
              <td className="border border-indigo-950 p-0 whitespace-nowrap font-bold bg-indigo-950">إجمالي الموارد العامة للوحدة</td>
              <td colSpan={4} className="border border-indigo-950 p-0 bg-neutral-800"></td>
              <td className="border border-indigo-950 p-0 bg-teal-900"></td>
              <td className="border border-indigo-950 p-0 text-left whitespace-nowrap font-mono bg-teal-950">{cellNum(data.grandCur)}</td>
              <td className="border border-indigo-950 p-0 bg-amber-900"></td>
              <td className="border border-indigo-950 p-0 text-left whitespace-nowrap font-mono bg-amber-950">{cellNum(data.grandPrev)}</td>
              <td className="border border-indigo-950 p-0 bg-emerald-900"></td>
              <td className="border border-indigo-950 p-0 text-left whitespace-nowrap font-mono bg-emerald-950">{cellNum(data.grandCur + data.grandPrev)}</td>
            </tr>

            {SCHEMA.chapters.map((ch) =>
              ch.sections.length === 0 ? null : (
                <Fragment key={`ch-${ch.no}`}>
                  
                  {/* تمييز صف مستوى الأبواب (اللون الأزرق الفاتح المميز) */}
                  <tr className="bg-blue-100 text-blue-950 font-bold">
                    <td className="border border-blue-200 p-0 whitespace-nowrap bg-blue-150">{ch.longTitle || ch.title}</td>
                    <td className="border border-blue-200 p-0 text-center bg-neutral-200">{ch.no}</td>
                    <td colSpan={3} className="border border-blue-200 p-0 bg-neutral-100"></td>
                    <td className="border border-blue-200 p-0 bg-teal-100"></td>
                    <td className="border border-blue-200 p-0 text-left whitespace-nowrap font-mono bg-teal-50">{cellNum(data.chaptersAgg[ch.no].cur)}</td>
                    <td className="border border-blue-200 p-0 bg-amber-100"></td>
                    <td className="border border-blue-200 p-0 text-left whitespace-nowrap font-mono bg-amber-50">{cellNum(data.chaptersAgg[ch.no].prev)}</td>
                    <td className="border border-blue-200 p-0 bg-emerald-100"></td>
                    <td className="border border-blue-200 p-0 text-left whitespace-nowrap font-mono bg-emerald-50">{cellNum(data.chaptersAgg[ch.no].tot)}</td>
                  </tr>
                  
                  {ch.sections.map((sec) => (
                    <Fragment key={`sec-${ch.no}-${sec.no}`}>
                      
                      {/* تمييز صف مستوى الفصول (اللون الرمادي والأرجواني الفاتح اللطيف) */}
                      <tr className="bg-purple-50 text-purple-950 font-semibold">
                        <td className="border border-purple-100 p-0 whitespace-nowrap bg-purple-100/50" style={{ paddingRight: "10px" }}>{sec.title}</td>
                        <td className="border border-purple-100 p-0 bg-neutral-100"></td>
                        <td className="border border-purple-100 p-0 text-center bg-neutral-200">{sec.no}</td>
                        <td colSpan={2} className="border border-purple-100 p-0 bg-neutral-50"></td>
                        <td className="border border-purple-100 p-0 bg-teal-50/50"></td>
                        <td className="border border-purple-100 p-0 text-left whitespace-nowrap font-mono bg-teal-50/30">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].cur)}</td>
                        <td className="border border-purple-100 p-0 bg-amber-50/50"></td>
                        <td className="border border-purple-100 p-0 text-left whitespace-nowrap font-mono bg-amber-50/30">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].prev)}</td>
                        <td className="border border-purple-100 p-0 bg-emerald-50/50"></td>
                        <td className="border border-purple-100 p-0 text-left whitespace-nowrap font-mono bg-emerald-50/30">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].tot)}</td>
                      </tr>
                      
                      {sec.items.map((it) => (
                        <Fragment key={`it-${ch.no}-${sec.no}-${it.no}`}>
                          
                          {/* تمييز صف مستوى البنود (اللون البرتقالي/البيج الفاتح الهادئ) */}
                          <tr className="bg-orange-50/60 text-orange-950 font-medium">
                            <td className="border border-orange-100 p-0 whitespace-nowrap bg-orange-100/30" style={{ paddingRight: "20px" }}>{it.title}</td>
                            <td colSpan={2} className="border border-orange-100 p-0 bg-neutral-50"></td>
                            <td className="border border-orange-100 p-0 text-center bg-neutral-200">{it.no}</td>
                            <td className="border border-orange-100 p-0 bg-neutral-50"></td>
                            <td className="border border-orange-100 p-0 bg-teal-50/40"></td>
                            <td className="border border-orange-100 p-0 text-left whitespace-nowrap font-mono bg-teal-50/20">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].cur)}</td>
                            <td className="border border-orange-100 p-0 bg-amber-50/40"></td>
                            <td className="border border-orange-100 p-0 text-left whitespace-nowrap font-mono bg-amber-50/20">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].prev)}</td>
                            <td className="border border-orange-100 p-0 bg-emerald-50/40"></td>
                            <td className="border border-orange-100 p-0 text-left whitespace-nowrap font-mono bg-emerald-50/20">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].tot)}</td>
                          </tr>
                          
                          {it.types.map((t) => {
                            const k = typeKey(ch.no, sec.no, it.no, t.no);
                            const v = data.types[k];
                            return (
                              
                              {/* تمييز صف مستوى النوع (الخلايا البيضاء الافتراضية الصافية مع تلوين فئات الأعمدة) */}
                              <tr key={k} className="text-gray-700 bg-white hover:bg-neutral-50 transition-colors">
                                <td className="border border-gray-200 p-0 whitespace-nowrap bg-slate-50/80 text-gray-800" style={{ paddingRight: "30px" }}>{t.title}</td>
                                <td colSpan={3} className="border border-gray-200 p-0 bg-neutral-50/30"></td>
                                <td className="border border-gray-200 p-0 text-center bg-neutral-100 text-gray-500">{t.no}</td>
                                <td className="border border-gray-200 p-0 bg-teal-50/20"></td>
                                
                                {/* عمود مدخلات الشهر الجاري الملون بالرمادي الفاتح المائل للزرقة لتسهيل تمييز حقول الإدخال */}
                                <td className="border border-gray-200 p-0 whitespace-nowrap bg-teal-50/40">
                                  <input
                                    type="number"
                                    value={v.cur || ""}
                                    onChange={(e) => setRevenue(year, month, k, Number(e.target.value) || 0)}
                                    className="w-24 p-0 text-left font-bold border-0 focus:outline-none focus:ring-0 text-sm bg-transparent font-mono text-teal-950"
                                    placeholder="0"
                                  />
                                </td>
                                
                                <td className="border border-gray-200 p-0 bg-amber-50/20"></td>
                                <td className="border border-gray-200 p-0 text-left whitespace-nowrap font-mono text-amber-900 bg-amber-50/40">{cellNum(v.prev)}</td>
                                <td className="border border-gray-200 p-0 bg-emerald-50/20"></td>
                                <td className="border border-gray-200 p-0 text-left text-emerald-950 font-bold whitespace-nowrap font-mono bg-emerald-50/40">{cellNum(v.tot)}</td>
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

            {/* تمييز ملخص مجاميع جملة الأبواب النهائية في أسفل الجدول (لون رمادي داكن واضح للفرز العرضي) */}
            <tr className="bg-neutral-600 text-white font-bold border-t-2 border-neutral-700">
              <td colSpan={5} className="p-0 text-center whitespace-nowrap bg-neutral-700">ملخص جملة إيرادات الأبواب المعتمدة للمدة المحددة</td>
              <td colSpan={6} className="p-0 border border-neutral-600 bg-neutral-800"></td>
            </tr>
            {SCHEMA.chapters.map((ch) => {
              const agg = data.chaptersAgg[ch.no] || { cur: 0, prev: 0, tot: 0 };
              return (
                <tr key={`subt-${ch.no}`} className="text-slate-900 font-bold bg-slate-100 hover:bg-slate-200 transition-colors">
                  <td colSpan={5} className="border border-slate-300 p-0 whitespace-nowrap text-slate-800 bg-slate-200/60">جملة إيرادات الباب : {ch.title}</td>
                  <td className="border border-slate-300 p-0 bg-teal-100/40"></td>
                  <td className="border border-slate-300 p-0 text-left whitespace-nowrap font-mono text-teal-800 bg-teal-100/70">{cellNum(agg.cur)}</td>
                  <td className="border border-slate-300 p-0 bg-amber-100/40"></td>
                  <td className="border border-slate-300 p-0 text-left whitespace-nowrap font-mono text-amber-800 bg-amber-100/70">{cellNum(agg.prev)}</td>
                  <td className="border border-slate-300 p-0 bg-emerald-100/40"></td>
                  <td className="border border-slate-300 p-0 text-left text-emerald-900 font-black whitespace-nowrap font-mono bg-emerald-100/70">{cellNum(agg.tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
