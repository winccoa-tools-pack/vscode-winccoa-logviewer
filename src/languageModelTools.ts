/**
 * Language Model Tools for GitHub Copilot
 * 
 * Provides WinCC OA log analysis tools for AI assistants.
 * Tools for querying, filtering, and analyzing log events.
 */

import * as vscode from 'vscode';
import { LogEvent, LogSeverity } from './logEvent';
import { LogViewerPanel } from './logViewerPanel';

/**
 * Language Model Tools Service
 * 
 * Registers log analysis tools for GitHub Copilot autonomous access.
 */
export class LanguageModelToolsService {
    private disposables: vscode.Disposable[] = [];
    private logEvents: LogEvent[] = [];

    /**
     * Add a new log event to the in-memory store
     */
    addLogEvent(event: LogEvent): void {
        this.logEvents.push(event);
        
        // Keep only last 10000 events to prevent memory issues
        if (this.logEvents.length > 10000) {
            this.logEvents = this.logEvents.slice(-10000);
        }
    }

    /**
     * Clear all stored log events
     */
    clearLogEvents(): void {
        this.logEvents = [];
    }

    /**
     * Get all stored log events
     */
    getLogEvents(): LogEvent[] {
        return this.logEvents;
    }

    /**
     * Register all Language Model Tools
     */
    register(context: vscode.ExtensionContext): void {
        console.log('[LanguageModelTools] Registering WinCC OA LogViewer Tools...');
        
        // Tool 1: Query Logs
        this.disposables.push(
            vscode.lm.registerTool('logviewer_query_logs', new QueryLogsTool(() => this.logEvents))
        );

        // Tool 2: Get Recent Errors
        this.disposables.push(
            vscode.lm.registerTool('logviewer_get_recent_errors', new GetRecentErrorsTool(() => this.logEvents))
        );

        // Tool 3: Search Pattern
        this.disposables.push(
            vscode.lm.registerTool('logviewer_search_pattern', new SearchPatternTool(() => this.logEvents))
        );

        // Tool 4: Get by Severity
        this.disposables.push(
            vscode.lm.registerTool('logviewer_get_by_severity', new GetBySeverityTool(() => this.logEvents))
        );

        // Add to context subscriptions
        context.subscriptions.push(...this.disposables);

        console.log('[LanguageModelTools] ✅ Registered 4 WinCC OA LogViewer Tools');
    }

    /**
     * Dispose all registered tools
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Tool 1: Query Logs
 * 
 * Query log events with filters (severity, time range, search pattern).
 */
class QueryLogsTool implements vscode.LanguageModelTool<QueryLogsInput> {
    constructor(private getLogEvents: () => LogEvent[]) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<QueryLogsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(`[QueryLogsTool] Querying logs with filters:`, input);

            let events = this.getLogEvents();

            // Filter by severity
            if (input.severity) {
                const severities = Array.isArray(input.severity) ? input.severity : [input.severity];
                events = events.filter(e => severities.includes(e.severity));
            }

            // Filter by search pattern
            if (input.searchPattern) {
                const pattern = input.searchPattern.toLowerCase();
                events = events.filter(e => 
                    e.message.toLowerCase().includes(pattern) ||
                    e.scope.toLowerCase().includes(pattern) ||
                    e.identifier.toLowerCase().includes(pattern)
                );
            }

            // Filter by time range (last N minutes)
            if (input.lastMinutes) {
                const cutoff = new Date();
                cutoff.setMinutes(cutoff.getMinutes() - input.lastMinutes);
                events = events.filter(e => {
                    const eventTime = new Date(e.timestamp);
                    return eventTime >= cutoff;
                });
            }

            // Limit results
            const limit = input.limit || 100;
            const results = events.slice(-limit).map(e => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
                metadata: e.metadata
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        count: results.length,
                        totalEvents: events.length,
                        events: results
                    }, null, 2)
                )
            ]);

        } catch (error: any) {
            console.error('[QueryLogsTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                )
            ]);
        }
    }
}

interface QueryLogsInput {
    severity?: LogSeverity | LogSeverity[];
    searchPattern?: string;
    lastMinutes?: number;
    limit?: number;
}

/**
 * Tool 2: Get Recent Errors
 * 
 * Get the last N error/warning events.
 */
class GetRecentErrorsTool implements vscode.LanguageModelTool<GetRecentErrorsInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetRecentErrorsInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            const limit = input.limit || 10;
            console.log(`[GetRecentErrorsTool] Getting last ${limit} errors/warnings`);

            const events = this.getLogEvents();
            const errors = events.filter(e => 
                e.severity === 'FATAL' || 
                e.severity === 'SEVERE' || 
                e.severity === 'WARNING'
            );

            const results = errors.slice(-limit).map(e => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
                metadata: e.metadata
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        count: results.length,
                        events: results
                    }, null, 2)
                )
            ]);

        } catch (error: any) {
            console.error('[GetRecentErrorsTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                )
            ]);
        }
    }

    constructor(private getLogEvents: () => LogEvent[]) {}
}

interface GetRecentErrorsInput {
    limit?: number;
}

/**
 * Tool 3: Search Pattern
 * 
 * Search for a specific pattern in log messages.
 */
class SearchPatternTool implements vscode.LanguageModelTool<SearchPatternInput> {
    constructor(private getLogEvents: () => LogEvent[]) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<SearchPatternInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(`[SearchPatternTool] Searching for pattern: ${input.pattern}`);

            const events = this.getLogEvents();
            const pattern = input.pattern.toLowerCase();
            const caseSensitive = input.caseSensitive || false;

            const matches = events.filter(e => {
                const searchText = `${e.message} ${e.scope} ${e.identifier}`;
                if (caseSensitive) {
                    return searchText.includes(input.pattern);
                }
                return searchText.toLowerCase().includes(pattern);
            });

            const limit = input.limit || 50;
            const results = matches.slice(-limit).map(e => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        pattern: input.pattern,
                        count: results.length,
                        totalMatches: matches.length,
                        events: results
                    }, null, 2)
                )
            ]);

        } catch (error: any) {
            console.error('[SearchPatternTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                )
            ]);
        }
    }
}

interface SearchPatternInput {
    pattern: string;
    caseSensitive?: boolean;
    limit?: number;
}

/**
 * Tool 4: Get by Severity
 * 
 * Get all events for a specific severity level.
 */
class GetBySeverityTool implements vscode.LanguageModelTool<GetBySeverityInput> {
    constructor(private getLogEvents: () => LogEvent[]) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetBySeverityInput>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(`[GetBySeverityTool] Getting events with severity: ${input.severity}`);

            const events = this.getLogEvents();
            const filtered = events.filter(e => e.severity === input.severity);

            const limit = input.limit || 100;
            const results = filtered.slice(-limit).map(e => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
                metadata: e.metadata
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: true,
                        severity: input.severity,
                        count: results.length,
                        totalEvents: filtered.length,
                        events: results
                    }, null, 2)
                )
            ]);

        } catch (error: any) {
            console.error('[GetBySeverityTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify({
                        success: false,
                        error: error.message
                    }, null, 2)
                )
            ]);
        }
    }
}

interface GetBySeverityInput {
    severity: LogSeverity;
    limit?: number;
}
