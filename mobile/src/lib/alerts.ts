import {
  Alert as NativeAlert,
  Platform,
  type AlertButton,
  type AlertOptions,
} from "react-native";
export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) {
    if (Platform.OS !== "web") {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    const actions = buttons?.filter((b) => b.style !== "cancel");
    if (buttons?.some((b) => b.style === "cancel")) {
      if (window.confirm(`${title}\n\n${message || ""}`))
        actions?.[0]?.onPress?.();
      return;
    }
    window.alert(`${title}\n\n${message || ""}`);
    actions?.[0]?.onPress?.();
  },
};
