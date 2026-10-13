import React from "react";
import * as Notifications from "expo-notifications";
import { NotificationCenter } from "./src/components/NotificationCenter";
import { View, ActivityIndicator, Platform } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Cairo_500Medium } from "@expo-google-fonts/cairo/500Medium";
import { Cairo_700Bold } from "@expo-google-fonts/cairo/700Bold";
import { TeamProvider, useTeam } from "./src/lib/context";
import { Icon, Backdrop, colors } from "./src/components/ui";
import { Login } from "./src/screens/Login";
import { Home } from "./src/screens/Home";
import { Register } from "./src/screens/Register";
import { Works, Records, Team, Detail } from "./src/screens/Lists";
import {
  More,
  Reports,
  Months,
  Audit,
  Help,
  Diagnostics,
} from "./src/screens/More";
import { Control, ControlSection } from "./src/screens/Control";
import { Specialties, AdminForm } from "./src/screens/Admin";
import { Azora } from "./src/screens/Azora";
const notificationNav = createNavigationContainerRef<any>();
const Stack = createNativeStackNavigator(),
  Tabs = createBottomTabNavigator();
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
    primary: colors.gold,
  },
};
function Main() {
  React.useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    let lastId = "";
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!active || !response) return;
      if (!notificationNav.isReady()) {
        setTimeout(() => open(response), 300);
        return;
      }
      const id = response.notification.request.identifier;
      if (lastId === id) return;
      lastId = id;
      const data = response.notification.request.content.data || {};
      if (typeof data.work === "string")
        notificationNav.navigate("Detail", {
          work: data.work,
          chapter: data.chapter,
        });
      else if (data.screen === "Reports") notificationNav.navigate("Reports");
      void Notifications.clearLastNotificationResponseAsync();
    };
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => {});
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: "Cairo_500Medium",
          fontSize: 10,
          lineHeight: 22,
        },
        tabBarStyle: {
          backgroundColor: "#101117",
          borderTopColor: colors.line,
          height: 88,
          paddingBottom: 12,
          paddingTop: 10,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {[
        { name: "Home", label: "الرئيسية", icon: "grid-outline", screen: Home },
        {
          name: "Works",
          label: "الأعمال",
          icon: "albums-outline",
          screen: Works,
        },
        {
          name: "Records",
          label: "سجلاتي",
          icon: "document-text-outline",
          screen: Records,
        },
        { name: "Team", label: "الفريق", icon: "people-outline", screen: Team },
        {
          name: "More",
          label: "مساحتي",
          icon: "ellipse-outline",
          screen: More,
        },
      ].map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          component={t.screen}
          options={{
            title: t.label,
            tabBarIcon: ({ color }) => (
              <Icon name={t.icon as any} color={color} size={21} />
            ),
          }}
        />
      ))}
    </Tabs.Navigator>
  );
}
function Screens() {
  const { user, busy, snapshot } = useTeam();
  if (busy && !user)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  if (!user || !snapshot) return <Login />;
  return (
    <NavigationContainer ref={notificationNav} theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.gold,
          headerTitleStyle: {
            fontFamily: "Cairo_700Bold",
            fontSize: 17,
            color: colors.text,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_left",
        }}
      >
        <Stack.Screen
          name="Main"
          component={Main}
          options={{ title: "COOKIES", headerTitleAlign: "center" }}
        />
        <Stack.Screen
          name="Register"
          component={Register}
          options={{ title: "تسجيل فصول", presentation: "modal" }}
        />
        <Stack.Screen
          name="Detail"
          component={Detail}
          options={{ title: "التفاصيل" }}
        />
        <Stack.Screen
          name="Control"
          component={Control}
          options={{ title: "لوحة الإشراف" }}
        />
        <Stack.Screen
          name="ControlSection"
          component={ControlSection}
          options={{ title: "إدارة الفريق" }}
        />
        <Stack.Screen
          name="Reports"
          component={Reports}
          options={{ title: "التقارير" }}
        />
        <Stack.Screen
          name="Specialties"
          component={Specialties}
          options={{ title: "الأسعار والتخصصات" }}
        />
        <Stack.Screen
          name="Months"
          component={Months}
          options={{ title: "الشهور" }}
        />
        <Stack.Screen
          name="Audit"
          component={Audit}
          options={{ title: "سجل الإدارة" }}
        />
        <Stack.Screen
          name="Help"
          component={Help}
          options={{ title: "دليل الاستخدام" }}
        />
        <Stack.Screen
          name="Diagnostics"
          component={Diagnostics}
          options={{ title: "فحص الاتصال" }}
        />
        <Stack.Screen
          name="Azora"
          component={Azora}
          options={{ title: "مركز أزورا" }}
        />
        <Stack.Screen
          name="AdminForm"
          component={AdminForm}
          options={{ title: "إدارة المساحة", presentation: "modal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  const [loaded, error] = useFonts({ Cairo_500Medium, Cairo_700Bold });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TeamProvider>
          <NotificationCenter>
            <StatusBar style="light" />
            <Screens />
          </NotificationCenter>
        </TeamProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
