import * as vscode from 'vscode';
import { LogViewerPanel } from './logViewerPanel';
import { ExtensionOutputChannel } from './extensionOutput';
import { PathResolver } from './pathResolver';

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

    // Log configuration status
    const config = vscode.workspace.getConfiguration('winccoaLogviewer');
    const logPathSource = config.get<string>('logPathSource', 'workspace');
    const logLevel = config.get<string>('logLevel', 'INFO');
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

    ExtensionOutputChannel.info('Extension', 'WinCC OA LogViewer Extension activated');

    // Setup Core extension integration if in automatic mode
    setupCoreExtensionIntegration();

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('winccoaLogviewer.logLevel')) {
                ExtensionOutputChannel.updateLogLevel();
            }

            // Handle log path configuration changes
            if (
                e.affectsConfiguration('winccoaLogviewer.logPathSource') ||
                e.affectsConfiguration('winccoaLogviewer.staticLogPath')
            ) {
                ExtensionOutputChannel.info('Configuration', 'Log path configuration changed');

                // Re-setup Core integration when mode changes
                setupCoreExtensionIntegration();

                // If panel is open, update it with new path
                if (LogViewerPanel.currentPanel) {
                    const newPath = PathResolver.getLogPath();
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

    // Note: Logger disposal is handled by output channel subscription
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
        return;
    }

    if (!coreExtension.isActive) {
        ExtensionOutputChannel.debug('CoreIntegration', 'Activating Core extension...');
        await coreExtension.activate();
    }

    const coreApi = coreExtension.exports;

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
                `Project changed: ${proj.name} → Log path: ${logPath}`,
            );

            // Validate path before updating panel
            if (!PathResolver.validatePath(logPath)) {
                ExtensionOutputChannel.error('CoreIntegration', `Invalid log path: ${logPath}`);
                return;
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
            `Current project: ${currentProject.name} → Log path: ${logPath}`,
        );

        if (!PathResolver.validatePath(logPath)) {
            ExtensionOutputChannel.warn(
                'CoreIntegration',
                `Log directory does not exist: ${logPath}`,
            );
        }
    } else {
        ExtensionOutputChannel.debug('CoreIntegration', 'No project currently selected');
    }
}

export function deactivate() {
    ExtensionOutputChannel.info('Extension', 'WinCC OA LogViewer Extension deactivated');
}
