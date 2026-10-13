import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  emptyRegistrationPreferences,
  readRegistrationPreferences,
  rememberRegistrationChoice,
  type RegistrationPreferences,
} from "./registration-plan";

export const registrationPreferencesKey = (userId: string) =>
  `cookies.registration.v1.${userId}`;
const preferencesByUser = new Map<string, RegistrationPreferences>();
const listenersByUser = new Map<
  string,
  Set<(value: RegistrationPreferences) => void>
>();
const writesByUser = new Map<string, Promise<RegistrationPreferences>>();

function announce(userId: string, preferences: RegistrationPreferences) {
  preferencesByUser.set(userId, preferences);
  listenersByUser.get(userId)?.forEach((listener) => listener(preferences));
}

async function rememberChoice(
  userId: string,
  work?: string,
  specialty?: string,
) {
  if (!userId) return emptyRegistrationPreferences();
  const queued =
    writesByUser.get(userId) || Promise.resolve(emptyRegistrationPreferences());
  const write = queued
    .catch(() => emptyRegistrationPreferences())
    .then(async () => {
      const previous =
        preferencesByUser.get(userId) ||
        readRegistrationPreferences(
          await AsyncStorage.getItem(registrationPreferencesKey(userId)),
        );
      const next = rememberRegistrationChoice(previous, work, specialty);
      announce(userId, next);
      await AsyncStorage.setItem(
        registrationPreferencesKey(userId),
        JSON.stringify(next),
      );
      return next;
    });
  writesByUser.set(userId, write);
  const clear = () => {
    if (writesByUser.get(userId) === write) writesByUser.delete(userId);
  };
  void write.then(clear, clear);
  return write;
}

export const recordRecentWork = (userId: string, work: string) =>
  rememberChoice(userId, work);

export function useRegistrationPreferences(userId: string) {
  const [preferences, setPreferences] = useState(emptyRegistrationPreferences);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setPreferences(
      preferencesByUser.get(userId) || emptyRegistrationPreferences(),
    );
    setReady(false);
    if (!userId) return;
    const listener = (value: RegistrationPreferences) => {
      if (active) {
        setPreferences(value);
        setReady(true);
      }
    };
    let listeners = listenersByUser.get(userId);
    if (!listeners) {
      listeners = new Set();
      listenersByUser.set(userId, listeners);
    }
    listeners.add(listener);
    const load = async () => {
      const loaded =
        preferencesByUser.get(userId) ||
        readRegistrationPreferences(
          await AsyncStorage.getItem(registrationPreferencesKey(userId)),
        );
      if (!active) return;
      announce(userId, preferencesByUser.get(userId) || loaded);
    };
    void load().catch(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      listeners?.delete(listener);
      if (!listeners?.size) listenersByUser.delete(userId);
    };
  }, [userId]);
  const remember = useCallback(
    (work?: string, specialty?: string) => {
      void rememberChoice(userId, work, specialty).catch(() => {});
    },
    [userId],
  );
  return { preferences, ready, remember };
}
