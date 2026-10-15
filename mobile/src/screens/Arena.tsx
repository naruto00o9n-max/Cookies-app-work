import { WalkthroughFinish } from "../components/Coachmark";
import { FilterSelect } from "../components/FilterSelect";
import React, { useMemo, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import { visibleEntries, totalOf } from "../lib/domain";
import { memberProgress } from "../lib/progression";
import { Media } from "../components/Media";
import {
  Page,
  Glass,
  Label,
  Heading,
  Section,
  Icon,
  Field,
  Chips,
  Empty,
  colors,
  styles,
  Button,
} from "../components/ui";
export function Arena() {
  const { snapshot: s, user } = useTeam();
  const nav = useNavigation<any>();
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("chapters"),
    [period, setPeriod] = useState(""),
    [specialty, setSpecialty] = useState("all"),
    [limit, setLimit] = useState(40);
  const ranked = useMemo(() => {
    if (!s) return [];
    const entries = visibleEntries(
      s,
      undefined,
      period === "all" ? "" : period || s.settings.active_month,
    ).filter((e) => specialty === "all" || e.work_type === specialty);
    const grouped = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = grouped.get(e.userId) || [];
      list.push(e);
      grouped.set(e.userId, list);
    }
    const history = new Map<string, typeof entries>();
    for (const entry of s.records) {
      const list = history.get(entry.userId) || [];
      list.push(entry);
      history.set(entry.userId, list);
    }
    return s.members
      .filter(
        (m) =>
          !m.blocked &&
          (m.appRegistered || history.has(m.id) || m.id === user?.id),
      )
      .map((m) => {
        const saved = grouped.get(m.id) || [],
          real = saved.filter((e) => !["مكافأة", "خصم"].includes(e.work_type));
        const chapters = new Set(
          real.map((e) =>
            JSON.stringify([e.work_name, String(Number(e.chapter))]),
          ),
        ).size;
        const tasks = new Set(
          real.map((e) =>
            JSON.stringify([
              e.work_name,
              String(Number(e.chapter)),
              e.work_type,
            ]),
          ),
        ).size;
        return {
          ...m,
          total: totalOf(saved),
          chapters,
          tasks,
          periodXp: tasks * 10,
          progression: memberProgress(
            { ...s, records: history.get(m.id) || [], members: [m] },
            m.id,
          ),
        };
      })
      .sort(
        (a, b) =>
          (sort === "amount"
            ? b.total.amount - a.total.amount
            : sort === "works"
              ? b.total.works - a.total.works
              : sort === "xp"
                ? b.periodXp - a.periodXp
                : b.chapters - a.chapters) ||
          b.tasks - a.tasks ||
          a.id.localeCompare(b.id),
      );
  }, [s, period, specialty, sort, user?.id]);
  if (!s || !user) return null;
  const members = ranked.filter((m) =>
    `${m.name} ${m.username || ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const leaders = ranked.slice(0, 3).filter((m) => m.tasks > 0),
    mine = ranked.find((m) => m.id === user.id),
    myRank = ranked.findIndex((m) => m.id === user.id) + 1;
  const earned = mine?.progression.badges.filter((b) => b.earned).length || 0;
  return (
    <Page>
      <View style={styles.stack}>
        <WalkthroughFinish />
        <View style={arena.banner}>
          <LinearGradient
            colors={["#252130", "#12131B", "#17140E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                arena.star,
                {
                  left: 18 + i * 67,
                  top: 12 + (i % 3) * 23,
                  opacity: 0.1 + i * 0.025,
                  transform: [{ rotate: "45deg" }],
                },
              ]}
            />
          ))}
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View>
              <Label size={10} style={{ color: colors.gold, letterSpacing: 3 }}>
                COOKIES · ARENA
              </Label>
              <Heading size={30}>ساحة الأبطال</Heading>
              <Label dim size={11}>
                {period === "all"
                  ? "سجل الفريق عبر كل الشهور"
                  : s.months.find(
                      (m) => m.key === (period || s.settings.active_month),
                    )?.name ||
                    period ||
                    s.settings.active_month}
              </Label>
            </View>
            <View style={arena.emblem}>
              <Icon name="trophy-outline" size={36} />
            </View>
          </View>
          <View
            style={[
              styles.divider,
              { marginVertical: 18, backgroundColor: "rgba(232,199,124,.15)" },
            ]}
          />
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Label size={11}>تنافس بالفصول، وتقدّم بمساهماتك.</Label>
            <Label size={10} style={{ color: colors.gold }}>
              {ranked.filter((m) => m.tasks > 0).length} مشارك
            </Label>
          </View>
        </View>
        <Glass style={{ gap: 22 }}>
          <FilterSelect
            label="الفترة"
            hint="اختر شهرًا للمنافسة، أو اجمع إنجازات كل الشهور."
            value={period}
            onChange={setPeriod}
            items={[
              {
                label: `الشهر الحالي · ${s.months.find((m) => m.key === s.settings.active_month)?.name || s.settings.active_month}`,
                value: "",
              },
              ...s.months
                .filter((m) => m.key !== s.settings.active_month)
                .sort((a, b) => b.key.localeCompare(a.key))
                .map((m) => ({ label: m.name, value: m.key })),
              { label: "كل الشهور", value: "all" },
            ]}
          />
          <FilterSelect
            label="طريقة الترتيب"
            hint="حدد ما الذي تريد مقارنة أعضاء الفريق به في الفترة المختارة."
            value={sort}
            onChange={setSort}
            items={[
              {
                label: "الفصول",
                value: "chapters",
                detail:
                  "الفصل يُحسب مرة لكل عمل، حتى لو نفّذ العضو عدة تخصصات.",
              },
              {
                label: "الخبرة",
                value: "xp",
                detail: "10 نقاط لكل مساهمة مختلفة: عمل + فصل + تخصص.",
              },
              {
                label: "الأعمال",
                value: "works",
                detail: "عدد الأعمال التي ساهم بها العضو.",
              },
              {
                label: "المستحقات",
                value: "amount",
                detail: "صافي المبالغ بعد المكافآت والخصومات واستثناء المعزول.",
              },
            ]}
          />
          <FilterSelect
            label="التخصص"
            hint="اعرض كل المساهمات، أو قارن أعضاء تخصص محدد فقط."
            value={specialty}
            onChange={setSpecialty}
            items={[
              { label: "كل التخصصات", value: "all" },
              ...[
                ...new Set([
                  ...Object.keys(s.specialties),
                  ...s.records
                    .filter((e) => !["مكافأة", "خصم"].includes(e.work_type))
                    .map((e) => e.work_type),
                ]),
              ].map((t) => ({ label: t.replace(/_/g, " "), value: t })),
            ]}
          />
        </Glass>
        {!!leaders.length && (
          <Glass style={{ padding: 14, paddingTop: 24 }}>
            <View
              style={[
                styles.row,
                { alignItems: "flex-end", gap: 8, justifyContent: "center" },
              ]}
            >
              {[1, 0, 2]
                .filter((index) => leaders[index])
                .map((index) => {
                  const m = leaders[index],
                    champion = index === 0,
                    color = ["#E8C77C", "#C2CBD8", "#BC9774"][index];
                  return (
                    <Pressable
                      key={m.id}
                      accessibilityRole="button"
                      accessibilityLabel={`المركز ${index + 1}، ${m.name}`}
                      onPress={() => nav.navigate("Detail", { member: m.id })}
                      style={{
                        flex: champion ? 1.14 : 1,
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {champion && (
                        <Icon name="sparkles" size={22} color={color} />
                      )}
                      <View
                        style={{
                          borderWidth: 2,
                          borderColor: color,
                          borderRadius: 60,
                          padding: 3,
                          shadowColor: color,
                          shadowOpacity: 0.25,
                          shadowRadius: 18,
                        }}
                      >
                        <Media
                          uri={m.avatar}
                          name={m.name}
                          size={champion ? 70 : 54}
                        />
                      </View>
                      <Label
                        size={champion ? 13 : 11}
                        style={{ textAlign: "center" }}
                      >
                        {m.name}
                      </Label>
                      <Label size={9} style={{ color }}>
                        {m.progression.title}
                      </Label>
                      <LinearGradient
                        colors={
                          champion
                            ? ["#514226", "#252018"]
                            : index === 1
                              ? ["#303745", "#1B1F29"]
                              : ["#3D2C22", "#211B18"]
                        }
                        style={{
                          width: "100%",
                          height: champion ? 108 : 82,
                          borderTopLeftRadius: 18,
                          borderTopRightRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 2,
                          borderWidth: 1,
                          borderColor: `${color}55`,
                        }}
                      >
                        <Heading size={champion ? 30 : 24}>
                          0{index + 1}
                        </Heading>
                        <Label size={10} style={{ color }}>
                          {sort === "amount"
                            ? `${s.settings.currency}${m.total.amount.toFixed(3)}`
                            : sort === "works"
                              ? `${m.total.works} أعمال`
                              : sort === "xp"
                                ? `${m.periodXp} XP`
                                : `${m.chapters} فصل`}
                        </Label>
                      </LinearGradient>
                    </Pressable>
                  );
                })}
            </View>
          </Glass>
        )}
        {!!mine && (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.navigate("Detail", { member: user.id })}
          >
            <Glass gold style={{ gap: 13 }}>
              <View style={[styles.row, { gap: 14 }]}>
                <Media uri={mine.avatar} name={mine.name} size={55} />
                <View style={{ flex: 1 }}>
                  <Label size={12} style={{ color: colors.gold }}>
                    مكانك في الساحة · #{myRank}
                  </Label>
                  <Heading size={20}>{mine.progression.title}</Heading>
                  <Label dim size={10}>
                    المستوى {mine.progression.level} · {earned} أوسمة ·{" "}
                    {mine.progression.streak} أيام متواصلة
                  </Label>
                </View>
                <Icon name="chevron-back" size={16} />
              </View>
              <View style={arena.track}>
                <LinearGradient
                  colors={["#A77932", colors.gold]}
                  style={{
                    height: 5,
                    width: `${Math.max(1, mine.progression.progress * 100)}%`,
                    borderRadius: 5,
                  }}
                />
              </View>
              <Label dim size={10}>
                {mine.progression.xp} XP إجمالًا ·{" "}
                {mine.progression.nextLevelXp - mine.progression.xp} XP للمستوى
                التالي
              </Label>
            </Glass>
          </Pressable>
        )}
        <Section title="ترتيب الفريق" />
        <Field
          label="ابحث عن عضو"
          placeholder="اسم ديسكورد أو نك نيم السيرفر"
          value={query}
          onChange={setQuery}
        />
        <Label dim size={10}>
          الفصل يُحسب مرة لكل عمل في هذه الفترة. تنفيذ تخصصين للفصل نفسه =
          مهمتان. المستوى والخبرة الإجمالية يحتسبان المساهمات المختلفة عبر
          السجلات المحفوظة.
        </Label>
        {members.slice(0, limit).map((m) => {
          const rank = ranked.findIndex((x) => x.id === m.id) + 1,
            own = m.id === user.id;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() => nav.navigate("Detail", { member: m.id })}
            >
              <Glass gold={own} style={{ padding: 16 }}>
                <View style={[styles.row, { gap: 12 }]}>
                  <View style={{ width: 30, alignItems: "center" }}>
                    {rank <= 3 && m.tasks > 0 ? (
                      <Icon
                        name="trophy"
                        size={19}
                        color={["#E8C77C", "#C2CBD8", "#BC9774"][rank - 1]}
                      />
                    ) : (
                      <Label dim size={14}>
                        {String(rank).padStart(2, "0")}
                      </Label>
                    )}
                  </View>
                  <Media uri={m.avatar} name={m.name} size={48} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Label size={14}>
                      {m.name}
                      {own ? " · أنت" : ""}
                    </Label>
                    <Label dim size={10}>
                      Lv.{m.progression.level} · {m.progression.title}
                    </Label>
                    <Label dim size={10}>
                      {m.chapters} فصل · {m.tasks} مهام · {m.total.works} أعمال
                    </Label>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Label size={12} style={{ color: colors.gold }}>
                      {sort === "amount"
                        ? `${s.settings.currency}${m.total.amount.toFixed(3)}`
                        : sort === "works"
                          ? `${m.total.works} أعمال`
                          : sort === "xp"
                            ? `${m.periodXp} XP`
                            : `${m.chapters} فصل`}
                    </Label>
                    <Icon name="chevron-back" color={colors.muted} size={14} />
                  </View>
                </View>
              </Glass>
            </Pressable>
          );
        })}
        {members.length > limit && (
          <Button
            secondary
            title="عرض المزيد من أعضاء الفريق"
            onPress={() => setLimit(limit + 40)}
          />
        )}
        {!members.length && (
          <Empty title="لا توجد نتائج" detail="جرّب اسمًا أو تخصصًا آخر." />
        )}
      </View>
    </Page>
  );
}
const arena = StyleSheet.create({
  banner: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.25)",
    overflow: "hidden",
  },
  emblem: {
    width: 72,
    height: 72,
    borderRadius: 23,
    backgroundColor: "rgba(232,199,124,.07)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.2)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  star: {
    position: "absolute",
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  track: {
    height: 5,
    backgroundColor: "#2C2B2D",
    borderRadius: 5,
    overflow: "hidden",
  },
});
