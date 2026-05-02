const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withAndroidBrowserFix(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes("force 'androidx.browser:browser")) {
      return config;
    }
    config.modResults.contents = config.modResults.contents.replace(
      /android {/,
      `configurations.all {
    resolutionStrategy {
        force 'androidx.browser:browser:1.8.0'
    }
}

android {`
    );
    return config;
  });
};
