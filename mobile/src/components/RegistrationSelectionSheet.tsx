import React, { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Media } from "./Media";
import { colors, Heading, Icon, Label, styles } from "./ui";

export type RegistrationOption = {
  value: string;
  label: string;
  detail?: string;
  search?: string;
  image?: string;
  cover?: boolean;
  recent?: boolean;
};

export function RegistrationSelectionSheet({
  title,
  hint,
  items,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  hint: string;
  items: RegistrationOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const normalized = search.trim().toLocaleLowerCase();
  const filtered = items.filter((item) =>
    `${item.label} ${item.search || ""}`
      .toLocaleLowerCase()
      .includes(normalized),
  );
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={sheet.overlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="إغلاق الاختيار"
          onPress={onClose}
        />
        <View style={sheet.panel} accessibilityViewIsModal>
          <LinearGradient colors={["#242016", "#121318"]} style={sheet.header}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Heading size={22}>{title}</Heading>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                hitSlop={12}
                onPress={onClose}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <Label dim size={12}>
              {hint}
            </Label>
            <View style={sheet.search}>
              <Icon name="search-outline" color={colors.muted} size={20} />
              <TextInput
                accessibilityLabel={`بحث في ${title}`}
                value={search}
                onChangeText={setSearch}
                placeholder="اكتب الاسم للبحث…"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                style={sheet.searchInput}
              />
              {!!search && (
                <Pressable
                  accessibilityLabel="مسح البحث"
                  onPress={() => setSearch("")}
                >
                  <Icon name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>
          </LinearGradient>
          <FlatList
            data={filtered}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.value}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 30 }}
            ListEmptyComponent={
              <View style={{ padding: 24 }}>
                <Label dim style={{ textAlign: "center" }}>
                  لا توجد نتائج بهذا الاسم.
                </Label>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                style={({ pressed }) => [
                  sheet.option,
                  item.value === value && sheet.selected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                {item.cover || item.image ? (
                  <Media
                    uri={item.image}
                    name={item.label}
                    size={42}
                    cover={item.cover}
                  />
                ) : (
                  <View style={styles.iconBox}>
                    <Icon name="pricetag-outline" />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Label>{item.label}</Label>
                  {!!item.detail && (
                    <Label dim size={11}>
                      {item.detail}
                    </Label>
                  )}
                  {item.recent && (
                    <Label size={10} style={{ color: colors.gold }}>
                      استخدمته مؤخرًا
                    </Label>
                  )}
                </View>
                <Icon
                  name={
                    item.value === value ? "checkmark-circle" : "chevron-back"
                  }
                  size={20}
                  color={item.value === value ? colors.gold : colors.muted}
                />
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  panel: {
    width: "100%",
    maxWidth: 640,
    height: "86%",
    maxHeight: "86%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.22)",
    backgroundColor: "#111217",
    overflow: "hidden",
    flexShrink: 1,
  },
  header: { padding: 22, gap: 12 },
  search: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,.23)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Cairo_500Medium",
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
    paddingVertical: 12,
  },
  option: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#191A20",
    borderWidth: 1,
    borderColor: colors.line,
  },
  selected: {
    backgroundColor: "rgba(232,199,124,.09)",
    borderColor: "rgba(232,199,124,.4)",
  },
});
