import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ScrollView } from "react-native";
import {
  readWalkthrough,
  walkthroughCheckpoint,
  walkthroughKey,
  walkthroughNext,
  type WalkthroughAction,
  type WalkthroughStep,
} from "./walkthrough";
const WalkthroughContext = createContext<{
  step: WalkthroughStep | null;
  act: (action: WalkthroughAction) => void;
}>({ step: null, act: () => {} });
export const WalkthroughScrollContext = createContext<{
  view: React.RefObject<ScrollView | null>;
  offset: React.RefObject<number>;
} | null>(null);
export function WalkthroughProvider({
  owner,
  children,
}: {
  owner?: string;
  children: React.ReactNode;
}) {
  const [step, setStep] = useState<WalkthroughStep | null>(null);
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    if (!owner) return;
    void AsyncStorage.getItem(walkthroughKey(owner))
      .then((raw) => {
        if (alive) setStep(readWalkthrough(raw));
      })
      .catch(() => {
        if (alive) setStep("start");
      });
    return () => {
      alive = false;
    };
  }, [owner]);
  useEffect(() => {
    if (!owner || step === null) return;
    const checkpoint = walkthroughCheckpoint(step);
    pending.current = pending.current
      .then(() => AsyncStorage.setItem(walkthroughKey(owner), checkpoint))
      .catch(() => {});
  }, [owner, step]);
  const act = useCallback((action: WalkthroughAction) => {
    setStep((current) =>
      current === null ? current : walkthroughNext(current, action),
    );
  }, []);
  const value = useMemo(() => ({ step, act }), [step, act]);
  return (
    <WalkthroughContext.Provider value={value}>
      {children}
    </WalkthroughContext.Provider>
  );
}
export const useWalkthrough = () => useContext(WalkthroughContext);
