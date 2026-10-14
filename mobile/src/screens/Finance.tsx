import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useTeam } from "../lib/context";
import { Alert } from "../lib/alerts";
import { adjustmentPreview, isFinancialEntry } from "../lib/finance";
import { totalOf, visibleEntries } from "../lib/domain";
import { RegistrationSelectionSheet } from "../components/RegistrationSelectionSheet";
import { Media } from "../components/Media";
import {
  Button,
  Chips,
  Empty,
  Field,
  Glass,
  Heading,
  Icon,
  Label,
  Page,
  Row,
  Section,
  colors,
  styles,
} from "../components/ui";
const money = (value: number, currency: string) =>
  `${value.toLocaleString("ar", { maximumFractionDigits: 3, minimumFractionDigits: 2 })} ${currency}`;
function MemberChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { snapshot: s, user } = useTeam();
  const [open, setOpen] = useState(false),
    [recent, setRecent] = useState("");
  useEffect(() => {
    if (user)
      void AsyncStorage.getItem(`cookies:finance:last-member:${user.id}`)
        .then((v) => setRecent(v || ""))
        .catch(() => {});
  }, [user?.id]);
  const selected = s?.members.find((m) => m.id === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="اختيار العضو للعملية المالية"
        style={design.member}
        onPress={() => setOpen(true)}
      >
        <Media uri={selected?.avatar} name={selected?.name || "؟"} size={52} />
        <View style={{ flex: 1, gap: 5 }}>
          <Label dim size={11}>
            العضو المستفيد أو المستهدف
          </Label>
          <Heading size={19}>{selected?.name || "اختر عضوًا"}</Heading>
        </View>
        <Icon name="chevron-down" />
      </Pressable>
      {open && (
        <RegistrationSelectionSheet
          title="اختر العضو"
          hint="ابحث بالاسم المعروض أو اسم ديسكورد؛ آخر اختيار يظهر أولًا."
          value={value}
          items={[...(s?.members || [])]
            .sort(
              (a, b) =>
                Number(b.id === recent) - Number(a.id === recent) ||
                a.name.localeCompare(b.name),
            )
            .map((m) => ({
              value: m.id,
              label: m.name,
              detail: m.username,
              image: m.avatar,
              search: `${m.id} ${m.username || ""} ${m.nickname || ""}`,
              recent: m.id === recent,
            }))}
          onClose={() => setOpen(false)}
          onSelect={(id) => {
            onChange(id);
            setRecent(id);
            if (user)
              void AsyncStorage.setItem(
                `cookies:finance:last-member:${user.id}`,
                id,
              ).catch(() => {});
          }}
        />
      )}
    </>
  );
}
export function Adjustment({ route }: { route: any }) {
  const { snapshot: s, user, execute, offline } = useTeam();
  const nav = useNavigation<any>();
  const [member, setMember] = useState<string>(route.params?.member || ""),
    [kind, setKind] = useState(""),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  if (!s || !user) return null;
  if (!user.isAdmin)
    return (
      <Page>
        <Empty title="العمليات المالية للمشرفين" />
      </Page>
    );
  const selected = s.members.find((m) => m.id === member),
    currency = s.settings.currency,
    current = totalOf(visibleEntries(s, member)).amount,
    preview = adjustmentPreview(amount, kind, current);
  const deduction = kind === "خصم";
  const accent = deduction ? colors.red : colors.green;
  const save = () => {
    if (!selected || !preview.valid || !reason.trim() || busy) return;
    Alert.alert(
      `مراجعة ${kind}`,
      `${selected.name}\n${deduction ? "سيُخصم" : "ستُضاف مكافأة قدرها"} ${money(preview.amount, currency)} ${deduction ? "من مستحقاته" : "إلى مستحقاته"}.\nالصافي: ${money(current, currency)} ← ${money(preview.after, currency)}\nالشهر: ${s.settings.active_month}\nالسبب: ${reason.trim()}`,
      [
        { text: "مراجعة التفاصيل", style: "cancel" },
        {
          text: `${deduction ? "خصم" : "إضافة"} ${money(preview.amount, currency)} ${deduction ? "من" : "إلى"} ${selected.name}`,
          style: deduction ? "destructive" : "default",
          onPress: () => {
            setBusy(true);
            void execute({
              action: "adjustment",
              payload: {
                userId: member,
                kind,
                amount: preview.amount,
                notes: reason.trim(),
              },
            })
              .then(() => {
                Alert.alert(
                  deduction ? "تم تسجيل الخصم" : "تم تسجيل المكافأة",
                  `حُفظت العملية لـ ${selected.name} في ${s.settings.active_month}.`,
                  [
                    {
                      text: "عرض الحركات المالية",
                      onPress: () => nav.popTo("Finance", { member }),
                    },
                  ],
                );
              })
              .catch((e) =>
                Alert.alert(
                  "تعذر تأكيد حفظ العملية",
                  e instanceof Error ? e.message : "حاول مجددًا",
                ),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };
  return (
    <Page>
      <View style={styles.stack}>
        <Label dim size={10} style={{ letterSpacing: 3 }}>
          COOKIES / FINANCE
        </Label>
        <Heading size={30}>قرار مالي واضح.</Heading>
        <Label dim>
          اختر العملية وراجع أثرها قبل حفظها. لا تُسجّل كعمل أو فصل.
        </Label>
        <MemberChoice value={member} onChange={setMember} />
        <Section title="١ · ماذا تريد أن تفعل؟" />
        <View style={[styles.row, { gap: 12 }]}>
          {[
            {
              value: "مكافأة",
              title: "إضافة مكافأة",
              detail: "زيادة المستحقات",
              icon: "add-circle-outline",
              color: colors.green,
            },
            {
              value: "خصم",
              title: "تسجيل خصم",
              detail: "تقليل المستحقات",
              icon: "remove-circle-outline",
              color: colors.red,
            },
          ].map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.title}
              accessibilityState={{ checked: kind === option.value }}
              onPress={() => setKind(option.value)}
              style={[
                design.operation,
                {
                  borderColor:
                    kind === option.value ? option.color : colors.line,
                  backgroundColor:
                    kind === option.value ? `${option.color}15` : "#121319",
                },
              ]}
            >
              <Icon name={option.icon as any} color={option.color} size={30} />
              <Heading size={18}>{option.title}</Heading>
              <Label dim size={11}>
                {option.detail}
              </Label>
              <Icon
                name={
                  kind === option.value ? "checkmark-circle" : "ellipse-outline"
                }
                color={option.color}
                size={20}
              />
            </Pressable>
          ))}
        </View>
        <Glass style={styles.stack}>
          <Section title="٢ · المبلغ والسبب" />
          <Field
            label={`مبلغ العملية (${currency})`}
            number
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
          />
          <Label dim size={11}>
            اكتب مبلغًا موجبًا؛ نوع العملية يحدد الإضافة أو الخصم.
          </Label>
          <Field
            label="سبب العملية المالية"
            value={reason}
            onChange={setReason}
            placeholder={
              deduction ? "لماذا تخصم هذا المبلغ؟" : "لماذا تمنح هذه المكافأة؟"
            }
            multiline
          />
          <Label dim size={11}>
            اختيار العضو والمبلغ وسبب العملية مطلوب قبل المراجعة.
          </Label>
          {!!amount && !preview.valid && (
            <Label style={{ color: colors.red }}>
              {kind
                ? "أدخل مبلغًا من 0.001 إلى 1,000,000، حتى 3 منازل عشرية."
                : "اختر مكافأة أو خصم أولًا."}
            </Label>
          )}
        </Glass>
        {!!selected && (
          <Glass gold style={{ padding: 0, overflow: "hidden" }}>
            <LinearGradient
              colors={[`${accent}16`, "#121319"]}
              style={{ padding: 24, gap: 17 }}
            >
              <Row
                title="٣ · مراجعة المستحقات"
                detail={`${selected.name} · ${s.months.find((m) => m.key === s.settings.active_month)?.name || s.settings.active_month}`}
                icon="wallet-outline"
              />
              <Row title="الصافي الحالي" right={money(current, currency)} />
              <Row
                title={kind || "العملية لم تُحدد"}
                right={
                  preview.valid
                    ? `${deduction ? "−" : "+"} ${money(preview.amount, currency)}`
                    : "—"
                }
              />
              <View style={styles.divider} />
              <Label dim size={11}>
                الصافي بعد العملية
              </Label>
              <Heading size={32} style={{ color: accent }}>
                {money(preview.after, currency)}
              </Heading>
              {preview.valid && preview.after < 0 && (
                <Label style={{ color: colors.red }}>
                  سيصبح صافي المستحقات سالبًا. راجع المبلغ قبل التأكيد.
                </Label>
              )}
            </LinearGradient>
          </Glass>
        )}
        <Button
          title={
            busy
              ? "جارٍ حفظ العملية…"
              : !kind
                ? "اختر نوع العملية للمتابعة"
                : deduction
                  ? "مراجعة الخصم وتأكيده"
                  : "مراجعة المكافأة وتأكيدها"
          }
          icon={deduction ? "remove-circle-outline" : "gift-outline"}
          danger={deduction}
          disabled={
            busy || offline || !selected || !preview.valid || !reason.trim()
          }
          onPress={save}
        />
      </View>
    </Page>
  );
}
export function Finance({ route }: { route: any }) {
  const { snapshot: s, user, execute, offline } = useTeam();
  const nav = useNavigation<any>();
  const [member, setMember] = useState(route.params?.member || user?.id || ""),
    [month, setMonth] = useState(""),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    if (route.params?.member) setMember(route.params.member);
  }, [route.params?.member]);
  if (!s || !user) return null;
  const target = user.isAdmin ? member : user.id,
    active = month || s.settings.active_month,
    currency = s.settings.currency,
    t = totalOf(visibleEntries(s, target, active)),
    selected = s.members.find((m) => m.id === target);
  const ledger = s.records
    .filter(
      (e) =>
        e.userId === target &&
        e.month_key === active &&
        isFinancialEntry(e) &&
        (filter === "all" || e.work_type === filter),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <Page>
      <View style={styles.stack}>
        <Label dim size={10} style={{ letterSpacing: 3 }}>
          COOKIES / FINANCE
        </Label>
        <Heading size={30}>المستحقات والحركات</Heading>
        <Label dim>الفصول أعمالك؛ المكافآت والخصومات حركات مالية مستقلة.</Label>
        {user.isAdmin ? (
          <MemberChoice value={member} onChange={setMember} />
        ) : (
          <Row title={selected?.name || user.name} image={selected?.avatar} />
        )}
        <Chips
          items={s.months.map((m) => ({ label: m.name, value: m.key }))}
          value={active}
          onSelect={setMonth}
        />
        <Glass gold>
          <Label dim>صافي المستحقات · {active}</Label>
          <Heading size={38}>{money(t.amount, currency)}</Heading>
          <View style={styles.divider} />
          <Row
            title="مستحقات الفصول"
            right={money(t.amount - t.bonuses + t.deductions, currency)}
            icon="document-text-outline"
          />
          <Row
            title="المكافآت"
            right={`+ ${money(t.bonuses, currency)}`}
            icon="gift-outline"
          />
          <Row
            title="الخصومات"
            right={`− ${money(t.deductions, currency)}`}
            icon="remove-circle-outline"
          />
        </Glass>
        {user.isAdmin && (
          <Button
            title="عملية مالية جديدة"
            icon="add-outline"
            disabled={offline}
            onPress={() => nav.navigate("Adjustment", { member: target })}
          />
        )}
        <Section title="سجل الحركات المالية" />
        <Chips
          items={[
            { label: "الكل", value: "all" },
            { label: "المكافآت", value: "مكافأة" },
            { label: "الخصومات", value: "خصم" },
          ]}
          value={filter}
          onSelect={setFilter}
        />
        {ledger.map((e) => (
          <Glass key={e.id}>
            <Row
              title={
                e.work_type === "خصم" ? "خصم من المستحقات" : "مكافأة مضافة"
              }
              icon={
                e.work_type === "خصم" ? "remove-circle-outline" : "gift-outline"
              }
              right={`${e.total < 0 ? "−" : "+"} ${money(Math.abs(e.total), currency)}`}
            />
            <Label style={{ marginTop: 10 }}>
              {e.notes || "لم يُسجّل سبب لهذه العملية القديمة"}
            </Label>
            <Label dim size={10} style={{ marginTop: 10 }}>
              {new Date(e.timestamp).toLocaleString("ar")} · بواسطة{" "}
              {s.members.find((m) => m.id === e.added_by)?.name || "الإدارة"}
            </Label>
            {user.isAdmin && (
              <Button
                secondary
                danger
                disabled={offline}
                title="حذف هذه الحركة"
                onPress={() =>
                  Alert.alert(
                    "حذف الحركة المالية؟",
                    `ستُزال ${e.work_type} بقيمة ${money(Math.abs(e.total), currency)} ويُعاد حساب الصافي.`,
                    [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "حذف الحركة",
                        style: "destructive",
                        onPress: () => {
                          void execute({
                            action: "deleteRecord",
                            payload: { id: e.id },
                          }).catch((error) =>
                            Alert.alert("تعذر الحذف", error.message),
                          );
                        },
                      },
                    ],
                  )
                }
              />
            )}
          </Glass>
        ))}
        {!ledger.length && (
          <Empty
            title="لا توجد حركات مالية"
            detail="هذا الشهر لا يتضمن مكافآت أو خصومات بهذا الفلتر."
          />
        )}
      </View>
    </Page>
  );
}
const design = StyleSheet.create({
  member: {
    ...styles.row,
    gap: 14,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#15161D",
  },
  operation: {
    flex: 1,
    padding: 18,
    gap: 12,
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 24,
  },
});
