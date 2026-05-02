const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm monorepo에서 React 중복 인스턴스 방지
config.resolver.extraNodeModules = new Proxy(
  {
    react: path.resolve(projectRoot, "node_modules/react"),
    "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
    "react-native": path.resolve(projectRoot, "node_modules/react-native"),
    "react-native/Libraries/Utilities/codegenNativeCommands": path.resolve(
      projectRoot,
      "node_modules/react-native/Libraries/Utilities/codegenNativeCommands"
    ),
  },
  {
    get: (target, name) =>
      name in target
        ? target[name]
        : path.join(projectRoot, "node_modules", name),
  }
);

module.exports = withNativeWind(config, { input: "./global.css" });
