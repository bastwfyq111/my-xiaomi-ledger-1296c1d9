import React, { useMemo, useState } from "react";
import { useStore, type Trainee } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { hafizaPdf } from "@/lib/exportPdf";
import { DESCRIPTIONS } from "@/lib/accounts";
import { toast } from "sonner";
import ImportButton from "./ImportButton";
import { useTableControls, sortIndicator } from "@/hooks/useTableControls";
import { Printer, X, Plus, Edit, Trash2, Search, Save, Eraser } from "lucide-react";

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
];

type Form = {
  name: string;
  batch: string;
  specialty: string;
  date: string;
  hafizaNo: string;
  description: string;
  hafizaAmount: string;
  notifyDate: string;
  notifyNo: string;
  notifyAmount: string;
};

const empty: Form = {
  name: "", batch: "", specialty: "", date: today(),
  hafizaNo: "", description: "", hafizaAmount: "",
  notifyDate: "", notifyNo: "", notifyAmount: "",
};

// مكون النافذة المنبثقة الموحد (نفس المستخدم في التصميم السابق)
const Modal = ({ title, isOpen, onClose, children }: { title: string; isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-l from-blue-50 to-slate-50 sticky top-0 z-10">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

export default function HafizaTab() {
  const { trainees, hafiza, addHafiza, deleteHafiza, addTrainee, updateHafiza } = useStore();
  const [form, setForm] = useState<Form>(empty);
  const [nameQuery, setNameQuery] = useState("");
  const [showSugg, setShowSugg] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  const { rows: filtered, sortKey, sortDir, toggleSort, filters, setFilter, clearFilters } =
    useTableControls(hafiza, COLS.map((c) => c.key));

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
    toast.success("تم الحفظ في الحوافظ والحساب واليومية بنجاح");
    setForm(empty);
    setNameQuery("");
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    updateHafiza(editingRow.id, {
      ...editingRow,
      hafizaAmount: Number(editingRow.hafizaAmount) || 0,
      notifyAmount: Number(editingRow.notifyAmount) || 0,
    });
    toast.success("تم تعديل الحافظة بنجاح");
    setEditingRow(null);
  };

  return (
    <div className="w-full space-y-6 p-0" dir="rtl">
      
      {/* ========== قسم إضافة حافظة توريد ========== */}
      <div className="w-full bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-slate-700 to-slate-800 px-4 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-white" />
            <h2 className="text-sm sm:text-lg font-bold text-white">إضافة حافظة توريد جديدة</h2>
          </div>
          <div className="bg-white/10 rounded-lg p-1">
             {/* دمج زر الاستيراد بحيث يكون متناسقاً، يمكن استخدامه لاستيراد حوافظ_التوريد.csv */}
            <ImportButton kind="hafiza" />
          </div>
        </div>
        
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم *</label>
              <div className="relative">
                <input
                  value={nameQuery}
                  onChange={(e) => { setNameQuery(e.target.value); setForm({ ...form, name: e.target.value }); setShowSugg(true); }}
                  onFocus={() => setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                  placeholder="ابحث أو اكتب اسم المتدرب..."
                  className="w-full pl-3 pr-9 py-2 text-sm border rounded-lg outline-none focus:border-slate-400 bg-slate-50 transition-colors"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              </div>
              {showSugg && nameSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {nameSuggestions.map((t) => (
                    <li key={t.name}>
                      <button type="button" onMouseDown={() => pickName(t)} className="w-full text-right px-4 py-2.5 hover:bg-slate-50 border-b last:border-0 transition-colors">
                        <div className="font-bold text-sm text-slate-800">{t.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{t.specialty} — {t.batch}</div>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">البيان</label>
              <input
                list="hafiza-descriptions"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="اكتب أو اختر..."
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-slate-400 bg-slate-50 transition-colors"
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
          
          <div className="mt-5 flex gap-3 flex-wrap border-t pt-4">
            <button onClick={submit} className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-sm shadow-md">
              <Save className="w-4 h-4" /> حفظ وترحيل تلقائي
            </button>
            <button onClick={() => { setForm(empty); setNameQuery(""); }} className="flex items-center gap-2 px-5 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm">
              <Eraser className="w-4 h-4" /> مسح الحقول
            </button>
          </div>
        </div>
      </div>

      {/* ========== قسم جدول حوافظ التوريد ========== */}
      <div className="w-full bg-gradient-to-b from-blue-50 to-white shadow border border-blue-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-l from-blue-600 to-blue-700 px-4 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-white">📑 سجل حوافظ التوريد ({hafiza.length})</h2>
            <p className="text-xs text-blue-100 mt-0.5">عرض، تصفية وطباعة حوافظ التوريد المسجلة</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={clearFilters} className="px-3 py-1.5 bg-blue-800/40 hover:bg-blue-800/60 text-white rounded-lg text-xs font-bold transition-colors border border-blue-500/30">
              مسح التصفية
            </button>
            <button onClick={() => hafizaPdf(filtered)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-xs font-bold shadow hover:bg-blue-50 transition-colors">
              <Printer className="w-4 h-4" /> طباعة / PDF
            </button>
          </div>
        </div>
        
        <div className="p-3 sm:p-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="p-2 text-center w-10">م</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-2 text-right whitespace-nowrap cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => toggleSort(c.key)}>
                      <div className="flex items-center gap-1">
                        {c.label} <span className="text-[10px] opacity-50">{sortIndicator(sortKey === c.key, sortDir)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-center">إجراءات</th>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <th className="p-1"></th>
                  {COLS.map((c) => (
                    <th key={c.key} className="p-1">
                      <input value={filters[c.key] || ""} onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="بحث..." className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded outline-none focus:border-blue-400 bg-white" />
                    </th>
                  ))}
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr key={h.id} className="border-t border-slate-200 hover:bg-blue-50/50 transition-colors">
                    <td className="p-2 text-center text-slate-500 font-mono">{i + 1}</td>
                    <td className="p-2 font-bold text-slate-900">{h.name}</td>
                    <td className="p-2 text-slate-600">{h.batch || "—"}</td>
                    <td className="p-2 text-slate-600">{h.specialty || "—"}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600">{h.date}</td>
                    <td className="p-2 font-mono text-slate-700">{h.hafizaNo}</td>
                    <td className="p-2 text-slate-600 truncate max-w-[150px]" title={h.description}>{h.description || "—"}</td>
                    <td className="p-2 font-mono font-bold text-emerald-700 bg-emerald-50/30">{fmt(h.hafizaAmount)}</td>
                    <td className="p-2 whitespace-nowrap text-slate-600">{h.notifyDate || "—"}</td>
                    <td className="p-2 font-mono text-slate-600">{h.notifyNo || "—"}</td>
                    <td className="p-2 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => setEditingRow(h)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-500 hover:text-white transition-colors" title="تعديل">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (confirm("هل أنت متأكد من حذف هذه الحافظة؟")) deleteHafiza(h.id); }} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-500 hover:text-white transition-colors" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 bg-slate-50 font-medium">
                      لا توجد بيانات مطابقة للبحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== نافذة التعديل المنبثقة ========== */}
      <Modal title="✏️ تعديل بيانات الحافظة" isOpen={!!editingRow} onClose={() => setEditingRow(null)}>
        {editingRow && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="sm:col-span-2">
                 <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم</label>
                 <input value={editingRow.name} onChange={(e) => setEditingRow({...editingRow, name: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400 bg-slate-50" required />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">الدفعة</label>
                 <input value={editingRow.batch} onChange={(e) => setEditingRow({...editingRow, batch: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">التخصص</label>
                 <input value={editingRow.specialty} onChange={(e) => setEditingRow({...editingRow, specialty: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">التاريخ</label>
                 <input type="date" value={editingRow.date} onChange={(e) => setEditingRow({...editingRow, date: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" required />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الحافظة</label>
                 <input value={editingRow.hafizaNo} onChange={(e) => setEditingRow({...editingRow, hafizaNo: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" required />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">مبلغ الحافظة</label>
                 <input type="number" value={editingRow.hafizaAmount} onChange={(e) => setEditingRow({...editingRow, hafizaAmount: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" required />
               </div>
               <div className="sm:col-span-2">
                 <label className="block text-xs font-semibold text-slate-700 mb-1">البيان</label>
                 <input value={editingRow.description} onChange={(e) => setEditingRow({...editingRow, description: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ التوريد</label>
                 <input type="date" value={editingRow.notifyDate || ''} onChange={(e) => setEditingRow({...editingRow, notifyDate: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الإشعار</label>
                 <input value={editingRow.notifyNo || ''} onChange={(e) => setEditingRow({...editingRow, notifyNo: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:border-blue-400" />
               </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <button type="button" onClick={() => setEditingRow(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">إلغاء</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md">حفظ التعديلات</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// مكون فرعي صغير لتقليل تكرار كود الحقول (Fields)
function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-slate-400 bg-slate-50 transition-colors"
      />
    </div>
  );
}
