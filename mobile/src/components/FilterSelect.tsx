import React, { useState } from "react";
import { Pressable, View } from "react-native";
import {
  RegistrationSelectionSheet,
  type RegistrationOption,
} from "./RegistrationSelectionSheet";
import { Heading, Icon, Label, colors, styles } from "./ui";
export function FilterSelect({
  label,
  hint,
  value,
  items,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  items: RegistrationOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => item.value === value);
  return (
    <View style={{ gap: 7 }}>
      <Label size={12} style={{ color: colors.gold }}>
        {label}
      </Label>
      <Label dim size={11}>
        {hint}
      </Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`اختيار ${label}`}
        style={[
          styles.row,
          {
            gap: 12,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: "#171820",
          },
        ]}
        onPress={() => setOpen(true)}
      >
        <View style={{ flex: 1 }}>
          <Heading size={16}>{selected?.label || "اختر"}</Heading>
        </View>
        <Icon name="chevron-down" size={18} />
      </Pressable>
      {open && (
        <RegistrationSelectionSheet
          title={label}
          hint={hint}
          value={value}
          items={items}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </View>
  );
}
