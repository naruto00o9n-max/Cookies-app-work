import React, { useState } from "react";
import { View } from "react-native";
import type { Work } from "../lib/types";
import { useTeam } from "../lib/context";
import { useRegistrationPreferences } from "../lib/use-registration-preferences";
import { RegistrationSelectionSheet } from "./RegistrationSelectionSheet";
import { Label, Row, styles } from "./ui";
export function WorkPicker({
  works,
  value,
  onSelect,
  label = "العمل",
  optional = false,
}: {
  works: Work[];
  value: string;
  onSelect: (value: string) => void;
  label?: string;
  optional?: boolean;
}) {
  const { user } = useTeam(),
    [open, setOpen] = useState(false),
    { preferences, remember } = useRegistrationPreferences(user?.id || "");
  const selected = works.find((w) => w.name === value);
  const index = (name: string) => {
    const i = preferences.works.indexOf(name);
    return i < 0 ? 999 : i;
  };
  const items = [...works]
    .sort((a, b) => index(a.name) - index(b.name))
    .map((w) => ({
      value: w.name,
      label: w.name,
      image: w.azora?.cover,
      cover: true,
      recent: preferences.works.includes(w.name),
      detail: w.azora?.slug ? "مرتبط بأزورا" : undefined,
    }));
  return (
    <View>
      <Label dim>{label}</Label>
      <Row
        title={selected?.name || "اختر العمل"}
        detail="بحث بالاسم • آخر اختياراتك أولًا"
        image={selected?.azora?.cover}
        cover
        icon="albums-outline"
        onPress={() => setOpen(true)}
      />
      <View style={styles.divider} />
      {open && (
        <RegistrationSelectionSheet
          title={label}
          hint="اختر عملًا من القائمة؛ سيتم تذكر آخر استخدامك."
          items={
            optional
              ? [{ value: "", label: "الإبقاء على العمل الحالي" }, ...items]
              : items
          }
          value={value}
          onSelect={(value) => {
            onSelect(value);
            if (value) remember(value);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </View>
  );
}
