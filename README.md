# WinCC OA LogViewer

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.107.1-007ACC.svg)

**Real-time log file viewer and analyzer for WinCC OA**

[Features](#-features) • [Installation](#-installation) • [Known Issues](#-known-issues)

</div>

---

> **Disclaimer:**
> This is the first stable release (v1.0.0) of the WinCC OA LogViewer extension. Not all features are fully implemented and some functions may not work perfectly yet. Please report any issues you encounter.

---

## ✨ Features

### 📊 Real-Time Log Monitoring
- **Live file watching**: Automatic updates when log files change
- **PVSS_II.log parsing**: Smart parsing of WinCC OA log format with metadata extraction
- **Multiple log files**: Monitor PVSS_II.log, WCCOActrl*.log, and custom log files
- **Pause/Resume**: Control log streaming on demand
- **Newest First**: Toggle to show most recent events first

### 🔍 Advanced Filtering & Analysis
- **Severity Filtering**: Toggle DEBUG, INFO, WARNING, SEVERE, FATAL, ERROR, OTHER levels
- **Text Search**: Search across all log entries
- **Column Management**: Show/hide columns via right-click menu
- **Resizable Columns**: Drag column headers to resize
- **Expandable Metadata**: Click on log entry to view script path, library, line number, stacktrace

### 📜 History Loading
- **Load History**: Browse and load historical PVSS_II*.log files
- **Time Range**: Filter logs by date and time (24-hour format)
- **File Selection**: Choose from archived log files with size information
- **Batch Loading**: Events loaded in batches with progress indicator

### 🚀 Smart Navigation
- **Clickable File Paths**: Open scripts directly in editor from log metadata
- **Integration**: Works seamlessly with WinCC OA Control extension for automatic path detection

---

## 🚀 Installation

1. **Install from VSIX** (Recommended):
   ```bash
   code --install-extension winccoa-vscode-logviewer-1.0.0.vsix
   ```

2. **Or via VS Code Extensions**:
   - Open Extensions (`Ctrl+Shift+X`)
   - Search for "WinCC OA LogViewer"
   - Click Install

3. **Install Dependencies**:
   - **WinCC OA Control** extension (optional, for automatic path detection)

4. **Configure log path**:
   - Set `winccoaLogviewer.logPathSource` to `static`, `workspace`, or `automatic`
   - For `static` mode: Set `winccoaLogviewer.staticLogPath`

---

## ⚙️ Configuration

### Essential Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaLogviewer.logPathSource` | `workspace` | Path detection: `static` (manual), `workspace` (workspace/log), `automatic` (via Control extension) |
| `winccoaLogviewer.staticLogPath` | - | Static log path (e.g., `C:/WinCC_OA/DevEnv/log` or `/opt/WinCC_OA/DevEnv/log`) |

### Logging (for debugging)

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaLogviewer.logLevel` | `INFO` | Log verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |

💡 **Tip**: Set log level to `DEBUG` when reporting bugs for detailed diagnostics.

---

## 🐛 Known Issues

### Current Limitations

1. **Performance with Large Logs**:
   - UI can become slow with 10,000+ events
   - No virtualized rendering yet (planned for future release)
   - Recommendation: Use time range filtering when loading history

2. **File Watcher Menu Bug** (minor):
   - All log file entries disappear when clicking "Ignore" option
   - Workaround: Reopen LogViewer panel

3. **Log Event Ordering**:
   - Multi-line log events (with stacktraces) are correctly parsed since v0.2.2
   - Parser buffer is properly flushed to prevent ordering issues

4. **Automatic Path Detection**:
   - Requires WinCC OA Control extension installed and active
   - Falls back to workspace or static path if Control not available

### Reporting Bugs

Found an issue? Please report it with:
- WinCC OA version
- Extension version (`1.0.0`)
- Log file example that reproduces the issue
- Enable `DEBUG` logging and attach log output

[Report Issue on GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer/issues)

---

## 📝 Commands

Access via `Ctrl+Shift+P`:

| Command | Description |
|---------|-------------|
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

## 📚 Usage Example

### Configuration Examples

**Static Path** (single project):
```json
{
  "winccoaLogviewer.logPathSource": "static",
  "winccoaLogviewer.staticLogPath": "/opt/WinCC_OA/DevEnv/log"
}
```

**Workspace** (log folder in workspace root):
```json
{
  "winccoaLogviewer.logPathSource": "workspace"
}
```

**Automatic** (via WinCC OA Control extension):
```json
{
  "winccoaLogviewer.logPathSource": "automatic"
}
```

### PVSS_II.log Format

Supported log format example:
```
CTRL (0), 2025.12.30 17:45:23.456, SCOPE, INFO, 54, Message text here
        Script: /path/to/script.ctl
        Library: myLibrary.ctl
        Line: 123
        Stacktrace: function1() -> function2() -> main()
```

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
