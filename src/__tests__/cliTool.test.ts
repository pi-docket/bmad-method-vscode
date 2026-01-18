import { describe, it, expect } from 'vitest';
import {
    normalizeCliTool,
    isSafeCliTool,
    buildCliCommand,
    getWhichCommand,
    quoteCliTool,
    DEFAULT_CLI_TOOL
} from '../cliTool';

describe('cliTool', () => {
    describe('normalizeCliTool', () => {
        it('returns default tool when undefined', () => {
            expect(normalizeCliTool(undefined)).toBe(DEFAULT_CLI_TOOL);
        });

        it('returns default tool when empty string', () => {
            expect(normalizeCliTool('')).toBe(DEFAULT_CLI_TOOL);
        });

        it('returns default tool when only whitespace', () => {
            expect(normalizeCliTool('   ')).toBe(DEFAULT_CLI_TOOL);
        });

        it('returns trimmed tool name', () => {
            expect(normalizeCliTool('  cursor  ')).toBe('cursor');
        });

        it('returns tool name as-is when valid', () => {
            expect(normalizeCliTool('aider')).toBe('aider');
        });
    });

    describe('isSafeCliTool', () => {
        describe('valid tool names', () => {
            it('accepts simple tool names', () => {
                expect(isSafeCliTool('claude')).toBe(true);
                expect(isSafeCliTool('cursor')).toBe(true);
                expect(isSafeCliTool('aider')).toBe(true);
            });

            it('accepts tool names with dots', () => {
                expect(isSafeCliTool('tool.exe')).toBe(true);
            });

            it('accepts tool names with underscores', () => {
                expect(isSafeCliTool('my_tool')).toBe(true);
            });

            it('accepts tool names with hyphens', () => {
                expect(isSafeCliTool('my-tool')).toBe(true);
            });

            it('accepts Unix absolute paths', () => {
                expect(isSafeCliTool('/usr/bin/claude')).toBe(true);
                expect(isSafeCliTool('/opt/tools/my-cli')).toBe(true);
            });

            it('accepts Windows absolute paths', () => {
                expect(isSafeCliTool('C:/Program Files/tool.exe')).toBe(true);
                expect(isSafeCliTool('C:\\Program Files\\tool.exe')).toBe(true);
            });

            it('accepts paths with spaces', () => {
                expect(isSafeCliTool('/path/with spaces/tool')).toBe(true);
                expect(isSafeCliTool('C:/Program Files/My Tool/tool.exe')).toBe(true);
            });
        });

        describe('command injection attempts', () => {
            it('rejects semicolon (command chaining)', () => {
                expect(isSafeCliTool('tool; rm -rf /')).toBe(false);
            });

            it('rejects pipe (command piping)', () => {
                expect(isSafeCliTool('tool | cat /etc/passwd')).toBe(false);
            });

            it('rejects && (command chaining)', () => {
                expect(isSafeCliTool('tool && malicious')).toBe(false);
            });

            it('rejects || (command chaining)', () => {
                expect(isSafeCliTool('tool || malicious')).toBe(false);
            });

            it('rejects $() (command substitution)', () => {
                expect(isSafeCliTool('$(whoami)')).toBe(false);
                expect(isSafeCliTool('tool $(echo evil)')).toBe(false);
            });

            it('rejects backticks (command substitution)', () => {
                expect(isSafeCliTool('`whoami`')).toBe(false);
                expect(isSafeCliTool('tool `evil`')).toBe(false);
            });

            it('rejects > (output redirection)', () => {
                expect(isSafeCliTool('tool > /etc/passwd')).toBe(false);
            });

            it('rejects < (input redirection)', () => {
                expect(isSafeCliTool('tool < /etc/passwd')).toBe(false);
            });

            it('rejects newlines', () => {
                expect(isSafeCliTool('tool\nmalicious')).toBe(false);
            });

            it('rejects single quotes', () => {
                expect(isSafeCliTool("tool'injection")).toBe(false);
            });

            it('rejects double quotes', () => {
                expect(isSafeCliTool('tool"injection')).toBe(false);
            });

            it('rejects ampersand alone (background execution)', () => {
                expect(isSafeCliTool('tool &')).toBe(false);
            });
        });
    });

    describe('quoteCliTool', () => {
        it('returns tool as-is when no spaces or quotes', () => {
            expect(quoteCliTool('claude')).toBe('claude');
            expect(quoteCliTool('/usr/bin/claude')).toBe('/usr/bin/claude');
        });

        it('quotes tool with spaces', () => {
            expect(quoteCliTool('/path/with spaces/tool')).toBe('"/path/with spaces/tool"');
        });

        it('escapes and quotes tool with double quotes', () => {
            expect(quoteCliTool('tool"name')).toBe('"tool\\"name"');
        });

        it('escapes backslashes when quoting', () => {
            expect(quoteCliTool('path with\\slash')).toBe('"path with\\\\slash"');
        });
    });

    describe('buildCliCommand', () => {
        it('builds create-story command with story number', () => {
            const cmd = buildCliCommand('claude', 'create-story', '1.1');
            expect(cmd).toBe('claude "/bmad:bmm:workflows:create-story 1.1"');
        });

        it('builds dev-story command with story number', () => {
            const cmd = buildCliCommand('claude', 'dev-story', '2.3');
            expect(cmd).toBe('claude "/bmad:bmm:workflows:dev-story 2.3"');
        });

        it('builds command without story number', () => {
            const cmd = buildCliCommand('claude', 'create-story');
            expect(cmd).toBe('claude "/bmad:bmm:workflows:create-story"');
        });

        it('handles tool with spaces', () => {
            const cmd = buildCliCommand('/path/with spaces/tool', 'dev-story', '1.1');
            expect(cmd).toBe('"/path/with spaces/tool" "/bmad:bmm:workflows:dev-story 1.1"');
        });

        it('handles different tool names', () => {
            expect(buildCliCommand('cursor', 'create-story', '1.1')).toBe(
                'cursor "/bmad:bmm:workflows:create-story 1.1"'
            );
            expect(buildCliCommand('aider', 'dev-story', '1.1')).toBe(
                'aider "/bmad:bmm:workflows:dev-story 1.1"'
            );
        });
    });

    describe('getWhichCommand', () => {
        it('returns "which" on Unix platforms', () => {
            expect(getWhichCommand('linux', 'claude')).toEqual({ cmd: 'which', args: ['claude'] });
            expect(getWhichCommand('darwin', 'claude')).toEqual({ cmd: 'which', args: ['claude'] });
        });

        it('returns "where" on Windows', () => {
            expect(getWhichCommand('win32', 'claude')).toEqual({ cmd: 'where', args: ['claude'] });
        });

        it('passes tool name as argument', () => {
            const result = getWhichCommand('linux', 'my-custom-tool');
            expect(result.args).toEqual(['my-custom-tool']);
        });
    });
});
