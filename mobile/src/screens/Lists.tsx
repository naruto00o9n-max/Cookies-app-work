import { Alert } from "../lib/alerts";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import { useRegistrationPreferences } from "../lib/use-registration-preferences";
import { contributionSummary } from "../lib/detail-data";
import { visibleEntries, totalOf } from "../lib/domain";
import {
  Page,
  Glass,
  Label,
  Heading,
  Section,
  Row,
  Field,
  Chips,
  Empty,
  styles,
  colors,
  Button,
} from "../components/ui";
export function Works() {
  const { snapshot: s, user } = useTeam();
  const nav = useNavigation<any>();
  const { preferences, remember } = useRegistrationPreferences(user?.id || "");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active");
  if (!s) return null;
  const works = s.works
    .filter(
      (w) =>
        (filter === "all" ||
          (filter === "isolated" ? w.isolated : !w.isolated)) &&
        `${w.name} ${w.azora?.title || ""} ${w.azora?.slug || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      const rank = (name: string) => {
        const i = preferences.works.indexOf(name);
        return i < 0 ? 999 : i;
      };
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });
  const openWork = (name: string) => {
    remember(name);
    nav.navigate("Detail", { work: name });
  };
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>عوالم نصنعها معًا</Heading>
        <Label dim>تفاصيل الأعمال ومساهمات الفريق.</Label>
        <Field
          label="ابحث عن عمل"
          value={query}
          onChange={setQuery}
          placeholder="اسم العمل…"
        />
        <Chips
          items={[
            { label: "الأعمال النشطة", value: "active" },
            { label: "المعزولة", value: "isolated" },
            { label: "الكل", value: "all" },
          ]}
          value={filter}
          onSelect={setFilter}
        />
        {!!preferences.works.length && (
          <Glass>
            <Section title="استخدمتها مؤخرًا" />
            <Chips
              items={preferences.works
                .filter((name) => s.works.some((w) => w.name === name))
                .slice(0, 5)
                .map((name) => ({ label: name, value: name }))}
              value=""
              onSelect={openWork}
            />
          </Glass>
        )}
        {user?.isAdmin && (
          <Button
            secondary
            title="إضافة عمل"
            icon="add-outline"
            onPress={() => nav.navigate("AdminForm", { kind: "addWork" })}
          />
        )}{" "}
        {works.map((w) => {
          const entries = s.records.filter(
              (e) =>
                e.work_name === w.name &&
                e.month_key === s.settings.active_month,
            ),
            t = totalOf(entries),
            summary = contributionSummary(entries);
          return (
            <Glass key={w.name}>
              <Row
                title={w.name}
                image={w.azora?.cover}
                cover
                detail={`${summary.chapters} فصل مختلف · ${summary.tasks} مهام · ${summary.members} مساهم · ${w.isolated ? "معزول" : w.active === false ? "التسجيل متوقف" : w.azora ? "مرتبط بأزورا" : "نشط"}`}
                icon="albums-outline"
                onPress={() => openWork(w.name)}
              />
              <View style={styles.divider} />
              <View
                style={[
                  styles.row,
                  { justifyContent: "space-between", marginTop: 15 },
                ]}
              >
                <Label size={11} dim>
                  مدفوع من الفصل {w.paid_start ?? "الأول"}
                </Label>
                <Label style={{ color: colors.gold }}>
                  {s.settings.currency}
                  {t.amount.toFixed(3)}
                </Label>
              </View>
            </Glass>
          );
        })}
        {!works.length && <Empty title="لا توجد أعمال مطابقة" />}
      </View>
    </Page>
  );
}
export function Records() {
  const { snapshot: s, user, execute } = useTeam();
  const nav = useNavigation<any>();
  const [query, setQuery] = useState(""),
    [owner, setOwner] = useState("mine"),
    [month, setMonth] = useState("");
  if (!s || !user) return null;
  const active = month || s.settings.active_month;
  const list = s.records
    .filter(
      (e) =>
        e.month_key === active &&
        (owner === "all" || e.userId === user.id) &&
        `${e.work_name} ${e.work_type} ${e.chapter} ${s.members.find((m) => m.id === e.userId)?.name || e.username}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const remove = (id: string) =>
    Alert.alert(
      "حذف السجل؟",
      "سيُحذف من بيانات الفريق ويُعاد حساب المستحقات.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            void execute({ action: "deleteRecord", payload: { id } }).catch(
              (e) => Alert.alert("تعذر الحذف", e.message),
            );
          },
        },
      ],
    );
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>سجلات فصولك، مرتبة.</Heading>
        <Chips
          items={[
            { label: "أعمالي", value: "mine" },
            { label: "الفريق", value: "all" },
          ]}
          value={owner}
          onSelect={setOwner}
        />
        <Chips
          items={s.months.map((m) => ({ label: m.name, value: m.key }))}
          value={active}
          onSelect={setMonth}
        />
        <Field
          label="البحث في السجلات"
          value={query}
          onChange={setQuery}
          placeholder="عمل، تخصص، عضو أو فصل"
        />
        {owner === "mine" && (
          <Button
            title="تعديل آخر سجل"
            secondary
            icon="create-outline"
            onPress={() => nav.navigate("AdminForm", { kind: "editLast" })}
          />
        )}
        <Label dim size={12}>
          {list.length} سجل · {active}
        </Label>
        {list.slice(0, 200).map((e) => (
          <Glass key={e.id} style={{ paddingVertical: 10 }}>
            <Row
              title={e.work_name}
              icon={
                e.work_type === "مكافأة"
                  ? "gift-outline"
                  : e.work_type === "خصم"
                    ? "remove-circle-outline"
                    : "document-text-outline"
              }
              image={s.works.find((w) => w.name === e.work_name)?.azora?.cover}
              cover
              detail={`${s.members.find((m) => m.id === e.userId)?.name || e.username} · ${e.work_type.replace(/_/g, " ")} · ${e.chapter === "-" ? "تسوية" : `فصل ${e.chapter}`}`}
              right={`${s.settings.currency}${e.total.toFixed(3)}`}
              onPress={() =>
                nav.navigate("Detail", { work: e.work_name, member: e.userId })
              }
            />
            <Label dim size={10}>
              {new Date(e.timestamp).toLocaleString("ar")}
              {e.notes ? ` · ${e.notes}` : ""}
            </Label>
            {user.isAdmin && (
              <Row
                title="حذف السجل"
                icon="trash-outline"
                danger
                onPress={() => remove(e.id)}
              />
            )}
          </Glass>
        ))}
        {list.length > 200 && (
          <Label dim>أول 200 نتيجة؛ ضيّق البحث لعرض بقية السجلات.</Label>
        )}
        {!list.length && <Empty />}
      </View>
    </Page>
  );
}
export { Arena as Team } from "./Arena";
export { Detail } from "./Detail";
