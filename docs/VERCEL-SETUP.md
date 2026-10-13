# ربط التطبيق ببيانات الفريق على Vercel

المشروع: https://vercel.com/zeus-c49b/cookies-app-work

الخدمة: https://cookies-app-work.vercel.app

## إعداد البناء

في Settings → Build and Deployment:

- Root Directory: `dashboard`.
- فعّل **Include source files outside of the Root Directory in the Build Step**. API يستخدم وحدات مشتركة من `mobile/src/lib`.
- Framework Preset: Next.js.
- Node.js Version: 22.x.
- يحدد `dashboard/vercel.json` تثبيت الحزم بـ `npm ci` والبناء بـ `npm run build`.

## المتغيرات

في Settings → Environment Variables أضف القيم التالية إلى **Production**. لا تكتبها في الكود أو متغيرات Expo العامة. استخدم قيم MongoDB وديسكورد التي لديك.

| الاسم | القيمة |
| --- | --- |
| `MONGODB_URI` | رابط الاتصال بقاعدة الفريق الحالية |
| `MONGODB_DB_NAME` | `work_bot`، اسم قاعدة البوت الحالية |
| `DISCORD_CLIENT_ID` | `1559365375282520137` |
| `DISCORD_CLIENT_SECRET` | سر تطبيق Discord |
| `DISCORD_GUILD_ID` | `1342820475595653211` |
| `SESSION_SECRET` | قيمة عشوائية طويلة، ثابتة بين عمليات النشر |
| `CRON_SECRET` | قيمة عشوائية أخرى مستقلة، للمهام الدورية |

لتوليد كل سر عشوائي، شغّل `openssl rand -hex 32` مرتين، واستخدم نتيجة مستقلة لكل متغير. لا تغير `SESSION_SECRET` كل نشر؛ تغييره يبطل جلسات الدخول الحالية.

اختياريًا، `DISCORD_OWNER_IDS` يقبل معرفات مشرفي التطبيق مفصولة بفواصل. يجب أن يكونوا أعضاء السيرفر. مالك السيرفر وأصحاب Administrator أو Manage Messages يحصلون على صلاحيات الإدارة تلقائيًا.

## تسجيل الدخول

في Discord Developer Portal → تطبيقك → OAuth2 → Redirects أضف هذا الرابط حرفيًا ثم احفظ:

```text
https://cookies-app-work.vercel.app/api/auth/discord/callback
```

لا يحتاج تسجيل الدخول إلى تشغيل البوت أو إضافة Bot Token.

بعد حفظ المتغيرات، افتح Deployments وأعد نشر آخر إصدار من `main` إلى Production. المتغيرات الجديدة تحتاج نشرًا جديدًا حتى تُستخدم.

## تشغيل المهام الدورية

في مستودع GitHub → Settings → Secrets and variables → Actions → Repository secrets أضف:

- `COOKIES_API_URL`: `https://cookies-app-work.vercel.app`.
- `COOKIES_CRON_SECRET`: نفس قيمة `CRON_SECRET` التي وضعتها في Vercel.

يشغّل workflow **Cookies scheduled jobs** النسخ الاحتياطية والتذكيرات ومزامنة Azora كل عشر دقائق. يمكنك تشغيله يدويًا بعد النشر. هذه المهمة تحتاج API المنشور؛ لا تعمل داخل هاتف عضو واحد.

الإشعارات البعيدة تحتاج أيضًا إعداد Expo Project ID واعتمادات APNs/FCM لمشروع التطبيق؛ بناء APK/IPA وحده لا يفعّلها.

## التحقق بعد النشر

افتح https://cookies-app-work.vercel.app/api/auth/me وتأكد من أن `config.oauthEnabled` و`config.databaseConfigured` كلاهما `true`، وأن `config.guildId` يساوي معرف سيرفرك. هذا يفحص وجود الإعدادات، وليس صحة الاتصال بقاعدة البيانات.

بعدها افتح الصفحة الرئيسية وسجّل الدخول بديسكورد بحساب عضو في السيرفر، ثم تحقق من ظهور السجلات والأعمال الحالية. هذا هو التحقق الفعلي من المصادقة واتصال MongoDB. إذا فشل الدخول، راجع Functions logs في Vercel، وRedirect URL، وصلاحيات مستخدم Atlas وNetwork Access للقاعدة.

نزّل ملفات التطبيق من أحدث تشغيل ناجح في Actions → **Build APK and unsigned IPA**. الملفان مرتبطان بعنوان الخدمة أعلاه. وقّع IPA قبل التثبيت؛ APK قابل للتثبيت. بيانات الفريق لا تُنسخ إلى ملفات البناء: التطبيق يجلبها بعد الدخول.
