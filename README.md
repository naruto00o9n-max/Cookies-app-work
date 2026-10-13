# Cookies App 🍪

تطبيق Android وiOS لفريق كوكيز، مبني بـ React Native وExpo، بواجهات عربية سوداء زجاجية ولمسات ذهبية. ينقل تسجيل الفصول والمستحقات والأسعار والأعمال والمكافآت والتقارير من [بوت Cookies](https://github.com/jsnjbwjbw-ui/Cookies) إلى تطبيق مستقل.

## تنزيل APK وIPA

من **Actions → Build APK and unsigned IPA** شغّل workflow، ثم نزّل `cookies-android-apk` و`cookies-ios-unsigned-ipa` من Artifacts. IPA غير موقّع؛ وقّعه قبل التثبيت. لا يحتاج البناء حساب EAS أو شهادة Apple. [شرح البناء](docs/GITHUB-BUILDS.md).

## التشغيل

```bash
cd mobile
npm ci
npm start
```

التطبيق يعرض بيانات الفريق الحقيقية فقط. للدخول بحساب Discord ومشاركة بيانات MongoDB، اضبط API عند الطلب؛ لا تحتاج تشغيل البوت أو Railway طوال اليوم. أسرار MongoDB وديسكورد تبقى في بيئة API، وليس داخل الهاتف.

- [تشغيل وربط تطبيق الهاتف](mobile/README.md)
- [نقل الأوامر والبيانات والمهام الدورية](docs/MOBILE-MIGRATION.md)
- [بناء APK وIPA](docs/GITHUB-BUILDS.md)
