import React, { useMemo, useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import schemaJson from "@/lib/expensesSchema.json";

// ====== نوع الصف في شجرة الاستخدامات ======
type Row = { n: string; b: number | ""; c: number | ""; d: number | ""; e: number | ""; lv: "header" | "bab" | "fasl" | "band" | "type" | "sub" };
const schema = schemaJson as { rows: Row[]; totals: string[] };

// ====== أسماء الأشهر ======
const MONTHS = ["يناير","فبراير","مارس","ابريل","مايو","يونيو","يوليو","اغسطس","سبتمبر","اكتوبر","نوفمبر","ديسمبر"];
const QUARTERS = [
  { key: "p1", label: "المدة الأولى", months: [0,1,2] },
  { key: "p2", label: "المدة الثانية", months: [3,4,5] },
  { key: "p3", label: "المدة الثالثة", months: [6,7,8] },
  { key: "p4", label: "المدة الرابعة", months: [9,10,11] },
];

const YEAR_DEFAULT = 2025;
const STORAGE_KEY = "expenses-data-v1";

type Cell = { f: number; r: number }; // فلس، ريال
type Store = Record<string, Cell>; // key = `${year}-${monthIdx}-${rowIdx}`

const emptyCell: Cell = { f: 0, r: 0 };

function loadStore(): Store {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveStore(s: Store) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

// تحديد ما إذا كان الصف ورقة ادخال (نوع) أم تجميعي
const isLeaf = (r: Row) => r.lv === "type";

// ===== حساب الصفوف التجميعية: لكل صف نحدد أبناءه (الصفوف التالية حتى مستوى أعلى) =====
function computeAggregates(values: Cell[]): Cell[] {
  // values مصفوفة بطول schema.rows.length تحتوي قيم الصفوف الورقية، نملأ التجميعيات.
  const rows = schema.rows;
  const out = values.map(v => ({ ...v }));
  // نمر بالعكس: لكل صف غير ورقي نجمع أبناءه (الصفوف بمستوى أعمق حتى نلتقي بصف بنفس مستواه أو أعلى)
  const levelRank: Record<string, number> = { header: 0, bab: 1, fasl: 2, band: 3, type: 4, sub: 5 };
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (isLeaf(r)) continue;
    if (r.lv === "sub") continue;
    let sumF = 0, sumR = 0;
    const myRank = levelRank[r.lv];
    for (let j = i + 1; j < rows.length; j++) {
      const child = rows[j];
      const childRank = levelRank[child.lv];
      if (childRank <= myRank) break;
      if (isLeaf(child)) {
        sumF += out[j].f;
        sumR += out[j].r;
      }
    }
    // تطبيع: الفلس قد يتجاوز 100 → ينقل للريال (بافتراض 100 فلس = 1 ريال)
    sumR += Math.floor(sumF / 100);
    sumF = sumF % 100;
    out[i] = { f: sumF, r: sumR };
  }
  return out;
}

// ===== أنماط الألوان =====
const rowClass = (lv: Row["lv"]) => {
  switch (lv) {
    case "header": return "bg-teal-700 text-white font-bold";
    case "bab":    return "bg-emerald-100 text-emerald-900 font-bold";
    case "fasl":   return "bg-yellow-100 text-amber-900 font-semibold";
    case "band":   return "bg-sky-50 text-slate-800 font-medium";
    case "type":   return "bg-white text-slate-700";
    default:       return "bg-slate-50 text-slate-600 italic";
  }
};

const fmtNum = (n: number) => n === 0 ? "0" : n.toLocaleString("en-US");

// ============================================================
// ============ المكون الرئيسي ================================
// ============================================================
export default function ExpensesTab() {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [year] = useState<number>(YEAR_DEFAULT);
  // التبويب الفرعي: cover | m0..m11 | p1..p4 | final | year
  const [view, setView] = useState<string>("cover");

  useEffect(() => { saveStore(store); }, [store]);

  // ========= بناء قيم الأشهر (مصفوفة 12 × صفوف) =========
  const monthlyLeaves: Cell[][] = useMemo(() => {
    return MONTHS.map((_, m) =>
      schema.rows.map((_, idx) => store[`${year}-${m}-${idx}`] || emptyCell)
    );
  }, [store, year]);

  // قيم كل شهر مع التجميعات
  const monthlyComputed: Cell[][] = useMemo(
    () => monthlyLeaves.map(v => computeAggregates(v)),
    [monthlyLeaves]
  );

  // =================== تحديث خلية ===================
  const updateCell = (monthIdx: number, rowIdx: number, field: "f" | "r", val: number) => {
    setStore(prev => {
      const key = `${year}-${monthIdx}-${rowIdx}`;
      const cur = prev[key] || emptyCell;
      const next = { ...cur, [field]: val };
      if (next.f === 0 && next.r === 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: next };
    });
  };

  // ====== دالة جمع كل الصفوف لمصفوفة قيم ======
  const sumCells = (arrs: Cell[][]): Cell[] => {
    if (arrs.length === 0) return schema.rows.map(() => emptyCell);
    return schema.rows.map((_, idx) => {
      let f = 0, r = 0;
      arrs.forEach(a => { f += a[idx].f; r += a[idx].r; });
      r += Math.floor(f / 100); f = f % 100;
      return { f, r };
    });
  };

  // ========= عرض الغلاف =========
  const renderCover = () => (
    <div className="bg-white rounded-2xl border-2 border-teal-700 p-8 text-center space-y-4 shadow-md max-w-3xl mx-auto" dir="rtl">
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-teal-900">الجمهورية اليمنية</h3>
        <h4 className="text-lg font-semibold text-teal-800">وزارة المالية</h4>
      </div>
      <div className="border-t-2 border-b-2 border-teal-700 py-6 my-6">
        <h2 className="text-3xl font-extrabold text-teal-900 mb-2">كشف الحساب الشهري</h2>
        <p className="text-base text-slate-700">عن العام المالي <span className="font-bold">{year}م</span></p>
      </div>
      <div className="space-y-2 text-right max-w-md mx-auto text-slate-800">
        <p>المحافظة : <span className="font-bold">صعـــدة</span></p>
        <p>المديرية : <span className="font-bold">مركز المحافظة</span></p>
        <p>المكتب : <span className="font-bold">المجلس الطبي فرع صعدة</span></p>
      </div>
    </div>
  );

  // ========= جدول كشف شهري/مدة/سنوي =========
  const renderSheet = (opts: {
    title: string;
    subtitle: string;
    currentLabel: string;
    previousLabel: string;
    currentValues: Cell[];
    previousValues: Cell[];
    editable: boolean;
    editMonthIdx?: number;
  }) => {
    const totalValues: Cell[] = schema.rows.map((_, idx) => {
      let f = opts.currentValues[idx].f + opts.previousValues[idx].f;
      let r = opts.currentValues[idx].r + opts.previousValues[idx].r;
      r += Math.floor(f / 100); f = f % 100;
      return { f, r };
    });

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm" dir="rtl">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white p-3 rounded-t-xl text-center">
          <h3 className="text-base sm:text-lg font-bold">{opts.title}</h3>
          <p className="text-xs opacity-90">{opts.subtitle}</p>
          <p className="text-[10px] opacity-80 mt-0.5">المجلس اليمني للاختصاصات الطبية فرع - صعدة</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold z-10">
              <tr className="border-b border-slate-300">
                <th rowSpan={2} className="border border-slate-200 p-1 min-w-[260px]">بيان مفردات الاستخدامات</th>
                <th rowSpan={2} className="border border-slate-200 p-1 w-10">الباب</th>
                <th rowSpan={2} className="border border-slate-200 p-1 w-10">الفصل</th>
                <th rowSpan={2} className="border border-slate-200 p-1 w-10">البند</th>
                <th rowSpan={2} className="border border-slate-200 p-1 w-10">النوع</th>
                <th colSpan={2} className="border border-slate-200 p-1 bg-amber-50">{opts.currentLabel}</th>
                <th colSpan={2} className="border border-slate-200 p-1 bg-sky-50">{opts.previousLabel}</th>
                <th colSpan={2} className="border border-slate-200 p-1 bg-emerald-50">الجملة</th>
              </tr>
              <tr className="border-b border-slate-300 text-[10px]">
                <th className="border border-slate-200 p-1 bg-amber-50 w-12">ف</th>
                <th className="border border-slate-200 p-1 bg-amber-50 w-20">ريال</th>
                <th className="border border-slate-200 p-1 bg-sky-50 w-12">ف</th>
                <th className="border border-slate-200 p-1 bg-sky-50 w-20">ريال</th>
                <th className="border border-slate-200 p-1 bg-emerald-50 w-12">ف</th>
                <th className="border border-slate-200 p-1 bg-emerald-50 w-20">ريال</th>
              </tr>
            </thead>
            <tbody>
              {schema.rows.map((r, idx) => {
                const cur = opts.currentValues[idx];
                const prev = opts.previousValues[idx];
                const tot = totalValues[idx];
                const editableLeaf = opts.editable && isLeaf(r) && opts.editMonthIdx !== undefined;
                return (
                  <tr key={idx} className={`${rowClass(r.lv)} border-b border-slate-200`}>
                    <td className="border border-slate-200 px-2 py-1 text-right">{r.n}</td>
                    <td className="border border-slate-200 text-center font-mono">{r.b || ""}</td>
                    <td className="border border-slate-200 text-center font-mono">{r.c || ""}</td>
                    <td className="border border-slate-200 text-center font-mono">{r.d || ""}</td>
                    <td className="border border-slate-200 text-center font-mono">{r.e || ""}</td>
                    {editableLeaf ? (
                      <>
                        <td className="border border-slate-200 p-0.5">
                          <input type="number" min={0} value={cur.f || ""} onChange={e => updateCell(opts.editMonthIdx!, idx, "f", Number(e.target.value) || 0)} className="w-full text-center text-xs px-1 py-0.5 border border-transparent focus:border-teal-500 outline-none bg-transparent" />
                        </td>
                        <td className="border border-slate-200 p-0.5">
                          <input type="number" min={0} value={cur.r || ""} onChange={e => updateCell(opts.editMonthIdx!, idx, "r", Number(e.target.value) || 0)} className="w-full text-center text-xs px-1 py-0.5 border border-transparent focus:border-teal-500 outline-none bg-transparent" />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border border-slate-200 text-center font-mono">{fmtNum(cur.f)}</td>
                        <td className="border border-slate-200 text-center font-mono">{fmtNum(cur.r)}</td>
                      </>
                    )}
                    <td className="border border-slate-200 text-center font-mono">{fmtNum(prev.f)}</td>
                    <td className="border border-slate-200 text-center font-mono">{fmtNum(prev.r)}</td>
                    <td className="border border-slate-200 text-center font-mono font-semibold">{fmtNum(tot.f)}</td>
                    <td className="border border-slate-200 text-center font-mono font-semibold">{fmtNum(tot.r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ========= عرض شهر معين =========
  const renderMonth = (m: number) => {
    const cur = monthlyComputed[m];
    const prev = sumCells(monthlyComputed.slice(0, m));
    return renderSheet({
      title: "كشف الحساب الشهري",
      subtitle: `عن شهر ${MONTHS[m]} من العام المالي ${year}م`,
      currentLabel: "الشهر الجاري",
      previousLabel: "الأشهر السابقة",
      currentValues: cur,
      previousValues: prev,
      editable: true,
      editMonthIdx: m,
    });
  };

  // ========= عرض مدة (ربع سنة) =========
  const renderQuarter = (qIdx: number) => {
    const q = QUARTERS[qIdx];
    const cur = sumCells(q.months.map(mi => monthlyComputed[mi]));
    const prevMonths: number[] = [];
    for (let p = 0; p < qIdx; p++) prevMonths.push(...QUARTERS[p].months);
    const prev = sumCells(prevMonths.map(mi => monthlyComputed[mi]));
    return renderSheet({
      title: "كشف حساب المدة",
      subtitle: `${q.label} من العام المالي ${year}م`,
      currentLabel: q.label,
      previousLabel: "المدد السابقة",
      currentValues: cur,
      previousValues: prev,
      editable: false,
    });
  };

  // ========= العرض النهائي =========
  const renderFinal = () => {
    const cur = sumCells(monthlyComputed);
    const prev = schema.rows.map(() => emptyCell);
    return renderSheet({
      title: "كشف الحساب النهائي (الأخيرة)",
      subtitle: `إجمالي العام المالي ${year}م`,
      currentLabel: "إجمالي العام",
      previousLabel: "—",
      currentValues: cur,
      previousValues: prev,
      editable: false,
    });
  };

  // ========= كشف السنة =========
  const renderYear = () => {
    const cur = sumCells(monthlyComputed);
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm" dir="rtl">
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white p-3 rounded-t-xl text-center">
          <h3 className="text-base sm:text-lg font-bold">كشف حساب السنة</h3>
          <p className="text-xs opacity-90">ملخص جميع الأشهر للعام {year}م</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold">
              <tr>
                <th className="border border-slate-200 p-1 min-w-[240px]">البيان</th>
                {MONTHS.map(m => (
                  <th key={m} className="border border-slate-200 p-1 min-w-[70px]">{m}</th>
                ))}
                <th className="border border-slate-200 p-1 bg-emerald-50 min-w-[90px]">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {schema.rows.map((r, idx) => (
                <tr key={idx} className={`${rowClass(r.lv)} border-b border-slate-200`}>
                  <td className="border border-slate-200 px-2 py-1 text-right">{r.n}</td>
                  {MONTHS.map((_, mi) => (
                    <td key={mi} className="border border-slate-200 text-center font-mono">
                      {fmtNum(monthlyComputed[mi][idx].r)}
                    </td>
                  ))}
                  <td className="border border-slate-200 text-center font-mono font-bold bg-emerald-50">
                    {fmtNum(cur[idx].r)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ====== شريط التبويبات الفرعي ======
  const subTabs: { key: string; label: string; group: string }[] = [
    { key: "cover", label: "الغلاف", group: "intro" },
    ...MONTHS.map((m, i) => ({ key: `m${i}`, label: m, group: "month" })),
    ...QUARTERS.map(q => ({ key: q.key, label: q.label, group: "period" })),
    { key: "final", label: "الأخيرة", group: "final" },
    { key: "year", label: "كشف السنة", group: "year" },
  ];

  const groupClass = (g: string) => {
    if (g === "intro") return "bg-slate-700";
    if (g === "month") return "bg-teal-700";
    if (g === "period") return "bg-amber-600";
    if (g === "final") return "bg-rose-700";
    return "bg-indigo-700";
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* شريط التبويبات الفرعي + أزرار الطباعة والتصدير والمسح */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto flex-1 min-w-0">
          <div className="flex gap-1 w-max min-w-full">
            {subTabs.map(t => {
              const active = view === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={`px-2.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    active
                      ? `${groupClass(t.group)} text-white shadow-md`
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const el = document.getElementById("expenses-view-content");
              if (!el) return;
              const w = window.open("", "_blank", "width=1200,height=800");
              if (!w) return;
              w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>المصروفات - ${view}</title>
                <style>@page{size:A4 landscape;margin:8mm}body{font-family:Tajawal,Cairo,Tahoma,Arial,sans-serif;padding:10px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:right}thead th{background:#0b3d6d;color:#fff}</style>
                </head><body><h2 style="text-align:center;color:#10528e">جدول المصروفات - ${year}م</h2>${el.innerHTML}
                <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
              w.document.close();
            }}
            className="px-3 py-1.5 bg-white text-[#10528e] border border-[#10528e]/30 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-50"
          >🖨️ طباعة</button>
          <button
            onClick={() => {
              const el = document.getElementById("expenses-view-content");
              if (!el) return;
              const tables = el.querySelectorAll("table");
              if (!tables.length) { toast.error("لا يوجد جدول للتصدير"); return; }
              const wb = XLSX.utils.book_new();
              tables.forEach((tb, i) => {
                const ws = XLSX.utils.table_to_sheet(tb as HTMLTableElement);
                XLSX.utils.book_append_sheet(wb, ws, `ورقة${i+1}`.slice(0,30));
              });
              XLSX.writeFile(wb, `المصروفات-${view}-${year}.xlsx`);
              toast.success("تم التصدير");
            }}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700"
          >📊 Excel</button>
          <button
            onClick={() => {
              if (!confirm("هل أنت متأكد من مسح جميع بيانات المصروفات؟")) return;
              setStore({});
              localStorage.removeItem(STORAGE_KEY);
              toast.success("تم مسح البيانات");
            }}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-rose-700"
          >🗑️ مسح</button>
        </div>
      </div>

      {/* محتوى التبويب */}
      <div id="expenses-view-content">
        {view === "cover" && renderCover()}
        {view.startsWith("m") && view.length <= 3 && renderMonth(Number(view.slice(1)))}
        {view.startsWith("p") && renderQuarter(Number(view.slice(1)) - 1)}
        {view === "final" && renderFinal()}
        {view === "year" && renderYear()}
      </div>


      {/* تذييل توضيحي */}
      <div className="text-[10px] text-slate-500 text-center bg-slate-50 p-2 rounded-lg border border-slate-200">
        الصفوف ذات اللون الأبيض (النوع) قابلة للإدخال — والباقي يُحسب تلقائياً. الأشهر السابقة والجملة محسوبة آلياً. المدد السنوية والربعية للقراءة فقط.
      </div>
    </div>
  );
}
