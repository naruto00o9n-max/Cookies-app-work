# إشعارات Android — مشروع Cookies

المشروع الحقيقي في حساب المستخدم: https://console.firebase.google.com/project/cookies-team-zeus313/overview . تطبيق Android هو `team.cookies.tracker`، ومعرّفه `1:48488268326:android:da063e40dcdee4b9d91ce7`. مشروع Expo هو `@zeus313/cookies-team`، UUID `54087d37-25eb-4485-9a4d-58c8af5c121a`.

## الإعداد الآلي

لا يلزم نقل `GOOGLE_SERVICES_JSON` أو `FIREBASE_SERVICE_ACCOUNT` يدويًا إلى GitHub. يرتبط Actions بمشروع Google عبر Workload Identity Federation:

- يُقبل مستودع `naruto00o9n-max/Cookies-app-work` نفسه بمعرّفه الرقمي ومالكِه فقط.
- يُقبل الفرع `main` وتشغيلا `push` و`workflow_dispatch`، والملفان المحددان للبناء وإعداد الإشعارات.
- حساب `cookies-build` يقرأ إعداد Android ويستطيع إعداد مفتاح مرسل FCM المحدد `cookies-push`. ليس لديه صلاحية إدارة بقية حسابات الخدمة أو المشروع.
- `cookies-push` يرسل FCM v1 فقط. المفتاح الخاص يُنشأ داخل مهمة الإعداد ويُرفع إلى Expo؛ لا يدخل Git أو APK أو Artifacts.

Workflow **Configure Android notifications** يعمل تلقائيًا عند تغيير ملفات إعداد الإشعارات. يستخدم `EXPO_TOKEN` الموجود من إعداد Expo السابق، ويتحقق من المالك ومشروع Expo قبل إسناد FCM. إن كان المرسل الصحيح مرتبطًا بالفعل، لا يُنشئ مفتاحًا آخر.

Workflow **Build APK and unsigned IPA** ينزّل ملف إعداد Android الحقيقي من Firebase أثناء بناء APK ويضمّن الإعداد العام فقط. إعادة بناء Android يحدّث الإعداد تلقائيًا.

يمكن تشغيل **Configure Android notifications → Run workflow** مع إبقاء بناء Android مفعّلًا لإعادة التحقق ثم إنشاء APK جديد. لا يحتاج مستخدم التطبيق إلى معرفة هذه الخطوات.

## التحقق على الجهاز

ثبّت APK الجديد المرتبط بـ Firebase ثم فعّل الإشعارات من التطبيق. السماح في إعدادات الهاتف وحده لا يثبت تسجيل الجهاز لدى Expo؛ التطبيق يؤكد التفعيل بعد الحصول على Push Token وحفظه في خدمة الفريق.

إرسال API الفريق يتم عبر Expo Push Service؛ لا يلزم `FIREBASE_SERVICE_ACCOUNT` في Vercel. `GOOGLE_SERVICES_JSON` اليدوي اختياري لتجاوز الملف المنزّل أثناء البناء، ويُرفض إن اختلف المشروع أو اسم الحزمة.

هذه الإعدادات تخص Android. إشعارات iPhone/iPad تحتاج مفتاح APNs وملف توقيع Apple يدعم Push Notifications؛ Firebase لا يحل قيود توقيع ESign.
