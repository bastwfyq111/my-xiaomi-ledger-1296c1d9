import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import schema from "@/data/revenueTemplate.json";
import { exportRevenueStatement } from "@/lib/exportImport";
import { revenuePdf } from "@/lib/exportPdf";

// استيراد الأيقونات
import { Calendar, FileSpreadsheet, FileText, LayoutGrid, DollarSign, Trash2 } from "lucide-react";

const MONTH_NAMES = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

type Type = { no: number; title: string };
type Item = { no: number; title: string; types: Type[] };
type Section = { no: number; title: string; items: Item[] };
type Chapter = { no: number; title: string; longTitle?: string; sections: Section[] };

const SCHEMA = schema as { title: string; office: string; chapters: Chapter[] };

// توليد مفتاح التخزين المركب
export function typeKey(c: number, s: number, i: number, t: number) {
  return `${c}-${s}-${i}-${t}`;
}

export default function RevenueTab() {
  const { revenue, setRevenue } = useStore() as any;
  
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const get = (y: number, m: number, key: string) => revenue[`${y}-${m}-${key}`] || 0;

  // العمليات الحسابية (لم يتم تغييرها)
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
    <div className="w-full space-y-6 text-right" dir="rtl">
      
      {/* لوحة التحكم */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap items-end justify-between gap-6">
        
        {/* اختيار التاريخ */}
        <div className="flex gap-4 flex-wrap w-full md:w-auto">
          <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>الشهر المحاسبي</span>
            </label>
            <select 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 transition-all"
            >
              {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>السنة المالية</span>
            </label>
            <input 
              type="number" 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value) || year)}
              className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-right" 
            />
          </div>
        </div>

        {/* تجميع الأزرار في حاوية واحدة (Button Group) */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-xl border border-slate-200 gap-1.5 w-full md:w-auto">
          <button 
            onClick={() => exportRevenueStatement(revenue, year)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm font-bold text-xs rounded-lg transition-all flex-1"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير Excel</span>
          </button>
          
          <button 
            onClick={() => revenuePdf(revenue, year, month)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white shadow-sm font-bold text-xs rounded-lg transition-all flex-1"
          >
            <FileText className="w-4 h-4" />
            <span>طباعة / PDF</span>
          </button>

          <button
            onClick={() => {
              if (!confirm("هل أنت متأكد من مسح جميع بيانات الإيرادات؟ لا يمكن التراجع.")) return;
              useStore.setState({ revenue: {} });
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 shadow-sm font-bold text-xs rounded-lg transition-all flex-1"
          >
            <Trash2 className="w-4 h-4" />
            <span>مسح البيانات</span>
          </button>
        </div>
      </div>

      {/* منطقة الجدول */}
      <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        
        {/* الترويسة العلوية - تعديل العنوان */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white p-6 text-center space-y-2 border-b-2 border-black">
          <h2 className="font-extrabold text-2xl font-cairo tracking-wide">كشف حساب الإيرادات الشهري</h2>
          <p className="text-sm opacity-90 font-medium">{SCHEMA.office}</p>
          <div className="inline-flex items-center gap-1.5 bg-white/10 px-4 py-1.5 rounded-full text-xs font-semibold mt-2">
            <LayoutGrid className="w-4 h-4" />
            <span>عن شهر {MONTH_NAMES[month - 1]} من العام المالي {year}م</span>
          </div>
        </div>

        {/* الجدول بحدود سوداء واحتواء للخلايا */}
        <div className="w-full overflow-auto max-h-[70vh]">
          <table className="w-full text-right border-collapse text-xs md:text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-200 text-black font-bold border-b-2 border-black">
                <th rowSpan={2} className="border border-black p-2 text-right whitespace-nowrap">بيان مفردات الموارد المعتمدة</th>
                <th rowSpan={2} className="border border-black p-2 text-center whitespace-nowrap">الباب</th>
                <th rowSpan={2} className="border border-black p-2 text-center whitespace-nowrap">الفصل</th>
                <th rowSpan={2} className="border border-black p-2 text-center whitespace-nowrap">البند</th>
                <th rowSpan={2} className="border border-black p-2 text-center whitespace-nowrap">النوع</th>
                <th colSpan={2} className="border border-black p-2 text-center bg-teal-100">الشهر الجاري</th>
                <th colSpan={2} className="border border-black p-2 text-center bg-slate-100">الأشهر السابقة</th>
                <th colSpan={2} className="border border-black p-2 text-center bg-emerald-100">الجملــة والتراكمي</th>
              </tr>
              <tr className="bg-slate-100 text-black font-bold border-b-2 border-black">
                <th className="border border-black p-1 text-center whitespace-nowrap">ف</th><th className="border border-black p-1 text-center whitespace-nowrap">ريال</th>
                <th className="border border-black p-1 text-center whitespace-nowrap">ف</th><th className="border border-black p-1 text-center whitespace-nowrap">ريال</th>
                <th className="border border-black p-1 text-center whitespace-nowrap">ف</th><th className="border border-black p-1 text-center whitespace-nowrap">ريال</th>
              </tr>
            </thead>
            <tbody className="text-black font-medium">
              
              {/* السطر الإجمالي العلوي */}
              <tr className="bg-teal-50 font-bold border-b-2 border-black">
                <td className="border border-black p-2 text-right font-cairo whitespace-nowrap">إجمالي الموارد العامة للوحدة</td>
                <td colSpan={4} className="border border-black bg-slate-50"></td>
                <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.grandCur)}</td>
                <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.grandPrev)}</td>
                <td className="border border-black bg-emerald-50"></td><td className="border border-black p-2 font-mono text-left bg-emerald-100 whitespace-nowrap">{cellNum(data.grandCur + data.grandPrev)}</td>
              </tr>

              {SCHEMA.chapters.map((ch) =>
                ch.sections.length === 0 ? null : (
                  <Fragment key={`ch-${ch.no}`}>
                    {/* الأبواب */}
                    <tr className="bg-slate-200 font-bold border-b border-black">
                      <td className="border border-black p-2 text-right font-cairo whitespace-nowrap">{ch.longTitle || ch.title}</td>
                      <td className="border border-black p-2 text-center">{ch.no}</td>
                      <td colSpan={3} className="border border-black bg-slate-100"></td>
                      <td className="border border-black bg-slate-100"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.chaptersAgg[ch.no].cur)}</td>
                      <td className="border border-black bg-slate-100"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.chaptersAgg[ch.no].prev)}</td>
                      <td className="border border-black bg-slate-100"></td><td className="border border-black p-2 font-mono text-left bg-slate-300 whitespace-nowrap">{cellNum(data.chaptersAgg[ch.no].tot)}</td>
                    </tr>
                    
                    {ch.sections.map((sec) => (
                      <Fragment key={`sec-${ch.no}-${sec.no}`}>
                        {/* الفصول */}
                        <tr className="bg-slate-100 font-semibold border-b border-black">
                          <td className="border border-black pr-4 p-2 text-right whitespace-nowrap">{sec.title}</td>
                          <td className="border border-black bg-slate-50"></td>
                          <td className="border border-black p-2 text-center">{sec.no}</td>
                          <td colSpan={2} className="border border-black bg-slate-50"></td>
                          <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].cur)}</td>
                          <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].prev)}</td>
                          <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].tot)}</td>
                        </tr>
                        
                        {sec.items.map((it) => (
                          <Fragment key={`it-${ch.no}-${sec.no}-${it.no}`}>
                            {/* البنود */}
                            <tr className="bg-white border-b border-black">
                              <td className="border border-black pr-8 p-2 text-right whitespace-nowrap">{it.title}</td>
                              <td colSpan={2} className="border border-black bg-slate-50"></td>
                              <td className="border border-black p-2 text-center">{it.no}</td>
                              <td className="border border-black bg-slate-50"></td>
                              <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].cur)}</td>
                              <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].prev)}</td>
                              <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].tot)}</td>
                            </tr>
                            
                            {it.types.map((t) => {
                              const k = typeKey(ch.no, sec.no, it.no, t.no);
                              const v = data.types[k];
                              return (
                                /* الأنواع (الإدخال) */
                                <tr key={k} className="bg-white hover:bg-teal-50 transition-colors border-b border-black">
                                  <td className="border border-black pr-12 p-2 text-right whitespace-nowrap">{t.title}</td>
                                  <td colSpan={3} className="border border-black bg-slate-50"></td>
                                  <td className="border border-black p-2 text-center">{t.no}</td>
                                  <td className="border border-black bg-slate-50"></td>
                                  
                                  {/* خانة الإدخال */}
                                  <td className="border border-black p-1 bg-teal-50/30">
                                    <div className="relative flex items-center w-full min-w-[100px]">
                                      <input
                                        type="number"
                                        value={v.cur || ""}
                                        onChange={(e) => setRevenue(year, month, k, Number(e.target.value) || 0)}
                                        className="w-full pl-6 pr-2 py-1 bg-transparent text-black font-mono text-left font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-black border border-transparent focus:border-black"
                                        placeholder="0"
                                      />
                                      <DollarSign className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                                    </div>
                                  </td>
                                  
                                  <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(v.prev)}</td>
                                  <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left font-bold whitespace-nowrap">{cellNum(v.tot)}</td>
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

              {/* مجاميع الأبواب */}
              <tr className="bg-slate-200 font-bold border-t-2 border-black">
                <td colSpan={5} className="p-3 text-center text-sm font-cairo border border-black">ملخص مجاميع الحسابات والأبواب</td>
                <td colSpan={6} className="border border-black bg-slate-100"></td>
              </tr>
              {SCHEMA.chapters.map((ch) => {
                const agg = data.chaptersAgg[ch.no] || { cur: 0, prev: 0, tot: 0 };
                const order = ["اﻷول","الثاني","الثالث","الرابع","الخامس"];
                return (
                  <tr key={`subt-${ch.no}`} className="bg-slate-100 font-bold border-b border-black">
                    <td colSpan={5} className="border border-black p-2 text-right whitespace-nowrap">جملة إيرادات الباب {order[ch.no - 1]} : {ch.title}</td>
                    <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(agg.cur)}</td>
                    <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left whitespace-nowrap">{cellNum(agg.prev)}</td>
                    <td className="border border-black bg-slate-50"></td><td className="border border-black p-2 font-mono text-left bg-slate-200 whitespace-nowrap">{cellNum(agg.tot)}</td>
                  </tr>
                );
              })}
              
              {/* الإجمالي النهائي */}
              <tr className="bg-teal-100 font-black border-t-4 border-black">
                <td colSpan={5} className="border border-black p-3 text-right text-sm font-cairo whitespace-nowrap">الإجمالي العام والنهائي لجميع موارد المجلس</td>
                <td className="border border-black bg-teal-50"></td><td className="border border-black p-3 font-mono text-left text-base whitespace-nowrap">{cellNum(data.grandCur)}</td>
                <td className="border border-black bg-teal-50"></td><td className="border border-black p-3 font-mono text-left text-base whitespace-nowrap">{cellNum(data.grandPrev)}</td>
                <td className="border border-black bg-emerald-100"></td><td className="border border-black p-3 font-mono text-left bg-emerald-200 text-base whitespace-nowrap">{cellNum(data.grandCur + data.grandPrev)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
