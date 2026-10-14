import { WorkPicker } from "../components/WorkPicker";
import { Adjustment } from "./Finance";
import { Alert } from "../lib/alerts";
import React, { useState } from "react";
import { View, Switch } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import {
  Page,
  Glass,
  Heading,
  Label,
  Field,
  Chips,
  Button,
  Section,
  Row,
  styles,
  colors,
  Empty,
} from "../components/ui";
export function Specialties() {
  const { snapshot: s, user } = useTeam();
  const nav = useNavigation<any>();
  if (!s) return null;
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>قيمة كل تخصص</Heading>
        <Label dim>أسعار دقيقة. مكافأة عادلة لكل إنجاز.</Label>
        {user?.isAdmin && (
          <Button
            secondary
            title="إضافة تخصص"
            icon="add-outline"
            onPress={() => nav.navigate("AdminForm", { kind: "specialty" })}
          />
        )}
        <Glass>
          {Object.entries(s.specialties).map(([name, sp], i) => (
            <View key={name}>
              {i > 0 && <View style={styles.divider} />}
              <Row
                title={name.replace(/_/g, " ")}
                detail={sp.active ? "نشط" : "معطّل"}
                icon="pricetag-outline"
                right={`${s.settings.currency}${sp.price.toFixed(3)}`}
                onPress={
                  user?.isAdmin
                    ? () =>
                        nav.navigate("AdminForm", {
                          kind: "specialty",
                          specialty: name,
                        })
                    : undefined
                }
              />
            </View>
          ))}
        </Glass>
        <Section title="أسعار مخصصة للأعمال" />
        {s.works
          .filter((w) => w.custom_prices)
          .map((w) => (
            <Glass key={w.name}>
              <Heading size={17}>{w.name}</Heading>
              {Object.entries(w.custom_prices || {}).map(([name, price]) => (
                <Row
                  key={name}
                  title={name.replace(/_/g, " ")}
                  right={`${s.settings.currency}${price.toFixed(3)}`}
                  onPress={
                    user?.isAdmin
                      ? () =>
                          nav.navigate("AdminForm", {
                            kind: "customPrice",
                            work: w.name,
                            specialty: name,
                          })
                      : undefined
                  }
                />
              ))}
            </Glass>
          ))}
      </View>
    </Page>
  );
}
type FormField = {
  key: string;
  label: string;
  placeholder?: string;
  number?: boolean;
};
export function AdminForm({ route }: { route: any }) {
  const { snapshot: s, user, execute, offline } = useTeam();
  const nav = useNavigation<any>();
  const params = route.params || {},
    kind = params.kind;
  const w = s?.works.find((w) => w.name === params.work),
    sp = s?.specialties[params.specialty],
    m = s?.months.find((m) => m.key === params.month);
  const [values, setValues] = useState<Record<string, string>>({
    name: params.specialty || params.work || m?.name || "",
    newName: w?.name || "",
    work: params.work || "",
    paid_start: w?.paid_start?.toString() || "",
    price: String(sp?.price ?? w?.custom_prices?.[params.specialty] ?? ""),
    userId: user?.id || "",
    kind: "مكافأة",
    currency: s?.settings.currency || "$",
    payment_day: s?.settings.payment_day?.toString() || "",
    payment_hour: String(s?.settings.payment_hour ?? 0),
    alert_threshold: String(s?.settings.alert_threshold ?? 10),
    key: m?.key || new Date().toISOString().slice(0, 7),
    scope: "clearMonth",
  });
  const [active, setActive] = useState(sp?.active ?? true),
    [activate, setActivate] = useState(true),
    [move, setMove] = useState(false),
    [all, setAll] = useState(false),
    [busy, setBusy] = useState(false);
  if (!s || !user) return null;
  if (!user.isAdmin && kind !== "editLast")
    return (
      <Page>
        <Empty title="هذه الصفحة للمشرفين" />
      </Page>
    );
  if (kind === "adjustment") return <Adjustment route={route} />;
  const set = (key: string, value: string) =>
    setValues((old) => ({ ...old, [key]: value }));
  const titles: Record<string, string> = {
    addWork: "عمل جديد",
    editWork: "إدارة العمل",
    isolate: params.isolated ? "عزل العمل" : "استرجاع العمل",
    specialty: "إدارة التخصص",
    customPrice: "تخصيص أسعار العمل",
    adjustment: "مكافأة أو خصم",
    settings: "إعدادات المساحة",
    month: "الشهور والأرشيف",
    editLast: "تعديل آخر سجل",
    reprice: "تحديث أسعار السجلات",
    clear: "إدارة الحذف",
  };
  const fields: Record<string, FormField[]> = {
    addWork: [
      { key: "name", label: "اسم العمل" },
      { key: "paid_start", label: "أول فصل مدفوع · اختياري", number: true },
    ],
    editWork: [
      { key: "newName", label: "اسم العمل" },
      { key: "paid_start", label: "أول فصل مدفوع · اختياري", number: true },
    ],
    isolate: [],
    specialty: [
      { key: "name", label: "اسم التخصص" },
      { key: "price", label: "سعر الفصل", number: true },
    ],
    customPrice: [
      { key: "name", label: "اسم التخصص" },
      { key: "price", label: "السعر الخاص", number: true },
    ],
    adjustment: [
      { key: "amount", label: "المبلغ الموجب", number: true },
      { key: "notes", label: "السبب" },
    ],
    settings: [
      { key: "currency", label: "رمز العملة" },
      { key: "payment_day", label: "يوم الدفع · 1 إلى 28", number: true },
      {
        key: "payment_hour",
        label: "ساعة الدفع · 0 إلى 23 (UTC)",
        number: true,
      },
      { key: "alert_threshold", label: "حد التنبيه", number: true },
    ],
    month: [
      { key: "key", label: "الشهر بصيغة YYYY-MM", placeholder: "2026-10" },
      { key: "name", label: "اسم الشهر" },
    ],
    editLast: [
      { key: "chapter", label: "رقم الفصل · اختياري", number: true },
      { key: "types", label: "التخصص · اختياري" },
      { key: "notes", label: "الملاحظات" },
    ],
    reprice: [
      { key: "name", label: "تخصص محدد · اختياري" },
      { key: "from", label: "من تاريخ YYYY-MM-DD · اختياري" },
      { key: "to", label: "إلى تاريخ YYYY-MM-DD · اختياري" },
    ],
    clear: [],
  };
  const run = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const message = await execute({ action, payload });
      Alert.alert("تمت العملية", message, [
        { text: "تم", onPress: () => nav.goBack() },
      ]);
    } catch (e) {
      Alert.alert("تعذر الحفظ", e instanceof Error ? e.message : "حاول مجددًا");
    } finally {
      setBusy(false);
    }
  };
  const confirm = (
    action: string,
    payload: Record<string, unknown>,
    message: string,
  ) =>
    Alert.alert("تأكيد العملية", message, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تأكيد",
        style: "destructive",
        onPress: () => void run(action, payload),
      },
    ]);
  const save = () => {
    const p: Record<string, unknown> = { ...values };
    let action = kind;
    if (kind === "editWork") p.name = params.work;
    if (kind === "specialty") p.active = active;
    if (kind === "customPrice") p.move = move;
    if (kind === "month") {
      p.activate = activate;
    }
    if (kind === "reprice") {
      p.all = all;
      confirm(
        "reprice",
        p,
        "ستُعاد حساب مبالغ السجلات وفق الأسعار الحالية، باستثناء الأعمال المعزولة.",
      );
      return;
    }
    if (kind === "isolate") {
      action = "editWork";
      p.name = params.work;
      p.isolated = params.isolated;
      confirm(
        action,
        p,
        params.isolated
          ? "سيُستثنى العمل من الحسابات والتسجيل مع الاحتفاظ بسجلاته."
          : "سيعود العمل إلى التسجيل والحسابات.",
      );
      return;
    }
    if (kind === "clear") {
      action = values.scope;
      confirm(
        action,
        p,
        action === "clearWorks"
          ? "ستُحذف قائمة الأعمال غير المعزولة؛ السجلات محفوظة."
          : "ستُحذف سجلات الشهر النشط، باستثناء الأعمال المعزولة. هذه العملية تؤثر على بيانات الفريق.",
      );
      return;
    }
    void run(action, p);
  };
  const toggle = (
    title: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <Label>{title}</Label>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#393B47", true: "#75633F" }}
        thumbColor={value ? colors.gold : "#BBB"}
      />
    </View>
  );
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>{titles[kind] || "الإدارة"}</Heading>
        <Glass style={styles.stack}>
          {kind === "adjustment" && (
            <>
              <Label dim>العضو</Label>
              <Chips
                items={s.members.map((m) => ({ label: m.name, value: m.id }))}
                value={values.userId}
                onSelect={(v) => set("userId", v)}
              />
              <Chips
                items={[
                  { label: "مكافأة", value: "مكافأة" },
                  { label: "خصم", value: "خصم" },
                ]}
                value={values.kind}
                onSelect={(v) => set("kind", v)}
              />
            </>
          )}
          {kind === "customPrice" && (
            <>
              <Label dim>العمل</Label>
              <WorkPicker
                works={s.works}
                value={values.work}
                onSelect={(v) => set("work", v)}
              />
              <Chips
                items={Object.keys(s.specialties).map((t) => ({
                  label: t.replace(/_/g, " "),
                  value: t,
                }))}
                value={values.name}
                onSelect={(v) => set("name", v)}
              />
            </>
          )}
          {kind === "editLast" && (
            <WorkPicker
              works={s.works.filter((w) => !w.isolated && w.active !== false)}
              value={values.work || ""}
              optional
              onSelect={(v) => set("work", v)}
            />
          )}
          {(fields[kind] || []).map((f) => (
            <Field
              key={f.key}
              label={f.label}
              value={values[f.key] || ""}
              onChange={(v) => set(f.key, v)}
              number={f.number}
              placeholder={f.placeholder}
            />
          ))}
          {kind === "specialty" && toggle("التخصص نشط", active, setActive)}
          {kind === "month" && toggle("تفعيل هذا الشهر", activate, setActivate)}
          {kind === "customPrice" &&
            toggle("نقل التخصص من العام إلى هذا العمل", move, setMove)}
          {kind === "reprice" && toggle("تطبيق على كل الشهور", all, setAll)}
          {kind === "clear" && (
            <>
              <Chips
                items={[
                  { label: "سجلات الشهر", value: "clearMonth" },
                  { label: "كل الأعمال", value: "clearWorks" },
                ]}
                value={values.scope}
                onSelect={(v) => set("scope", v)}
              />
              {values.scope === "clearMonth" && (
                <>
                  <Label dim>عضو محدد أو الجميع</Label>
                  <Chips
                    items={[
                      { label: "الجميع", value: "" },
                      ...s.members.map((m) => ({ label: m.name, value: m.id })),
                    ]}
                    value={values.userId}
                    onSelect={(v) => set("userId", v)}
                  />
                </>
              )}
              <Label style={{ color: colors.red }}>
                صدّر نسخة احتياطية قبل الحذف. السجلات المعزولة محفوظة.
              </Label>
            </>
          )}
          {kind === "isolate" && (
            <Label dim>
              تُحفظ جميع سجلات العمل. العزل يوقف التسجيل ويُخرجه من المستحقات
              حتى استرجاعه.
            </Label>
          )}
        </Glass>
        <Button
          title={
            busy
              ? "جارٍ الحفظ…"
              : kind === "clear"
                ? "تنفيذ الحذف"
                : "حفظ التغييرات"
          }
          icon="checkmark-outline"
          onPress={save}
          disabled={busy || offline}
          danger={kind === "clear"}
        />
        {kind === "editWork" && (
          <Button
            title="حذف العمل من القائمة"
            danger
            onPress={() =>
              confirm(
                "deleteWork",
                { name: params.work },
                "ستُحفظ سجلاته السابقة ويُحذف من قائمة التسجيل.",
              )
            }
            disabled={busy || offline}
          />
        )}
        {kind === "month" && m && (
          <Button
            title="حذف الشهر وسجلاته"
            danger
            onPress={() =>
              confirm(
                "deleteMonth",
                { key: m.key },
                "سيُحذف هذا الشهر وسجلاته. لا يمكن حذف الشهر النشط أو شهر يحوي سجلات معزولة.",
              )
            }
            disabled={busy || offline}
          />
        )}
        {kind === "customPrice" && (
          <>
            <Button
              title="إلغاء تخصيص التخصص"
              secondary
              onPress={() =>
                confirm(
                  "removeCustom",
                  { work: values.work, name: values.name },
                  "سيعود هذا التخصص إلى السعر العام إن كان موجودًا.",
                )
              }
              disabled={busy || offline}
            />
            <Button
              title="نقل التخصص إلى العام"
              secondary
              onPress={() =>
                confirm(
                  "removeCustom",
                  { work: values.work, name: values.name, toGlobal: true },
                  "سيُنقل السعر الخاص إلى القائمة العامة ويُزال من العمل.",
                )
              }
              disabled={busy || offline}
            />
            <Button
              title="إلغاء جميع تخصيصات العمل"
              danger
              onPress={() =>
                confirm(
                  "clearCustom",
                  { work: values.work },
                  "سيعود العمل إلى التخصصات والأسعار العامة.",
                )
              }
              disabled={busy || offline}
            />
          </>
        )}
      </View>
    </Page>
  );
}
