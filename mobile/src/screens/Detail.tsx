import React, { useMemo, useState } from "react";
import { Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import { totalOf } from "../lib/domain";
import { Media } from "../components/Media";
import {
  Page,
  Glass,
  Label,
  Heading,
  Section,
  Row,
  Chips,
  Empty,
  Button,
  styles,
  colors,
} from "../components/ui";
export function Detail({ route }: { route: any }) {
  const { snapshot: s, user } = useTeam();
  const nav = useNavigation<any>();
  const [month, setMonth] = useState("all"),
    [specialty, setSpecialty] = useState("all"),
    [limit, setLimit] = useState(40);
  const work: string | undefined = route.params?.work,
    member: string | undefined = route.params?.member;
  const all = useMemo(
    () =>
      s?.records.filter(
        (e) =>
          (!work || e.work_name === work) && (!member || e.userId === member),
      ) || [],
    [s, work, member],
  );
  const scoped = useMemo(
    () =>
      all.filter(
        (e) =>
          (month === "all" || e.month_key === month) &&
          (specialty === "all" || e.work_type === specialty),
      ),
    [all, month, specialty],
  );
  if (!s) return null;
  const w = s.works.find((w) => w.name === work),
    profile = s.members.find((m) => m.id === member);
  const total = totalOf(scoped),
    allTotals = totalOf(all);
  const meaningful = scoped.filter(
    (e) => !["مكافأة", "خصم"].includes(e.work_type),
  );
  const dates = all
    .map((e) => e.timestamp)
    .filter(Boolean)
    .sort();
  const title = member ? profile?.name || member : work || "التفاصيل";
  const roles = [
    ...new Set(
      all
        .filter((e) => !["مكافأة", "خصم"].includes(e.work_type))
        .map((e) => e.work_type),
    ),
  ];
  const participants = [...new Set(meaningful.map((e) => e.userId))]
    .map((id) => {
      const entries = meaningful.filter((e) => e.userId === id),
        person = s.members.find((m) => m.id === id);
      return {
        id,
        name: person?.name || entries[0]?.username || id,
        avatar: person?.avatar,
        entries,
        total: totalOf(entries),
      };
    })
    .sort((a, b) => b.total.chapters - a.total.chapters);
  const works = [...new Set(meaningful.map((e) => e.work_name))].map(
    (name) => ({
      name,
      work: s.works.find((w) => w.name === name),
      total: totalOf(meaningful.filter((e) => e.work_name === name)),
    }),
  );
  const records = [...scoped].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  return (
    <Page>
      <View style={styles.stack}>
        <View style={[styles.hero, { padding: 0 }]}>
          {!!w?.azora?.cover && !member && (
            <Image
              source={{ uri: w.azora.cover }}
              blurRadius={18}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                opacity: 0.35,
              }}
            />
          )}
          <LinearGradient
            colors={["rgba(8,9,13,.1)", "rgba(8,9,13,.95)"]}
            style={{ padding: 25, gap: 18 }}
          >
            <View style={[styles.row, { gap: 20, alignItems: "center" }]}>
              <Media
                uri={member ? profile?.avatar : w?.azora?.cover}
                name={title}
                size={member ? 90 : 100}
                cover={!member}
              />
              <View style={{ flex: 1, gap: 9 }}>
                <Label size={10} style={{ color: colors.gold }}>
                  {member ? "الملف الإبداعي" : "عالم كوكيز"}
                </Label>
                <Heading size={24}>{title}</Heading>
                <Label dim size={11}>
                  {member
                    ? `${allTotals.works} أعمال · ${roles.length} تخصصات`
                    : `${new Set(all.filter((e) => !["مكافأة", "خصم"].includes(e.work_type)).map((e) => e.userId)).size} أعضاء في فريق العمل`}
                </Label>
                {member && work && (
                  <Label size={12} style={{ color: colors.gold }}>
                    {work}
                  </Label>
                )}
                {!member && (
                  <Label dim size={11}>
                    {w?.isolated
                      ? "عمل معزول"
                      : w?.active === false
                        ? "غير نشط"
                        : "عمل نشط"}{" "}
                    · {w?.azora ? "مرتبط بأزورا" : "لم يُربط بأزورا"}
                  </Label>
                )}
              </View>
            </View>
            {!member && !!w?.azora?.description && (
              <Label dim size={12}>
                {w.azora.description}
              </Label>
            )}
            {!member && w?.azora?.latestChapter && (
              <Label style={{ color: colors.gold }}>
                آخر فصل منشور: {w.azora.latestChapter} ·{" "}
                {w.azora.chapterCount ?? "—"} فصل على أزورا
              </Label>
            )}
            {!!dates.length && (
              <Label dim size={10}>
                أول مشاركة {new Date(dates[0]).toLocaleDateString("ar")} · آخر
                إنجاز{" "}
                {new Date(dates[dates.length - 1]).toLocaleDateString("ar")}
              </Label>
            )}
          </LinearGradient>
        </View>
        <Chips
          items={[
            { label: "كل الشهور", value: "all" },
            ...s.months.map((m) => ({ label: m.name, value: m.key })),
          ]}
          value={month}
          onSelect={(v) => {
            setMonth(v);
            setLimit(40);
          }}
        />
        <View style={[styles.row, { gap: 10 }]}>
          {[
            { label: "إنجازات مسجلة", value: total.chapters },
            {
              label: member ? "أعمال" : "مساهمون",
              value: member ? total.works : participants.length,
            },
            {
              label: "فصول مختلفة",
              value: new Set(
                meaningful.map((e) => `${e.work_name}:${e.chapter}`),
              ).size,
            },
          ].map((stat) => (
            <View key={stat.label} style={styles.mini}>
              <Heading size={23}>{stat.value}</Heading>
              <Label dim size={10}>
                {stat.label}
              </Label>
            </View>
          ))}
        </View>
        <Glass gold>
          <Label dim>
            {member ? "صافي المستحقات" : "مستحقات فريق العمل"} ·{" "}
            {month === "all" ? "كل الشهور" : month}
          </Label>
          <Heading size={30}>
            {s.settings.currency} {total.amount.toFixed(3)}
          </Heading>
          <View
            style={[
              styles.row,
              { justifyContent: "space-between", marginTop: 12 },
            ]}
          >
            <Label size={11}>المكافآت: {total.bonuses.toFixed(3)}</Label>
            <Label size={11}>
              الخصومات: {Math.abs(total.deductions).toFixed(3)}
            </Label>
          </View>
        </Glass>
        <Section title="التخصصات والمساهمات" />
        <Chips
          items={[
            { label: "كل التخصصات", value: "all" },
            ...[...new Set(all.map((e) => e.work_type))].map((t) => ({
              label: t.replace(/_/g, " "),
              value: t,
            })),
          ]}
          value={specialty}
          onSelect={(v) => {
            setSpecialty(v);
            setLimit(40);
          }}
        />
        <Glass>
          {[...new Set(scoped.map((e) => e.work_type))].map((t) => {
            const list = scoped.filter((e) => e.work_type === t);
            return (
              <Row
                key={t}
                title={t.replace(/_/g, " ")}
                detail={`${new Set(list.map((e) => e.userId)).size} مساهم · ${list.length} سجل`}
                right={`${s.settings.currency}${list.reduce((n, e) => n + e.total, 0).toFixed(3)}`}
              />
            );
          })}
          {!scoped.length && <Label dim>لا توجد مساهمات في هذا النطاق.</Label>}
        </Glass>
        {work && !member && (
          <>
            <Section title="فريق هذا العمل" />
            <Label dim size={11}>
              اختر عضوًا لرؤية مساهماته في هذا العمل
            </Label>
            {participants.map((m) => (
              <Glass key={m.id}>
                <Row
                  image={m.avatar}
                  title={m.name}
                  icon="person-outline"
                  detail={`${m.total.chapters} إنجاز · ${[...new Set(m.entries.map((e) => e.work_type.replace(/_/g, " ")))].join("، ")}`}
                  right={`${s.settings.currency}${m.total.amount.toFixed(3)}`}
                  onPress={() => nav.push("Detail", { work, member: m.id })}
                />
              </Glass>
            ))}
          </>
        )}
        {!!member && (
          <>
            <Section
              title={work ? "المزيد عن العضو" : "الأعمال التي شارك فيها"}
            />
            {work ? (
              <Button
                secondary
                title="عرض الملف الكامل للعضو"
                onPress={() => nav.push("Detail", { member })}
              />
            ) : (
              works.map((item) => (
                <Glass key={item.name}>
                  <Row
                    title={item.name}
                    image={item.work?.azora?.cover}
                    cover
                    icon="albums-outline"
                    detail={`${item.total.chapters} إنجاز`}
                    onPress={() =>
                      nav.push("Detail", { work: item.name, member })
                    }
                  />
                </Glass>
              ))
            )}
          </>
        )}
        {!member && work && !w?.isolated && w?.active !== false && (
          <Button
            title="تسجيل إنجاز في هذا العمل"
            icon="add-outline"
            onPress={() =>
              nav.navigate("Register", { work, chapter: route.params?.chapter })
            }
          />
        )}
        {!!work && user?.isAdmin && (
          <Glass>
            <Row
              title="إدارة العمل"
              icon="settings-outline"
              onPress={() =>
                nav.navigate("AdminForm", { kind: "editWork", work })
              }
            />
            <Row
              title={w?.isolated ? "استرجاع العمل" : "عزل العمل"}
              icon="archive-outline"
              onPress={() =>
                nav.navigate("AdminForm", {
                  kind: "isolate",
                  work,
                  isolated: !w?.isolated,
                })
              }
            />
            <Row
              title="إدارة الأسعار الخاصة"
              icon="pricetags-outline"
              onPress={() =>
                nav.navigate("AdminForm", { kind: "customPrice", work })
              }
            />
          </Glass>
        )}
        <Section title="سجل الإنجازات" />
        <Label dim size={11}>
          {records.length} سجل · الأحدث أولًا
        </Label>
        {records.slice(0, limit).map((e) => (
          <Glass key={e.id} style={{ paddingVertical: 8 }}>
            <Row
              title={`${e.chapter === "-" ? "تسوية" : `الفصل ${e.chapter}`} · ${e.work_type.replace(/_/g, " ")}`}
              detail={`${s.members.find((m) => m.id === e.userId)?.name || e.username} · ${e.work_name}`}
              right={`${s.settings.currency}${e.total.toFixed(3)}`}
              onPress={
                !member
                  ? () =>
                      nav.push("Detail", {
                        member: e.userId,
                        work: e.work_name,
                      })
                  : undefined
              }
            />
            <Label dim size={10}>
              {new Date(e.timestamp).toLocaleString("ar")}
              {e.notes ? ` · ${e.notes}` : ""}
            </Label>
          </Glass>
        ))}
        {records.length > limit && (
          <Button
            secondary
            title="عرض المزيد من السجلات"
            onPress={() => setLimit(limit + 40)}
          />
        )}
        {!records.length && (
          <Empty
            title="لا توجد سجلات في هذا النطاق"
            detail="اختر شهرًا أو تخصصًا آخر لاستعراض المساهمات."
          />
        )}
      </View>
    </Page>
  );
}
