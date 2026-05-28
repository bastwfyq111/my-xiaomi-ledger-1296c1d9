## الخطة

### 1) إيقاف الترحيل التلقائي عند الاستيراد من إكسل
في `src/lib/store.ts` داخل `importData`:
- حذف منطق `cascadedAccounts` و `cascadedJournal` بالكامل.
- استيراد كل ورقة كما هي فقط: `hafiza` تذهب لـ hafiza، `accounts` لـ accounts، `journal` لـ journal، `revenue` لـ revenue، `installments` لـ installments.
- لا يوجد أي ربط Hafiza→Account→Journal عند الاستيراد.

### 2) الإبقاء على الترحيل اليدوي كما هو
- `addHafiza` يستمر في إنشاء Account + Journal تلقائياً (إدخال يدوي من تبويب الحوافظ).
- `addAccount` يستمر في إنشاء Journal تلقائياً (إدخال يدوي من تبويب الحساب).
- `deleteHafiza` / `deleteAccount` يحافظان على cascade الحذف للصفوف المرتبطة يدوياً عبر `sourceHafizaId` / `sourceAccountId` (لن يؤثر على بيانات الاستيراد لأنها لا تحمل هذه الروابط).

### 3) تبويب الإيراد: الربط فقط مع اليومية
في `src/components/RevenueTab.tsx`:
- التأكد أن `derived` يقرأ فقط من `journal` (وليس من `installments`).
- المنطق الحالي يستخدم `journal` فقط — يتم التحقق وإزالة أي اعتماد على `installments` إن وُجد.
- القواعد تبقى: صفوف اليومية التي تحتوي "دراسي" → عمود "رسوم استمارات وتسجيل"، و"اختبار" → عمود "رسوم امتحانات وشهادات"، تُجمَّع شهرياً.

### ملفات سيتم تعديلها
- `src/lib/store.ts` (إزالة cascade من importData فقط)
- `src/components/RevenueTab.tsx` (تأكيد المصدر = journal فقط)

### ملفات لن تُعدَّل
- `src/components/HafizaTab.tsx`, `AccountTab.tsx` — الإدخال اليدوي يظل كما هو.
- `ImportButton.tsx`, `exportImport.ts` — لا تغيير في منطق قراءة الملف.
