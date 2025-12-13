import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LogParser, parseGenericLogLine } from './logParser';
import { LogEvent } from './logEvent';
import { ExtensionOutputChannel } from './extensionOutput';

export class LogFileWatcher {
    private watcher: vscode.FileSystemWatcher | undefined;
    private parsers = new Map<string, LogParser>(); // Separate parser per file
    private filePositions = new Map<string, number>(); // Track read position for each file
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
        
        // Initialize file positions to current size (skip existing content)
        await this.initializeFilePositions();
        
        // Mark as initialized BEFORE creating the watcher
        this.isInitialized = true;
        ExtensionOutputChannel.debug('LogFileWatcher', 'File positions initialized, creating file watcher');

        // Create file system watcher for all log files
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

            // If we never saw this file during initialization, set its position to current size
            // and don't process older content. This avoids reading the whole file when
            // initialization missed it or paths differ in casing/format.
            if (!this.filePositions.has(key)) {
                this.filePositions.set(key, currentSize);
                ExtensionOutputChannel.debug('LogFileWatcher', `First-seen file, initializing position: ${path.basename(resolvedPath)} (${currentSize} bytes)`);
                return;
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
                // Windows uses \r\n, split by both and filter empty
                const lines = buffer.split(/\r?\n/).filter(line => line.length > 0);
                const fileName = path.basename(resolvedPath);

                ExtensionOutputChannel.debug('LogFileWatcher', `Read ${lines.length} new lines from ${fileName} (${currentSize - lastPosition} bytes)`);

                if (fileName === 'PVSS_II.log') {
                    // Get or create parser for this file using the canonical key
                    let parser = this.parsers.get(key);
                    if (!parser) {
                        parser = new LogParser();
                        this.parsers.set(key, parser);
                        ExtensionOutputChannel.trace('LogFileWatcher', `Created new parser for: ${fileName}`);
                    }

                    // Parse PVSS_II.log with proper parser
                    let eventCount = 0;
                    for (const line of lines) {
                        if (line.trim()) {
                            const events = parser.parseLine(line);
                            events.forEach((event: LogEvent) => {
                                this.emitEvent(event);
                                eventCount++;
                            });
                        }
                    }

                    ExtensionOutputChannel.debug('LogFileWatcher', `Processed PVSS_II.log: ${lines.length} lines, ${eventCount} events`);
                } else {
                    // Other log files: emit as generic events
                    let eventCount = 0;
                    for (const line of lines) {
                        if (line.trim()) {
                            const event = parseGenericLogLine(line, fileName);
                            if (event) {
                                this.emitEvent(event);
                                eventCount++;
                            }
                        }
                    }
                    ExtensionOutputChannel.debug('LogFileWatcher', `Processed ${fileName}: ${lines.length} lines, ${eventCount} events`);
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
        this.parsers.clear(); // Clear all parsers
        ExtensionOutputChannel.debug('LogFileWatcher', 'Log watcher stopped');
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.stop();
    }
}
