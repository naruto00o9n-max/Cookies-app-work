import React, { useSyncExternalStore, useId, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  closeDialog,
  currentDialog,
  subscribeDialogs,
  dialogHost,
  registerDialogHost,
} from "../lib/alerts";
import { Button, colors, Fade, Heading, Icon, Label, styles } from "./ui";
export function GlassDialogHost({
  children,
  active = true,
  root = true,
}: {
  children: React.ReactNode;
  active?: boolean;
  root?: boolean;
}) {
  const id = useId();
  useEffect(
    () => (active ? registerDialogHost(id, root) : undefined),
    [active, id, root],
  );
  const host = useSyncExternalStore(subscribeDialogs, dialogHost, dialogHost);
  const { height } = useWindowDimensions();
  const dialog = useSyncExternalStore(
    subscribeDialogs,
    currentDialog,
    currentDialog,
  );
  const cancel = () => {
    if (dialog?.options?.cancelable && closeDialog(dialog.id))
      dialog.options.onDismiss?.();
  };
  return (
    <>
      {children}
      {dialog && host === id && active && (
        <Modal
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={cancel}
        >
          <SafeAreaView style={design.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cancel}
              accessibilityLabel="إغلاق النافذة"
            />
            <View style={design.frame} accessibilityViewIsModal>
              <BlurView
                intensity={75}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[
                  "rgba(232,199,124,.12)",
                  "rgba(18,19,25,.9)",
                  "rgba(18,19,25,.98)",
                ]}
                style={StyleSheet.absoluteFill}
              />
              <Fade key={dialog.id}>
                <ScrollView
                  contentContainerStyle={design.content}
                  style={{ maxHeight: height * 0.8 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={design.emblem}>
                    <Icon
                      name={
                        dialog.buttons.some((b) => b.style === "destructive")
                          ? "shield-outline"
                          : "sparkles-outline"
                      }
                      size={30}
                    />
                  </View>
                  <Heading size={23}>{dialog.title}</Heading>
                  {!!dialog.message && (
                    <Label style={{ lineHeight: 27 }} dim>
                      {dialog.message}
                    </Label>
                  )}
                  <View style={styles.stack}>
                    {dialog.buttons.map((button, index) => (
                      <Button
                        key={index}
                        title={button.text || "حسنًا"}
                        secondary={button.style === "cancel"}
                        danger={button.style === "destructive"}
                        onPress={() => {
                          if (closeDialog(dialog.id)) button.onPress?.();
                        }}
                      />
                    ))}
                  </View>
                  <Label
                    size={9}
                    style={{
                      color: colors.gold,
                      opacity: 0.55,
                      letterSpacing: 4,
                    }}
                  >
                    C O O K I E S
                  </Label>
                </ScrollView>
              </Fade>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}
const design = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  frame: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.3)",
    backgroundColor: "rgba(18,19,25,.9)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  content: { padding: 26, gap: 20 },
  emblem: {
    alignSelf: "flex-end",
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.22)",
    backgroundColor: "rgba(232,199,124,.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});
