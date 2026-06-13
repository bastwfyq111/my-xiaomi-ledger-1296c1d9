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
      
      {/* الفلاتر والأزرار الأصلية كما هي */}
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

      {/* ترويسة الجدول الأصلية */}
      <div className="text-center my-4">
        <h2 className="text-xl font-bold text-gray-800">{SCHEMA.title}</h2>
        <p className="text-sm text-gray-600">{SCHEMA.office}</p>
        <p className="text-xs text-gray-500 font-semibold mt-1">
          الفترة: من يناير {year}م إلى نهاية شهر {MONTH_NAMES[month - 1]} {year}م
        </p>
      </div>

      {/* حاوية الجدول وجسم الجدول */}
      <div className="w-full overflow-x-auto border rounded-lg">
        {/* تم إضافة min-w-max و table-auto لجعل الخلية تتسع بحجم النص كاملاً أفقياً ورأسياً */}
        <table className="min-w-max w-full table-auto text-right border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700 font-bold">
              {/* 💡 تم تصفير جميع الهوامش p-0 مع إضافة whitespace-nowrap لمنع الالتفاف */}
              <th rowSpan={2} className="border p-0 whitespace-nowrap">بيان مفردات الموارد</th>
              <th rowSpan={2} className="border p-0 text-center whitespace-nowrap">الباب</th>
              <th rowSpan={2} className="border p-0 text-center whitespace-nowrap">الفصل</th>
              <th rowSpan={2} className="border p-0 text-center whitespace-nowrap">البند</th>
              <th rowSpan={2} className="border p-0 text-center whitespace-nowrap">النوع</th>
              <th colSpan={2} className="border p-0 text-center whitespace-nowrap">الشهر الجاري</th>
              <th colSpan={2} className="border p-0 text-center whitespace-nowrap">الأشهر السابقة</th>
              <th colSpan={2} className="border p-0 text-center whitespace-nowrap">الجمله</th>
            </tr>
            <tr className="bg-gray-50 text-gray-600 font-bold">
              <th className="border p-0 text-center whitespace-nowrap">ف</th><th className="border p-0 text-center whitespace-nowrap">ريال</th>
              <th className="border p-0 text-center whitespace-nowrap">ف</th><th className="border p-0 text-center whitespace-nowrap">ريال</th>
              <th className="border p-0 text-center whitespace-nowrap">ف</th><th className="border p-0 text-center whitespace-nowrap">ريال</th>
            </tr>
          </thead>
          <tbody>
            
            <tr className="bg-gray-100 font-bold text-gray-900">
              <td className="border p-0 whitespace-nowrap">إجمالي الموارد</td>
              <td colSpan={4} className="border p-0"></td>
              <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.grandCur)}</td>
              <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.grandPrev)}</td>
              <td className="border p-0"></td><td className="border p-0 text-left bg-gray-200/50 whitespace-nowrap">{cellNum(data.grandCur + data.grandPrev)}</td>
            </tr>

            {SCHEMA.chapters.map((ch) =>
              ch.sections.length === 0 ? null : (
                <Fragment key={`ch-${ch.no}`}>
                  
                  <tr className="bg-gray-50 font-bold text-gray-800">
                    <td className="border p-0 whitespace-nowrap">{ch.longTitle || ch.title}</td>
                    <td className="border p-0 text-center whitespace-nowrap">{ch.no}</td>
                    <td colSpan={3} className="border p-0"></td>
                    <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.chaptersAgg[ch.no].cur)}</td>
                    <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.chaptersAgg[ch.no].prev)}</td>
                    <td className="border p-0"></td><td className="border p-0 text-left bg-gray-100 whitespace-nowrap">{cellNum(data.chaptersAgg[ch.no].tot)}</td>
                  </tr>
                  
                  {ch.sections.map((sec) => (
                    <Fragment key={`sec-${ch.no}-${sec.no}`}>
                      
                      <tr className="font-semibold text-gray-700">
                        <td className="border p-0 whitespace-nowrap" style={{ paddingRight: "10px" }}>{sec.title}</td>
                        <td className="border p-0"></td>
                        <td className="border p-0 text-center whitespace-nowrap">{sec.no}</td>
                        <td colSpan={2} className="border p-0"></td>
                        <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].cur)}</td>
                        <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].prev)}</td>
                        <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.sectionsAgg[`${ch.no}-${sec.no}`].tot)}</td>
                      </tr>
                      
                      {sec.items.map((it) => (
                        <Fragment key={`it-${ch.no}-${sec.no}-${it.no}`}>
                          
                          <tr className="text-gray-600">
                            <td className="border p-0 whitespace-nowrap" style={{ paddingRight: "20px" }}>{it.title}</td>
                            <td colSpan={2} className="border p-0"></td>
                            <td className="border p-0 text-center whitespace-nowrap">{it.no}</td>
                            <td className="border p-0"></td>
                            <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].cur)}</td>
                            <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].prev)}</td>
                            <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(data.itemsAgg[`${ch.no}-${sec.no}-${it.no}`].tot)}</td>
                          </tr>
                          
                          {it.types.map((t) => {
                            const k = typeKey(ch.no, sec.no, it.no, t.no);
                            const v = data.types[k];
                            return (
                              <tr key={k} className="text-gray-500 hover:bg-gray-50">
                                <td className="border p-0 whitespace-nowrap" style={{ paddingRight: "30px" }}>{t.title}</td>
                                <td colSpan={3} className="border p-0"></td>
                                <td className="border p-0 text-center whitespace-nowrap">{t.no}</td>
                                <td className="border p-0"></td>
                                
                                {/* حقل المدخلات - تم إلغاء البوردرات الجانبية وجعل الحدود 0 مع p-0 للالتصاق الكامل */}
                                <td className="border p-0 whitespace-nowrap">
                                  <input
                                    type="number"
                                    value={v.cur || ""}
                                    onChange={(e) => setRevenue(year, month, k, Number(e.target.value) || 0)}
                                    className="w-24 p-0 text-left font-bold border-0 focus:outline-none focus:ring-0 text-sm bg-transparent"
                                    placeholder="0"
                                  />
                                </td>
                                
                                <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(v.prev)}</td>
                                <td className="border p-0"></td><td className="border p-0 text-left text-gray-800 font-semibold whitespace-nowrap">{cellNum(v.tot)}</td>
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

            {/* ملخص مجاميع الأبواب */}
            <tr className="bg-gray-100 font-bold text-gray-700 border-t">
              <td colSpan={5} className="p-0 text-center whitespace-nowrap">جملة الباب</td>
              <td colSpan={6} className="p-0 border"></td>
            </tr>
            {SCHEMA.chapters.map((ch) => {
              const agg = data.chaptersAgg[ch.no] || { cur: 0, prev: 0, tot: 0 };
              return (
                <tr key={`subt-${ch.no}`} className="text-gray-600 font-bold bg-gray-50">
                  <td colSpan={5} className="border p-0 whitespace-nowrap">جملة الباب : {ch.title}</td>
                  <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(agg.cur)}</td>
                  <td className="border p-0"></td><td className="border p-0 text-left whitespace-nowrap">{cellNum(agg.prev)}</td>
                  <td className="border p-0"></td><td className="border p-0 text-left text-gray-900 bg-gray-100 whitespace-nowrap">{cellNum(agg.tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
