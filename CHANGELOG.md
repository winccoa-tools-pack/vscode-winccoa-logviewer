# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.5] - 2026-03-27

### Changed

- Maintenance release

## [2.4.0] - 2026-03-21

### ✨ Added

- **Auto-Clear on Script Execution**: New quick-toggle button (🗑) in the toolbar
    - Integrates with WinCC OA Script Actions extension
    - When active, clears all logs automatically before each script run
    - Tooltip indicates whether Script Actions extension is required
    - Persisted across sessions via workspace settings (`winccoaLogviewer.autoClearOnScriptExecution`)
    - New VS Code command: `winccoa-logviewer.clearLogs`

### 🔄 Changed

- **Default log order**: Newest logs now appear at the **bottom** (chronological order) by default instead of top
- **Toolbar layout**: History button moved to the settings (⚙️) dropdown menu as "Load History..."
- **Settings dropdown**: Removed "Open Settings" link (available via VS Code settings directly)

## [2.3.0] - 2026-03-01

### Added

- **🎨 Unified Color Palette**: Complete redesign of color system across all UI elements
    - Plain text mode, filter buttons, and level column now share consistent color scheme
    - Manager-specific prefix coloring (WCCOActrl = lavender, WCCILevent = mauve, WCCILdataSQLite = blue, etc.)
    - Three-part coloring for INFO/DEBUG levels (prefix/severity-flag/description)
    - Severity colors: INFO (green), DEBUG (blue), WARNING (gold), SEVERE (red), FATAL (bright red), OTHER (rosé-gold)
    - Clickable file paths in VS Code blue (#569cd6)

- **☀️ Light/Dark Theme Support**: Automatic theme detection with dual color palettes
    - MutationObserver watches VS Code theme changes in real-time
    - Light theme uses darker colors for readability on white background
    - Dark theme uses vibrant colors optimized for dark background
    - Seamless switching when user changes VS Code theme

- **📐 Perfect Column Alignment**: Enhanced plain text mode layout
    - Manager identifiers with right-aligned numbers (WCCOActrl (6))
    - Fixed-width columns ensure vertical alignment across all log entries
    - Names left-aligned, numbers right-aligned within 21ch column width
    - Flex-based layout for pixel-perfect positioning

- **↔️ Horizontal Scrolling**: Terminal-like behavior for long log lines
    - Lines no longer wrap – scroll horizontally to see full content
    - `whiteSpace: 'pre'` preserves exact formatting
    - Single scroll container for smooth bidirectional scrolling
    - No nested scroll conflicts – seamless mouse wheel transitions

### Changed

- **Plain Text Mode Enhancements**:
    - Line height increased to 1.6 for better readability
    - Small left padding (4px) for breathing room
    - FATAL/SEVERE entries get subtle vertical spacing for visual separation
    - Continuation lines (Stacktrace, Script, Line) always in near-white/near-black with clickable links
    - `at <path>:<line>` patterns in stacktraces now recognized and made clickable

### Fixed

- Scroll performance: Removed nested scroll containers causing sluggish transitions
- Manager number alignment: Numbers now perfectly aligned vertically
- Theme inconsistency: All UI elements now respect current VS Code theme

### Known Issues

- **Relative Paths in Stacktraces**: File paths in stacktrace continuation lines (e.g., `classes\oaTest\OaTestBase.ctl:1025`) are relative and cannot be opened directly. VS Code requires absolute paths. This will be fixed in the next update by resolving relative paths against the WinCC OA project directory.

## [2.2.1] - 2026-03-01

### Added

- **🔗 Clickable File Paths in Plain Text Mode**: File paths with known extensions (`.ctl`, `.ctlpp`, `.js`, `.ts`, etc.) are now detected via regex and rendered as clickable links
    - Supports Windows paths (`c:/repos/...`) in raw log lines
    - Automatically extracts line number from `Line: 28` patterns in the same log entry
    - Click opens the file directly in the editor, jumping to the correct line

## [2.2.0] - 2026-02-28

### Added

- **📄 Plain Text Mode**: New view toggle between structured parsed view and plain text log output
    - Renders raw log lines exactly as they appear in the log files (classic terminal feel)
    - First line of each event color-coded by severity (WARNING = yellow, FATAL/SEVERE = red, etc.)
    - Continuation lines (stacktrace, metadata) shown in default text color
    - Toggle button `Plain` / `Parsed` in toolbar (between History and Pause buttons)
    - **Plain Text Mode is the new default** – classic log window experience out of the box
    - State persisted across panel close/reopen (per workspace)
    - All existing filters (severity, search, file selection) work in both modes
    - Column header row hidden automatically in plain text mode

## [2.1.0] - 2026-01-25

### Added

- **🚀 Background Log Monitoring**: File watcher now runs permanently in background (independent of LogViewer Panel)
    - Logs are collected even when LogViewer panel is closed
    - MCP/Copilot Tools have access to latest logs at all times
    - Ringbuffer with configurable limit (default: 500 events, range: 100-5000)
    - Automatic cleanup to prevent memory issues
    - Event batching (100ms) for performance optimization
- **LogBackgroundService**: New singleton service for background log collection
    - Consumer Pattern: Panel and MCP Tools subscribe to service events
    - Automatic restart on project/log path changes
    - Smart memory management with ringbuffer
- **Configuration Settings**:
    - `winccoaLogviewer.background.enabled`: Enable/disable background monitoring (default: true)
    - `winccoaLogviewer.background.maxEvents`: Ringbuffer size (default: 500)
- **Enhanced Logging**: Comprehensive status reporting in Extension Output
    - Extension start: Version, background logging status, ringbuffer size
    - Project selection: Active project, log folder path, validation status
    - File selection changes: Detailed watch list with added/removed/unchanged files
    - Ringbuffer monitoring: Status every 50 events (X/500 events, Y% filled)
    - Auto-activation: Extension starts on VS Code launch (`onStartupFinished`)

### Changed

- **Panel Architecture**: LogViewerPanel is now a consumer instead of watcher owner
    - Subscribes to BackgroundService events
    - Receives initial buffered events on open
    - No longer manages LogFileWatcher lifecycle
- **Language Model Tools**: Now use BackgroundService instead of own event store
    - Removed duplicate in-memory storage (was 10,000 events)
    - Direct access to background ringbuffer (500 events by default)
    - Better memory efficiency

### Fixed

- **Race Condition**: File-level locking prevents parser state corruption
    - Multiple file change events can fire simultaneously
    - Locking ensures sequential processing per file
    - Parser state is now protected from concurrent access
    - Fixes intermittent missing events (21 vs 22 in tests)

### Technical Details

- Singleton pattern for LogBackgroundService
- File-level locking with `Map<filePath, Promise<void>>` for race condition prevention
- Automatic retry with exponential backoff on watcher errors
- Graceful degradation: Extension works even if background service fails
- Detailed logging throughout lifecycle (activation, restart, disposal, file selection)
- Background service disposes cleanly on extension deactivation

## [2.0.0] - 2026-01-15

### Added

- **🤖 GitHub Copilot Integration**: Language Model Tools for autonomous log analysis
    - **logviewer_query_logs**: Query log events with filters (severity, time range, search pattern)
    - **logviewer_get_recent_errors**: Get last N error/warning events
    - **logviewer_search_pattern**: Search for specific patterns in logs
    - **logviewer_get_by_severity**: Get all events by severity level
    - Enables Copilot to analyze WinCC OA logs, find errors, and troubleshoot issues autonomously
    - Uses VS Code's native Language Model Tools API (vscode.lm.registerTool)
    - Clean service architecture with LanguageModelToolsService

### Technical Details

- In-memory log event storage (max 10,000 events)
- Real-time event forwarding from LogFileWatcher to Language Model Tools Service
- All tools return structured JSON with event details (timestamp, severity, message, metadata)
- Registered at extension activation, no runtime overhead
- Compatible with any AI assistant that supports VS Code Language Model Tools

## [1.0.5] - 2026-01-11

### Changed

- **CI Compatibility**: Added `test:unit` script alias for standardized CI/CD pipeline
- **CI Compatibility**: Dropped Node.js 18.x support (EOL, markdownlint incompatible)
- **Code Quality**: Added ESLint, Prettier, and markdownlint for consistent code style
- **Code Quality**: Fixed all linting errors (unused variables, `any` → `unknown`, regex escapes)

## [1.0.4] - 2026-01-04

### Changed

- **Documentation**: Updated disclaimer to remove version reference
- **Documentation**: Added Known Issues section with reload workaround
- **Documentation**: Added performance notes for Windows and large projects
- **VS Code Requirement**: Lowered to ^1.106.0 for better compatibility

## [Unreleased]

## [1.0.3] - 2026-01-02

### Fixed

- **Log File Filter**: Fixed bug where deselecting log files caused all logs to disappear instead of filtering correctly
    - Root cause: Log events did not contain source file information, filter compared `identifier` (e.g., "PVSS_II") with filenames (e.g., "PVSS_II.log")
    - Solution: Added `sourceFile` field to LogEvent, now properly filters logs by actual source file name
    - Architecture change: Backend FileWatcher now respects `watchedFiles` set, only processes selected files
    - Affected files: logEvent.ts, logFileWatcher.ts, logViewerPanel.ts, App.tsx

### Known Issues

- **File Re-Activation Floods History**: When deselecting and re-selecting a log file, all historical events are replayed
    - Root cause: FileWatcher maintains file position even when file is unwatched
    - Impact: Can cause duplicate entries in UI if file was previously watched
    - Workaround: Clear logs after re-activation or avoid toggling files repeatedly
    - Status: Will be fixed in future release (reset file position on re-watch)

## [1.0.2] - 2026-01-01

### Changed

- **Extension Dependency**: Updated from `RichardJanisch.winccoa-control` to `RichardJanisch.winccoa-project-admin` (renamed in v1.0.4)

## [1.0.1] - 2025-12-30

### Fixed

- **Extension Dependency**: Updated from `RichardJanisch.winccoa-core` to `RichardJanisch.winccoa-control` (package name changed in Control extension v1.0.1)

## [1.0.0] - 2025-12-30

### 🎉 First Stable Release

This is the first stable release of WinCC OA LogViewer extension.

### Added

- **Real-Time Log Monitoring**:
    - Live file watching with automatic updates
    - PVSS_II.log format parsing with metadata extraction (script, library, line, stacktrace)
    - Support for multiple log files (PVSS_II.log, WCCOActrl\*.log, custom logs)
    - Pause/Resume functionality for log streaming
    - Newest First toggle to show recent events first
- **Advanced Filtering**:
    - Severity level filtering (DEBUG, INFO, WARNING, SEVERE, FATAL, ERROR, OTHER)
    - Text search across all log entries
    - Column visibility management (right-click menu)
    - Resizable columns via drag
    - Expandable metadata view per log entry
- **History Loading** (v0.2.5):
    - Load historical PVSS_II\*.log files via "History" button
    - Date picker with 24-hour time dropdowns
    - Time range filtering for large log files
    - Batch loading with progress indicator
    - All settings persisted across sessions
- **Integration**:
    - WinCC OA Control extension support for automatic path detection
    - Clickable file paths to open scripts in editor
    - Three path detection modes: static, workspace, automatic

### Configuration

- `winccoaLogviewer.logPathSource`: Choose path detection mode (static, workspace, automatic)
- `winccoaLogviewer.staticLogPath`: Manual log directory path
- `winccoaLogviewer.logLevel`: Configurable logging (ERROR, WARN, INFO, DEBUG, TRACE)

### Known Limitations

- Performance degrades with 10,000+ events (no virtualized rendering yet)
- File watcher menu bug: All entries disappear when clicking "Ignore"
- Automatic path detection requires WinCC OA Control extension

### Dependencies

- WinCC OA Control extension (RichardJanisch.winccoa-core) - optional, for automatic path detection

### Bug Fixes from Pre-Release

- v0.2.2: Fixed log event ordering bug (parser buffer flush)
- v0.2.3: Fixed UI theming issues in light mode
- v0.2.4: Fixed settings persistence and checkbox double-toggle on Windows
- v0.2.5: Added history loading with dark mode date picker support

### Breaking Changes from 0.x

- Extension ID publisher changed to RichardJanisch
- Icon updated to unified WinCC OA LogViewer design (512px)
- Minimum VS Code version: 1.80.0

---

## [0.2.5] - 2025-12-29

### Added

- **Load History**: New "History" button to load historical PVSS_II\*.log files
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
