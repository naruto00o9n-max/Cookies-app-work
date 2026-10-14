import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTeam } from "./context";
import { guideById, guideStorageKey } from "./guides";
import { discardDialog, showGuide } from "./alerts";
export function useScreenGuide(id: string, active: boolean, scope?: string) {
  const { user } = useTeam();
  useEffect(() => {
    const guide = guideById(id);
    if (!active || !user || !guide || (guide.admin && !user.isAdmin)) return;
    const owner = user.id,
      key = guideStorageKey(owner, scope || id);
    let alive = true,
      dialogId: number | undefined;
    const timer = setTimeout(() => {
      void AsyncStorage.getItem(key)
        .then((seen) => {
          if (!alive || seen) return;
          dialogId = showGuide(guide, () => {
            void AsyncStorage.multiSet([
              [key, "seen"],
              [guideStorageKey(owner, id), "seen"],
            ]).catch(() => {});
          });
        })
        .catch(() => {});
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
      if (dialogId !== undefined) discardDialog(dialogId);
    };
  }, [id, scope, active, user?.id, user?.isAdmin]);
}
