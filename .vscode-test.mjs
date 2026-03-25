import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    coverage: {
        // Exclude test sources from coverage reports
        exclude: ['**/test/**', '**\\test\\**']
    },
    tests: [
        {
            label: 'unitTests',
            files: 'out/test/suite/index.js',
            version: 'stable',
            mocha: {
                ui: 'tdd',
                timeout: 30000
            }
        },
        {
            label: 'integrationTests',
            files: 'out/test/suite/index.js',
            version: 'stable',
            workspaceFolder: './test-workspace',
            mocha: {
                ui: 'tdd',
                timeout: 30000
            }
        }
    ]
});
