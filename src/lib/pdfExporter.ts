// @ts-ignore
// @ts-ignore
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';

/**
 * تصدير محتوى HTML كصورة طويلة عالية الجودة
 */
export async function exportHtmlToImage(htmlContent: string, fileName: string): Promise<void> {
  // تنظيف اسم الملف وضمان وجود امتداد .png
  let cleanFileName = fileName.replace(/[^\u0600-\u06FFa-zA-Z0-9._-]/g, '_');
  if (cleanFileName.toLowerCase().endsWith('.pdf')) {
    cleanFileName = cleanFileName.slice(0, -4);
  }
  if (!cleanFileName.toLowerCase().endsWith('.png')) {
    cleanFileName += '.png';
  }

  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  element.style.width = '210mm';
  element.style.background = 'white';
  document.body.appendChild(element);

  try {
    const canvas = await html2canvas(element, {
      scale: 3, // دقة عالية جداً
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgData;
    link.download = cleanFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('فشل تصدير الصورة:', error);
    throw error;
  } finally {
    document.body.removeChild(element);
  }
}

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
  // تأمين العرض والارتفاع ليتناسب مع A4
  element.style.width = '210mm';
  element.style.height = '297mm';
  element.style.overflow = 'hidden';
  
  const opt = {
    margin: 0, // الهوامش محددة داخل الـ HTML لضمان الدقة
    filename: cleanFileName,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      width: 794, // 210mm بيكسل تقريباً
      height: 1123 // 297mm بيكسل تقريباً
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
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
