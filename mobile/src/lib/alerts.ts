import type { AlertButton, AlertOptions } from "react-native";
export type GlassDialog = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};
let nextId = 0;
const queue: GlassDialog[] = [];
const listeners = new Set<() => void>();
export const currentDialog = () => queue[0] || null;
export function subscribeDialogs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function closeDialog(id: number) {
  if (queue[0]?.id !== id) return false;
  queue.shift();
  listeners.forEach((l) => l());
  return true;
}
export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) {
    queue.push({
      id: ++nextId,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "حسنًا" }],
      options,
    });
    listeners.forEach((l) => l());
  },
};

const hosts = new Map<string, { root: boolean; order: number }>();
let hostOrder = 0;
export function dialogHost() {
  let selected: string | null = null,
    rank = -1;
  for (const [id, host] of hosts) {
    const value = host.root ? 0 : host.order;
    if (value >= rank) {
      selected = id;
      rank = value;
    }
  }
  return selected;
}
export function registerDialogHost(id: string, root: boolean) {
  hosts.set(id, { root, order: ++hostOrder });
  listeners.forEach((l) => l());
  return () => {
    hosts.delete(id);
    listeners.forEach((l) => l());
  };
}
