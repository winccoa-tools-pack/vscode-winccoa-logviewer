import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionOutputChannel } from './extensionOutput';

export type LogPathSource = 'static' | 'workspace' | 'automatic';

/**
 * Resolves the log directory path based on configuration
 */
export class PathResolver {
    /**
     * Get the log path based on current configuration
     */
    public static getLogPath(): string | undefined {
        const config = vscode.workspace.getConfiguration('winccoaLogviewer');
        const source = config.get<LogPathSource>('logPathSource', 'workspace');

        ExtensionOutputChannel.debug('PathResolver', `Resolving log path with source: ${source}`);

        switch (source) {
            case 'static':
                return this.getStaticPath();
            case 'workspace':
                return this.getWorkspacePath();
            case 'automatic':
                return this.getAutomaticPath();
            default:
                ExtensionOutputChannel.warn('PathResolver', `Unknown log path source: ${source}, falling back to workspace`);
                return this.getWorkspacePath();
        }
    }

    /**
     * Get static path from configuration
     */
    private static getStaticPath(): string | undefined {
        const config = vscode.workspace.getConfiguration('winccoaLogviewer');
        const staticPath = config.get<string>('staticLogPath', '');

        if (!staticPath || staticPath.trim() === '') {
            ExtensionOutputChannel.error('PathResolver', 'Static log path is not configured');
            vscode.window.showWarningMessage(
                'WinCC OA LogViewer: Static log path is not configured. Please set "winccoaLogviewer.staticLogPath" in settings.'
            );
            return undefined;
        }

        // Validate that path exists
        if (!fs.existsSync(staticPath)) {
            ExtensionOutputChannel.error('PathResolver', `Static log path does not exist: ${staticPath}`);
            vscode.window.showWarningMessage(
                `WinCC OA LogViewer: Static log path does not exist: ${staticPath}`
            );
            return undefined;
        }

        ExtensionOutputChannel.info('PathResolver', `Using static log path: ${staticPath}`);
        return staticPath;
    }

    /**
     * Get log path derived from workspace
     */
    private static getWorkspacePath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            ExtensionOutputChannel.error('PathResolver', 'No workspace folder open');
            vscode.window.showWarningMessage(
                'WinCC OA LogViewer: No workspace folder is open. Please open a workspace or configure a static log path.'
            );
            return undefined;
        }

        // Search through all workspace folders for a 'log' directory
        for (const folder of workspaceFolders) {
            const workspaceRoot = folder.uri.fsPath;
            const logPath = path.join(workspaceRoot, 'log');

            // Check if log directory exists in this workspace folder
            if (fs.existsSync(logPath)) {
                ExtensionOutputChannel.info('PathResolver', `Using workspace-derived log path: ${logPath}`);
                return logPath;
            }
        }

        // No log directory found in any workspace folder
        const firstWorkspace = workspaceFolders[0].uri.fsPath;
        ExtensionOutputChannel.error('PathResolver', `Log directory does not exist in any workspace folder: ${workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);
        vscode.window.showWarningMessage(
            `WinCC OA LogViewer: Log directory not found in any workspace folder. Please ensure one of your workspace folders contains a 'log' folder or configure a different path source.`
        );
        return undefined;
    }

    /**
     * Get log path from Core extension (automatic mode)
     */
    private static getAutomaticPath(): string | undefined {
        const coreExtension = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
        
        if (!coreExtension) {
            ExtensionOutputChannel.error('PathResolver', 'WinCC OA Core extension not found');
            vscode.window.showErrorMessage(
                'WinCC OA Core extension is required for automatic mode. Please install it or switch to a different path source.',
            );
            return undefined;
        }

        if (!coreExtension.isActive) {
            ExtensionOutputChannel.warn('PathResolver', 'Core extension is not active yet');
            return undefined;
        }

        const coreApi = coreExtension.exports;
        const currentProject = coreApi.getCurrentProject();

        if (!currentProject) {
            ExtensionOutputChannel.warn('PathResolver', 'No WinCC OA project selected in Core extension');
            vscode.window.showWarningMessage(
                'No WinCC OA project selected. Please select a project using the WinCC OA status bar.',
            );
            return undefined;
        }

        const projectDir = currentProject.projectDir.replace(/[\/]+$/, ''); // Remove trailing slashes
        const logPath = `${projectDir}/log`;
        
        if (!fs.existsSync(logPath)) {
            ExtensionOutputChannel.warn('PathResolver', `Log directory does not exist: ${logPath}`);
            vscode.window.showWarningMessage(
                `Log directory does not exist for project "${currentProject.name}": ${logPath}`,
            );
            return undefined;
        }

        ExtensionOutputChannel.debug('PathResolver', `Automatic mode - Project: ${currentProject.name}, Log path: ${logPath}`);
        return logPath;
    }

    /**
     * Validate that a path exists and is a directory
     */
    public static validatePath(logPath: string): boolean {
        ExtensionOutputChannel.trace('PathResolver', `Validating path: ${logPath}`);
        try {
            const stats = fs.statSync(logPath);
            if (!stats.isDirectory()) {
                ExtensionOutputChannel.warn('PathResolver', `Path is not a directory: ${logPath}`);
                return false;
            }
            ExtensionOutputChannel.trace('PathResolver', `Path validated successfully: ${logPath}`);
            return true;
        } catch (error) {
            ExtensionOutputChannel.error('PathResolver', `Path validation failed: ${logPath}`, error as Error);
            return false;
        }
    }
}
