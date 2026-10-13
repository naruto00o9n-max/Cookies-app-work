import { Alert } from "../lib/alerts";
import React, { useState, useEffect } from "react";
import { View, Linking, Switch } from "react-native";
import { useTeam } from "../lib/context";
import {
  Page,
  Glass,
  Heading,
  Label,
  Field,
  Chips,
  Row,
  Button,
  styles,
  colors,
} from "../components/ui";
type Data = {
  state: {
    team_slug: string;
    enabled: boolean;
    auto_add_new_works: boolean;
    last_sync_at?: string;
    last_error?: string;
  };
  posts: { slug: string; postTitle: string }[];
};
export function Azora() {
  const { snapshot: s, user, call, execute, refresh } = useTeam();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [work, setWork] = useState(""),
    [slug, setSlug] = useState(""),
    [team, setTeam] = useState("cookies");
  const load = () =>
    call<Data>("/api/mobile/azora")
      .then((d) => {
        setData(d);
        setTeam(d.state.team_slug);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  if (!user?.isAdmin || !s) return null;
  const run = async (body: unknown) => {
    setBusy(true);
    try {
      const result = await call<{ message: string }>("/api/mobile/azora", body);
      Alert.alert("أزورا", result.message);
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذرت العملية");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>كوكيز × أزورا</Heading>
        <Label dim>الأعمال المنشورة والتحقق من الفصول قبل تسجيلها.</Label>
        {error && <Label style={{ color: colors.red }}>{error}</Label>}
        <Glass style={styles.stack}>
          <Field label="سلاغ فريق أزورا" value={team} onChange={setTeam} />
          <Button
            title="حفظ فريق أزورا"
            secondary
            onPress={() => void run({ action: "settings", team_slug: team })}
            disabled={busy}
          />
          {data && (
            <>
              <Row
                title="آخر مزامنة"
                detail={
                  data.state.last_sync_at
                    ? new Date(data.state.last_sync_at).toLocaleString("ar")
                    : "لم تتم بعد"
                }
              />
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Label>المزامنة مفعلة</Label>
                <Switch
                  value={data.state.enabled}
                  onValueChange={(enabled) =>
                    void run({ action: "settings", enabled })
                  }
                />
              </View>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Label>إضافة الأعمال الجديدة تلقائيًا</Label>
                <Switch
                  value={data.state.auto_add_new_works}
                  onValueChange={(auto_add_new_works) =>
                    void run({ action: "settings", auto_add_new_works })
                  }
                />
              </View>
            </>
          )}
          <Button
            title={busy ? "جارٍ المزامنة…" : "مزامنة الآن"}
            icon="sync-outline"
            onPress={() => void run({ action: "sync" })}
            disabled={busy}
          />
        </Glass>
        <Glass style={styles.stack}>
          <Heading size={18}>ربط عمل بأزورا</Heading>
          <Chips
            items={s.works.map((w) => ({ label: w.name, value: w.name }))}
            value={work}
            onSelect={setWork}
          />
          <Field
            label="سلاغ العمل من رابط /series/"
            value={slug}
            onChange={setSlug}
            placeholder="solo-leveling"
          />
          <Button
            title="ربط العمل"
            secondary
            disabled={!work || !slug || busy}
            onPress={() => {
              void execute({ action: "azoraLink", payload: { work, slug } })
                .then((message) => Alert.alert("الربط", message))
                .catch((e) => Alert.alert("الربط", e.message));
            }}
          />
        </Glass>
        {s.works
          .filter((w) => w.azora)
          .map((w) => (
            <Glass key={w.name}>
              <Row
                title={w.name}
                detail={w.azora!.slug}
                icon="link-outline"
                onPress={() =>
                  void Linking.openURL(
                    `https://azorafly.com/series/${encodeURIComponent(w.azora!.slug)}`,
                  )
                }
              />
              <Button
                title="إلغاء الربط"
                secondary
                onPress={() =>
                  Alert.alert(
                    "إلغاء الربط؟",
                    "سيعود التسجيل دون التحقق من فصول أزورا.",
                    [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "فك الربط",
                        onPress: () => {
                          void execute({
                            action: "azoraUnlink",
                            payload: { work: w.name },
                          }).catch((e) => Alert.alert("الربط", e.message));
                        },
                      },
                    ],
                  )
                }
              />
            </Glass>
          ))}
        {data?.posts.map((p) => (
          <Glass key={p.slug}>
            <Row
              title={p.postTitle || p.slug}
              detail={p.slug}
              icon="book-outline"
              onPress={() => setSlug(p.slug)}
            />
          </Glass>
        ))}
      </View>
    </Page>
  );
}
