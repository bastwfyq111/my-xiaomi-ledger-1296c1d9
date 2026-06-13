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
    /* 🎨 تغيير خلفية التبويب بالكامل إلى لون رمادي-أزرق ناعم وفخم (bg-slate-50/90) مع حواف أنيقة متناسقة */
    <div className="space-y-6 text-right p-6 bg-slate-50/90 rounded-2xl border border-slate-200/60 shadow-inner" dir="rtl">
      
      {/* الفلاتر والأزرار */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-slate-500">من تاريخ:</label>
          <div className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold border border-slate-200">
            يناير (بداية العام المالي)
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-slate-600">إلى شهر:</label>
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-slate-200 p-2 rounded-lg text-sm bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-slate-600">السنة:</label>
          <input 
            type="number" 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value) || year)}
            className="border border-slate-200 p-2 rounded-lg text-sm w-24 text-center bg-white font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
          />
        </div>

        <button 
          onClick={() => exportRevenueStatement(revenue, year)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          تصدير Excel
        </button>
        
        <button 
          onClick={() => revenuePdf(revenue, year, month)}
          className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          طباعة PDF
        </button>

        <button
          onClick={() => {
            if (!confirm("هل أنت متأكد من مسح جميع البيانات؟")) return;
            useStore.setState({ revenue: {} });
          }}
          className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          مسح البيانات
        </button>
      </div>

      {/* ترويسة الجدول */}
      <div className="text-center my-4">
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{SCHEMA.title}</h2>
        <p className="text-sm font-semibold text-slate-500 mt-1">{SCHEMA.office}</p>
        <p className="text-xs text-blue-800 font-bold mt-2 bg-blue-100/70 inline-block px-4 py-1.5 rounded-full border border-blue-200/50">
          الفترة: من يناير {year}م إلى نهاية شهر {MONTH_NAMES[month - 1]} {year}م
        </p>
      </div>

      {/* حاوية الجدول وجسم الجدول */}
      <div className="w-full overflow-x-auto border border-slate-300 rounded-xl shadow-md bg-white">
        <table className="min-w-max w-full table-auto text-right border-collapse text-sm">
          <thead>
            {/* الهيدر الرئيسي الأول والثاني: كحلي غامق جداً وأزرق غامق مع نصوص بيضاء ناصعة */}
            <tr className="bg-slate-950 text-white font-bold border-b border-slate-800">
              <th rowSpan={2} className="border border-slate-800 p-0 whitespace-nowrap bg-slate-950 text-white font-bold">بيان مفردات الموارد</th>
              <th rowSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold">الباب</th>
              <th rowSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold">الفصل</th>
              <th rowSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold">البند</th>
              <th rowSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold">النوع</th>
              <th colSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-900 text-white font-bold">الشهر الجاري</th>
              <th colSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-900 text-white font-bold">الأشهر السابقة</th>
              <th colSpan={2} className="border border-slate-800 p-0 text-center whitespace-nowrap bg-slate-900 text-white font-bold">الجمله والتراكمي</th>
            </tr>
            <tr className="bg-slate-900 text-white font-bold border-b border-slate-700">
              <th className="border border-slate-700 p-0 text-center whitespace-nowrap bg-indigo-900 text-white font-bold">ف</th>
              <th className="border border-slate-700 p-0 text-center whitespace-nowrap bg-indigo-900 text-white font-bold">ريال</th>
              <th className="border border-slate-700 p-0 text-center whitespace-nowrap bg-indigo-950 text-white font-bold">ف</th>
              <th className="border border-slate-700 p-0 text-center whitespace-nowrap bg-indigo-950 text-white font-bold">ريال</th>
              <th className="border border-slate-700 p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold">ف</th>
              <th className="border border-slate-700 p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold">ريال</th>
            </tr>
          </thead>
          <tbody>
            
            {/* صف الإجمالي الرئيسي الأول: كحلي داكن ملكي غامق جداً مع نصوص وأرقام بيضاء ناصعة */}
            <tr className="bg-slate-950 text-white font-black border-b-2 border-slate-950">
              <td className="border border-slate-950 p-0 whitespace-nowrap font-black bg-slate-950 text-white">إجمالي الموارد العامة للوحدة</td>
              <td colSpan={4} className="border border-slate-950 p-0 bg-slate-950"></td>
              <td className="border border-slate-950 p-0 bg-slate-950"></td>
              <td className="border border-slate-950 p-0 text-left whitespace-nowrap font-mono font-black bg-slate-950 text-white">{cellNum(data.grandCur)}</td>
              <td className="border border-slate-950 p-0 bg-slate-950"></td>
              <td className="border border-slate-950 p-0 text-left whitespace-nowrap font-mono font-black bg-slate-950 text-white">{cellNum(data.grandPrev)}</td>
              <td className="border border-slate-950 p-0 bg-slate-950"></td>
              <td className="border border-slate-950 p-0 text-left whitespace-nowrap font-mono font-black bg-slate-950 text-white">{cellNum(data.grandCur + data.grandPrev)}</td>
            </tr>

            {SCHEMA.chapters.map((ch) =>
              ch.sections.length === 0 ? null : (
                <Fragment key={`ch-${ch.no}`}>
                  
                  {/* مستوى الأبواب: أخضر غامق فاخر جداً مع خط أبيض ناصع بالكامل */}
                  <tr className="bg-emerald-900 text-white font-bold border-b border-emerald-950">
                    <td className="border border-emerald-950 p-0 whitespace-nowrap bg-emerald-900 text-white font-bold px-1">{ch.longTitle || ch.title}</td>
                    <td className="border border-emerald-950 p-0 text-center bg-emerald-900 text-white font-bold">{ch.no}</td>
                    <td colSpan={3} className="border border-emerald-950 p-0 bg-emerald-900"></td>
                    <td className="border border-emerald-950 p-0 bg-emerald-900"></td>
                    <td className="border border-emerald-950 p-0 text-left whitespace-nowrap font-mono bg-emerald-900 text-white font-bold">{cellNum(data.chaptersAgg[ch.no].cur)}</td>
                    <td className="border border-emerald-950 p-0 bg-emerald-900"></td>
                    <td className="border border-emerald-950 p-0 text-left whitespace-nowrap font-mono bg-emerald-900 text-white font-bold">{cellNum(data.chaptersAgg[ch.no].prev)}</td>
                    <td className="border border-emerald-950 p-0 bg-emerald-900"></td>
                    <td className="border border-emerald-950 p-0 text-left whitespace-nowrap font-mono font-extrabold bg-emerald-900 text-white">{cellNum(data.chaptersAgg[ch.no].tot)}</td>
                  </tr>
                  
                  {ch.sections.map((sec) => (
                    <Fragment key={`sec-${ch.no}-${sec.no}`}>
                      
                      {/* مستوى الفصول: ذهبي عتيق غامق (برونزي غني) مع خط أبيض ناصع بالكامل */}
                      <tr className="bg-amber-900 text-white font-bold border-b border-amber-950">
                        <td className="border border-amber-950 p-0 whitespace-nowrap bg-amber-900 text-white font-bold" style={{ paddingRight: "10px" }}>{sec.title}</td>
                        <td className="border border-amber-950 p-0 bg-amber-900"></td>
                        <td className="border border-amber-950 p-0 text-center bg-amber-900 text-white font-bold">{sec.no}</td>
                        <td colSpan={2} className="border border-amber-950 p-0 bg-amber-900"></td>
                        <td className="border border-amber-950 p-0 bg-amber-900"></td>
                        <td className="border border-amber-950 p-0 text-left whitespace-nowrap font-mono text-white bg-amber-900 font-bold">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].cur)}</td>
                        <td className="border border-amber-950 p-0 bg-amber-900"></td>
                        <td className="border border-amber-950 p-0 text-left whitespace-nowrap font-mono text-white bg-amber-900 font-bold">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].prev)}</td>
                        <td className="border border-amber-950 p-0 bg-amber-900"></td>
                        <td className="border border-amber-950 p-0 text-left whitespace-nowrap font-mono font-bold text-white bg-amber-900">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].tot)}</td>
                      </tr>
                      
                      {sec.items.map((it) => (
                        <Fragment key={`it-${ch.no}-${sec.no}-${it.no}`}>
                          
                          {/* مستوى البنود: أزرق ملكي داكن غامق جداً مع خط أبيض ناصع بالكامل */}
                          <tr className="bg-blue-950 text-white font-semibold border-b border-blue-900">
                            <td className="border border-blue-900 p-0 whitespace-nowrap bg-blue-950 text-white font-bold" style={{ paddingRight: "20px" }}>{it.title}</td>
                            <td colSpan={2} className="border border-blue-900 p-0 bg-blue-950"></td>
                            <td className="border border-blue-900 p-0 text-center bg-blue-950 text-white font-bold">{it.no}</td>
                            <td className="border border-blue-900 p-0 bg-blue-950"></td>
                            <td className="border border-blue-900 p-0 bg-blue-950"></td>
                            <td className="border border-blue-900 p-0 text-left whitespace-nowrap font-mono text-white bg-blue-950 font-bold">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].cur)}</td>
                            <td className="border border-blue-900 p-0 bg-blue-950"></td>
                            <td className="border border-blue-900 p-0 text-left whitespace-nowrap font-mono text-white bg-blue-950 font-bold">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].prev)}</td>
                            <td className="border border-blue-900 p-0 bg-blue-950"></td>
                            <td className="border border-blue-900 p-0 text-left whitespace-nowrap font-mono font-semibold text-white bg-blue-950">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].tot)}</td>
                          </tr>
                          
                          {it.types.map((t) => {
                            const k = typeKey(ch.no, sec.no, it.no, t.no);
                            const v = data.types[k];
                            return (
                              
                              /* مستوى الأنواع (الصفوف الداخلية): الإبقاء على التنسيق الافتراضي الأبيض النظيف لتوفير أعلى تباين وراحة أثناء فرز الحقول وقراءتها */
                              <tr key={k} className="text-slate-700 bg-white hover:bg-slate-100/70 transition-colors border-b border-slate-200">
                                <td className="border border-slate-200 p-0 whitespace-nowrap text-slate-700 font-medium text-right" style={{ paddingRight: "30px" }}>{t.title}</td>
                                <td colSpan={3} className="border border-slate-200 p-0 bg-slate-50/40"></td>
                                <td className="border border-slate-200 p-0 text-center bg-slate-50 text-slate-500 font-mono">{t.no}</td>
                                <td className="border border-slate-200 p-0 bg-slate-50/20"></td>
                                
                                {/* حقل إدخال الشهر الجاري: منسق بلون نيلي واضح جداً ليسهل على المحاسب إدخال البيانات بسرعة ودقة */}
                                <td className="border border-slate-200 p-0 whitespace-nowrap bg-indigo-50/40">
                                  <input
                                    type="number"
                                    value={v.cur || ""}
                                    onChange={(e) => setRevenue(year, month, k, Number(e.target.value) || 0)}
                                    className="w-24 p-0 text-left font-bold border-0 focus:outline-none focus:ring-0 text-sm bg-transparent font-mono text-indigo-950 placeholder-slate-300"
                                    placeholder="0"
                                  />
                                </td>
                                
                                <td className="border border-slate-200 p-0 bg-slate-50/20"></td>
                                <td className="border border-slate-200 p-0 text-left whitespace-nowrap font-mono text-slate-600 bg-slate-50/30">{cellNum(v.prev)}</td>
                                <td className="border border-slate-200 p-0 bg-emerald-50/10"></td>
                                <td className="border border-slate-200 p-0 text-left text-emerald-800 font-bold whitespace-nowrap font-mono bg-emerald-50/30">{cellNum(v.tot)}</td>
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

            {/* ملخص مجاميع جملة الأبواب في ذيل الجدول: كحلي داكن غامق جداً مع خط أبيض ناصع */}
            <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-950">
              <td colSpan={5} className="p-0 text-center whitespace-nowrap bg-slate-950 text-white font-bold py-1">ملخص مجاميع الحسابات والأبواب للمدة المحاسبية المحددة</td>
              <td colSpan={6} className="p-0 border border-slate-950 bg-slate-950"></td>
            </tr>
            {SCHEMA.chapters.map((ch) => {
              const agg = data.chaptersAgg[ch.no] || { cur: 0, prev: 0, tot: 0 };
              return (
                /* صفوف جملة الأبواب السفلية المعتمدة تتبع الأخضر الغامق مع خطوط بيضاء ناصعة */
                <tr key={`subt-${ch.no}`} className="text-white font-bold bg-emerald-950 border-b border-emerald-900">
                  <td colSpan={5} className="border border-emerald-900 p-0 whitespace-nowrap text-white font-bold bg-emerald-950 px-2">جملة إيرادات الباب : {ch.title}</td>
                  <td className="border border-emerald-900 p-0 bg-emerald-950"></td>
                  <td className="border border-emerald-900 p-0 text-left whitespace-nowrap font-mono text-white bg-emerald-950 font-bold">{cellNum(agg.cur)}</td>
                  <td className="border border-emerald-900 p-0 bg-emerald-950"></td>
                  <td className="border border-emerald-900 p-0 text-left whitespace-nowrap font-mono text-white bg-emerald-950 font-bold">{cellNum(agg.prev)}</td>
                  <td className="border border-emerald-900 p-0 bg-emerald-950"></td>
                  <td className="border border-emerald-900 p-0 text-left text-white font-black whitespace-nowrap font-mono bg-emerald-950">{cellNum(agg.tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
