import * as vscode from 'vscode';
import { LogFileWatcher } from './logFileWatcher';
import { LogEvent } from './logEvent';
import { logger } from './logger';

export class LogViewerPanel {
    public static currentPanel: LogViewerPanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _watcher: LogFileWatcher | undefined;
    private _currentLogPath: string | undefined;

    // ---------- Factory ----------
    public static createOrShow(extensionUri: vscode.Uri, logPath?: string) {
        logger.info('createOrShow called', { logPath, hasCurrentPanel: !!LogViewerPanel.currentPanel });
        
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
            logger.info('Reusing existing panel', { column });
            LogViewerPanel.currentPanel._panel.reveal(column);
            
            // If new logPath provided, update watcher
            if (logPath) {
                logger.info('Updating watcher with new log path', { logPath });
                LogViewerPanel.currentPanel.startWatching(logPath);
            }
            return;
        }

        // Neues Panel erzeugen
        logger.info('Creating new webview panel', { column });
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
        logger.debug('LogViewerPanel constructor', { logPath });
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Message Handler für File-Clicks
        this._panel.webview.onDidReceiveMessage(
            message => {
                logger.debug('Received webview message', { command: message.command });
                switch (message.command) {
                    case 'openFile':
                        this._openFile(message.filePath, message.line);
                        return;
                    case 'ready':
                        logger.info('Webview ready');
                        // Webview is ready, start watching if logPath provided
                        if (logPath) {
                            this.startWatching(logPath);
                        }
                        return;
                    case 'setPaused':
                        logger.info('Setting paused state', { paused: message.paused });
                        this.setPaused(message.paused);
                        return;
                    case 'openSettings':
                        logger.info('Opening extension settings');
                        this._openSettings();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Set paused state of the watcher
     */
    public setPaused(paused: boolean): void {
        logger.info('setPaused', { paused, hasWatcher: !!this._watcher });
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
        logger.info('Starting to watch log directory', { logPath });
        
        // Check if already watching this path
        if (this._currentLogPath === logPath && this._watcher) {
            logger.debug('Already watching this path', { logPath });
            return;
        }
        
        // Stop existing watcher if any
        if (this._watcher) {
            logger.debug('Stopping existing watcher');
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
            logger.debug('Sending available log files to webview', { count: availableFiles.length });
            this._panel.webview.postMessage({
                command: 'availableLogFiles',
                files: availableFiles
            });
            
            logger.info('Successfully started watching logs', { logPath });
            vscode.window.showInformationMessage(`Watching logs in: ${logPath}`);
        } catch (error) {
            this._currentLogPath = undefined;
            logger.error('Failed to start watching logs', error, { logPath });
            vscode.window.showErrorMessage(`Failed to watch logs: ${error}`);
        }
    }

    private async _openFile(filePath: string, line?: number) {
        logger.info('Opening file from log', { filePath, line });
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
            logger.info('Successfully opened file', { filePath, line });
        } catch (error) {
            logger.error('Failed to open file', error, { filePath, line });
            vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
        }
    }

    /**
     * Open extension settings
     */
    private _openSettings() {
        logger.info('Opening settings for winccoaLogviewer');
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
        logger.info('Disposing LogViewerPanel');
        LogViewerPanel.currentPanel = undefined;

        // Stop watcher
        if (this._watcher) {
            logger.debug('Disposing watcher');
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
        logger.debug('LogViewerPanel disposed');
    }
}
