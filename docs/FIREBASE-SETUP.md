# إعداد إشعارات Android لأول مرة

حساب Expo المرتبط بالتطبيق هو `zeus313`، ومشروعه `cookies-team`. إنشاء مشروع Firebase مجاني لا يحتاج خطة Blaze أو بطاقة دفع لإرسال إشعارات FCM. حساب Google يبقى لك، ولا تحتاج إلى مشاركة كلمة مروره.

## إنشاء المشروع من المتصفح

1. افتح https://console.firebase.google.com/ بحساب Google الخاص بك. اضغط **Create a project / إنشاء مشروع**، وسمّه `Cookies`. لا يلزم تفعيل Google Analytics للإشعارات.
2. داخل المشروع، اضغط رمز **Android** لإضافة تطبيق. في **Android package name** ضع `team.cookies.tracker` بالضبط. اسم التطبيق `Cookies`؛ لا يلزم SHA-1 لهذه الميزة. سجّل التطبيق.
3. نزّل ملف **google-services.json**. تعليمات Gradle التالية ينفذها مشروعنا تلقائيًا؛ تابع حتى العودة للوحة.
4. افتح https://github.com/naruto00o9n-max/Cookies-app-work/settings/secrets/actions ، واضغط **New repository secret**. الاسم `GOOGLE_SERVICES_JSON`، والقيمة محتوى الملف كاملًا. لا تضعه في مستودع الكود.
5. في Firebase اضغط الترس → **Project settings → Service accounts → Generate new private key**، ونزّل JSON الاعتماد.
6. افتح https://expo.dev/accounts/zeus313/projects/cookies-team/credentials . اختر **Android → FCM V1 service account key → Upload** وارفع JSON اعتماد الخدمة. إذا طلب اختيار الحزمة، اختر `team.cookies.tracker`. هذا الملف مختلف عن `google-services.json`، ولا يُضمّن في APK.
7. من GitHub → **Actions → Build APK and unsigned IPA → Run workflow** اختر `android`. ثبّت APK الجديد، ثم فعّل الإشعارات في التطبيق.

ليس مطلوبًا متغير Vercel باسم `FIREBASE_SERVICE_ACCOUNT`: الخادم يرسل عبر Expo Push، ومفتاح FCM الخاص يُحفظ لدى Expo. يُستخدم `GOOGLE_SERVICES_JSON` العام لربط APK بـ Firebase أثناء البناء فقط.

## التحقق

نجاح السماح في إعدادات Android وحده لا يعني تسجيل الجهاز لدى خدمة الإرسال. التطبيق يعرض التفعيل الناجح بعد حصوله على Expo Push Token وحفظه في خدمة الفريق. لا تُرسل المفاتيح الخاصة أو كلمة مرور Google في المحادثة.

هذه الخطوات تخص Android. إشعارات iPhone/iPad تحتاج مفتاح APNs وملف توقيع Apple يدعم Push Notifications؛ Firebase لا يحل قيود توقيع ESign.
