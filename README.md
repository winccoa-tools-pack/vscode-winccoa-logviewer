# WinCC OA LogViewer

<div align="center">

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.107.1-007ACC.svg)

**Real-time log file viewer and analyzer for WinCC OA**

[Features](#-features) • [Installation](#-installation) • [Known Issues](#-known-issues)

</div>

---

> **Disclaimer:**
> This is the first stable release (v1.0.2) of the WinCC OA LogViewer extension. Not all features are fully implemented and some functions may not work perfectly yet. Please report any issues you encounter.
> **Tip:** If the extension doesn't work as expected, try `Ctrl+Shift+P` → `Reload Window` to refresh.

---

## 🎬 See It In Action

![WinCC OA LogViewer Demo](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer/blob/develop/images/Animation.gif?raw=true)

---

## ✨ Features

### 📊 Real-Time Log Monitoring

- **Live file watching**: Automatic updates when log files change
- **PVSS_II.log parsing**: Smart parsing of WinCC OA log format with metadata extraction
- **Multiple log files**: Monitor PVSS_II.log, WCCOActrl\*.log, and custom log files
- **Pause/Resume**: Control log streaming on demand
- **Newest First**: Toggle to show most recent events first
- **Plain Text Mode**: Toggle between structured table view and classic plain text log output (default)

### 🔍 Advanced Filtering & Analysis

- **Severity Filtering**: Toggle DEBUG, INFO, WARNING, SEVERE, FATAL, ERROR, OTHER levels
- **Text Search**: Search across all log entries
- **Column Management**: Show/hide columns via right-click menu
- **Resizable Columns**: Drag column headers to resize
- **Expandable Metadata**: Click on log entry to view script path, library, line number, stacktrace

### 📜 History Loading

- **Load History**: Browse and load historical PVSS_II\*.log files
- **Time Range**: Filter logs by date and time (24-hour format)
- **File Selection**: Choose from archived log files with size information
- **Batch Loading**: Events loaded in batches with progress indicator

### 🚀 Smart Navigation

- **Clickable File Paths**: Open scripts directly in editor from log metadata
- **Integration**: Works seamlessly with WinCC OA Control extension for automatic path detection

---

## ⚙️ Configuration

### Essential Settings

| Setting                          | Default     | Description                                                                                         |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `winccoaLogviewer.logPathSource` | `automatic` | Path detection: `static` (manual), `workspace` (workspace/log), `automatic` (via Control extension) |
| `winccoaLogviewer.staticLogPath` | -           | Static log path (e.g., `C:/WinCC_OA/DevEnv/log` or `/opt/WinCC_OA/DevEnv/log`)                      |

### Logging (for debugging)

| Setting                     | Default | Description                                              |
| --------------------------- | ------- | -------------------------------------------------------- |
| `winccoaLogviewer.logLevel` | `INFO`  | Log verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |

💡 **Tip**: Set log level to `DEBUG` when reporting bugs for detailed diagnostics.

---

## 🐛 Known Issues

### Current Limitations

1. **Performance with Large Logs**:
    - UI can become slow with 10,000+ events
    - No virtualized rendering yet (planned for future release)
    - Recommendation: Use time range filtering when loading history

2. **File Re-Activation Floods History** (known, not fixed):
    - When deselecting and re-selecting a log file, all historical events are replayed
    - Root cause: FileWatcher maintains file position even when file is unwatched
    - Impact: Can cause duplicate entries in UI if file was previously watched
    - Workaround: Clear logs after re-activation or avoid toggling files repeatedly
    - Status: Will be fixed in future release

3. **Log Event Ordering**:
    - Multi-line log events (with stacktraces) are correctly parsed since v0.2.2
    - Parser buffer is properly flushed to prevent ordering issues

4. **Automatic Path Detection**:
    - Requires WinCC OA Control extension installed and active
    - Falls back to workspace or static path if Control not available

### Reporting Bugs

Found an issue? Please report it with:

- WinCC OA version
- Extension version (`1.0.3`)
- Log file example that reproduces the issue
- Enable `DEBUG` logging and attach log output

[Report Issue on GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer/issues)

---

## 📝 Commands

Access via `Ctrl+Shift+P`:

| Command                    | Description                                |
| -------------------------- | ------------------------------------------ |
| `WinCC OA: Open LogViewer` | Open log viewer panel and start monitoring |

**Programmatic Access:**

```typescript
vscode.commands.executeCommand('winccoa-logviewer.open', optionalLogPath);
```

---

## 🛠️ Requirements

- **VS Code:** 1.107.1 or higher
- **WinCC OA:** 3.19+ with accessible log directory
- **WinCC OA Control:** Extension (optional, for automatic path detection)

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 📜 Disclaimer

WinCC OA and Siemens are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project.

---

<div align="center">

Made with ❤️ for the WinCC OA community

[GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer) • [Issues](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer/issues) • [WinCC OA Docs](https://www.winccoa.com)

</div>
