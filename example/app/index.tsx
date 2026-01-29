import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
import { run, execute, getVersion, FFmpegError } from 'ffmpeg-expo';
import type { FFmpegProgress, FFmpegSession } from 'ffmpeg-expo';

type CompressionPreset = 'fast' | 'balanced' | 'quality';

interface CompressionState {
  isProcessing: boolean;
  progress: number;
  speed: string;
  inputUri: string | null;
  outputUri: string | null;
  inputSize: number;
  outputSize: number;
  logs: string[];
}

export default function HomeScreen() {
  const [state, setState] = useState<CompressionState>({
    isProcessing: false,
    progress: 0,
    speed: '',
    inputUri: null,
    outputUri: null,
    inputSize: 0,
    outputSize: 0,
    logs: [],
  });

  const sessionRef = useRef<FFmpegSession | null>(null);

  const addLog = (message: string) => {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-50), `[${new Date().toLocaleTimeString()}] ${message}`],
    }));
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please grant access to your media library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const info = await FileSystem.getInfoAsync(uri);

      setState((prev) => ({
        ...prev,
        inputUri: uri,
        outputUri: null,
        inputSize: (info as any).size || 0,
        outputSize: 0,
        logs: [],
        progress: 0,
      }));

      addLog(`Selected video: ${uri.split('/').pop()}`);
      addLog(`Input size: ${formatBytes((info as any).size || 0)}`);
    }
  };

  const compressVideo = async (preset: CompressionPreset) => {
    if (!state.inputUri) {
      Alert.alert('No video selected', 'Please select a video first');
      return;
    }

    // Get FFmpeg settings based on preset
    const settings = getCompressionSettings(preset);

    // Generate output path
    const outputFileName = `compressed_${Date.now()}.mp4`;
    const outputUri = `${FileSystem.cacheDirectory}${outputFileName}`;

    setState((prev) => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      speed: '',
      outputUri: null,
      outputSize: 0,
    }));

    addLog(`Starting compression with "${preset}" preset`);
    addLog(`CRF: ${settings.crf}, Preset: ${settings.preset}`);

    try {
      const startTime = Date.now();

      // Build FFmpeg command
      const args = [
        '-i', state.inputUri,
        '-c:v', 'libx264',
        '-preset', settings.preset,
        '-crf', settings.crf.toString(),
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        outputUri,
      ];

      addLog(`Command: ffmpeg ${args.join(' ')}`);

      // Run FFmpeg with progress tracking
      const session = run(args, {
        onProgress: (progress: FFmpegProgress) => {
          const percent = progress.totalDuration
            ? Math.min(100, (progress.time / progress.totalDuration) * 100)
            : 0;

          setState((prev) => ({
            ...prev,
            progress: percent,
            speed: progress.speed ? `${progress.speed.toFixed(1)}x` : '',
          }));
        },
        onLog: (log) => {
          if (log.level === 'error' || log.level === 'warning') {
            addLog(`[${log.level}] ${log.message}`);
          }
        },
        logLevel: 'warning',
      });

      sessionRef.current = session;

      // Wait for completion
      const result = await session.result;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.returnCode === 0) {
        // Get output file size
        const outputInfo = await FileSystem.getInfoAsync(outputUri);
        const outputSize = (outputInfo as any).size || 0;
        const compressionRatio = state.inputSize > 0
          ? ((1 - outputSize / state.inputSize) * 100).toFixed(1)
          : '0';

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          outputUri,
          outputSize,
        }));

        addLog(`Compression complete in ${elapsed}s`);
        addLog(`Output size: ${formatBytes(outputSize)} (${compressionRatio}% smaller)`);
      } else {
        throw new Error(`FFmpeg exited with code ${result.returnCode}`);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        progress: 0,
      }));

      if (error instanceof FFmpegError) {
        addLog(`Error: ${error.message}`);
        addLog(`Output: ${error.output.slice(-500)}`);
      } else {
        addLog(`Error: ${(error as Error).message}`);
      }

      Alert.alert('Compression failed', (error as Error).message);
    } finally {
      sessionRef.current = null;
    }
  };

  const cancelCompression = async () => {
    if (sessionRef.current) {
      addLog('Cancelling compression...');
      await sessionRef.current.cancel();
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        progress: 0,
      }));
      addLog('Compression cancelled');
    }
  };

  const showVersion = () => {
    try {
      const version = getVersion();
      Alert.alert('FFmpeg Version', `${version.version}\n\nMajor: ${version.major}\nMinor: ${version.minor}\nPatch: ${version.patch}`);
      addLog(`FFmpeg version: ${version.version}`);
    } catch (error) {
      Alert.alert('Error', 'Could not get FFmpeg version');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Video Compression Demo</Text>
        <TouchableOpacity style={styles.versionButton} onPress={showVersion}>
          <Text style={styles.versionButtonText}>FFmpeg Info</Text>
        </TouchableOpacity>
      </View>

      {/* Video Selection */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={pickVideo}
          disabled={state.isProcessing}
        >
          <Text style={styles.buttonText}>
            {state.inputUri ? 'Change Video' : 'Select Video'}
          </Text>
        </TouchableOpacity>

        {state.inputUri && (
          <View style={styles.videoInfo}>
            <Text style={styles.infoText}>
              Input: {formatBytes(state.inputSize)}
            </Text>
            {state.outputSize > 0 && (
              <Text style={styles.infoText}>
                Output: {formatBytes(state.outputSize)} (
                {((1 - state.outputSize / state.inputSize) * 100).toFixed(1)}% smaller)
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Video Preview */}
      {(state.inputUri || state.outputUri) && (
        <View style={styles.previewSection}>
          {state.inputUri && (
            <View style={styles.videoContainer}>
              <Text style={styles.label}>Input</Text>
              <Video
                source={{ uri: state.inputUri }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            </View>
          )}
          {state.outputUri && (
            <View style={styles.videoContainer}>
              <Text style={styles.label}>Output</Text>
              <Video
                source={{ uri: state.outputUri }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            </View>
          )}
        </View>
      )}

      {/* Compression Controls */}
      {state.inputUri && !state.isProcessing && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compression Preset</Text>
          <View style={styles.presetButtons}>
            <TouchableOpacity
              style={[styles.presetButton, styles.fastPreset]}
              onPress={() => compressVideo('fast')}
            >
              <Text style={styles.presetButtonText}>Fast</Text>
              <Text style={styles.presetDescription}>Quick, larger file</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.balancedPreset]}
              onPress={() => compressVideo('balanced')}
            >
              <Text style={styles.presetButtonText}>Balanced</Text>
              <Text style={styles.presetDescription}>Good mix</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.presetButton, styles.qualityPreset]}
              onPress={() => compressVideo('quality')}
            >
              <Text style={styles.presetButtonText}>Quality</Text>
              <Text style={styles.presetDescription}>Slow, smaller file</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Progress */}
      {state.isProcessing && (
        <View style={styles.section}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${state.progress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {state.progress.toFixed(0)}% {state.speed && `(${state.speed})`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={cancelCompression}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logs</Text>
        <View style={styles.logContainer}>
          <ScrollView style={styles.logScroll} nestedScrollEnabled>
            {state.logs.length === 0 ? (
              <Text style={styles.logPlaceholder}>Logs will appear here...</Text>
            ) : (
              state.logs.map((log, index) => (
                <Text key={index} style={styles.logText}>
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}

// Helper functions
function getCompressionSettings(preset: CompressionPreset) {
  switch (preset) {
    case 'fast':
      return { crf: 28, preset: 'veryfast' };
    case 'balanced':
      return { crf: 23, preset: 'medium' };
    case 'quality':
      return { crf: 18, preset: 'slow' };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  versionButton: {
    padding: 8,
  },
  versionButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    marginTop: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  videoInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  previewSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  videoContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  video: {
    width: '100%',
    height: 150,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fastPreset: {
    backgroundColor: '#34C759',
  },
  balancedPreset: {
    backgroundColor: '#007AFF',
  },
  qualityPreset: {
    backgroundColor: '#5856D6',
  },
  presetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  presetDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  logContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    height: 200,
  },
  logScroll: {
    flex: 1,
  },
  logPlaceholder: {
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  logText: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
