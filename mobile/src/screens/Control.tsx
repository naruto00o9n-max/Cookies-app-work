import { useScreenGuide } from "../lib/use-guide";
import { isFinancialEntry } from "../lib/finance";
import { GlassDialogHost } from "../components/GlassDialogHost";
import { RegistrationSelectionSheet } from "../components/RegistrationSelectionSheet";
import { useRegistrationPreferences } from "../lib/use-registration-preferences";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeam } from "../lib/context";
import { Alert } from "../lib/alerts";
import { allowedSpecialties, totalOf, visibleEntries } from "../lib/domain";
import { pickBackup, shareFile } from "../lib/files";
import type { Entry, Member, Snapshot } from "../lib/types";
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

type IconName = React.ComponentProps<typeof Icon>["name"];
type AdminMember = Member & {
  username?: string;
  nickname?: string;
  globalName?: string;
  title?: string;
  blocked?: boolean;
  isAdmin?: boolean;
  appRegistered?: boolean;
  firstLoginAt?: string;
  lastLoginAt?: string;
  joinedAt?: string;
};
type AdminData = {
  members?: AdminMember[];
  configuration?: {
    discordSyncConfigured: boolean;
    cronConfigured: boolean;
    pushConfigured: boolean;
    databaseConfigured: boolean;
    registeredDevices?: number;
  };
  discordSync?: {
    lastSyncAt?: string;
    synced?: number;
    error?: string;
    running?: boolean;
  };
};
const sections: {
  key: string;
  name: string;
  description: string;
  icon: IconName;
  color: string;
}[] = [
  {
    key: "members",
    name: "الأعضاء",
    description: "المسجلون الجدد، ملفاتهم وألقابهم",
    icon: "people-outline",
    color: "#A5BCED",
  },
  {
    key: "works",
    name: "الأعمال",
    description: "الصور والربط والأسعار والعزل",
    icon: "library-outline",
    color: "#E8C77C",
  },
  {
    key: "records",
    name: "سجلات الفصول",
    description: "من عمل ماذا؟ تعديل ومراجعة دقيقة",
    icon: "documents-outline",
    color: "#BEADE8",
  },
  {
    key: "finance",
    name: "المالية",
    description: "المستحقات والمكافآت والخصومات",
    icon: "wallet-outline",
    color: "#9DD3AE",
  },
  {
    key: "prices",
    name: "التخصصات والأسعار",
    description: "الأسعار العامة والخاصة لكل عمل",
    icon: "pricetags-outline",
    color: "#EDB99A",
  },
  {
    key: "archives",
    name: "الشهور والأرشيف",
    description: "تنظيم الشهور والتنقل بينها",
    icon: "calendar-outline",
    color: "#A5BCED",
  },
  {
    key: "integrations",
    name: "ربط الفريق",
    description: "ديسكورد، أزورا والإشعارات",
    icon: "git-network-outline",
    color: "#BEADE8",
  },
  {
    key: "data",
    name: "البيانات والحماية",
    description: "النسخ الاحتياطية وسجل الإدارة",
    icon: "shield-checkmark-outline",
    color: "#E8C77C",
  },
  {
    key: "settings",
    name: "إعدادات المساحة",
    description: "العملة ومواعيد الدفع وحالة الخدمة",
    icon: "options-outline",
    color: "#9DD3AE",
  },
];
const dateLabel = (date?: string) =>
  date && Number.isFinite(Date.parse(date))
    ? new Date(date).toLocaleDateString("ar", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "غير مسجل بعد";
const money = (s: Snapshot, value: number) =>
  `${s.settings.currency}${value.toFixed(3)}`;
const match = (text: string, query: string) =>
  text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

function useAdminData() {
  const { user, call } = useTeam();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reload = async () => {
    if (!user?.isAdmin) return;
    setLoading(true);
    try {
      setData(await call<AdminData>("/api/mobile/admin"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث معلومات الإدارة");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    if (!user?.isAdmin) return;
    setLoading(true);
    call<AdminData>("/api/mobile/admin")
      .then((value) => {
        if (active) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "تعذر تحديث معلومات الإدارة",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.isAdmin]);
  return { data, loading, error, reload };
}

function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={local.search}>
      <Icon name="search-outline" size={21} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        style={local.searchInput}
      />
      {!!value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="مسح البحث"
          onPress={() => onChange("")}
          hitSlop={12}
        >
          <Icon name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function Stat({
  value,
  label,
  color = colors.gold,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <View style={local.stat}>
      <Label
        size={typeof value === "string" && value.length > 6 ? 16 : 24}
        style={{ color, fontFamily: "Cairo_700Bold" }}
      >
        {value}
      </Label>
      <Label dim size={11}>
        {label}
      </Label>
    </View>
  );
}

function Status({
  title,
  ready,
  detail,
  readyText = "الإعداد موجود",
}: {
  title: string;
  ready?: boolean;
  detail?: string;
  readyText?: string;
}) {
  return (
    <View style={[styles.row, { gap: 12, paddingVertical: 12 }]}>
      <View
        style={[
          local.statusDot,
          {
            backgroundColor:
              ready === undefined
                ? colors.muted
                : ready
                  ? colors.green
                  : colors.gold,
          },
        ]}
      />
      <View style={{ flex: 1 }}>
        <Label>{title}</Label>
        {detail && (
          <Label dim size={11}>
            {detail}
          </Label>
        )}
      </View>
      <Label size={11} style={{ color: ready ? colors.green : colors.gold }}>
        {ready === undefined
          ? "جارٍ الفحص"
          : ready
            ? readyText
            : "يحتاج إعدادًا"}
      </Label>
    </View>
  );
}

function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <View
      style={[local.notice, danger && { borderColor: "rgba(234,151,151,.25)" }]}
    >
      <Icon
        name={danger ? "alert-circle-outline" : "information-circle-outline"}
        size={20}
        color={danger ? colors.red : colors.gold}
      />
      <Label dim size={12} style={{ flex: 1 }}>
        {text}
      </Label>
    </View>
  );
}

function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <GlassDialogHost active={visible} root={false}>
        <KeyboardAvoidingView
          style={local.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="إغلاق النافذة"
            onPress={onClose}
          />
          <View
            style={[
              local.sheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View
              style={[
                styles.row,
                { justifyContent: "space-between", marginBottom: 18 },
              ]}
            >
              <Heading size={21}>{title}</Heading>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                onPress={onClose}
                hitSlop={14}
              >
                <Icon name="close-outline" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </GlassDialogHost>
    </Modal>
  );
}

function Picker({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { snapshot, user } = useTeam();
  const { preferences, remember } = useRegistrationPreferences(user?.id || "");
  const workPicker = label.includes("العمل");
  const options = items.map((item) => {
    const work = workPicker
      ? snapshot?.works.find((w) => w.name === item.value)
      : undefined;
    const member = !workPicker
      ? snapshot?.members.find((m) => m.id === item.value)
      : undefined;
    return {
      ...item,
      image: work?.azora?.cover || member?.avatar,
      cover: !!work,
      recent: !!work && preferences.works.includes(work.name),
    };
  });
  if (workPicker)
    options.sort((a, b) => {
      const rank = (v: string) => {
        if (!v) return -1;
        const i = preferences.works.indexOf(v);
        return i < 0 ? 999 : i;
      };
      return rank(a.value) - rank(b.value);
    });
  const selected = options.find((item) => item.value === value);
  return (
    <View style={{ gap: 8 }}>
      <Label dim>{label}</Label>
      <Row
        title={selected?.label || "اختر…"}
        image={selected?.image}
        cover={selected?.cover}
        icon={workPicker ? "albums-outline" : "search-outline"}
        onPress={() => setExpanded(true)}
      />
      {expanded && (
        <RegistrationSelectionSheet
          title={label}
          hint="ابحث بالاسم ثم اختر من القائمة."
          items={options}
          value={value}
          onSelect={(next) => {
            onChange(next);
            if (workPicker && next) remember(next);
          }}
          onClose={() => setExpanded(false)}
        />
      )}
    </View>
  );
}

function MemberCard({
  member,
  snapshot,
  onPress,
  onManage,
}: {
  member: AdminMember;
  snapshot: Snapshot;
  onPress: () => void;
  onManage?: () => void;
}) {
  const t = totalOf(visibleEntries(snapshot, member.id));
  return (
    <Glass style={{ padding: 17 }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.row, { gap: 13 }]}
      >
        <Media uri={member.avatar} name={member.name} size={51} />
        <View style={{ flex: 1, gap: 3 }}>
          <Label size={15} style={{ fontFamily: "Cairo_700Bold" }}>
            {member.name}
          </Label>
          <Label dim size={11}>
            {member.title ||
              (member.isAdmin
                ? "مشرف الفريق"
                : member.appRegistered
                  ? "عضو مسجل بالتطبيق"
                  : "عضو الفريق")}
          </Label>
        </View>
        <Icon name="chevron-back" size={18} color={colors.muted} />
      </Pressable>
      <View style={[styles.row, { gap: 8, marginTop: 15 }]}>
        <View style={local.memberMetric}>
          <Label size={15} style={{ color: colors.gold }}>
            {money(snapshot, t.amount)}
          </Label>
          <Label dim size={10}>
            صافي الشهر
          </Label>
        </View>
        <View style={local.memberMetric}>
          <Label size={15}>{t.chapters}</Label>
          <Label dim size={10}>
            مساهمة فصل
          </Label>
        </View>
        <View style={local.memberMetric}>
          <Label size={15}>{t.works}</Label>
          <Label dim size={10}>
            أعمال
          </Label>
        </View>
      </View>
      {(member.firstLoginAt || member.blocked || onManage) && (
        <View
          style={[
            styles.row,
            { justifyContent: "space-between", marginTop: 14, gap: 8 },
          ]}
        >
          <Label dim size={10} style={{ flex: 1 }}>
            {member.blocked
              ? "الوصول إلى التطبيق موقوف"
              : member.firstLoginAt
                ? `التسجيل: ${dateLabel(member.firstLoginAt)}`
                : "لم يُسجل دخوله إلى التطبيق بعد"}
          </Label>
          {onManage && (
            <Pressable
              accessibilityRole="button"
              onPress={onManage}
              style={local.smallButton}
            >
              <Icon name="options-outline" size={16} />
              <Label size={11}>إدارة</Label>
            </Pressable>
          )}
        </View>
      )}
    </Glass>
  );
}

export function Control() {
  const { snapshot: s, user, offline, refresh } = useTeam();
  const nav = useNavigation<any>();
  const { data, loading, error, reload } = useAdminData();
  const [query, setQuery] = useState("");
  if (!s || !user) return null;
  if (!user.isAdmin)
    return (
      <Page>
        <Empty
          title="لوحة التحكم للمشرفين"
          detail="يمكنك متابعة أعمالك وملفك من أقسام التطبيق."
        />
      </Page>
    );
  const members = data?.members || (s.members as AdminMember[]);
  const registered = members.filter((member) => member.appRegistered);
  const newMembers = registered
    .filter(
      (member) =>
        member.firstLoginAt &&
        Date.parse(member.firstLoginAt) >= Date.now() - 7 * 86400000,
    )
    .sort((a, b) => (b.firstLoginAt || "").localeCompare(a.firstLoginAt || ""));
  const totals = totalOf(visibleEntries(s));
  const go = (section: string) => nav.navigate("ControlSection", { section });
  return (
    <Page
      onRefresh={() => {
        void refresh();
        void reload();
      }}
      refreshing={loading}
    >
      <View style={styles.stack}>
        <LinearGradient
          colors={["#302817", "#1B1B22", "#11131D"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={local.hero}
        >
          <View pointerEvents="none" style={local.orbit} />
          <View style={[styles.row, { gap: 14 }]}>
            <View style={local.heroIcon}>
              <Icon name="shield-checkmark" size={30} />
            </View>
            <View style={{ flex: 1 }}>
              <Label size={11} style={{ color: colors.gold, letterSpacing: 1 }}>
                COOKIES · CONTROL ROOM
              </Label>
              <Heading size={26}>كل الفريق أمامك</Heading>
            </View>
          </View>
          <Label dim size={12} style={{ marginTop: 13 }}>
            أهلًا {user.name}. تابع الفريق، نظّم الأعمال، وراجع كل فصل من مكان
            واحد.
          </Label>
          <View style={[styles.row, { gap: 9, marginTop: 20 }]}>
            <Stat value={s.members.length} label="أعضاء الفريق" />
            <Stat
              value={s.works.filter((work) => !work.isolated).length}
              label="أعمال متاحة"
            />
            <Stat value={totals.chapters} label="مساهمات الشهر" />
          </View>
        </LinearGradient>
        {offline && (
          <Notice text="أنت تعرض آخر نسخة محفوظة. اتصل بالإنترنت لإدارة بيانات الفريق." />
        )}
        <Glass gold style={{ padding: 18 }}>
          <Row
            title="صافي مستحقات الفريق"
            detail={
              s.months.find((month) => month.key === s.settings.active_month)
                ?.name || s.settings.active_month
            }
            icon="wallet-outline"
            right={money(s, totals.amount)}
            onPress={() => go("finance")}
          />
        </Glass>
        <Search
          value={query}
          onChange={setQuery}
          placeholder="ابحث عن القسم الذي تحتاجه…"
        />
        <View style={local.grid}>
          {sections
            .filter((section) =>
              match(`${section.name} ${section.description}`, query),
            )
            .map((section) => (
              <Pressable
                key={section.key}
                accessibilityRole="button"
                accessibilityLabel={section.name}
                style={({ pressed }) => [
                  local.tile,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                onPress={() => go(section.key)}
              >
                <View
                  style={[
                    local.tileIcon,
                    { backgroundColor: `${section.color}14` },
                  ]}
                >
                  <Icon name={section.icon} color={section.color} size={25} />
                </View>
                <Label
                  size={14}
                  style={{ fontFamily: "Cairo_700Bold", marginTop: 14 }}
                >
                  {section.name}
                </Label>
                <Label dim size={10}>
                  {section.description}
                </Label>
              </Pressable>
            ))}
        </View>
        <Section
          title="المسجلون الجدد"
          action="جميع الأعضاء"
          onPress={() =>
            nav.navigate("ControlSection", {
              section: "members",
              filter: "registered",
            })
          }
        />
        {loading && !data ? (
          <ActivityIndicator color={colors.gold} />
        ) : error && !data ? (
          <Notice text={error} danger />
        ) : newMembers.length ? (
          newMembers
            .slice(0, 3)
            .map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                snapshot={s}
                onPress={() => nav.navigate("Detail", { member: member.id })}
              />
            ))
        ) : (
          <Glass>
            <Label dim size={12}>
              لا يوجد تسجيل جديد في آخر 7 أيام.
            </Label>
            {registered.length > 0 && (
              <Label size={11} style={{ color: colors.gold }}>
                {registered.length} عضوًا سجّل دخوله إلى التطبيق
              </Label>
            )}
          </Glass>
        )}
        <Section
          title="حالة مساحة الفريق"
          action="التفاصيل"
          onPress={() => go("integrations")}
        />
        <Glass style={{ paddingVertical: 8 }}>
          <Status
            title="صور الأعضاء وأسماء السيرفر"
            ready={data?.configuration?.discordSyncConfigured}
          />
          <View style={styles.divider} />
          <Status
            title="إعداد المهام الدورية"
            ready={data?.configuration?.cronConfigured}
          />
          <View style={styles.divider} />
          <Status
            title="الأجهزة المرتبطة بالإشعارات"
            ready={data?.configuration?.pushConfigured}
          />
        </Glass>
        <Button
          secondary
          title="مراجعة آخر عمليات الإدارة"
          icon="time-outline"
          onPress={() => nav.navigate("Audit")}
        />
      </View>
    </Page>
  );
}

export function ControlSection({ route }: { route: any }) {
  const { snapshot: s, user, execute, offline, call, refresh } = useTeam();
  const nav = useNavigation<any>();
  const { data, loading, error, reload } = useAdminData();
  const section = String(route.params?.section || "members");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(String(route.params?.filter || "all"));
  const [month, setMonth] = useState(
    String(route.params?.month ?? s?.settings.active_month ?? ""),
  );
  const [recordMember, setRecordMember] = useState("");
  const [recordWork, setRecordWork] = useState("");
  const [recordType, setRecordType] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [limit, setLimit] = useState(40);
  const [busy, setBusy] = useState(false);
  const [managedMember, setManagedMember] = useState<AdminMember | null>(null);
  const [title, setTitle] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [editedRecord, setEditedRecord] = useState<Entry | null>(null);
  const focused = useIsFocused();
  useScreenGuide("edit-record", focused && Boolean(editedRecord));
  useScreenGuide("member-manage", focused && Boolean(managedMember));
  const [edit, setEdit] = useState({
    userId: "",
    work: "",
    chapter: "",
    types: "",
    notes: "",
  });
  const members = useMemo<AdminMember[]>(() => {
    const byId = new Map(
      (s?.members || []).map((member) => [member.id, member as AdminMember]),
    );
    data?.members?.forEach((member) =>
      byId.set(member.id, { ...byId.get(member.id), ...member }),
    );
    return [...byId.values()];
  }, [s?.members, data?.members]);
  const allRecords = useMemo(
    () =>
      (s?.records || [])
        .filter(
          (entry) =>
            !isFinancialEntry(entry) &&
            (!month || entry.month_key === month) &&
            (!recordMember || entry.userId === recordMember) &&
            (!recordWork || entry.work_name === recordWork) &&
            (!recordType || entry.work_type === recordType) &&
            match(
              `${entry.work_name} ${entry.chapter} ${members.find((member) => member.id === entry.userId)?.name || entry.username} ${entry.work_type.replace(/_/g, " ")} ${entry.notes}`,
              query,
            ),
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [s?.records, month, recordMember, recordWork, recordType, query, members],
  );
  useEffect(() => {
    setLimit(40);
  }, [query, month, recordMember, recordWork, recordType, filter]);
  useEffect(() => {
    if (route.params?.month) setMonth(String(route.params.month));
  }, [route.params?.month]);
  useEffect(() => {
    if (!route.params?.member || !data?.members) return;
    const target = data.members.find(
      (member) => member.id === route.params.member,
    );
    if (!target) return;
    setManagedMember(target);
    setTitle(target.title || "");
    setBlocked(target.blocked || false);
    nav.setParams({ member: undefined });
  }, [route.params?.member, data?.members]);
  if (!s || !user) return null;
  if (!user.isAdmin)
    return (
      <Page>
        <Empty
          title="هذه الصفحة للمشرفين"
          detail="تسجيل الدخول بمشرف الفريق مطلوب لإدارة البيانات."
        />
      </Page>
    );
  const sectionInfo =
    sections.find((item) => item.key === section) || sections[0];
  const memberItems = members.map((member) => ({
    label: member.name,
    value: member.id,
  }));
  const workItems = s.works.map((work) => ({
    label: work.name,
    value: work.name,
  }));
  const totals = totalOf(visibleEntries(s));
  const openMember = (member: AdminMember) => {
    setManagedMember(member);
    setTitle(member.title || "");
    setBlocked(member.blocked || false);
  };
  const openRecord = (entry: Entry) => {
    setEditedRecord(entry);
    setEdit({
      userId: entry.userId,
      work: entry.work_name,
      chapter: entry.chapter,
      types: entry.work_type,
      notes: entry.notes,
    });
  };
  const run = async (work: () => Promise<unknown>, success?: string) => {
    if (busy) return;
    if (offline) {
      Alert.alert("يلزم الاتصال", "اتصل بالإنترنت لحفظ التغييرات.");
      return;
    }
    setBusy(true);
    try {
      await work();
      if (success) Alert.alert("تمت العملية", success);
    } catch (e) {
      Alert.alert(
        "تعذر إكمال العملية",
        e instanceof Error ? e.message : "حاول مجددًا",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveMember = () => {
    if (!managedMember) return;
    const save = () =>
      void run(async () => {
        await call("/api/mobile/admin", {
          action: "member",
          userId: managedMember.id,
          title: title.trim(),
          blocked,
        });
        await Promise.all([reload(), refresh()]);
        setManagedMember(null);
      }, "تم تحديث ملف العضو.");
    if (blocked !== Boolean(managedMember.blocked))
      Alert.alert(
        blocked ? "إيقاف وصول العضو؟" : "إعادة وصول العضو؟",
        blocked
          ? "لن يتمكن العضو من استخدام بيانات الفريق في التطبيق. تبقى سجلاته ومستحقاته محفوظة."
          : "سيتمكن العضو من الدخول إلى التطبيق مجددًا.",
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تأكيد",
            style: blocked ? "destructive" : "default",
            onPress: save,
          },
        ],
      );
    else save();
  };
  const deleteRecord = (entry: Entry) =>
    Alert.alert(
      "حذف السجل؟",
      `${members.find((member) => member.id === entry.userId)?.name || entry.username}\n${entry.work_name} · ${entry.work_type.replace(/_/g, " ")}${entry.chapter !== "-" ? ` · الفصل ${entry.chapter}` : ""}\nسيُحذف هذا السجل ويتغير صافي المستحقات.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف السجل",
          style: "destructive",
          onPress: () =>
            void run(
              () =>
                execute({ action: "deleteRecord", payload: { id: entry.id } }),
              "تم حذف السجل المحدد.",
            ),
        },
      ],
    );
  const backup = () => {
    void shareFile(
      `cookies-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(s, null, 2),
      "application/json",
    ).catch((e) =>
      Alert.alert(
        "تعذر تصدير النسخة",
        e instanceof Error ? e.message : "حاول مجددًا",
      ),
    );
  };
  const restore = () =>
    void run(async () => {
      const next = await pickBackup();
      if (!next) return;
      Alert.alert(
        "استعادة نسخة الفريق؟",
        `هذه النسخة تضم ${next.members.length} عضوًا و${next.works.length} عملًا و${next.records.length} سجلًا.\nستستبدل بيانات الفريق الحالية. صدّر نسخة منها أولًا.`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "استعادة البيانات",
            style: "destructive",
            onPress: () =>
              void run(
                () =>
                  execute({ action: "import", payload: { snapshot: next } }),
                "تم استعادة نسخة الفريق.",
              ),
          },
        ],
      );
    });
  const renderRecord = (entry: Entry) => {
    const member = members.find((item) => item.id === entry.userId);
    const work = s.works.find((item) => item.name === entry.work_name);
    const adjustmentEntry = ["مكافأة", "خصم"].includes(entry.work_type);
    return (
      <Glass key={entry.id} style={{ padding: 16 }}>
        <View style={[styles.row, { gap: 12 }]}>
          <Media
            uri={member?.avatar}
            name={member?.name || entry.username}
            size={40}
          />
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.navigate("Detail", { member: entry.userId })}
            >
              <Label size={13} style={{ fontFamily: "Cairo_700Bold" }}>
                {member?.name || entry.username}
              </Label>
            </Pressable>
            <Label dim size={10}>
              {dateLabel(entry.timestamp)} ·{" "}
              {s.months.find((item) => item.key === entry.month_key)?.name ||
                entry.month_key}
            </Label>
          </View>
          <Label
            size={13}
            style={{ color: entry.total < 0 ? colors.red : colors.gold }}
          >
            {money(s, entry.total)}
          </Label>
        </View>
        <View style={[styles.row, { gap: 12, marginTop: 14 }]}>
          {!adjustmentEntry && (
            <Media
              uri={work?.azora?.cover}
              name={entry.work_name}
              size={36}
              cover
            />
          )}
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityRole={!adjustmentEntry ? "button" : undefined}
              onPress={
                !adjustmentEntry
                  ? () => nav.navigate("Detail", { work: entry.work_name })
                  : undefined
              }
            >
              <Label size={14}>
                {adjustmentEntry ? "حركة مالية" : entry.work_name}
              </Label>
            </Pressable>
            <Label size={12} style={{ color: colors.gold }}>
              {adjustmentEntry
                ? entry.work_type
                : `الفصل ${entry.chapter} · ${entry.work_type.replace(/_/g, " ")}`}
            </Label>
          </View>
        </View>
        {!!entry.notes && (
          <Label dim size={11} style={{ marginTop: 10 }}>
            {entry.notes}
          </Label>
        )}
        <View
          style={[
            styles.row,
            { gap: 10, marginTop: 14, justifyContent: "flex-end" },
          ]}
        >
          {!adjustmentEntry && (
            <Pressable
              accessibilityRole="button"
              disabled={offline || busy}
              onPress={() => openRecord(entry)}
              style={[
                local.smallButton,
                (offline || busy) && { opacity: 0.45 },
              ]}
            >
              <Icon name="create-outline" size={16} />
              <Label size={11}>تعديل هذا السجل</Label>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={offline || busy}
            onPress={() => deleteRecord(entry)}
            style={[local.smallButton, (offline || busy) && { opacity: 0.45 }]}
          >
            <Icon name="trash-outline" color={colors.red} size={16} />
            <Label size={11} style={{ color: colors.red }}>
              حذف
            </Label>
          </Pressable>
        </View>
      </Glass>
    );
  };
  return (
    <>
      <Page
        onRefresh={() => {
          void reload();
          void refresh();
        }}
        refreshing={loading}
      >
        <View style={styles.stack}>
          <View style={[styles.row, { gap: 14 }]}>
            <View
              style={[
                local.tileIcon,
                { backgroundColor: `${sectionInfo.color}14` },
              ]}
            >
              <Icon
                name={sectionInfo.icon}
                size={27}
                color={sectionInfo.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Heading size={25}>{sectionInfo.name}</Heading>
              <Label dim size={11}>
                {sectionInfo.description}
              </Label>
            </View>
          </View>
          {offline && (
            <Notice text="نسخة محفوظة. الإدارة والحفظ متاحان عند عودة الاتصال." />
          )}
          {error &&
            ["members", "integrations", "settings"].includes(section) && (
              <Notice text={error} danger />
            )}

          {section === "members" && (
            <>
              <Search
                value={query}
                onChange={setQuery}
                placeholder="اسم العضو، لقبه أو اسم ديسكورد…"
              />
              <Chips
                value={filter}
                onSelect={setFilter}
                items={[
                  { label: `الجميع · ${members.length}`, value: "all" },
                  { label: "مسجلون بالتطبيق", value: "registered" },
                  { label: "جدد · آخر 7 أيام", value: "new" },
                  { label: "مشرفون", value: "admins" },
                  { label: "وصول موقوف", value: "blocked" },
                ]}
              />
              <Notice text="اضغط على العضو لمشاهدة مستحقاته وأعماله والفصول التي أنجزها في كل تخصص. زر إدارة يغيّر لقبه أو وصوله للتطبيق." />
              {(() => {
                const filtered = members
                  .filter(
                    (member) =>
                      match(
                        `${member.name} ${member.title || ""} ${member.username || ""} ${member.nickname || ""}`,
                        query,
                      ) &&
                      (filter !== "registered" || member.appRegistered) &&
                      (filter !== "new" ||
                        (member.firstLoginAt &&
                          Date.parse(member.firstLoginAt) >=
                            Date.now() - 7 * 86400000)) &&
                      (filter !== "admins" || member.isAdmin) &&
                      (filter !== "blocked" || member.blocked),
                  )
                  .sort((a, b) =>
                    filter === "new" || filter === "registered"
                      ? (b.firstLoginAt || "").localeCompare(
                          a.firstLoginAt || "",
                        )
                      : a.name.localeCompare(b.name, "ar"),
                  );
                return (
                  <>
                    {loading && !data && (
                      <ActivityIndicator color={colors.gold} />
                    )}
                    {filtered.slice(0, limit).map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        snapshot={s}
                        onPress={() =>
                          nav.navigate("Detail", { member: member.id })
                        }
                        onManage={() => openMember(member)}
                      />
                    ))}
                    {filtered.length > limit && (
                      <Button
                        secondary
                        title={`عرض المزيد · ${filtered.length - limit} عضوًا`}
                        onPress={() => setLimit(limit + 40)}
                      />
                    )}
                    {!filtered.length && (
                      <Empty
                        title="لا يوجد أعضاء بهذا البحث"
                        detail="جرّب تغيير الاسم أو الفلتر."
                      />
                    )}
                  </>
                );
              })()}
            </>
          )}

          {section === "works" && (
            <>
              <Button
                title="إضافة عمل جديد"
                icon="add-outline"
                onPress={() => nav.navigate("AdminForm", { kind: "addWork" })}
                disabled={offline}
              />
              <Search
                value={query}
                onChange={setQuery}
                placeholder="ابحث باسم العمل…"
              />
              <Chips
                value={filter}
                onSelect={setFilter}
                items={[
                  { label: "جميع الأعمال", value: "all" },
                  { label: "متاحة للتسجيل", value: "active" },
                  { label: "معزولة", value: "isolated" },
                  { label: "تحتاج ربط أزورا", value: "unlinked" },
                  { label: "أسعار خاصة", value: "custom" },
                ]}
              />
              {s.works
                .filter(
                  (work) =>
                    match(work.name, query) &&
                    (filter !== "active" ||
                      (!work.isolated && work.active !== false)) &&
                    (filter !== "isolated" || work.isolated) &&
                    (filter !== "unlinked" || !work.azora) &&
                    (filter !== "custom" || work.custom_prices),
                )
                .map((work) => {
                  const records = s.records.filter(
                    (entry) =>
                      entry.work_name === work.name &&
                      !["مكافأة", "خصم"].includes(entry.work_type),
                  );
                  return (
                    <Glass key={work.name} style={{ padding: 17 }}>
                      <Pressable
                        style={[styles.row, { gap: 16 }]}
                        accessibilityRole="button"
                        onPress={() =>
                          nav.navigate("Detail", { work: work.name })
                        }
                      >
                        <Media
                          uri={work.azora?.cover}
                          name={work.name}
                          size={55}
                          cover
                        />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Heading size={18}>{work.name}</Heading>
                          <Label dim size={11}>
                            {new Set(records.map((entry) => entry.userId)).size}{" "}
                            أعضاء · {records.length} مساهمة فصل
                          </Label>
                          <Label
                            size={11}
                            style={{
                              color: work.isolated ? colors.red : colors.green,
                            }}
                          >
                            {work.isolated
                              ? "معزول · محفوظ خارج المستحقات"
                              : work.active === false
                                ? "التسجيل متوقف"
                                : "متاح للتسجيل"}
                          </Label>
                          {work.azora && (
                            <Label dim size={10}>
                              {work.azora.latestChapter
                                ? `آخر فصل منشور: ${work.azora.latestChapter}`
                                : "مرتبط بأزورا"}
                            </Label>
                          )}
                        </View>
                        <Icon name="chevron-back" size={17} />
                      </Pressable>
                      <View style={local.workActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={offline || busy}
                          style={[
                            local.smallButton,
                            (offline || busy) && { opacity: 0.45 },
                          ]}
                          onPress={() =>
                            Alert.alert(
                              work.active === false
                                ? "إتاحة التسجيل في العمل؟"
                                : "إيقاف التسجيل الجديد؟",
                              `${work.name}\n${work.active === false ? "سيتمكن أعضاء الفريق من تسجيل فصول جديدة في هذا العمل." : "ستبقى السجلات والمستحقات الحالية محفوظة، ويتوقف تسجيل فصول جديدة."}`,
                              [
                                { text: "إلغاء", style: "cancel" },
                                {
                                  text: "تأكيد",
                                  onPress: () =>
                                    void run(
                                      () =>
                                        execute({
                                          action: "editWork",
                                          payload: {
                                            name: work.name,
                                            active: work.active === false,
                                          },
                                        }),
                                      "تم تحديث إتاحة التسجيل في العمل.",
                                    ),
                                },
                              ],
                            )
                          }
                        >
                          <Icon
                            name={
                              work.active === false
                                ? "play-outline"
                                : "pause-outline"
                            }
                            size={16}
                          />
                          <Label size={11}>
                            {work.active === false
                              ? "إتاحة التسجيل"
                              : "إيقاف التسجيل"}
                          </Label>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={local.smallButton}
                          onPress={() =>
                            nav.navigate("AdminForm", {
                              kind: "editWork",
                              work: work.name,
                            })
                          }
                        >
                          <Icon name="create-outline" size={16} />
                          <Label size={11}>إدارة العمل</Label>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={local.smallButton}
                          onPress={() =>
                            nav.navigate("ControlSection", {
                              section: "prices",
                              work: work.name,
                            })
                          }
                        >
                          <Icon name="pricetags-outline" size={16} />
                          <Label size={11}>الأسعار</Label>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={local.smallButton}
                          onPress={() =>
                            nav.navigate("AdminForm", {
                              kind: "isolate",
                              work: work.name,
                              isolated: !work.isolated,
                            })
                          }
                        >
                          <Icon
                            name={
                              work.isolated
                                ? "refresh-outline"
                                : "lock-closed-outline"
                            }
                            size={16}
                          />
                          <Label size={11}>
                            {work.isolated ? "استرجاع" : "عزل"}
                          </Label>
                        </Pressable>
                      </View>
                      {!work.azora && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            nav.navigate("Azora", { work: work.name })
                          }
                          style={{ paddingTop: 12 }}
                        >
                          <Label size={12} style={{ color: colors.gold }}>
                            ربط صورة العمل وفصوله من أزورا ←
                          </Label>
                        </Pressable>
                      )}
                    </Glass>
                  );
                })}
              {!s.works.length && (
                <Empty
                  title="ابدأ بإضافة أول عمل"
                  detail="أضف الاسم ثم اربطه بأزورا لجلب الغلاف ومتابعة الفصول."
                />
              )}
              <Button
                title="إدارة ربط الأعمال بأزورا"
                secondary
                icon="planet-outline"
                onPress={() => nav.navigate("Azora")}
              />
            </>
          )}

          {section === "records" && (
            <>
              <Search
                value={query}
                onChange={setQuery}
                placeholder="ابحث بعضو، عمل، فصل أو ملاحظة…"
              />
              <Chips
                value={month}
                onSelect={setMonth}
                items={[
                  { label: "كل الشهور", value: "" },
                  ...[...s.months]
                    .sort((a, b) => b.key.localeCompare(a.key))
                    .map((item) => ({ label: item.name, value: item.key })),
                ]}
              />
              <Button
                title={
                  advanced
                    ? "إغلاق الفلاتر التفصيلية"
                    : "فلترة بعضو أو عمل أو تخصص"
                }
                secondary
                icon="filter-outline"
                onPress={() => setAdvanced(!advanced)}
              />
              {advanced && (
                <Glass style={{ gap: 14 }}>
                  <Picker
                    label="العضو"
                    value={recordMember}
                    items={[{ label: "كل الأعضاء", value: "" }, ...memberItems]}
                    onChange={setRecordMember}
                  />
                  <Picker
                    label="العمل"
                    value={recordWork}
                    items={[{ label: "كل الأعمال", value: "" }, ...workItems]}
                    onChange={setRecordWork}
                  />
                  <Picker
                    label="التخصص"
                    value={recordType}
                    items={[
                      { label: "كل التخصصات", value: "" },
                      ...[
                        ...new Set(
                          s.records
                            .filter((entry) => !isFinancialEntry(entry))
                            .map((entry) => entry.work_type),
                        ),
                      ].map((type) => ({
                        label: type.replace(/_/g, " "),
                        value: type,
                      })),
                    ]}
                    onChange={setRecordType}
                  />
                </Glass>
              )}
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Label dim size={12}>
                  {allRecords.length} سجل مطابق
                </Label>
                {(recordMember || recordWork || recordType) && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setRecordMember("");
                      setRecordWork("");
                      setRecordType("");
                    }}
                  >
                    <Label size={11} style={{ color: colors.gold }}>
                      مسح الفلاتر
                    </Label>
                  </Pressable>
                )}
              </View>
              {allRecords.slice(0, limit).map(renderRecord)}
              {allRecords.length > limit && (
                <Button
                  secondary
                  title={`عرض ${Math.min(40, allRecords.length - limit)} سجلًا إضافيًا`}
                  onPress={() => setLimit(limit + 40)}
                />
              )}
              {!allRecords.length && (
                <Empty
                  title="لا توجد سجلات مطابقة"
                  detail="غيّر الشهر أو الفلاتر لإظهار سجلات أخرى."
                />
              )}
            </>
          )}

          {section === "finance" && (
            <>
              <Glass gold>
                <Label dim>
                  صافي المستحقات ·{" "}
                  {s.months.find((item) => item.key === s.settings.active_month)
                    ?.name || s.settings.active_month}
                </Label>
                <Heading size={36}>{money(s, totals.amount)}</Heading>
                <View style={[styles.row, { gap: 12, marginTop: 15 }]}>
                  <Stat
                    value={money(s, totals.bonuses)}
                    label="مكافآت"
                    color={colors.green}
                  />
                  <Stat
                    value={money(s, totals.deductions)}
                    label="خصومات"
                    color={colors.red}
                  />
                </View>
              </Glass>
              <Button
                title="إضافة مكافأة أو خصم لعضو"
                icon="gift-outline"
                onPress={() => nav.navigate("Adjustment")}
                disabled={offline}
              />
              <Button
                title="تقرير الدفع وتصدير Excel"
                secondary
                icon="document-text-outline"
                onPress={() => nav.navigate("Reports", { payment: true })}
              />
              <Search
                value={query}
                onChange={setQuery}
                placeholder="ابحث عن مستحقات عضو…"
              />
              {members
                .filter((member) => match(member.name, query))
                .map((member) => ({
                  member,
                  totals: totalOf(visibleEntries(s, member.id)),
                }))
                .sort((a, b) => b.totals.amount - a.totals.amount)
                .map(({ member, totals: memberTotals }) => (
                  <Glass key={member.id} style={{ paddingVertical: 8 }}>
                    <Row
                      title={member.name}
                      image={member.avatar}
                      detail={`${memberTotals.chapters} مساهمة فصل · ${memberTotals.works} أعمال · مكافآت ${money(s, memberTotals.bonuses)} · خصومات ${money(s, memberTotals.deductions)}`}
                      right={money(s, memberTotals.amount)}
                      onPress={() =>
                        nav.navigate("Detail", { member: member.id })
                      }
                    />
                  </Glass>
                ))}
              <Section title="آخر المكافآت والخصومات" />
              <Notice text="لتصحيح مبلغ مكافأة أو خصم: احذف العملية الخاطئة، ثم أضف العملية الصحيحة مع سبب التصحيح." />
              {s.records
                .filter(
                  (entry) =>
                    entry.month_key === s.settings.active_month &&
                    ["مكافأة", "خصم"].includes(entry.work_type),
                )
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 10)
                .map(renderRecord)}
            </>
          )}

          {section === "prices" && (
            <>
              <Notice text="السعر العام يطبّق على الأعمال العادية. إذا خصصت أسعار عمل، تصبح تخصصاته المخصصة وحدها متاحة للتسجيل فيه." />
              <Button
                title="إضافة تخصص عام"
                icon="add-outline"
                disabled={offline}
                onPress={() => nav.navigate("AdminForm", { kind: "specialty" })}
              />
              <Glass>
                {Object.entries(s.specialties).map(
                  ([name, specialty], index) => (
                    <View key={name}>
                      {index > 0 && <View style={styles.divider} />}
                      <Row
                        title={name.replace(/_/g, " ")}
                        detail={
                          specialty.active
                            ? "متاح في قائمة التسجيل"
                            : "موقوف عن التسجيل"
                        }
                        icon="pricetag-outline"
                        right={money(s, specialty.price)}
                        onPress={() =>
                          nav.navigate("AdminForm", {
                            kind: "specialty",
                            specialty: name,
                          })
                        }
                      />
                    </View>
                  ),
                )}
              </Glass>
              <Section title="أسعار كل عمل" />
              <Search
                value={query}
                onChange={setQuery}
                placeholder="ابحث عن العمل لتعديل أسعاره…"
              />
              {s.works
                .filter(
                  (work) =>
                    match(work.name, query) &&
                    (!route.params?.work || work.name === route.params.work),
                )
                .map((work) => (
                  <Glass key={work.name}>
                    <Row
                      title={work.name}
                      image={work.azora?.cover}
                      cover
                      detail={
                        work.custom_prices
                          ? "تخصصات وأسعار خاصة بهذا العمل"
                          : "يستخدم الأسعار العامة"
                      }
                      onPress={() =>
                        nav.navigate("Detail", { work: work.name })
                      }
                    />
                    {Object.entries(work.custom_prices || {}).map(
                      ([specialty, price]) => (
                        <Row
                          key={specialty}
                          title={specialty.replace(/_/g, " ")}
                          right={money(s, price)}
                          onPress={() =>
                            nav.navigate("AdminForm", {
                              kind: "customPrice",
                              work: work.name,
                              specialty,
                            })
                          }
                        />
                      ),
                    )}
                    <Button
                      secondary
                      title="إضافة أو تعديل سعر خاص"
                      icon="pricetag-outline"
                      disabled={offline}
                      onPress={() =>
                        nav.navigate("AdminForm", {
                          kind: "customPrice",
                          work: work.name,
                        })
                      }
                    />
                  </Glass>
                ))}
              <Button
                title="إعادة حساب السجلات بأسعار جديدة"
                secondary
                icon="refresh-outline"
                disabled={offline}
                onPress={() => nav.navigate("AdminForm", { kind: "reprice" })}
              />
            </>
          )}

          {section === "archives" && (
            <>
              <Notice text="كل شهر يحتفظ بسجلاته. تفعيل شهر آخر يغير شهر التسجيل الحالي؛ تبقى الأشهر السابقة متاحة للمراجعة." />
              <Button
                title="إنشاء شهر جديد"
                icon="add-outline"
                disabled={offline}
                onPress={() => nav.navigate("AdminForm", { kind: "month" })}
              />
              {[...s.months]
                .sort((a, b) => b.key.localeCompare(a.key))
                .map((item) => {
                  const t = totalOf(visibleEntries(s, undefined, item.key));
                  return (
                    <Glass
                      key={item.key}
                      gold={item.key === s.settings.active_month}
                    >
                      <Row
                        title={item.name}
                        detail={`${item.key} · ${item.key === s.settings.active_month ? "الشهر النشط" : "أرشيف محفوظ"}`}
                        icon="calendar-outline"
                        right={money(s, t.amount)}
                        onPress={() =>
                          nav.navigate("AdminForm", {
                            kind: "month",
                            month: item.key,
                          })
                        }
                      />
                      <View style={[styles.row, { gap: 9 }]}>
                        <Stat value={t.chapters} label="مساهمات الفصول" />
                        <Stat value={t.works} label="أعمال" />
                      </View>
                      <Pressable
                        style={{ marginTop: 15 }}
                        accessibilityRole="button"
                        onPress={() =>
                          nav.navigate("ControlSection", {
                            section: "records",
                            month: item.key,
                          })
                        }
                      >
                        <Label size={12} style={{ color: colors.gold }}>
                          تصفح سجلات هذا الشهر ←
                        </Label>
                      </Pressable>
                    </Glass>
                  );
                })}
              <Button
                secondary
                title="إدارة وتنظيم الشهور"
                icon="calendar-outline"
                onPress={() => nav.navigate("Months")}
              />
            </>
          )}

          {section === "integrations" && (
            <>
              <Glass gold>
                <Row
                  title="هوية الأعضاء من ديسكورد"
                  detail="نك نيم السيرفر أولًا، ثم الاسم المعروض، مع صورة كل عضو."
                  icon="logo-discord"
                />
                <Status
                  title="ربط حساب البوت"
                  ready={data?.configuration?.discordSyncConfigured}
                  detail={
                    data?.discordSync?.lastSyncAt
                      ? `آخر مزامنة: ${dateLabel(data.discordSync.lastSyncAt)} · ${data.discordSync.synced ?? 0} عضوًا`
                      : "يجلب بيانات أعضاء الفريق ويحفظها للاستخدام في التطبيق."
                  }
                />
                {data?.discordSync?.error && (
                  <Notice danger text={data.discordSync.error} />
                )}
                <Button
                  secondary
                  title={
                    busy
                      ? "جارٍ مزامنة ديسكورد…"
                      : "تحديث أسماء وصور جميع الأعضاء"
                  }
                  icon="sync-outline"
                  disabled={
                    offline ||
                    busy ||
                    !data?.configuration?.discordSyncConfigured
                  }
                  onPress={() =>
                    void run(async () => {
                      const result = await call<{
                        message?: string;
                        synced?: number;
                        busy?: boolean;
                        skipped?: boolean;
                      }>("/api/mobile/admin", { action: "syncDiscord" });
                      await Promise.all([reload(), refresh()]);
                      Alert.alert(
                        "مزامنة ديسكورد",
                        result.busy
                          ? "المزامنة قيد التنفيذ بالفعل. حدّث اللوحة بعد قليل."
                          : result.message ||
                              (result.synced !== undefined
                                ? `تم تحديث بيانات ${result.synced} عضوًا من السيرفر.`
                                : "تم تحديث بيانات الأعضاء من السيرفر."),
                      );
                    })
                  }
                />
                {data && !data.configuration?.discordSyncConfigured && (
                  <Label dim size={11} style={{ marginTop: 12 }}>
                    يلزم ربط رمز البوت في إعدادات الخدمة ليتمكن التطبيق من جلب
                    نك نيم وصورة جميع الأعضاء.
                  </Label>
                )}
              </Glass>
              <Glass>
                <Row
                  title="أعمال أزورا"
                  detail={`${s.works.filter((work) => work.azora).length} عملًا مرتبطًا · أغلفة وفصول منشورة وتنبيهات للأعضاء المشاركين`}
                  icon="planet-outline"
                />
                <Button
                  title="فتح مركز أزورا والمزامنة"
                  secondary
                  icon="arrow-back-outline"
                  onPress={() => nav.navigate("Azora")}
                />
              </Glass>
              <Glass>
                <Heading size={18}>التنبيهات والمزامنة التلقائية</Heading>
                <Status
                  title="إعداد المهام الدورية"
                  ready={data?.configuration?.cronConfigured}
                  detail="وجود إعداد الخدمة يحتاج أيضًا تشغيل الجدولة؛ راجع إعداد GitHub للمهام الدورية."
                />
                <View style={styles.divider} />
                <Status
                  title="الأجهزة المرتبطة بالإشعارات"
                  ready={data?.configuration?.pushConfigured}
                  readyText={`${data?.configuration?.registeredDevices || 0} أجهزة`}
                  detail="هذه أجهزة سجلت استقبال التنبيهات؛ وصول الإشعارات يعتمد أيضًا على توقيع النسخة وخدمة Apple أو Google."
                />
                <Notice text="سماح الجهاز بالإشعارات لا يؤكد وصول التنبيه. اختبار تنبيه فعلي على الجهاز هو ما يتحقق من اكتمال الربط." />
              </Glass>
              <Button
                title="فحص الخدمة وتحديث البيانات"
                secondary
                icon="pulse-outline"
                onPress={() => nav.navigate("Diagnostics")}
              />
            </>
          )}

          {section === "data" && (
            <>
              <Glass gold>
                <Icon name="shield-checkmark-outline" size={33} />
                <Heading size={20}>بيانات الفريق محفوظة</Heading>
                <Label dim size={12}>
                  راجع سجل الإدارة واحتفظ بنسخة قبل الاستعادة أو الحذف.
                </Label>
                <View style={[styles.row, { gap: 9, marginTop: 15 }]}>
                  <Stat value={s.records.length} label="سجلات" />
                  <Stat value={s.works.length} label="أعمال" />
                  <Stat value={s.months.length} label="شهور" />
                </View>
              </Glass>
              <Button
                title="تصدير نسخة احتياطية كاملة"
                icon="download-outline"
                onPress={backup}
                disabled={busy}
              />
              <Button
                title="استعادة نسخة من ملف"
                secondary
                icon="cloud-upload-outline"
                onPress={restore}
                disabled={offline || busy}
              />
              <Notice text="نسخة JSON تضم السجلات والأعمال والأسعار والشهور. احتفظ بها في مكان خاص بالفريق لأنها تحتوي معلومات مالية." />
              <Glass>
                <Row
                  title="سجل عمليات الإدارة"
                  detail="من عدّل بيانات الفريق ومتى"
                  icon="time-outline"
                  onPress={() => nav.navigate("Audit")}
                />
                <View style={styles.divider} />
                <Row
                  title="تحديث أسعار السجلات"
                  detail="إعادة الحساب بعد تغيير سعر تخصص"
                  icon="refresh-outline"
                  onPress={() => nav.navigate("AdminForm", { kind: "reprice" })}
                />
              </Glass>
              <Section title="عمليات الحذف" />
              <Notice
                danger
                text="حذف السجلات يغيّر مستحقات الفريق. صدّر نسخة احتياطية أولًا؛ ستظهر لك نافذة تأكيد قبل التنفيذ."
              />
              <Button
                danger
                title="إدارة حذف السجلات أو الأعمال"
                icon="trash-outline"
                onPress={() => nav.navigate("AdminForm", { kind: "clear" })}
                disabled={offline || busy}
              />
            </>
          )}

          {section === "settings" && (
            <>
              <Glass gold>
                <Row
                  title="العملة"
                  icon="cash-outline"
                  right={s.settings.currency}
                />
                <View style={styles.divider} />
                <Row
                  title="موعد الدفع"
                  icon="calendar-outline"
                  detail={
                    s.settings.payment_day
                      ? `اليوم ${s.settings.payment_day} من كل شهر · الساعة ${s.settings.payment_hour}:00 بتوقيت UTC`
                      : "لم يُحدد موعد تلقائي"
                  }
                />
                <View style={styles.divider} />
                <Row
                  title="حد تنبيه المستحقات"
                  icon="notifications-outline"
                  right={money(s, s.settings.alert_threshold)}
                />
                <Button
                  title="تعديل إعدادات المساحة"
                  secondary
                  icon="create-outline"
                  disabled={offline}
                  onPress={() =>
                    nav.navigate("AdminForm", { kind: "settings" })
                  }
                />
              </Glass>
              <Glass>
                <Heading size={18}>حالة الخدمة</Heading>
                <Status
                  title="قاعدة بيانات الفريق"
                  ready={data?.configuration?.databaseConfigured}
                />
                <View style={styles.divider} />
                <Status
                  title="بيانات أعضاء ديسكورد"
                  ready={data?.configuration?.discordSyncConfigured}
                />
                <View style={styles.divider} />
                <Status
                  title="إعداد التنبيهات الدورية"
                  ready={data?.configuration?.cronConfigured}
                />
                <View style={styles.divider} />
                <Status
                  title="الأجهزة المرتبطة بالإشعارات"
                  ready={data?.configuration?.pushConfigured}
                />
              </Glass>
              <Button
                title="فحص الاتصال"
                secondary
                icon="pulse-outline"
                onPress={() => nav.navigate("Diagnostics")}
              />
              <Button
                title="دليل إدارة الفريق"
                secondary
                icon="help-circle-outline"
                onPress={() => nav.navigate("Help")}
              />
            </>
          )}
        </View>
      </Page>

      <Sheet
        visible={Boolean(managedMember)}
        title="إدارة ملف العضو"
        onClose={() => {
          if (!busy) setManagedMember(null);
        }}
      >
        {managedMember && (
          <>
            <View style={[styles.row, { gap: 14 }]}>
              <Media
                uri={managedMember.avatar}
                name={managedMember.name}
                size={62}
              />
              <View style={{ flex: 1 }}>
                <Heading size={19}>{managedMember.name}</Heading>
                <Label dim size={11}>
                  {managedMember.username
                    ? `@${managedMember.username}`
                    : "حساب ديسكورد"}
                </Label>
              </View>
            </View>
            <Field
              label="لقب الملف الشخصي · اختياري"
              value={title}
              onChange={(text) => setTitle(text.slice(0, 40))}
              placeholder="مثل: محرر النخبة أو قائد الترجمة"
            />
            <Glass style={{ padding: 15 }}>
              <Row
                title="تاريخ التسجيل بالتطبيق"
                right={dateLabel(managedMember.firstLoginAt)}
              />
              <View style={styles.divider} />
              <Row
                title="آخر تسجيل دخول"
                right={dateLabel(managedMember.lastLoginAt)}
              />
              {managedMember.joinedAt && (
                <>
                  <View style={styles.divider} />
                  <Row
                    title="الانضمام إلى السيرفر"
                    right={dateLabel(managedMember.joinedAt)}
                  />
                </>
              )}
            </Glass>
            <View
              style={[styles.row, { justifyContent: "space-between", gap: 15 }]}
            >
              <View style={{ flex: 1 }}>
                <Label>إيقاف وصول العضو للتطبيق</Label>
                <Label dim size={11}>
                  السجلات والمستحقات تبقى محفوظة.
                </Label>
              </View>
              <Switch
                accessibilityLabel="إيقاف وصول العضو للتطبيق"
                value={blocked}
                onValueChange={setBlocked}
                disabled={managedMember.id === user.id || busy}
                trackColor={{ false: "#33343D", true: colors.red }}
              />
            </View>
            {managedMember.id === user.id && (
              <Label dim size={11}>
                لا يمكنك إيقاف وصول حسابك من هذه الصفحة.
              </Label>
            )}
            <Button
              title={busy ? "جارٍ الحفظ…" : "حفظ ملف العضو"}
              icon="checkmark-outline"
              onPress={saveMember}
              disabled={busy || offline}
            />
            <Button
              title="عرض ملف العضو وتفاصيل أعماله"
              secondary
              icon="person-outline"
              onPress={() => {
                setManagedMember(null);
                nav.navigate("Detail", { member: managedMember.id });
              }}
            />
          </>
        )}
      </Sheet>

      <Sheet
        visible={Boolean(editedRecord)}
        title="تعديل سجل فصل محدد"
        onClose={() => {
          if (!busy) setEditedRecord(null);
        }}
      >
        {editedRecord && (
          <>
            <Notice
              text={`تعديل السجل المسجل في ${dateLabel(editedRecord.timestamp)} فقط. تغيير العمل أو التخصص يعيد حساب السعر؛ تعديل الملاحظات وحدها يحفظ المبلغ الحالي.`}
            />
            <Picker
              label="العضو"
              value={edit.userId}
              items={memberItems}
              onChange={(userId) => setEdit({ ...edit, userId })}
            />
            <Picker
              label="العمل"
              value={edit.work}
              items={workItems}
              onChange={(work) => {
                if (work === edit.work) return;
                const types = allowedSpecialties(
                  s,
                  s.works.find((item) => item.name === work),
                );
                setEdit({
                  ...edit,
                  work,
                  types: types.includes(edit.types)
                    ? edit.types
                    : types[0] || "",
                });
              }}
            />
            <Field
              label="رقم الفصل"
              number
              value={edit.chapter}
              onChange={(chapter) => setEdit({ ...edit, chapter })}
            />
            <Picker
              label="التخصص"
              value={edit.types}
              items={allowedSpecialties(
                s,
                s.works.find((item) => item.name === edit.work),
              ).map((type) => ({
                label: type.replace(/_/g, " "),
                value: type,
              }))}
              onChange={(types) => setEdit({ ...edit, types })}
            />
            <Field
              label="ملاحظات السجل"
              multiline
              value={edit.notes}
              onChange={(notes) => setEdit({ ...edit, notes })}
            />
            <Button
              title={busy ? "جارٍ حفظ السجل…" : "حفظ هذا السجل"}
              icon="checkmark-outline"
              disabled={
                busy ||
                offline ||
                !edit.userId ||
                !edit.work ||
                !edit.chapter ||
                !edit.types ||
                (edit.userId === editedRecord.userId &&
                  edit.work === editedRecord.work_name &&
                  edit.chapter === editedRecord.chapter &&
                  edit.types === editedRecord.work_type &&
                  edit.notes === editedRecord.notes)
              }
              onPress={() =>
                void run(async () => {
                  const payload: Record<string, unknown> = {
                    id: editedRecord.id,
                  };
                  if (edit.userId !== editedRecord.userId)
                    payload.userId = edit.userId;
                  if (edit.work !== editedRecord.work_name)
                    payload.work = edit.work;
                  if (edit.chapter !== editedRecord.chapter)
                    payload.chapter = edit.chapter
                      .replace(/[٠-٩]/g, (digit) =>
                        String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
                      )
                      .replace("٫", ".");
                  if (edit.types !== editedRecord.work_type)
                    payload.types = edit.types;
                  if (edit.notes !== editedRecord.notes)
                    payload.notes = edit.notes;
                  const message = await execute({
                    action: "editRecord",
                    payload,
                  });
                  setEditedRecord(null);
                  Alert.alert("تم تعديل السجل", message);
                })
              }
            />
          </>
        )}
      </Sheet>
    </>
  );
}

const local = StyleSheet.create({
  hero: {
    borderRadius: 29,
    padding: 23,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.24)",
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.10)",
    left: -70,
    top: -75,
    transform: [{ rotate: "-30deg" }],
  },
  heroIcon: {
    width: 59,
    height: 59,
    borderRadius: 19,
    backgroundColor: "rgba(232,199,124,.11)",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "rgba(232,199,124,.18)",
    borderWidth: 1,
  },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.8%",
    flexGrow: 1,
    backgroundColor: "rgba(22,24,32,.94)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 17,
    minHeight: 157,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(255,255,255,.035)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  search: {
    minHeight: 54,
    paddingHorizontal: 15,
    gap: 10,
    alignItems: "center",
    flexDirection: "row-reverse",
    backgroundColor: "#13161E",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: "Cairo_500Medium",
    fontSize: 13,
    textAlign: "right",
    minHeight: 48,
    paddingVertical: 8,
  },
  notice: {
    backgroundColor: "rgba(232,199,124,.04)",
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.14)",
    borderRadius: 17,
    padding: 14,
    gap: 10,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
  },
  memberMetric: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,.028)",
    borderRadius: 12,
    padding: 10,
  },
  smallButton: {
    flexDirection: "row-reverse",
    gap: 6,
    minHeight: 35,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,.04)",
  },
  workActions: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.74)",
  },
  sheet: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    maxHeight: "90%",
    backgroundColor: "#11131B",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 23,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.18)",
  },
  picker: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#14151C",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    minHeight: 54,
    padding: 15,
  },
  option: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 13,
    gap: 10,
    borderRadius: 11,
    minHeight: 43,
  },
});
