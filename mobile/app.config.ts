import fs from "node:fs";
import path from "node:path";
import type { ExpoConfig } from "expo/config";
import app from "./app.json";
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
if (
  projectId &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    projectId,
  )
)
  throw new Error(
    "EXPO_PUBLIC_EAS_PROJECT_ID must be a valid Expo project UUID",
  );
export default {
  ...app.expo,
  android: {
    ...app.expo.android,
    ...(fs.existsSync(path.join(__dirname, "google-services.json"))
      ? { googleServicesFile: "./google-services.json" }
      : {}),
  },
  ...(projectId ? { extra: { eas: { projectId } } } : {}),
} as ExpoConfig;
