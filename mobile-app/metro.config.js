// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 54 can supply this old watcher flag, removed by Metro 0.83.
// It defaults to false and is no longer part of Metro's watcher schema.
delete config.watcher.unstable_workerThreads;

module.exports = config;
