const { getDefaultConfig } = require("expo/metro-config");
const makeResolver = require("@rnx-kit/metro-resolver-symlinks");
const symlinkResolver = makeResolver();
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      filePath: path.resolve(projectRoot, "mocks/react-native-maps.js"),
      type: "sourceFile",
    };
  }
  return symlinkResolver(context, moduleName, platform);
};

module.exports = config;
