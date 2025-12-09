import { useState, useEffect, useMemo } from 'react';
import type { LogEvent, LogSeverity } from './types/logEvent';
import { generateMockLogEvents } from './utils/mockData';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeTextField,
  vsCodeCheckbox,
  vsCodeBadge,
  vsCodeDivider,
  vsCodeDropdown,
  vsCodeOption,
} from '@vscode/webview-ui-toolkit';

// TypeScript declaration for VSCode Web Components
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vscode-button': any;
      'vscode-text-field': any;
      'vscode-checkbox': any;
      'vscode-badge': any;
      'vscode-divider': any;
      'vscode-dropdown': any;
      'vscode-option': any;
    }
  }
  function acquireVsCodeApi(): any;
}

// Register VSCode UI components
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeTextField(),
  vsCodeCheckbox(),
  vsCodeBadge(),
  vsCodeDivider(),
  vsCodeDropdown(),
  vsCodeOption()
);

interface ColumnVisibility {
  identifier: boolean;
  level: boolean;
  time: boolean;
  scope: boolean;
  description: boolean;
}

interface ColumnWidths {
  identifier: number;
  level: number;
  time: number;
  scope: number;
  description: number;
}

function App() {
  const [allLogs, setAllLogs] = useState<LogEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showLogFileModal, setShowLogFileModal] = useState(false);
  const [availableLogFiles, setAvailableLogFiles] = useState<string[]>([]);
  const [selectedLogFiles, setSelectedLogFiles] = useState<Set<string>>(new Set());
  const [logFileSearch, setLogFileSearch] = useState('');

  // Toggle pause state and notify extension
  const togglePause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    
    if (vscode) {
      vscode.postMessage({
        command: 'setPaused',
        paused: newPausedState
      });
    }
  };

  // Open settings
  const handleOpenSettings = () => {
    setShowSettingsDropdown(false);
    if (vscode) {
      vscode.postMessage({
        command: 'openSettings'
      });
    }
  };

  // Open log file selection modal
  const handleOpenLogFileModal = () => {
    setShowSettingsDropdown(false);
    setShowLogFileModal(true);
  };

  // Apply log file selection
  const handleApplyLogFiles = () => {
    setShowLogFileModal(false);
    setLogFileSearch('');
  };

  // Toggle all log files
  const handleSelectAllLogFiles = () => {
    setSelectedLogFiles(new Set(availableLogFiles));
  };

  const handleDeselectAllLogFiles = () => {
    setSelectedLogFiles(new Set());
  };

  // Toggle individual log file
  const toggleLogFile = (logFile: string) => {
    setSelectedLogFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logFile)) {
        newSet.delete(logFile);
      } else {
        newSet.add(logFile);
      }
      return newSet;
    });
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Set<LogSeverity>>(
    new Set(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'SEVERE', 'OTHER'])
  );
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    identifier: true,
    level: true,
    time: true,
    scope: true,
    description: true,
  });
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({
    identifier: 100,
    level: 80,
    time: 120,
    scope: 80,
    description: 400,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [columnMenuPosition, setColumnMenuPosition] = useState({ x: 0, y: 0 });
  const [resizingColumn, setResizingColumn] = useState<keyof ColumnWidths | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // VSCode API für Messaging
  const vscode = useMemo(() => {
    try {
      if (typeof acquireVsCodeApi !== 'undefined') {
        return acquireVsCodeApi();
      }
    } catch (e) {
      console.log('Not running in VSCode webview');
    }
    return null;
  }, []);

  // Handler für File-Click
  const handleFileClick = (filePath: string, line?: number) => {
    if (vscode) {
      vscode.postMessage({
        command: 'openFile',
        filePath,
        line
      });
    } else {
      // Fallback für Dev-Server
      console.log('Open file:', filePath, line ? `at line ${line}` : '');
    }
  };

  // Extract file path from metadata
  const getFileFromMetadata = (log: LogEvent): { path: string; line?: number } | null => {
    if (!log.metadata) return null;
    
    if (log.metadata.library) {
      return { path: log.metadata.library, line: log.metadata.line };
    }
    
    if (log.metadata.script) {
      return { path: log.metadata.script, line: log.metadata.line };
    }
    
    if (log.metadata.stacktrace && log.metadata.stacktrace.length > 0) {
      const first = log.metadata.stacktrace[0];
      return { path: first.filePath, line: first.line };
    }
    
    return null;
  };

  // Listen for messages from extension
  useEffect(() => {
    if (!vscode) {
      // In dev mode, use mock data
      const initialLogs = generateMockLogEvents(50);
      setAllLogs(initialLogs);
      return;
    }

    // Notify extension that webview is ready
    vscode.postMessage({ command: 'ready' });

    // Listen for new log events
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'newLogEvent':
          // Add new log event to the top
          setAllLogs(prev => [message.event, ...prev]);
          break;
        case 'availableLogFiles':
          // Receive available log files from backend
          setAvailableLogFiles(message.files);
          // Select all by default
          setSelectedLogFiles(new Set(message.files));
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]);

  // Simuliere neue Logs alle 3 Sekunden (nur im Dev-Mode wenn pausiert ist false)
  useEffect(() => {
    if (vscode || isPaused) return; // Skip in production or when paused
    
    const interval = setInterval(() => {
      const newLog = generateMockLogEvents(1)[0];
      setAllLogs(prev => [newLog, ...prev]);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, vscode]);

  // Gefilterte und gesuchte Logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      // Log file filter (based on identifier or source file)
      if (selectedLogFiles.size > 0) {
        // Check if log's identifier or source matches selected files
        const logSource = log.identifier; // or extract from metadata if needed
        if (!selectedLogFiles.has(logSource) && selectedLogFiles.size < availableLogFiles.length) {
          return false;
        }
      }
      
      // Severity Filter
      if (!severityFilter.has(log.severity)) return false;
      
      // Search Filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          log.message.toLowerCase().includes(search) ||
          log.identifier.toLowerCase().includes(search) ||
          log.scope.toLowerCase().includes(search) ||
          log.rawLines.some(line => line.toLowerCase().includes(search))
        );
      }
      
      return true;
    });
  }, [allLogs, severityFilter, searchTerm, selectedLogFiles, availableLogFiles]);

  const handleClear = () => {
    setAllLogs([]);
  };

  const toggleSeverity = (severity: LogSeverity) => {
    setSeverityFilter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(severity)) {
        newSet.delete(severity);
      } else {
        newSet.add(severity);
      }
      return newSet;
    });
  };

  const toggleColumn = (column: keyof ColumnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const handleResizeStart = (column: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[column]);
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX;
      const newWidth = Math.max(50, resizeStartWidth + delta);
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const getSeverityColor = (severity: LogSeverity) => {
    switch (severity) {
      case 'SEVERE': return 'var(--severity-severe)';
      case 'ERROR': return 'var(--severity-error)';
      case 'WARNING': return 'var(--severity-warning)';
      case 'INFO': return 'var(--severity-info)';
      case 'DEBUG': return 'var(--severity-debug)';
      default: return 'var(--severity-other)';
    }
  };

  const getSeverityBgColor = (severity: LogSeverity, isActive: boolean) => {
    if (!isActive) return 'var(--vscode-button-secondaryBackground)';
    
    switch (severity) {
      case 'SEVERE': return 'var(--severity-severe-bg)';
      case 'ERROR': return 'var(--severity-error-bg)';
      case 'WARNING': return 'var(--severity-warning-bg)';
      case 'INFO': return 'var(--severity-info-bg)';
      case 'DEBUG': return 'var(--severity-debug-bg)';
      default: return 'var(--severity-other-bg)';
    }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '-';
    // Parse WinCC OA format: 2025.11.16 18:56:26.972
    const parts = timestamp.split(' ');
    if (parts.length === 2) {
      return parts[1]; // Return time portion
    }
    return timestamp;
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--vscode-editor-background)',
      color: 'var(--vscode-editor-foreground)'
    }}>
      {/* Top Line: Filter + Actions with responsive wrapping */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        backgroundColor: 'var(--vscode-sideBar-background)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: '12px',
        alignItems: 'center'
      }}>
        {/* Severity Filter - linksbündig */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7, width: '48px' }}>FILTER:</span>
          {(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'SEVERE', 'OTHER'] as LogSeverity[]).map(severity => (
            <button
              key={severity}
              onClick={() => toggleSeverity(severity)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                border: severityFilter.has(severity) ? `1px solid ${getSeverityColor(severity)}` : '1px solid transparent',
                borderRadius: '2px',
                cursor: 'pointer',
                backgroundColor: getSeverityBgColor(severity, severityFilter.has(severity)),
                color: severityFilter.has(severity) ? getSeverityColor(severity) : '#858585',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = severityFilter.has(severity) 
                  ? getSeverityBgColor(severity, true)
                  : 'var(--vscode-button-secondaryHoverBackground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = getSeverityBgColor(severity, severityFilter.has(severity));
              }}
            >
              {severity}
            </button>
          ))}
        </div>

        {/* Search + Actions - rechtsbündig */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', marginLeft: '54px' }}>
          {/* @ts-ignore */}
          <vscode-text-field
            placeholder="Search logs..."
            value={searchTerm}
            onInput={(e: any) => setSearchTerm(e.target.value)}
            style={{ width: '200px', minWidth: '150px' }}
          />

          {/* @ts-ignore */}
          <vscode-button onClick={handleClear} appearance="secondary" style={{ minWidth: '60px', height: '26px' }}>
            Clear
          {/* @ts-ignore */}
          </vscode-button>
          
          {/* @ts-ignore */}
          <vscode-button 
            onClick={togglePause}
            appearance={isPaused ? 'primary' : 'secondary'}
            style={{ minWidth: '60px', height: '26px', lineHeight: '1' }}
          >
            <span style={{ fontSize: '12px', display: 'inline-block', marginTop: '-2px' }}>
              {isPaused ? '▶' : '⏸'}
            </span>
          {/* @ts-ignore */}
          </vscode-button>

          <span style={{ fontSize: '11px', opacity: 0.6, whiteSpace: 'nowrap' }}>
            {filteredLogs.length} / {allLogs.length}
          </span>

          {/* Settings Button with Dropdown */}
          <div style={{ position: 'relative' }}>
            {/* @ts-ignore */}
            <vscode-button 
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              appearance="icon"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
              </svg>
            {/* @ts-ignore */}
            </vscode-button>

            {/* Dropdown Menu */}
            {showSettingsDropdown && (
              <>
                <div 
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999
                  }}
                  onClick={() => setShowSettingsDropdown(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '32px',
                    right: 0,
                    backgroundColor: 'var(--vscode-menu-background)',
                    border: '1px solid var(--vscode-menu-border)',
                    borderRadius: '3px',
                    padding: '4px',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    minWidth: '180px'
                  }}
                >
                  <div
                    onClick={handleOpenSettings}
                    style={{
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      borderRadius: '2px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Open Settings
                  </div>
                  <div
                    onClick={handleOpenLogFileModal}
                    style={{
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      borderRadius: '2px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Select Log Files...
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Column Header */}
      <div 
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          backgroundColor: 'var(--vscode-editorGroupHeader-tabsBackground)',
          display: 'flex',
          gap: '12px',
          fontSize: '11px',
          fontWeight: 600,
          opacity: 0.9,
          userSelect: 'none',
          color: 'var(--vscode-button-secondaryForeground)'
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setColumnMenuPosition({ x: e.clientX, y: e.clientY });
          setShowColumnMenu(true);
        }}
      >
        {columnVisibility.identifier && (
          <div style={{ 
            width: `${columnWidths.identifier}px`, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}>
            IDENTIFIER
            <div
              onMouseDown={(e) => handleResizeStart('identifier', e)}
              style={{
                position: 'absolute',
                right: '-6px',
                top: 0,
                bottom: 0,
                width: '12px',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                width: '1px',
                height: '60%',
                backgroundColor: 'var(--vscode-panel-border)',
                opacity: 0.6
              }} />
            </div>
          </div>
        )}
        {columnVisibility.level && (
          <div style={{ 
            width: `${columnWidths.level}px`, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}>
            LEVEL
            <div
              onMouseDown={(e) => handleResizeStart('level', e)}
              style={{
                position: 'absolute',
                right: '-6px',
                top: 0,
                bottom: 0,
                width: '12px',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                width: '1px',
                height: '60%',
                backgroundColor: 'var(--vscode-panel-border)',
                opacity: 0.6
              }} />
            </div>
          </div>
        )}
        {columnVisibility.time && (
          <div style={{ 
            width: `${columnWidths.time}px`, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}>
            TIME
            <div
              onMouseDown={(e) => handleResizeStart('time', e)}
              style={{
                position: 'absolute',
                right: '-6px',
                top: 0,
                bottom: 0,
                width: '12px',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                width: '1px',
                height: '60%',
                backgroundColor: 'var(--vscode-panel-border)',
                opacity: 0.6
              }} />
            </div>
          </div>
        )}
        {columnVisibility.scope && (
          <div style={{ 
            width: `${columnWidths.scope}px`, 
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}>
            SCOPE
            <div
              onMouseDown={(e) => handleResizeStart('scope', e)}
              style={{
                position: 'absolute',
                right: '-6px',
                top: 0,
                bottom: 0,
                width: '12px',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{
                width: '1px',
                height: '60%',
                backgroundColor: 'var(--vscode-panel-border)',
                opacity: 0.6
              }} />
            </div>
          </div>
        )}
        {columnVisibility.description && (
          <div style={{ flex: 1 }}>DESCRIPTION</div>
        )}
      </div>

      {/* Context Menu for Columns */}
      {showColumnMenu && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setShowColumnMenu(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: `${columnMenuPosition.y}px`,
              left: `${columnMenuPosition.x}px`,
              backgroundColor: 'var(--vscode-menu-background)',
              border: '1px solid var(--vscode-menu-border)',
              borderRadius: '3px',
              padding: '4px',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              minWidth: '150px'
            }}
          >
            {(['identifier', 'level', 'time', 'scope', 'description'] as (keyof ColumnVisibility)[]).map(col => (
              <div
                key={col}
                onClick={() => toggleColumn(col)}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  borderRadius: '2px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ width: '14px' }}>
                  {columnVisibility[col] ? '✓' : ''}
                </span>
                <span style={{ textTransform: 'capitalize' }}>{col}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Log List */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        padding: '8px',
        backgroundColor: 'var(--vscode-editor-background)'
      }}>
        {filteredLogs.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            opacity: 0.5, 
            marginTop: '40px',
            fontSize: '13px'
          }}>
            No logs to display
          </div>
        )}
        
        {filteredLogs.map((log, index) => {
          const fileRef = getFileFromMetadata(log);
          return (
          <div key={`${log.identifier}-${log.timestamp}-${index}`}>
            <div
              style={{
                padding: '8px 12px',
                border: '1px solid var(--vscode-panel-border)',
                borderLeft: `3px solid ${getSeverityColor(log.severity)}`,
                borderRadius: '2px',
                backgroundColor: 'var(--vscode-editor-background)',
                transition: 'background-color 0.1s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontSize: '13px' }}>
                {columnVisibility.identifier && (
                  <div style={{ 
                    width: `${columnWidths.identifier}px`, 
                    flexShrink: 0,
                    fontFamily: 'var(--vscode-editor-font-family)',
                    fontSize: '12px',
                    opacity: 0.8
                  }}>
                    {log.identifier}
                  </div>
                )}
                
                {columnVisibility.level && (
                  <div style={{ 
                    width: `${columnWidths.level}px`, 
                    flexShrink: 0,
                    fontWeight: 600,
                    color: getSeverityColor(log.severity)
                  }}>
                    {log.severity}
                  </div>
                )}
                
                {columnVisibility.time && (
                  <div style={{ 
                    width: `${columnWidths.time}px`, 
                    flexShrink: 0,
                    fontFamily: 'var(--vscode-editor-font-family)',
                    fontSize: '11px',
                    opacity: 0.7
                  }}>
                    {formatTime(log.timestamp)}
                  </div>
                )}
                
                {columnVisibility.scope && (
                  <div style={{ 
                    width: `${columnWidths.scope}px`, 
                    flexShrink: 0 
                  }}>
                    {/* @ts-ignore */}
                    <vscode-badge>
                      {log.scope}
                    {/* @ts-ignore */}
                    </vscode-badge>
                  </div>
                )}
                
                {columnVisibility.description && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                      {log.message}
                    </div>
                    
                    {/* Metadata Display */}
                    {log.metadata && (
                      <div style={{ 
                        fontSize: '11px', 
                        fontFamily: 'var(--vscode-editor-font-family)',
                        opacity: 0.8,
                        marginTop: '6px',
                        paddingLeft: '8px',
                        borderLeft: '2px solid var(--vscode-panel-border)'
                      }}>
                        {/* Script/Library/Line Info */}
                        {log.metadata.script && (
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ color: 'var(--color-keyword)', marginRight: '4px' }}>Script:</span>
                            <span>{log.metadata.script}</span>
                          </div>
                        )}
                        {log.metadata.library && (
                          <div 
                            style={{ 
                              marginBottom: '2px',
                              cursor: 'pointer',
                              color: 'var(--color-link)'
                            }}
                            onClick={() => handleFileClick(log.metadata!.library!, log.metadata!.line)}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <span style={{ color: 'var(--color-keyword)', marginRight: '4px' }}>Library:</span>
                            <span>{log.metadata.library}</span>
                            {log.metadata.line && <span>:{log.metadata.line}</span>}
                          </div>
                        )}
                        {log.metadata.line && !log.metadata.library && (
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ color: 'var(--color-keyword)', marginRight: '4px' }}>Line:</span>
                            <span>{log.metadata.line}</span>
                          </div>
                        )}
                        
                        {/* Stacktrace */}
                        {log.metadata.stacktrace && log.metadata.stacktrace.length > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ color: 'var(--color-string)', marginBottom: '4px', fontWeight: 600 }}>
                              Stacktrace:
                            </div>
                            {log.metadata.stacktrace.map((entry) => (
                              <div
                                key={entry.index}
                                style={{
                                  paddingLeft: '12px',
                                  marginBottom: '2px',
                                  cursor: 'pointer',
                                  color: 'var(--color-link)'
                                }}
                                onClick={() => handleFileClick(entry.filePath, entry.line)}
                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                              >
                                <span style={{ color: 'var(--color-comment)', marginRight: '6px' }}>{entry.index}:</span>
                                <span style={{ color: 'var(--color-function)' }}>{entry.functionName}</span>
                                <span style={{ color: 'var(--color-comment)', margin: '0 4px' }}>at</span>
                                <span>{entry.filePath}:{entry.line}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Raw text */}
                        {log.metadata.raw && (
                          <div style={{ marginTop: '4px', color: 'var(--color-comment)', fontStyle: 'italic' }}>
                            {log.metadata.raw}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Legacy file reference (fallback if no metadata) */}
                    {!log.metadata && fileRef && (
                      <div 
                        onClick={() => handleFileClick(fileRef.path, fileRef.line)}
                        style={{ 
                          fontSize: '11px', 
                          opacity: 0.6,
                          fontFamily: 'var(--vscode-editor-font-family)',
                          cursor: 'pointer',
                          color: 'var(--color-link)',
                          textDecoration: 'none',
                          marginTop: '4px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                          e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                          e.currentTarget.style.opacity = '0.6';
                        }}
                      >
                        📁 {fileRef.path}
                        {fileRef.line && `:${fileRef.line}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        );})}
      </div>

      {/* Log File Selection Modal */}
      {showLogFileModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowLogFileModal(false);
            setLogFileSearch('');
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
              borderRadius: '4px',
              width: '500px',
              maxHeight: '600px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              Select Log Files
            </div>

            {/* Search Box */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
              <input
                type="text"
                placeholder="Search log files..."
                value={logFileSearch}
                onChange={(e) => setLogFileSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                  fontSize: '13px',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
                }}
              />
            </div>

            {/* Selection Controls */}
            <div
              style={{
                padding: '8px 16px',
                borderBottom: '1px solid var(--vscode-panel-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px'
              }}
            >
              <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {selectedLogFiles.size} of {availableLogFiles.length} selected
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSelectAllLogFiles}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                    border: 'none',
                    borderRadius: '2px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAllLogFiles}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                    border: 'none',
                    borderRadius: '2px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Checkbox List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 16px',
                minHeight: '200px',
                maxHeight: '400px'
              }}
            >
              {availableLogFiles
                .filter(file => file.toLowerCase().includes(logFileSearch.toLowerCase()))
                .map(file => (
                  <div
                    key={file}
                    style={{
                      padding: '6px 0',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                    onClick={() => toggleLogFile(file)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLogFiles.has(file)}
                      onChange={() => toggleLogFile(file)}
                      style={{
                        marginRight: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <span>{file}</span>
                  </div>
                ))}
              {availableLogFiles.filter(file => file.toLowerCase().includes(logFileSearch.toLowerCase())).length === 0 && (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: 'var(--vscode-descriptionForeground)',
                    fontSize: '13px'
                  }}
                >
                  No log files found
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--vscode-panel-border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px'
              }}
            >
              <button
                onClick={() => {
                  setShowLogFileModal(false);
                  setLogFileSearch('');
                }}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  backgroundColor: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  border: 'none',
                  borderRadius: '2px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLogFiles}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
