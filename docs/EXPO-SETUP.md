# إعداد مشروع Expo والإشعارات

لا ترسل اسم المستخدم وكلمة السر معًا، ولا ترسل رمز الوصول في المحادثة. يمكن إنشاء مشروع Cookies من حسابك تلقائيًا باستخدام رمز وصول تضعه أنت في أسرار GitHub. لا تحتاج إلى إنشاء المشروع يدويًا أو استخدام EAS Build لبناء APK وIPA.

## إنشاء المشروع من GitHub

1. سجّل الدخول إلى [Expo → Access tokens](https://expo.dev/settings/access-tokens)، أو افتح **Settings → Access tokens** في حسابك، وأنشئ رمز وصول باسم `Cookies GitHub setup`.
2. افتح [أسرار مستودع Cookies](https://github.com/naruto00o9n-max/Cookies-app-work/settings/secrets/actions). اضغط **New repository secret**، واجعل الاسم `EXPO_TOKEN`، والصق الرمز في خانة **Secret**.
3. افتح **Actions → Set up Expo notifications project → Run workflow**. اختر فرع `main` واكتب اسم حساب Expo الذي سيملك المشروع، دون `@`.
4. سيُنشئ الإجراء مشروع `cookies-team` تحت ذلك الحساب، أو يربطه إن كان موجودًا. يتحقق من الحساب قبل حفظ معرّف المشروع العام في التطبيق، ثم يبدأ بناء APK وIPA جديدين. يظهر رابط المشروع في ملخص الإجراء.

لا يُحفظ رمز الوصول في الكود أو ملفات التطبيق. يمكنك إلغاؤه من Expo بعد نجاح الإعداد. إذا لم يسمح GitHub للإجراء بالكتابة إلى `main`، فعّل صلاحية الكتابة في **Settings → Actions → General → Workflow permissions** ثم أعد تشغيل الإجراء؛ لن ينشئ نسخة ثانية من المشروع.

معرّف المشروع `projectId` معلومة عامة. يحفظه الإجراء في `mobile/app.json`، ولذلك لا تحتاج إلى نسخه في متغيرات GitHub. إذا أضفت سابقًا متغير `EXPO_PUBLIC_EAS_PROJECT_ID` بقيمة مختلفة، احذفه أو اجعله يطابق معرّف المشروع الذي يظهر في ملخص الإعداد.

## ما الذي يحتاجه وصول الإشعارات إلى الجهاز؟

إنشاء المشروع يحل خطوة ربط التطبيق بـExpo. وصول الإشعارات يحتاج أيضًا بيانات خدمة الإشعارات للمنصة؛ قبول نافذة السماح وحده لا يكفي.

### iPhone وiPad

يجب أن تكون النسخة موقعة بشهادة وملف Provisioning يدعمان **Push Notifications** للمعرّف `team.cookies.tracker`، وأن يكون مفتاح **APNs** المرتبط بفريق Apple نفسه مسجلًا في بيانات مشروع Expo. للحصول على هذه البيانات يلزم حساب Apple Developer مدفوع أو أن يوفّرها صاحب الشهادة التي توقّع بها.

تطبيق ESign أداة توقيع؛ وجوده وحده لا يضيف دعم الإشعارات إلى الشهادة. ملف IPA غير الموقع الذي يصنعه GitHub يظل يحتاج إلى هذا التوقيع الصحيح. إذا كان التوقيع شخصيًا مجانيًا أو شهادة لا تدعم الإشعارات فلن تعمل الإشعارات البعيدة حتى لو وافقت على نافذة السماح.

لصاحب حساب Apple Developer، تُدار بيانات الإشعارات عبر أمر Expo الرسمي `eas credentials`؛ اختر iOS والمشروع ثم إعداد مفتاح APNs. لا يطلب إجراء إعداد المشروع كلمة سر Apple ولا يُنشئ شهادات نيابة عنك.

### Android

أنشئ تطبيق Android في Firebase بالمعرّف `team.cookies.tracker`، ثم:

1. ضع محتوى ملف `google-services.json` كسر GitHub باسم `GOOGLE_SERVICES_JSON`. إجراء بناء APK الحالي يستخدمه عند إعادة البناء.
2. أضف مفتاح خدمة **FCM V1** إلى مشروع Expo عبر `eas credentials` أو لوحة بيانات المشروع. هذا مختلف عن ملف `google-services.json`؛ لا تنشر ملف Service Account في المستودع.
3. ثبّت APK المعاد بناؤه وفعّل الإشعارات من التطبيق.

بعد تجهيز بيانات المنصة وتثبيت البناء الجديد، اختبر وصول إشعار فعلي. إعداد مشروع Expo لا يثبت وحده نجاح وصول تنبيه إلى الجهاز.

المراجع الرسمية: [Programmatic access](https://docs.expo.dev/accounts/programmatic-access/)، [EAS init](https://docs.expo.dev/eas/cli/#eas-init)، [إعداد الإشعارات](https://docs.expo.dev/push-notifications/push-notifications-setup/)، [Android FCM](https://docs.expo.dev/push-notifications/fcm-credentials/).
