import React, { useContext, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  useWalkthrough,
  WalkthroughScrollContext,
} from "../lib/walkthrough-context";
import { walkthroughMatches, type WalkthroughStep } from "../lib/walkthrough";
const gold = "#E8C77C";
// Inline labels and leader lines. No dialog, backdrop or extra touch layer over controls.
export function Coachmark({
  step,
  text,
  compact = false,
  children,
}: {
  step: WalkthroughStep;
  text: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const journey = useWalkthrough();
  const focused = useIsFocused();
  const active = (compact || focused) && walkthroughMatches(journey.step, step);
  const scroll = useContext(WalkthroughScrollContext);
  const target = useRef<View>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const reveal = React.useCallback(() => {
    if (!active || compact || !scroll?.view.current) return;
    const container = scroll.view.current;
    container
      .getNativeScrollRef()
      ?.measureInWindow((_x, top, _width, height) => {
        target.current?.measureInWindow((_tx, y, _tw, h) => {
          if (y < top + 12 || y + Math.min(h, 200) > top + height - 60)
            container.scrollTo({
              y: Math.max(0, scroll.offset.current + y - top - 48),
              animated: true,
            });
        });
      });
  }, [active, compact, scroll]);
  useEffect(() => {
    if (!active) {
      opacity.setValue(0);
      return;
    }
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (alive)
          Animated.timing(opacity, {
            toValue: 1,
            duration: reduce ? 0 : 220,
            useNativeDriver: Platform.OS !== "web",
          }).start();
      })
      .catch(() => opacity.setValue(1));
    const timer = setTimeout(reveal, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [active, opacity, reveal]);
  return (
    <View
      ref={target}
      collapsable={false}
      onLayout={reveal}
      style={compact ? design.tabTarget : undefined}
    >
      {active && (
        <Animated.View
          style={[
            design.annotation,
            compact && design.tabAnnotation,
            { opacity },
          ]}
        >
          <View style={design.caption}>
            {!compact && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إنهاء الجولة المختصرة"
                onPress={() => journey.act("dismiss")}
                hitSlop={8}
              >
                <Text style={design.skip}>تخطي</Text>
              </Pressable>
            )}
            <Text
              style={[design.text, compact && { fontSize: 11 }]}
              accessibilityLiveRegion="polite"
            >
              {text}
            </Text>
          </View>
          <View pointerEvents="none" style={design.line} />
          <View pointerEvents="none" style={design.arrow} />
        </Animated.View>
      )}
      <View
        style={active ? (compact ? design.tabRing : design.ring) : undefined}
      >
        {children}
      </View>
    </View>
  );
}
export function WalkthroughFinish() {
  const { step, act } = useWalkthrough();
  if (step !== "finish") return null;
  return (
    <View style={design.finish}>
      <Text accessibilityLiveRegion="polite" style={design.text}>
        استكشف التطبيق بنفسك ✦
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="إنهاء الجولة المختصرة"
        onPress={() => act("dismiss")}
        hitSlop={8}
      >
        <Text style={design.skip}>تم</Text>
      </Pressable>
    </View>
  );
}
const design = StyleSheet.create({
  annotation: {
    alignItems: "flex-end",
    paddingTop: 4,
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    width: "100%",
  },
  text: {
    color: gold,
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    flexShrink: 1,
  },
  skip: {
    color: "#A6A6AE",
    fontFamily: "Cairo_500Medium",
    fontSize: 11,
    padding: 5,
  },
  line: {
    height: 18,
    width: 1,
    backgroundColor: gold,
    marginRight: 18,
    marginTop: 4,
  },
  arrow: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: gold,
    transform: [{ rotate: "45deg" }],
    marginTop: -6,
    marginRight: 15,
  },
  ring: { borderRadius: 20, borderWidth: 1.5, borderColor: gold, padding: 3 },
  tabTarget: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  tabAnnotation: {
    position: "absolute",
    bottom: 37,
    right: -16,
    width: 190,
    borderRadius: 12,
    backgroundColor: "#101117",
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  tabRing: {
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: gold,
    padding: 6,
  },
  finish: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(232,199,124,.25)",
  },
});
