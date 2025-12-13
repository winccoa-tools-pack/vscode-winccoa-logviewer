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
- Configurable log display order with "New Logs at Top" checkbox in settings dropdown
- Enhanced complex data structure display (dyn_anytype, dyn_string) with formatted output
- Expand/collapse functionality for log metadata (entire row is now clickable)
- Auto-expand SEVERE logs by default to highlight critical errors
- "Auto-Expand All Logs" setting for expanding all logs with metadata
- Parsing support for comma-prefixed line metadata (", Line 2" format)
- GenericLogParser now uses log filename as identifier instead of "GENERIC"
- Bidirectional auto-scroll based on log display order

### Changed
- Replaced simple logger with unified ExtensionOutputChannel (matching ctrllang extension)
- Updated log level setting to use uppercase values for consistency
- Improved PVSS parser regex to handle identifiers without spaces (e.g., "WCCILdataSQLite(0)")
- Improved PVSS parser regex to handle severity without spaces after comma (e.g., "PARAM,WARNING")
- Dynamic parser selection based on log format detection instead of filename matching
- Renamed ERROR severity level to FATAL for consistency with WinCC OA terminology

### Fixed
- PVSS logs no longer incorrectly merge multi-line events
- Generic logs properly separate individual log entries with bracket depth tracking
- Metadata display now correctly shows Script/Line information from comma-prefixed format

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

