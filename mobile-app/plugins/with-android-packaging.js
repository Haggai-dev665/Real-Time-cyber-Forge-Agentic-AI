const { withAppBuildGradle } = require('expo/config-plugins');

// Bouncy Castle and JSpecify include the same versioned OSGi manifest.
// Android does not use this JVM bundle metadata. Exclude only these manifests
// at the app level, where resources from all dependency JARs are merged.
const packagingRule = `// CyberForge: exclude duplicate JVM OSGi manifests.
android {
    packagingOptions {
        resources {
            excludes += ["META-INF/versions/**/OSGI-INF/MANIFEST.MF"]
        }
    }
}`;

module.exports = function withAndroidPackaging(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('CyberForge Android packaging requires a Groovy app/build.gradle.');
    }
    if (!config.modResults.contents.includes(packagingRule)) {
      config.modResults.contents = `${config.modResults.contents.trimEnd()}\n\n${packagingRule}\n`;
    }
    return config;
  });
};
