import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Modal, View, Platform, Linking, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useTeam } from "../lib/context";
import {
  enableNotifications,
  notificationProjectId,
  DEVICE_TOKEN_KEY,
} from "../lib/notifications";
import { Glass, Heading, Label, Button, Icon, colors, styles } from "./ui";
const Context = createContext<{
  enable: () => Promise<void>;
  enabled: boolean;
  busy: boolean;
}>({ enable: async () => {}, enabled: false, busy: false });
export const usePush = () => useContext(Context);
export function NotificationCenter({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, offline, call } = useTeam();
  const [visible, setVisible] = useState(false),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const current = useRef({ call, user });
  current.current = { call, user };
  const id = user?.id;
  const promptKey = `cookies:notifications:prompt:${id}`;
  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const token = await enableNotifications();
      await current.current.call("/api/mobile/devices", { token });
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
      setEnabled(true);
      setVisible(false);
      await AsyncStorage.setItem(promptKey, "accepted");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "تعذر تفعيل الإشعارات. حاول مجددًا.",
      );
      setVisible(true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let alive = true;
    setEnabled(false);
    setVisible(false);
    setMessage("");
    if (!id || offline || Platform.OS === "web") return;
    const check = async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (!alive) return;
      setEnabled(false);
      if (permission.granted && notificationProjectId()) {
        try {
          const token = await enableNotifications();
          if (!alive) return;
          await current.current.call("/api/mobile/devices", { token });
          await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
          if (alive) setEnabled(true);
        } catch {
          /* Permission alone is not a registered remote device. */
        }
      }
      if (alive && !(await AsyncStorage.getItem(promptKey))) setVisible(true);
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
  const later = () => {
    setVisible(false);
    void AsyncStorage.setItem(promptKey, "later");
  };
  return (
    <Context.Provider value={{ enable, enabled, busy }}>
      {children}
      <Modal
        visible={visible && !!user}
        transparent
        animationType="fade"
        onRequestClose={later}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,.75)",
            alignItems: "center",
            justifyContent: "center",
            padding: 26,
          }}
        >
          <Glass
            gold
            style={{ width: "100%", maxWidth: 440, gap: 18, padding: 28 }}
          >
            <View
              style={[
                styles.iconBox,
                {
                  alignSelf: "center",
                  width: 68,
                  height: 68,
                  borderRadius: 24,
                },
              ]}
            >
              <Icon name="notifications-outline" size={32} />
            </View>
            <Heading size={24}>كن أول من يعرف ✦</Heading>
            <Label dim>
              هل ترغب بتفعيل إشعارات كوكيز؟ سنخبرك عند نشر فصل جديد في الأعمال
              التي شاركت فيها، وبموعد المستحقات والتحديثات المهمة لفريقك.
            </Label>
            <Label dim size={11}>
              يمكنك تغيير اختيارك لاحقًا من مساحتي أو إعدادات جهازك.
            </Label>
            {!!message && (
              <Label style={{ color: colors.red }}>{message}</Label>
            )}
            <Button
              disabled={busy}
              title={busy ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
              icon="notifications-outline"
              onPress={() => {
                if (!busy) void enable();
              }}
            />
            {!!message && (
              <Button
                secondary
                title="فتح إعدادات الجهاز"
                onPress={() => {
                  void Linking.openSettings();
                }}
              />
            )}
            <Button secondary disabled={busy} title="لاحقًا" onPress={later} />
          </Glass>
        </View>
      </Modal>
    </Context.Provider>
  );
}
