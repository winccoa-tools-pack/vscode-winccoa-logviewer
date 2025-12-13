# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Structured logging system with ExtensionOutputChannel
- Configurable log levels: ERROR, WARN, INFO, DEBUG, TRACE
- Visual log level icons (❌ ⚠️ ℹ️ 🔍 🔬) in output channel
- Detailed logging across all components for better diagnostics
- Auto-show output channel on errors
- Timestamp and source information in log messages

### Changed
- Replaced simple logger with unified ExtensionOutputChannel (matching ctrllang extension)
- Updated log level setting to use uppercase values for consistency

## [0.1.0] - Initial Release

### Added
- Real-time log file viewer for WinCC OA projects
- WebView-based UI with React and Tailwind CSS
- PVSS_II.log parser with multi-line event support
- Support for script, library, line, and stacktrace metadata
- Generic log file support for other .log files
- File watcher for automatic log updates
- Click-to-open functionality for files in log messages
- Pause/Resume live log streaming
- Configurable log path sources (static, workspace, npm-package)
- Settings for log path configuration
- Multiple workspace folder support
- Color-coded log severity levels (INFO, WARNING, ERROR, SEVERE, DEBUG, OTHER)
- Responsive webview interface

