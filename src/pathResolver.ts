import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionOutputChannel } from './extensionOutput';

export type LogPathSource = 'static' | 'workspace' | 'npm-package';

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
            case 'npm-package':
                return this.getNpmPackagePath();
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
     * Get log path from npm package
     * TODO: Implement when npm package is available
     */
    private static getNpmPackagePath(): string | undefined {
        ExtensionOutputChannel.warn('PathResolver', 'npm-package path source not yet implemented');
        vscode.window.showWarningMessage(
            'WinCC OA LogViewer: NPM package integration is not yet available. Please use "static" or "workspace" path source for now.'
        );
        return undefined;
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
