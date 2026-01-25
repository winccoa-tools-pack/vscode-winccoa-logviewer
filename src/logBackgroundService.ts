/**
 * Background Log Service
 *
 * Runs file watcher in background (independent of LogViewer Panel).
 * Maintains a ringbuffer of recent log events for MCP/Copilot access.
 */

import * as vscode from 'vscode';
import { LogFileWatcher } from './logFileWatcher';
import { LogEvent } from './logEvent';
import { ExtensionOutputChannel } from './extensionOutput';

/**
 * Singleton Background Service
 *
 * - Starts file watcher on extension activation
 * - Maintains ringbuffer of recent events (default: 500)
 * - Provides events to consumers (Panel, MCP Tools)
 */
export class LogBackgroundService {
    private static instance: LogBackgroundService | undefined;

    private watcher: LogFileWatcher | undefined;
    private logEvents: LogEvent[] = [];
    private maxEvents: number = 500;
    private isEnabled: boolean = true;
    private currentLogPath: string | undefined;
    private consumers = new Set<(event: LogEvent) => void>();
    private batchedEvents: LogEvent[] = [];
    private flushTimer: NodeJS.Timeout | undefined;

    // Private constructor for Singleton pattern
    private constructor() {
        this.loadConfiguration();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): LogBackgroundService {
        if (!LogBackgroundService.instance) {
            LogBackgroundService.instance = new LogBackgroundService();
        }
        return LogBackgroundService.instance;
    }

    /**
     * Load configuration from workspace settings
     */
    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('winccoaLogviewer.background');
        this.isEnabled = config.get<boolean>('enabled', true);
        this.maxEvents = config.get<number>('maxEvents', 500);

        ExtensionOutputChannel.debug(
            'BackgroundService',
            `Configuration loaded: enabled=${this.isEnabled}, maxEvents=${this.maxEvents}`,
        );
    }

    /**
     * Start background service
     */
    public async start(logPath: string): Promise<void> {
        if (!this.isEnabled) {
            ExtensionOutputChannel.info(
                'BackgroundService',
                'Background logging is disabled in settings',
            );
            return;
        }

        ExtensionOutputChannel.info('BackgroundService', `Starting background watcher: ${logPath}`);

        this.currentLogPath = logPath;

        try {
            // Create watcher with event callback
            this.watcher = new LogFileWatcher(logPath, (event) => {
                this.addEvent(event);
            });

            await this.watcher.start();

            // Log what we found
            const availableFiles = this.watcher.getAvailableLogFiles();
            ExtensionOutputChannel.info(
                'BackgroundService',
                `✅ Background watcher started successfully`,
            );
            ExtensionOutputChannel.info(
                'BackgroundService',
                `📁 Log folder: ${logPath}`,
            );
            ExtensionOutputChannel.info(
                'BackgroundService',
                `📄 Found ${availableFiles.length} log file(s): ${availableFiles.slice(0, 5).join(', ')}${availableFiles.length > 5 ? ` (and ${availableFiles.length - 5} more)` : ''}`,
            );
            
            if (availableFiles.length === 0) {
                ExtensionOutputChannel.warn(
                    'BackgroundService',
                    `⚠️ No log files found in ${logPath} - check if WinCC OA project is running`,
                );
            }
        } catch (error) {
            ExtensionOutputChannel.error(
                'BackgroundService',
                `Failed to start background watcher`,
                error as Error,
            );

            // Retry after 5 seconds
            setTimeout(() => {
                ExtensionOutputChannel.info('BackgroundService', 'Retrying watcher start...');
                this.start(logPath).catch((err) => {
                    ExtensionOutputChannel.error(
                        'BackgroundService',
                        'Retry failed',
                        err as Error,
                    );
                });
            }, 5000);

            throw error;
        }
    }

    /**
     * Stop background service
     */
    public stop(): void {
        ExtensionOutputChannel.info('BackgroundService', 'Stopping background watcher');

        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }

        // Clear flush timer
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = undefined;
        }

        ExtensionOutputChannel.debug('BackgroundService', 'Background watcher stopped');
    }

    /**
     * Restart with new log path
     */
    public async restart(newLogPath: string): Promise<void> {
        ExtensionOutputChannel.info(
            'BackgroundService',
            `Restarting for new log path: ${newLogPath}`,
        );

        // Stop old watcher
        this.stop();

        // Clear event buffer (new project → new logs)
        this.clearEvents();

        // Start new watcher
        await this.start(newLogPath);
    }

    /**
     * Add event to ringbuffer (batched)
     */
    private addEvent(event: LogEvent): void {
        // Add to batch
        this.batchedEvents.push(event);

        // Debounce: Flush all 100ms
        if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
                this.flushEventBatch();
                this.flushTimer = undefined;
            }, 100);
        }
    }

    /**
     * Flush batched events to ringbuffer
     */
    private flushEventBatch(): void {
        if (this.batchedEvents.length === 0) {
            return;
        }

        ExtensionOutputChannel.trace(
            'BackgroundService',
            `Flushing ${this.batchedEvents.length} batched events to ringbuffer`,
        );

        // Add to ringbuffer
        this.logEvents.push(...this.batchedEvents);

        // Log ringbuffer status every 50 events
        if (this.logEvents.length % 50 === 0 && this.logEvents.length > 0) {
            ExtensionOutputChannel.info(
                'BackgroundService',
                `📊 Ringbuffer: ${this.logEvents.length}/${this.maxEvents} events (${Math.round((this.logEvents.length / this.maxEvents) * 100)}% filled)`,
            );
        }

        // Ringbuffer: Keep only last maxEvents
        if (this.logEvents.length > this.maxEvents) {
            const removed = this.logEvents.length - this.maxEvents;
            this.logEvents = this.logEvents.slice(-this.maxEvents);
            ExtensionOutputChannel.info(
                'BackgroundService',
                `⚠️ Ringbuffer full (${this.maxEvents} events) - removing ${removed} oldest events`,
            );
        }

        // Notify consumers
        this.batchedEvents.forEach((event) => {
            this.notifyConsumers(event);
        });

        // Clear batch
        this.batchedEvents = [];
    }

    /**
     * Subscribe to new events (Consumer Pattern)
     */
    public onNewEvent(callback: (event: LogEvent) => void): vscode.Disposable {
        this.consumers.add(callback);
        ExtensionOutputChannel.trace(
            'BackgroundService',
            `New consumer subscribed (total: ${this.consumers.size})`,
        );

        return {
            dispose: () => {
                this.consumers.delete(callback);
                ExtensionOutputChannel.trace(
                    'BackgroundService',
                    `Consumer unsubscribed (total: ${this.consumers.size})`,
                );
            },
        };
    }

    /**
     * Notify all consumers of new event
     */
    private notifyConsumers(event: LogEvent): void {
        this.consumers.forEach((callback) => {
            try {
                callback(event);
            } catch (error) {
                ExtensionOutputChannel.error(
                    'BackgroundService',
                    'Error notifying consumer',
                    error as Error,
                );
            }
        });
    }

    /**
     * Get all buffered events
     */
    public getEvents(): LogEvent[] {
        return [...this.logEvents];
    }

    /**
     * Get recent errors/warnings
     */
    public getRecentErrors(limit: number = 10): LogEvent[] {
        const errors = this.logEvents.filter(
            (e) => e.severity === 'FATAL' || e.severity === 'SEVERE' || e.severity === 'WARNING',
        );
        return errors.slice(-limit);
    }

    /**
     * Search events by pattern
     */
    public searchEvents(pattern: string, caseSensitive: boolean = false): LogEvent[] {
        const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();

        return this.logEvents.filter((event) => {
            const searchText = `${event.message} ${event.scope} ${event.identifier}`;
            const text = caseSensitive ? searchText : searchText.toLowerCase();
            return text.includes(searchPattern);
        });
    }

    /**
     * Clear all buffered events
     */
    public clearEvents(): void {
        const oldCount = this.logEvents.length;
        this.logEvents = [];
        this.batchedEvents = [];
        ExtensionOutputChannel.debug('BackgroundService', `Cleared ${oldCount} events from buffer`);
    }

    /**
     * Get current configuration
     */
    public getConfiguration(): {
        enabled: boolean;
        maxEvents: number;
        currentPath: string | undefined;
        bufferedEvents: number;
    } {
        return {
            enabled: this.isEnabled,
            maxEvents: this.maxEvents,
            currentPath: this.currentLogPath,
            bufferedEvents: this.logEvents.length,
        };
    }

    /**
     * Update configuration (called when settings change)
     */
    public updateConfiguration(): void {
        const oldEnabled = this.isEnabled;
        const oldMaxEvents = this.maxEvents;

        this.loadConfiguration();

        ExtensionOutputChannel.info(
            'BackgroundService',
            `Configuration updated: enabled=${oldEnabled}->${this.isEnabled}, maxEvents=${oldMaxEvents}->${this.maxEvents}`,
        );

        // If disabled → stop watcher
        if (!this.isEnabled && oldEnabled) {
            ExtensionOutputChannel.info('BackgroundService', 'Background logging disabled - stopping watcher');
            this.stop();
        }

        // If enabled → start watcher (if path available)
        if (this.isEnabled && !oldEnabled && this.currentLogPath) {
            ExtensionOutputChannel.info('BackgroundService', 'Background logging enabled - starting watcher');
            this.start(this.currentLogPath).catch((err) => {
                ExtensionOutputChannel.error('BackgroundService', 'Failed to start watcher', err as Error);
            });
        }

        // If maxEvents changed → trim buffer
        if (this.maxEvents < oldMaxEvents && this.logEvents.length > this.maxEvents) {
            const removed = this.logEvents.length - this.maxEvents;
            this.logEvents = this.logEvents.slice(-this.maxEvents);
            ExtensionOutputChannel.debug(
                'BackgroundService',
                `Trimmed buffer: removed ${removed} events due to maxEvents change`,
            );
        }
    }

    /**
     * Get file watcher instance (for advanced operations)
     */
    public getWatcher(): LogFileWatcher | undefined {
        return this.watcher;
    }

    /**
     * Check if service is running
     */
    public isRunning(): boolean {
        return this.watcher !== undefined && this.isEnabled;
    }

    /**
     * Dispose service (cleanup)
     */
    public dispose(): void {
        ExtensionOutputChannel.info('BackgroundService', 'Disposing background service');
        this.stop();
        this.consumers.clear();
        this.clearEvents();
    }
}
