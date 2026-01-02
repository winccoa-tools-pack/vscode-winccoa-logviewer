import * as vscode from 'vscode';
import { LogFileWatcher } from './logFileWatcher';
import { LogEvent } from './logEvent';
import { ExtensionOutputChannel } from './extensionOutput';

export class LogViewerPanel {
    public static currentPanel: LogViewerPanel | undefined;
    private static _context: vscode.ExtensionContext;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _watcher: LogFileWatcher | undefined;
    private _currentLogPath: string | undefined;

    // State key for workspaceState
    private static readonly STATE_KEY = 'logViewerSettings';

    // ---------- Factory ----------
    public static createOrShow(context: vscode.ExtensionContext, logPath?: string) {
        LogViewerPanel._context = context;
        const extensionUri = context.extensionUri;
        ExtensionOutputChannel.debug('LogViewerPanel', `createOrShow called with logPath: ${logPath}`);
        
        // Always open in a new column to the side
        let column: vscode.ViewColumn;
        
        if (vscode.window.activeTextEditor) {
            // If there's an active editor, open beside it
            const activeColumn = vscode.window.activeTextEditor.viewColumn || vscode.ViewColumn.One;
            
            // Determine the next column
            if (activeColumn === vscode.ViewColumn.One) {
                column = vscode.ViewColumn.Two;
            } else if (activeColumn === vscode.ViewColumn.Two) {
                column = vscode.ViewColumn.Three;
            } else {
                // If already in column 3 or beyond, open beside
                column = vscode.ViewColumn.Beside;
            }
        } else {
            // No active editor, open in column 2
            column = vscode.ViewColumn.Two;
        }

        // Wenn es schon ein Panel gibt → nur zeigen
        if (LogViewerPanel.currentPanel) {
            ExtensionOutputChannel.debug('LogViewerPanel', `Reusing existing panel in column ${column}`);
            LogViewerPanel.currentPanel._panel.reveal(column);
            
            // If new logPath provided, update watcher
            if (logPath) {
                ExtensionOutputChannel.info('LogViewerPanel', `Updating watcher with new log path: ${logPath}`);
                LogViewerPanel.currentPanel.startWatching(logPath);
            }
            return;
        }

        // Neues Panel erzeugen
        ExtensionOutputChannel.info('LogViewerPanel', `Creating new webview panel in column ${column}`);
        const panel = vscode.window.createWebviewPanel(
            'winccoaLogViewer',
            'WinCC OA Log Viewer',
            column,
            {
                enableScripts: true, // React Bundle braucht JS
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
                ],
            }
        );

        LogViewerPanel.currentPanel = new LogViewerPanel(panel, extensionUri, logPath);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, logPath?: string) {
        ExtensionOutputChannel.trace('LogViewerPanel', `Constructor called with logPath: ${logPath}`);
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Message Handler für File-Clicks
        this._panel.webview.onDidReceiveMessage(
            message => {
                ExtensionOutputChannel.trace('LogViewerPanel', `Received webview message: ${message.command}`);
                switch (message.command) {
                    case 'openFile':
                        this._openFile(message.filePath, message.line);
                        return;
                    case 'ready':
                        ExtensionOutputChannel.info('LogViewerPanel', 'Webview ready');
                        // Send persisted settings to webview
                        this._sendPersistedSettings();
                        // Webview is ready, start watching if logPath provided
                        if (logPath) {
                            this.startWatching(logPath);
                        }
                        return;
                    case 'setPaused':
                        ExtensionOutputChannel.debug('LogViewerPanel', `Setting paused state: ${message.paused}`);
                        this.setPaused(message.paused);
                        return;
                    case 'openSettings':
                        ExtensionOutputChannel.debug('LogViewerPanel', 'Opening extension settings');
                        this._openSettings();
                        return;
                    case 'saveSettings':
                        ExtensionOutputChannel.debug('LogViewerPanel', 'Saving webview settings');
                        this._saveSettings(message.settings);
                        return;
                    case 'getHistoryFiles':
                        ExtensionOutputChannel.debug('LogViewerPanel', 'Getting history files');
                        this._sendHistoryFiles();
                        return;
                    case 'loadHistory':
                        ExtensionOutputChannel.info('LogViewerPanel', `Loading history: ${message.fileName}`);
                        this._loadHistory(message.fileName, message.fromTime, message.toTime);
                        return;
                    case 'setWatchedFiles':
                        ExtensionOutputChannel.debug('LogViewerPanel', `Setting watched files: ${message.files}`);
                        this._setWatchedFiles(message.files);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Send persisted settings to webview
     */
    private _sendPersistedSettings(): void {
        const settings = LogViewerPanel._context.workspaceState.get(LogViewerPanel.STATE_KEY);
        if (settings) {
            ExtensionOutputChannel.debug('LogViewerPanel', 'Sending persisted settings to webview');
            this._panel.webview.postMessage({
                command: 'restoreSettings',
                settings
            });
        }
    }

    /**
     * Save settings from webview to workspaceState
     */
    private _saveSettings(settings: any): void {
        LogViewerPanel._context.workspaceState.update(LogViewerPanel.STATE_KEY, settings);
        ExtensionOutputChannel.trace('LogViewerPanel', `Settings saved: ${JSON.stringify(settings)}`);
    }

    /**
     * Send available history files to webview
     */
    private _sendHistoryFiles(): void {
        if (!this._watcher) {
            ExtensionOutputChannel.warn('LogViewerPanel', 'Cannot get history files: no watcher');
            return;
        }
        
        const files = this._watcher.getHistoryFiles();
        this._panel.webview.postMessage({
            command: 'historyFiles',
            files: files.map(f => ({
                name: f.name,
                size: f.size,
                modified: f.modified.toISOString(),
                firstTimestamp: f.firstTimestamp,
                lastTimestamp: f.lastTimestamp
            }))
        });
    }

    /**
     * Load history from a specific file
     */
    private async _loadHistory(fileName: string, fromTime?: string, toTime?: string): Promise<void> {
        if (!this._watcher) {
            ExtensionOutputChannel.warn('LogViewerPanel', 'Cannot load history: no watcher');
            return;
        }

        // Send loading state
        this._panel.webview.postMessage({
            command: 'historyLoading',
            loading: true
        });

        try {
            const events = await this._watcher.loadHistoryFile(fileName, fromTime, toTime);
            
            // Send events in batches to avoid overwhelming the webview
            const batchSize = 100;
            for (let i = 0; i < events.length; i += batchSize) {
                const batch = events.slice(i, i + batchSize);
                this._panel.webview.postMessage({
                    command: 'historyEvents',
                    events: batch,
                    progress: Math.min(100, Math.round((i + batch.length) / events.length * 100))
                });
                // Small delay between batches to allow UI to update
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Send completion
            this._panel.webview.postMessage({
                command: 'historyLoading',
                loading: false,
                totalEvents: events.length
            });

        } catch (error) {
            ExtensionOutputChannel.error('LogViewerPanel', 'Error loading history', error as Error);
            this._panel.webview.postMessage({
                command: 'historyLoading',
                loading: false,
                error: (error as Error).message
            });
        }
    }

    /**
     * Set which files the watcher should monitor
     */
    private _setWatchedFiles(files: string[]): void {
        if (!this._watcher) {
            ExtensionOutputChannel.warn('LogViewerPanel', 'Cannot set watched files: no watcher');
            return;
        }
        this._watcher.setWatchedFiles(files);
    }

    /**
     * Set paused state of the watcher
     */
    public setPaused(paused: boolean): void {
        ExtensionOutputChannel.debug('LogViewerPanel', `setPaused: ${paused}, hasWatcher: ${!!this._watcher}`);
        if (this._watcher) {
            if (paused) {
                this._watcher.pause();
            } else {
                this._watcher.resume();
            }
        }
    }

    /**
     * Start watching log directory
     */
    public async startWatching(logPath: string): Promise<void> {
        ExtensionOutputChannel.info('LogViewerPanel', `Starting to watch log directory: ${logPath}`);
        
        // Check if already watching this path
        if (this._currentLogPath === logPath && this._watcher) {
            ExtensionOutputChannel.debug('LogViewerPanel', `Already watching path: ${logPath}`);
            return;
        }
        
        // Stop existing watcher if any
        if (this._watcher) {
            ExtensionOutputChannel.debug('LogViewerPanel', 'Stopping existing watcher');
            this._watcher.stop();
        }

        try {
            this._watcher = new LogFileWatcher(logPath, (event: LogEvent) => {
                // Send event to webview
                this._panel.webview.postMessage({
                    command: 'newLogEvent',
                    event: event
                });
            });

            await this._watcher.start();
            
            this._currentLogPath = logPath;
            
            // Send available log files to webview
            const availableFiles = this._watcher.getAvailableLogFiles();
            ExtensionOutputChannel.debug('LogViewerPanel', `Sending ${availableFiles.length} log files to webview`);
            this._panel.webview.postMessage({
                command: 'availableLogFiles',
                files: availableFiles
            });
            
            ExtensionOutputChannel.success('LogViewerPanel', `Successfully started watching logs: ${logPath}`);
            vscode.window.showInformationMessage(`Watching logs in: ${logPath}`);
        } catch (error) {
            this._currentLogPath = undefined;
            ExtensionOutputChannel.error('LogViewerPanel', `Failed to start watching logs: ${logPath}`, error as Error);
            vscode.window.showErrorMessage(`Failed to watch logs: ${error}`);
        }
    }

    private async _openFile(filePath: string, line?: number) {
        ExtensionOutputChannel.info('LogViewerPanel', `Opening file: ${filePath}${line ? `:${line}` : ''}`);
        try {
            // Versuche die Datei zu öffnen
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.One,
                preview: false
            });

            // Wenn eine Zeile angegeben ist, springe dorthin
            if (line !== undefined && line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
            ExtensionOutputChannel.debug('LogViewerPanel', `Successfully opened file: ${filePath}`);
        } catch (error) {
            ExtensionOutputChannel.error('LogViewerPanel', `Failed to open file: ${filePath}`, error as Error);
            vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
        }
    }

    /**
     * Open extension settings
     */
    private _openSettings() {
        ExtensionOutputChannel.debug('LogViewerPanel', 'Opening settings for winccoaLogviewer');
        vscode.commands.executeCommand('workbench.action.openSettings', 'winccoaLogviewer');
    }

    private _update() {
        const webview = this._panel.webview;
        const html = this._getHtmlForWebview(webview);
        this._panel.webview.html = html;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Basis-Ordner des gebauten React-Bundles
        const webviewRoot = vscode.Uri.joinPath(
            this._extensionUri,
            'dist',
            'webview'
        );

        // Scripts and styles from vite build
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(webviewRoot, 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(webviewRoot, 'index.css')
        );

        const csp = [
            "default-src 'none';",
            `img-src ${webview.cspSource} https:;`,
            `style-src ${webview.cspSource} 'unsafe-inline';`,
            `script-src ${webview.cspSource};`,
        ].join(' ');

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WinCC OA Log Viewer</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose() {
        ExtensionOutputChannel.info('LogViewerPanel', 'Disposing LogViewerPanel');
        LogViewerPanel.currentPanel = undefined;

        // Stop watcher
        if (this._watcher) {
            ExtensionOutputChannel.debug('LogViewerPanel', 'Disposing watcher');
            this._watcher.dispose();
            this._watcher = undefined;
        }

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        ExtensionOutputChannel.debug('LogViewerPanel', 'LogViewerPanel disposed');
    }
}
