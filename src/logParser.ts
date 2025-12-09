import { LogEvent, LogSeverity, LogMetadata, StacktraceEntry } from './logEvent';
import { logger } from './logger';

/**
 * Parses WinCC OA PVSS_II.log format
 * 
 * Format: IDENTIFIER (NUM), YYYY.MM.DD HH:mm:ss.SSS, SCOPE, SEVERITY, MSGNUM, MESSAGE
 * 
 * Multi-line events can have:
 * - Script: <name>
 * - Library: <path>
 * - Line: <number>[, <variable>]
 * - Stacktrace:
 *      INDEX: FUNCTION at PATH:LINE
 */
export class LogParser {
    private buffer: string[] = [];
    private currentEvent: Partial<LogEvent> | null = null;
    private stacktraceMode = false;

    /**
     * Parse a single line and return completed events
     */
    public parseLine(line: string): LogEvent[] {
        const completedEvents: LogEvent[] = [];

        // Check if this is a main log line (starts with identifier)
        const mainLineMatch = this.parseMainLine(line);
        
        if (mainLineMatch) {
            // We have a new main line, finish previous event if exists
            if (this.currentEvent) {
                const completed = this.finalizeEvent();
                if (completed) {
                    completedEvents.push(completed);
                    logger.debug('Completed log event', { 
                        identifier: completed.identifier, 
                        severity: completed.severity,
                        hasMetadata: !!completed.metadata 
                    });
                }
            }

            // Start new event
            this.currentEvent = mainLineMatch;
            this.buffer = [line];
            this.stacktraceMode = false;
        } else if (this.currentEvent) {
            // This is a continuation line (metadata)
            this.buffer.push(line);
            this.parseMetadataLine(line);
        }

        return completedEvents;
    }

    /**
     * Finalize and return any remaining event in buffer
     */
    public flush(): LogEvent | null {
        if (this.currentEvent) {
            return this.finalizeEvent();
        }
        return null;
    }

    /**
     * Parse main log line
     * Format: WCCOActrl    (4), 2025.11.16 18:56:26.972, CTRL, WARNING,     5, this is a warning
     */
    private parseMainLine(line: string): Partial<LogEvent> | null {
        // Regex: IDENTIFIER + (NUM), + TIMESTAMP, + SCOPE, + SEVERITY, + MSGNUM, + MESSAGE
        const regex = /^(\w+)\s+\((\d+)\),\s+(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}),\s+(\w+),\s+(\w+),\s+(.+)$/;
        const match = line.match(regex);

        if (!match) {
            logger.debug('Failed to parse as main line', { linePreview: line.substring(0, 50) });
            return null;
        }

        const [, identifier, , timestamp, scope, severity, rest] = match;
        
        // Split rest into message number and message
        // Format: "     5, this is a warning" or "     5/ctrl, message"
        const restMatch = rest.match(/^\s*(\d+(?:\/\w+)?),\s*(.*)$/);
        if (!restMatch) {
            return null;
        }

        const [, , message] = restMatch;

        return {
            identifier: identifier.trim(),
            timestamp: timestamp.trim(),
            scope: scope.trim(),
            severity: this.normalizeSeverity(severity.trim()),
            message: message.trim(),
            metadata: {},
            rawLines: []
        };
    }

    /**
     * Parse metadata lines (Script, Library, Line, Stacktrace)
     */
    private parseMetadataLine(line: string): void {
        if (!this.currentEvent || !this.currentEvent.metadata) {
            return;
        }

        const trimmed = line.trim();

        // Check for Stacktrace header
        if (trimmed === 'Stacktrace:') {
            this.stacktraceMode = true;
            this.currentEvent.metadata.stacktrace = [];
            return;
        }

        // Parse stacktrace entry
        if (this.stacktraceMode) {
            // Format: "     1: void myFunction() at c:/path/to/file.ctl:22"
            const stackMatch = trimmed.match(/^(\d+):\s+(.+?)\s+at\s+(.+):(\d+)$/);
            if (stackMatch) {
                const [, index, functionName, filePath, line] = stackMatch;
                this.currentEvent.metadata.stacktrace!.push({
                    index: parseInt(index, 10),
                    functionName: functionName.trim(),
                    filePath: filePath.trim(),
                    line: parseInt(line, 10)
                });
            }
            return;
        }

        // Check for inline Syntax error format
        // Format: "Syntax error, '}' unexpected, /path/to/file.ctl,   Line: 29"
        if (this.currentEvent.message && this.currentEvent.message.toLowerCase().includes('syntax error')) {
            // Try to extract file path and line from the message
            const syntaxMatch = this.currentEvent.message.match(/^(.+?),\s*(.+?),\s*([^,]+),\s*Line:\s*(\d+)/);
            if (syntaxMatch) {
                const [, errorType, errorDetail, filePath, line] = syntaxMatch;
                
                // Update message to just the error part
                this.currentEvent.message = `${errorType.trim()}, ${errorDetail.trim()}`;
                
                // Add file info to metadata
                this.currentEvent.metadata.library = filePath.trim();
                this.currentEvent.metadata.line = parseInt(line, 10);
                return;
            }
        }

        // Parse Script
        if (trimmed.startsWith('Script:')) {
            this.currentEvent.metadata.script = trimmed.substring(7).trim();
            return;
        }

        // Parse Library
        if (trimmed.startsWith('Library:')) {
            this.currentEvent.metadata.library = trimmed.substring(8).trim();
            return;
        }

        // Parse Line (can have format: "Line: 22" or "Line: 22, variableName")
        if (trimmed.startsWith('Line:')) {
            const lineContent = trimmed.substring(5).trim();
            const lineMatch = lineContent.match(/^(\d+)/);
            if (lineMatch) {
                this.currentEvent.metadata.line = parseInt(lineMatch[1], 10);
            }
            return;
        }

        // Everything else goes to raw
        if (trimmed.length > 0 && !trimmed.startsWith('Script:') && !trimmed.startsWith('Library:') && !trimmed.startsWith('Line:')) {
            if (!this.currentEvent.metadata.raw) {
                this.currentEvent.metadata.raw = trimmed;
            } else {
                this.currentEvent.metadata.raw += '\n' + trimmed;
            }
        }
    }

    /**
     * Finalize current event
     */
    private finalizeEvent(): LogEvent | null {
        if (!this.currentEvent || !this.currentEvent.identifier) {
            this.currentEvent = null;
            this.buffer = [];
            return null;
        }

        const event: LogEvent = {
            identifier: this.currentEvent.identifier,
            timestamp: this.currentEvent.timestamp || '',
            scope: this.currentEvent.scope || 'UNKNOWN',
            severity: this.currentEvent.severity || 'OTHER',
            message: this.currentEvent.message || '',
            metadata: Object.keys(this.currentEvent.metadata || {}).length > 0 
                ? this.currentEvent.metadata as LogMetadata 
                : undefined,
            rawLines: [...this.buffer]
        };

        this.currentEvent = null;
        this.buffer = [];
        this.stacktraceMode = false;

        return event;
    }

    /**
     * Normalize severity to our LogSeverity type
     */
    private normalizeSeverity(severity: string): LogSeverity {
        const upper = severity.toUpperCase();
        switch (upper) {
            case 'INFO':
                return 'INFO';
            case 'WARNING':
                return 'WARNING';
            case 'ERROR':
                return 'ERROR';
            case 'SEVERE':
                return 'SEVERE';
            case 'DEBUG':
                return 'DEBUG';
            default:
                return 'OTHER';
        }
    }
}

/**
 * Parse a complete log file
 */
export function parseLogFile(content: string): LogEvent[] {
    const parser = new LogParser();
    const lines = content.split('\n');
    const events: LogEvent[] = [];

    for (const line of lines) {
        const completed = parser.parseLine(line);
        events.push(...completed);
    }

    // Don't forget the last event
    const lastEvent = parser.flush();
    if (lastEvent) {
        events.push(lastEvent);
    }

    return events;
}

/**
 * Parse other log files as raw events
 */
export function parseGenericLogLine(line: string, fileName: string): LogEvent | null {
    if (!line.trim()) {
        return null;
    }

    return {
        identifier: 'GENERIC',
        timestamp: new Date().toISOString(),
        scope: 'OTHER',
        severity: 'OTHER',
        message: line,
        metadata: {
            raw: `From: ${fileName}`
        },
        rawLines: [line]
    };
}
