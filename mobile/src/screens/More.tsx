import { InstallApp } from "../components/InstallApp";
import { Alert } from "../lib/alerts";
import React from "react";
import Constants from "expo-constants";
import { notificationBundleId } from "../lib/notifications";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTeam } from "../lib/context";
import { paymentCSV, totalOf, visibleEntries } from "../lib/domain";
import { usePush } from "../components/NotificationCenter";
import { shareFile, pickBackup, shareBytes } from "../lib/files";
import {
  Page,
  Glass,
  Label,
  Heading,
  Section,
  Row,
  Button,
  styles,
  colors,
} from "../components/ui";
export function More() {
  const { snapshot: s, user, logout, execute, offline, call } = useTeam();
  const { enable, enabled, busy: pushBusy } = usePush();
  const nav = useNavigation<any>();
  if (!s || !user) return null;
  const backup = () => {
    void shareFile(
      `cookies-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(s, null, 2),
      "application/json",
    ).catch((e) => Alert.alert("التصدير", e.message));
  };
  const restore = () => {
    void pickBackup()
      .then((data) => {
        if (!data) return;
        Alert.alert(
          "استعادة النسخة؟",
          `ستستبدل بيانات الفريق بـ ${data.records.length} سجل و${data.works.length} عمل. صدّر نسخة حالية أولًا.`,
          [
            { text: "إلغاء", style: "cancel" },
            {
              text: "استعادة",
              style: "destructive",
              onPress: () => {
                void execute({ action: "import", payload: { snapshot: data } })
                  .then((message) => Alert.alert("الاستعادة", message))
                  .catch((e) => Alert.alert("تعذر الاستعادة", e.message));
              },
            },
          ],
        );
      })
      .catch((e) => Alert.alert("الملف", e.message));
  };
  return (
    <Page>
      <View style={styles.stack}>
        <InstallApp />
        <Glass gold>
          <Row
            title={user.name}
            image={user.avatar}
            onPress={() => nav.navigate("Detail", { member: user.id })}
            detail={user.isAdmin ? "مشرف مساحة كوكيز" : "عضو فريق كوكيز"}
            icon="person-circle-outline"
          />
          <Label dim size={11}>
            {offline
              ? "نسخة محفوظة؛ الاتصال مطلوب للحفظ."
              : "مساحة واحدة، لكل إنجازات الفريق."}
          </Label>
        </Glass>
        <Section title="مساحتك" />
        <Glass>
          <Row
            title="المستحقات والحركات المالية"
            detail="صافي الرصيد والمكافآت والخصومات"
            icon="wallet-outline"
            onPress={() => nav.navigate("Finance")}
          />
          <View style={styles.divider} />
          <Row
            title="التقارير والإحصائيات"
            detail="الشهر الحالي وتقرير آخر 7 أيام"
            icon="stats-chart-outline"
            onPress={() => nav.navigate("Reports")}
          />
          <View style={styles.divider} />
          <Row
            title="الأسعار والتخصصات"
            icon="pricetags-outline"
            onPress={() => nav.navigate("Specialties")}
          />
          <View style={styles.divider} />
          <Row
            title={enabled ? "إشعارات الفريق مفعّلة" : "تفعيل إشعارات الفريق"}
            detail={
              pushBusy
                ? "جارٍ ربط الجهاز…"
                : "فصول أعمالك، المستحقات وتحديثات الفريق"
            }
            icon="notifications-outline"
            onPress={() => {
              if (!pushBusy) void enable();
            }}
          />
          <View style={styles.divider} />
          <Row
            title="دليل الاستخدام"
            icon="help-circle-outline"
            onPress={() => nav.navigate("Help")}
          />
        </Glass>
        {user.isAdmin && (
          <>
            <Button
              title="لوحة الإشراف الكاملة"
              icon="shield-checkmark-outline"
              onPress={() => nav.navigate("Control")}
            />
            <Section title="أدوات الإدارة" />
            <Glass>
              <Row
                title="المكافآت والخصومات"
                icon="gift-outline"
                onPress={() => nav.navigate("Adjustment")}
              />
              <View style={styles.divider} />
              <Row
                title="الشهور والأرشيف"
                icon="calendar-outline"
                onPress={() => nav.navigate("Months")}
              />
              <View style={styles.divider} />
              <Row
                title="تقرير الدفع"
                icon="wallet-outline"
                onPress={() => nav.navigate("Reports", { payment: true })}
              />
              <View style={styles.divider} />
              <Row
                title="مركز أزورا"
                detail="الربط والمزامنة والفصول المنشورة"
                icon="planet-outline"
                onPress={() => nav.navigate("Azora")}
              />
              <View style={styles.divider} />
              <Row
                title="سجل الإدارة"
                icon="time-outline"
                onPress={() => nav.navigate("Audit")}
              />
              <View style={styles.divider} />
              <Row
                title="الإعدادات"
                icon="options-outline"
                onPress={() => nav.navigate("AdminForm", { kind: "settings" })}
              />
              <View style={styles.divider} />
              <Row
                title="فحص الاتصال"
                icon="pulse-outline"
                onPress={() => nav.navigate("Diagnostics")}
              />
            </Glass>
            <Section title="البيانات" />
            <Glass>
              <Row
                title="تصدير نسخة JSON"
                detail="السجلات والأعمال والأسعار والشهور"
                icon="download-outline"
                onPress={backup}
              />
              <View style={styles.divider} />
              <Row
                title="استعادة نسخة JSON"
                icon="cloud-upload-outline"
                onPress={restore}
              />
              <View style={styles.divider} />
              <Row
                title="تحديث أسعار السجلات"
                icon="refresh-outline"
                onPress={() => nav.navigate("AdminForm", { kind: "reprice" })}
              />
              <View style={styles.divider} />
              <Row
                title="إدارة الحذف"
                danger
                icon="trash-outline"
                onPress={() => nav.navigate("AdminForm", { kind: "clear" })}
              />
            </Glass>
          </>
        )}
        <Button
          title="تسجيل الخروج"
          secondary
          icon="log-out-outline"
          onPress={() => {
            void logout();
          }}
        />
        <Label dim size={10} style={{ textAlign: "center", letterSpacing: 2 }}>
          COOKIES · MADE FOR YOUR NEXT CHAPTER
        </Label>
      </View>
    </Page>
  );
}
export function Reports({ route }: { route: any }) {
  const { snapshot: s, user, call } = useTeam();
  if (!s || !user) return null;
  const payment = route.params?.payment && user.isAdmin;
  const entries = visibleEntries(s, payment ? undefined : user.id),
    t = totalOf(entries),
    week = totalOf(
      entries.filter(
        (e) => Date.parse(e.timestamp) >= Date.now() - 7 * 86400000,
      ),
    );
  const rows = s.members
    .map((m) => ({ ...m, ...totalOf(visibleEntries(s, m.id)) }))
    .sort((a, b) => b.amount - a.amount);
  const byType = Object.entries(
    entries.reduce(
      (a, e) => {
        if (!["مكافأة", "خصم"].includes(e.work_type))
          a[e.work_type] = (a[e.work_type] || 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    ),
  );
  return (
    <Page>
      <View style={styles.stack}>
        <Heading>{payment ? "تقرير الدفع" : "قصة إنجازك بالأرقام"}</Heading>
        <Label dim>
          {s.months.find((m) => m.key === s.settings.active_month)?.name} ·{" "}
          {s.settings.currency}
        </Label>
        <Glass gold>
          <Label dim>{payment ? "صافي مستحقات الفريق" : "صافي مستحقاتك"}</Label>
          <Heading size={36}>
            {s.settings.currency}
            {t.amount.toFixed(3)}
          </Heading>
          <Label dim>
            {t.chapters} فصل · مكافآت {t.bonuses.toFixed(3)} · خصومات{" "}
            {t.deductions.toFixed(3)}
          </Label>
        </Glass>
        {payment ? (
          <>
            <Button
              title="تصدير تقرير CSV"
              icon="download-outline"
              onPress={() => {
                void shareFile(
                  `payments-${s.settings.active_month}.csv`,
                  paymentCSV(s),
                  "text/csv",
                ).catch((e) => Alert.alert("التصدير", e.message));
              }}
            />
            <Button
              title="تصدير Excel منسق (XLSX)"
              secondary

              icon="document-outline"
              onPress={() => {
                void call<{ name: string; base64: string }>(
                  "/api/mobile/payment-export",
                )
                  .then((data) => shareBytes(data.name, data.base64))
                  .catch((e) => Alert.alert("التصدير", e.message));
              }}
            />
            {rows.map((m) => (
              <Glass key={m.id}>
                <Row
                  title={m.name}
                  detail={`${m.chapters} فصل · ${m.works} أعمال · مكافآت ${m.bonuses.toFixed(3)} · خصومات ${m.deductions.toFixed(3)}`}
                  right={`${s.settings.currency}${m.amount.toFixed(3)}`}
                />
              </Glass>
            ))}
          </>
        ) : (
          <>
            <Section title="آخر 7 أيام في الشهر المختار" />
            <Glass>
              <Heading>{week.chapters} فصل</Heading>
              <Label dim>
                {s.settings.currency}
                {week.amount.toFixed(3)} مستحقات
              </Label>
            </Glass>
            <Section title="توزيع التخصصات" />
            <Glass>
              {byType.map(([type, count]) => (
                <View key={type} style={{ gap: 8, paddingVertical: 10 }}>
                  <Row title={type.replace(/_/g, " ")} right={`${count}`} />
                  <View
                    style={{
                      height: 5,
                      backgroundColor: "#282A32",
                      borderRadius: 4,
                    }}
                  >
                    <View
                      style={{
                        height: 5,
                        width: `${(100 * count) / Math.max(1, t.chapters)}%`,
                        backgroundColor: colors.gold,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Glass>
          </>
        )}
      </View>
    </Page>
  );
}
export function Months() {
  const { snapshot: s } = useTeam();
  const nav = useNavigation<any>();
  if (!s) return null;
  return (
    <Page>
      <View style={styles.stack}>
        <Button
          title="إنشاء شهر"
          icon="add-outline"
          onPress={() => nav.navigate("AdminForm", { kind: "month" })}
        />
        {[...s.months]
          .sort((a, b) => b.key.localeCompare(a.key))
          .map((m) => {
            const t = totalOf(visibleEntries(s, undefined, m.key));
            return (
              <Glass key={m.key} gold={m.key === s.settings.active_month}>
                <Row
                  title={m.name}
                  detail={`${m.key} · ${t.chapters} فصل · ${m.key === s.settings.active_month ? "الشهر النشط" : "أرشيف"}`}
                  icon="calendar-outline"
                  right={`${s.settings.currency}${t.amount.toFixed(3)}`}
                  onPress={() =>
                    nav.navigate("AdminForm", { kind: "month", month: m.key })
                  }
                />
              </Glass>
            );
          })}
      </View>
    </Page>
  );
}
export function Audit() {
  const { snapshot: s, user } = useTeam();
  if (!user?.isAdmin) return null;
  return (
    <Page>
      <View style={styles.stack}>
        {s?.audit.map((a) => (
          <Glass key={a.id}>
            <Row
              title={a.action}
              image={s?.members.find((m) => m.id === a.moderator_id)?.avatar}
              detail={a.details}
              icon="shield-checkmark-outline"
            />
            <Label dim size={10}>
              {new Date(a.timestamp).toLocaleString("ar")} ·{" "}
              {s?.members.find((m) => m.id === a.moderator_id)?.name ||
                a.moderator_id ||
                "مهمة تلقائية"}
            </Label>
          </Glass>
        ))}
      </View>
    </Page>
  );
}
export { GuideBook as Help } from "./GuideBook";
export function Diagnostics() {
  const { snapshot: s, user, offline, error, refresh } = useTeam();
  const push = usePush();
  return (
    <Page>
      <View style={styles.stack}>
        <Glass>
          <Row
            title="حالة الاتصال"
            detail={offline ? "دون اتصال" : "متصل بالخدمة"}
            icon="pulse-outline"
          />
          <Row
            title="السجلات المحفوظة"
            right={String(s?.records.length || 0)}
          />
          <Row title="الشهر النشط" right={s?.settings.active_month} />
          {error && <Label style={{ color: colors.red }}>{error}</Label>}
        </Glass>
        <Glass>
          <Row title="إصدار التطبيق" right={Constants.expoConfig?.version} />
          <Row
            title="معرّف النسخة المثبتة"
            detail={notificationBundleId() || "متصفح"}
          />
          <Row
            title="ربط الإشعارات"
            detail={
              push.busy
                ? "جارٍ ربط الجهاز…"
                : push.enabled
                  ? "الجهاز مربوط بخدمة الفريق"
                  : "الجهاز غير مربوط"
            }
          />
          {!!push.error && (
            <Label style={{ color: colors.red }}>{push.error}</Label>
          )}
          <Button
            title="إعادة فحص الإشعارات"
            disabled={push.busy}
            onPress={() => void push.enable()}
          />
        </Glass>
        <Button
          title="فحص وتحديث"
          icon="refresh-outline"
          onPress={() => void refresh()}
        />
      </View>
    </Page>
  );
}
