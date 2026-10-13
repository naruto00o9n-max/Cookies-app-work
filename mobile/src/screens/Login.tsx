import { Alert } from "../lib/alerts";
import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  Backdrop,
  Button,
  Glass,
  Heading,
  Label,
  colors,
  Fade,
} from "../components/ui";
import { useTeam } from "../lib/context";
import { server } from "../lib/api";
export function Login() {
  const { login, busy, error } = useTeam();
  const [working, setWorking] = useState(false);
  const signIn = async () => {
    setWorking(true);
    try {
      await login();
    } catch (e) {
      Alert.alert(
        "تسجيل الدخول",
        e instanceof Error ? e.message : "تعذر الدخول",
      );
    } finally {
      setWorking(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 28,
          justifyContent: "center",
          maxWidth: 500,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Fade>
          <View style={{ alignItems: "center", gap: 25 }}>
            <Label
              dim
              size={10}
              style={{ letterSpacing: 6, textAlign: "center" }}
            >
              COOKIES / TEAM SPACE
            </Label>
            <View style={s.orbit}>
              <View style={s.inner}>
                <FontAwesome5
                  name="cookie-bite"
                  color={colors.gold}
                  size={58}
                />
              </View>
              <View style={s.dot} />
            </View>
            <View style={{ gap: 4, alignItems: "center" }}>
              <Heading size={38}>مساحتك للإبداع.</Heading>
              <Label dim style={{ textAlign: "center", lineHeight: 27 }}>
                كل فصل تنجزه يصنع فرقًا.{"\n"}أعمالك، فريقك، ومستحقاتك في مكان
                واحد.
              </Label>
            </View>
            <Glass gold style={{ width: "100%", gap: 18 }}>
              <Label
                size={12}
                style={{ textAlign: "center", color: colors.gold }}
              >
                صُممت لفريق كوكيز
              </Label>
              <Button
                title={working ? "جارٍ تسجيل الدخول…" : "الدخول بحساب ديسكورد"}
                icon="logo-discord"
                onPress={() => void signIn()}
                disabled={!server || working || busy}
              />
              <Label dim size={11} style={{ textAlign: "center" }}>
                نفس حسابك. نفس الفريق. بداية جديدة.
              </Label>
              {!server && (
                <Label
                  size={11}
                  style={{ textAlign: "center", color: colors.muted }}
                >
                  يلزم إعداد عنوان خدمة الفريق لتمكين تسجيل الدخول.
                </Label>
              )}
            </Glass>
            {error ? (
              <Label style={{ color: colors.red }}>{error}</Label>
            ) : null}
            <View style={{ width: "100%", gap: 10 }}>
              <Label dim size={11} style={{ textAlign: "center" }}>
                تستخدم هذه النسخة بيانات الفريق الحقيقية فقط.
              </Label>
            </View>
          </View>
        </Fade>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  orbit: {
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.27)",
    backgroundColor: "#211E17",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 0px 45px rgba(232,199,124,0.08)",
  },
  dot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.gold,
    top: 21,
    right: 24,
  },
});
