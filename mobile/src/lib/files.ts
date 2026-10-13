import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { Snapshot } from "./types";
import { importBackup } from "./import";
export async function shareFile(name: string, content: string, mime: string) {
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: mime,
      dialogTitle: "مشاركة ملف الفريق",
    });
  else throw new Error("المشاركة غير متاحة على هذا الجهاز");
}
export async function pickBackup(): Promise<Snapshot | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 5_000_000)
    throw new Error("الملف أكبر من 5 ميجابايت");
  const raw =
    Platform.OS === "web"
      ? await (await fetch(asset.uri)).text()
      : await new File(asset.uri).text();
  return importBackup(JSON.parse(raw));
}

export async function shareBytes(name: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const mime =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: mime }),
    );
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: mime,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
  });
}
