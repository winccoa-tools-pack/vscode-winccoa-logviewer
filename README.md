# WinCC OA LogViewer

⚠️ **Pre-Release Version** - This is the very first pre-release version. Not all features have been fully tested yet.

A VS Code extension for viewing and analyzing WinCC OA log files in real-time.

## Features

- Real-time log file monitoring with file watcher
- Syntax highlighting for log events
- Filter by severity level (DEBUG, INFO, WARNING, ERROR, SEVERE)
- Search capabilities across all log entries
- Click on file paths to open files directly in editor
- Support for PVSS_II.log format with metadata parsing
- Pause/Resume log streaming

## Configuration

The extension can be configured via VS Code settings:

### Recommended Settings

It is recommended to use either **static path** or **workspace** as the log path source:

- **Static Path** (`winccoaLogviewer.logPathSource: "static"`): Use a fixed path to your WinCC OA log directory
  - Set `winccoaLogviewer.staticLogPath` to your log directory (e.g., `C:\wincc_proj\DevEnv\DevEnv\log`)
  
- **Workspace** (`winccoaLogviewer.logPathSource: "workspace"`): Automatically derive log path from workspace root
  - The extension will look for a `log` folder in your workspace root directory

### How it works

The LogViewer watches the specified log directory and monitors all `.log` files. When changes are detected (new log entries), they are automatically displayed in the webview interface. You can pause/resume the live stream at any time.

## Usage

### Open LogViewer

- Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
- Run command: `WinCC OA: Open LogViewer`

The LogViewer will open in a new editor column and automatically start watching the configured log directory.

### From other extensions

```typescript
vscode.commands.executeCommand('winccoa-logviewer.open', logPath);
```

Press F5 to debug the extension.

## Disclaimer

WinCC OA and Siemens are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

## License

This repository is licensed under the MIT License — see the included LICENSE file for details.

## Contributing

Contributions are welcome. If you want to add more extensions to the pack or suggestions for documentation, open an issue or submit a pull request.
