import * as vscode from 'vscode';
import { LogViewerPanel } from './logViewerPanel';
import { logger } from './logger';
import { PathResolver } from './pathResolver';

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    logger.initialize();
    
    // Register output channel
    const outputChannel = logger.getOutputChannel();
    if (outputChannel) {
        context.subscriptions.push(outputChannel);
    }
    
    logger.info('WinCC OA LogViewer Extension activated');

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('winccoaLogviewer.logLevel')) {
                logger.updateLogLevel();
                logger.info('Log level updated');
            }
            
            // Handle log path configuration changes
            if (e.affectsConfiguration('winccoaLogviewer.logPathSource') || 
                e.affectsConfiguration('winccoaLogviewer.staticLogPath')) {
                logger.info('Log path configuration changed');
                
                // If panel is open, update it with new path
                if (LogViewerPanel.currentPanel) {
                    const newPath = PathResolver.getLogPath();
                    if (newPath) {
                        logger.info('Updating active panel with new log path', { path: newPath });
                        LogViewerPanel.currentPanel.startWatching(newPath);
                    }
                }
            }
        })
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
                logger.warn('Cannot open LogViewer: no valid log path');
                return;
            }
            
            logger.info('Opening LogViewer', { logPath: resolvedPath });
            LogViewerPanel.createOrShow(context.extensionUri, resolvedPath);
        }
    );

    context.subscriptions.push(openLogViewerCommand);
    
    // Note: Logger disposal is handled by output channel subscription
}

export function deactivate() {
    logger.info('WinCC OA LogViewer Extension deactivated');
}
