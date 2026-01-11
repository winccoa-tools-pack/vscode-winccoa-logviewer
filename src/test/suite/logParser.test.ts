import * as assert from 'assert';
import { LogParser } from '../../logParser';
import { LogEvent } from '../../logEvent';

suite('LogParser Unit Tests', () => {
    let parser: LogParser;

    setup(() => {
        parser = new LogParser();
    });

    suite('Basic Format Parsing', () => {
        test('Should parse basic log line with script and line metadata', () => {
            const lines = [
                'WCCOActrl    (2), 2025.12.14 12:17:10.181, CTRL, WARNING,    76, Invalid argument in function,',
                '    Script: /home/testus/wincc_proj/DevEnv/scripts/openParaListener.ctl',
                '    Line: 8, dpCreate',
            ];

            let events = parser.parseLine(lines[0]);
            assert.strictEqual(events.length, 0, 'First line should not complete an event');

            events = parser.parseLine(lines[1]);
            assert.strictEqual(events.length, 0, 'Second line should not complete an event');

            events = parser.parseLine(lines[2]);
            assert.strictEqual(events.length, 0, 'Third line should not complete an event');

            // Trigger completion with next main line or flush
            const event = parser.flush();
            assert.ok(event, 'Event should be completed');

            assert.strictEqual(event!.identifier, 'WCCOActrl(2)');
            assert.strictEqual(event!.timestamp, '2025.12.14 12:17:10.181');
            assert.strictEqual(event!.scope, 'CTRL');
            assert.strictEqual(event!.severity, 'WARNING');
            assert.strictEqual(event!.message, 'Invalid argument in function,');
            assert.strictEqual(
                event!.metadata?.script,
                '/home/testus/wincc_proj/DevEnv/scripts/openParaListener.ctl',
            );
            assert.strictEqual(event!.metadata?.line, 8);
        });

        test('Should parse identifier without spaces before parentheses', () => {
            const line =
                'WCCILdataSQLite(0), 2025.12.13 15:23:45.123, SQL, ERROR, 42, Connection failed';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.identifier, 'WCCILdataSQLite(0)');
            assert.strictEqual(event!.timestamp, '2025.12.13 15:23:45.123');
            assert.strictEqual(event!.scope, 'SQL');
            assert.strictEqual(event!.severity, 'FATAL'); // ERROR normalized to FATAL
            assert.strictEqual(event!.message, 'Connection failed');
        });

        test('Should parse scope and severity without space after comma', () => {
            const line =
                'WCCOActrl    (1), 2025.12.14 10:00:00.000, PARAM,WARNING, 100, Configuration issue detected';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.scope, 'PARAM');
            assert.strictEqual(event!.severity, 'WARNING');
            assert.strictEqual(event!.message, 'Configuration issue detected');
        });
    });

    suite('Metadata Line Parsing', () => {
        test('Should parse comma-prefixed line metadata', () => {
            const lines = [
                'WCCOActrl    (2), 2025.12.14 10:56:08.388, CTRL, WARNING,   117, Library defined as #uses "logging" does not exist. See script',
                '    Script: /home/testus/wincc_proj/DevEnv/scripts/HelloWorld.ctl',
                ', Line 2',
            ];

            parser.parseLine(lines[0]);
            parser.parseLine(lines[1]);
            parser.parseLine(lines[2]);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            // When Line is on separate line with comma, Script moves to Library
            assert.strictEqual(
                event!.metadata?.library,
                '/home/testus/wincc_proj/DevEnv/scripts/HelloWorld.ctl',
            );
            assert.strictEqual(event!.metadata?.line, 2);
            assert.strictEqual(event!.metadata?.script, undefined);
        });

        test('Should parse library reference instead of script', () => {
            const lines = [
                'WCCOActrl    (3), 2025.12.14 11:00:00.000, CTRL, ERROR, 99, Function call failed',
                '    Library: /opt/WinCC_OA/libs/utils.ctl',
                '    Line: 234',
            ];

            parser.parseLine(lines[0]);
            parser.parseLine(lines[1]);
            parser.parseLine(lines[2]);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.metadata?.library, '/opt/WinCC_OA/libs/utils.ctl');
            assert.strictEqual(event!.metadata?.line, 234);
        });

        test('Should parse multi-line error with stacktrace', () => {
            const lines = [
                'WCCOAui      (1), 2025.12.13 14:30:22.456, CTRL, SEVERE, 200, Uncaught exception in script',
                '    Script: /opt/WinCC_OA/scripts/main.ctl',
                '    Line: 45',
                '    Stacktrace:',
                '        0: processData at /opt/WinCC_OA/libs/dataLib.ctl:123',
                '        1: handleEvent at /opt/WinCC_OA/scripts/main.ctl:45',
            ];

            lines.forEach((line) => parser.parseLine(line));
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.severity, 'SEVERE');
            assert.strictEqual(event!.metadata?.script, '/opt/WinCC_OA/scripts/main.ctl');
            assert.strictEqual(event!.metadata?.line, 45);

            assert.ok(event!.metadata?.stacktrace, 'Stacktrace should exist');
            assert.strictEqual(event!.metadata?.stacktrace!.length, 2);

            assert.strictEqual(event!.metadata?.stacktrace![0].index, 0);
            assert.strictEqual(event!.metadata?.stacktrace![0].functionName, 'processData');
            assert.strictEqual(
                event!.metadata?.stacktrace![0].filePath,
                '/opt/WinCC_OA/libs/dataLib.ctl',
            );
            assert.strictEqual(event!.metadata?.stacktrace![0].line, 123);

            assert.strictEqual(event!.metadata?.stacktrace![1].index, 1);
            assert.strictEqual(event!.metadata?.stacktrace![1].functionName, 'handleEvent');
            assert.strictEqual(
                event!.metadata?.stacktrace![1].filePath,
                '/opt/WinCC_OA/scripts/main.ctl',
            );
            assert.strictEqual(event!.metadata?.stacktrace![1].line, 45);
        });
    });

    suite('Severity Normalization', () => {
        test('Should normalize ERROR to FATAL', () => {
            const line =
                'WCCOActrl    (1), 2025.12.14 09:00:00.000, CTRL, ERROR, 500, Critical system failure';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.severity, 'FATAL');
        });

        test('Should keep WARNING as WARNING', () => {
            const line =
                'WCCOActrl    (1), 2025.12.14 09:00:00.000, CTRL, WARNING, 100, Minor issue';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.severity, 'WARNING');
        });

        test('Should keep INFO as INFO', () => {
            const line =
                'WCCOActrl    (1), 2025.12.14 09:00:00.000, CTRL, INFO, 10, Information message';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.severity, 'INFO');
        });

        test('Should keep SEVERE as SEVERE', () => {
            const line =
                'WCCOActrl    (1), 2025.12.14 09:00:00.000, CTRL, SEVERE, 300, Severe error';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.severity, 'SEVERE');
        });
    });

    suite('Multiple Events in Sequence', () => {
        test('Should complete previous event when new main line starts', () => {
            const lines = [
                'WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 1, First message',
                '    Script: /path/to/first.ctl',
                'WCCOActrl    (2), 2025.12.14 10:00:01.000, CTRL, WARNING, 2, Second message',
                '    Script: /path/to/second.ctl',
            ];

            const allEvents: LogEvent[] = [];

            allEvents.push(...parser.parseLine(lines[0])); // 0 events
            allEvents.push(...parser.parseLine(lines[1])); // 0 events
            allEvents.push(...parser.parseLine(lines[2])); // 1 event (first completed)
            allEvents.push(...parser.parseLine(lines[3])); // 0 events

            const lastEvent = parser.flush(); // second event
            if (lastEvent) allEvents.push(lastEvent);

            assert.strictEqual(allEvents.length, 2, 'Should have 2 completed events');

            assert.strictEqual(allEvents[0].identifier, 'WCCOActrl(1)');
            assert.strictEqual(allEvents[0].message, 'First message');
            assert.strictEqual(allEvents[0].metadata?.script, '/path/to/first.ctl');

            assert.strictEqual(allEvents[1].identifier, 'WCCOActrl(2)');
            assert.strictEqual(allEvents[1].message, 'Second message');
            assert.strictEqual(allEvents[1].metadata?.script, '/path/to/second.ctl');
        });

        test('Should handle events without metadata', () => {
            const lines = [
                'WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 1, Simple message',
                'WCCOActrl    (2), 2025.12.14 10:00:01.000, CTRL, INFO, 2, Another simple message',
            ];

            const allEvents: LogEvent[] = [];
            allEvents.push(...parser.parseLine(lines[0]));
            allEvents.push(...parser.parseLine(lines[1])); // First event should be completed

            const lastEvent = parser.flush();
            if (lastEvent) allEvents.push(lastEvent);

            assert.strictEqual(allEvents.length, 2);
            assert.strictEqual(allEvents[0].message, 'Simple message');
            assert.strictEqual(allEvents[1].message, 'Another simple message');
        });
    });

    suite('Edge Cases', () => {
        test('Should handle empty lines gracefully', () => {
            const lines = [
                'WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 1, Message',
                '',
                '    Script: /path/to/script.ctl',
            ];

            lines.forEach((line) => parser.parseLine(line));
            const event = parser.flush();

            assert.ok(event, 'Event should still be parsed');
            assert.strictEqual(event!.message, 'Message');
        });

        test('Should not parse invalid format lines', () => {
            const invalidLines = [
                'This is not a valid log line',
                'Random text without proper format',
                '2025.12.14 missing identifier',
            ];

            invalidLines.forEach((line) => {
                const events = parser.parseLine(line);
                assert.strictEqual(events.length, 0, 'Invalid line should not produce events');
            });

            const event = parser.flush();
            assert.strictEqual(event, null, 'No valid event should exist');
        });

        test('Should handle trailing comma in message', () => {
            const line =
                'WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, WARNING, 76, Message with trailing comma,';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.message, 'Message with trailing comma,');
        });

        test('Should handle message number with slash notation', () => {
            const line =
                'WCCOActrl    (2), 2025.12.13 21:12:36.581, PARAM, WARNING, 3/ctrl, Library not found';

            parser.parseLine(line);
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.strictEqual(event!.message, 'Library not found');
        });
    });

    suite('Raw Metadata Content', () => {
        test('Should capture raw metadata for complex data structures', () => {
            const lines = [
                'WCCOAui      (1), 2025.12.13 16:45:00.000, CTRL, INFO, 150, Debug output',
                '    dyn_anytype 3 element(s)',
                '        1: dyn_string 2 element(s)',
                '            1: "value1"',
                '            2: "value2"',
                '        2: 42',
                '        3: true',
            ];

            lines.forEach((line) => parser.parseLine(line));
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.ok(event!.metadata?.raw, 'Raw metadata should exist');
            assert.ok(event!.metadata?.raw!.includes('dyn_anytype'));
            assert.ok(event!.metadata?.raw!.includes('dyn_string'));
            assert.ok(event!.metadata?.raw!.includes('value1'));
        });

        test('Should append multiple raw lines together', () => {
            const lines = [
                'WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 1, Message',
                '    Additional info line 1',
                '    Additional info line 2',
                '    Additional info line 3',
            ];

            lines.forEach((line) => parser.parseLine(line));
            const event = parser.flush();

            assert.ok(event, 'Event should be parsed');
            assert.ok(event!.metadata?.raw, 'Raw metadata should exist');
            assert.ok(event!.metadata?.raw!.includes('Additional info line 1'));
            assert.ok(event!.metadata?.raw!.includes('Additional info line 2'));
            assert.ok(event!.metadata?.raw!.includes('Additional info line 3'));
        });
    });

    suite('Flush Behavior', () => {
        test('Should return null when flushing empty parser', () => {
            const event = parser.flush();
            assert.strictEqual(event, null);
        });

        test('Should return event when flushing with buffered event', () => {
            parser.parseLine('WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 1, Message');
            const event = parser.flush();

            assert.ok(event, 'Event should be returned');
            assert.strictEqual(event!.message, 'Message');
        });

        test('Should return null after flushing twice', () => {
            parser.parseLine('WCCOActrl    (1), 2025.12.14 10:00:00.000, CTRL, INFO, 1, Message');
            parser.flush();
            const secondFlush = parser.flush();

            assert.strictEqual(secondFlush, null, 'Second flush should return null');
        });
    });
});
