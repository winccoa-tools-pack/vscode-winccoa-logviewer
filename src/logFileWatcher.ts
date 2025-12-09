import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LogParser, parseGenericLogLine } from './logParser';
import { LogEvent } from './logEvent';
import { logger } from './logger';

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
        logger.debug('Getting available log files', { logPath: this.logPath });
        try {
            const files = fs.readdirSync(this.logPath);
            const logFiles = files.filter(file => file.endsWith('.log'));
            logger.info('Found log files', { count: logFiles.length, files: logFiles });
            return logFiles;
        } catch (error) {
            logger.error('Error getting available log files', error, { logPath: this.logPath });
            return [];
        }
    }

    /**
     * Start watching the log directory
     */
    public async start(): Promise<void> {
        logger.info('LogFileWatcher starting', { logPath: this.logPath });
        
        // Initialize file positions to current size (skip existing content)
        await this.initializeFilePositions();
        
        // Mark as initialized BEFORE creating the watcher
        this.isInitialized = true;
        logger.debug('File positions initialized, creating file watcher');

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
            logger.debug('Initializing file positions', { logPath: this.logPath, fileCount: files.length });

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logPath, file);
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        // Use an absolute, normalized lowercase key to avoid mismatches on Windows
                        const resolved = path.resolve(filePath);
                        const key = resolved.toLowerCase();
                        this.filePositions.set(key, stats.size);
                        logger.debug('Initialized file position', { file: resolved, key, size: stats.size });
                    }
                }
            }
            logger.info('File positions initialized', { totalFiles: this.filePositions.size });
        } catch (error) {
            logger.error('Error initializing file positions', error, { logPath: this.logPath });
            // Rethrow so caller can react if needed
            throw error;
        }
    }

    /**
     * Pause watching (stop processing new events)
     */
    public pause(): void {
        logger.info('Pausing log watcher');
        this.isPaused = true;
    }

    /**
     * Resume watching (continue processing new events)
     */
    public resume(): void {
        logger.info('Resuming log watcher');
        this.isPaused = false;
    }

    /**
     * Handle file change event - read new content only
     */
    private async handleFileChange(filePath: string): Promise<void> {
        // Ignore events until initialization is complete
        if (!this.isInitialized) {
            logger.debug('Ignoring file change before initialization', { filePath });
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
                logger.debug('First-seen file, initializing position', { file: resolvedPath, size: currentSize });
                return;
            }

            const lastPosition = this.filePositions.get(key) || 0;

            logger.debug('File change detected', { file: path.basename(resolvedPath), currentSize, lastPosition });

            // Only read if file grew
            if (currentSize <= lastPosition) {
                logger.debug('File did not grow, skipping', { file: path.basename(resolvedPath) });
                return;
            }

            // If paused, just update position without processing
            if (this.isPaused) {
                logger.debug('Watcher paused, updating position only', { file: path.basename(resolvedPath) });
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

                logger.debug('Read new content', { file: fileName, lines: lines.length, bytes: currentSize - lastPosition });

                if (fileName === 'PVSS_II.log') {
                    // Get or create parser for this file using the canonical key
                    let parser = this.parsers.get(key);
                    if (!parser) {
                        parser = new LogParser();
                        this.parsers.set(key, parser);
                        logger.debug('Created new parser', { file: resolvedPath });
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

                    logger.debug('Processed PVSS_II.log', { lines: lines.length, events: eventCount });
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
                    logger.debug('Processed generic log file', { file: fileName, lines: lines.length, events: eventCount });
                }

                // Update position using canonical key
                this.filePositions.set(key, currentSize);
            });

            stream.on('error', (error) => {
                logger.error('Error reading file stream', error, { file: resolvedPath });
            });

        } catch (error) {
            logger.error('Error handling file change', error, { file: filePath });
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
        logger.info('Stopping log watcher');
        this.isInitialized = false;
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }
        this.filePositions.clear();
        this.parsers.clear(); // Clear all parsers
        logger.debug('Log watcher stopped');
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.stop();
    }
}
