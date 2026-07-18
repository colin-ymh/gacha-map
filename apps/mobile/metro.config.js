const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

const pnpmStoreDir = path.resolve(workspaceRoot, "node_modules/.pnpm");
config.watchFolders = [
  workspaceRoot,
  ...(fs.existsSync(pnpmStoreDir) ? [pnpmStoreDir] : []),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

// pnpm symlink를 따라가지 못하는 경우: node_modules 내 symlink를 실제 경로로 매핑
function buildExtraNodeModules(pkgNames) {
  const result = {};
  for (const name of pkgNames) {
    const symPath = path.resolve(projectRoot, "node_modules", name);
    if (fs.existsSync(symPath)) {
      try { result[name] = fs.realpathSync(symPath); } catch (_) {}
    }
  }
  return result;
}
config.resolver.extraNodeModules = buildExtraNodeModules([
  "@uginy/react-native-liquid-glass",
]);

// pnpm monorepo에서 React 단일 인스턴스 강제 (resolveRequest로 전체 차단)
const singletonModules = ["react", "react-dom", "react-native", "react-redux"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonModules.includes(moduleName)) {
    // origin을 app 루트로 교체해 항상 apps/mobile/node_modules에서 찾게 한다
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "index.js") },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
