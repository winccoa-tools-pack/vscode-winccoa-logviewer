# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5] - 2025-12-29

### Added
- **Load History**: New "History" button to load historical PVSS_II*.log files
  - File selection dropdown with file size info
  - Date picker with 24-hour time dropdowns (European format)
  - Auto-fills time range from file timestamps
  - Batch loading with progress indicator
  - All history settings persisted across sessions
- Dark mode support for native date picker elements

## [0.2.4] - 2025-12-29

### Added
- **Settings Persistence**: UI settings (newestFirst, autoExpandAll, selectedLogFiles, severityFilter, columnVisibility, columnWidths) are now persisted across sessions via workspaceState

### Fixed
- Fixed checkbox double-toggle bug on Windows when selecting/deselecting log files
- Fixed selected log files being reset when panel reopens (now properly restored from saved settings)

## [0.2.3] - 2025-12-26

### Fixed
- Fixed UI theming issues in light mode
- Filter buttons now use transparent background when inactive for better light mode visibility
- Column header text now uses correct foreground color (black in light mode, white in dark mode)
- Improved button hover effects to work seamlessly in both light and dark themes

## [0.2.2] - 2025-12-26

### Fixed
- **Critical**: Fixed log lines appearing in wrong order due to stateful parser buffering
- Parser now correctly flushes the last event from its internal buffer after processing all lines
- Fixed issue where the last log line in each file change was only emitted on the next change
- Resolved line reordering bug where last line appeared first in subsequent reads
- All log events now appear in correct chronological order

## [0.2.1] - 2025-12-25

### Fixed
- Fixed race condition where log events during initialization were ignored
- Fixed issue where first log entries after starting the watcher were not displayed
- File watcher now properly processes newly created log files from the beginning
- Initialization order corrected: watcher is created before file positions are set
- Eliminated need to run scripts multiple times to see log output

## [0.2.0] - TBD

### Added
- Automatic project detection mode via WinCC OA Core extension integration
- Extension dependency on `winccoa-tools-pack.winccoa-core` (optional)
- Automatic log directory path resolution from selected project
- Fallback to manual configuration when Core extension is not available
- Real-time project change detection with automatic log path updates

### Changed
- Log directory path can now be automatically derived from selected project
- Improved error handling when automatic mode is selected but Core extension is not installed

## [0.1.1] - 2025-12-14

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
- Comprehensive test case documentation for all log format variations

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
- Script field in expanded metadata is now clickable and opens files at correct line

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

