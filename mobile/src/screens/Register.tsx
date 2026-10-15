import { Coachmark } from "../components/Coachmark";
import { useWalkthrough } from "../lib/walkthrough-context";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Alert } from "../lib/alerts";
import { useTeam } from "../lib/context";
import { allowedSpecialties, priceOf } from "../lib/domain";
import {
  addSelectedChapters,
  chaptersForEntry,
  registrationPreview,
  registrationTypesInput,
  resolveChapterSpecialties,
  type ChapterEntryMode,
} from "../lib/registration-plan";
import { useRegistrationPreferences } from "../lib/use-registration-preferences";
import { Media } from "../components/Media";
import {
  RegistrationSelectionSheet,
  type RegistrationOption,
} from "../components/RegistrationSelectionSheet";
import {
  Page,
  Glass,
  Label,
  Heading,
  Chips,
  Field,
  Button,
  Icon,
  styles,
  colors,
  Empty,
} from "../components/ui";

const specialtyName = (type: string) => type.replace(/_/g, " ");
const pageSize = 12;
export function Register({ route }: { route: any }) {
  const { snapshot: s, user, execute, offline } = useTeam();
  const nav = useNavigation<any>();
  const walkthrough = useWalkthrough();
  const { preferences, ready, remember } = useRegistrationPreferences(
    user?.id || "",
  );
  const [work, setWork] = useState<string>(route.params?.work || "");
  const [defaultType, setDefaultType] = useState("");
  const [mode, setMode] = useState<ChapterEntryMode>("single");
  const [single, setSingle] = useState<string>(
    String(route.params?.chapter ?? ""),
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [chapterInput, setChapterInput] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [perChapter, setPerChapter] = useState(false);
  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<string>(
    route.params?.userId || user?.id || "",
  );
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"work" | "member" | "specialty" | null>(
    null,
  );
  const [specialtyChapter, setSpecialtyChapter] = useState<string | null>(null);
  const [chapterPage, setChapterPage] = useState(0);
  const restoredWork = useRef("");
  const works = useMemo(
    () => s?.works.filter((w) => !w.isolated && w.active !== false) || [],
    [s],
  );
  const selected = works.find((w) => w.name === work);
  const types = useMemo(
    () => (s ? allowedSpecialties(s, selected) : []),
    [s, selected],
  );
  useEffect(() => {
    if (user && !target) setTarget(user.id);
  }, [user, target]);
  useEffect(() => {
    if (!ready || work) return;
    const recent = preferences.works.find((name) =>
      works.some((item) => item.name === name),
    );
    if (recent) setWork(recent);
  }, [ready, preferences.works, works, work]);
  useEffect(() => {
    if (!selected || !ready) return;
    const restoreChoice = restoredWork.current !== selected.name;
    restoredWork.current = selected.name;
    setDefaultType((current) => {
      if (types.includes(current)) return current;
      if (!restoreChoice) return "";
      const preferred = preferences.byWork[selected.name];
      return types.includes(preferred)
        ? preferred
        : preferences.specialties.find((type) => types.includes(type)) || "";
    });
  }, [selected, ready, preferences.byWork, preferences.specialties, types]);
  const chapterSelection = useMemo(() => {
    try {
      return {
        chapters: chaptersForEntry(mode, single, from, to, selectedChapters),
        error: "",
      };
    } catch (error) {
      return {
        chapters: [],
        error: error instanceof Error ? error.message : "الفصول غير صالحة",
      };
    }
  }, [mode, single, from, to, selectedChapters]);
  const chapterTypes = useMemo(
    () =>
      resolveChapterSpecialties(
        chapterSelection.chapters,
        perChapter ? choices : {},
        defaultType,
        types,
      ),
    [chapterSelection.chapters, perChapter, choices, defaultType, types],
  );
  const preview = useMemo(
    () =>
      s && selected
        ? registrationPreview(
            s,
            selected,
            target,
            chapterSelection.chapters,
            chapterTypes,
          )
        : [],
    [s, selected, target, chapterSelection.chapters, chapterTypes],
  );
  const amount = preview.reduce((total, row) => total + row.amount, 0);
  const readyCount = preview.filter((row) => row.status === "ready").length;
  const freeCount = preview.filter((row) => row.status === "free").length;
  const duplicateCount = preview.filter(
    (row) => row.status === "duplicate",
  ).length;
  const remainingTypes = chapterTypes.filter((type) => !type).length;
  const targetMember = s?.members.find((member) => member.id === target);
  const maxPage = Math.max(0, Math.ceil(preview.length / pageSize) - 1);
  useEffect(() => {
    setChapterPage((page) => Math.min(page, maxPage));
  }, [maxPage]);
  if (!s || !user) return null;
  const chooseWork = (name: string) => {
    walkthrough.act("work-selected");
    if (name === work) {
      remember(name);
      return;
    }
    setWork(name);
    setDefaultType("");
    setChoices({});
    setChapterPage(0);
    remember(name);
  };
  const openSpecialties = (chapter: string | null = null) => {
    if (chapterSelection.chapters.length && !chapterSelection.error)
      walkthrough.act("chapter-entered");
    setSpecialtyChapter(chapter);
    setSheet("specialty");
  };
  const chooseSpecialty = (type: string) => {
    if (chapterSelection.chapters.length && !chapterSelection.error)
      walkthrough.act("specialty-selected");
    if (specialtyChapter !== null)
      setChoices((current) => ({ ...current, [specialtyChapter]: type }));
    else setDefaultType(type);
    remember(work, type);
  };
  const addChapters = () => {
    try {
      setSelectedChapters(addSelectedChapters(selectedChapters, chapterInput));
      setChapterInput("");
    } catch (error) {
      Alert.alert(
        "تحقق من رقم الفصل",
        error instanceof Error ? error.message : "أدخل رقمًا صالحًا",
      );
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const message = await execute({
        action: "register",
        payload: {
          userId: target,
          work,
          chapters: chapterSelection.chapters.join(","),
          types: registrationTypesInput(chapterTypes),
          notes,
        },
      });
      walkthrough.act("registration-succeeded");
      remember(work, defaultType || chapterTypes[0]);
      Alert.alert("تم تسجيل الفصول ✦", message, [
        { text: "تم", onPress: () => nav.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        "تعذر تسجيل الفصل",
        error instanceof Error ? error.message : "حاول مجددًا",
      );
    } finally {
      setBusy(false);
    }
  };
  const recentWorks = preferences.works
    .map((name) => works.find((item) => item.name === name))
    .filter((item) => !!item)
    .slice(0, 6);
  const rank = (name: string, list: string[]) => {
    const index = list.indexOf(name);
    return index < 0 ? 1000 : index;
  };
  const sortedWorks = [...works].sort(
    (a, b) =>
      rank(a.name, preferences.works) - rank(b.name, preferences.works) ||
      a.name.localeCompare(b.name, "ar"),
  );
  const sortedTypes = [...types].sort(
    (a, b) =>
      rank(a, preferences.specialties) - rank(b, preferences.specialties) ||
      a.localeCompare(b, "ar"),
  );
  let options: RegistrationOption[] = [];
  if (sheet === "work")
    options = sortedWorks.map((item) => ({
      value: item.name,
      label: item.name,
      detail: item.azora
        ? `مرتبط بأزورا${item.azora.latestChapter ? ` · آخر فصل ${item.azora.latestChapter}` : ""}`
        : "عمل الفريق",
      search: item.azora?.title,
      image: item.azora?.cover,
      cover: true,
      recent: preferences.works.includes(item.name),
    }));
  if (sheet === "member")
    options = s.members.map((member) => ({
      value: member.id,
      label: member.name,
      detail: member.id === user.id ? "حسابك" : undefined,
      image: member.avatar,
    }));
  if (sheet === "specialty")
    options = sortedTypes.map((type) => ({
      value: type,
      label: specialtyName(type),
      detail: `${s.settings.currency} ${selected ? priceOf(s, selected, type).toFixed(3) : "0.000"} لكل فصل`,
      recent: preferences.specialties.includes(type),
    }));
  const selectedSheetValue =
    sheet === "work"
      ? work
      : sheet === "member"
        ? target
        : specialtyChapter !== null
          ? chapterTypes[chapterSelection.chapters.indexOf(specialtyChapter)] ||
            ""
          : defaultType;
  return (
    <>
      <Page>
        <View style={styles.stack}>
          <LinearGradient
            colors={["#2D2619", "#17181F"]}
            style={registration.hero}
          >
            <View style={[styles.row, { gap: 16 }]}>
              {selected ? (
                <Media
                  uri={selected.azora?.cover}
                  name={selected.name}
                  size={64}
                  cover
                />
              ) : (
                <View style={registration.heroIcon}>
                  <Icon name="layers-outline" size={34} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Label size={11} style={{ color: colors.gold }}>
                  سجل الفريق · {s.settings.active_month}
                </Label>
                <Heading size={25}>تسجيل فصل</Heading>
                <Label dim size={12}>
                  {selected
                    ? selected.name
                    : "اختر العمل، ثم الفصول وتخصصك في كل فصل."}
                </Label>
              </View>
            </View>
            <View style={[styles.row, { gap: 8, marginTop: 20 }]}>
              <Step
                label="العمل"
                value={selected ? "checkmark" : "1"}
                complete={!!selected}
              />
              <Step
                label="الفصول"
                value={
                  chapterSelection.chapters.length
                    ? String(chapterSelection.chapters.length)
                    : "2"
                }
                complete={!!chapterSelection.chapters.length}
              />
              <Step
                label="التخصص"
                value={
                  chapterTypes.length && !remainingTypes ? "checkmark" : "3"
                }
                complete={!!chapterTypes.length && !remainingTypes}
              />
            </View>
          </LinearGradient>
          {!works.length ? (
            <Empty
              title="لا توجد أعمال متاحة للتسجيل"
              detail="يضيف المشرف الأعمال ويحدد تخصصاتها من لوحة الإشراف."
            />
          ) : (
            <>
              <Glass style={styles.stack}>
                <PanelHeading
                  number="01"
                  title="العمل"
                  detail="ابحث بالاسم أو اختر من آخر أعمالك."
                />
                <Coachmark step="work" text="اضغط واختر العمل الذي أنجزته">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="اختيار العمل أو البحث عنه"
                    onPress={() => setSheet("work")}
                    style={registration.selector}
                  >
                    {selected ? (
                      <Media
                        uri={selected.azora?.cover}
                        name={selected.name}
                        size={40}
                        cover
                      />
                    ) : (
                      <Icon name="search-outline" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Label>{selected?.name || "ابحث عن العمل"}</Label>
                      {selected && (
                        <Label dim size={11}>
                          {selected.azora ? "أزورا متصلة" : "عمل الفريق"}
                          {selected.paid_start != null
                            ? ` · المستحق من الفصل ${selected.paid_start}`
                            : ""}
                        </Label>
                      )}
                    </View>
                    <Icon name="chevron-down" size={18} color={colors.muted} />
                  </Pressable>
                </Coachmark>
                {!!recentWorks.length && (
                  <>
                    <Label dim size={11}>
                      استخدمتها مؤخرًا · محفوظة لحسابك
                    </Label>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        flexDirection: "row-reverse",
                        gap: 12,
                      }}
                    >
                      {recentWorks.map((item) => (
                        <Pressable
                          key={item.name}
                          accessibilityRole="button"
                          accessibilityLabel={item.name}
                          onPress={() => chooseWork(item.name)}
                          style={[
                            registration.recent,
                            item.name === work && { borderColor: colors.gold },
                          ]}
                        >
                          <Media
                            uri={item.azora?.cover}
                            name={item.name}
                            size={54}
                            cover
                          />
                          <Label size={10} style={{ textAlign: "center" }}>
                            {item.name}
                          </Label>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}
              </Glass>
              {selected && (
                <>
                  <Glass style={styles.stack}>
                    <PanelHeading
                      number="02"
                      title="الفصول"
                      detail="فصل واحد، نطاق متتابع، أو فصول متفرقة."
                    />
                    <Chips
                      items={[
                        { label: "فصل واحد", value: "single" },
                        { label: "من فصل إلى فصل", value: "range" },
                        { label: "فصول متفرقة", value: "selected" },
                      ]}
                      value={mode}
                      onSelect={(next) => {
                        setMode(next as ChapterEntryMode);
                        setChapterPage(0);
                      }}
                    />
                    {mode === "single" && (
                      <Coachmark
                        step="chapter"
                        text="اكتب رقم الفصل الذي أنجزته، ثم اختر تخصصك"
                      >
                        <Field
                          label="رقم الفصل"
                          value={single}
                          onChange={setSingle}
                          onEndEditing={() => {
                            if (
                              chapterSelection.chapters.length &&
                              !chapterSelection.error
                            )
                              walkthrough.act("chapter-entered");
                          }}
                          number
                          placeholder="أدخل رقم الفصل"
                        />
                      </Coachmark>
                    )}
                    {mode === "range" && (
                      <View
                        style={[
                          styles.row,
                          { gap: 12, alignItems: "flex-start" },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Field
                            label="أول فصل"
                            value={from}
                            onChange={setFrom}
                            number
                            placeholder="من"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Field
                            label="آخر فصل"
                            value={to}
                            onChange={setTo}
                            number
                            placeholder="إلى"
                          />
                        </View>
                      </View>
                    )}
                    {mode === "selected" && (
                      <>
                        <View
                          style={[
                            styles.row,
                            { gap: 10, alignItems: "flex-end" },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Field
                              label="أضف فصلًا أو الصق نطاقًا"
                              value={chapterInput}
                              onChange={setChapterInput}
                              placeholder="مثال: 12 أو 15-20"
                            />
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="إضافة الفصول المحددة"
                            onPress={addChapters}
                            disabled={!chapterInput.trim()}
                            style={[
                              registration.add,
                              !chapterInput.trim() && { opacity: 0.4 },
                            ]}
                          >
                            <Icon name="add" color={colors.bg} />
                          </Pressable>
                        </View>
                        {!!selectedChapters.length && (
                          <>
                            <View
                              style={[
                                styles.row,
                                { justifyContent: "space-between" },
                              ]}
                            >
                              <Label dim size={11}>
                                {selectedChapters.length} فصل مختار
                              </Label>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => setSelectedChapters([])}
                              >
                                <Label size={11} style={{ color: colors.red }}>
                                  مسح الاختيار
                                </Label>
                              </Pressable>
                            </View>
                            <View style={registration.chapterChips}>
                              {selectedChapters.slice(0, 40).map((chapter) => (
                                <Pressable
                                  key={chapter}
                                  accessibilityRole="button"
                                  accessibilityLabel={`إزالة الفصل ${chapter}`}
                                  onPress={() =>
                                    setSelectedChapters((current) =>
                                      current.filter(
                                        (value) => value !== chapter,
                                      ),
                                    )
                                  }
                                  style={registration.chapterChip}
                                >
                                  <Label size={12}>{chapter}</Label>
                                  <Icon
                                    name="close"
                                    size={12}
                                    color={colors.muted}
                                  />
                                </Pressable>
                              ))}
                            </View>
                            {selectedChapters.length > 40 && (
                              <Label dim size={11}>
                                و{selectedChapters.length - 40} فصل آخر. تظهر
                                التفاصيل في قائمة الفصول أدناه.
                              </Label>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {!!chapterSelection.error && (
                      <Label size={12} style={{ color: colors.red }}>
                        {chapterSelection.error}
                      </Label>
                    )}
                    {!!selected.azora?.latestChapter && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setMode("single");
                          setSingle(selected.azora!.latestChapter!);
                        }}
                        style={registration.published}
                      >
                        <Icon name="planet-outline" size={18} />
                        <Label size={11} style={{ color: colors.gold }}>
                          آخر فصل على أزورا: {selected.azora.latestChapter} ·
                          اختره
                        </Label>
                      </Pressable>
                    )}
                    {!!chapterSelection.chapters.length && (
                      <Label dim size={11}>
                        تم اختيار {chapterSelection.chapters.length} فصل
                        {mode === "range"
                          ? ` · ${chapterSelection.chapters[0]} إلى ${chapterSelection.chapters.at(-1)}`
                          : ""}
                        .
                      </Label>
                    )}
                  </Glass>
                  <Glass style={styles.stack}>
                    <PanelHeading
                      number="03"
                      title="التخصص"
                      detail="اختر تخصصًا للجميع أو عدّله لكل فصل دون كتابة أسماء التخصصات."
                    />
                    {!types.length ? (
                      <Label style={{ color: colors.red }}>
                        لا توجد تخصصات متاحة لهذا العمل. يضبطها المشرف من لوحة
                        الإشراف.
                      </Label>
                    ) : (
                      <>
                        <Coachmark
                          step="specialty"
                          text="اضغط واختر تخصصك في هذا الفصل"
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="اختيار التخصص أو البحث عنه"
                            onPress={() => openSpecialties()}
                            style={registration.selector}
                          >
                            <View style={styles.iconBox}>
                              <Icon name="pricetag-outline" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Label>
                                {defaultType
                                  ? specialtyName(defaultType)
                                  : "اختر التخصص الأساسي"}
                              </Label>
                              <Label dim size={11}>
                                {defaultType && types.includes(defaultType)
                                  ? `${s.settings.currency} ${priceOf(s, selected, defaultType).toFixed(3)} لكل فصل`
                                  : "التخصصات الأخيرة تظهر أولًا في البحث"}
                              </Label>
                            </View>
                            <Icon
                              name="chevron-down"
                              size={18}
                              color={colors.muted}
                            />
                          </Pressable>
                        </Coachmark>
                        <Chips
                          items={[
                            { label: "تخصص واحد للجميع", value: "one" },
                            { label: "تخصص لكل فصل", value: "mixed" },
                          ]}
                          value={perChapter ? "mixed" : "one"}
                          onSelect={(next) => setPerChapter(next === "mixed")}
                        />
                        {perChapter && (
                          <Button
                            secondary
                            title="تطبيق التخصص الأساسي على كل الفصول"
                            icon="copy-outline"
                            disabled={
                              !defaultType || !chapterSelection.chapters.length
                            }
                            onPress={() =>
                              setChoices(
                                Object.fromEntries(
                                  chapterSelection.chapters.map((chapter) => [
                                    chapter,
                                    defaultType,
                                  ]),
                                ),
                              )
                            }
                          />
                        )}
                        {!!preview.length && (
                          <>
                            <View
                              style={[
                                styles.row,
                                { justifyContent: "space-between" },
                              ]}
                            >
                              <Label size={12}>تفاصيل الفصول</Label>
                              <Label dim size={11}>
                                {preview.length} فصل
                                {remainingTypes
                                  ? ` · ${remainingTypes} بانتظار التخصص`
                                  : ""}
                              </Label>
                            </View>
                            {preview
                              .slice(
                                chapterPage * pageSize,
                                (chapterPage + 1) * pageSize,
                              )
                              .map((row) => {
                                const detail =
                                  row.status === "free"
                                    ? "مجاني · سيُستبعد"
                                    : row.status === "duplicate"
                                      ? "مسجل مسبقًا · سيُستبعد"
                                      : row.status === "unassigned"
                                        ? "اختر التخصص"
                                        : `${s.settings.currency} ${row.amount.toFixed(3)}`;
                                return (
                                  <View
                                    key={row.chapter}
                                    style={registration.chapterRow}
                                  >
                                    <View style={registration.chapterNumber}>
                                      <Label size={10} dim>
                                        الفصل
                                      </Label>
                                      <Label
                                        size={18}
                                        style={{ color: colors.gold }}
                                      >
                                        {row.chapter}
                                      </Label>
                                    </View>
                                    <View style={{ flex: 1, gap: 4 }}>
                                      <Pressable
                                        accessibilityRole={
                                          perChapter ? "button" : undefined
                                        }
                                        accessibilityLabel={`تخصص الفصل ${row.chapter}`}
                                        disabled={!perChapter}
                                        onPress={() =>
                                          openSpecialties(row.chapter)
                                        }
                                        style={[
                                          registration.specialtyRow,
                                          !row.specialty && {
                                            borderColor:
                                              "rgba(234,151,151,.35)",
                                          },
                                        ]}
                                      >
                                        <Label size={12}>
                                          {row.specialty
                                            ? specialtyName(row.specialty)
                                            : "اختر التخصص"}
                                        </Label>
                                        {perChapter && (
                                          <Icon
                                            name="chevron-down"
                                            size={14}
                                            color={colors.gold}
                                          />
                                        )}
                                      </Pressable>
                                      <Label
                                        size={10}
                                        style={{
                                          color:
                                            row.status === "ready"
                                              ? colors.green
                                              : colors.muted,
                                        }}
                                      >
                                        {detail}
                                      </Label>
                                    </View>
                                    {mode === "selected" ? (
                                      <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`إزالة الفصل ${row.chapter}`}
                                        hitSlop={8}
                                        onPress={() =>
                                          setSelectedChapters((current) =>
                                            current.filter(
                                              (value) => value !== row.chapter,
                                            ),
                                          )
                                        }
                                      >
                                        <Icon
                                          name="close-circle-outline"
                                          size={22}
                                          color={colors.muted}
                                        />
                                      </Pressable>
                                    ) : (
                                      <Icon
                                        name={
                                          row.status === "ready"
                                            ? "checkmark-circle-outline"
                                            : row.status === "unassigned"
                                              ? "ellipse-outline"
                                              : "remove-circle-outline"
                                        }
                                        size={19}
                                        color={
                                          row.status === "ready"
                                            ? colors.green
                                            : colors.muted
                                        }
                                      />
                                    )}
                                  </View>
                                );
                              })}
                            {maxPage > 0 && (
                              <View
                                style={[
                                  styles.row,
                                  { justifyContent: "space-between" },
                                ]}
                              >
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="الفصول السابقة"
                                  disabled={chapterPage === 0}
                                  onPress={() =>
                                    setChapterPage((page) => page - 1)
                                  }
                                  style={[
                                    registration.pageButton,
                                    chapterPage === 0 && { opacity: 0.3 },
                                  ]}
                                >
                                  <Icon name="chevron-forward" size={18} />
                                </Pressable>
                                <Label dim size={11}>
                                  {chapterPage * pageSize + 1}–
                                  {Math.min(
                                    (chapterPage + 1) * pageSize,
                                    preview.length,
                                  )}{" "}
                                  من {preview.length}
                                </Label>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="الفصول التالية"
                                  disabled={chapterPage === maxPage}
                                  onPress={() =>
                                    setChapterPage((page) => page + 1)
                                  }
                                  style={[
                                    registration.pageButton,
                                    chapterPage === maxPage && { opacity: 0.3 },
                                  ]}
                                >
                                  <Icon name="chevron-back" size={18} />
                                </Pressable>
                              </View>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </Glass>
                  <Glass style={styles.stack}>
                    {user.isAdmin && (
                      <>
                        <Label dim size={12}>
                          تسجيل الفصول باسم
                        </Label>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="اختيار العضو المسجل باسمه"
                          onPress={() => setSheet("member")}
                          style={registration.selector}
                        >
                          <Media
                            uri={targetMember?.avatar}
                            name={targetMember?.name || user.name}
                            size={42}
                          />
                          <View style={{ flex: 1 }}>
                            <Label>{targetMember?.name || "اختر العضو"}</Label>
                            <Label dim size={11}>
                              {target === user.id
                                ? "حسابك"
                                : "تسجيل بواسطة المشرف"}
                            </Label>
                          </View>
                          <Icon name="chevron-down" size={16} />
                        </Pressable>
                      </>
                    )}
                    <Field
                      label="ملاحظات · اختياري"
                      value={notes}
                      onChange={setNotes}
                      multiline
                      placeholder="أضف أي تفاصيل يحتاجها المشرف."
                    />
                  </Glass>
                  <Glass gold style={{ gap: 10 }}>
                    <View
                      style={[styles.row, { justifyContent: "space-between" }]}
                    >
                      <Label dim size={12}>
                        المستحق المتوقع
                      </Label>
                      <Icon name="wallet-outline" />
                    </View>
                    <Heading size={32}>
                      {s.settings.currency} {amount.toFixed(3)}
                    </Heading>
                    <View style={registration.summary}>
                      <SummaryPill
                        text={`${readyCount} جاهز للتسجيل`}
                        color={colors.green}
                      />
                      {freeCount > 0 && (
                        <SummaryPill
                          text={`${freeCount} مجاني`}
                          color={colors.muted}
                        />
                      )}
                      {duplicateCount > 0 && (
                        <SummaryPill
                          text={`${duplicateCount} مكرر`}
                          color={colors.muted}
                        />
                      )}
                    </View>
                    <Label dim size={11}>
                      {selected.azora
                        ? "يُتحقق من نشر الفصول على أزورا عند الحفظ. المجاني والمكرر لا يضافان إلى المستحق."
                        : "المجاني والمسجل مسبقًا لا يضافان إلى المستحق."}
                    </Label>
                  </Glass>
                  <Coachmark
                    step="save"
                    text="راجع اختيارك ثم اضغط لتسجيل الفصل"
                  >
                    <Button
                      title={
                        busy
                          ? "جارٍ تسجيل الفصول…"
                          : chapterSelection.chapters.length > 1
                            ? `تأكيد تسجيل ${readyCount} فصل`
                            : "تأكيد تسجيل الفصل"
                      }
                      onPress={() => void save()}
                      icon="checkmark-circle-outline"
                      disabled={
                        busy ||
                        offline ||
                        !selected ||
                        !targetMember ||
                        !readyCount ||
                        !!remainingTypes ||
                        !!chapterSelection.error
                      }
                    />
                  </Coachmark>
                  {offline && (
                    <Label style={{ color: colors.red }}>
                      يمكنك تجهيز الفصول والتخصصات الآن؛ الحفظ متاح عند عودة
                      الاتصال.
                    </Label>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </Page>
      {sheet && (
        <RegistrationSelectionSheet
          title={
            sheet === "work"
              ? "اختر العمل"
              : sheet === "member"
                ? "اختر العضو"
                : specialtyChapter !== null
                  ? `تخصص الفصل ${specialtyChapter}`
                  : "اختر التخصص"
          }
          hint={
            sheet === "work"
              ? "الأعمال الأخيرة تظهر أولًا، ويمكنك البحث بالاسم."
              : sheet === "member"
                ? "تُحفظ الفصول في سجل العضو الذي تختاره."
                : "اختر من تخصصات هذا العمل المتاحة."
          }
          items={options}
          value={selectedSheetValue}
          onClose={() => setSheet(null)}
          onSelect={
            sheet === "work"
              ? chooseWork
              : sheet === "member"
                ? setTarget
                : chooseSpecialty
          }
        />
      )}
    </>
  );
}
function PanelHeading({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={[styles.row, { gap: 13 }]}>
      <View style={registration.sectionNumber}>
        <Label size={14} style={{ color: colors.gold }}>
          {number}
        </Label>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Heading size={18}>{title}</Heading>
        <Label dim size={11}>
          {detail}
        </Label>
      </View>
    </View>
  );
}
function Step({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <View
      style={[
        registration.step,
        complete && {
          borderColor: "rgba(232,199,124,.32)",
          backgroundColor: "rgba(232,199,124,.09)",
        },
      ]}
    >
      {value === "checkmark" ? (
        <Icon name="checkmark-circle" size={15} />
      ) : (
        <Label
          size={11}
          style={{ color: complete ? colors.gold : colors.muted }}
        >
          {value}
        </Label>
      )}
      <Label size={11} style={{ color: complete ? colors.text : colors.muted }}>
        {label}
      </Label>
    </View>
  );
}
function SummaryPill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[registration.summaryPill, { borderColor: `${color}44` }]}>
      <Label size={10} style={{ color }}>
        {text}
      </Label>
    </View>
  );
}
const registration = StyleSheet.create({
  hero: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.24)",
    overflow: "hidden",
  },
  heroIcon: {
    width: 70,
    height: 85,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "rgba(232,199,124,.08)",
  },
  step: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selector: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#171820",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.18)",
    minHeight: 66,
  },
  sectionNumber: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(232,199,124,.08)",
  },
  recent: {
    width: 108,
    padding: 10,
    borderRadius: 16,
    alignItems: "center",
    gap: 7,
    backgroundColor: "#14151B",
    borderWidth: 1,
    borderColor: colors.line,
  },
  add: {
    width: 54,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.gold,
    marginBottom: 1,
  },
  chapterChips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chapterChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(232,199,124,.08)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.2)",
  },
  published: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(232,199,124,.055)",
  },
  chapterRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 13,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#14151A",
  },
  chapterNumber: { minWidth: 48, alignItems: "center", paddingHorizontal: 3 },
  specialtyRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#1A1B22",
  },
  pageButton: { padding: 10, backgroundColor: "#191A20", borderRadius: 12 },
  summary: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  summaryPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,.1)",
  },
});
