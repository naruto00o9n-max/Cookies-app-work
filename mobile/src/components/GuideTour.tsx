import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { GuideDefinition } from "../lib/guides";
import { Button, Fade, Heading, Icon, Label, colors, styles } from "./ui";
export function GuideArt({ icon }: { icon: string }) {
  const orbit = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!alive || reduced) return;
        animation = Animated.loop(
          Animated.timing(orbit, {
            toValue: 1,
            duration: 16000,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== "web",
          }),
        );
        animation.start();
      })
      .catch(() => {});
    return () => {
      alive = false;
      animation?.stop();
    };
  }, [orbit]);
  return (
    <View style={design.art} accessible={false}>
      <LinearGradient
        colors={[
          "rgba(232,199,124,.16)",
          "rgba(113,120,197,.08)",
          "transparent",
        ]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          design.orbit,
          {
            transform: [
              {
                rotate: orbit.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "360deg"],
                }),
              },
            ],
          },
        ]}
      >
        <View style={design.spark} />
        <View
          style={[
            design.spark,
            {
              bottom: 14,
              left: 15,
              top: undefined,
              right: undefined,
              backgroundColor: "#A5BCED",
            },
          ]}
        />
      </Animated.View>
      <View style={design.inner}>
        <Icon name={icon as any} size={48} />
      </View>
      <View style={design.ticket}>
        <Icon name="sparkles-outline" size={14} />
        <Label size={9} style={{ letterSpacing: 2, color: colors.gold }}>
          DISCOVER
        </Label>
      </View>
    </View>
  );
}
export function GuideTour({
  guide,
  onClose,
  onSeen,
}: {
  guide: GuideDefinition;
  onClose: () => void;
  onSeen?: () => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    onSeen?.();
  }, [onSeen]);
  const current = guide.steps[index];
  return (
    <View style={{ gap: 19 }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Label dim size={10}>
          دليل كوكيز · {index + 1} / {guide.steps.length}
        </Label>
        <Label size={10} style={{ color: colors.gold }}>
          اكتشف مساحتك ✦
        </Label>
      </View>
      <GuideArt icon={current.icon} />
      <Fade key={index}>
        <View style={{ gap: 10 }}>
          <Heading size={24}>{current.title}</Heading>
          <Label dim style={{ lineHeight: 28 }}>
            {current.body}
          </Label>
        </View>
      </Fade>
      <View style={[styles.row, { gap: 6, justifyContent: "center" }]}>
        {guide.steps.map((_, i) => (
          <View
            key={i}
            style={{
              height: 4,
              width: i === index ? 32 : 12,
              borderRadius: 4,
              backgroundColor: i === index ? colors.gold : colors.line,
            }}
          />
        ))}
      </View>
      <Button
        title={index === guide.steps.length - 1 ? "فهمت، لنبدأ" : "التالي"}
        icon={
          index === guide.steps.length - 1
            ? "checkmark-outline"
            : "arrow-back-outline"
        }
        onPress={() =>
          index === guide.steps.length - 1
            ? onClose()
            : setIndex((i) => Math.min(i + 1, guide.steps.length - 1))
        }
      />
      <View style={styles.row}>
        {index > 0 && (
          <View style={{ flex: 1 }}>
            <Button
              secondary
              title="السابق"
              onPress={() => setIndex((i) => Math.max(0, i - 1))}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button secondary title="تخطي الشرح" onPress={onClose} />
        </View>
      </View>
      <Label dim size={10}>
        يمكنك إعادة هذا الشرح في أي وقت من دليل التطبيق.
      </Label>
    </View>
  );
}
const design = StyleSheet.create({
  art: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    overflow: "hidden",
  },
  orbit: {
    width: 154,
    height: 154,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.25)",
    borderRadius: 90,
    position: "absolute",
  },
  spark: {
    width: 10,
    height: 10,
    backgroundColor: colors.gold,
    borderRadius: 5,
    position: "absolute",
    right: 15,
    top: 14,
  },
  inner: {
    width: 112,
    height: 112,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(232,199,124,.28)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,199,124,.05)",
    transform: [{ rotate: "-7deg" }],
  },
  ticket: {
    ...styles.row,
    gap: 6,
    position: "absolute",
    bottom: 12,
    right: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#15161D",
  },
});
