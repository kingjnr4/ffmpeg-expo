import {
  ConfigPlugin,
  withXcodeProject,
  withPodfileProperties,
} from '@expo/config-plugins';

interface IOSPluginProps {
  binaryUrl?: string;
}

/**
 * Modifies iOS Xcode project and Podfile for FFmpeg integration
 */
export const withFFmpegIOS: ConfigPlugin<IOSPluginProps> = (
  config,
  { binaryUrl }
) => {
  // Configure Podfile properties if needed
  config = withPodfileProperties(config, (config) => {
    // Can be used to pass configuration to the podspec
    if (binaryUrl) {
      config.modResults['EXPO_FFMPEG_BINARY_URL'] = binaryUrl;
    }
    return config;
  });

  // Modify Xcode project settings
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;

    // Get all build configurations
    const buildSettings = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in buildSettings) {
      const setting = buildSettings[key];
      
      // Skip non-object entries
      if (typeof setting !== 'object' || !setting.buildSettings) {
        continue;
      }

      const bs = setting.buildSettings;

      // Disable bitcode (FFmpeg doesn't support it reliably)
      bs.ENABLE_BITCODE = 'NO';

      // Add framework search paths for the XCFramework
      const existingPaths = bs.FRAMEWORK_SEARCH_PATHS || ['$(inherited)'];
      const ffmpegPath = '"$(PODS_ROOT)/../../node_modules/expo-ffmpeg/ios/Frameworks"';
      
      if (Array.isArray(existingPaths)) {
        if (!existingPaths.includes(ffmpegPath)) {
          bs.FRAMEWORK_SEARCH_PATHS = [...existingPaths, ffmpegPath];
        }
      } else {
        bs.FRAMEWORK_SEARCH_PATHS = [existingPaths, ffmpegPath];
      }

      // Add header search paths
      const existingHeaderPaths = bs.HEADER_SEARCH_PATHS || ['$(inherited)'];
      const ffmpegHeaderPath = '"$(PODS_ROOT)/../../node_modules/expo-ffmpeg/ios/Frameworks/FFmpeg.xcframework/ios-arm64/Headers"';
      
      if (Array.isArray(existingHeaderPaths)) {
        if (!existingHeaderPaths.includes(ffmpegHeaderPath)) {
          bs.HEADER_SEARCH_PATHS = [...existingHeaderPaths, ffmpegHeaderPath];
        }
      } else {
        bs.HEADER_SEARCH_PATHS = [existingHeaderPaths, ffmpegHeaderPath];
      }

      // Add required linker flags
      const existingLdFlags = bs.OTHER_LDFLAGS || ['$(inherited)'];
      const requiredFlags = ['-lz', '-lbz2', '-liconv'];
      
      if (Array.isArray(existingLdFlags)) {
        const newFlags = requiredFlags.filter(flag => !existingLdFlags.includes(flag));
        if (newFlags.length > 0) {
          bs.OTHER_LDFLAGS = [...existingLdFlags, ...newFlags];
        }
      } else {
        bs.OTHER_LDFLAGS = [existingLdFlags, ...requiredFlags];
      }
    }

    return config;
  });

  return config;
};
