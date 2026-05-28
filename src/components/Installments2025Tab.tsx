import { useStore, INSTALLMENT_2025_COLUMNS } from "@/lib/store";
import * as XLSX from "xlsx";
import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const Installments2025Tab: React.FC = () => {
  const installments2025 = useStore((s) => s.installments2025);
  const importInstallments2025 = useStore((s) => s.importInstallments2025);
  const clearInstallments2025 = useStore((s) => s.clearInstallments2025);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];
        importInstallments2025(json);
        toast.success("تم استيراد بيانات أقساط 2025 بنجاح");
      } catch (error) {
        toast.error("حدث خطأ أثناء قراءة ملف الإكسل");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearData = () => {
    if (confirm("هل أنت متأكد من رغبتك في تصفير وحذف جميع بيانات أقساط 2025؟")) {
      clearInstallments2025();
      toast.success("تم تصفير البيانات");
    }
  };

  function printAccountStatement(studentName: string) {
    const installments2025Rows = installments2025.filter(i => i.name === studentName);
    const allInstallments = useStore.getState().installments.filter(i => i.name === studentName) || [];

    const pdf = new jsPDF({ orientation: "landscape" });
    pdf.setFontSize(18);
    pdf.text(`كشف حساب للمتدرب: ${studentName}`, 148, 20, { align: "center" });
    pdf.setFontSize(14);

    pdf.text(`أقساط عام 2025`, 280, 35, { align: "right" });
    autoTable(pdf, {
      head: [INSTALLMENT_2025_COLUMNS],
      body: installments2025Rows.map(row =>
        INSTALLMENT_2025_COLUMNS.map(col => (row[col] ?? ""))
      ),
      startY: 40,
      styles: { halign: "right" },
      headStyles: { fillCountry: [13, 148, 136] } // لون تيل متناسق
    });

    if (allInstallments.length > 0) {
      pdf.text(`باقي الأعوام السابقة`, 280, pdf.lastAutoTable.finalY + 10, { align: "right" });
      autoTable(pdf, {
        head: [
          [
            "السنة",
            "الدفعة",
            "التخصص",
            "الرسوم",
            "المستحق السابق",
            ...Object.keys(allInstallments[0].payments ?? {}),
            "المبلغ المدفوع",
            "المتبقي",
            "ملاحظات",
            "رقم الهاتف",
          ],
        ],
        body: allInstallments.map(inst => [
          inst.no ?? "",
          inst.batch,
          inst.specialty,
          inst.fees,
          inst.prevDue,
          ...Object.values(inst.payments ?? {}),
          inst.totalPaid,
          inst.remaining,
          inst.notes,
          inst.phone,
        ]),
        startY: pdf.lastAutoTable.finalY + 15,
        styles: { halign: "right" },
        headStyles: { fillCountry: [100, 116, 139] }
      });
    }

    pdf.save(`كشف_حساب_${studentName}.pdf`);
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* لوحة التحكم العلوية بالأدوات */}
      <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-teal-800">إدارة أقساط عام 2025م</h2>
          <p className="text-xs text-slate-500 mt-0.5">استيراد السجلات وطباعة كشوفات المتدربين الحسابية</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* زر رفع واستيراد ملفات الإكسل بتصميم متناسق */}
          <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-sm cursor-pointer hover:bg-emerald-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            <span>استيراد ملف الأقساط (Excel)</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleImport} className="hidden" />
          </label>

          {/* زر تصفير البيانات */}
          <button 
            onClick={handleClearData} 
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-rose-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>تصفير البيانات</span>
          </button>
        </div>
      </div>

      {/* عرض البيانات والجدول */}
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                {INSTALLMENT_2025_COLUMNS.map(col => (
                  <th key={col} className="p-3 border-l text-center whitespace-nowrap">{col}</th>
                ))}
                <th className="p-3 text-center text-teal-900 w-36">التقارير والكشوفات</th>
              </tr>
            </thead>
            <tbody>
              {installments2025.length === 0 ? (
                <tr>
                  <td colSpan={INSTALLMENT_2025_COLUMNS.length + 1} className="text-center py-10 text-slate-400 font-medium">
                    لا توجد بيانات متاحة حالياً، يرجى رفع ملف إكسل من القائمة العلوية للبدء.
                  </td>
                </tr>
              ) : (
                installments2025.map((row, idx) => (
                  <tr key={row.name + idx} className="border-b bg-white hover:bg-slate-50 transition-colors">
                    {INSTALLMENT_2025_COLUMNS.map(col => (
                      <td key={col} className="p-2.5 text-center border-l text-slate-700 font-medium font-sans">
                        {row[col] ?? ''}
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => printAccountStatement(row.name)}
                        className="px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-700 hover:text-white border border-teal-200 rounded-md text-xs font-bold shadow-sm transition-all"
                      >
                        طباعة كشف حساب
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Installments2025Tab;
