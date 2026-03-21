import * as vscode from 'vscode';
import { LogViewerPanel } from './logViewerPanel';
import { ExtensionOutputChannel } from './extensionOutput';
import { PathResolver } from './pathResolver';
import { LanguageModelToolsService } from './languageModelTools';
import { LogBackgroundService } from './logBackgroundService';

// Global instances
let languageModelTools: LanguageModelToolsService;
let backgroundService: LogBackgroundService;

export function activate(context: vscode.ExtensionContext) {
    // Initialize Extension Output Channel
    const extensionOutput = ExtensionOutputChannel.initialize();
    context.subscriptions.push(extensionOutput);

    // Log activation with banner
    ExtensionOutputChannel.info(
        'Extension',
        '═══════════════════════════════════════════════════════',
    );
    ExtensionOutputChannel.info('Extension', '  WinCC OA LogViewer - Starting...');
    ExtensionOutputChannel.info(
        'Extension',
        '═══════════════════════════════════════════════════════',
    );
    ExtensionOutputChannel.debug('Extension', `Extension Path: ${context.extensionPath}`);
    ExtensionOutputChannel.debug('Extension', `VS Code Version: ${vscode.version}`);

    // Log version
    ExtensionOutputChannel.info(
        'Extension',
        `📦 Version ${vscode.extensions.getExtension('RichardJanisch.winccoa-vscode-logviewer')?.packageJSON.version || 'unknown'}`,
    );

    // Log configuration status
    const config = vscode.workspace.getConfiguration('winccoaLogviewer');
    const backgroundEnabled = config.get<boolean>('background.enabled', true);
    const maxEvents = config.get<number>('background.maxEvents', 500);
    const logPathSource = config.get<string>('logPathSource', 'workspace');
    const logLevel = config.get<string>('logLevel', 'INFO');

    ExtensionOutputChannel.info(
        'Extension',
        `⚙️ Background logging: ${backgroundEnabled ? '✅ enabled' : '❌ disabled'}`,
    );
    ExtensionOutputChannel.info('Extension', `🔄 Ringbuffer size: ${maxEvents} events`);
    ExtensionOutputChannel.debug('Configuration', `Log Path Source: ${logPathSource}`);
    ExtensionOutputChannel.debug('Configuration', `Log Level: ${logLevel}`);

    // Check if workspace is available
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        ExtensionOutputChannel.debug(
            'Extension',
            `Workspace folders: ${vscode.workspace.workspaceFolders.map((f) => f.name).join(', ')}`,
        );
    } else {
        ExtensionOutputChannel.warn('Extension', 'No workspace folder open');
    }

    ExtensionOutputChannel.info('Extension', '🚀 WinCC OA LogViewer Extension activated');

    // Initialize Background Service (Singleton)
    ExtensionOutputChannel.trace('Extension', 'Initializing Background Service...');
    backgroundService = LogBackgroundService.getInstance();

    // Auto-start background watcher if log path available
    const initialLogPath = PathResolver.getLogPath();
    if (initialLogPath) {
        ExtensionOutputChannel.debug(
            'Extension',
            `Auto-starting background service with: ${initialLogPath}`,
        );
        backgroundService
            .start(initialLogPath)
            .then(() => {
                ExtensionOutputChannel.info('Services', '✅ Background log watcher started');
            })
            .catch((error) => {
                ExtensionOutputChannel.error(
                    'Services',
                    'Failed to start background watcher',
                    error as Error,
                );
            });
    } else {
        ExtensionOutputChannel.debug(
            'Extension',
            'No log path available - background service will start when path is set',
        );
    }

    // Initialize Language Model Tools Service (GitHub Copilot integration)
    // Pass background service to tools for event access
    ExtensionOutputChannel.trace('Extension', 'Initializing Language Model Tools Service...');
    languageModelTools = new LanguageModelToolsService(backgroundService);
    languageModelTools.register(context);
    ExtensionOutputChannel.info(
        'Services',
        'Language Model Tools Service initialized (4 tools registered)',
    );

    // Setup Core extension integration if in automatic mode
    setupCoreExtensionIntegration();

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('winccoaLogviewer.logLevel')) {
                ExtensionOutputChannel.updateLogLevel();
            }

            // Handle background service configuration changes
            if (
                e.affectsConfiguration('winccoaLogviewer.background.enabled') ||
                e.affectsConfiguration('winccoaLogviewer.background.maxEvents')
            ) {
                ExtensionOutputChannel.info(
                    'Configuration',
                    'Background service configuration changed',
                );
                backgroundService.updateConfiguration();
            }

            // Handle log path configuration changes
            if (
                e.affectsConfiguration('winccoaLogviewer.logPathSource') ||
                e.affectsConfiguration('winccoaLogviewer.staticLogPath')
            ) {
                ExtensionOutputChannel.info('Configuration', 'Log path configuration changed');

                // Re-setup Core integration when mode changes
                setupCoreExtensionIntegration();

                // Restart background service with new path
                const newPath = PathResolver.getLogPath();
                if (newPath) {
                    ExtensionOutputChannel.debug(
                        'Configuration',
                        `Restarting background service with new log path: ${newPath}`,
                    );
                    backgroundService.restart(newPath).catch((error) => {
                        ExtensionOutputChannel.error(
                            'Configuration',
                            'Failed to restart background service',
                            error as Error,
                        );
                    });
                }

                // If panel is open, update it with new path
                if (LogViewerPanel.currentPanel) {
                    if (newPath) {
                        ExtensionOutputChannel.debug(
                            'Configuration',
                            `Updating active panel with new log path: ${newPath}`,
                        );
                        LogViewerPanel.currentPanel.startWatching(newPath);
                    }
                }
            }
        }),
    );

    // Register the command to open the LogViewer
    // This command can be called from:
    // 1. Command Palette (Ctrl+Shift+P -> "WinCC OA: Open LogViewer")
    // 2. Other extensions (vscode.commands.executeCommand('winccoa-logviewer.open', logPath))
    // 3. Buttons/UI elements in other extensions
    const openLogViewerCommand = vscode.commands.registerCommand(
        'winccoa-logviewer.open',
        (logPath?: string) => {
            // Use provided logPath or resolve from configuration
            const resolvedPath = logPath || PathResolver.getLogPath();

            if (!resolvedPath) {
                ExtensionOutputChannel.warn('Command', 'Cannot open LogViewer: no valid log path');
                return;
            }

            ExtensionOutputChannel.info('Command', `Opening LogViewer: ${resolvedPath}`);
            LogViewerPanel.createOrShow(context, resolvedPath);
        },
    );

    context.subscriptions.push(openLogViewerCommand);

    // Register the command to clear logs (called by Script Actions before execution)
    const clearLogsCommand = vscode.commands.registerCommand('winccoa-logviewer.clearLogs', () => {
        const config = vscode.workspace.getConfiguration('winccoaLogviewer');
        const autoClear = config.get<boolean>('autoClearOnScriptExecution', false);

        if (!autoClear) {
            ExtensionOutputChannel.debug(
                'Command',
                'Auto-clear disabled - ignoring clearLogs command',
            );
            return;
        }

        ExtensionOutputChannel.info('Command', 'Clearing logs (triggered by Script Actions)');

        // Clear background service buffer
        backgroundService.clearEvents();

        // Clear active panel if open
        if (LogViewerPanel.currentPanel) {
            LogViewerPanel.currentPanel.clearLogs();
        }
    });

    context.subscriptions.push(clearLogsCommand);

    // Note: Logger disposal is handled by output channel subscription
}

/**
 * Get the global Background Service instance
 */
export function getBackgroundService(): LogBackgroundService {
    return backgroundService;
}

/**
 * Get the global Language Model Tools Service instance
 */
export function getLanguageModelTools(): LanguageModelToolsService | undefined {
    return languageModelTools;
}

async function setupCoreExtensionIntegration() {
    const config = vscode.workspace.getConfiguration('winccoaLogviewer');
    const logPathSource = config.get<string>('logPathSource', 'workspace');

    if (logPathSource !== 'automatic') {
        ExtensionOutputChannel.debug(
            'CoreIntegration',
            'Not in automatic mode - Core extension integration disabled',
        );
        return;
    }

    const coreExtension = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');

    if (!coreExtension) {
        ExtensionOutputChannel.warn(
            'CoreIntegration',
            'WinCC OA Core extension not found - automatic mode unavailable',
        );
        ExtensionOutputChannel.info(
            'CoreIntegration',
            '⚠️ No active WinCC OA project detected at startup',
        );
        ExtensionOutputChannel.info(
            'CoreIntegration',
            '💡 Select a project in WinCC OA Project Admin to start log monitoring',
        );
        return;
    }

    if (!coreExtension.isActive) {
        ExtensionOutputChannel.debug('CoreIntegration', 'Activating Core extension...');
        await coreExtension.activate();
    }

    const coreApi = coreExtension.exports;

    // Log initial project state
    ExtensionOutputChannel.info(
        'CoreIntegration',
        '═══════════════════════════════════════════════════════',
    );
    ExtensionOutputChannel.info('CoreIntegration', '🔍 Checking for active WinCC OA project...');

    // Subscribe to project changes
    coreApi.onDidChangeProject((project: unknown) => {
        if (
            project &&
            typeof project === 'object' &&
            'projectDir' in project &&
            'name' in project
        ) {
            const proj = project as { projectDir: string; name: string };
            const projectDir = proj.projectDir.replace(/[/]+$/, ''); // Remove trailing slashes
            const logPath = `${projectDir}/log`;

            ExtensionOutputChannel.info(
                'CoreIntegration',
                '═══════════════════════════════════════════════════════',
            );
            ExtensionOutputChannel.info(
                'CoreIntegration',
                `🔄 WinCC OA Project Changed: ${proj.name}`,
            );
            ExtensionOutputChannel.info('CoreIntegration', `📂 Project directory: ${projectDir}`);
            ExtensionOutputChannel.info('CoreIntegration', `📁 Log folder: ${logPath}`);

            // Validate path before updating panel
            if (!PathResolver.validatePath(logPath)) {
                ExtensionOutputChannel.error(
                    'CoreIntegration',
                    `❌ Log folder not found: ${logPath}`,
                );
                ExtensionOutputChannel.warn(
                    'CoreIntegration',
                    '⚠️ Background log monitoring will not work until log folder exists',
                );
                ExtensionOutputChannel.info(
                    'CoreIntegration',
                    '═══════════════════════════════════════════════════════',
                );
                return;
            }

            ExtensionOutputChannel.info(
                'CoreIntegration',
                `✅ Log folder exists and is accessible`,
            );

            // Only restart if path actually changed (prevent restart on first event)
            const currentConfig = backgroundService.getConfiguration();
            if (currentConfig.currentPath !== logPath) {
                ExtensionOutputChannel.debug(
                    'CoreIntegration',
                    `Restarting background service for new project (${currentConfig.currentPath} → ${logPath})`,
                );
                backgroundService.restart(logPath).catch((error) => {
                    ExtensionOutputChannel.error(
                        'CoreIntegration',
                        'Failed to restart background service',
                        error as Error,
                    );
                });
            } else {
                ExtensionOutputChannel.debug(
                    'CoreIntegration',
                    `Path unchanged (${logPath}) - no restart needed`,
                );
            }

            // If panel is open, update it with new log path
            if (LogViewerPanel.currentPanel) {
                ExtensionOutputChannel.debug(
                    'CoreIntegration',
                    `Updating active panel with new log path`,
                );
                LogViewerPanel.currentPanel.startWatching(logPath);
            }
        } else {
            ExtensionOutputChannel.info('CoreIntegration', 'No project selected');
        }
    });

    const currentProject = coreApi.getCurrentProject();
    if (currentProject) {
        const projectDir = currentProject.projectDir.replace(/[/]+$/, ''); // Remove trailing slashes
        const logPath = `${projectDir}/log`;
        ExtensionOutputChannel.info(
            'CoreIntegration',
            `🎯 Active WinCC OA Project: ${currentProject.name}`,
        );
        ExtensionOutputChannel.info('CoreIntegration', `📂 Project directory: ${projectDir}`);
        ExtensionOutputChannel.info('CoreIntegration', `📁 Expected log folder: ${logPath}`);

        if (!PathResolver.validatePath(logPath)) {
            ExtensionOutputChannel.error(
                'CoreIntegration',
                `❌ Log directory does not exist: ${logPath}`,
            );
            ExtensionOutputChannel.warn(
                'CoreIntegration',
                `⚠️ Please check if WinCC OA project is properly configured`,
            );
        } else {
            ExtensionOutputChannel.info(
                'CoreIntegration',
                `✅ Log folder exists and is accessible`,
            );
        }
    } else {
        ExtensionOutputChannel.warn('CoreIntegration', '⚠️ No WinCC OA project currently selected');
        ExtensionOutputChannel.info(
            'CoreIntegration',
            'Please select a project in WinCC OA Project Admin to enable log monitoring',
        );
    }
}

export function deactivate() {
    ExtensionOutputChannel.info('Extension', 'WinCC OA LogViewer Extension deactivated');

    // Dispose background service
    if (backgroundService) {
        backgroundService.dispose();
    }
}
