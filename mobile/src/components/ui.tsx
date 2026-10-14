import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  AccessibilityInfo,
  ScrollView,
  RefreshControl,
  Platform,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Media } from "./Media";
import * as Haptics from "expo-haptics";
export const colors = {
  bg: "#08090D",
  panel: "#131419",
  gold: "#E8C77C",
  muted: "#8D8F9A",
  text: "#F5F3ED",
  green: "#9DD3AE",
  red: "#EA9797",
  line: "rgba(255,255,255,.08)",
};
export function Label({
  children,
  dim = false,
  size = 14,
  style,
}: {
  children: React.ReactNode;
  dim?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle> | any;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: "Cairo_500Medium",
          color: dim ? colors.muted : colors.text,
          fontSize: size,
          textAlign: "right",
          writingDirection: "rtl",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Heading({
  children,
  size = 25,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: React.ComponentProps<typeof Text>["style"];
}) {
  return (
    <Text
      style={[
        {
          fontFamily: "Cairo_700Bold",
          fontSize: size,
          color: colors.text,
          textAlign: "right",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 22,
  color = colors.gold,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Glass({
  children,
  style,
  gold = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gold?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        gold && { borderColor: "rgba(232,199,124,.24)" },
        style,
      ]}
    >
      <BlurView
        intensity={Platform.OS === "ios" ? 22 : 0}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
export function Fade({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current,
    offset = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: reduce ? 0 : 360,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(offset, {
          toValue: 0,
          duration: reduce ? 0 : 360,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    });
    return () => {
      active = false;
    };
  }, [opacity, offset]);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY: offset }] }}>
      {children}
    </Animated.View>
  );
}
export function Button({
  title,
  onPress,
  icon,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && { backgroundColor: "#302024", borderColor: "#613B41" },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          color={secondary ? colors.gold : danger ? colors.red : colors.bg}
        />
      )}
      <Text
        style={{
          fontFamily: "Cairo_700Bold",
          fontSize: 14,
          color: secondary ? colors.text : danger ? colors.red : colors.bg,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
  number = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  number?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label dim>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#656875"
        keyboardType={number ? "decimal-pad" : "default"}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 95, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Chips({
  items,
  value,
  onSelect,
}: {
  items: { label: string; value: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: "row-reverse",
        gap: 8,
        paddingVertical: 4,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.value }}
          onPress={() => onSelect(item.value)}
          style={[
            styles.chip,
            value === item.value && {
              backgroundColor: "rgba(232,199,124,.12)",
              borderColor: "rgba(232,199,124,.4)",
            },
          ]}
        >
          <Label
            size={12}
            style={{ color: value === item.value ? colors.gold : colors.muted }}
          >
            {item.label}
          </Label>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={[styles.row, { justifyContent: "space-between", marginTop: 8 }]}
    >
      <Heading size={18}>{title}</Heading>
      {action && (
        <Pressable onPress={onPress} accessibilityRole="button">
          <Label size={12} style={{ color: colors.gold }}>
            {action}
          </Label>
        </Pressable>
      )}
    </View>
  );
}
export function Row({
  title,
  detail,
  icon,
  onPress,
  accessibilityLabel,
  right,
  danger = false,
  image,
  cover = false,
}: {
  title: string;
  detail?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
  accessibilityLabel?: string;
  right?: string;
  danger?: boolean;
  image?: string;
  cover?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { paddingVertical: 15, gap: 14, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {image ? (
        <Media uri={image} name={title} size={44} cover={cover} />
      ) : (
        icon && (
          <View style={styles.iconBox}>
            <Icon name={icon} color={danger ? colors.red : colors.gold} />
          </View>
        )
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Label style={danger ? { color: colors.red } : undefined}>
          {title}
        </Label>
        {detail && (
          <Label dim size={11}>
            {detail}
          </Label>
        )}
      </View>
      {right ? (
        <Label style={{ color: colors.gold }}>{right}</Label>
      ) : onPress ? (
        <Icon name="chevron-back" size={16} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}
export function Empty({
  title = "لا توجد بيانات بعد",
  detail = "ستظهر سجلات الفريق هنا بمجرد إضافة أول عمل.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <Glass style={{ alignItems: "center", padding: 32, gap: 10 }}>
      <Icon name="sparkles-outline" size={30} />
      <Heading size={17}>{title}</Heading>
      <Label dim style={{ textAlign: "center" }}>
        {detail}
      </Label>
    </Glass>
  );
}
export function Page({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        ) : undefined
      }
      contentContainerStyle={{
        padding: 22,
        paddingBottom: 110,
        gap: 18,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Fade>{children}</Fade>
    </ScrollView>
  );
}
export function Backdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#15130F", "#08090D", "#090C12"]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: "absolute",
          width: 340,
          height: 340,
          borderRadius: 170,
          borderWidth: 1,
          borderColor: "rgba(232,199,124,.1)",
          top: -180,
          left: -80,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: 140,
          borderWidth: 1,
          borderColor: "rgba(232,199,124,.05)",
          top: -150,
          left: -50,
        }}
      />
    </View>
  );
}
export const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(23,24,30,.84)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
  },
  row: { flexDirection: "row-reverse", alignItems: "center" },
  button: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.gold,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 18,
  },
  secondary: { backgroundColor: "#191A20", borderColor: colors.line },
  input: {
    color: colors.text,
    fontFamily: "Cairo_500Medium",
    fontSize: 14,
    textAlign: "right",
    backgroundColor: "#14151C",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 15,
    minHeight: 54,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#14151A",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,199,124,.07)",
  },
  stack: { gap: 16 },
  divider: { height: 1, backgroundColor: colors.line },
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.25)",
    padding: 24,
    overflow: "hidden",
  },
  money: {
    fontFamily: "Cairo_700Bold",
    fontSize: 48,
    color: colors.gold,
    textAlign: "right",
    lineHeight: 72,
  },
  mini: {
    flex: 1,
    borderRadius: 18,
    padding: 15,
    backgroundColor: "#15161C",
    borderWidth: 1,
    borderColor: colors.line,
  },
});
