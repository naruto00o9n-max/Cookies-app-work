import React from "react";
import {
  WalkthroughProvider,
  useWalkthrough,
} from "./src/lib/walkthrough-context";
import { Coachmark } from "./src/components/Coachmark";
import { Finance, Adjustment } from "./src/screens/Finance";
import { GlassDialogHost } from "./src/components/GlassDialogHost";
import * as Notifications from "expo-notifications";
import { NotificationCenter } from "./src/components/NotificationCenter";
import { View, ActivityIndicator, Platform, Text } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
  useIsFocused,
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
import { More, Reports, Months, Audit, Diagnostics } from "./src/screens/More";
import { Control, ControlSection } from "./src/screens/Control";
import { Specialties, AdminForm } from "./src/screens/Admin";
import {
  Azora,
  AzoraLink,
  AzoraLinked,
  AzoraSettings,
} from "./src/screens/Azora";
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
  const walkthrough = useWalkthrough();
  React.useEffect(() => {
    if (Platform.OS === "web") {
      const url = new URL(window.location.href);
      const work = url.searchParams.get("work"),
        chapter = url.searchParams.get("chapter");
      const openWeb = () => {
        if (!notificationNav.isReady()) {
          retry = setTimeout(openWeb, 300);
          return;
        }
        if (work && work.length < 512)
          notificationNav.navigate("Detail", { work, chapter });
        else if (url.searchParams.get("screen") === "Reports")
          notificationNav.navigate("Reports");
        if (work || url.searchParams.has("screen")) {
          url.searchParams.delete("work");
          url.searchParams.delete("chapter");
          url.searchParams.delete("screen");
          window.history.replaceState(null, "", url.href);
        }
      };
      let retry: ReturnType<typeof setTimeout>;
      openWeb();
      return () => clearTimeout(retry);
    }
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
          listeners={{
            tabPress: () => {
              if (t.name === "Team") walkthrough.act("leaderboard-opened");
            },
          }}
          options={{
            title: t.label,
            tabBarIcon: ({ color }) => (
              <Icon name={t.icon as any} color={color} size={21} />
            ),
            tabBarLabel:
              t.name === "Team"
                ? ({ color }) => (
                    <Coachmark
                      step="leaderboard"
                      text="هنا التوب · اضغط الفريق"
                      compact
                    >
                      <Text
                        style={{
                          fontFamily: "Cairo_500Medium",
                          fontSize: 10,
                          lineHeight: 22,
                          color,
                        }}
                      >
                        {t.label}
                      </Text>
                    </Coachmark>
                  )
                : t.label,
          }}
        />
      ))}
    </Tabs.Navigator>
  );
}
function withScreenDialogs(Screen: React.ComponentType<any>, name: string) {
  return function ScreenWithDialogs(props: any) {
    const focused = useIsFocused();
    const update = React.useCallback(
      (visible: boolean) => {
        props.navigation.setOptions({
          gestureEnabled: !visible,
          headerBackVisible: !visible,
        });
      },
      [props.navigation],
    );
    return (
      <GlassDialogHost
        root={false}
        active={focused}
        onVisibilityChange={update}
      >
        <Screen {...props} />
      </GlassDialogHost>
    );
  };
}
const dialogScreens = {
  Main: withScreenDialogs(Main, "Main"),
  Finance: withScreenDialogs(Finance, "Finance"),
  Adjustment: withScreenDialogs(Adjustment, "Adjustment"),
  Register: withScreenDialogs(Register, "Register"),
  Detail: withScreenDialogs(Detail, "Detail"),
  Control: withScreenDialogs(Control, "Control"),
  ControlSection: withScreenDialogs(ControlSection, "ControlSection"),
  Reports: withScreenDialogs(Reports, "Reports"),
  Specialties: withScreenDialogs(Specialties, "Specialties"),
  Months: withScreenDialogs(Months, "Months"),
  Audit: withScreenDialogs(Audit, "Audit"),
  Diagnostics: withScreenDialogs(Diagnostics, "Diagnostics"),
  Azora: withScreenDialogs(Azora, "Azora"),
  AzoraLink: withScreenDialogs(AzoraLink, "AzoraLink"),
  AzoraLinked: withScreenDialogs(AzoraLinked, "AzoraLinked"),
  AzoraSettings: withScreenDialogs(AzoraSettings, "AzoraSettings"),
  AdminForm: withScreenDialogs(AdminForm, "AdminForm"),
};
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
          component={dialogScreens.Main}
          options={{ title: "COOKIES", headerTitleAlign: "center" }}
        />
        <Stack.Screen
          name="Finance"
          component={dialogScreens.Finance}
          options={{ title: "المستحقات والحركات المالية" }}
        />
        <Stack.Screen
          name="Adjustment"
          component={dialogScreens.Adjustment}
          options={{ title: "عملية مالية جديدة" }}
        />
        <Stack.Screen
          name="Register"
          component={dialogScreens.Register}
          options={{ title: "تسجيل فصول", presentation: "modal" }}
        />
        <Stack.Screen
          name="Detail"
          component={dialogScreens.Detail}
          options={{ title: "التفاصيل" }}
        />
        <Stack.Screen
          name="Control"
          component={dialogScreens.Control}
          options={{ title: "لوحة الإشراف" }}
        />
        <Stack.Screen
          name="ControlSection"
          component={dialogScreens.ControlSection}
          options={{ title: "إدارة الفريق" }}
        />
        <Stack.Screen
          name="Reports"
          component={dialogScreens.Reports}
          options={{ title: "التقارير" }}
        />
        <Stack.Screen
          name="Specialties"
          component={dialogScreens.Specialties}
          options={{ title: "الأسعار والتخصصات" }}
        />
        <Stack.Screen
          name="Months"
          component={dialogScreens.Months}
          options={{ title: "الشهور" }}
        />
        <Stack.Screen
          name="Audit"
          component={dialogScreens.Audit}
          options={{ title: "سجل الإدارة" }}
        />
        <Stack.Screen
          name="Diagnostics"
          component={dialogScreens.Diagnostics}
          options={{ title: "فحص الاتصال" }}
        />
        <Stack.Screen
          name="Azora"
          component={dialogScreens.Azora}
          options={{ title: "مركز أزورا" }}
        />
        <Stack.Screen
          name="AzoraLink"
          component={dialogScreens.AzoraLink}
          options={{ title: "ربط عمل بأزورا" }}
        />
        <Stack.Screen
          name="AzoraLinked"
          component={dialogScreens.AzoraLinked}
          options={{ title: "الأعمال المرتبطة" }}
        />
        <Stack.Screen
          name="AzoraSettings"
          component={dialogScreens.AzoraSettings}
          options={{ title: "إعدادات أزورا" }}
        />
        <Stack.Screen
          name="AdminForm"
          component={dialogScreens.AdminForm}
          options={{ title: "إدارة المساحة", presentation: "modal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
function SessionScreens() {
  const { user } = useTeam();
  return (
    <WalkthroughProvider key={user?.id || "guest"} owner={user?.id}>
      <Screens />
    </WalkthroughProvider>
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
          <GlassDialogHost>
            <NotificationCenter>
              <StatusBar style="light" />
              <SessionScreens />
            </NotificationCenter>
          </GlassDialogHost>
        </TeamProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
