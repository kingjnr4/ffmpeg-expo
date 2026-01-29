// Type definitions for expo-ffmpeg

/**
 * Result returned after FFmpeg command execution
 */
export interface FFmpegResult {
  /** Exit code from FFmpeg (0 = success) */
  returnCode: number;
  /** Combined stdout/stderr output */
  output: string;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Progress information emitted during FFmpeg execution
 */
export interface FFmpegProgress {
  /** Session identifier */
  sessionId: string;
  /** Current time position in milliseconds */
  time: number;
  /** Current bitrate in kbits/s */
  bitrate: number;
  /** Processing speed (e.g., 1.5 = 1.5x realtime) */
  speed: number;
  /** Current frame number (video only) */
  frame?: number;
  /** Frames per second (video only) */
  fps?: number;
  /** Output size in bytes */
  size?: number;
  /** Total duration in milliseconds (if known) */
  totalDuration?: number;
}

/**
 * Log levels matching FFmpeg's internal levels
 */
export type FFmpegLogLevel =
  | 'quiet'
  | 'panic'
  | 'fatal'
  | 'error'
  | 'warning'
  | 'info'
  | 'verbose'
  | 'debug'
  | 'trace';

/**
 * Log message from FFmpeg
 */
export interface FFmpegLog {
  /** Session identifier */
  sessionId: string;
  /** Log level */
  level: FFmpegLogLevel;
  /** Log message content */
  message: string;
}

/**
 * Options for FFmpeg execution
 */
export interface RunOptions {
  /** Called on progress updates (~1/sec) */
  onProgress?: (progress: FFmpegProgress) => void;
  /** Called on log output */
  onLog?: (log: FFmpegLog) => void;
  /** Log level filter (default: 'warning') */
  logLevel?: FFmpegLogLevel;
  /** Environment variables to set */
  env?: Record<string, string>;
}

/**
 * Active FFmpeg session with cancellation support
 */
export interface FFmpegSession {
  /** Unique session identifier */
  id: string;
  /** Cancel this session */
  cancel(): Promise<boolean>;
  /** Promise that resolves when complete */
  result: Promise<FFmpegResult>;
}

/**
 * FFmpeg version information
 */
export interface FFmpegVersion {
  /** Full version string */
  version: string;
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
}

/**
 * Native module interface (internal)
 */
export interface NativeFFmpegModule {
  run(
    sessionId: string,
    args: string[],
    options: {
      logLevel: number;
      environmentVariables?: Record<string, string>;
    }
  ): Promise<{
    returnCode: number;
    output: string;
    duration: number;
  }>;
  cancel(sessionId: string): Promise<boolean>;
  getVersion(): string;
}
