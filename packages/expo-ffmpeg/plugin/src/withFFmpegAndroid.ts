import {
  ConfigPlugin,
  withAppBuildGradle,
  withProjectBuildGradle,
  WarningAggregator,
} from '@expo/config-plugins';

interface AndroidPluginProps {
  includeX86?: boolean;
  ndkVersion?: string;
}

/**
 * Modifies Android Gradle files to support FFmpeg native libraries
 */
export const withFFmpegAndroid: ConfigPlugin<AndroidPluginProps> = (
  config,
  { includeX86 = false, ndkVersion = '26.1.10909125' }
) => {
  // Modify project-level build.gradle to set NDK version
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const contents = config.modResults.contents;

      // Add NDK version to buildscript ext if not present
      if (!contents.includes('ndkVersion')) {
        config.modResults.contents = contents.replace(
          /buildscript\s*\{(\s*ext\s*\{)?/,
          (match, hasExt) => {
            if (hasExt) {
              return match.replace(
                /ext\s*\{/,
                `ext {\n        ndkVersion = "${ndkVersion}"`
              );
            }
            return match + `\n    ext {\n        ndkVersion = "${ndkVersion}"\n    }`;
          }
        );
      }
    }
    return config;
  });

  // Modify app-level build.gradle for ABI filters and CMake
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;

      // Add ABI filters to defaultConfig
      const abiFilters = includeX86
        ? `abiFilters 'arm64-v8a', 'armeabi-v7a', 'x86_64'`
        : `abiFilters 'arm64-v8a', 'armeabi-v7a'`;

      // Check if ndk block already exists in defaultConfig
      if (!contents.includes('ndk {') || !contents.includes('abiFilters')) {
        // Find defaultConfig and add ndk block
        const defaultConfigMatch = contents.match(
          /defaultConfig\s*\{[^}]*(?=\n\s*\})/
        );
        
        if (defaultConfigMatch) {
          const ndkBlock = `\n        ndk {\n            ${abiFilters}\n        }`;
          
          // Insert before the closing brace of defaultConfig
          contents = contents.replace(
            /defaultConfig\s*\{([^}]*)(\n\s*\})/,
            (match, innerContent, closingBrace) => {
              if (!innerContent.includes('ndk {')) {
                return `defaultConfig {${innerContent}${ndkBlock}${closingBrace}`;
              }
              return match;
            }
          );
        }
      }

      config.modResults.contents = contents;
    } else {
      WarningAggregator.addWarningAndroid(
        'ffmpeg-expo',
        'Cannot configure Kotlin DSL build.gradle files automatically. Please add ndk.abiFilters manually.'
      );
    }

    return config;
  });

  return config;
};
