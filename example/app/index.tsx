import { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { Video, ResizeMode } from "expo-av";
import { run, getVersion, FFmpegError } from "ffmpeg-expo";
import type { FFmpegProgress, FFmpegSession } from "ffmpeg-expo";

interface ProcessingState {
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
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    speed: "",
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
      logs: [
        ...prev.logs.slice(-50),
        `[${new Date().toLocaleTimeString()}] ${message}`,
      ],
    }));
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please grant access to your media library"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const info = new File(uri).info();

      setState((prev) => ({
        ...prev,
        inputUri: uri,
        outputUri: null,
        inputSize: info.size || 0,
        outputSize: 0,
        logs: [],
        progress: 0,
      }));

      addLog(`Selected video: ${uri.split("/").pop()}`);
      addLog(`Input size: ${formatBytes(info.size || 0)}`);
    }
  };

  const remuxVideo = async () => {
    if (!state.inputUri) {
      Alert.alert("No video selected", "Please select a video first");
      return;
    }

    // Generate output path
    const outputFileName = `remuxed_${Date.now()}.mp4`;
    const outputUri = new File(Paths.cache, outputFileName).uri;

    setState((prev) => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      speed: "",
      outputUri: null,
      outputSize: 0,
    }));

    addLog("Starting remux/copy operation");

    try {
      const startTime = Date.now();

      // Current native execution supports a basic input-to-output remux/copy path.
      const args = [
        "-i",
        state.inputUri,
        "-y",
        outputUri,
      ];

      addLog(`Command: ffmpeg ${args.join(" ")}`);

      // Run FFmpeg with progress tracking
      const session = run(args, {
        onProgress: (progress: FFmpegProgress) => {
          setState((prev) => ({
            ...prev,
            progress: prev.progress,
            speed: progress.speed ? `${progress.speed.toFixed(1)}x` : "",
          }));
        },
        onLog: (log) => {
          if (log.level === "error" || log.level === "warning") {
            addLog(`[${log.level}] ${log.message}`);
          }
        },
        logLevel: "warning",
      });

      sessionRef.current = session;

      // Wait for completion
      const result = await session.result;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.returnCode === 0) {
        // Get output file size
        const outputInfo = new File(outputUri).info();
        const outputSize = outputInfo.size || 0;
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          progress: 100,
          outputUri,
          outputSize,
        }));

        addLog(`Remux complete in ${elapsed}s`);
        addLog(`Output size: ${formatBytes(outputSize)}`);
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

      Alert.alert("Operation failed", (error as Error).message);
    } finally {
      sessionRef.current = null;
    }
  };

  const cancelOperation = async () => {
    if (sessionRef.current) {
      addLog("Cancelling operation...");
      await sessionRef.current.cancel();
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        progress: 0,
      }));
      addLog("Operation cancelled");
    }
  };

  const showVersion = () => {
    try {
      const version = getVersion();
      Alert.alert(
        "FFmpeg Version",
        `${version.version}\n\nMajor: ${version.major}\nMinor: ${version.minor}\nPatch: ${version.patch}`
      );
      addLog(`FFmpeg version: ${version.version}`);
    } catch (error) {
      Alert.alert("Error", "Could not get FFmpeg version");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Video Remux Demo</Text>
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
            {state.inputUri ? "Change Video" : "Select Video"}
          </Text>
        </TouchableOpacity>

        {state.inputUri && (
          <View style={styles.videoInfo}>
            <Text style={styles.infoText}>
              Input: {formatBytes(state.inputSize)}
            </Text>
            {state.outputSize > 0 && (
              <Text style={styles.infoText}>
                Output: {formatBytes(state.outputSize)}
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

      {/* Processing Controls */}
      {state.inputUri && !state.isProcessing && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={remuxVideo}
          >
            <Text style={styles.buttonText}>Remux Video</Text>
          </TouchableOpacity>
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
              Processing {state.speed && `(${state.speed})`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={cancelOperation}
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
              <Text style={styles.logPlaceholder}>
                Logs will appear here...
              </Text>
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  versionButton: {
    padding: 8,
  },
  versionButtonText: {
    color: "#007AFF",
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
    marginTop: 12,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  videoInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  previewSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  videoContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  video: {
    width: "100%",
    height: 150,
    backgroundColor: "#000",
    borderRadius: 8,
  },
  progressContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  progressText: {
    marginTop: 8,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  logContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    height: 200,
  },
  logScroll: {
    flex: 1,
  },
  logPlaceholder: {
    color: "#666",
    fontFamily: "monospace",
    fontSize: 12,
  },
  logText: {
    color: "#0f0",
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
  },
});
