#!/usr/bin/env node
// production EAS 빌드에서만 Android FCM(google-services) 배선을 적용한다.
// 로컬/ dev 빌드는 .dev 번들이라 google-services.json(com.gachamap.app)과 패키지가
// 안 맞아 gradle 플러그인이 실패하므로, production일 때만 처리한다.
// (set-android-bundle-id.js 이후에 실행되어 applicationId가 com.gachamap.app로 패치된 상태)
const fs = require("fs");
const path = require("path");

if (process.env.EAS_BUILD_PROFILE !== "production") {
  process.exit(0);
}

const androidDir = path.join(__dirname, "..", "android");
const projectGradlePath = path.join(androidDir, "build.gradle");
const appGradlePath = path.join(androidDir, "app", "build.gradle");
const gsDest = path.join(androidDir, "app", "google-services.json");
const gsSrc = process.env.GOOGLE_SERVICES_JSON;

// 1. EAS 시크릿(file)으로 받은 google-services.json을 android/app/로 복사
if (!gsSrc || !fs.existsSync(gsSrc)) {
  console.warn(
    "[eas-build-pre-install] GOOGLE_SERVICES_JSON 미존재 — FCM 배선 생략",
  );
  process.exit(0);
}
fs.copyFileSync(gsSrc, gsDest);
console.log("[eas-build-pre-install] google-services.json -> android/app/");

// 2. project build.gradle buildscript classpath 추가
let proj = fs.readFileSync(projectGradlePath, "utf8");
if (!proj.includes("com.google.gms:google-services")) {
  proj = proj.replace(
    /(classpath\('org\.jetbrains\.kotlin:kotlin-gradle-plugin'\))/,
    "$1\n    classpath('com.google.gms:google-services:4.4.2')",
  );
  fs.writeFileSync(projectGradlePath, proj);
  console.log("[eas-build-pre-install] google-services classpath 추가");
}

// 3. app build.gradle 플러그인 적용
let app = fs.readFileSync(appGradlePath, "utf8");
if (!app.includes("com.google.gms.google-services")) {
  app = app.replace(
    /(apply plugin: "com\.facebook\.react")/,
    '$1\napply plugin: "com.google.gms.google-services"',
  );
  fs.writeFileSync(appGradlePath, app);
  console.log("[eas-build-pre-install] google-services 플러그인 적용");
}
