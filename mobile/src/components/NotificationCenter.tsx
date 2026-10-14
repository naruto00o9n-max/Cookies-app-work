import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, Linking, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTeam } from "../lib/context";
import {
  enableNotifications,
  notificationProjectId,
  notificationPermission,
  DEVICE_TOKEN_KEY,
} from "../lib/notifications";
import { pushStep } from "../lib/notification-registration";
import { Alert } from "../lib/alerts";
const Context = createContext<{
  enable: () => Promise<void>;
  enabled: boolean;
  busy: boolean;
  error: string;
}>({ enable: async () => {}, enabled: false, busy: false, error: "" });
export const usePush = () => useContext(Context);
export function NotificationCenter({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, offline, call } = useTeam();
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = useRef({ call, user });
  current.current = { call, user };
  const pending = useRef<Promise<void> | undefined>(undefined);
  const prompted = useRef<string | undefined>(undefined);
  const id = user?.id;
  const register = () => {
    if (pending.current) return pending.current;
    const owner = current.current.user?.id;
    setBusy(true);
    setError("");
    pending.current = (async () => {
      if (!owner) return;
      const token = await enableNotifications();
      if (current.current.user?.id !== owner) return;
      await pushStep("server", Platform.OS, () =>
        current.current.call(
          Platform.OS === "web"
            ? "/api/mobile/web-devices"
            : "/api/mobile/devices",
          Platform.OS === "web"
            ? { subscription: JSON.parse(token) }
            : { token },
        ),
      );
      if (current.current.user?.id !== owner) return;
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
      await AsyncStorage.setItem(
        `cookies:notifications:prompt:${owner}`,
        "accepted",
      );
      setEnabled(true);
    })().finally(() => {
      pending.current = undefined;
      setBusy(false);
    });
    return pending.current;
  };
  const enable = async () => {
    try {
      await register();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "تعذر تفعيل الإشعارات. حاول مجددًا.";
      setEnabled(false);
      setError(message);
      Alert.alert("تعذر ربط الإشعارات", message, [
        { text: "حسنًا" },
        {
          text: "إعدادات الجهاز",
          onPress: () => {
            void Linking.openSettings().catch(() => {});
          },
        },
      ]);
    }
  };
  useEffect(() => {
    let alive = true;
    setEnabled(false);
    setError("");
    if (!id || offline) return;
    const key = `cookies:notifications:prompt:${id}`;
    const check = async () => {
      const permission = await notificationPermission();
      if (!alive) return;
      if (permission.granted && notificationProjectId()) {
        try {
          await register();
        } catch (e) {
          if (alive) {
            setEnabled(false);
            setError(e instanceof Error ? e.message : "تعذر ربط الإشعارات");
          }
        }
      }
      if (
        alive &&
        prompted.current !== id &&
        !(await AsyncStorage.getItem(key))
      ) {
        prompted.current = id;
        Alert.alert(
          "كن أول من يعرف ✦",
          "هل ترغب بتفعيل إشعارات كوكيز؟ سنخبرك عند نشر فصل جديد في الأعمال التي شاركت فيها، وبموعد المستحقات والتحديثات المهمة لفريقك. يمكنك تغيير اختيارك لاحقًا من مساحتي أو إعدادات جهازك.",
          [
            {
              text: "تفعيل الإشعارات",
              onPress: () => {
                if (current.current.user?.id === id) void enable();
              },
            },
            {
              text: "لاحقًا",
              style: "cancel",
              onPress: () => {
                void AsyncStorage.setItem(key, "later");
              },
            },
          ],
        );
      }
    };
    void check().catch(() => {});
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check().catch(() => {});
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [id, offline]);
  return (
    <Context.Provider value={{ enable, enabled, busy, error }}>
      {children}
    </Context.Provider>
  );
}
