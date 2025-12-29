import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LogParser, parseGenericLogLine, GenericLogParser } from './logParser';
import { LogEvent } from './logEvent';
import { ExtensionOutputChannel } from './extensionOutput';

export class LogFileWatcher {
    private watcher: vscode.FileSystemWatcher | undefined;
    private parsers = new Map<string, LogParser | GenericLogParser>(); // Separate parser per file
    private filePositions = new Map<string, number>(); // Track read position for each file
    private lineBuffers = new Map<string, string>(); // Buffer for incomplete lines per file
    private onNewEventCallback: ((event: LogEvent) => void) | undefined;
    private isPaused = false;
    private isInitialized = false; // Track if initialization is complete

    constructor(
        private logPath: string,
        onNewEvent: (event: LogEvent) => void
    ) {
        this.onNewEventCallback = onNewEvent;
    }

    /**
     * Get list of available log files
     */
    public getAvailableLogFiles(): string[] {
        ExtensionOutputChannel.trace('LogFileWatcher', `Getting available log files from: ${this.logPath}`);
        try {
            const files = fs.readdirSync(this.logPath);
            const logFiles = files.filter(file => file.endsWith('.log'));
            ExtensionOutputChannel.debug('LogFileWatcher', `Found ${logFiles.length} log files`);
            return logFiles;
        } catch (error) {
            ExtensionOutputChannel.error('LogFileWatcher', `Error getting available log files from: ${this.logPath}`, error as Error);
            return [];
        }
    }

    /**
     * Start watching the log directory
     */
    public async start(): Promise<void> {
        ExtensionOutputChannel.info('LogFileWatcher', `Starting watcher for: ${this.logPath}`);
        
        // Create file system watcher FIRST (but don't mark initialized yet)
        const pattern = new vscode.RelativePattern(this.logPath, '*.log');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // Watch for changes (new content appended)
        this.watcher.onDidChange(async (uri) => {
            await this.handleFileChange(uri.fsPath);
        });

        // Watch for new files
        this.watcher.onDidCreate(async (uri) => {
            await this.handleFileChange(uri.fsPath);
        });
        
        // Initialize file positions to current size (skip existing content)
        await this.initializeFilePositions();
        
        // Mark as initialized AFTER everything is set up
        this.isInitialized = true;
        ExtensionOutputChannel.debug('LogFileWatcher', 'File watcher fully initialized and ready');
    }

    /**
     * Initialize file positions to skip existing content
     */
    private async initializeFilePositions(): Promise<void> {
        try {
            // Get all .log files in the directory
            const files = fs.readdirSync(this.logPath);
            ExtensionOutputChannel.trace('LogFileWatcher', `Initializing file positions for ${files.length} files`);

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logPath, file);
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        // Use an absolute, normalized lowercase key to avoid mismatches on Windows
                        const resolved = path.resolve(filePath);
                        const key = resolved.toLowerCase();
                        this.filePositions.set(key, stats.size);
                        ExtensionOutputChannel.trace('LogFileWatcher', `Initialized position for ${file}: ${stats.size} bytes`);
                    }
                }
            }
            ExtensionOutputChannel.info('LogFileWatcher', `File positions initialized for ${this.filePositions.size} files`);
        } catch (error) {
            ExtensionOutputChannel.error('LogFileWatcher', `Error initializing file positions: ${this.logPath}`, error as Error);
            // Rethrow so caller can react if needed
            throw error;
        }
    }

    /**
     * Pause watching (stop processing new events)
     */
    public pause(): void {
        ExtensionOutputChannel.info('LogFileWatcher', 'Pausing log watcher');
        this.isPaused = true;
    }

    /**
     * Resume watching (continue processing new events)
     */
    public resume(): void {
        ExtensionOutputChannel.info('LogFileWatcher', 'Resuming log watcher');
        this.isPaused = false;
    }

    /**
     * Handle file change event - read new content only
     */
    private async handleFileChange(filePath: string): Promise<void> {
        // Ignore events until initialization is complete
        if (!this.isInitialized) {
            ExtensionOutputChannel.trace('LogFileWatcher', `Ignoring file change before initialization: ${path.basename(filePath)}`);
            return;
        }

        try {
            // Resolve an absolute path and canonical key for maps (lowercase on Windows)
            const resolvedPath = path.resolve(filePath);
            const key = resolvedPath.toLowerCase();

            const stats = fs.statSync(resolvedPath);
            const currentSize = stats.size;

            // If we never saw this file during initialization, it's a newly created file
            // Initialize position to 0 and process all content
            if (!this.filePositions.has(key)) {
                this.filePositions.set(key, 0);
                ExtensionOutputChannel.debug('LogFileWatcher', `New file created after initialization: ${path.basename(resolvedPath)}, will read all content`);
                // Continue processing with lastPosition = 0
            }

            const lastPosition = this.filePositions.get(key) || 0;

            ExtensionOutputChannel.trace('LogFileWatcher', `File change detected: ${path.basename(resolvedPath)}, size: ${currentSize}, last: ${lastPosition}`);

            // Only read if file grew
            if (currentSize <= lastPosition) {
                ExtensionOutputChannel.trace('LogFileWatcher', `File did not grow, skipping: ${path.basename(resolvedPath)}`);
                return;
            }

            // If paused, just update position without processing
            if (this.isPaused) {
                ExtensionOutputChannel.trace('LogFileWatcher', `Watcher paused, updating position only: ${path.basename(resolvedPath)}`);
                this.filePositions.set(key, currentSize);
                return;
            }

            // Read only new content
            const stream = fs.createReadStream(resolvedPath, {
                start: lastPosition,
                encoding: 'utf-8'
            });

            let buffer = '';
            stream.on('data', (chunk) => {
                buffer += chunk;
            });

            stream.on('end', () => {
                const fileName = path.basename(resolvedPath);
                
                // Get any buffered incomplete line from previous read
                const previousBuffer = this.lineBuffers.get(key) || '';
                
                // Prepend previous buffer to current buffer
                const fullBuffer = previousBuffer + buffer;
                
                // Split into lines
                const splitLines = fullBuffer.split(/\r?\n/);
                
                // Last element is either empty string (if ended with \n) or incomplete line
                const incompleteLinePart = splitLines.pop() || '';
                
                // Store incomplete line for next read
                if (incompleteLinePart.length > 0) {
                    this.lineBuffers.set(key, incompleteLinePart);
                    ExtensionOutputChannel.trace('LogFileWatcher', `Buffered incomplete line (${incompleteLinePart.length} chars) for ${fileName}`);
                } else {
                    // Clear buffer if line was complete
                    this.lineBuffers.delete(key);
                }
                
                // Filter out empty lines
                const lines = splitLines.filter(line => line.length > 0);

                ExtensionOutputChannel.debug('LogFileWatcher', `Read ${lines.length} complete lines from ${fileName} (${currentSize - lastPosition} bytes, ${previousBuffer.length > 0 ? 'had previous buffer' : 'no buffer'})`);

                // Detect parser type: Use LogParser if first line matches PVSS_II format
                // Format: IDENTIFIER (NUM), YYYY.MM.DD HH:mm:ss.SSS, SCOPE, SEVERITY, MSGNUM, MESSAGE
                const usePVSSParser = lines.length > 0 && this.isPVSSFormat(lines[0]);
                
                if (usePVSSParser) {
                    // Get or create LogParser for this file using the canonical key
                    let parser = this.parsers.get(key);
                    if (!parser || parser instanceof GenericLogParser) {
                        parser = new LogParser();
                        this.parsers.set(key, parser);
                        ExtensionOutputChannel.trace('LogFileWatcher', `Created new PVSS_II parser for: ${fileName}`);
                    }

                    // Parse with PVSS_II parser
                    let eventCount = 0;
                    for (const line of lines) {
                        if (line.trim()) {
                            const events = (parser as LogParser).parseLine(line);
                            events.forEach((event: LogEvent) => {
                                this.emitEvent(event);
                                eventCount++;
                            });
                        }
                    }
                    
                    // CRITICAL: Flush the parser to emit the last event in buffer
                    // The parser is stateful and holds the last event until the next line arrives
                    const lastEvent = (parser as LogParser).flush();
                    if (lastEvent) {
                        this.emitEvent(lastEvent);
                        eventCount++;
                        ExtensionOutputChannel.trace('LogFileWatcher', `Flushed final event from parser for ${fileName}`);
                    }

                    ExtensionOutputChannel.debug('LogFileWatcher', `Processed ${fileName} with PVSS parser: ${lines.length} lines, ${eventCount} events`);
                } else {
                    // Other log files: use GenericLogParser for multi-line support
                    let parser = this.parsers.get(key);
                    if (!parser || parser instanceof LogParser) {
                        parser = new GenericLogParser(fileName);
                        this.parsers.set(key, parser);
                        ExtensionOutputChannel.trace('LogFileWatcher', `Created new GenericLogParser for: ${fileName}`);
                    }

                    let eventCount = 0;
                    for (const line of lines) {
                        if (line.trim()) {
                            const events = (parser as GenericLogParser).parseLine(line);
                            events.forEach((event: LogEvent) => {
                                this.emitEvent(event);
                                eventCount++;
                            });
                        }
                    }
                    
                    // CRITICAL: Flush the parser to emit the last event in buffer
                    const lastEvent = (parser as GenericLogParser).flush();
                    if (lastEvent) {
                        this.emitEvent(lastEvent);
                        eventCount++;
                        ExtensionOutputChannel.trace('LogFileWatcher', `Flushed final event from parser for ${fileName}`);
                    }
                    
                    ExtensionOutputChannel.debug('LogFileWatcher', `Processed ${fileName} with generic parser: ${lines.length} lines, ${eventCount} events`);
                }

                // Update position using canonical key
                this.filePositions.set(key, currentSize);
            });

            stream.on('error', (error) => {
                ExtensionOutputChannel.error('LogFileWatcher', `Error reading file stream: ${path.basename(resolvedPath)}`, error);
            });

        } catch (error) {
            ExtensionOutputChannel.error('LogFileWatcher', `Error handling file change: ${path.basename(filePath)}`, error as Error);
        }
    }

    /**
     * Check if a line matches PVSS_II log format
     * Format: IDENTIFIER (NUM), YYYY.MM.DD HH:mm:ss.SSS, SCOPE, SEVERITY, MSGNUM, MESSAGE
     * Format: WCCILdataSQLite(0), ... or WCCOActrl    (0), ...
     * Format: PARAM,WARNING (no space after comma)
     */
    private isPVSSFormat(line: string): boolean {
        // Regex: IDENTIFIER + optional spaces + (NUM), + TIMESTAMP, + SCOPE, + SEVERITY, + rest
        // Note: \s* instead of \s+ to handle missing spaces (PARAM,WARNING and WCCILdataSQLite(0))
        const regex = /^\w+\s*\(\d+\),\s+\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3},\s*\w+,\s*\w+,\s+/;
        return regex.test(line.trim());
    }

    /**
     * Emit a parsed event
     */
    private emitEvent(event: LogEvent): void {
        if (this.onNewEventCallback) {
            this.onNewEventCallback(event);
        }
    }

    /**
     * Stop watching
     */
    public stop(): void {
        ExtensionOutputChannel.info('LogFileWatcher', 'Stopping log watcher');
        this.isInitialized = false;
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }
        this.filePositions.clear();
        this.lineBuffers.clear(); // Clear line buffers
        this.parsers.clear(); // Clear all parsers
        ExtensionOutputChannel.debug('LogFileWatcher', 'Log watcher stopped');
    }

    /**
     * Get list of history files (PVSS_II*.log files with timestamps)
     */
    public getHistoryFiles(): { name: string; size: number; modified: Date; firstTimestamp?: string; lastTimestamp?: string }[] {
        try {
            const files = fs.readdirSync(this.logPath);
            const historyFiles = files
                .filter(file => file.startsWith('PVSS_II') && file.endsWith('.log'))
                .map(file => {
                    const filePath = path.join(this.logPath, file);
                    const stats = fs.statSync(filePath);
                    
                    // Try to get first and last timestamp from file
                    let firstTimestamp: string | undefined;
                    let lastTimestamp: string | undefined;
                    
                    try {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        const lines = content.split(/\r?\n/).filter(l => l.trim());
                        
                        // Extract timestamp from first PVSS line
                        if (lines.length > 0) {
                            const firstMatch = lines[0].match(/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}/);
                            if (firstMatch) firstTimestamp = firstMatch[0];
                        }
                        
                        // Extract timestamp from last PVSS line (search backwards)
                        for (let i = lines.length - 1; i >= 0; i--) {
                            const lastMatch = lines[i].match(/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}/);
                            if (lastMatch) {
                                lastTimestamp = lastMatch[0];
                                break;
                            }
                        }
                    } catch (e) {
                        // Ignore read errors
                    }
                    
                    return {
                        name: file,
                        size: stats.size,
                        modified: stats.mtime,
                        firstTimestamp,
                        lastTimestamp
                    };
                })
                .sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Newest first
            
            ExtensionOutputChannel.debug('LogFileWatcher', `Found ${historyFiles.length} history files`);
            return historyFiles;
        } catch (error) {
            ExtensionOutputChannel.error('LogFileWatcher', 'Error getting history files', error as Error);
            return [];
        }
    }

    /**
     * Load history from a specific file with optional time range filter
     * @param fileName The log file name (e.g., PVSS_II.log)
     * @param fromTime Optional start time filter (ISO string)
     * @param toTime Optional end time filter (ISO string)
     * @returns Array of LogEvents
     */
    public async loadHistoryFile(
        fileName: string, 
        fromTime?: string, 
        toTime?: string
    ): Promise<LogEvent[]> {
        const filePath = path.join(this.logPath, fileName);
        ExtensionOutputChannel.info('LogFileWatcher', `Loading history from: ${fileName}, from: ${fromTime || 'start'}, to: ${toTime || 'end'}`);
        
        if (!fs.existsSync(filePath)) {
            ExtensionOutputChannel.error('LogFileWatcher', `History file not found: ${filePath}`);
            return [];
        }

        const events: LogEvent[] = [];
        const fromDate = fromTime ? new Date(fromTime) : null;
        const toDate = toTime ? new Date(toTime) : null;

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            
            // Use a fresh parser for history loading
            const parser = new LogParser();
            
            for (const line of lines) {
                const parsedEvents = parser.parseLine(line);
                for (const event of parsedEvents) {
                    // Apply time filter if specified
                    if (this.isEventInTimeRange(event, fromDate, toDate)) {
                        events.push(event);
                    }
                }
            }
            
            // Flush final event
            const lastEvent = parser.flush();
            if (lastEvent && this.isEventInTimeRange(lastEvent, fromDate, toDate)) {
                events.push(lastEvent);
            }
            
            ExtensionOutputChannel.info('LogFileWatcher', `Loaded ${events.length} events from history (${lines.length} lines)`);
            return events;
            
        } catch (error) {
            ExtensionOutputChannel.error('LogFileWatcher', `Error loading history file: ${fileName}`, error as Error);
            return [];
        }
    }

    /**
     * Check if event timestamp is within the specified time range
     */
    private isEventInTimeRange(event: LogEvent, fromDate: Date | null, toDate: Date | null): boolean {
        if (!fromDate && !toDate) return true;
        
        // Parse timestamp from event (format: "2025.12.29 14:30:45.123")
        const eventDate = this.parseEventTimestamp(event.timestamp);
        if (!eventDate) return true; // If can't parse, include it
        
        if (fromDate && eventDate < fromDate) return false;
        if (toDate && eventDate > toDate) return false;
        
        return true;
    }

    /**
     * Parse PVSS timestamp format to Date
     */
    private parseEventTimestamp(timestamp: string): Date | null {
        // Format: "2025.12.29 14:30:45.123"
        const match = timestamp.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
        if (!match) return null;
        
        const [, year, month, day, hour, min, sec, ms] = match;
        return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(min),
            parseInt(sec),
            parseInt(ms)
        );
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.stop();
    }
}
