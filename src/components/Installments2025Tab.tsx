import { useStore, INSTALLMENT_2025_COLUMNS } from "@/lib/store";
import * as XLSX from "xlsx";
import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Installments2025Tab: React.FC = () => {
  const installments2025 = useStore((s) => s.installments2025);
  const importInstallments2025 = useStore((s) => s.importInstallments2025);
  const clearInstallments2025 = useStore((s) => s.clearInstallments2025);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];
      importInstallments2025(json);
    };
    reader.readAsArrayBuffer(file);
  };

  function printAccountStatement(studentName: string) {
    const installments2025Rows = installments2025.filter(i => i.name === studentName);
    const allInstallments = useStore.getState().installments.filter(i => i.name === studentName) || [];

    const pdf = new jsPDF({ orientation: "landscape" });
    pdf.setFontSize(18);
    pdf.text(`كشف حساب للمتدرب: ${studentName}`, 148, 20, { align: "center" });
    pdf.setFontSize(14);

    pdf.text(`أقساط عام 2025`, 20, 35, { align: "right" });
    autoTable(pdf, {
      head: [INSTALLMENT_2025_COLUMNS],
      body: installments2025Rows.map(row =>
        INSTALLMENT_2025_COLUMNS.map(col => (row[col] ?? ""))
      ),
      startY: 40,
      styles: { font: "times", halign: "right" },
    });

    if (allInstallments.length > 0) {
      pdf.text(`باقي الأعوام`, 20, pdf.lastAutoTable.finalY + 10, { align: "right" });
      autoTable(pdf, {
        head: [
          [
            "السنة",
            "الدفعة",
            "التخصص",
            "الرسوم",
            "المست��ق السابق",
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
        styles: { font: "times", halign: "right" },
      });
    }

    pdf.save(`كشف حساب-${studentName}.pdf`);
  }

  return (
    <div>
      <h2>الأقساط لعام 2025</h2>
      <div style={{ marginBottom: 8 }}>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleImport}
          style={{ display: 'inline-block', marginLeft: 12 }}
        />
        <button onClick={clearInstallments2025} style={{ marginLeft: 8 }}>تصفير البيانات</button>
      </div>
      <table className="table" dir="rtl" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {INSTALLMENT_2025_COLUMNS.map(col => <th key={col}>{col}</th>)}
            <th>كشف حساب</th>
          </tr>
        </thead>
        <tbody>
          {installments2025.length === 0 ? (
            <tr>
              <td colSpan={INSTALLMENT_2025_COLUMNS.length + 1} style={{ textAlign: "center" }}>
                لا توجد بيانات، يرجى الاستيراد من إكسل
              </td>
            </tr>
          ) : (
            installments2025.map((row, idx) => (
              <tr key={row.name + idx}>
                {INSTALLMENT_2025_COLUMNS.map(col => (
                  <td key={col}>{row[col] ?? ''}</td>
                ))}
                <td>
                  <button onClick={() => printAccountStatement(row.name)}>
                    طباعة كشف حساب
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Installments2025Tab;
