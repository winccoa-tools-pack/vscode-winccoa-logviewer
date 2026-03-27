import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    coverage: {
        // Exclude test sources from coverage reports
        exclude: ['**/test/**', '**\\test\\**']
    },
    tests: [
        {
            label: 'unitTests',
            files: 'dist/test/suite/index.js',
            version: 'stable',
            mocha: {
                ui: 'tdd',
                timeout: 30000
            }
        },
        {
            label: 'integrationTests',
            files: 'dist/test/suite/index.js',
            version: 'stable',
            workspaceFolder: './test-workspace',
            mocha: {
                ui: 'tdd',
                timeout: 30000
            }
        }
    ]
});
