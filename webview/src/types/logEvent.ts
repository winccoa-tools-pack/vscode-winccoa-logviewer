export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SEVERE' | 'DEBUG' | 'OTHER';

export interface LogFileRef {
  path: string;
  line?: number;
}

// Stacktrace entry: function name at file:line
export interface StacktraceEntry {
  index: number;
  functionName: string;
  filePath: string;
  line?: number;
}

// Additional structured information from log entries
export interface LogMetadata {
  script?: string;
  library?: string;
  line?: number;
  stacktrace?: StacktraceEntry[];
  raw?: string;  // For unstructured additional info
}

export interface LogEvent {
  identifier: string;      // WCCOActrl, WCCILdata, etc.
  timestamp: string;        // Original timestamp string from log
  scope: string;            // CTRL, SYS, PARAM, etc. (renamed from source)
  severity: LogSeverity;    // INFO, WARNING, ERROR, SEVERE, etc.
  message: string;          // Main message/description
  metadata?: LogMetadata;   // Structured additional information
  rawLines: string[];       // All raw lines for this event
}
