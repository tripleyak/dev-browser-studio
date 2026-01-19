// API request/response types - shared between client and server

export interface ServeOptions {
  port?: number;
  headless?: boolean;
  cdpPort?: number;
  /** Directory to store persistent browser profiles (cookies, localStorage, etc.) */
  profileDir?: string;
  /** Enable Playwright's built-in video recording for all pages */
  recordVideo?: RecordVideoOptions;
  /** Directory for CDP Screencast recordings (default: ./recordings) */
  recordingsDir?: string;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface GetPageRequest {
  name: string;
  /** Optional viewport size for new pages */
  viewport?: ViewportSize;
}

export interface GetPageResponse {
  wsEndpoint: string;
  name: string;
  targetId: string; // CDP target ID for reliable page matching
}

export interface ListPagesResponse {
  pages: string[];
}

export interface ServerInfoResponse {
  wsEndpoint: string;
}

// === Video Recording Types ===

/** Options for Playwright's built-in recordVideo (context-level) */
export interface RecordVideoOptions {
  /** Directory to save video files */
  dir: string;
  /** Optional video dimensions */
  size?: { width: number; height: number };
}

export interface StartRecordingRequest {
  options?: RecordingOptions;
}

export interface StartRecordingResponse {
  success: boolean;
  error?: string;
}

export interface RecordingStatusResponse {
  /** Whether the page is currently being recorded */
  isRecording: boolean;
  /** When recording started (ISO string) */
  startedAt?: string;
  /** Number of frames captured so far */
  frameCount?: number;
  /** Number of console logs captured so far */
  consoleLogCount?: number;
}

export interface GetVideoPathResponse {
  /** Path to video file (Playwright recordVideo) */
  videoPath?: string;
  /** Whether video is still being written */
  pending: boolean;
  error?: string;
}

// === Console Log Types ===

/** A captured console log entry */
export interface ConsoleLogEntry {
  /** Timestamp when the log was captured (ISO string) */
  timestamp: string;
  /** Log level: log, warn, error, info, debug */
  level: "log" | "warn" | "error" | "info" | "debug" | "trace";
  /** The log message text */
  text: string;
  /** URL of the page where the log occurred */
  url?: string;
  /** Line number in source */
  lineNumber?: number;
  /** Column number in source */
  columnNumber?: number;
}

/** Response for getting console logs */
export interface GetConsoleLogsResponse {
  /** Array of console log entries */
  logs: ConsoleLogEntry[];
  /** Total number of logs captured */
  count: number;
}

/** Response for clearing console logs */
export interface ClearConsoleLogsResponse {
  success: boolean;
  /** Number of logs cleared */
  cleared: number;
}

// === Enhanced Recording Types ===

/** Options for per-page CDP Screencast recording - enhanced */
export interface RecordingOptions {
  /** Max width for screencast frames (default: 1280) */
  maxWidth?: number;
  /** Max height for screencast frames (default: 720) */
  maxHeight?: number;
  /** JPEG quality 0-100 (default: 80) */
  quality?: number;
  /** Capture every Nth frame (default: 1) */
  everyNthFrame?: number;
  /** Capture console logs during recording (default: true) */
  captureConsoleLogs?: boolean;
  /** Extract key frames as separate images (default: true) */
  extractKeyFrames?: boolean;
  /** Number of key frames to extract (default: 5) */
  keyFrameCount?: number;
}

/** Enhanced stop recording response with AI-parseable data */
export interface StopRecordingResponse {
  success: boolean;
  /** Path to the recorded video file */
  videoPath?: string;
  /** Recording duration in milliseconds */
  durationMs?: number;
  /** Number of frames captured */
  frameCount?: number;
  /** Console logs captured during recording */
  consoleLogs?: ConsoleLogEntry[];
  /** Paths to extracted key frame images (for AI to view) */
  keyFramePaths?: string[];
  /** Path to the recording summary JSON file */
  summaryPath?: string;
  error?: string;
}

/** Recording summary - AI-parseable JSON file */
export interface RecordingSummary {
  /** Recording metadata */
  recording: {
    videoPath: string;
    durationMs: number;
    frameCount: number;
    startedAt: string;
    stoppedAt: string;
  };
  /** Console logs captured during recording */
  consoleLogs: ConsoleLogEntry[];
  /** Paths to key frame images */
  keyFrames: string[];
  /** Page information */
  page: {
    url: string;
    title: string;
  };
}
