import React, { useState } from 'react';

// 1. تحديد هيكل البيانات للتبويبات باستخدام TypeScript
// هذا يساعد في منع الأخطاء ويخبر المحرر البرمجي بشكل البيانات المتوقعة
interface TabData {
  id: string;          // المعرف الفريد للتبويب
  title: string;       // عنوان التبويب الذي سيظهر على الزر
  content: React.ReactNode; // محتوى التبويب (يمكن أن يكون نصوص أو عناصر HTML/React)
}

const AppTabs: React.FC = () => {
  // 2. إنشاء الحالة (State) لتتبع التبويب المفتوح حالياً
  // حددنا 'expenses' كقيمة افتراضية ليكون هو التبويب المفتوح عند تشغيل التطبيق
  const [activeTab, setActiveTab] = useState<string>('expenses');

  // 3. تجهيز بيانات التبويبات
  // يمكنك إضافة أو إزالة أي تبويبات هنا بسهولة
  const tabs: TabData[] = [
    {
      id: 'main',
      title: 'الرئيسية',
      content: <div>مرحباً بك في التطبيق. هذا هو محتوى التبويب القديم/الرئيسي.</div>,
    },
    {
      id: 'expenses',
      title: 'سجل النفقات',
      content: (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h2>سجل النفقات العامة للمجلس</h2>
          <p style={{ color: '#555', marginBottom: '20px' }}>
            انقر على الزر أدناه لتحميل جدول سجل مفردات الاستخدامات والنفقات بصيغة Excel.
          </p>
          
          {/* رابط التحميل المباشر للملف من GitHub */}
          <a
            href="https://raw.githubusercontent.com/bastwfyq111/my-xiaomi-ledger-1296c1d9/main/جدول سجل مفردات الاستخدمات النفقات العامة المجلس.xlsx"
            download
            style={{
              display: 'inline-block',
              backgroundColor: '#0366d6', // لون أزرق يشبه أزرار GitHub
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            تحميل الملف (Excel)
          </a>
        </div>
      ),
    },
  ];

  // 4. عرض واجهة المستخدم
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* شريط أزرار التبويبات */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e4e8', marginBottom: '20px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #0366d6' : '3px solid transparent',
              color: activeTab === tab.id ? '#0366d6' : '#586069',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              transition: 'all 0.2s',
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {/* منطقة عرض المحتوى للتبويب النشط */}
      <div style={{ padding: '15px', backgroundColor: '#f6f8fa', borderRadius: '6px', border: '1px solid #e1e4e8' }}>
        {/* نبحث عن التبويب الذي يتطابق الـ id الخاص به مع الـ activeTab ونعرض محتواه */}
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>

    </div>
  );
};

export default AppTabs;
