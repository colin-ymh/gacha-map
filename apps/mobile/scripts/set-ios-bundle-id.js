#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

if (process.env.EAS_BUILD_PROFILE !== "production") {
  process.exit(0);
}

const pbxprojPath = path.join(__dirname, "..", "ios", "app.xcodeproj", "project.pbxproj");
const infoPlistPath = path.join(__dirname, "..", "ios", "app", "Info.plist");

let pbxproj = fs.readFileSync(pbxprojPath, "utf8");
pbxproj = pbxproj.replace(
  /PRODUCT_BUNDLE_IDENTIFIER = com\.gachamap\.app\.dev;/g,
  "PRODUCT_BUNDLE_IDENTIFIER = com.gachamap.app;"
);
fs.writeFileSync(pbxprojPath, pbxproj);

let infoPlist = fs.readFileSync(infoPlistPath, "utf8");
infoPlist = infoPlist.replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>GachaMap Dev<\/string>/,
  "<key>CFBundleDisplayName</key>\n    <string>GachaMap</string>"
);
fs.writeFileSync(infoPlistPath, infoPlist);

console.log("[eas-build-pre-install] production build: bundle id -> com.gachamap.app, name -> GachaMap");
