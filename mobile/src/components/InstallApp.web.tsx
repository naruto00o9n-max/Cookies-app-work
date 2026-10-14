import React, { useEffect, useState } from "react";
import { Button, Glass, Heading, Icon, Label } from "./ui";
import { Alert } from "../lib/alerts";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
declare global {
  interface Window {
    cookiesInstallPrompt?: InstallPrompt | null;
  }
}
export function InstallApp() {
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((n) => n + 1),
      done = () => setInstalled(true);
    window.addEventListener("cookies-install-ready", update);
    window.addEventListener("cookies-installed", done);
    return () => {
      window.removeEventListener("cookies-install-ready", update);
      window.removeEventListener("cookies-installed", done);
    };
  }, []);
  if (installed) return null;
  const install = async () => {
    const prompt = window.cookiesInstallPrompt;
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.cookiesInstallPrompt = null;
      if (choice.outcome === "accepted") setInstalled(true);
      else refresh((n) => n + 1);
      return;
    }
    Alert.alert(
      "Cookies على شاشتك الرئيسية",
      "على iPhone وiPad: اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية».\nعلى Android أو الكمبيوتر: افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».\nافتح الأيقونة الجديدة للحصول على نافذة مستقلة وتفعيل إشعارات الجهاز.",
    );
  };
  return (
    <Glass gold style={{ gap: 12 }}>
      <Icon name="phone-portrait-outline" size={28} />
      <Heading size={20}>مساحتك، بنقرة واحدة.</Heading>
      <Label dim size={12}>
        أضف Cookies لشاشتك الرئيسية لفتحه كتطبيق، دون تحميل APK أو توقيع IPA.
      </Label>
      <Button
        title="إضافة إلى الشاشة الرئيسية"
        icon="download-outline"
        onPress={() => {
          void install().catch(() =>
            Alert.alert(
              "تعذر التثبيت",
              "افتح قائمة المتصفح واختر تثبيت التطبيق.",
            ),
          );
        }}
      />
    </Glass>
  );
}
