// @ts-ignore
import html2pdf from 'html2pdf.js';

/**
 * تصدير محتوى HTML إلى PDF باستخدام html2pdf.js
 * هذه المكتبة هي الأكثر استقراراً للتعامل مع CSS المعقد والخطوط العربية
 */
export async function exportHtmlToPdf(htmlContent: string, fileName: string): Promise<void> {
  // تنظيف اسم الملف من أي رموز قد تسبب مشاكل في نظام التشغيل
  const cleanFileName = fileName.replace(/[^\u0600-\u06FFa-zA-Z0-9._-]/g, '_');
  
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  element.style.width = '210mm'; // عرض A4
  
  const opt = {
    margin: [10, 10, 10, 10],
    filename: cleanFileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  };

  try {
    // تنفيذ عملية التحويل والحفظ
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
}

/**
 * خيار بديل للطباعة المباشرة في حال فشل المكتبة
 */
export function printHtmlContent(htmlContent: string): void {
  const w = window.open('', '_blank', 'width=850,height=700');
  if (!w) return;
  
  w.document.open();
  w.document.write(htmlContent);
  w.document.close();
  
  w.onload = () => {
    setTimeout(() => {
      w.print();
      // لا نغلق النافذة للسماح للمستخدم بالتحكم في الطباعة
    }, 500);
  };
}
