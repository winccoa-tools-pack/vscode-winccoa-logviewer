import type { LogEvent, LogSeverity, LogMetadata } from '../types/logEvent';

const identifiers = ['WCCOActrl', 'WCCILdata', 'WCCILevent', 'WCCILpmon', 'WCCOAui'];
const scopes = ['SYS', 'CTRL', 'PARAM', 'DB', 'DRIVER', 'API'];

const errorMessages = [
  'Connection to database failed',
  'Null pointer exception in module',
  'Failed to load configuration file',
  'Memory allocation error',
  'Invalid parameter value detected',
  'Timeout while waiting for response',
  'Uncaught exception in thread',
  'Function not defined',
];

const warningMessages = [
  'Deprecated function used',
  'Performance threshold exceeded',
  'Configuration value missing, using default',
  'Connection retry attempt',
  'Cache size approaching limit',
  'Resource usage high',
  'Datapoint does not exist',
];

const infoMessages = [
  'Manager Start',
  'Configuration loaded',
  'Connected to',
  'Data synchronization complete',
  'User authentication successful',
  'Module initialized',
  'Manager (SYS: 1 Ctrl -num 5 CONN: 1) initialised',
  'Connection established',
];

const debugMessages = [
  'Entering function processData()',
  'Variable state updated',
  'Cache hit for key',
  'Event handler registered',
  'Processing queue: 42 items',
  'Memory cleanup performed',
];

const repoPaths = [
  'C:\\WinCC_OA_Proj\\DevEnv\\scripts\\vscodeRestApi.ctl',
  'C:\\WinCC_OA_Proj\\DevEnv\\scripts\\libs\\logger.ctl',
  'C:\\WinCC_OA_Proj\\DevEnv\\scripts\\startScript.ctl',
  '/home/testus/repos/winccoa_vscode_tools/src/extension.ts',
  '/home/testus/repos/winccoa_vscode_tools/src/logviewer/logViewerPanel.ts',
];

let eventCounter = 0;

export function generateMockLogEvent(severity?: LogSeverity): LogEvent {
  eventCounter++;
  const identifier = identifiers[Math.floor(Math.random() * identifiers.length)];
  const scope = scopes[Math.floor(Math.random() * scopes.length)];
  const managerNum = Math.floor(Math.random() * 10);
  
  // Generate realistic timestamp like: 2025.11.16 18:56:26.972
  const now = new Date(Date.now() - Math.random() * 3600000);
  const timestamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
  
  // Choose severity
  const actualSeverity = severity || (['INFO', 'WARNING', 'ERROR', 'SEVERE', 'DEBUG', 'OTHER'][Math.floor(Math.random() * 6)] as LogSeverity);
  
  // Choose appropriate message
  let message = '';
  switch (actualSeverity) {
    case 'ERROR':
    case 'SEVERE':
      message = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      break;
    case 'WARNING':
      message = warningMessages[Math.floor(Math.random() * warningMessages.length)];
      break;
    case 'DEBUG':
      message = debugMessages[Math.floor(Math.random() * debugMessages.length)];
      break;
    case 'INFO':
      message = infoMessages[Math.floor(Math.random() * infoMessages.length)];
      break;
    default:
      message = 'Unknown event occurred';
  }
  
  // Generate metadata with different variations
  let metadata: LogMetadata | undefined;
  const rand = Math.random();
  const msgNum = Math.floor(Math.random() * 200);
  
  // Generate raw lines
  const rawLines = [
    `${identifier.padEnd(12)} (${managerNum}), ${timestamp}, ${scope.padEnd(5)}, ${actualSeverity.padEnd(7)}, ${msgNum}, ${message}`
  ];
  
  if (rand > 0.75 && (actualSeverity === 'ERROR' || actualSeverity === 'SEVERE')) {
    // Case 1: Script + Library + Line + Stacktrace (like the example)
    const scriptPath = repoPaths[Math.floor(Math.random() * repoPaths.length)];
    const scriptLine = Math.floor(Math.random() * 100) + 1;
    const variableName = ['test', 'myVar', 'data', 'config'][Math.floor(Math.random() * 4)];
    
    metadata = {
      script: scriptPath,
      line: scriptLine,
      stacktrace: []
    };
    
    rawLines.push(`    Script: ${scriptPath}`);
    rawLines.push(`    Line: ${scriptLine}, ${variableName}`);
    rawLines.push('    Stacktrace:');
    
    const numEntries = Math.floor(Math.random() * 2) + 2;
    const functions = ['void myFunction()', 'void main()', 'int processData(string path)', 'bool validate()'];
    
    for (let i = 0; i < numEntries; i++) {
      const path = repoPaths[Math.floor(Math.random() * repoPaths.length)];
      const line = Math.floor(Math.random() * 500) + 1;
      const funcName = functions[Math.min(i, functions.length - 1)];
      
      metadata.stacktrace!.push({
        index: i + 1,
        functionName: funcName,
        filePath: path,
        line
      });
      
      rawLines.push(`         ${i + 1}: ${funcName} at ${path}:${line}`);
    }
  } else if (rand > 0.5) {
    // Case 2: Script + Library + Line (no stacktrace)
    const scriptName = ['startScript', 'vscodeRestApi', 'HelloWorld', 'logger'][Math.floor(Math.random() * 4)];
    const libraryPath = repoPaths[Math.floor(Math.random() * repoPaths.length)];
    const line = Math.floor(Math.random() * 500) + 1;
    
    if (Math.random() > 0.5) {
      // With library
      metadata = {
        script: scriptName,
        library: libraryPath,
        line
      };
      rawLines.push(`    Script: ${scriptName}`);
      rawLines.push(`    Library: ${libraryPath}`);
      rawLines.push(`    Line: ${line}`);
    } else {
      // Without library
      metadata = {
        script: scriptName,
        line
      };
      rawLines.push(`    Script: ${scriptName}`);
      rawLines.push(`    Line: ${line}`);
    }
  } else if (rand > 0.2) {
    // Case 3: Only raw text (unparsed additional info)
    const rawTexts = [
      ', void main() at startScript:6',
      'Connection attempt 3 of 5',
      'Retrying in 5 seconds...',
      'Status: OK, Duration: 234ms',
      'User: admin, IP: 127.0.0.1'
    ];
    const rawText = rawTexts[Math.floor(Math.random() * rawTexts.length)];
    
    metadata = {
      raw: rawText
    };
    rawLines.push(`  ${rawText}`);
  }
  // else: No metadata at all (simple message only)
  
  return {
    identifier,
    timestamp,
    scope,
    severity: actualSeverity,
    message,
    metadata,
    rawLines,
  };
}

export function generateMockLogEvents(count: number): LogEvent[] {
  const events: LogEvent[] = [];
  
  for (let i = 0; i < count; i++) {
    // Distribution: more INFO/DEBUG, less ERROR
    const rand = Math.random();
    let severity: LogSeverity;
    if (rand < 0.35) {
      severity = 'INFO';
    } else if (rand < 0.6) {
      severity = 'DEBUG';
    } else if (rand < 0.8) {
      severity = 'WARNING';
    } else if (rand < 0.92) {
      severity = 'ERROR';
    } else if (rand < 0.97) {
      severity = 'SEVERE';
    } else {
      severity = 'OTHER';
    }
    
    events.push(generateMockLogEvent(severity));
  }
  
  // Sort by timestamp (newest first)
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
