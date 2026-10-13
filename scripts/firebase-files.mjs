import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const firebaseProject = JSON.parse(
  await readFile(path.join(root, "scripts/firebase-project.json"), "utf8"),
);
async function google(path, token, body) {
  if (!token) throw new Error("Missing Google build identity token.");
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Google Firebase setup request failed (${response.status}); inspect the build identity permissions.`,
    );
  return response.json();
}
export async function androidConfig(token) {
  const result = await google(
    `https://firebase.googleapis.com/v1beta1/projects/${firebaseProject.projectId}/androidApps/${encodeURIComponent(firebaseProject.androidAppId)}/config`,
    token,
  );
  const sdk = JSON.parse(
    Buffer.from(result.configFileContents, "base64").toString("utf8"),
  );
  const config = JSON.parse(
    await readFile(path.join(root, "mobile/app.json"), "utf8"),
  );
  if (
    sdk.project_info?.project_id !== firebaseProject.projectId ||
    !sdk.client?.some(
      (c) =>
        c.client_info?.android_client_info?.package_name ===
        config.expo.android.package,
    )
  )
    throw new Error(
      "Firebase returned a different project or Android package.",
    );
  return sdk;
}
export async function createPushKey(token) {
  const result = await google(
    `https://iam.googleapis.com/v1/projects/${firebaseProject.projectId}/serviceAccounts/${encodeURIComponent(firebaseProject.pushServiceAccount)}/keys`,
    token,
    {
      privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
      keyAlgorithm: "KEY_ALG_RSA_2048",
    },
  );
  const key = JSON.parse(
    Buffer.from(result.privateKeyData, "base64").toString("utf8"),
  );
  if (
    key.project_id !== firebaseProject.projectId ||
    key.client_email !== firebaseProject.pushServiceAccount ||
    key.type !== "service_account" ||
    !key.private_key
  )
    throw new Error("Google returned an unexpected sender credential.");
  if (process.env.GITHUB_ACTIONS === "true")
    for (const value of [key.private_key, JSON.stringify(key)])
      console.log(
        "::add-mask::" +
          value
            .replace(/%/g, "%25")
            .replace(/\r/g, "%0D")
            .replace(/\n/g, "%0A"),
      );
  return key;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const target = process.argv[2];
    if (!target)
      throw new Error("Provide an Android SDK configuration output path.");
    const sdk = await androidConfig(process.env.GOOGLE_BUILD_ACCESS_TOKEN);
    await writeFile(target, JSON.stringify(sdk, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(
      "Android Firebase configuration downloaded for " +
        firebaseProject.projectId +
        ".",
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
