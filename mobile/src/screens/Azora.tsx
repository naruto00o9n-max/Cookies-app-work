import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Alert } from "../lib/alerts";
import { useTeam } from "../lib/context";
import { useRegistrationPreferences } from "../lib/use-registration-preferences";
import type { CatalogPost } from "../lib/azora-policy";
import { Media } from "../components/Media";
import { RegistrationSelectionSheet } from "../components/RegistrationSelectionSheet";
import {
  Page,
  Glass,
  Heading,
  Label,
  Field,
  Row,
  Button,
  styles,
  colors,
  Empty,
  Icon,
} from "../components/ui";
type Data = {
  state: {
    team_slug: string;
    enabled: boolean;
    auto_add_new_works: boolean;
    baseline_done?: boolean;
    last_sync_at?: string;
    last_error?: string;
    syncing: boolean;
    sync_error?: string;
    sync_message?: string;
  };
  posts: CatalogPost[];
};
function useAzora() {
  const { call, refresh } = useTeam();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef<Data | null>(null);
  const load = useCallback(async () => {
    const d = await call<Data>("/api/mobile/azora");
    const wasSyncing = current.current?.state.syncing;
    current.current = d;
    setData(d);
    setError("");
    if (wasSyncing && !d.state.syncing) await refresh();
  }, [call, refresh]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const read = async () => {
        try {
          await load();
        } catch (e) {
          if (active)
            setError(e instanceof Error ? e.message : "تعذر تحميل أزورا");
        }
      };
      void read();
      const timer = setInterval(() => {
        if (current.current?.state.syncing) void read();
      }, 4000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [load]),
  );
  const run = async (body: unknown) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await call<{ message: string }>("/api/mobile/azora", body);
      await load();
      return result.message;
    } catch (e) {
      const message = e instanceof Error ? e.message : "تعذرت العملية";
      setError(message);
      Alert.alert("تعذرت العملية", message);
    } finally {
      setBusy(false);
    }
  };
  return { data, error, busy, run };
}
function Status({ data, error }: { data: Data | null; error: string }) {
  const message = error || data?.state.sync_error || data?.state.last_error;
  return (
    <>
      {!data && !error && <ActivityIndicator color={colors.gold} />}{" "}
      {!!message && (
        <Glass>
          <Label style={{ color: colors.red }}>{message}</Label>
        </Glass>
      )}
      {data?.state.syncing && (
        <Glass gold>
          <View style={styles.row}>
            <ActivityIndicator color={colors.gold} />
            <View style={{ flex: 1, gap: 4, paddingHorizontal: 14 }}>
              <Label>جارٍ تحديث أزورا في الخلفية</Label>
              <Label dim size={12}>
                يمكنك متابعة عملك؛ ستتحدث النتائج عند اكتمال المزامنة.
              </Label>
            </View>
          </View>
        </Glass>
      )}
    </>
  );
}
function Hero({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <View style={design.hero}>
      <LinearGradient
        colors={["#292417", "#15151B", "#101117"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={design.orbit} />
      <View style={design.crest}>
        <Icon name={icon} size={32} />
      </View>
      <Label size={10} style={{ color: colors.gold, letterSpacing: 3 }}>
        COOKIES × AZORA
      </Label>
      <Heading size={30}>{title}</Heading>
      <Label dim style={{ lineHeight: 26 }}>
        {detail}
      </Label>
    </View>
  );
}
export function Azora() {
  const { snapshot: s, user } = useTeam(),
    nav = useNavigation<any>();
  const { data, error, busy, run } = useAzora();
  if (!user?.isAdmin || !s) return null;
  const linked = s.works.filter((w) => w.azora?.slug).length;
  return (
    <Page>
      <View style={styles.stack}>
        <Hero
          title="مركز أزورا"
          detail="أعمال فريقك هي الأساس. اربطها بمصدرها، وتابع نشر الفصول من مساحة واحدة."
          icon="planet-outline"
        />
        <View style={[styles.row, { gap: 10 }]}>
          {[
            { n: linked, title: "عمل مرتبط" },
            { n: s.works.length - linked, title: "بانتظار الربط" },
          ].map((item) => (
            <Glass key={item.title} style={{ flex: 1, gap: 5 }}>
              <Heading size={30}>{item.n}</Heading>
              <Label dim>{item.title}</Label>
            </Glass>
          ))}
        </View>
        <Status data={data} error={error} />
        <Glass style={{ paddingVertical: 4 }}>
          <Row
            title="ربط عمل بأزورا"
            detail="اختر عملًا محفوظًا في الفريق، ثم ابحث عن مقابله على أزورا"
            icon="link-outline"
            onPress={() => nav.navigate("AzoraLink")}
          />
          <View style={styles.divider} />
          <Row
            title="الأعمال المرتبطة"
            detail="الأغلفة، الفصول، والتحكم في الارتباطات الحالية"
            icon="albums-outline"
            onPress={() => nav.navigate("AzoraLinked")}
          />
          <View style={styles.divider} />
          <Row
            title="المزامنة والإضافة التلقائية"
            detail="إضافة ما يظهر جديدًا فقط بعد تثبيت القائمة الحالية"
            icon="options-outline"
            onPress={() => nav.navigate("AzoraSettings")}
          />
        </Glass>
        <Glass style={styles.stack}>
          <Row
            title="آخر تحديث"
            detail={
              data?.state.last_sync_at
                ? new Date(data.state.last_sync_at).toLocaleString("ar")
                : "لم تتم المزامنة بعد"
            }
            icon="time-outline"
          />
          <Button
            title={data?.state.syncing ? "التحديث جارٍ…" : "تحديث بيانات أزورا"}
            icon="sync-outline"
            disabled={
              busy || data?.state.syncing || data?.state.enabled === false
            }
            onPress={() => void run({ action: "sync" })}
          />
          {!data?.state.syncing && data?.state.sync_message && (
            <Label dim size={12}>
              {data.state.sync_message}
            </Label>
          )}
        </Glass>
      </View>
    </Page>
  );
}
export function AzoraLink() {
  const { snapshot: s, user, execute, offline } = useTeam(),
    nav = useNavigation<any>();
  const { data, error, busy, run } = useAzora();
  const [work, setWork] = useState(""),
    [slug, setSlug] = useState(""),
    [picker, setPicker] = useState<"work" | "post" | null>(null),
    [saving, setSaving] = useState(false);
  const { preferences, remember } = useRegistrationPreferences(user?.id || "");
  if (!s || !user?.isAdmin) return null;
  const available = s.works.filter((w) => !w.azora?.slug),
    selected = available.find((w) => w.name === work),
    post = data?.posts.find((p) => p.slug === slug),
    used = new Set(
      s.works.filter((w) => w.azora?.slug).map((w) => w.azora!.slug),
    );
  const posts = (data?.posts || []).filter((p) => !used.has(p.slug));
  const options =
    picker === "work"
      ? [...available]
          .sort((a, b) => {
            const index = (name: string) => {
              const i = preferences.works.indexOf(name);
              return i < 0 ? 999 : i;
            };
            return index(a.name) - index(b.name);
          })
          .map((w) => ({
            value: w.name,
            label: w.name,
            detail: "محفوظ في قاعدة بيانات الفريق • غير مرتبط",
            cover: true,
            recent: preferences.works.includes(w.name),
          }))
      : posts.map((p) => ({
          value: p.slug,
          label: p.postTitle,
          detail: p.slug,
          search: p.slug,
          cover: true,
          image: p.featuredImage,
        }));
  const confirm = () =>
    Alert.alert(
      "تأكيد ربط العمل",
      `سيُربط «${selected?.name.trim()}» بـ «${post?.postTitle}».\nيُستخدم غلافه وتُراجع فصوله المنشورة قبل التسجيل. لن يُنشأ عمل إضافي.`,
      [
        { text: "مراجعة الاختيار", style: "cancel" },
        {
          text: "تأكيد الربط",
          onPress: () => {
            setSaving(true);
            void execute({ action: "azoraLink", payload: { work, slug } })
              .then((message) => {
                remember(work);
                Alert.alert("تم الربط", message, [
                  {
                    text: "عرض الأعمال المرتبطة",
                    onPress: () => nav.replace("AzoraLinked"),
                  },
                ]);
                void run({ action: "sync" });
              })
              .catch((e) => Alert.alert("تعذر الربط", e.message))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  return (
    <Page>
      <View style={styles.stack}>
        <Hero
          title="اربط عملك"
          detail="خطوتان واضحتان: عمل الفريق، ثم العمل المنشور على أزورا."
          icon="link-outline"
        />
        <Status data={data} error={error} />
        <Glass gold style={styles.stack}>
          <Label style={{ color: colors.gold }}>01 · عمل الفريق</Label>
          <Row
            title={selected?.name || "اختر عملًا غير مرتبط"}
            detail={
              selected
                ? "يمكنك تغيير الاختيار"
                : "البحث يشمل أعمال MongoDB غير المرتبطة فقط"
            }
            icon="albums-outline"
            onPress={() => setPicker("work")}
          />
          {!available.length && (
            <Label dim>
              كل أعمال الفريق مرتبطة. أنشئ عملًا من لوحة الإشراف إذا أردت إضافة
              عمل يدويًا.
            </Label>
          )}
        </Glass>
        <Glass gold style={styles.stack}>
          <Label style={{ color: colors.gold }}>02 · مصدر أزورا</Label>
          <Row
            title={post?.postTitle || "ابحث في أعمال فريق أزورا"}
            detail={
              post
                ? "العمل الذي ستُستخدم صورته وفصوله"
                : "اختيار بالاسم والصورة؛ لا حاجة لكتابة السلاغ"
            }
            image={post?.featuredImage}
            icon="search-outline"
            cover
            onPress={() => setPicker("post")}
          />
          {!posts.length && (
            <Label dim>حدّث فهرس أزورا، أو راجع الأعمال المرتبطة بالفعل.</Label>
          )}
        </Glass>
        {selected && post && (
          <Glass>
            <View style={[styles.row, { gap: 18 }]}>
              <Media
                uri={post.featuredImage}
                name={post.postTitle}
                size={76}
                cover
              />
              <View style={{ flex: 1, gap: 8 }}>
                <Heading size={20}>{selected.name.trim()}</Heading>
                <Label dim>{post.postTitle}</Label>
                <Label size={11} style={{ color: colors.gold }}>
                  ربط المصدر • الاحتفاظ باسم وسجلات الفريق
                </Label>
              </View>
            </View>
          </Glass>
        )}
        <Button
          title={saving ? "جارٍ حفظ الربط…" : "تأكيد الربط"}
          icon="checkmark-circle-outline"
          disabled={!selected || !post || saving || offline}
          onPress={confirm}
        />
        <Button
          title="تحديث فهرس أزورا"
          secondary
          disabled={busy || data?.state.syncing || saving || offline}
          onPress={() => void run({ action: "sync" })}
        />
        <Label dim size={12}>
          فهرس أزورا للاختيار فقط؛ لا تظهر أعماله في قائمة الفريق إلا إذا أُنشئت
          في الفريق أو اكتُشفت جديدة بعد تفعيل الإضافة التلقائية.
        </Label>
        {picker && (
          <RegistrationSelectionSheet
            title={
              picker === "work"
                ? "أعمال الفريق غير المرتبطة"
                : "اختر العمل من أزورا"
            }
            hint={
              picker === "work"
                ? "اختر عملًا محفوظًا فعليًا؛ أحدث استخداماتك تظهر أولًا."
                : "ابحث بالاسم، واستدلّ على العمل بغلافه الحقيقي."
            }
            items={options}
            value={picker === "work" ? work : slug}
            onSelect={(value) => {
              if (picker === "work") {
                setWork(value);
                remember(value);
              } else setSlug(value);
            }}
            onClose={() => setPicker(null)}
          />
        )}
      </View>
    </Page>
  );
}
export function AzoraLinked() {
  const { snapshot: s, user, execute, offline } = useTeam(),
    nav = useNavigation<any>();
  const { data, error } = useAzora();
  const [search, setSearch] = useState(""),
    [saving, setSaving] = useState(false);
  if (!s || !user?.isAdmin) return null;
  const linked = s.works.filter((w) => w.azora?.slug),
    filtered = linked.filter((w) =>
      `${w.name} ${w.azora?.title || ""} ${w.azora?.slug}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    );
  const unlink = (name: string) =>
    Alert.alert(
      "فك ارتباط أزورا؟",
      "ستبقى كل سجلات العمل محفوظة، ويتوقف التحقق من فصول أزورا لهذا العمل.",
      [
        { text: "إبقاء الربط", style: "cancel" },
        {
          text: "فك الربط",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            void execute({ action: "azoraUnlink", payload: { work: name } })
              .then((message) => Alert.alert("تم فك الربط", message))
              .catch((e) => Alert.alert("تعذرت العملية", e.message))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  return (
    <Page>
      <View style={styles.stack}>
        <Hero
          title="الأعمال المرتبطة"
          detail={`${linked.length} عملًا من فريقك مرتبط بمصدر أزورا. الصور والفصول تخص هذه الأعمال فقط.`}
          icon="albums-outline"
        />
        <Field
          label="البحث عن عمل مرتبط"
          value={search}
          onChange={setSearch}
          placeholder="اسم العمل…"
        />
        <Status data={data} error={error} />
        {!filtered.length && (
          <Empty
            title="لا توجد أعمال بهذا الاختيار"
            detail="ابدأ بربط عمل محفوظ في الفريق، أو غيّر البحث."
          />
        )}
        {filtered.map((w) => (
          <Glass key={w.name} style={styles.stack}>
            <View style={[styles.row, { gap: 18 }]}>
              <Media
                uri={
                  w.azora?.cover ||
                  data?.posts.find((p) => p.slug === w.azora?.slug)
                    ?.featuredImage
                }
                name={w.name}
                size={74}
                cover
              />
              <View style={{ flex: 1, gap: 7 }}>
                <Heading size={20}>{w.name.trim()}</Heading>
                <Label dim size={12}>
                  {w.azora?.title || w.azora?.title_en || w.azora?.slug}
                </Label>
                <Label style={{ color: colors.gold }} size={12}>
                  {w.azora?.chapterCount !== undefined
                    ? `${w.azora.chapterCount} فصلًا منشورًا`
                    : "بانتظار تحديث الفصول"}
                  {w.azora?.latestChapter
                    ? ` · آخر فصل ${w.azora.latestChapter}`
                    : ""}
                </Label>
              </View>
            </View>
            <View style={styles.divider} />
            <Row
              title="تفاصيل العمل وأعضاء الفريق"
              icon="people-outline"
              onPress={() => nav.navigate("Detail", { work: w.name })}
            />
            <Row
              title="فتح المصدر في أزورا"
              icon="open-outline"
              onPress={() =>
                void Linking.openURL(
                  `https://azorafly.com/series/${encodeURIComponent(w.azora!.slug)}`,
                ).catch(() =>
                  Alert.alert("تعذر فتح الرابط", "حاول مجددًا لاحقًا"),
                )
              }
            />
            <Button
              title="فك الربط"
              secondary
              disabled={saving || offline}
              onPress={() => unlink(w.name)}
            />
          </Glass>
        ))}
        <Button
          title="ربط عمل آخر"
          icon="add-outline"
          onPress={() => nav.navigate("AzoraLink")}
        />
      </View>
    </Page>
  );
}
export function AzoraSettings() {
  const { user, offline } = useTeam();
  const { data, error, busy, run } = useAzora();
  const [team, setTeam] = useState<string | null>(null);
  if (!user?.isAdmin) return null;
  const save = async (body: unknown) => {
    const message = await run(body);
    if (message) Alert.alert("الإعدادات", message);
  };
  const changeTeam = () =>
    Alert.alert(
      "تغيير فريق أزورا؟",
      "سيُحفظ فهرس الفريق الجديد كقائمة أولية دون إضافة أعماله القديمة. أعمال الفريق المسجلة وسجلاتها تبقى محفوظة.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حفظ الفريق",
          onPress: () =>
            void save({
              action: "settings",
              team_slug: team ?? data?.state.team_slug,
            }),
        },
      ],
    );
  return (
    <Page>
      <View style={styles.stack}>
        <Hero
          title="المزامنة الذكية"
          detail="حافظ على أعمال فريقك، واستقبل الجديد دون استيراد أرشيف أزورا بالكامل."
          icon="sync-outline"
        />
        <Status data={data} error={error} />
        {data && (
          <>
            <Glass style={styles.stack}>
              <Heading size={18}>كيف تعمل الإضافة؟</Heading>
              <Label dim style={{ lineHeight: 27 }}>
                عند أول مزامنة، تُحفظ أعمال أزورا الحالية كمرجع فقط. بعد ذلك
                تُضاف الأعمال التي تظهر جديدة. الدفعات التي تتجاوز 10 أعمال
                تُحفظ في الفهرس دون إضافتها تلقائيًا، مثل البوت.
              </Label>
              <View style={styles.divider} />
              <Toggle
                title="تحديث أعمال أزورا"
                detail="تحديث الصور والفصول المنشورة"
                value={data.state.enabled}
                disabled={busy || offline}
                onChange={(enabled) =>
                  void save({ action: "settings", enabled })
                }
              />
              <View style={styles.divider} />
              <Toggle
                title="إضافة الأعمال الجديدة تلقائيًا"
                detail="الأعمال الجديدة بعد تثبيت القائمة، وليس الأرشيف القديم"
                value={data.state.auto_add_new_works}
                disabled={busy || offline}
                onChange={(auto_add_new_works) =>
                  void save({ action: "settings", auto_add_new_works })
                }
              />
              <Label
                size={12}
                style={{
                  color: data.state.baseline_done ? colors.green : colors.gold,
                }}
              >
                {data.state.baseline_done
                  ? "القائمة الأولية مثبتة"
                  : "بانتظار أول مزامنة كاملة لتثبيت القائمة"}
              </Label>
            </Glass>
            <Glass style={styles.stack}>
              <Heading size={18}>مصدر الفريق</Heading>
              <Field
                label="اسم الفريق في رابط أزورا"
                value={team ?? data.state.team_slug}
                onChange={setTeam}
                placeholder="cookies"
              />
              <Button
                title="حفظ فريق أزورا"
                secondary
                disabled={
                  busy ||
                  offline ||
                  data.state.syncing ||
                  !team ||
                  team === data.state.team_slug
                }
                onPress={changeTeam}
              />
            </Glass>
            <Button
              title={data.state.syncing ? "التحديث جارٍ…" : "مزامنة الآن"}
              icon="sync-outline"
              disabled={
                busy || offline || data.state.syncing || !data.state.enabled
              }
              onPress={() => void run({ action: "sync" })}
            />
          </>
        )}
      </View>
    </Page>
  );
}
function Toggle({
  title,
  detail,
  value,
  disabled,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.row, { gap: 18 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Label>{title}</Label>
        <Label dim size={11}>
          {detail}
        </Label>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: "#393B47", true: "#75633F" }}
        thumbColor={value ? colors.gold : "#BBB"}
      />
    </View>
  );
}
const design = StyleSheet.create({
  hero: {
    borderRadius: 30,
    padding: 26,
    gap: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.25)",
  },
  crest: {
    alignSelf: "flex-end",
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: "rgba(232,199,124,.08)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  orbit: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.09)",
    left: -110,
    top: -70,
  },
});
