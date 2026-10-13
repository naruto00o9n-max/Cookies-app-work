import { Alert } from "../lib/alerts";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
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
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active");
  if (!s) return null;
  const works = s.works.filter(
    (w) =>
      (filter === "all" ||
        (filter === "isolated" ? w.isolated : !w.isolated)) &&
      w.name.toLowerCase().includes(query.toLowerCase()),
  );
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
            t = totalOf(entries);
          return (
            <Glass key={w.name}>
              <Row
                title={w.name}
                detail={`${t.chapters} فصل · ${new Set(entries.map((e) => e.userId)).size} مساهم · ${w.isolated ? "معزول" : w.azora ? "مرتبط بأزورا" : "نشط"}`}
                icon="albums-outline"
                onPress={() => nav.navigate("Detail", { work: w.name })}
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
        `${e.work_name} ${e.work_type} ${e.chapter} ${e.username}`
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
        <Heading>كل إنجاز، محفوظ.</Heading>
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
              detail={`${e.username} · ${e.work_type.replace(/_/g, " ")} · ${e.chapter === "-" ? "تسوية" : `فصل ${e.chapter}`}`}
              right={`${s.settings.currency}${e.total.toFixed(3)}`}
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
export function Team() {
  const { snapshot: s } = useTeam();
  const nav = useNavigation<any>();
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("chapters"),
    [specialty, setSpecialty] = useState("all");
  if (!s) return null;
  const members = s.members
    .map((m) => ({
      ...m,
      ...totalOf(
        visibleEntries(s, m.id).filter(
          (e) => specialty === "all" || e.work_type === specialty,
        ),
      ),
    }))
    .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sort === "amount"
        ? b.amount - a.amount
        : sort === "works"
          ? b.works - a.works
          : b.chapters - a.chapters,
    );
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>الفريق وراء كل فصل</Heading>
        <Label dim>ترتيب الفريق في الشهر النشط.</Label>
        <Field label="ابحث عن عضو" value={query} onChange={setQuery} />
        <Chips
          items={[
            { label: "بالفصول", value: "chapters" },
            { label: "بالمستحقات", value: "amount" },
            { label: "بالأعمال", value: "works" },
          ]}
          value={sort}
          onSelect={setSort}
        />
        <Chips
          items={[
            { label: "كل التخصصات", value: "all" },
            ...Object.keys(s.specialties).map((t) => ({
              label: t.replace(/_/g, " "),
              value: t,
            })),
          ]}
          value={specialty}
          onSelect={setSpecialty}
        />
        {members.map((m, i) => (
          <Glass key={m.id} gold={i === 0}>
            <Row
              title={`${i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`} ${m.name}`}
              detail={`${m.chapters} فصل · ${m.works} أعمال`}
              icon="person-outline"
              right={`${s.settings.currency}${m.amount.toFixed(3)}`}
              onPress={() => nav.navigate("Detail", { member: m.id })}
            />
          </Glass>
        ))}
        {!members.length && <Empty />}
      </View>
    </Page>
  );
}
export function Detail({ route }: { route: any }) {
  const { snapshot: s, user } = useTeam();
  const nav = useNavigation<any>();
  if (!s) return null;
  const work = route.params?.work,
    member = route.params?.member;
  const list = s.records.filter(
    (e) =>
      (!work || e.work_name === work) &&
      (!member || e.userId === member) &&
      e.month_key === s.settings.active_month,
  );
  const total = totalOf(list);
  const w = s.works.find((w) => w.name === work);
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>
          {work || s.members.find((m) => m.id === member)?.name || "التفاصيل"}
        </Heading>
        <Glass gold>
          <Heading size={30}>
            {s.settings.currency}
            {total.amount.toFixed(3)}
          </Heading>
          <Label dim>
            {total.chapters} فصل · {total.works} أعمال · الشهر{" "}
            {s.settings.active_month}
          </Label>
        </Glass>
        {work && user?.isAdmin && (
          <>
            <Button
              title="إدارة العمل"
              secondary
              onPress={() =>
                nav.navigate("AdminForm", { kind: "editWork", work })
              }
            />
            <Button
              title={w?.isolated ? "استرجاع العمل" : "عزل العمل"}
              secondary
              onPress={() =>
                nav.navigate("AdminForm", {
                  kind: "isolate",
                  work,
                  isolated: !w?.isolated,
                })
              }
            />
            <Button
              title="إدارة التخصيصات"
              secondary
              onPress={() =>
                nav.navigate("AdminForm", { kind: "customPrice", work })
              }
            />
          </>
        )}
        <Glass>
          {Object.entries(
            list.reduce(
              (a, e) => {
                a[e.work_type] = (a[e.work_type] || 0) + 1;
                return a;
              },
              {} as Record<string, number>,
            ),
          ).map(([type, count]) => (
            <Row
              key={type}
              title={type.replace(/_/g, " ")}
              right={`${count} سجل`}
            />
          ))}
        </Glass>
        {list
          .sort((a, b) => Number(a.chapter) - Number(b.chapter))
          .map((e) => (
            <Glass key={e.id}>
              <Row
                title={`الفصل ${e.chapter} · ${e.work_type}`}
                detail={`${e.username}${e.notes ? " · " + e.notes : ""}`}
                right={`${s.settings.currency}${e.total.toFixed(3)}`}
              />
            </Glass>
          ))}
        {!list.length && <Empty />}
      </View>
    </Page>
  );
}
