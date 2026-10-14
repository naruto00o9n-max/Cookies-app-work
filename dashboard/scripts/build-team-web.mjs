import { execFileSync } from "node:child_process";
import {
  readFile,
  writeFile,
  copyFile,
  mkdir,
  readdir,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const dashboard = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  ),
  mobile = path.resolve(dashboard, "../mobile"),
  output = path.join(dashboard, "public/app");
const config = JSON.parse(
  await readFile(path.join(mobile, "app.json"), "utf8"),
).expo;
// The browser bundle receives only public configuration, never API/database/signing secrets.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    [
      "PATH",
      "HOME",
      "TMPDIR",
      "TMP",
      "TEMP",
      "CI",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "NO_PROXY",
      "NODE_EXTRA_CA_CERTS",
      "NODE_USE_ENV_PROXY",
    ].includes(key),
  ),
);
Object.assign(env, {
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  COOKIES_WEB_BASE_URL: "/app",
});
if (process.env.COOKIES_WEB_SKIP_INSTALL !== "1")
  execFileSync("npm", ["ci", "--include=dev", "--no-audit", "--no-fund"], {
    cwd: mobile,
    env,
    stdio: "inherit",
  });
execFileSync(
  "npx",
  ["expo", "export", "--platform", "web", "--output-dir", output],
  { cwd: mobile, env, stdio: "inherit" },
);
await mkdir(output, { recursive: true });
for (const size of [192, 512])
  await sharp(path.join(mobile, "assets/icon.png"))
    .resize(size, size)
    .png()
    .toFile(path.join(output, `icon-${size}.png`));
await sharp(path.join(mobile, "assets/icon.png"))
  .resize(180, 180)
  .png()
  .toFile(path.join(output, "apple-touch-icon.png"));
await sharp(path.join(mobile, "assets/icon.png"))
  .resize(96, 96)
  .png()
  .toFile(path.join(output, "badge.png"));
const manifest = {
  id: "/app/",
  name: "Cookies · فريق كوكيز",
  short_name: "Cookies",
  lang: "ar",
  dir: "rtl",
  description: "أعمال الفريق وفصوله ومستحقاته في مساحة واحدة.",
  start_url: "/app/",
  scope: "/",
  display: "standalone",
  background_color: "#08090D",
  theme_color: "#08090D",
  icons: [
    {
      src: "/app/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/app/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
};
await writeFile(
  path.join(output, "manifest.webmanifest"),
  JSON.stringify(manifest),
);
await copyFile(path.join(mobile, "web/pwa.js"), path.join(output, "pwa.js"));
let html = await readFile(path.join(output, "index.html"), "utf8");
html = html
  .replace(/<html[^>]*>/, '<html lang="ar">')
  .replace(
    "</head>",
    '<meta name="theme-color" content="#08090D"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Cookies"><link rel="manifest" href="/app/manifest.webmanifest"><link rel="apple-touch-icon" href="/app/apple-touch-icon.png"><script defer src="/app/pwa.js"></script></head>',
  );
await writeFile(path.join(output, "index.html"), html);
const assetUrls = [
  ...html.matchAll(/(?:src|href)="(\/app\/[^"?]+\.(?:js|css))"/g),
].map((match) => match[1]);
const localAssets = (
  await readdir(path.join(output, "assets"), { recursive: true })
)
  .filter((file) => /\.(?:ttf|png|woff2?)$/.test(file))
  .map((file) => "/app/assets/" + file.replaceAll("\\", "/"));
const version = createHash("sha256").update(html).digest("hex").slice(0, 16);
const sw = (await readFile(path.join(mobile, "web/sw.js"), "utf8"))
  .replace("__COOKIES_CACHE__", JSON.stringify(`cookies-shell-${version}`))
  .replace(
    "__COOKIES_SHELL__",
    JSON.stringify([
      "/app/index.html",
      "/app/manifest.webmanifest",
      "/app/icon-192.png",
      "/app/icon-512.png",
      "/app/apple-touch-icon.png",
      ...assetUrls,
      ...localAssets,
    ]),
  );
await writeFile(path.join(output, "sw.js"), sw);
console.log(
  `Cookies ${config.version} web shell exported at /app/. No private environment variables were passed to Expo.`,
);
