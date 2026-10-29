module.exports = function (api) {
  api.cache(true);
  return {
    // SDK 54 configures the Worklets/Reanimated plugin through this preset.
    presets: ['babel-preset-expo'],
  };
};
