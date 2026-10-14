import { isFinancialEntry } from "../lib/finance";
import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { memberProgress } from "../lib/progression";
import { Media } from "../components/Media";
import { useTeam } from "../lib/context";
import { totalOf, visibleEntries } from "../lib/domain";
import {
  Page,
  Glass,
  Heading,
  Label,
  Button,
  Icon,
  Section,
  Row,
  styles,
  colors,
} from "../components/ui";
export function Home() {
  const { snapshot: s, user, refresh, offline } = useTeam();
  const nav = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  if (!s || !user) return null;
  const own = visibleEntries(s, user.id),
    total = totalOf(own),
    month = s.months.find((m) => m.key === s.settings.active_month),
    recent = own
      .filter((e) => !isFinancialEntry(e))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 4);
  const ranking = s.members
    .map((m) => ({ ...m, ...totalOf(visibleEntries(s, m.id)) }))
    .sort((a, b) => b.chapters - a.chapters);
  const progress = memberProgress(s, user.id);
  const rank = ranking.findIndex((m) => m.id === user.id) + 1;
  return (
    <Page
      onRefresh={() => {
        setRefreshing(true);
        void refresh().finally(() => setRefreshing(false));
      }}
      refreshing={refreshing}
    >
      <View style={styles.stack}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View>
            <Label dim size={12}>
              مرحبًا {user.name} ✦
            </Label>
            <Heading size={29}>لنصنع فصلًا جديدًا</Heading>
          </View>
          <View style={styles.iconBox}>
            <Media uri={user.avatar} name={user.name} size={44} />
          </View>
        </View>
        <View style={[styles.row, { gap: 7 }]}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: offline ? colors.red : colors.green,
            }}
          />
          <Label dim size={11}>
            {offline ? "نسخة محفوظة · دون اتصال" : "متصل بمساحة الفريق"} /{" "}
            {month?.name || s.settings.active_month}
          </Label>
        </View>
        <View style={styles.hero}>
          <LinearGradient
            colors={["#282319", "#171714", "#121419"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 90,
              borderWidth: 1,
              borderColor: "rgba(232,199,124,.12)",
              left: -65,
              top: -50,
            }}
          />
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Label dim size={12}>
              صافي مستحقاتك
            </Label>
            <Icon name="wallet-outline" size={20} />
          </View>
          <Text style={styles.money}>
            {s.settings.currency} {total.amount.toFixed(3)}
          </Text>
          <View style={[styles.row, { gap: 8 }]}>
            <Icon name="checkmark-circle" size={15} color={colors.green} />
            <Label size={11} style={{ color: colors.green }}>
              كل إنجاز محسوب، حتى أصغر التفاصيل.
            </Label>
          </View>
          <View
            style={[
              styles.divider,
              { marginVertical: 20, backgroundColor: "rgba(232,199,124,.13)" },
            ]}
          />
          <View style={[styles.row, { gap: 30 }]}>
            <View>
              <Heading size={23}>{total.chapters}</Heading>
              <Label dim size={11}>
                فصل مكتمل
              </Label>
            </View>
            <View>
              <Heading size={23}>{total.works}</Heading>
              <Label dim size={11}>
                أعمال شاركت بها
              </Label>
            </View>
            <View>
              <Heading size={23}>{rank || "—"}</Heading>
              <Label dim size={11}>
                ترتيبك بالفصول
              </Label>
            </View>
          </View>
        </View>
        <Button
          title="سجّل فصلًا جديدًا"
          icon="add-circle-outline"
          onPress={() => nav.navigate("Register")}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.navigate("Detail", { member: user.id })}
        >
          <Glass gold style={{ gap: 13 }}>
            <View style={[styles.row, { gap: 14 }]}>
              <View
                style={[
                  styles.iconBox,
                  {
                    width: 58,
                    height: 58,
                    borderRadius: 18,
                    transform: [{ rotate: "-6deg" }],
                  },
                ]}
              >
                <Icon name="diamond-outline" size={29} />
              </View>
              <View style={{ flex: 1 }}>
                <Label size={10} style={{ color: colors.gold }}>
                  بطاقتك في كوكيز · {progress.tier}
                </Label>
                <Heading size={21}>{progress.title}</Heading>
                <Label dim size={11}>
                  المستوى {progress.level} ·{" "}
                  {progress.badges.filter((b) => b.earned).length} أوسمة ·{" "}
                  {progress.chapters} فصل مختلف
                </Label>
              </View>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 6,
                backgroundColor: "#302B22",
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#9B7133", colors.gold]}
                style={{
                  height: 6,
                  width: `${Math.max(1, progress.progress * 100)}%`,
                  borderRadius: 6,
                }}
              />
            </View>
            <Label dim size={10}>
              {progress.xp} XP · {progress.nextLevelXp - progress.xp} XP للمستوى
              التالي
            </Label>
          </Glass>
        </Pressable>
        {user.isAdmin && (
          <Button
            title="لوحة الإشراف"
            secondary
            icon="shield-checkmark-outline"
            onPress={() => nav.navigate("Control")}
          />
        )}
        <View style={[styles.row, { gap: 12 }]}>
          <View style={styles.mini}>
            <Icon name="gift-outline" size={19} />
            <Heading size={20}>+{total.bonuses.toFixed(3)}</Heading>
            <Label dim size={11}>
              المكافآت
            </Label>
          </View>
          <View style={styles.mini}>
            <Icon name="remove-circle-outline" color={colors.muted} size={19} />
            <Heading size={20}>−{total.deductions.toFixed(3)}</Heading>
            <Label dim size={11}>
              الخصومات
            </Label>
          </View>
        </View>
        <Section
          title="إيقاع إنجازك"
          action="التقرير الكامل ←"
          onPress={() => nav.navigate("Reports")}
        />
        <Glass>
          <View
            style={{
              flexDirection: "row",
              height: 82,
              alignItems: "flex-end",
              gap: 7,
            }}
          >
            {Array.from({ length: 14 }, (_, i) => {
              const day = new Date(Date.now() - (13 - i) * 86400000)
                .toISOString()
                .slice(0, 10);
              const count = own.filter(
                (e) =>
                  e.timestamp.startsWith(day) &&
                  !["مكافأة", "خصم"].includes(e.work_type),
              ).length;
              return (
                <View
                  key={day}
                  style={{ flex: 1, gap: 5, alignItems: "center" }}
                >
                  <LinearGradient
                    colors={
                      count ? [colors.gold, "#75623E"] : ["#282A33", "#20222A"]
                    }
                    style={{
                      height: Math.max(5, Math.min(65, count * 12)),
                      width: "100%",
                      borderRadius: 4,
                    }}
                  />
                  <Label size={8} dim>
                    {new Date(day).getDate()}
                  </Label>
                </View>
              );
            })}
          </View>
          <Label dim size={10} style={{ marginTop: 12 }}>
            الفصول المنجزة خلال آخر 14 يومًا
          </Label>
        </Glass>
        <Section
          title="آخر إنجازاتك"
          action="عرض الكل ←"
          onPress={() => nav.navigate("Main", { screen: "Records" })}
        />
        <Glass>
          {recent.length ? (
            recent.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <View style={styles.divider} />}
                <Row
                  title={e.work_name}
                  image={
                    s.works.find((w) => w.name === e.work_name)?.azora?.cover
                  }
                  cover
                  onPress={() =>
                    nav.navigate("Detail", {
                      work: e.work_name,
                      member: user.id,
                    })
                  }
                  detail={`الفصل ${e.chapter} · ${e.work_type.replace(/_/g, " ")}`}
                  icon={
                    e.work_type === "مكافأة"
                      ? "gift-outline"
                      : "document-text-outline"
                  }
                  right={`${s.settings.currency}${e.total.toFixed(3)}`}
                />
              </View>
            ))
          ) : (
            <Label dim>قصتك تبدأ بأول فصل. سجّله الآن.</Label>
          )}
        </Glass>
      </View>
    </Page>
  );
}
