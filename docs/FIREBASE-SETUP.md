# إشعارات Android — مشروع Cookies

تم إنشاء Firebase في حساب المستخدم عبر تسجيل دخول Google الرسمي، دون مشاركة كلمة مرور:

- المشروع: `cookies-team-zeus313` — https://console.firebase.google.com/project/cookies-team-zeus313/overview
- تطبيق Android: `team.cookies.tracker`، ومعرّف Firebase `1:48488268326:android:da063e40dcdee4b9d91ce7`.
- مشروع Expo: `@zeus313/cookies-team`، UUID `54087d37-25eb-4485-9a4d-58c8af5c121a`.
- خدمة FCM v1 مفعلة. اعتماد الإرسال `cookies-push` لديه دور Firebase Cloud Messaging API Admin، دون صلاحية إدارة باقي موارد المشروع.

## الخطوة المتبقية

أُعِدّ الملفان الحقيقيان أثناء إنشاء المشروع. لا تُرفع نسخة اعتماد الخدمة إلى مستودع الكود أو Artifacts العامة.

1. افتح https://github.com/naruto00o9n-max/Cookies-app-work/settings/secrets/actions وأضف **Repository secrets**:
   - `GOOGLE_SERVICES_JSON`: محتوى ملف إعداد Android كاملًا.
   - `FIREBASE_SERVICE_ACCOUNT`: محتوى ملف اعتماد إرسال FCM الخاص كاملًا. هذا ملف مختلف، يحتوي `private_key`.
2. `EXPO_TOKEN` موجود من إعداد Expo السابق؛ يجب أن يملك صلاحية إدارة مشروع `zeus313/cookies-team`.
3. افتح GitHub → **Actions → Configure Android notifications → Run workflow**. اترك خيار بناء Android مفعّلًا.
4. Action يتحقق من تطابق ملفّي Firebase والحزمة ومشروع Expo ومالكه، ويرفع اعتماد FCM v1 إلى Expo، ثم يشغّل بناء APK جديد. لا يعرض المفتاح الخاص في السجلات، ولا يضمّنه في APK. إعادة تشغيله تحتفظ بالاعتماد ذاته.
5. ثبّت APK الناتج وفعّل الإشعارات من التطبيق. السماح في إعدادات Android وحده لا يعني تسجيل جهازك لدى Expo؛ التطبيق يؤكد التفعيل بعد الحصول على Push Token وحفظه في خدمة الفريق.

`FIREBASE_SERVICE_ACCOUNT` هنا سر GitHub لإعداد اعتماد Expo فقط. لا يلزم وضعه في Vercel؛ API الفريق يرسل عبر Expo Push Service.

## استعادة الملفين عند الحاجة

من Firebase → الترس → Project settings → Your apps → Android، يمكنك تنزيل `google-services.json` مجددًا. إذا فقدت مفتاح الخدمة الخاص، لا يمكن تنزيل المفتاح ذاته مرة أخرى؛ يُنشأ بديل من Google Cloud IAM ويُستبدل في السر. الملف الذي أُنشئ لهذه المهمة محفوظ خارج مستودع الكود.

## حدود التحقق

تم التحقق من إعداد المشروع والتطبيق وتطابق الملفين، واستجابة FCM لاختبار `validate_only` باعتماد الخدمة الحقيقي. رفضت الخدمة رمز الجهاز غير الحقيقي بـ `INVALID_ARGUMENT`، ما يؤكد الاتصال بالمصادقة الحقيقية دون إرسال أي إشعار. لم يُختبر الاستقبال على جهاز Android فعلي بعد.

هذه الإعدادات تخص Android. إشعارات iPhone/iPad تحتاج مفتاح APNs وملف توقيع Apple يدعم Push Notifications؛ Firebase لا يحل قيود توقيع ESign.
