/**
 * Language Model Tools for GitHub Copilot
 *
 * Provides WinCC OA log analysis tools for AI assistants.
 * Tools for querying, filtering, and analyzing log events.
 *
 * v2.1.0: Uses LogBackgroundService for event access instead of own store.
 */

import * as vscode from 'vscode';
import { LogSeverity } from './logEvent';
import { LogBackgroundService } from './logBackgroundService';

/**
 * Language Model Tools Service
 *
 * Registers log analysis tools for GitHub Copilot autonomous access.
 * Events are accessed from LogBackgroundService (shared with Panel).
 */
export class LanguageModelToolsService {
    private disposables: vscode.Disposable[] = [];
    private backgroundService: LogBackgroundService;

    constructor(backgroundService: LogBackgroundService) {
        this.backgroundService = backgroundService;
    }

    /**
     * Register all Language Model Tools
     */
    register(context: vscode.ExtensionContext): void {
        console.log('[LanguageModelTools] Registering WinCC OA LogViewer Tools...');

        // Tool 1: Query Logs
        this.disposables.push(
            vscode.lm.registerTool(
                'logviewer_query_logs',
                new QueryLogsTool(this.backgroundService),
            ),
        );

        // Tool 2: Get Recent Errors
        this.disposables.push(
            vscode.lm.registerTool(
                'logviewer_get_recent_errors',
                new GetRecentErrorsTool(this.backgroundService),
            ),
        );

        // Tool 3: Search Pattern
        this.disposables.push(
            vscode.lm.registerTool(
                'logviewer_search_pattern',
                new SearchPatternTool(this.backgroundService),
            ),
        );

        // Tool 4: Get by Severity
        this.disposables.push(
            vscode.lm.registerTool(
                'logviewer_get_by_severity',
                new GetBySeverityTool(this.backgroundService),
            ),
        );

        // Add to context subscriptions
        context.subscriptions.push(...this.disposables);

        console.log('[LanguageModelTools] ✅ Registered 4 WinCC OA LogViewer Tools');
    }

    /**
     * Dispose all registered tools
     */
    dispose(): void {
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}

/**
 * Tool 1: Query Logs
 *
 * Query log events with filters (severity, time range, search pattern).
 */
class QueryLogsTool implements vscode.LanguageModelTool<QueryLogsInput> {
    constructor(private backgroundService: LogBackgroundService) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<QueryLogsInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(`[QueryLogsTool] Querying logs with filters:`, input);

            let events = this.backgroundService.getEvents();

            // Filter by severity
            if (input.severity) {
                const severities = Array.isArray(input.severity)
                    ? input.severity
                    : [input.severity];
                events = events.filter((e) => severities.includes(e.severity));
            }

            // Filter by search pattern
            if (input.searchPattern) {
                const pattern = input.searchPattern.toLowerCase();
                events = events.filter(
                    (e) =>
                        e.message.toLowerCase().includes(pattern) ||
                        e.scope.toLowerCase().includes(pattern) ||
                        e.identifier.toLowerCase().includes(pattern),
                );
            }

            // Filter by time range (last N minutes)
            if (input.lastMinutes) {
                const cutoff = new Date();
                cutoff.setMinutes(cutoff.getMinutes() - input.lastMinutes);
                events = events.filter((e) => {
                    const eventTime = new Date(e.timestamp);
                    return eventTime >= cutoff;
                });
            }

            // Limit results
            const limit = input.limit || 100;
            const results = events.slice(-limit).map((e) => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
                metadata: e.metadata,
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            count: results.length,
                            totalEvents: events.length,
                            events: results,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            console.error('[QueryLogsTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: (error as Error).message,
                        },
                        null,
                        2,
                    ),
                ),
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
    constructor(private backgroundService: LogBackgroundService) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetRecentErrorsInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            const limit = input.limit || 10;
            console.log(`[GetRecentErrorsTool] Getting last ${limit} errors/warnings`);

            const errors = this.backgroundService.getRecentErrors(limit);

            const results = errors.map((e) => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
                metadata: e.metadata,
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            count: results.length,
                            events: results,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            console.error('[GetRecentErrorsTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: (error as Error).message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
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
    constructor(private backgroundService: LogBackgroundService) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<SearchPatternInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(`[SearchPatternTool] Searching for pattern: ${input.pattern}`);

            const caseSensitive = input.caseSensitive || false;
            const matches = this.backgroundService.searchEvents(input.pattern, caseSensitive);

            const limit = input.limit || 50;
            const results = matches.slice(-limit).map((e) => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            pattern: input.pattern,
                            count: results.length,
                            totalMatches: matches.length,
                            events: results,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            console.error('[SearchPatternTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: (error as Error).message,
                        },
                        null,
                        2,
                    ),
                ),
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
    constructor(private backgroundService: LogBackgroundService) {}

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetBySeverityInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            const input = options.input;
            console.log(`[GetBySeverityTool] Getting events with severity: ${input.severity}`);

            const events = this.backgroundService.getEvents();
            const filtered = events.filter((e) => e.severity === input.severity);

            const limit = input.limit || 100;
            const results = filtered.slice(-limit).map((e) => ({
                timestamp: e.timestamp,
                severity: e.severity,
                identifier: e.identifier,
                scope: e.scope,
                message: e.message,
                sourceFile: e.sourceFile,
                metadata: e.metadata,
            }));

            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: true,
                            severity: input.severity,
                            count: results.length,
                            totalEvents: filtered.length,
                            events: results,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        } catch (error: unknown) {
            console.error('[GetBySeverityTool] Error:', error);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    JSON.stringify(
                        {
                            success: false,
                            error: (error as Error).message,
                        },
                        null,
                        2,
                    ),
                ),
            ]);
        }
    }
}

interface GetBySeverityInput {
    severity: LogSeverity;
    limit?: number;
}
