import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export const cacheKey = "cookies.snapshot.v1";
export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    sessionStorage.setItem("cookies.token", token);
    return;
  }
  await SecureStore.setItemAsync("cookies.session", token);
}
export async function readToken() {
  return Platform.OS === "web"
    ? sessionStorage.getItem("cookies.token")
    : SecureStore.getItemAsync("cookies.session");
}
export async function removeToken() {
  if (Platform.OS === "web") sessionStorage.removeItem("cookies.token");
  else await SecureStore.deleteItemAsync("cookies.session");
}
export const cache = {
  read: () => AsyncStorage.getItem(cacheKey),
  write: (s: unknown) => AsyncStorage.setItem(cacheKey, JSON.stringify(s)),
  clear: () => AsyncStorage.removeItem(cacheKey),
};
