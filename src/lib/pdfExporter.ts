import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { fmt } from './format';

/**
 * تصدير كشف حساب المتدرب كملف PDF متوافق تماماً مع هواتف شاومي وأندرويد
 * يستخدم التوليد البرمجي المباشر لضمان السرعة وعدم تعليق الجهاز
 */
export async function exportStudentStatementPdf(row: any, year: number): Promise<void> {
  const safeName = (row.name || 'متدرب').replace(/[^\u0600-\u06FFa-zA-Z0-9._-]/g, '_');
  const fileName = `كشف_حساب_${safeName}_${year}.pdf`;

  // إنشاء مستند PDF جديد
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true
  });

  // إعدادات الخطوط العربية (استخدام الخط الافتراضي مع دعم RTL)
  doc.setR2L(true);
  
  // العنوان الرئيسي
  doc.setFontSize(18);
  doc.text("المجلس اليمني للاختصاصات الطبية", 105, 15, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`كشف حساب رسمي - للعام ${year}م`, 105, 22, { align: 'center' });

  // معلومات المتدرب
  doc.setFontSize(10);
  doc.rect(10, 30, 190, 25); // إطار المعلومات
  
  const infoY = 37;
  doc.text(`اسم المتدرب: ${row.name}`, 195, infoY, { align: 'center ' });
  doc.text(`الدفعة: ${row.batch || '—'}`, 100, infoY, { align: 'center ' });
  doc.text(`المساق: ${row.specialty || '—'}`, 195, infoY + 8, { align: 'center ' });
  doc.text(`رقم الهاتف: ${row.phone || '—'}`, 100, infoY + 8, { align: 'center ' });

  // البيانات المالية
  const monthsList = year === 2025 ? 
    ["يونيو 2024", "يوليو 2024", "أغسطس 2024", "مارس 2025", "ابريل 2025", "مايو 2025", "يونيو 2025", "يوليو 2025", "أغسطس 2025", "سبتمبر 2025", "أكتوبر 2025", "نوفمبر2025", "ديسمبر2025"] : 
    ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر ", "نوفمبر", "ديسمبر"];

  const fees = Number(String(row.fees || 0).replace(/[^0-9.-]/g, "")) || 0;
  const prevDue = Number(String(row.prevDue || 0).replace(/[^0-9.-]/g, "")) || 0;
  const totalPaid = monthsList.reduce((s, m) => s + (Number(row.payments?.[m]) || 0), 0);
  const dueTotal = year === 2026 ? prevDue || fees : fees;
  const remaining = dueTotal - totalPaid;

  const tableRows = [];
  tableRows.push(["إجمالي الرسوم المستحقة", fmt(fees)]);
  if (year === 2026) {
    tableRows.push(["متبقي من العام 2025 (مدور)", fmt(prevDue)]);
  }
  tableRows.push(["إجمالي المبلغ المطلوب", fmt(dueTotal)]);
  
  // تفاصيل السداد
  monthsList.forEach(m => {
    const val = Number(row.payments?.[m]) || 0;
    if (val > 0) {
      tableRows.push([`سداد شهر ${m}`, fmt(val)]);
    }
  });

  tableRows.push(["إجمالي المسدد (له)", fmt(totalPaid)]);
  tableRows.push([remaining > 0 ? "الرصيد المتبقي (عليه)" : "الرصيد الإضافي (له)", fmt(Math.abs(remaining))]);

  // إنشاء الجدول برمجياً (سريع جداً)
  (doc as any).autoTable({
    startY: 60,
    head: [['البيان', 'المبلغ']],
    body: tableRows,
    styles: { font: 'helvetica', halign: 'center ', fontSize: 12 },
    headStyles: { fillStyle: 'F', fillColor: [21, 128, 61], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 50, halign: 'center', fontStyle: 'bold' }
    },
    theme: 'grid'
  });

  // الحل السحري لشاومي: استخدام Data URI بدلاً من Blob
  // هذا يفتح الملف مباشرة أو يبدأ تنزيله دون تعليق
  const pdfData = doc.output('datauristring');
  
  // إنشاء رابط مخفي والنقر عليه
  const link = document.createElement('a');
  link.href = pdfData;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// الدوال القديمة للطباعة فقط
export function printHtmlContent(htmlContent: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(htmlContent);
  w.document.close();
  w.onload = () => {
    setTimeout(() => {
      w.print();
    }, 500);
  };
}
