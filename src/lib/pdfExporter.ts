// @ts-ignore
import html2pdf from 'html2pdf.js';

/**
 * تصدير محتوى HTML إلى PDF وبدء تنزيل حقيقي عبر المتصفح
 */
export async function exportHtmlToPdf(htmlContent: string, fileName: string): Promise<void> {
  // تنظيف اسم الملف وضمان وجود امتداد .pdf
  let cleanFileName = fileName.replace(/[^\u0600-\u06FFa-zA-Z0-9._-]/g, '_');
  if (!cleanFileName.toLowerCase().endsWith('.pdf')) {
    cleanFileName += '.pdf';
  }
  
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  
  // إعدادات html2pdf
  const opt = {
    margin: [10, 10, 10, 10],
    filename: cleanFileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true 
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  };

  try {
    // الحصول على ملف الـ PDF كـ Blob (كتلة بيانات)
    // ثم استخدام رابط وهمي لبدء تنزيل حقيقي يراه المتصفح
    const worker = html2pdf().set(opt).from(element).toPdf();
    const pdfBlob = await worker.output('blob');
    
    // إنشاء رابط تنزيل حقيقي
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFileName;
    
    // إضافة الرابط للمستند، النقر عليه، ثم إزالته
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // تحرير الذاكرة
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
  } catch (error) {
    console.error('فشل تنزيل PDF:', error);
    throw error;
  }
}

/**
 * وظيفة الطباعة التقليدية كخيار احتياطي
 */
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
