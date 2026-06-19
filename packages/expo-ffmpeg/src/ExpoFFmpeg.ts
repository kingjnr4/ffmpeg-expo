import { EventEmitter, requireNativeModule } from 'expo-modules-core';
import type {
  FFmpegResult,
  FFmpegProgress,
  FFmpegLog,
  FFmpegLogLevel,
  FFmpegSession,
  FFmpegVersion,
  RunOptions,
  NativeFFmpegModule,
} from './ExpoFFmpeg.types';

// Event types for the emitter (values must be listener signatures)
type FFmpegEvents = {
  onProgress: (event: FFmpegProgress) => void;
  onLog: (event: FFmpegLog) => void;
};

// Get the native module through the Expo Modules JSI-first loader.
const ExpoFFmpegModule = requireNativeModule<NativeFFmpegModule>('ExpoFFmpeg');
const emitter = new EventEmitter<FFmpegEvents>(ExpoFFmpegModule as any);

// Log level mapping (index = FFmpeg's internal level)
const LOG_LEVELS: FFmpegLogLevel[] = [
  'quiet',
  'panic',
  'fatal',
  'error',
  'warning',
  'info',
  'verbose',
  'debug',
  'trace',
];

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `ffmpeg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Execute an FFmpeg command
 *
 * @param args FFmpeg arguments (without 'ffmpeg' prefix)
 * @param options Execution options
 * @returns Session object with cancel capability and result promise
 *
 * @example
 * ```typescript
 * const session = run([
 *   '-i', inputPath,
 *   '-y',
 *   outputPath
 * ], {
 *   onProgress: (p) => console.log(`${p.time}ms processed`)
 * });
 *
 * const result = await session.result;
 * ```
 */
export function run(args: string[], options: RunOptions = {}): FFmpegSession {
  const sessionId = generateSessionId();
  const { onProgress, onLog, logLevel = 'warning', env } = options;

  // Track subscriptions for cleanup
  const subscriptions: (() => void)[] = [];

  // Set up progress listener
  if (onProgress) {
    const subscription = emitter.addListener(
      'onProgress',
      (event: FFmpegProgress) => {
        if (event.sessionId === sessionId) {
          onProgress(event);
        }
      }
    );
    subscriptions.push(() => subscription.remove());
  }

  // Set up log listener
  if (onLog) {
    const subscription = emitter.addListener('onLog', (event: FFmpegLog) => {
      if (event.sessionId === sessionId) {
        onLog(event);
      }
    });
    subscriptions.push(() => subscription.remove());
  }

  // Cleanup function
  const cleanup = () => {
    subscriptions.forEach((unsub) => unsub());
  };

  // Execute FFmpeg
  const resultPromise = ExpoFFmpegModule.run(sessionId, args, {
    logLevel: LOG_LEVELS.indexOf(logLevel),
    environmentVariables: env,
  }).finally(cleanup);

  return {
    id: sessionId,
    cancel: () => ExpoFFmpegModule.cancel(sessionId),
    result: resultPromise,
  };
}

/**
 * Execute an FFmpeg command and await the result
 *
 * @param args FFmpeg arguments (without 'ffmpeg' prefix)
 * @param options Execution options
 * @returns Promise resolving to the execution result
 * @throws FFmpegError if the command fails
 *
 * @example
 * ```typescript
 * try {
 *   const result = await execute(['-i', input, '-y', output]);
 *   console.log('Success!', result.duration);
 * } catch (error) {
 *   if (error instanceof FFmpegError) {
 *     console.error('FFmpeg failed:', error.output);
 *   }
 * }
 * ```
 */
export async function execute(
  args: string[],
  options?: RunOptions
): Promise<FFmpegResult> {
  const session = run(args, options);
  const result = await session.result;

  if (result.returnCode !== 0) {
    throw new FFmpegError(
      `FFmpeg exited with code ${result.returnCode}`,
      result.returnCode,
      result.output
    );
  }

  return result;
}

/**
 * Get FFmpeg version information
 */
export function getVersion(): FFmpegVersion {
  const versionString = ExpoFFmpegModule.getVersion();
  const match = versionString.match(/(\d+)\.(\d+)(?:\.(\d+))?/);

  return {
    version: versionString,
    major: match ? parseInt(match[1], 10) : 0,
    minor: match ? parseInt(match[2], 10) : 0,
    patch: match && match[3] ? parseInt(match[3], 10) : 0,
  };
}

/**
 * Error thrown when FFmpeg command fails
 */
export class FFmpegError extends Error {
  constructor(
    message: string,
    public readonly returnCode: number,
    public readonly output: string
  ) {
    super(message);
    this.name = 'FFmpegError';
  }
}

/**
 * Error thrown when FFmpeg session is cancelled
 */
export class FFmpegCancelledError extends Error {
  constructor(public readonly sessionId: string) {
    super(`FFmpeg session ${sessionId} was cancelled`);
    this.name = 'FFmpegCancelledError';
  }
}
