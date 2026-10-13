import React from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
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
import { Specialties, AdminForm } from "./src/screens/Admin";
import { Azora } from "./src/screens/Azora";
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
    <NavigationContainer theme={theme}>
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
          options={{ title: "إنجاز جديد", presentation: "modal" }}
        />
        <Stack.Screen
          name="Detail"
          component={Detail}
          options={{ title: "التفاصيل" }}
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
          <StatusBar style="light" />
          <Screens />
        </TeamProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
