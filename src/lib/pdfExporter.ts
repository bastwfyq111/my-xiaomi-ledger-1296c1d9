import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * حفظ محتوى HTML كملف PDF مع دعم اللغة العربية والخطوط المخصصة
 * @param htmlContent محتوى HTML المراد تحويله إلى PDF
 * @param fileName اسم الملف المراد حفظه
 */
export async function exportHtmlToPdf(htmlContent: string, fileName: string): Promise<void> {
  try {
    // إنشاء عنصر div مؤقت لتحميل المحتوى
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '210mm'; // عرض A4
    document.body.appendChild(tempDiv);

    // انتظار تحميل الخطوط
    await new Promise(resolve => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(resolve).catch(resolve);
      } else {
        setTimeout(resolve, 1000);
      }
    });

    // تحويل HTML إلى Canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    // إنشاء PDF من Canvas
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20; // مع هوامش
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    // إضافة الصور إلى PDF (في حالة المحتوى الطويل)
    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;
    }

    // حفظ الملف
    pdf.save(fileName);

    // تنظيف
    document.body.removeChild(tempDiv);
  } catch (error) {
    console.error('خطأ في تحويل HTML إلى PDF:', error);
    throw error;
  }
}

/**
 * طباعة محتوى HTML في نافذة جديدة مع خيار الحفظ كـ PDF
 * @param htmlContent محتوى HTML المراد طباعته
 * @param fileName اسم الملف (اختياري)
 */
export function printHtmlContent(htmlContent: string, fileName?: string): void {
  const w = window.open('', '_blank', 'width=850,height=700');
  if (!w) {
    throw new Error('فشل فتح النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة.');
  }

  w.document.open();
  w.document.write(htmlContent);
  w.document.close();

  // انتظار تحميل الصفحة ثم فتح نافذة الطباعة
  w.addEventListener('load', () => {
    setTimeout(() => {
      w.print();
    }, 500);
  });
}
