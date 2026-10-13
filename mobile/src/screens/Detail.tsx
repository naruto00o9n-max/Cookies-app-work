import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import { totalOf, visibleEntries } from "../lib/domain";
import {
  chapterGroups,
  contributionSummary,
  isChapterTask,
  specialtyGroups,
} from "../lib/detail-data";
import { memberProgress } from "../lib/progression";
import type { Entry, Member } from "../lib/types";
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
  Field,
  Icon,
  styles,
  colors,
} from "../components/ui";

const dateLabel = (value: string, time = false) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? time
      ? date.toLocaleString("ar")
      : date.toLocaleDateString("ar")
    : "تاريخ غير متاح";
};
const roleLabel = (value: string) => value.replace(/_/g, " ");
const memberName = (person: Member | undefined, fallback: string) =>
  person?.nickname?.trim() ||
  person?.globalName?.trim() ||
  person?.name ||
  fallback;

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View style={local.tag}>
      <Label size={10} style={{ color: colors.gold }}>
        {children}
      </Label>
    </View>
  );
}

function Numbers({ entries }: { entries: Entry[] }) {
  const summary = contributionSummary(entries);
  return (
    <View style={[styles.row, local.numbers]}>
      {[
        { label: "فصل مختلف", value: summary.chapters },
        { label: "مهمة مسجلة", value: summary.tasks },
        { label: "تخصص", value: summary.specialties.length },
      ].map((stat) => (
        <View key={stat.label} style={local.number}>
          <Heading size={22}>{stat.value}</Heading>
          <Label dim size={10}>
            {stat.label}
          </Label>
        </View>
      ))}
    </View>
  );
}

export function Detail({ route }: { route: any }) {
  const { snapshot: s, user } = useTeam();
  const nav = useNavigation<any>();
  const work: string | undefined = route.params?.work;
  const member: string | undefined = route.params?.member;
  const [month, setMonth] = useState(
    route.params?.month ||
      (member && !work ? s?.settings.active_month : "all") ||
      "all",
  );
  const [specialty, setSpecialty] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(24);
  const [tab, setTab] = useState(
    work && !member ? "people" : member && !work ? "works" : "chapters",
  );
  const [chapterSort, setChapterSort] = useState("number");
  const all = useMemo(
    () =>
      s?.records.filter(
        (entry) =>
          (!work || entry.work_name === work) &&
          (!member || entry.userId === member),
      ) || [],
    [s, work, member],
  );
  const membersById = useMemo(
    () =>
      new Map((s?.members || []).map((person) => [person.id, person] as const)),
    [s?.members],
  );
  const worksByName = useMemo(
    () => new Map((s?.works || []).map((item) => [item.name, item] as const)),
    [s?.works],
  );
  const monthsByKey = useMemo(
    () =>
      new Map((s?.months || []).map((item) => [item.key, item.name] as const)),
    [s?.months],
  );
  const scoped = useMemo(
    () =>
      all.filter(
        (entry) =>
          (month === "all" || entry.month_key === month) &&
          (specialty === "all" || entry.work_type === specialty),
      ),
    [all, month, specialty],
  );
  const searched = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return scoped;
    return scoped.filter((entry) =>
      [
        entry.work_name,
        entry.chapter,
        roleLabel(entry.work_type),
        entry.notes,
        memberName(membersById.get(entry.userId), entry.username),
      ].some((value) => value.toLocaleLowerCase().includes(search)),
    );
  }, [scoped, query, membersById]);
  const grouped = useMemo(() => {
    const people = new Map<string, Entry[]>();
    const works = new Map<string, Entry[]>();
    for (const entry of searched.filter(isChapterTask)) {
      const personEntries = people.get(entry.userId) || [];
      personEntries.push(entry);
      people.set(entry.userId, personEntries);
      const workEntries = works.get(entry.work_name) || [];
      workEntries.push(entry);
      works.set(entry.work_name, workEntries);
    }
    return { people, works };
  }, [searched]);
  if (!s) return null;

  const w = work ? worksByName.get(work) : undefined;
  const profile = member ? membersById.get(member) : undefined;
  const progression = member ? memberProgress(s, member) : null;
  const title = member ? memberName(profile, member) : work || "التفاصيل";
  const summary = contributionSummary(scoped);
  const lifetime = contributionSummary(all);
  const roles = specialtyGroups(scoped);
  const periodName =
    month === "all" ? "كل الشهور" : monthsByKey.get(month) || month;
  const isolated = new Set(
    s.works.filter((item) => item.isolated).map((item) => item.name),
  );
  const payableEntries = scoped.filter(
    (entry) => !isolated.has(entry.work_name),
  );
  const total = totalOf(w?.isolated ? scoped : payableEntries);
  const currentEntries = visibleEntries(s, member).filter(
    (entry) => !work || entry.work_name === work,
  );
  const currentTotal = totalOf(currentEntries);
  const activeMonthName =
    monthsByKey.get(s.settings.active_month) || s.settings.active_month;
  const adjustments = searched
    .filter((entry) => !isChapterTask(entry))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const chapters = chapterGroups(searched, chapterSort === "number");
  const participants = [...grouped.people.entries()]
    .map(([id, entries]) => {
      const person = membersById.get(id);
      return {
        id,
        name: memberName(person, entries[0]?.username || id),
        avatar: person?.avatar,
        entries,
        summary: contributionSummary(entries),
      };
    })
    .sort(
      (a, b) =>
        b.summary.chapters - a.summary.chapters ||
        b.summary.tasks - a.summary.tasks,
    );
  const works = [...grouped.works.entries()]
    .map(([name, entries]) => {
      return {
        name,
        work: worksByName.get(name),
        entries,
        summary: contributionSummary(entries),
      };
    })
    .sort(
      (a, b) =>
        b.summary.chapters - a.summary.chapters ||
        b.summary.tasks - a.summary.tasks,
    );
  const dates = all
    .map((entry) => entry.timestamp)
    .filter(Boolean)
    .sort();
  const money = (amount: number) =>
    `${amount.toFixed(3)} ${s.settings.currency}`;
  const chooseTab = (value: string) => {
    setTab(value);
    setLimit(24);
  };
  const itemCount =
    tab === "people"
      ? participants.length
      : tab === "works"
        ? works.length
        : tab === "adjustments"
          ? adjustments.length
          : chapters.length;

  return (
    <Page>
      <View style={styles.stack}>
        <View style={[styles.hero, { padding: 0 }]}>
          {!!w?.azora?.cover && (
            <Image
              source={{ uri: w.azora.cover }}
              blurRadius={14}
              style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
            />
          )}
          <LinearGradient
            colors={["rgba(76,57,24,.3)", "rgba(11,12,17,.96)"]}
            style={local.hero}
          >
            <View pointerEvents="none" style={local.orbit} />
            <View style={[styles.row, { gap: 20, alignItems: "center" }]}>
              <View style={local.portraitFrame}>
                <Media
                  uri={member ? profile?.avatar : w?.azora?.cover}
                  name={title}
                  size={88}
                  cover={!member}
                />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Label
                  size={10}
                  style={{ color: colors.gold, letterSpacing: 1 }}
                >
                  {member ? "بطاقة عضو كوكيز" : "ملف العمل"}
                </Label>
                <Heading size={25}>{title}</Heading>
                {progression && (
                  <Tag>
                    {progression.title} · مستوى {progression.level}
                  </Tag>
                )}
                {profile?.isAdmin && (
                  <Label size={11} style={{ color: colors.gold }}>
                    مشرف الفريق
                  </Label>
                )}
                <Label dim size={11}>
                  {member
                    ? `${lifetime.works} أعمال · ${lifetime.chapters} فصل مختلف عبر كل الشهور`
                    : `${lifetime.members} أعضاء · ${lifetime.specialties.length} تخصصات عبر كل الشهور`}
                </Label>
                {member && work && <Tag>{work}</Tag>}
                {!member && (
                  <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
                    <Tag>
                      {w?.isolated
                        ? "عمل معزول"
                        : w?.active === false
                          ? "غير نشط"
                          : "عمل نشط"}
                    </Tag>
                    {w?.azora && <Tag>مرتبط بأزورا</Tag>}
                  </View>
                )}
              </View>
            </View>
            {progression && !work && (
              <View style={{ gap: 8 }}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <Label size={11} style={{ color: colors.gold }}>
                    {progression.tier} · {progression.xp} XP
                  </Label>
                  <Label dim size={10}>
                    المستوى التالي عند {progression.nextLevelXp} XP
                  </Label>
                </View>
                <View style={local.progressTrack}>
                  <LinearGradient
                    colors={["#8F6D32", colors.gold]}
                    style={{
                      height: "100%",
                      width: `${Math.max(0, Math.min(100, progression.progress * 100))}%`,
                      borderRadius: 6,
                    }}
                  />
                </View>
                <Label dim size={10}>
                  {progression.tasks} مهام فريدة · أطول سلسلة مشاركة{" "}
                  {progression.maxStreak} أيام
                </Label>
              </View>
            )}
            {!member && !!w?.azora?.description && (
              <Label dim size={12}>
                {w.azora.description}
              </Label>
            )}
            {!member && w?.azora?.latestChapter && (
              <View style={local.release}>
                <Icon name="planet-outline" size={18} />
                <Label size={12} style={{ flex: 1, color: colors.gold }}>
                  آخر فصل منشور {w.azora.latestChapter} ·{" "}
                  {w.azora.chapterCount ?? "—"} فصل على أزورا
                </Label>
              </View>
            )}
            {!!dates.length && (
              <Label dim size={10}>
                أول مشاركة {dateLabel(dates[0])} · آخر مشاركة{" "}
                {dateLabel(dates[dates.length - 1])}
              </Label>
            )}
          </LinearGradient>
        </View>

        {member && !work && (
          <Glass gold>
            <View style={[styles.row, { gap: 10 }]}>
              <Icon name="wallet-outline" />
              <Label size={12} style={{ color: colors.gold }}>
                صافي الشهر الحالي · {activeMonthName}
              </Label>
            </View>
            <Heading size={33}>{money(currentTotal.amount)}</Heading>
            <Label dim size={11}>
              {contributionSummary(currentEntries).chapters} فصل مختلف ·{" "}
              {currentTotal.chapters} مهمة · المكافآت{" "}
              {money(currentTotal.bonuses)} · الخصومات{" "}
              {money(currentTotal.deductions)}
            </Label>
            <Label dim size={10} style={{ marginTop: 7 }}>
              يشمل المكافآت والخصومات ويستبعد الأعمال المعزولة.
            </Label>
          </Glass>
        )}

        {profile &&
          member &&
          !work &&
          (profile.joinedAt || profile.firstLoginAt) && (
            <Glass>
              {profile.joinedAt && (
                <Label dim size={11}>
                  عضو في السيرفر منذ {dateLabel(profile.joinedAt)}
                </Label>
              )}
              {profile.firstLoginAt && (
                <Label dim size={11}>
                  انضم إلى التطبيق في {dateLabel(profile.firstLoginAt)}
                </Label>
              )}
              {profile.lastLoginAt && user?.isAdmin && (
                <Label dim size={11}>
                  آخر تسجيل دخول {dateLabel(profile.lastLoginAt, true)}
                </Label>
              )}
            </Glass>
          )}

        {progression && !work && (
          <>
            <Section title="أوسمة المساهمات" />
            <View style={local.roleGrid}>
              {progression.badges.map((badge) => (
                <Glass
                  key={badge.id}
                  style={[
                    local.roleCard,
                    { opacity: badge.earned ? 1 : 0.42, gap: 8 },
                  ]}
                  gold={badge.earned}
                >
                  <View style={[styles.row, { gap: 9 }]}>
                    <Icon
                      name={badge.icon}
                      size={23}
                      color={badge.earned ? colors.gold : colors.muted}
                    />
                    <Label size={11} style={{ flex: 1 }}>
                      {badge.title}
                    </Label>
                  </View>
                  <Label dim size={10}>
                    {badge.earned ? "وسام مكتسب" : "لم يُكتسب بعد"}
                  </Label>
                </Glass>
              ))}
            </View>
          </>
        )}

        <Section title="نطاق التفاصيل" />
        <Chips
          items={[
            {
              label: `الشهر الحالي · ${activeMonthName}`,
              value: s.settings.active_month,
            },
            { label: "كل الشهور", value: "all" },
            ...s.months
              .filter((item) => item.key !== s.settings.active_month)
              .map((item) => ({ label: item.name, value: item.key })),
          ]}
          value={month}
          onSelect={(value) => {
            setMonth(value);
            setLimit(24);
          }}
        />
        <Label size={12} style={{ color: colors.gold }}>
          الإحصاءات والمساهمات المعروضة أدناه · {periodName}
        </Label>
        <Numbers entries={scoped} />
        <Label dim size={10}>
          الفصل يُحسب مرة واحدة للعمل، والمهمة هي سجل بتخصص محدد؛ قد يضم الفصل
          الواحد ترجمة وتحريرًا.
        </Label>

        <Glass>
          <View
            style={[styles.row, { justifyContent: "space-between", gap: 12 }]}
          >
            <View style={{ flex: 1, gap: 5 }}>
              <Label dim size={11}>
                {w?.isolated
                  ? "القيمة التاريخية للعمل المعزول"
                  : "صافي السجلات غير المعزولة"}
              </Label>
              <Heading size={26}>{money(total.amount)}</Heading>
            </View>
            <View style={{ gap: 6 }}>
              <Label size={11}>المكافآت {money(total.bonuses)}</Label>
              <Label size={11}>الخصومات {money(total.deductions)}</Label>
            </View>
          </View>
          <Label dim size={10} style={{ marginTop: 10 }}>
            {w?.isolated
              ? "هذه السجلات محفوظة للتاريخ، ولا تدخل في تقرير الدفع الحالي."
              : `${periodName} · قيمة السجلات في هذا النطاق؛ تقرير الدفع يحدد مستحقات الشهر الحالي.`}
          </Label>
          {!w?.isolated &&
            scoped.some((entry) => isolated.has(entry.work_name)) && (
              <Label dim size={10}>
                سجلات الأعمال المعزولة تظهر في التفاصيل وتُستبعد من الصافي
                أعلاه.
              </Label>
            )}
        </Glass>

        <Section title="التخصصات" />
        <Chips
          items={[
            { label: "كل التخصصات", value: "all" },
            ...[...new Set(all.map((entry) => entry.work_type))].map(
              (role) => ({ label: roleLabel(role), value: role }),
            ),
          ]}
          value={specialty}
          onSelect={(value) => {
            setSpecialty(value);
            setLimit(24);
          }}
        />
        {!!roles.length && (
          <View style={local.roleGrid}>
            {roles.map((role) => (
              <Glass key={role.role} style={local.roleCard}>
                <Label style={{ color: colors.gold }} size={12}>
                  {roleLabel(role.role)}
                </Label>
                <Heading size={21}>{role.chapters} فصل</Heading>
                <Label dim size={10}>
                  {role.tasks} مهمة · {role.members} أعضاء
                </Label>
              </Glass>
            ))}
          </View>
        )}

        <Section
          title={
            member && work
              ? "الفصول التي عمل عليها العضو"
              : work
                ? "تفاصيل فريق العمل"
                : "مساهمات العضو"
          }
        />
        <Chips
          items={[
            ...(work && !member
              ? [{ label: `الأعضاء · ${summary.members}`, value: "people" }]
              : []),
            ...(member && !work
              ? [{ label: `الأعمال · ${summary.works}`, value: "works" }]
              : []),
            { label: `الفصول · ${summary.chapters}`, value: "chapters" },
            {
              label: `المكافآت والخصومات · ${scoped.filter((entry) => !isChapterTask(entry)).length}`,
              value: "adjustments",
            },
          ]}
          value={tab}
          onSelect={chooseTab}
        />
        <Field
          label={
            tab === "people"
              ? "ابحث عن عضو أو رقم فصل أو تخصص"
              : tab === "works"
                ? "ابحث عن عمل أو رقم فصل أو تخصص"
                : "ابحث عن رقم فصل أو تخصص أو ملاحظة"
          }
          value={query}
          onChange={(value) => {
            setQuery(value);
            setLimit(24);
          }}
          placeholder="اكتب للبحث في هذه الفترة…"
        />
        {!!query.trim() && (
          <Label dim size={11}>
            البحث يرشّح النتائج أدناه؛ الإحصاءات أعلاه تخص الفترة والتخصص
            المحددين.
          </Label>
        )}

        {tab === "people" &&
          participants.slice(0, limit).map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`مساهمات ${person.name} في ${work}`}
              onPress={() =>
                nav.push("Detail", { work, member: person.id, month })
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Glass style={{ gap: 13 }}>
                <View style={[styles.row, { gap: 13 }]}>
                  <Media uri={person.avatar} name={person.name} size={56} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Heading size={18}>{person.name}</Heading>
                    <Label dim size={11}>
                      {person.summary.specialties.map(roleLabel).join(" · ")}
                    </Label>
                  </View>
                  <Icon name="chevron-back" size={18} color={colors.muted} />
                </View>
                <Numbers entries={person.entries} />
                <Label size={11} style={{ color: colors.gold }}>
                  عرض أرقام فصوله وتخصص كل مهمة
                </Label>
              </Glass>
            </Pressable>
          ))}

        {tab === "works" &&
          works.slice(0, limit).map((item) => {
            const preview = chapterGroups(item.entries, true);
            return (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityLabel={`عرض فصول ${title} في ${item.name}`}
                onPress={() =>
                  nav.push("Detail", { work: item.name, member, month })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Glass style={{ gap: 12 }}>
                  <View style={[styles.row, { gap: 15 }]}>
                    <Media
                      uri={item.work?.azora?.cover}
                      name={item.name}
                      size={57}
                      cover
                    />
                    <View style={{ flex: 1, gap: 5 }}>
                      <Heading size={18}>{item.name}</Heading>
                      <Label dim size={11}>
                        {item.summary.specialties.map(roleLabel).join(" · ")}
                      </Label>
                      <Label size={12} style={{ color: colors.gold }}>
                        {item.summary.chapters} فصل مختلف · {item.summary.tasks}{" "}
                        مهمة
                      </Label>
                      {item.work?.isolated && (
                        <Label dim size={10}>
                          عمل معزول · خارج تقرير الدفع
                        </Label>
                      )}
                    </View>
                    <Icon name="chevron-back" size={18} color={colors.muted} />
                  </View>
                  <View style={styles.divider} />
                  <View style={[styles.row, { flexWrap: "wrap", gap: 7 }]}>
                    {preview.slice(0, 8).map((chapter) => (
                      <Tag key={chapter.id}>#{chapter.chapter}</Tag>
                    ))}
                    {preview.length > 8 && (
                      <Tag>+{preview.length - 8} فصول</Tag>
                    )}
                  </View>
                  <Label dim size={10}>
                    افتح العمل لعرض كل فصل وتخصصه وتاريخه ومستحقاته.
                  </Label>
                </Glass>
              </Pressable>
            );
          })}

        {tab === "chapters" && (
          <>
            <Chips
              items={[
                { label: "ترتيب أرقام الفصول", value: "number" },
                { label: "آخر تسجيل أولًا", value: "recent" },
              ]}
              value={chapterSort}
              onSelect={setChapterSort}
            />
            {chapters.slice(0, limit).map((chapter) => (
              <Glass key={chapter.id} style={{ gap: 12 }}>
                <View style={[styles.row, { gap: 12 }]}>
                  <View style={local.chapterBadge}>
                    <Heading size={20}>{chapter.chapter}</Heading>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Heading size={17}>الفصل {chapter.chapter}</Heading>
                    {!work && (
                      <Label dim size={11}>
                        {chapter.work}
                      </Label>
                    )}
                    <Label dim size={10}>
                      {chapter.entries.length} مهام ·{" "}
                      {
                        new Set(chapter.entries.map((entry) => entry.userId))
                          .size
                      }{" "}
                      أعضاء
                    </Label>
                  </View>
                </View>
                {chapter.entries.map((entry) => {
                  const person = membersById.get(entry.userId);
                  const monthName =
                    monthsByKey.get(entry.month_key) || entry.month_key;
                  return (
                    <View key={entry.id} style={{ gap: 6 }}>
                      <View style={styles.divider} />
                      <View
                        style={[
                          styles.row,
                          { gap: 10, alignItems: "flex-start", paddingTop: 5 },
                        ]}
                      >
                        {!member && (
                          <Media
                            uri={person?.avatar}
                            name={memberName(person, entry.username)}
                            size={35}
                          />
                        )}
                        <View style={{ flex: 1, gap: 4 }}>
                          <Label size={13} style={{ color: colors.gold }}>
                            {roleLabel(entry.work_type)}
                          </Label>
                          {!member && (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() =>
                                nav.push("Detail", {
                                  member: entry.userId,
                                  work: chapter.work,
                                  month,
                                })
                              }
                            >
                              <Label size={12}>
                                {memberName(person, entry.username)}
                              </Label>
                            </Pressable>
                          )}
                          <Label dim size={10}>
                            {monthName} · {dateLabel(entry.timestamp)}
                          </Label>
                          {!!entry.notes && (
                            <Label dim size={11}>
                              {entry.notes}
                            </Label>
                          )}
                        </View>
                        <Label size={11}>{money(entry.total)}</Label>
                      </View>
                    </View>
                  );
                })}
              </Glass>
            ))}
          </>
        )}

        {tab === "adjustments" &&
          adjustments.slice(0, limit).map((entry) => (
            <Glass key={entry.id}>
              <Row
                title={roleLabel(entry.work_type)}
                icon={
                  entry.work_type === "خصم"
                    ? "remove-circle-outline"
                    : "gift-outline"
                }
                detail={`${memberName(membersById.get(entry.userId), entry.username)} · ${entry.work_name}`}
                right={money(entry.total)}
              />
              <Label dim size={10}>
                {entry.month_key} · {dateLabel(entry.timestamp, true)}
              </Label>
              {!!entry.notes && (
                <Label size={12} style={{ marginTop: 8 }}>
                  {entry.notes}
                </Label>
              )}
            </Glass>
          ))}
        {itemCount > limit && (
          <Button
            secondary
            title={`عرض المزيد · ${itemCount - limit} متبقية`}
            onPress={() => setLimit(limit + 24)}
          />
        )}
        {!itemCount && (
          <Empty
            title={
              query
                ? "لا توجد نتائج مطابقة"
                : tab === "adjustments"
                  ? "لا توجد مكافآت أو خصومات"
                  : "لا توجد مساهمات في هذه الفترة"
            }
            detail={
              query
                ? "جرّب اسمًا أو رقم فصل أو تخصصًا آخر."
                : "اختر كل الشهور أو تخصصًا آخر لاستعراض السجلات السابقة."
            }
          />
        )}

        {member && work && (
          <Button
            secondary
            icon="person-circle-outline"
            title="عرض الملف الكامل للعضو"
            onPress={() => nav.push("Detail", { member, month })}
          />
        )}
        {member && !work && user?.isAdmin && (
          <Button
            secondary
            icon="shield-checkmark-outline"
            title="إدارة هذا العضو"
            onPress={() =>
              nav.navigate("ControlSection", { section: "members", member })
            }
          />
        )}
        {!member && work && !w?.isolated && w?.active !== false && (
          <Button
            title="تسجيل فصول في هذا العمل"
            icon="add-outline"
            onPress={() =>
              nav.navigate("Register", { work, chapter: route.params?.chapter })
            }
          />
        )}
        {!!work && user?.isAdmin && (
          <>
            <Section title="إدارة العمل" />
            <Glass>
              <Row
                title="إعدادات العمل"
                detail="الاسم، الحالة، وبداية الفصول المدفوعة"
                icon="settings-outline"
                onPress={() =>
                  nav.navigate("AdminForm", { kind: "editWork", work })
                }
              />
              <Row
                title={
                  w?.isolated
                    ? "استرجاع العمل إلى التقارير"
                    : "عزل العمل من التقارير"
                }
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
                title="الأسعار الخاصة بهذا العمل"
                icon="pricetags-outline"
                onPress={() =>
                  nav.navigate("AdminForm", { kind: "customPrice", work })
                }
              />
            </Glass>
          </>
        )}
      </View>
    </Page>
  );
}

const local = StyleSheet.create({
  hero: { padding: 24, gap: 18 },
  orbit: {
    position: "absolute",
    left: -40,
    top: -70,
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.15)",
  },
  portraitFrame: {
    padding: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.18)",
    backgroundColor: "rgba(232,199,124,.04)",
  },
  tag: {
    borderRadius: 9,
    backgroundColor: "rgba(232,199,124,.07)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.17)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(232,199,124,.08)",
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  release: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "rgba(232,199,124,.05)",
  },
  numbers: { gap: 8 },
  number: {
    flex: 1,
    alignItems: "center",
    borderRadius: 15,
    paddingVertical: 12,
    backgroundColor: "rgba(232,199,124,.04)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.1)",
  },
  roleGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 },
  roleCard: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: 15,
    borderRadius: 19,
    gap: 4,
  },
  chapterBadge: {
    minWidth: 58,
    minHeight: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,199,124,.08)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.24)",
    paddingHorizontal: 8,
  },
});
