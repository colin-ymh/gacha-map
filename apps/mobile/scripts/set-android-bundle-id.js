#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

if (process.env.EAS_BUILD_PROFILE !== "production") {
  process.exit(0);
}

const buildGradlePath = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "build.gradle",
);
if (!fs.existsSync(buildGradlePath)) {
  process.exit(0);
}

let gradle = fs.readFileSync(buildGradlePath, "utf8");
gradle = gradle.replace(
  /applicationId 'com\.gachamap\.app\.dev'/,
  "applicationId 'com.gachamap.app'",
);
fs.writeFileSync(buildGradlePath, gradle);

console.log(
  "[eas-build-pre-install] production build: applicationId -> com.gachamap.app",
);
