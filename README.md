# WinCC OA LogViewer

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.80.0-007ACC.svg)

**Real-time log file viewer and analyzer for WinCC OA in Visual Studio Code**

⚠️ *Pre-Release Version - Not all features have been fully tested yet*

</div>

---

## ✨ Features

### 📊 Real-Time Log Monitoring
- **Live file watching** with automatic updates
- **Syntax highlighting** for log events
- **Pause/Resume** log streaming on demand

### 🔍 Advanced Filtering & Search
- Filter by **severity level** (DEBUG, INFO, WARNING, ERROR, SEVERE)
- **Search capabilities** across all log entries
- Support for **PVSS_II.log format** with metadata parsing

### 🚀 Smart Navigation
- Click on file paths to **open files directly** in editor
- Seamless integration with VS Code workspace

---

## 🚀 Getting Started

### Installation
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "WinCC OA LogViewer"
4. Click Install

### Configuration

Configure the extension to locate your WinCC OA log directory.

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaLogviewer.logPathSource` | `static` | How to determine log path: `static` (fixed path) or `workspace` (derive from workspace root) |
| `winccoaLogviewer.staticLogPath` | - | Fixed path to WinCC OA log directory (e.g., `C:\WinCC_OA\MyProject\log`) |

### Recommended Configuration

**Static Path** (recommended for single projects):
```json
{
  "winccoaLogviewer.logPathSource": "static",
  "winccoaLogviewer.staticLogPath": "C:\\WinCC_OA\\MyProject\\log"
}
```

**Workspace** (auto-detect from workspace):
```json
{
  "winccoaLogviewer.logPathSource": "workspace"
}
```
The extension will look for a `log` folder in your workspace root directory.

---

## 📋 Usage

### Open LogViewer

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run command: **`WinCC OA: Open LogViewer`**
3. The LogViewer opens in a new editor column and starts watching the configured log directory

### From Other Extensions

```typescript
vscode.commands.executeCommand('winccoa-logviewer.open', logPath);
```

### How It Works

The LogViewer watches the specified log directory and monitors all `.log` files. When changes are detected (new log entries), they are automatically displayed in the webview interface. You can pause/resume the live stream at any time.

---

## 🛠️ Requirements

- Visual Studio Code 1.80.0 or higher
- WinCC OA installation with accessible log directory

---

## 📜 Disclaimer

WinCC OA and Siemens are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🤝 Contributing

Contributions are welcome! Whether you want to:
- Report bugs or issues
- Suggest new features
- Improve documentation
- Submit code improvements

Please open an issue or submit a pull request on [GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer).

---

## 🔗 Links

- [GitHub Repository](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer)
- [Issue Tracker](https://github.com/winccoa-tools-pack/vscode-winccoa-logviewer/issues)
- [WinCC OA Documentation](https://www.winccoa.com)

---

<div align="center">

Made with ❤️ for the WinCC OA community

</div>
