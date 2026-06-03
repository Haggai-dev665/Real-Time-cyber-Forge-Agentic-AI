module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // expo-router requires this; react-native-reanimated plugin must be last.
      'react-native-reanimated/plugin',
    ],
  };
};
