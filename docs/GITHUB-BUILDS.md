# بناء APK وIPA من GitHub

افتح تبويب **Actions → Build APK and unsigned IPA → Run workflow**. اختر `all` أو `android` أو `ios`. يُبنى كلاهما أيضًا عند دفع تغييرات التطبيق إلى `main`.

بعد نجاح المهام، نزّل من **Artifacts**:

- `cookies-android-apk`: ملف `Cookies.apk` لإصدارات ARM64 وARMv7، بناء Release موقّع بمفتاح Android التجريبي الذي يولده قالب Expo. قابل للتثبيت دون Metro أو EAS. للإصدار الرسمي لاحقًا يلزم مفتاح إنتاج ثابت؛ تغيير المفتاح يمنع التحديث فوق النسخة القديمة.
- `cookies-ios-unsigned-ipa`: ملف `Cookies-unsigned.ipa` لجهاز آيفون فعلي، وليس محاكيًا. يحتوي `Payload/Cookies.app` دون توقيع. وقّعه وأضف provisioning profile مناسبًا بأداتك قبل التثبيت. Action لا يحتاج Apple Developer أو شهادة توقيع أو حساب EAS.

ملفات Artifacts مضغوطة بواسطة GitHub؛ فك الضغط للحصول على APK/IPA. تحتفظ الخدمة بها 30 يومًا، ويمكن إعادة بناءها من الكود.

## عنوان خدمة الفريق

اضبط Repository variable باسم `COOKIES_API_URL` على عنوان API العام عبر HTTPS، أو أدخله في حقل `api_url` عند التشغيل اليدوي. هذا العنوان عام داخل التطبيق؛ **لا تضع MONGODB_URI أو DISCORD_CLIENT_SECRET في متغيرات الهاتف**. أسرار قاعدة البيانات والمصادقة تبقى في بيئة API.

العنوان الافتراضي الحالي هو `https://cookies-app-work.vercel.app`، ويمكن تغييره بالمتغير أو حقل البناء أعلاه. لا يوجد عرض بيانات وهمية؛ دخول الفريق يحتاج إعداد خدمة الحفظ. إنتاج الملفات لا ينشر API ولا يربط قاعدة الفريق تلقائيًا. [إعداد Vercel والأسرار](VERCEL-SETUP.md).

GitHub Actions يبني مباشرة على Ubuntu/macOS. حدود الدقائق، خصوصًا macOS في المستودعات الخاصة، تعتمد على خطة حساب GitHub. إن منع GitHub التشغيل بسبب ميزانية الحساب، يلزم تعديل إعدادات الحساب أو اختيار بيئة بناء أخرى؛ نجاح توليد JavaScript وحده ليس نجاح بناء APK/IPA.
