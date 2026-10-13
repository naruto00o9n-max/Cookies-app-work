import { Alert } from "../lib/alerts";
import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import { allowedSpecialties, parseChapters, priceOf } from "../lib/domain";
import {
  Page,
  Glass,
  Label,
  Heading,
  Chips,
  Field,
  Button,
  styles,
  colors,
  Empty,
} from "../components/ui";
export function Register({ route }: { route: any }) {
  const { snapshot: s, user, execute, offline } = useTeam();
  const nav = useNavigation<any>();
  const [work, setWork] = useState(route.params?.work || ""),
    [type, setType] = useState(""),
    [chapters, setChapters] = useState(route.params?.chapter || ""),
    [mixed, setMixed] = useState(""),
    [notes, setNotes] = useState(""),
    [target, setTarget] = useState(user?.id || ""),
    [busy, setBusy] = useState(false);
  if (!s || !user) return null;
  const works = s.works.filter((w) => !w.isolated && w.active !== false),
    selected = works.find((w) => w.name === work),
    types = allowedSpecialties(s, selected);
  let estimated = 0;
  try {
    const inputTypes = (mixed || type).split(/[,،]/).map((t) => t.trim());
    estimated = selected
      ? parseChapters(chapters).reduce(
          (sum, ch, i) =>
            sum +
            (Number(ch) < (selected.paid_start ?? 0)
              ? 0
              : priceOf(
                  s,
                  selected,
                  inputTypes.length === 1 ? inputTypes[0] : inputTypes[i],
                )),
          0,
        )
      : 0;
  } catch {}
  const save = async () => {
    setBusy(true);
    try {
      const message = await execute({
        action: "register",
        payload: {
          userId: target,
          work,
          chapters,
          types: mixed || type,
          notes,
        },
      });
      Alert.alert("إنجاز جديد ✦", message, [
        { text: "رائع", onPress: () => nav.goBack() },
      ]);
    } catch (e) {
      Alert.alert(
        "تعذر التسجيل",
        e instanceof Error ? e.message : "حاول مجددًا",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <View style={styles.stack}>
        <Label dim>كل خطوة صغيرة تستحق أن تُحسب.</Label>
        {!works.length ? (
          <Empty
            title="أضف أول عمل"
            detail="يضيف المشرف الأعمال قبل بدء التسجيل."
          />
        ) : (
          <>
            <Glass style={styles.stack}>
              <Label>اختر العمل</Label>
              <Chips
                items={works.map((w) => ({ label: w.name, value: w.name }))}
                value={work}
                onSelect={(name) => {
                  setWork(name);
                  setType("");
                }}
              />
              {selected && (
                <>
                  <Label>التخصص</Label>
                  <Chips
                    items={types.map((t) => ({
                      label: t.replace(/_/g, " "),
                      value: t,
                    }))}
                    value={type}
                    onSelect={setType}
                  />
                </>
              )}
              <Field
                label="الفصول المنجزة"
                value={chapters}
                onChange={setChapters}
                placeholder="مثال: 1-5 أو 1،3،5"
              />
              <Field
                label="تخصصات مختلطة · اختياري"
                value={mixed}
                onChange={setMixed}
                placeholder="تخصص لكل فصل، مفصول بفاصلة"
              />
              <Field
                label="ملاحظات · اختياري"
                value={notes}
                onChange={setNotes}
                multiline
              />
              {user.isAdmin && (
                <>
                  <Label dim>تسجيل باسم</Label>
                  <Chips
                    items={s.members.map((m) => ({
                      label: m.name,
                      value: m.id,
                    }))}
                    value={target}
                    onSelect={setTarget}
                  />
                </>
              )}
            </Glass>
            <Glass gold>
              <Label dim size={12}>
                المستحق المتوقع
              </Label>
              <Heading size={30}>
                {s.settings.currency} {estimated.toFixed(3)}
              </Heading>
              <Label dim size={11}>
                السعر النهائي بعد استبعاد المجاني والمكرر والتحقق من أزورا.
              </Label>
            </Glass>
            <Button
              title={busy ? "جارٍ الحفظ…" : "تأكيد تسجيل الإنجاز"}
              onPress={() => void save()}
              icon="checkmark-circle-outline"
              disabled={
                busy || offline || !work || !(type || mixed) || !chapters
              }
            />
            {offline && (
              <Label style={{ color: colors.red }}>
                يمكنك تجهيز المدخلات الآن، والحفظ عند عودة الاتصال.
              </Label>
            )}
          </>
        )}
      </View>
    </Page>
  );
}
