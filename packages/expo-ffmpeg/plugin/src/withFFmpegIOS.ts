import {
  ConfigPlugin,
  withXcodeProject,
  withPodfileProperties,
} from '@expo/config-plugins';

interface IOSPluginProps {
  binaryUrl?: string;
}

export const withFFmpegIOS: ConfigPlugin<IOSPluginProps> = (
  config,
  { binaryUrl }
) => {
  config = withPodfileProperties(config, (config) => {
    if (binaryUrl) {
      config.modResults['EXPO_FFMPEG_BINARY_URL'] = binaryUrl;
    }
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;

    const buildSettings = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in buildSettings) {
      const setting = buildSettings[key];
      
      if (typeof setting !== 'object' || !setting.buildSettings) {
        continue;
      }

      const bs = setting.buildSettings;

      // FFmpeg does not support bitcode reliably.
      bs.ENABLE_BITCODE = 'NO';

      const existingPaths = bs.FRAMEWORK_SEARCH_PATHS || ['$(inherited)'];
      const ffmpegPath = '"$(PODS_ROOT)/../../node_modules/ffmpeg-expo/ios/Frameworks"';
      
      if (Array.isArray(existingPaths)) {
        if (!existingPaths.includes(ffmpegPath)) {
          bs.FRAMEWORK_SEARCH_PATHS = [...existingPaths, ffmpegPath];
        }
      } else {
        bs.FRAMEWORK_SEARCH_PATHS = [existingPaths, ffmpegPath];
      }

      const existingHeaderPaths = bs.HEADER_SEARCH_PATHS || ['$(inherited)'];
      const ffmpegHeaderPath = '"$(PODS_ROOT)/../../node_modules/ffmpeg-expo/ios/Frameworks/FFmpeg.xcframework/ios-arm64/Headers"';
      
      if (Array.isArray(existingHeaderPaths)) {
        if (!existingHeaderPaths.includes(ffmpegHeaderPath)) {
          bs.HEADER_SEARCH_PATHS = [...existingHeaderPaths, ffmpegHeaderPath];
        }
      } else {
        bs.HEADER_SEARCH_PATHS = [existingHeaderPaths, ffmpegHeaderPath];
      }

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
