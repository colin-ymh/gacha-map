const {
  withAppBuildGradle,
  withSettingsGradle,
  withAndroidManifest,
} = require("expo/config-plugins");

function withNaverMapKeyFix(config) {
  const key = process.env.NAVER_MAP_CLIENT_ID || "rfmuaty2n4";
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app?.["meta-data"]) return mod;
    app["meta-data"] = app["meta-data"]
      .filter(
        (m) => m.$?.["android:name"] !== "com.naver.maps.map.NCP_KEY_ID",
      )
      .map((m) => {
        if (m.$?.["android:name"] === "com.naver.maps.map.CLIENT_ID") {
          return { $: { "android:name": "com.naver.maps.map.CLIENT_ID", "android:value": key } };
        }
        return m;
      });
    return mod;
  });
}

function withExpoAutolinkingFix(config) {
  return withSettingsGradle(config, (mod) => {
    const contents = mod.modResults.contents;
    if (contents.includes("expo-modules-autolinking")) return mod;
    mod.modResults.contents =
      contents +
      '\napply from: new File(["node", "--print", "require.resolve(\'expo-modules-autolinking/package.json\')"].execute(null, rootDir).text.trim(), "../android/autolinking.gradle")\n';
    return mod;
  });
}

function withAndroidBrowserFix(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("force 'androidx.browser:browser")) {
      return mod;
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      /android {/,
      "configurations.all {\n    resolutionStrategy {\n        force 'androidx.browser:browser:1.8.0'\n    }\n}\n\nandroid {",
    );
    return mod;
  });
}

module.exports = ({ config }) => {
  const appConfig = {
    ...config,
    name: "가챠맵",
    slug: "gacha-map",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "gacha-map",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    icon: "./assets/images/icon.png",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      bundleIdentifier: "com.gachamap.app",
      supportsTablet: false,
    },
    android: {
      package: "com.gachamap.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            extraMavenRepos: ["https://repository.map.naver.com/archive/maven"],
          },
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "가챠맵이 내 위치를 사용하여 주변 가챠 상점을 표시합니다.",
        },
      ],
      [
        "@mj-studio/react-native-naver-map",
        {
          ios: {
            naverMapApiKey: process.env.NAVER_MAP_CLIENT_ID || "rfmuaty2n4",
          },
          android: {
            naverMapApiKey: process.env.NAVER_MAP_CLIENT_ID || "rfmuaty2n4",
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "367c4981-9fb3-44a3-9282-fa97e67674a2",
      },
    },
    experiments: {
      typedRoutes: true,
    },
  };

  return withExpoAutolinkingFix(withAndroidBrowserFix(withNaverMapKeyFix(appConfig)));
};
