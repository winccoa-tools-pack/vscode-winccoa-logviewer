# Log Format Test Cases

This document describes all log format variations that the parser must handle correctly. Use these test cases to write unit tests and prevent regressions.

## PVSS_II.log Format Variations

### 1. Basic Format with Script and Line

```
WCCOActrl    (2), 2025.12.14 12:17:10.181, CTRL, WARNING,    76, Invalid argument in function,
    Script: /home/testus/wincc_proj/DevEnv/scripts/openParaListener.ctl
    Line: 8, dpCreate
```

**Expected Parsing:**

- identifier: `WCCOActrl(2)`
- timestamp: `2025.12.14 12:17:10.181`
- scope: `CTRL`
- severity: `WARNING`
- message: `Invalid argument in function,`
- metadata.script: `/home/testus/wincc_proj/DevEnv/scripts/openParaListener.ctl`
- metadata.line: `8`
- metadata.raw: `dpCreate`

**UI Behavior:**

- Script field must be clickable in expanded metadata
- Should open file at line 8

---

### 2. Identifier Without Spaces (Parentheses)

```
WCCILdataSQLite(0), 2025.12.13 15:23:45.123, SQL, ERROR, 42, Connection failed
```

**Expected Parsing:**

- identifier: `WCCILdataSQLite(0)` (no space before parentheses)
- Regex must handle: `\s*` instead of `\s+` before parentheses

---

### 3. Severity Without Space After Comma

```
PARAM,WARNING, 100, Configuration issue detected
```

**Expected Parsing:**

- scope: `PARAM`
- severity: `WARNING` (no space after comma)
- Regex must handle: `\s*` between scope and severity

---

### 4. Comma-Prefixed Line Metadata

```
WCCOActrl    (2), 2025.12.14 10:56:08.388, CTRL, WARNING,   117, Library defined as #uses "logging" does not exist. See script
    Script: /home/testus/wincc_proj/DevEnv/scripts/HelloWorld.ctl
, Line 2
```

**Expected Parsing:**

- metadata.library: `/home/testus/wincc_proj/DevEnv/scripts/HelloWorld.ctl` (script moved to library)
- metadata.line: `2`
- metadata.script: `undefined` (cleared after move)

**UI Behavior:**

- Library field must be clickable (not Script)
- Should open HelloWorld.ctl at line 2

---

### 5. Multi-Line Error with Stacktrace

```
WCCOAui      (1), 2025.12.13 14:30:22.456, CTRL, SEVERE, 200, Uncaught exception in script
    Script: /opt/WinCC_OA/scripts/main.ctl
    Line: 45
    Stacktrace:
        0: processData at /opt/WinCC_OA/libs/dataLib.ctl:123
        1: handleEvent at /opt/WinCC_OA/scripts/main.ctl:45
```

**Expected Parsing:**

- severity: `SEVERE`
- metadata.script: `/opt/WinCC_OA/scripts/main.ctl`
- metadata.line: `45`
- metadata.stacktrace: Array with 2 entries
    - [0]: {index: 0, functionName: "processData", filePath: "/opt/WinCC_OA/libs/dataLib.ctl", line: 123}
    - [1]: {index: 1, functionName: "handleEvent", filePath: "/opt/WinCC_OA/scripts/main.ctl", line: 45}

**UI Behavior:**

- Auto-expand by default (SEVERE)
- All stacktrace entries must be clickable
- Should open respective files at correct lines

---

### 6. Complex Data Structures (dyn_anytype)

```
WCCOAui      (1), 2025.12.13 16:45:00.000, CTRL, INFO, 150, Debug output
    dyn_anytype 3 element(s)
        1: dyn_string 2 element(s)
            1: "value1"
            2: "value2"
        2: 42
        3: true
```

**Expected Parsing:**

- metadata.raw: Full formatted structure
- Parser must detect `dyn_anytype` and `dyn_string` patterns
- Bracket depth tracking must work correctly

**UI Behavior:**

- Show summary in message: "dyn_anytype with 3 elements"
- Full structure in expanded metadata with proper formatting

---

### 7. Library Reference (Alternative to Script)

```
WCCOActrl    (3), 2025.12.14 11:00:00.000, CTRL, ERROR, 99, Function call failed
    Library: /opt/WinCC_OA/libs/utils.ctl
    Line: 234
```

**Expected Parsing:**

- metadata.library: `/opt/WinCC_OA/libs/utils.ctl`
- metadata.line: `234`

**UI Behavior:**

- Library field must be clickable in expanded metadata
- Should open file at line 234

---

### 8. ERROR → FATAL Normalization

```
WCCOActrl    (1), 2025.12.14 09:00:00.000, CTRL, ERROR, 500, Critical system failure
```

**Expected Parsing:**

- severity: `FATAL` (normalized from ERROR)
- Backend normalization must preserve original in logs
- Frontend displays as FATAL

---

## Generic Log Format (.log files)

### 9. Generic Log with Bracket Nesting

```
[2025-12-14 12:00:00] INFO: Application started
{
    config: {
        port: 8080,
        debug: true
    }
}
```

**Expected Parsing:**

- identifier: Filename (without .log extension)
- Multi-line content must stay together
- Bracket depth tracking prevents premature event completion

---

### 10. Generic Log Simple Lines

```
2025-12-14 12:01:00 - Starting service
2025-12-14 12:01:05 - Service ready
```

**Expected Parsing:**

- Each line is a separate event
- identifier: Filename
- timestamp: Extracted from line content

---

## Edge Cases

### 11. Empty Metadata Fields

```
WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 10, Simple message
```

**Expected Parsing:**

- No metadata object if no additional info
- Should not be expandable

---

### 12. Very Long Messages

```
WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, WARNING, 20, Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
```

**Expected Parsing:**

- Full message preserved
- UI must handle text wrapping

---

### 13. Special Characters in Paths

```
WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, ERROR, 30, File not found
    Script: /home/user/My Projects/WinCC OA/scripts/test.ctl
    Line: 10
```

**Expected Parsing:**

- Path with spaces must be handled correctly
- File opening must handle special characters

---

## Format Detection Rules

### PVSS Format Detection (isPVSSFormat)

A log file is considered PVSS format if it contains lines matching:

```
<identifier>(<number>), YYYY.MM.DD HH:MM:SS.mmm, <scope>, <severity>
```

Key patterns:

- Identifier with optional parentheses and number
- Date format: `YYYY.MM.DD`
- Time format: `HH:MM:SS.mmm`
- Scope and severity after timestamp

### Generic Format Fallback

Any `.log` file that doesn't match PVSS format uses GenericLogParser:

- Identifier = filename (without .log)
- Multi-line support with bracket depth tracking
- Less strict parsing rules

---

## Test Requirements

Each test should verify:

1. **Parsing correctness** - All fields extracted correctly
2. **UI rendering** - Correct display in webview
3. **Clickability** - File links work as expected
4. **Expand/collapse** - Metadata shown when expected
5. **Auto-expand** - SEVERE logs expand automatically
6. **Performance** - Large logs don't freeze UI

## Known Issues to Prevent

1. ❌ Script field not clickable (FIXED)
2. ❌ Logs incorrectly merged due to multi-line content
3. ❌ Identifier parsing fails with no spaces before parentheses
4. ❌ Severity parsing fails with no space after comma
5. ❌ Comma-prefixed line metadata not parsed
6. ❌ ERROR not normalized to FATAL
7. ❌ Complex data structures cause parsing errors
8. ❌ Generic logs don't use filename as identifier

## Regression Test Checklist

Before each release, verify:

- [ ] All test cases parse correctly
- [ ] Script/Library fields are clickable
- [ ] Line numbers open correct file location
- [ ] SEVERE logs auto-expand
- [ ] Auto-Expand All setting works
- [ ] Log order toggle works (newest first/last)
- [ ] Auto-scroll works in both directions
- [ ] Filter by severity works
- [ ] Search functionality works
- [ ] Multi-file selection works
- [ ] Large log files (>1000 lines) perform well
