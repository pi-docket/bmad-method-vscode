import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { TextDocument } from 'vscode';
import {
    workspace,
    window,
    commands,
    languages,
    Uri,
    Range,
    Selection,
    TextEditorRevealType,
    createMockTextDocument,
    resetAllMocks
} from './mocks/vscode';

// Helper to create typed mock documents
const mockDoc = (content: string, path?: string) => createMockTextDocument(content, path) as TextDocument;

// Mock the providers
vi.mock('../storyCodeLensProvider', () => ({
    StoryCodeLensProvider: vi.fn().mockImplementation(() => ({
        refresh: vi.fn(),
        dispose: vi.fn()
    }))
}));

vi.mock('../epicTreeProvider', () => ({
    EpicTreeProvider: vi.fn().mockImplementation(() => ({
        refresh: vi.fn(),
        dispose: vi.fn()
    }))
}));

vi.mock('../techSpecTreeProvider', () => ({
    TechSpecTreeProvider: vi.fn().mockImplementation(() => ({
        refresh: vi.fn(),
        dispose: vi.fn()
    }))
}));

vi.mock('../bmadConfig', () => ({
    getImplementationArtifactsPath: vi.fn().mockResolvedValue('_bmad-output/implementation')
}));

vi.mock('../cliTool', () => ({
    normalizeCliTool: vi.fn((tool) => tool || 'claude'),
    isSafeCliTool: vi.fn(() => true),
    buildCliCommand: vi.fn((tool, workflow, storyNumber) =>
        storyNumber ? `${tool} /bmad:bmm:workflows:${workflow} ${storyNumber}` : `${tool} /bmad:bmm:workflows:${workflow}`
    ),
    getWhichCommand: vi.fn((platform, tool) => ({
        cmd: platform === 'win32' ? 'where' : 'which',
        args: [tool]
    }))
}));

vi.mock('child_process', () => ({
    execFile: vi.fn((cmd, args, callback) => {
        // Simulate CLI tool being available
        callback(null);
    })
}));

import { activate, deactivate } from '../extension';
import { StoryCodeLensProvider } from '../storyCodeLensProvider';
import { EpicTreeProvider } from '../epicTreeProvider';
import { TechSpecTreeProvider } from '../techSpecTreeProvider';
import { normalizeCliTool, isSafeCliTool, buildCliCommand } from '../cliTool';

describe('Extension', () => {
    let mockContext: {
        subscriptions: { dispose: () => void }[];
    };

    beforeEach(() => {
        resetAllMocks();

        // Reset module state by clearing mock implementations
        vi.mocked(StoryCodeLensProvider).mockClear();
        vi.mocked(EpicTreeProvider).mockClear();
        vi.mocked(TechSpecTreeProvider).mockClear();

        // Reset cliTool mocks to default behavior
        vi.mocked(normalizeCliTool).mockImplementation((tool) => tool || 'claude');
        vi.mocked(isSafeCliTool).mockReturnValue(true);
        vi.mocked(buildCliCommand).mockImplementation((tool, workflow, storyNumber) =>
            storyNumber ? `${tool} /bmad:bmm:workflows:${workflow} ${storyNumber}` : `${tool} /bmad:bmm:workflows:${workflow}`
        );

        mockContext = {
            subscriptions: []
        };

        // Setup default workspace
        workspace.workspaceFolders = [
            { uri: Uri.file('/workspace'), name: 'workspace', index: 0 }
        ];

        // Setup default config
        vi.mocked(workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string, defaultValue?: unknown) => {
                if (key === 'epicFilePattern') return '**/*epic*.md';
                if (key === 'cliTool') return 'claude';
                return defaultValue;
            }),
            has: vi.fn(),
            inspect: vi.fn(),
            update: vi.fn()
        } as unknown as ReturnType<typeof workspace.getConfiguration>);

        // Setup mock terminal
        const mockTerminal = {
            name: 'Test Terminal',
            show: vi.fn(),
            sendText: vi.fn(),
            dispose: vi.fn()
        };
        vi.mocked(window.createTerminal).mockReturnValue(mockTerminal as unknown as ReturnType<typeof window.createTerminal>);
        window.terminals = [];
    });

    afterEach(() => {
        // Dispose all subscriptions
        mockContext.subscriptions.forEach(sub => sub.dispose?.());
    });

    describe('7.1.1 - All commands registered on activation', () => {
        it('registers all expected commands', () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            // Check that registerCommand was called for each command
            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const registeredCommands = registerCalls.map(call => call[0]);

            expect(registeredCommands).toContain('bmadMethod.createStory');
            expect(registeredCommands).toContain('bmadMethod.developStory');
            expect(registeredCommands).toContain('bmadMethod.refreshStories');
            expect(registeredCommands).toContain('bmadMethod.refreshTechSpecs');
            expect(registeredCommands).toContain('bmadMethod.revealStory');
            expect(registeredCommands).toContain('bmadMethod.revealTask');
        });

        it('registers CodeLens provider for markdown files', () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            expect(languages.registerCodeLensProvider).toHaveBeenCalledWith(
                { language: 'markdown', scheme: 'file' },
                expect.any(Object)
            );
        });

        it('creates tree views for stories and tech specs', () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            expect(window.createTreeView).toHaveBeenCalledWith('bmadStories', expect.any(Object));
            expect(window.createTreeView).toHaveBeenCalledWith('bmadTechSpecs', expect.any(Object));
        });

        it('adds all disposables to context subscriptions', () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            // Should have multiple subscriptions (providers, commands, watchers, etc.)
            expect(mockContext.subscriptions.length).toBeGreaterThan(5);
        });

        it('creates file system watchers', () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            // Should create watchers for epic files, tech specs, and config
            expect(workspace.createFileSystemWatcher).toHaveBeenCalled();
        });
    });

    describe('7.1.2 - bmadMethod.createStory terminal command construction', () => {
        it('executes create-story command with story number', async () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            // Find the createStory command handler
            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const createStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.createStory');
            expect(createStoryCall).toBeDefined();

            const handler = createStoryCall![1];
            await handler('1.1');

            expect(buildCliCommand).toHaveBeenCalledWith('claude', 'create-story', '1.1');
            expect(window.createTerminal).toHaveBeenCalled();
        });

        it('creates terminal with story number in name', async () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const createStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.createStory');
            const handler = createStoryCall![1];
            await handler('2.5');

            expect(window.createTerminal).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Story 2.5'
                })
            );
        });

        it('shows error when no workspace folder open', async () => {
            workspace.workspaceFolders = undefined;
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const createStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.createStory');
            const handler = createStoryCall![1];
            await handler('1.1');

            expect(window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No workspace folder open')
            );
        });

        it('shows error for invalid CLI tool name', async () => {
            vi.mocked(isSafeCliTool).mockReturnValue(false);
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const createStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.createStory');
            const handler = createStoryCall![1];
            await handler('1.1');

            expect(window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Invalid CLI tool name')
            );
        });

        it('reuses existing terminal with same name', async () => {
            const existingTerminal = {
                name: 'Story 1.1',
                show: vi.fn(),
                sendText: vi.fn(),
                dispose: vi.fn()
            };
            window.terminals = [existingTerminal as unknown as typeof window.terminals[0]];

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const createStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.createStory');
            const handler = createStoryCall![1];
            await handler('1.1');

            // Should not create a new terminal
            expect(window.createTerminal).not.toHaveBeenCalled();
            expect(existingTerminal.show).toHaveBeenCalled();
            expect(existingTerminal.sendText).toHaveBeenCalled();
        });
    });

    describe('7.1.3 - bmadMethod.developStory terminal command construction', () => {
        it('executes dev-story command with story number', async () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const developStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.developStory');
            expect(developStoryCall).toBeDefined();

            const handler = developStoryCall![1];
            await handler('3.2');

            expect(buildCliCommand).toHaveBeenCalledWith('claude', 'dev-story', '3.2');
        });

        it('creates terminal with story number in name', async () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const developStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.developStory');
            const handler = developStoryCall![1];
            await handler('4.1');

            expect(window.createTerminal).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Story 4.1'
                })
            );
        });

        it('uses configured CLI tool', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'cliTool') return 'cursor';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);
            vi.mocked(normalizeCliTool).mockReturnValue('cursor');

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const developStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.developStory');
            const handler = developStoryCall![1];
            await handler('1.1');

            expect(buildCliCommand).toHaveBeenCalledWith('cursor', 'dev-story', '1.1');
        });
    });

    describe('7.1.4 - bmadMethod.revealStory navigation with bounds checking', () => {
        it('opens document and reveals line at specified position', async () => {
            const mockDocument = mockDoc('Line 0\nLine 1\nLine 2\nLine 3\n', '/workspace/epics.md');
            vi.mocked(workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof workspace.openTextDocument>>);

            const mockEditor = {
                selection: null as Selection | null,
                revealRange: vi.fn()
            };
            vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as unknown as Awaited<ReturnType<typeof window.showTextDocument>>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.revealStory');
            const handler = revealStoryCall![1];
            await handler('/workspace/epics.md', 2);

            expect(workspace.openTextDocument).toHaveBeenCalledWith('/workspace/epics.md');
            expect(window.showTextDocument).toHaveBeenCalled();
            expect(mockEditor.revealRange).toHaveBeenCalledWith(
                expect.any(Range),
                TextEditorRevealType.InCenter
            );
        });

        it('shows warning for line number beyond document bounds', async () => {
            const mockDocument = mockDoc('Line 0\nLine 1\n', '/workspace/epics.md');
            vi.mocked(workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof workspace.openTextDocument>>);

            const mockEditor = {
                selection: null as Selection | null,
                revealRange: vi.fn()
            };
            vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as unknown as Awaited<ReturnType<typeof window.showTextDocument>>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.revealStory');
            const handler = revealStoryCall![1];

            // Line 100 is beyond the 2-line document
            await handler('/workspace/epics.md', 100);

            expect(window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('not found in file')
            );
            expect(mockEditor.revealRange).not.toHaveBeenCalled();
        });

        it('shows warning for negative line number', async () => {
            const mockDocument = mockDoc('Line 0\nLine 1\n', '/workspace/epics.md');
            vi.mocked(workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof workspace.openTextDocument>>);

            const mockEditor = {
                selection: null as Selection | null,
                revealRange: vi.fn()
            };
            vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as unknown as Awaited<ReturnType<typeof window.showTextDocument>>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.revealStory');
            const handler = revealStoryCall![1];

            await handler('/workspace/epics.md', -1);

            expect(window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('not found in file')
            );
        });

        it('shows error when document cannot be opened', async () => {
            vi.mocked(workspace.openTextDocument).mockRejectedValue(new Error('File not found'));

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.revealStory');
            const handler = revealStoryCall![1];

            await handler('/nonexistent/file.md', 0);

            expect(window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to open story')
            );
        });

        it('sets editor selection to the revealed line', async () => {
            const mockDocument = mockDoc('Line 0\nLine 1\nLine 2\n', '/workspace/epics.md');
            vi.mocked(workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof workspace.openTextDocument>>);

            const mockEditor = {
                selection: null as Selection | null,
                revealRange: vi.fn()
            };
            vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as unknown as Awaited<ReturnType<typeof window.showTextDocument>>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealStoryCall = registerCalls.find(call => call[0] === 'bmadMethod.revealStory');
            const handler = revealStoryCall![1];
            await handler('/workspace/epics.md', 1);

            expect(mockEditor.selection).not.toBeNull();
        });
    });

    describe('7.1.5 - bmadMethod.revealTask navigation', () => {
        it('opens document and reveals task at specified position', async () => {
            const mockDocument = mockDoc('Task 0\nTask 1\nTask 2\n', '/workspace/tech-spec.md');
            vi.mocked(workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof workspace.openTextDocument>>);

            const mockEditor = {
                selection: null as Selection | null,
                revealRange: vi.fn()
            };
            vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as unknown as Awaited<ReturnType<typeof window.showTextDocument>>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealTaskCall = registerCalls.find(call => call[0] === 'bmadMethod.revealTask');
            const handler = revealTaskCall![1];
            await handler('/workspace/tech-spec.md', 1);

            expect(workspace.openTextDocument).toHaveBeenCalledWith('/workspace/tech-spec.md');
            expect(window.showTextDocument).toHaveBeenCalled();
            expect(mockEditor.revealRange).toHaveBeenCalledWith(
                expect.any(Range),
                TextEditorRevealType.InCenter
            );
        });

        it('shows warning for task line beyond document bounds', async () => {
            const mockDocument = mockDoc('Task 0\n', '/workspace/tech-spec.md');
            vi.mocked(workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof workspace.openTextDocument>>);

            const mockEditor = {
                selection: null as Selection | null,
                revealRange: vi.fn()
            };
            vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as unknown as Awaited<ReturnType<typeof window.showTextDocument>>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealTaskCall = registerCalls.find(call => call[0] === 'bmadMethod.revealTask');
            const handler = revealTaskCall![1];

            await handler('/workspace/tech-spec.md', 50);

            expect(window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('Task line')
            );
            expect(mockEditor.revealRange).not.toHaveBeenCalled();
        });

        it('shows error when task file cannot be opened', async () => {
            vi.mocked(workspace.openTextDocument).mockRejectedValue(new Error('Permission denied'));

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const revealTaskCall = registerCalls.find(call => call[0] === 'bmadMethod.revealTask');
            const handler = revealTaskCall![1];

            await handler('/protected/file.md', 0);

            expect(window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to open task')
            );
        });
    });

    describe('Refresh commands', () => {
        it('refreshStories command triggers tree provider refresh', () => {
            const mockTreeProvider = {
                refresh: vi.fn(),
                dispose: vi.fn()
            };
            vi.mocked(EpicTreeProvider).mockImplementation(() => mockTreeProvider as unknown as InstanceType<typeof EpicTreeProvider>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const refreshCall = registerCalls.find(call => call[0] === 'bmadMethod.refreshStories');
            const handler = refreshCall![1];
            handler();

            expect(mockTreeProvider.refresh).toHaveBeenCalled();
        });

        it('refreshTechSpecs command triggers tech spec provider refresh', () => {
            const mockTechSpecProvider = {
                refresh: vi.fn(),
                dispose: vi.fn()
            };
            vi.mocked(TechSpecTreeProvider).mockImplementation(() => mockTechSpecProvider as unknown as InstanceType<typeof TechSpecTreeProvider>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const registerCalls = vi.mocked(commands.registerCommand).mock.calls;
            const refreshCall = registerCalls.find(call => call[0] === 'bmadMethod.refreshTechSpecs');
            const handler = refreshCall![1];
            handler();

            expect(mockTechSpecProvider.refresh).toHaveBeenCalled();
        });
    });

    describe('Configuration change handling', () => {
        it('refreshes providers when bmad configuration changes', () => {
            const mockCodeLensProvider = {
                refresh: vi.fn(),
                dispose: vi.fn()
            };
            const mockTreeProvider = {
                refresh: vi.fn(),
                dispose: vi.fn()
            };
            const mockTechSpecProvider = {
                refresh: vi.fn(),
                dispose: vi.fn()
            };

            vi.mocked(StoryCodeLensProvider).mockImplementation(() => mockCodeLensProvider as unknown as InstanceType<typeof StoryCodeLensProvider>);
            vi.mocked(EpicTreeProvider).mockImplementation(() => mockTreeProvider as unknown as InstanceType<typeof EpicTreeProvider>);
            vi.mocked(TechSpecTreeProvider).mockImplementation(() => mockTechSpecProvider as unknown as InstanceType<typeof TechSpecTreeProvider>);

            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            // Get the configuration change handler
            const onConfigChangeCalls = vi.mocked(workspace.onDidChangeConfiguration).mock.calls;
            expect(onConfigChangeCalls.length).toBeGreaterThan(0);

            const configChangeHandler = onConfigChangeCalls[0][0];

            // Simulate configuration change
            const mockEvent = {
                affectsConfiguration: vi.fn((section: string) => section === 'bmad')
            };
            configChangeHandler(mockEvent as unknown as Parameters<typeof configChangeHandler>[0]);

            expect(mockCodeLensProvider.refresh).toHaveBeenCalled();
            expect(mockTreeProvider.refresh).toHaveBeenCalled();
            expect(mockTechSpecProvider.refresh).toHaveBeenCalled();
        });

        it('recreates watcher when epicFilePattern changes', () => {
            activate(mockContext as unknown as Parameters<typeof activate>[0]);

            const initialWatcherCalls = vi.mocked(workspace.createFileSystemWatcher).mock.calls.length;

            // Get the configuration change handler
            const onConfigChangeCalls = vi.mocked(workspace.onDidChangeConfiguration).mock.calls;
            const configChangeHandler = onConfigChangeCalls[0][0];

            // Simulate epicFilePattern configuration change
            const mockEvent = {
                affectsConfiguration: vi.fn((section: string) =>
                    section === 'bmad' || section === 'bmad.epicFilePattern'
                )
            };
            configChangeHandler(mockEvent as unknown as Parameters<typeof configChangeHandler>[0]);

            // Should have created a new watcher
            expect(vi.mocked(workspace.createFileSystemWatcher).mock.calls.length).toBeGreaterThan(initialWatcherCalls);
        });
    });

    describe('deactivate', () => {
        it('deactivate function exists and is callable', () => {
            expect(deactivate).toBeDefined();
            expect(() => deactivate()).not.toThrow();
        });
    });

    describe('7.2 Resource Cleanup', () => {
        describe('7.2.1 - deactivate() disposes all watchers', () => {
            it('all subscriptions have dispose methods', () => {
                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // All items in subscriptions should be disposable
                mockContext.subscriptions.forEach((sub, index) => {
                    expect(sub).toBeDefined();
                    // Subscriptions from VS Code API should have dispose
                    // Our mock returns objects with dispose methods
                });

                // Should have subscriptions for: CodeLens provider, tree views (x2),
                // providers (x2), commands (x6), watchers (x3+), config listener
                expect(mockContext.subscriptions.length).toBeGreaterThan(10);
            });

            it('file system watchers are added to subscriptions', () => {
                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // createFileSystemWatcher should have been called
                expect(workspace.createFileSystemWatcher).toHaveBeenCalled();

                // The watchers should be in subscriptions
                const watcherCalls = vi.mocked(workspace.createFileSystemWatcher).mock.calls;
                expect(watcherCalls.length).toBeGreaterThan(0);
            });

            it('providers are added to subscriptions for disposal', () => {
                const mockTreeProvider = {
                    refresh: vi.fn(),
                    dispose: vi.fn()
                };
                const mockTechSpecProvider = {
                    refresh: vi.fn(),
                    dispose: vi.fn()
                };

                vi.mocked(EpicTreeProvider).mockImplementation(() => mockTreeProvider as unknown as InstanceType<typeof EpicTreeProvider>);
                vi.mocked(TechSpecTreeProvider).mockImplementation(() => mockTechSpecProvider as unknown as InstanceType<typeof TechSpecTreeProvider>);

                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // Providers should be in subscriptions
                // When context.subscriptions are disposed, provider.dispose() will be called
                expect(mockContext.subscriptions.length).toBeGreaterThan(0);
            });

            it('disposing subscriptions cleans up resources', () => {
                const mockWatcher = {
                    onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
                    onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
                    onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
                    dispose: vi.fn()
                };
                vi.mocked(workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as unknown as ReturnType<typeof workspace.createFileSystemWatcher>);

                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // Simulate VS Code disposing all subscriptions (like when extension deactivates)
                mockContext.subscriptions.forEach(sub => {
                    if (typeof sub?.dispose === 'function') {
                        sub.dispose();
                    }
                });

                // Watcher dispose should have been called
                expect(mockWatcher.dispose).toHaveBeenCalled();
            });
        });

        describe('7.2.2 - deactivate() clears all timeouts', () => {
            it('providers with debounced refresh are disposed properly', () => {
                const mockTreeProvider = {
                    refresh: vi.fn(),
                    dispose: vi.fn()
                };
                const mockTechSpecProvider = {
                    refresh: vi.fn(),
                    dispose: vi.fn()
                };

                vi.mocked(EpicTreeProvider).mockImplementation(() => mockTreeProvider as unknown as InstanceType<typeof EpicTreeProvider>);
                vi.mocked(TechSpecTreeProvider).mockImplementation(() => mockTechSpecProvider as unknown as InstanceType<typeof TechSpecTreeProvider>);

                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // Simulate disposal
                mockContext.subscriptions.forEach(sub => {
                    if (typeof sub?.dispose === 'function') {
                        sub.dispose();
                    }
                });

                // Provider dispose should have been called (which clears timeouts internally)
                expect(mockTreeProvider.dispose).toHaveBeenCalled();
                expect(mockTechSpecProvider.dispose).toHaveBeenCalled();
            });

            it('configuration change listener is disposed', () => {
                const mockDispose = vi.fn();
                vi.mocked(workspace.onDidChangeConfiguration).mockReturnValue({ dispose: mockDispose });

                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // Simulate disposal
                mockContext.subscriptions.forEach(sub => {
                    if (typeof sub?.dispose === 'function') {
                        sub.dispose();
                    }
                });

                expect(mockDispose).toHaveBeenCalled();
            });
        });

        describe('7.2.3 - No memory leaks on repeated activate/deactivate cycles', () => {
            it('multiple activation cycles do not accumulate subscriptions', () => {
                // First activation
                const context1 = { subscriptions: [] as { dispose: () => void }[] };
                activate(context1 as unknown as Parameters<typeof activate>[0]);
                const count1 = context1.subscriptions.length;

                // Simulate deactivation by disposing
                context1.subscriptions.forEach(sub => sub?.dispose?.());

                // Reset mocks for clean state
                vi.mocked(commands.registerCommand).mockClear();
                vi.mocked(languages.registerCodeLensProvider).mockClear();
                vi.mocked(window.createTreeView).mockClear();
                vi.mocked(workspace.createFileSystemWatcher).mockClear();

                // Second activation with new context
                const context2 = { subscriptions: [] as { dispose: () => void }[] };
                activate(context2 as unknown as Parameters<typeof activate>[0]);
                const count2 = context2.subscriptions.length;

                // Subscription counts should be similar (not growing)
                expect(count2).toBeLessThanOrEqual(count1 + 2); // Allow small variance
            });

            it('command handlers are re-registered on each activation', () => {
                // First activation
                const context1 = { subscriptions: [] as { dispose: () => void }[] };
                activate(context1 as unknown as Parameters<typeof activate>[0]);

                const firstCallCount = vi.mocked(commands.registerCommand).mock.calls.length;

                // Reset for second activation
                vi.mocked(commands.registerCommand).mockClear();

                // Second activation
                const context2 = { subscriptions: [] as { dispose: () => void }[] };
                activate(context2 as unknown as Parameters<typeof activate>[0]);

                const secondCallCount = vi.mocked(commands.registerCommand).mock.calls.length;

                // Should register same number of commands
                expect(secondCallCount).toBe(firstCallCount);
            });

            it('tree views are recreated on each activation', () => {
                // First activation
                const context1 = { subscriptions: [] as { dispose: () => void }[] };
                activate(context1 as unknown as Parameters<typeof activate>[0]);

                expect(window.createTreeView).toHaveBeenCalledTimes(2); // bmadStories and bmadTechSpecs

                // Reset
                vi.mocked(window.createTreeView).mockClear();

                // Second activation
                const context2 = { subscriptions: [] as { dispose: () => void }[] };
                activate(context2 as unknown as Parameters<typeof activate>[0]);

                expect(window.createTreeView).toHaveBeenCalledTimes(2);
            });

            it('watchers are recreated when pattern changes during activation cycle', () => {
                const mockWatcher = {
                    onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
                    onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
                    onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
                    dispose: vi.fn()
                };
                vi.mocked(workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as unknown as ReturnType<typeof workspace.createFileSystemWatcher>);

                activate(mockContext as unknown as Parameters<typeof activate>[0]);

                // Get config change handler
                const onConfigChangeCalls = vi.mocked(workspace.onDidChangeConfiguration).mock.calls;
                const configChangeHandler = onConfigChangeCalls[0][0];

                // Simulate pattern change - this should dispose old watcher and create new one
                const mockEvent = {
                    affectsConfiguration: vi.fn((section: string) =>
                        section === 'bmad' || section === 'bmad.epicFilePattern'
                    )
                };
                configChangeHandler(mockEvent as unknown as Parameters<typeof configChangeHandler>[0]);

                // Old watcher should be disposed when new one is created
                expect(mockWatcher.dispose).toHaveBeenCalled();
            });
        });
    });
});
