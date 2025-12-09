import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Centralized logging for the WinCC OA LogViewer extension
 */
class Logger {
    private outputChannel: vscode.OutputChannel | undefined;
    private logLevel: LogLevel = LogLevel.INFO; // Default: only INFO and above

    /**
     * Initialize the output channel
     */
    public initialize(): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('WinCC OA LogViewer');
        }
        
        // Read log level from configuration
        this.updateLogLevel();
    }

    /**
     * Get the output channel for registration
     */
    public getOutputChannel(): vscode.OutputChannel | undefined {
        return this.outputChannel;
    }

    /**
     * Update log level from configuration
     */
    public updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration('winccoaLogviewer');
        const levelString = config.get<string>('logLevel', 'info');
        
        switch (levelString.toLowerCase()) {
            case 'debug':
                this.logLevel = LogLevel.DEBUG;
                break;
            case 'info':
                this.logLevel = LogLevel.INFO;
                break;
            case 'warn':
                this.logLevel = LogLevel.WARN;
                break;
            case 'error':
                this.logLevel = LogLevel.ERROR;
                break;
            default:
                this.logLevel = LogLevel.INFO;
        }
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel?.show(true); // preserveFocus = true
    }

    /**
     * Log info message
     */
    public info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, 'INFO', message, ...args);
    }

    /**
     * Log warning message
     */
    public warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, 'WARN', message, ...args);
    }

    /**
     * Log error message
     */
    public error(message: string, error?: Error | any, ...args: any[]): void {
        if (error instanceof Error) {
            this.log(LogLevel.ERROR, 'ERROR', `${message}: ${error.message}`, ...args);
            if (error.stack) {
                this.log(LogLevel.ERROR, 'ERROR', `Stack: ${error.stack}`);
            }
        } else if (error) {
            this.log(LogLevel.ERROR, 'ERROR', `${message}: ${error}`, ...args);
        } else {
            this.log(LogLevel.ERROR, 'ERROR', message, ...args);
        }
    }

    /**
     * Log debug message
     */
    public debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
    }

    /**
     * Internal log method
     */
    private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
        // Skip if log level is below configured threshold
        if (level < this.logLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
        const logMessage = `[${timestamp}] [${levelName}] ${message}${formattedArgs}`;
        
        this.outputChannel?.appendLine(logMessage);

        // Also log to console for debugging in dev mode
        if (process.env.NODE_ENV === 'development') {
            console.log(logMessage);
        }
    }

    /**
     * Dispose the output channel
     */
    public dispose(): void {
        this.outputChannel?.dispose();
        this.outputChannel = undefined;
    }
}

// Export singleton instance
export const logger = new Logger();
