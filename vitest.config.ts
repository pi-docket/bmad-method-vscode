import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test file patterns
        include: ['src/__tests__/**/*.test.ts'],

        // Exclude patterns
        exclude: ['node_modules', 'out', 'src/__tests__/fixtures/**'],

        // Mock the vscode module
        alias: {
            vscode: new URL('./src/__tests__/mocks/vscode.ts', import.meta.url).pathname
        },

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: './coverage',

            // Include source files
            include: ['src/**/*.ts'],

            // Exclude from coverage
            exclude: [
                'src/__tests__/**',
                'src/**/*.d.ts'
            ],

            // Coverage thresholds
            thresholds: {
                // Start with achievable thresholds, increase as coverage improves
                lines: 50,
                functions: 50,
                branches: 40,
                statements: 50,

                // Per-file thresholds for critical modules
                perFile: true,
                'src/cliTool.ts': {
                    lines: 90,
                    functions: 90,
                    branches: 80,
                    statements: 90
                },
                'src/epicsParser.ts': {
                    lines: 80,
                    functions: 80,
                    branches: 70,
                    statements: 80
                },
                'src/techSpecParser.ts': {
                    lines: 80,
                    functions: 80,
                    branches: 70,
                    statements: 80
                }
            }
        },

        // Reporter options
        reporters: ['verbose'],

        // Global test timeout
        testTimeout: 10000,

        // Run tests in sequence for deterministic output
        sequence: {
            shuffle: false
        }
    }
});
