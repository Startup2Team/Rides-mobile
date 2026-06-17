module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    // Required for react-native-reanimated v4 (uses react-native-worklets).
    // Must be last in the plugins list.
    plugins: ['react-native-reanimated/plugin'],
  };
};
