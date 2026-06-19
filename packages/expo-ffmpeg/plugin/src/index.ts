import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';
import { withFFmpegAndroid } from './withFFmpegAndroid';
import { withFFmpegIOS } from './withFFmpegIOS';

const pkg = require('../../package.json');

export interface FFmpegPluginProps {
  /**
   * Include x86_64 ABI for Android emulators (increases APK size)
   * @default false
   */
  includeX86?: boolean;

  /**
   * Reserved/experimental. Currently only written to iOS Podfile properties;
   * the postinstall downloader does not consume it.
   */
  binaryUrl?: string;

  /**
   * Android-specific NDK version
   * @default "26.1.10909125"
   */
  ndkVersion?: string;
}

const withFFmpeg: ConfigPlugin<FFmpegPluginProps | void> = (config, props = {}) => {
  const {
    includeX86 = false,
    binaryUrl,
    ndkVersion = '26.1.10909125',
  } = props || {};

  // Apply Android modifications
  config = withFFmpegAndroid(config, { includeX86, ndkVersion });

  // Apply iOS modifications
  config = withFFmpegIOS(config, { binaryUrl });

  return config;
};

export default createRunOncePlugin(withFFmpeg, pkg.name, pkg.version);

export { withFFmpegAndroid } from './withFFmpegAndroid';
export { withFFmpegIOS } from './withFFmpegIOS';
