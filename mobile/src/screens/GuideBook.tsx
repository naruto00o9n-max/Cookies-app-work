import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { guides, guideStorageKey, type GuideDefinition } from "../lib/guides";
import { useTeam } from "../lib/context";
import { Alert, showGuide } from "../lib/alerts";
import { GuideArt } from "../components/GuideTour";
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
const categories = [
  { label: "كل الدليل", value: "all" },
  { label: "البداية", value: "start" },
  { label: "الفريق والأعمال", value: "team" },
  { label: "المالية", value: "finance" },
  { label: "حل المشكلات", value: "support" },
  { label: "الإشراف", value: "admin" },
];
export function GuideBook() {
  const { user } = useTeam();
  const nav = useNavigation<any>(),
    focused = useIsFocused();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [seen, setSeen] = useState(new Set<string>());
  const available = guides.filter((g) => !g.admin || user?.isAdmin);
  useEffect(() => {
    let alive = true;
    if (!user || !focused) return;
    void AsyncStorage.multiGet(
      available.map((g) => guideStorageKey(user.id, g.id)),
    )
      .then((rows) => {
        if (alive)
          setSeen(
            new Set(
              rows.filter(([, v]) => v).map(([key]) => key.split(":").at(-1)!),
            ),
          );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [focused, user?.id, user?.isAdmin]);
  const open = (guide: GuideDefinition) =>
    showGuide(guide, () => {
      if (user)
        void AsyncStorage.setItem(
          guideStorageKey(user.id, guide.id),
          "seen",
        ).catch(() => {});
      setSeen((previous) => new Set([...previous, guide.id]));
    });
  const filtered = available.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      `${g.title} ${g.subtitle} ${g.steps.map((s) => `${s.title} ${s.body}`).join(" ")}`.includes(
        query.trim(),
      ),
  );
  return (
    <Page>
      <View style={styles.stack}>
        <Glass gold style={{ gap: 14 }}>
          <Label size={10} style={{ color: colors.gold, letterSpacing: 3 }}>
            COOKIES / ACADEMY
          </Label>
          <GuideArt icon="planet-outline" />
          <Heading size={30}>كل خطوة، أوضح.</Heading>
          <Label dim>
            دليل حيّ لعضو جديد أو قديم: اختر ما تريد تعلمه، واستكشفه ببطاقات
            قصيرة.
          </Label>
          <Row
            title="رحلتك في كوكيز"
            detail={`${seen.size} / ${available.length} شروحات اكتشفتها`}
            icon="ribbon-outline"
          />
          <View
            style={{
              height: 5,
              borderRadius: 5,
              backgroundColor: colors.line,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 5,
                width: `${Math.min(100, (seen.size / Math.max(1, available.length)) * 100)}%`,
                backgroundColor: colors.gold,
              }}
            />
          </View>
          <Button
            title="ابدأ جولتك الأولى"
            icon="sparkles-outline"
            onPress={() => open(guides[0])}
          />
        </Glass>
        <Field
          label="ماذا تريد أن تتعلم؟"
          value={query}
          onChange={setQuery}
          placeholder="فصول، خصم، إشعارات، أزورا…"
        />
        <Chips
          items={categories.filter((c) => c.value !== "admin" || user?.isAdmin)}
          value={category}
          onSelect={setCategory}
        />
        {filtered.map((guide) => (
          <Glass key={guide.id} style={{ gap: 14 }}>
            <Row
              title={guide.title}
              detail={guide.subtitle}
              icon={guide.icon as any}
              right={seen.has(guide.id) ? "✓" : "✦"}
              accessibilityLabel={`تعلم ${guide.title}`}
              onPress={() => open(guide)}
            />
            <View style={[styles.row, { gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  title={seen.has(guide.id) ? "إعادة الشرح" : "استكشف الشرح"}
                  onPress={() => open(guide)}
                />
              </View>
              {guide.route && (
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="فتح الواجهة"
                    onPress={() =>
                      nav.navigate(guide.route!.name, guide.route!.params)
                    }
                  />
                </View>
              )}
            </View>
            <Label dim size={10}>
              {guide.steps.length} خطوات قصيرة {guide.admin ? "· للمشرفين" : ""}
            </Label>
          </Glass>
        ))}
        {!filtered.length && (
          <Empty
            title="لا يوجد شرح مطابق"
            detail="جرّب كلمة مثل تسجيل أو مكافأة أو اتصال."
          />
        )}
        <Section title="تريد الشروحات تلقائيًا مجددًا؟" />
        <Button
          secondary
          title="إعادة بطاقات أول زيارة"
          icon="refresh-outline"
          onPress={() =>
            Alert.alert(
              "إعادة الجولة التعليمية؟",
              "ستظهر بطاقات التعليم عند زيارتك التالية للواجهات. بياناتك وفصولك ومستحقاتك محفوظة كما هي.",
              [
                { text: "إلغاء", style: "cancel" },
                {
                  text: "إعادة الجولة",
                  onPress: () => {
                    if (!user) return;
                    void AsyncStorage.getAllKeys()
                      .then((keys) =>
                        AsyncStorage.multiRemove(
                          keys.filter((key) =>
                            key.startsWith(`cookies:guide:v1:${user.id}:`),
                          ),
                        ),
                      )
                      .then(() => {
                        setSeen(new Set());
                        Alert.alert(
                          "جولتك جاهزة",
                          "افتح أي واجهة لتظهر بطاقاتها التعليمية من جديد.",
                        );
                      })
                      .catch(() => Alert.alert("تعذر الإعادة", "حاول مجددًا."));
                  },
                },
              ],
            )
          }
        />
      </View>
    </Page>
  );
}
