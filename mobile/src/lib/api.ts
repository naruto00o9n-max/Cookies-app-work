import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import type { Identity, Snapshot } from "./types";
WebBrowser.maybeCompleteAuthSession();
export const server = (
  process.env.EXPO_PUBLIC_API_URL || "https://cookies-app-work.vercel.app"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  if (!server) throw new Error("لم يتم ربط خدمة الفريق بعد");
  if (!__DEV__ && !server.startsWith("https://"))
    throw new Error("رابط الخدمة يجب أن يستخدم HTTPS");
  const response = await fetch(server + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.error || "تعذر الاتصال بالفريق", response.status);
  return data;
}
export async function discordLogin(): Promise<{
  token: string;
  user: Identity;
}> {
  if (Platform.OS === "web")
    throw new Error(
      "تسجيل ديسكورد متاح في نسخة الهاتف. استخدم التطبيق المثبت على جهازك",
    );
  const verifier = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = hash
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const result = await WebBrowser.openAuthSessionAsync(
    `${server}/api/auth/discord?challenge=${challenge}`,
    "cookiestracker://auth",
  );
  if (result.type !== "success") throw new Error("لم يكتمل تسجيل الدخول");
  const params = new URL(result.url).searchParams;
  const authError = params.get("error");
  if (authError)
    throw new Error(
      authError === "blocked"
        ? "تم إيقاف دخولك إلى التطبيق. تواصل مع مشرف الفريق"
        : authError === "notmember"
          ? "حسابك ليس عضوًا في سيرفر الفريق"
          : "تعذر إكمال تسجيل الدخول. حاول مجددًا أو تواصل مع المشرف",
    );
  const code = params.get("code");
  if (!code) throw new Error("لم يصل رمز تسجيل الدخول");
  const data = await request<{
    token: string;
    user: {
      id: string;
      username: string;
      globalName?: string;
      isAdmin: boolean;
    };
  }>("/api/auth/mobile/token", undefined, { code, verifier });
  return {
    token: data.token,
    user: {
      id: data.user.id,
      name: data.user.globalName || data.user.username,
      isAdmin: data.user.isAdmin,
    },
  };
}
export type StateResponse = {
  snapshot: Snapshot;
  user: {
    id: string;
    username: string;
    globalName?: string;
    avatar?: string;
    isAdmin: boolean;
  };
  mode: string;
};
