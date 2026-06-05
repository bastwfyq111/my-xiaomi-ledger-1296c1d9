import React, { useMemo, useState } from "react";
import { useStore, type Trainee } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { hafizaPdf } from "@/lib/exportPdf";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { Printer, X, Plus, Edit, Trash2, Search, Save, Eraser, CheckSquare } from "lucide-react";
import TabActions from "./TabActions";

const COLS = [
  { key: "name", label: "الاسم" },
  { key: "batch", label: "الدفعة" },
  { key: "specialty", label: "التخصص" },
  { key: "date", label: "التاريخ" },
  { key: "hafizaNo", label: "رقم الحافظة" },
  { key: "description", label: "البيان" },
  { key: "hafizaAmount", label: "المبلغ" },
  { key: "notifyDate", label: "تاريخ التوريد" },
  { key: "notifyNo", label: "رقم الاشعار" },
  { key: "notifyAmount", label: "مبلغ التوريد" },
];

type Form = {
  name: string; batch: string; specialty: string; date: string;
  hafizaNo: string; description: string; hafizaAmount: string;
  notifyDate: string; notifyNo: string; notifyAmount: string;
};

const empty: Form = {
  name: "", batch: "", specialty: "", date: today(),
  hafizaNo: "", description: "", hafizaAmount: "",
  notifyDate: "", notifyNo: "", notifyAmount: "",
};

export default function HafizaTab() {
  const { trainees, hafiza, addHafiza, deleteHafiza, addTrainee, updateHafiza, clearHafiza } = useStore();
  const [form, setForm] = useState<Form>(empty);
  const [nameQuery, setNameQuery] = useState("");
  const [showSugg, setShowSugg] = useState(false);
  
  // حالة التحكم بالتعديل الفوري داخل الخلايا
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [cellValue, setCellValue] = useState("");

  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(hafiza, COLS.map((c) => c.key));

  // حساب الإجماليات بشكل ديناميكي وتلقائي بناءً على السطور المعروضة حالياً
  const totalHafizaAmount = useMemo(() => {
    return filtered.reduce((sum, item) => sum + (Number(item.hafizaAmount) || 0), 0);
  }, [filtered]);

  const totalNotifyAmount = useMemo(() => {
    return filtered.reduce((sum, item) => sum + (Number(item.notifyAmount) || 0), 0);
  }, [filtered]);

  const nameSuggestions = useMemo(() => {
    const q = nameQuery.trim();
    if (!q) return trainees.slice(0, 8);
    return trainees.filter((t) => t.name.includes(q)).slice(0, 8);
  }, [trainees, nameQuery]);

  const pickName = (t: Trainee) => {
    setForm((f) => ({ ...f, name: t.name, batch: t.batch, specialty: t.specialty }));
    setNameQuery(t.name);
    setShowSugg(false);
  };

  const submit = () => {
    const amount = Number(form.hafizaAmount) || 0;
    const notifyAmt = Number(form.notifyAmount) || 0;

    if (!form.name || !form.hafizaNo) {
      toast.error("يرجى إدخال الاسم ورقم الحافظة على الأقل");
      return;
    }

    addHafiza({
      name: form.name, batch: form.batch, specialty: form.specialty,
      date: form.date, hafizaNo: form.hafizaNo, description: form.description,
      hafizaAmount: amount, notifyDate: form.notifyDate, notifyNo: form.notifyNo,
      notifyAmount: notifyAmt,
    });
    
    if (!trainees.find((t) => t.name === form.name)) {
      addTrainee({ name: form.name, batch: form.batch, specialty: form.specialty });
    }
    toast.success("تم الحفظ بنجاح");
    setForm(empty);
    setNameQuery("");
  };

  const handleCopyAmountsToNotify = () => {
    if (filtered.length === 0) {
      toast.error("لا توجد سجلات حالية لنقل مبالغها");
      return;
    }
    
    filtered.forEach((row) => {
      updateHafiza(row.id, {
        ...row,
        notifyAmount: Number(row.hafizaAmount) || 0
      });
    });
    
    toast.success(`تم نسخ مبالغ الحافظة إلى مبالغ التوريد لـ (${filtered.length}) سجل بنجاح!`);
  };

  const handleCellClick = (rowId: string, colKey: string, currentVal: any) => {
    setActiveCell({ rowId, colKey });
    setCellValue(String(currentVal ?? ""));
  };

  const handleCellSave = (row: any) => {
    if (!activeCell) return;
    
    const { colKey, rowId } = activeCell;
    let finalVal: any = cellValue;
    
    if (colKey === "hafizaAmount" || colKey === "notifyAmount") {
      finalVal = Number(cellValue) || 0;
    }

    updateHafiza(rowId, {
      ...row,
      [colKey]: finalVal
    });

    setActiveCell(null);
    toast.success("تم التحديث التلقائي للخلية");
  };

  return (
    <div className="w-full space-y-6 p-0" dir="rtl">
      
      {/* ========== قسم إضافة حافظة توريد جديدة ========== */}
      <div className="w-full bg-white shadow-md border border-slate-200/80 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-indigo-600 via-purple-600 to-pink-600 px-4 py-4 flex flex-wrap justify-between items-center gap-3 shadow-inner">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide">إضافة حافظة توريد جديدة</h2>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 hover:bg-white/15 transition-colors">
            <ImportButton kind="hafiza" />
          </div>
        </div>
        
        <div className="p-4 sm:p-5 bg-slate-50/30">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="relative sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم *</label>
              <div className="relative">
                <input
                  value={nameQuery}
                  onChange={(e) => { setNameQuery(e.target.value); setForm({ ...form, name: e.target.value }); setShowSugg(true); }}
                  onFocus={() => setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                  placeholder="ابحث أو اكتب اسم المتدرب..."
                  className="w-full pl-3 pr-9 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all shadow-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              {showSugg && nameSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {nameSuggestions.map((t) => (
                    <li key={t.name}>
                      <button type="button" onMouseDown={() => pickName(t)} className="w-full text-right px-4 py-2.5 hover:bg-indigo-50/50 border-b last:border-0 transition-colors">
                        <div className="font-bold text-sm text-slate-800">{t.name}</div>
                        <div className="text-xs text-indigo-600 mt-0.5 font-medium">{t.specialty} — {t.batch}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <Field label="الدفعة" v={form.batch} on={(v) => setForm({ ...form, batch: v })} />
            <Field label="التخصص" v={form.specialty} on={(v) => setForm({ ...form, specialty: v })} />
            <Field label="التاريخ" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
            <Field label="رقم الحافظة *" v={form.hafizaNo} on={(v) => setForm({ ...form, hafizaNo: v })} />
            <Field label="مبلغ الحافظة *" type="number" v={form.hafizaAmount} on={(v) => setForm({ ...form, hafizaAmount: v })} />
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البيان</label>
              <input
                list="hafiza-descriptions"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="اكتب أو اختر..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all shadow-sm"
              />
              <datalist id="hafiza-descriptions">
                {Array.from(new Set([...DESCRIPTIONS, ...hafiza.map((h) => h.description).filter(Boolean)])).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            
            <Field label="تاريخ التوريد" type="date" v={form.notifyDate} on={(v) => setForm({ ...form, notifyDate: v })} />
            <Field label="رقم الاشعار" v={form.notifyNo} on={(v) => setForm({ ...form, notifyNo: v })} />
            <Field label="مبلغ التوريد" type="number" v={form.notifyAmount} on={(v) => setForm({ ...form, notifyAmount: v })} />
          </div>
          
          <div className="mt-5 flex gap-3 flex-wrap border-t border-slate-100 pt-4">
            <button onClick={submit} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all text-sm shadow-md shadow-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">
              <Save className="w-4 h-4" /> حفظ وترحيل تلقائي
            </button>
            <button onClick={() => { setForm(empty); setNameQuery(""); }} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 bg-white rounded-lg font-semibold hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-sm shadow-sm">
              <Eraser className="w-4 h-4 text-slate-500" /> مسح الحقول
            </button>
          </div>
        </div>
      </div>

      {/* ========== سجل حوافظ التوريد الذكي الجدول التفاعلي ========== */}
      <div className="w-full bg-white shadow-md border border-blue-100 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-blue-600 to-cyan-600 px-4 py-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">📑 سجل حوافظ التوريد <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs font-mono">{hafiza.length}</span></h2>
            <p className="text-xs text-blue-50/80 mt-0.5">اضغط مباشرة على أي خلية لتعديل قيمتها فوراً • صف الإجمالي في الأسفل ديناميكي</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button 
              onClick={handleCopyAmountsToNotify} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-extrabold rounded-lg text-xs shadow-md transition-all font-tajawal"
            >
              <CheckSquare className="w-4 h-4" /> نسخ المبالغ للتوريد ⚡
            </button>
            
            <button onClick={clearFilters} className="px-3 py-1.5 bg-blue-700/40 hover:bg-blue-700/60 active:scale-95 text-white rounded-lg text-xs font-bold transition-all border border-blue-400/30">
              مسح التصفية
            </button>
            {/* تم دمج زر الطباعة داخل TabActions لمنع التكرار */}
            <TabActions
              title="حوافظ التوريد" rows={hafiza} columns={COLS} fileName="حوافظ-التوريد"
              numericKeys={["hafizaAmount","notifyAmount"]} onClear={clearHafiza}
            />
          </div>
        </div>
        
        <div className="p-3 sm:p-4">
          <div className="overflow-auto max-h-[60vh] rounded-lg border border-indigo-200 shadow-sm relative">
            <table className="w-full text-xs sm:text-sm">
              <thead className="font-bold text-slate-800 sticky top-0 z-20">
                <tr className="bg-gradient-to-l from-indigo-100 via-purple-50 to-pink-50">
                  <th className="p-2.5 text-center w-10 bg-indigo-100">م</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-2.5 text-right whitespace-nowrap cursor-pointer select-none hover:bg-indigo-200/60 transition-colors" onClick={() => toggleSort(c.key)}>
                      <div className="flex items-center gap-1">
                        {c.label} <span className="text-[10px] text-indigo-500">{sortIndicator(sortKey === c.key, sortDir)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2.5 text-center">إجراءات</th>
                </tr>
                <tr className="bg-white border-t border-indigo-100">
                  <th className="p-1.5"></th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-1.5">
                      <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="بحث..." className="w-full px-2 py-1 text-xs border border-indigo-200 rounded outline-none focus:border-indigo-500 bg-white shadow-inner" />
                    </th>
                  ))}
                  <th className="p-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((h, i) => (
                  <tr key={h.id} className="hover:bg-indigo-50/20 transition-colors group">
                    <td className="p-2.5 text-center text-slate-400 font-mono bg-slate-50/50">{i + 1}</td>
                    
                    {COLS.map((col) => {
                      const isEditing = activeCell?.rowId === h.id && activeCell?.colKey === col.key;
                      return (
                        <td 
                          key={col.key} 
                          onClick={() => handleCellClick(h.id, col.key, (h as any)[col.key])}
                          className={`p-2 cursor-pointer transition-all border border-transparent hover:border-indigo-300 hover:bg-yellow-50/40 relative ${
                            col.key === 'hafizaAmount' ? 'font-mono font-bold text-emerald-700 bg-emerald-50/10' : 
                            col.key === 'notifyAmount' ? 'font-mono font-bold text-blue-700 bg-blue-50/10' : 'text-slate-700'
                          }`}
                        >
                          {isEditing ? (
                            <input 
                              type={col.key === 'hafizaAmount' || col.key === 'notifyAmount' ? 'number' : col.key === 'date' || col.key === 'notifyDate' ? 'date' : 'text'}
                              value={cellValue}
                              autoFocus
                              onChange={(e) => setCellValue(e.target.value)}
                              onBlur={() => handleCellSave(h)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleCellSave(h); if (e.key === 'Escape') setActiveCell(null); }}
                              className="w-full p-1 border-2 border-indigo-500 rounded outline-none bg-white text-slate-900 shadow-md font-sans text-xs z-10"
                            />
                          ) : (
                            <span className="block min-h-[20px] w-full">
                              {col.key === "hafizaAmount" || col.key === "notifyAmount" 
                                ? fmt((h as any)[col.key]) 
                                : ((h as any)[col.key] || "—")}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td className="p-2 text-center whitespace-nowrap">
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (confirm("هل أنت متأكد من حذف هذه الحافظة نهائياً؟")) deleteHafiza(h.id); }} 
                        className="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-500 hover:text-white active:scale-90 transition-all opacity-80 group-hover:opacity-100" 
                        title="حذف السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400 bg-slate-50 font-medium">
                      لا توجد بيانات مطابقة للبحث حالياً
                    </td>
                  </tr>
                )}
              </tbody>

              {/* ========== صف الإجماليات المضاف والمميز بلون ذهبي رمادي أنيق ========== */}
              {filtered.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 sticky bottom-0 z-10 text-slate-800">
                  <tr>
                    <td className="p-3 text-center bg-slate-200">∑</td>
                    <td className="p-3 text-right text-slate-900 font-extrabold text-sm">الإجمالي المالي للتقرير</td>
                    <td className="p-3">—</td>
                    <td className="p-3">—</td>
                    <td className="p-3">—</td>
                    <td className="p-3">—</td>
                    <td className="p-3">—</td>
                    {/* إجمالي عمود المبلغ */}
                    <td className="p-3 font-mono font-extrabold text-emerald-800 bg-emerald-100/80 text-sm">
                      {fmt(totalHafizaAmount)}
                    </td>
                    <td className="p-3">—</td>
                    <td className="p-3">—</td>
                    {/* إجمالي عمود مبلغ التوريد */}
                    <td className="p-3 font-mono font-extrabold text-blue-800 bg-blue-100/80 text-sm">
                      {fmt(totalNotifyAmount)}
                    </td>
                    <td className="p-3 bg-slate-200"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all shadow-sm"
      />
    </div>
  );
}
