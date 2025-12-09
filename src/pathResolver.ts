import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';

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

        logger.info('Resolving log path', { source });

        switch (source) {
            case 'static':
                return this.getStaticPath();
            case 'workspace':
                return this.getWorkspacePath();
            case 'npm-package':
                return this.getNpmPackagePath();
            default:
                logger.warn('Unknown log path source, falling back to workspace', { source });
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
            logger.warn('Static log path is not configured');
            vscode.window.showWarningMessage(
                'WinCC OA LogViewer: Static log path is not configured. Please set "winccoaLogviewer.staticLogPath" in settings.'
            );
            return undefined;
        }

        // Validate that path exists
        if (!fs.existsSync(staticPath)) {
            logger.warn('Static log path does not exist', { path: staticPath });
            vscode.window.showWarningMessage(
                `WinCC OA LogViewer: Static log path does not exist: ${staticPath}`
            );
            return undefined;
        }

        logger.info('Using static log path', { path: staticPath });
        return staticPath;
    }

    /**
     * Get log path derived from workspace
     */
    private static getWorkspacePath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            logger.warn('No workspace folder open');
            vscode.window.showWarningMessage(
                'WinCC OA LogViewer: No workspace folder is open. Please open a workspace or configure a static log path.'
            );
            return undefined;
        }

        // Use first workspace folder
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const logPath = path.join(workspaceRoot, 'log');

        // Check if log directory exists
        if (!fs.existsSync(logPath)) {
            logger.warn('Log directory does not exist in workspace', { workspace: workspaceRoot, logPath });
            vscode.window.showWarningMessage(
                `WinCC OA LogViewer: Log directory not found at ${logPath}. Please ensure the workspace contains a 'log' folder or configure a different path source.`
            );
            return undefined;
        }

        logger.info('Using workspace-derived log path', { workspace: workspaceRoot, logPath });
        return logPath;
    }

    /**
     * Get log path from npm package
     * TODO: Implement when npm package is available
     */
    private static getNpmPackagePath(): string | undefined {
        logger.warn('npm-package path source not yet implemented');
        vscode.window.showWarningMessage(
            'WinCC OA LogViewer: NPM package integration is not yet available. Please use "static" or "workspace" path source for now.'
        );
        return undefined;
    }

    /**
     * Validate that a path exists and is a directory
     */
    public static validatePath(logPath: string): boolean {
        try {
            const stats = fs.statSync(logPath);
            if (!stats.isDirectory()) {
                logger.warn('Path is not a directory', { path: logPath });
                return false;
            }
            return true;
        } catch (error) {
            logger.error('Path validation failed', error, { path: logPath });
            return false;
        }
    }
}
