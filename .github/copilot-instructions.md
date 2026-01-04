# README für GitHub Copilot: WinCC OA LogViewer Extension

## Workspace-Übersicht

Dieser Workspace enthält das komplette **WinCC OA Tools Pack** - ein Ökosystem von VS Code Extensions für die WinCC OA Entwicklung.

### Repository-Struktur

```
workspace/
├── vscode-winccoa-core/              # Core Extension (Projekt-Management)
├── vscode-winccoa-logviewer/         # Log-Datei Viewer (DIESES REPO)
├── vscode-winccoa-scriptactions/     # Script-Ausführung
├── vscode-winccoa-tests/             # Test Explorer Integration
├── vscode-winccoa-ctrllang/          # CTL Language Support
├── vscode-winccoa-sidepanel/         # Side Panel UI
├── vscode-winccoa-mcp-server/        # MCP Server (GitHub Copilot Integration)
├── npm-shared-library-core/          # Gemeinsame Bibliothek
└── DevEnv/                           # WinCC OA Test-Projekt
```

### Repository-Abhängigkeiten

```
npm-shared-library-core (Basis für alle Extensions)
    ↓
vscode-winccoa-core (Zentrale Services)
    ↓
    ├── vscode-winccoa-logviewer (nutzt Core für Auto-Detection)
    ├── vscode-winccoa-scriptactions (nutzt Core für Projekt-Info)
    ├── vscode-winccoa-tests (nutzt Script Actions + Core)
    ├── vscode-winccoa-ctrllang (Language Server)
    └── vscode-winccoa-sidepanel (UI Integration)
```

**Wichtige Beziehungen:**
- **Core** → Alle anderen Extensions (optional oder required)
- **Script Actions** → Test Explorer (für Test-Ausführung)
- **LogViewer** → Core (für automatische Projekt-Erkennung, optional)
- **npm-shared-library-core** → Alle Extensions (gemeinsame Kommunikation mit WinCC OA)

### Extension-Rollen

| Extension | Rolle | Status |
|-----------|-------|--------|
| **Core** | Zentrale Projekt-Verwaltung, Status Bar | v0.2.2 |
| **LogViewer** | Echtzeit Log-Monitoring | v1.0.3 |
| **Script Actions** | Script-Ausführung mit Argumenten | v0.3.1 |
| **Test Explorer** | Unit-Test Integration | v0.2.2 |
| **CTL Language** | Syntax, IntelliSense, Language Server | dev |
| **Side Panel** | Custom UI Panel | dev |
| **npm-shared** | Gemeinsame WinCC OA Kommunikation | core lib |

## Projektübersicht (LogViewer)

Der **WinCC OA LogViewer** ist eine VS Code Extension für Echtzeit-Überwachung und Analyse von WinCC OA Log-Dateien.

### Kernfunktionen
- Echtzeit-Monitoring von Log-Dateien (PVSS_II.log, WCCOActrl*.log, etc.)
- Intelligentes Parsing von PVSS-Format und generischen Logs
- Webview-basierte UI mit React/Vite
- Filter nach Severity-Level (DEBUG, INFO, WARNING, FATAL, SEVERE, OTHER)
- Expandierbare Metadaten (Script, Library, Line, Stacktrace)
- Automatische Projekt-Erkennung via Core Extension

### Abhängigkeiten
- **WinCC OA Core Extension** (optional): Für automatische Projekt-Erkennung
- **NPM Shared Library**: Gemeinsame Kommunikations-Layer (nicht direkt verwendet im LogViewer)

## Projektarchitektur

### Struktur
```
vscode-winccoa-logviewer/
├── src/                          # Extension Backend (TypeScript)
│   ├── extension.ts              # Entry Point, Extension Activation
│   ├── logFileWatcher.ts         # File System Watcher, Parser-Integration
│   ├── logParser.ts              # PVSS-Format Parser (stateful!)
│   ├── logEvent.ts               # Event Type Definitions
│   ├── logViewerPanel.ts         # Webview Panel Management
│   └── extensionOutput.ts        # Logging/Diagnostics
├── webview/                      # React Frontend (Vite)
│   ├── src/
│   │   ├── App.tsx               # Main UI Component
│   │   ├── App.css               # Styles
│   │   └── types/logEvent.ts     # Shared Types
│   └── package.json              # Webview Dependencies
├── .vscode/
│   ├── launch.json               # Debug Configurations
│   └── tasks.json                # Build Tasks
├── CHANGELOG.md                  # Version History
└── package.json                  # Extension Manifest
```

### Technische Schlüsselkomponenten

#### 1. LogFileWatcher (`src/logFileWatcher.ts`)
- **FileSystemWatcher**: Überwacht `*.log` Dateien mit `onDidChange/onCreate`
- **File Positions**: `Map<string, number>` trackt Read-Position pro Datei
- **Line Buffers**: `Map<string, string>` speichert unvollständige Zeilen
- **Per-File Parsers**: Separate Parser-Instanz für jede Log-Datei
- **Initialization**: Watcher muss VOR `initializeFilePositions()` erstellt werden (Race Condition Fix v0.2.1)

#### 2. LogParser (`src/logParser.ts`)
- **CRITICAL**: **Stateful Parser** mit internem Buffer!
  - `parseLine(line)` gibt nur COMPLETED events zurück
  - Das letzte Event bleibt im `currentEvent` Buffer
  - **MUSS** `flush()` nach allen Zeilen aufrufen, sonst fehlt letztes Event!
  - Bug v0.2.2: Ohne flush() erscheinen Events in falscher Reihenfolge

```typescript
// CORRECT Usage Pattern:
for (const line of lines) {
    const events = parser.parseLine(line);
    events.forEach(event => this.emitEvent(event));
}
// CRITICAL: Flush final event!
const lastEvent = parser.flush();
if (lastEvent) this.emitEvent(lastEvent);
```

- **Format**: `IDENTIFIER (NUM), YYYY.MM.DD HH:mm:ss.SSS, SCOPE, SEVERITY, MSGNUM, MESSAGE`
- **Metadata**: Parst Script, Library, Line, Stacktrace aus Folgezeilen

#### 3. Webview Panel (`src/logViewerPanel.ts`)
- **vscode.WebviewPanel**: Hosted React App
- **Message Passing**: `postMessage()` zwischen Extension ↔ Webview
- **Commands**: `newLogEvent`, `availableLogFiles`, `ready`, `setPaused`

#### 4. React Frontend (`webview/src/App.tsx`)
- **VSCode Webview UI Toolkit**: Native VS Code Komponenten
- **Severity Filter**: Toggle-Buttons mit Theme-angepassten Farben
- **Column Visibility**: Rechtsklick-Menü für Spaltenauswahl
- **Resizable Columns**: Drag-to-resize mit MouseMove Handler
- **Expandable Metadata**: Click auf Log-Zeile zeigt Details
- **File Links**: Klickbar → öffnet Dateien in Editor

### Build-System
- **TypeScript**: Kompiliert Extension Code (`tsc -p .`)
- **Vite**: Bündelt React Webview (`cd webview && npm run build`)
- **Watch Mode**: `npm run watch` für Live-Entwicklung
- **Makefile**: `make test-local` für lokales VSIX Testing

## Workflow-Regeln

### 1. Feature-Entwicklung
```bash
# 1. Feature starten (automatisch)
git flow feature start <feature-name-x.y.z>

# 2. Entwicklung + Compile nach JEDER Änderung
npm run compile

# 3. Version in package.json anpassen (PATCH für fix, MINOR für feature)
# 4. CHANGELOG.md aktualisieren mit neuem Eintrag

# 5. Commit mit semantischem Präfix
git add -A
git commit -m "feat: beschreibung" # oder fix:, perf:, docs:, etc.

# 6. Feature finishen (automatisch mergen nach develop)
git flow feature finish <feature-name-x.y.z>
```

### 2. Commit-Präfixe (Conventional Commits)
- `feat:` - Neues Feature (MINOR Version bump)
- `fix:` - Bug Fix (PATCH Version bump)
- `perf:` - Performance Verbesserung
- `docs:` - Dokumentationsänderungen
- `refactor:` - Code-Umstrukturierung ohne Funktionsänderung
- `test:` - Test-Hinzufügungen/-Änderungen
- `chore:` - Build/Tooling Änderungen

### 3. Compile-Zyklus
**IMMER** nach Code-Änderungen:
```bash
npm run compile  # Baut Extension + Webview
```

### 4. Testing
```bash
make test-local  # Erstellt VSIX und öffnet Test-Extension-Host
```

## Wichtige technische Details

### Parser Flush Pattern (CRITICAL!)
**Problem**: Stateful Parser hält letztes Event im Buffer
**Lösung**: Immer `flush()` nach allen `parseLine()` Aufrufen

```typescript
// In logFileWatcher.ts - BEIDE Parser!
const events = parser.parseLine(line);
events.forEach(event => this.emitEvent(event));

// CRITICAL: Nach ALLEN Zeilen!
const lastEvent = parser.flush();
if (lastEvent) {
    this.emitEvent(lastEvent);
}
```

### File Watcher Initialization (Race Condition Fix)
**Problem**: Events während Initialization wurden ignoriert
**Lösung**: Watcher VOR `initializeFilePositions()` erstellen

```typescript
// CORRECT Order:
this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
this.watcher.onDidChange(async (uri) => { ... });
await this.initializeFilePositions(); // NACH Watcher Setup!
this.isInitialized = true;
```

### Webview Theming (Light/Dark Mode)
**Problem**: VS Code CSS-Variablen passen sich automatisch ans Theme an
**Lösung**: Nutze `var(--vscode-*)` für adaptive Farben

```tsx
// Filter-Buttons (v0.2.3)
backgroundColor: isActive ? 'var(--severity-*-bg)' : 'transparent'
color: isActive ? 'var(--severity-*)' : 'var(--vscode-button-secondaryForeground)'
border: isActive ? `1px solid color` : '1px solid var(--vscode-panel-border)'

// Header-Text
color: 'var(--vscode-foreground)' // schwarz in light, weiß in dark
```

### Severity Colors (CSS Variables)
Definiert in `webview/src/index.css`:
```css
--severity-error: #f48771;
--severity-severe: #ff6b6b;
--severity-warning: #cca700;
--severity-info: #75beff;
--severity-debug: #b5cea8;
--severity-other: #c586c0;
```

## Aktuelle Probleme und To-Dos

### ✅ Gelöste Issues
- ~~LogViewer zeigt nicht alle Zeilen~~ → **v0.2.2** (Parser flush() fix)
- ~~File Watcher Race Condition~~ → **v0.2.1** (Initialization order)
- ~~Filter-Buttons zu dunkel in Light Mode~~ → **v0.2.3** (Transparent background)
- ~~Settings nicht persistiert~~ → **v0.2.4** (workspaceState persistence)
- ~~Checkbox Double-Toggle Windows~~ → **v0.2.4** (e.stopPropagation fix)
- ~~Timestamp Filtering~~ → **v0.2.5** (Load History Feature)

### 🔧 Offene Bugs
1. **File Re-Activation Floods History** (known, deferred): 
   - Wenn man ein File deaktiviert und wieder aktiviert, werden alle historischen Logs nochmal eingefügt
   - Root cause: FileWatcher behält file position auch wenn File unwatched ist
   - Impact: Duplicate Events im Frontend bei Toggle
   - Workaround: Clear logs nach re-activation
   - Status: Wird später gefixt - file position muss beim unwatch resettet werden
   
2. **File-Watcher-Menü Bug** (minor): Alle Einträge verschwinden bei Ignorieren-Auswahl
3. **Message-Hintergründe Light Mode** (enhancement): Bessere Lesbarkeit durch angepasste Hintergründe

### 🚀 Geplante Features
1. **Export Log Events**: CSV/JSON Export-Funktion
2. **Log-Level Highlighting**: Farbige Zeilen-Hintergründe nach Severity
3. **Performance**: Virtualized List für große Log-Mengen (10k+ Events)
4. **Unit Tests**: Parser-Tests und Watcher-Tests fehlen noch

## Technische Erkenntnisse

### Settings Persistenz (v0.2.4+)
- **workspaceState** für UI-Settings nutzen (nicht globalState)
- Settings beim Panel-Open via `restoreSettings` Message senden
- Im Webview: Settings im `useEffect` speichern bei Änderungen
- **WICHTIG**: Beim Restore prüfen ob vorherige Werte existieren bevor überschreiben

```typescript
// Backend: Settings senden bei ready
case 'ready':
  const settings = this._context.workspaceState.get('logViewerSettings');
  this._panel.webview.postMessage({ command: 'restoreSettings', settings });

// Webview: Nur überschreiben wenn vorher leer
setSelectedLogFiles(prev => prev.size > 0 ? prev : new Set(message.files));
```

### Native HTML Controls in Webviews (v0.2.5)
- **Date Picker Dark Mode**: `color-scheme: dark` in CSS für native Inputs
- VS Code setzt `body.vscode-dark` / `body.vscode-light` Klassen
- **24h Format**: Browser-Default ist locale-abhängig, besser eigene Dropdowns bauen

```css
body.vscode-dark input[type="date"] {
  color-scheme: dark;
}
```

### Batch Loading für große Dateien
- History-Files können groß sein (MB)
- Events in Batches von 100 senden mit Progress-Updates
- Modal erst schließen wenn 100% erreicht

## Best Practices

### Code-Editing
- **Multi-Replace nutzen**: Bei mehreren unabhängigen Edits → `multi_replace_string_in_file`
- **3-5 Zeilen Kontext**: Immer genug Code um/nach Edit-Stelle inkludieren
- **Keine Platzhalter**: Niemals `...existing code...` in oldString/newString

### Debugging
- **Extension Output**: `ExtensionOutputChannel.debug/trace/error()` nutzen
- **Launch Config**: `.vscode/launch.json` hat Debug-Profile
- **Developer Tools**: Webview Debugging mit F1 → "Toggle Developer Tools"

### Testing
- **Local VSIX**: `make test-local` für manuelle Tests
- **Mock Data**: `generateMockLogEvents()` für Webview-Entwicklung ohne Backend

### Git Workflow (CRITICAL)
- **Working Tree sauber halten**: Vor `git flow feature finish` immer `git status` prüfen
- **Runtime Changes stashen**: DB-Dateien, Build-Artefakte vor Feature-Finish mit `git stash` entfernen
- **Nie ohne User-Freigabe committen**: Erst bei "Go" vom User den finalen Commit machen
- **Feature finish**: Erst testen, dann CHANGELOG, dann auf User-Freigabe warten, dann committen & finishen

## Test-Workspace Management (Best Practices)

### Directory Structure
- **test-workspace auf Root-Level**: Neben Extension-Ordnern, nicht darin verschachtelt
- **Self-contained Fixtures**: Alle Test-Dateien im Repository für reproduzierbare Tests

### Git & VSIX
- **.gitignore für Runtime**: DB-Dateien, Logs als Runtime-Artefakte nicht committen
- **.vscodeignore**: test-workspace/** excluded für saubere VSIX-Packages ohne Secrets
- **Große Commits**: Bei User-Zustimmung auch 1000+ Dateien OK ("ne das passt schon")

## Makefile Automation

### Version Badge Auto-Update (seit 2026-01-04)
Alle Extensions haben automatische Version Badge Updates im `make package` Target:

```makefile
package: build
	@echo "Packaging production release..."
	@-$(MKDIR) $(BIN_DIR) 2>nul || echo "" >nul
	@echo "Updating version badge in README.md..."
	@node -e "const fs=require('fs'); let c=fs.readFileSync('README.md','utf8'); c=c.replace(/!\\[Version\\]\\(https:\\/\\/img\\.shields\\.io\\/badge\\/version-[^)]*\\)/,'![Version](https://img.shields.io/badge/version-$(VERSION)-blue.svg)'); fs.writeFileSync('README.md',c);"
	@$(VSCE) package -o $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Extension packaged to $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"
```

**Wichtig:**
- Version Badge wird automatisch aktualisiert - NICHT manuell in README.md ändern!
- Cross-platform: Node.js funktioniert auf Windows und Linux
- Version kommt aus package.json (single source of truth)

## Versionsstände (Stand: 2026-01-04)
- **LogViewer**: v1.0.3 - Backend file watching + version badge automation
- **CTL Language**: v1.2.0 - Scope-aware rename + keywords + version badge automation
- **Script Actions**: v0.4.0 - Default commands + version badge automation
- **Test Explorer**: v0.2.4 - Cancel/Stop + version badge automation
- **Project Admin**: Latest - Version badge automation
- **Core Extension**: v0.2.3 - PMON start/stop sequence fix

## Zusammenarbeit mit GitHub Copilot

### Erwartungen
- **Strukturiert arbeiten**: Klare Workflows, kein Code-Chaos
- **Kompilieren nach Änderungen**: Immer `npm run compile`
- **Git Flow einhalten**: Feature Branches, semantische Commits
- **Changelog pflegen**: Jede Version dokumentieren
- **Testen vor Merge**: "Go" vom User abwarten

### Communication Style
- **Deutsch**: Primäre Sprache für Kommunikation
- **Englisch**: Code, Commits, Dokumentation
- **Knapp & präzise**: Keine unnötigen Erklärungen
- **Technisch korrekt**: Exakte Begriffe, keine Vereinfachungen