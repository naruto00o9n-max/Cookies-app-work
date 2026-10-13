import { spawnSync } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Use the documented EAS command, not a private API or a username/password login.
const easVersion = "24.13.0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateAccount(account) {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(account ?? "")) {
    throw new Error("Enter your Expo account name, without @, spaces or a URL.");
  }
  return account;
}

export function validateSource(config, account) {
  if (!config?.expo || !/^[a-z0-9][a-z0-9-]*$/.test(config.expo.slug ?? "")) {
    throw new Error("mobile/app.json must contain a valid Expo project slug.");
  }
  const existingId = config.expo.extra?.eas?.projectId;
  if (existingId && !uuidPattern.test(existingId)) {
    throw new Error("The existing Expo project ID is not a valid UUID.");
  }
  if (config.expo.owner && config.expo.owner !== account) {
    throw new Error(
      `This app is linked to @${config.expo.owner}. Use that account or review the existing project before changing its owner.`,
    );
  }
}

export function mergeProject(config, account, result) {
  validateSource(config, account);
  if (
    !uuidPattern.test(result?.projectId ?? "") ||
    result.owner !== account ||
    result.slug !== config.expo.slug ||
    !["created", "linked", "already-linked"].includes(result.status)
  ) {
    throw new Error("Expo returned a different owner/slug or an invalid project ID; app configuration was not changed.");
  }
  const previousId = config.expo.extra?.eas?.projectId;
  if (previousId && previousId !== result.projectId) {
    throw new Error("Expo returned a different project from the one already linked; app configuration was not changed.");
  }
  return {
    ...config,
    expo: {
      ...config.expo,
      owner: account,
      extra: {
        ...config.expo.extra,
        eas: { ...config.expo.extra?.eas, projectId: result.projectId },
      },
    },
  };
}

function safeError(text, token) {
  return String(text ?? "").split(token).join("[redacted]").slice(-6000);
}

export async function setupExpo(account) {
  validateAccount(account);
  const token = process.env.EXPO_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing EXPO_TOKEN. Add an Expo access token to this repository's Actions secrets as EXPO_TOKEN, then run this workflow again. Do not send your password or token in chat.");
  }

  const configPath = path.join(root, "mobile", "app.json");
  const source = await readFile(configPath, "utf8");
  const config = JSON.parse(source);
  validateSource(config, account);
  const temporaryProject = await mkdtemp(path.join(os.tmpdir(), "cookies-expo-setup-"));

  try {
    // EAS can edit static app.json; it cannot reliably edit our app.config.ts.
    // A disposable project also keeps unrelated source and secrets out of setup.
    const stagedConfig = {
      expo: {
        name: config.expo.name,
        slug: config.expo.slug,
        owner: account,
        ...(config.expo.extra?.eas?.projectId
          ? { extra: { eas: { projectId: config.expo.extra.eas.projectId } } }
          : {}),
      },
    };
    await writeFile(path.join(temporaryProject, "app.json"), `${JSON.stringify(stagedConfig, null, 2)}\n`);
    const packageSource = await readFile(path.join(root, "mobile", "package.json"), "utf8");
    await writeFile(path.join(temporaryProject, "package.json"), packageSource);
    await symlink(path.join(root, "mobile", "node_modules"), path.join(temporaryProject, "node_modules"), "dir");

    const command = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["--yes", `eas-cli@${easVersion}`, "init", "--account", account, "--json", "--non-interactive", "--force", "--no-icon"],
      {
        cwd: temporaryProject,
        env: { ...process.env, EXPO_TOKEN: token, EXPO_NO_TELEMETRY: "1", CI: "1" },
        encoding: "utf8",
        timeout: 5 * 60 * 1000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (command.error || command.status !== 0) {
      const detail = safeError(command.stderr || command.error?.message || "Expo setup failed.", token);
      throw new Error(`Expo project setup failed. Verify the token and access to @${account}.\n${detail}`);
    }

    let result;
    try {
      result = JSON.parse(command.stdout);
    } catch {
      throw new Error("Expo did not return valid JSON; app configuration was not changed.");
    }
    const merged = mergeProject(config, account, result);
    // Refuse to overwrite a concurrent source edit even outside GitHub Actions.
    if ((await readFile(configPath, "utf8")) !== source) {
      throw new Error("mobile/app.json changed during setup. Run setup again to link the existing Expo project safely.");
    }
    await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const dashboardUrl = `https://expo.dev/accounts/${account}/projects/${config.expo.slug}`;
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        `## Expo project linked\n\n[Open your project](${dashboardUrl})\n\nProject ID: \`${result.projectId}\` (public configuration).\n\nThe APK and unsigned IPA will be rebuilt. Push delivery still requires Android FCM credentials or an iOS signing profile with Push Notifications and an APNs key for the same Apple team.\n`,
      );
    }
    console.log(`Expo project @${account}/${config.expo.slug} ${result.status}; public Project ID saved in mobile/app.json.`);
  } finally {
    await rm(temporaryProject, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupExpo(process.argv[2]).catch((error) => {
    console.error(safeError(error.message, process.env.EXPO_TOKEN || "__no_token__"));
    process.exitCode = 1;
  });
}
