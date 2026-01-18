import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { TextDocument, CodeLens as VsCodeLens } from 'vscode';
import {
    workspace,
    Uri,
    CodeLens,
    Range,
    Position,
    createMockTextDocument,
    resetAllMocks
} from './mocks/vscode';
import { StoryCodeLensProvider } from '../storyCodeLensProvider';
import { getImplementationArtifactsPath } from '../bmadConfig';

// Helper to create typed mock documents
const mockDoc = (content: string, path?: string) => createMockTextDocument(content, path) as TextDocument;
// Helper to cast mock CodeLens to vscode.CodeLens
const asCodeLens = (lens: CodeLens) => lens as unknown as VsCodeLens;

// Mock bmadConfig
vi.mock('../bmadConfig', () => ({
    getImplementationArtifactsPath: vi.fn()
}));

describe('StoryCodeLensProvider', () => {
    let provider: StoryCodeLensProvider;

    beforeEach(() => {
        resetAllMocks();
        provider = new StoryCodeLensProvider();

        // Default workspace setup
        workspace.workspaceFolders = [
            { uri: Uri.file('/workspace'), name: 'workspace', index: 0 }
        ];

        // Default config - CodeLens enabled, default pattern
        vi.mocked(workspace.getConfiguration).mockReturnValue({
            get: vi.fn((key: string, defaultValue?: unknown) => {
                if (key === 'enableCodeLens') return true;
                if (key === 'epicFilePattern') return '**/*epic*.md';
                return defaultValue;
            }),
            has: vi.fn(),
            inspect: vi.fn(),
            update: vi.fn()
        } as unknown as ReturnType<typeof workspace.getConfiguration>);
    });

    afterEach(() => {
        provider.dispose();
    });

    describe('6.1.1 - CodeLens creation for ready status stories', () => {
        it('creates CodeLens for story with ready status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready

Story description here.
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.createStory');
            expect(codeLenses[0].command?.arguments).toEqual(['1.1']);
        });

        it('creates Start Developing CodeLens when story file exists', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['1-1-first-story.md', 1] // FileType.File = 1
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.developStory');
            expect(codeLenses[0].command?.title).toBe('$(play) Start Developing Story');
        });

        it('creates Create Story CodeLens when story file does not exist', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.createStory');
            expect(codeLenses[0].command?.title).toBe('$(new-file) Create Story');
        });

        it('creates multiple CodeLenses for multiple ready stories', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready

### Story 1.2: Second Story
**Status:** ready

### Story 1.3: Third Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(3);
            expect(codeLenses[0].command?.arguments).toEqual(['1.1']);
            expect(codeLenses[1].command?.arguments).toEqual(['1.2']);
            expect(codeLenses[2].command?.arguments).toEqual(['1.3']);
        });

        it('includes story title in tooltip', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: Authentication Flow
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses[0].command?.tooltip).toContain('1.1');
            expect(codeLenses[0].command?.tooltip).toContain('Authentication Flow');
        });
    });

    describe('6.1.2 - CodeLens NOT created for other statuses', () => {
        it('does not create CodeLens for in-progress status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** in-progress
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('does not create CodeLens for done status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** done
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('does not create CodeLens for blocked status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** blocked
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('does not create CodeLens for draft status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** draft
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('does not create CodeLens for unknown status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** pending-review
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('only creates CodeLens for ready stories in mixed status file', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** done

### Story 1.2: Second Story
**Status:** ready

### Story 1.3: Third Story
**Status:** in-progress

### Story 1.4: Fourth Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(2);
            expect(codeLenses[0].command?.arguments).toEqual(['1.2']);
            expect(codeLenses[1].command?.arguments).toEqual(['1.4']);
        });
    });

    describe('6.1.3 - Story file existence check logic', () => {
        it('returns false when no workspace folder', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            // Override getWorkspaceFolder to return undefined
            vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(undefined);

            const codeLenses = await provider.provideCodeLenses(document);

            // Should still create CodeLens but with "Create Story" since file check returns false
            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.createStory');
        });

        it('returns false when no implementation_artifacts path configured', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue(null);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.createStory');
        });

        it('returns false when directory read fails', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockRejectedValue(new Error('Directory not found'));

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.createStory');
        });

        it('matches story file with different suffixes', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const wsFolder = { uri: Uri.file('/workspace'), name: 'workspace', index: 0 };
            workspace.workspaceFolders = [wsFolder];
            vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(wsFolder);
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['1-1-user-authentication.md', 1],
                ['1-2-other-story.md', 1]
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.developStory');
        });

        it('documents startsWith matching behavior - may match similar prefixes', async () => {
            // NOTE: Current implementation uses startsWith() which means
            // "1-10-story.md" WILL match story 1.1 (prefix "1-1") because "1-10" starts with "1-1"
            // This documents the actual behavior, which may be a limitation
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const wsFolder = { uri: Uri.file('/workspace'), name: 'workspace', index: 0 };
            workspace.workspaceFolders = [wsFolder];
            vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(wsFolder);
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['1-10-different-story.md', 1],  // "1-10" starts with "1-1" so this WILL match
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            // This matches because startsWith("1-1") is true for "1-10-different-story.md"
            expect(codeLenses[0].command?.command).toBe('bmadMethod.developStory');
        });

        it('does not match when file prefix is completely different', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['2-1-different-epic.md', 1],   // Does NOT start with "1-1"
                ['11-1-another-story.md', 1]     // Does NOT start with "1-1"
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
            expect(codeLenses[0].command?.command).toBe('bmadMethod.createStory');
        });
    });

    describe('6.1.4 - Story number transformation (dots to dashes)', () => {
        it('converts single dot to dash', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const wsFolder = { uri: Uri.file('/workspace'), name: 'workspace', index: 0 };
            workspace.workspaceFolders = [wsFolder];
            vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(wsFolder);
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['1-1-story.md', 1]  // 1.1 -> 1-1
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses[0].command?.command).toBe('bmadMethod.developStory');
        });

        it('handles story numbers with single digit epic and story', async () => {
            // Note: The epicsParser only supports X.Y format (one dot), not X.Y.Z
            const content = `## Epic 2: Another Epic

### Story 2.5: Fifth Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const wsFolder = { uri: Uri.file('/workspace'), name: 'workspace', index: 0 };
            workspace.workspaceFolders = [wsFolder];
            vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(wsFolder);
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['2-5-fifth-story.md', 1]  // 2.5 -> 2-5
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses[0].command?.command).toBe('bmadMethod.developStory');
        });

        it('handles double-digit story numbers', async () => {
            const content = `## Epic 10: Large Epic

### Story 10.15: Large Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const wsFolder = { uri: Uri.file('/workspace'), name: 'workspace', index: 0 };
            workspace.workspaceFolders = [wsFolder];
            vi.mocked(workspace.getWorkspaceFolder).mockReturnValue(wsFolder);
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([
                ['10-15-large-story.md', 1]  // 10.15 -> 10-15
            ]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses[0].command?.command).toBe('bmadMethod.developStory');
        });
    });

    describe('6.1.5 - Glob pattern to regex conversion', () => {
        it('matches default pattern **/*epic*.md', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // File name contains "epic" - should match
            const document = mockDoc(content, '/workspace/my-epic-file.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });

        it('does not match files without epic in name', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // File name does not contain "epic" - should not match
            const document = mockDoc(content, '/workspace/stories.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('matches custom pattern *.stories.md', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return true;
                    if (key === 'epicFilePattern') return '*.stories.md';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/project.stories.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });

        it('handles pattern with ? wildcard', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return true;
                    if (key === 'epicFilePattern') return 'epic?.md';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // epic1.md matches epic?.md
            const document = mockDoc(content, '/workspace/epic1.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });

        it('case insensitive matching', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // EPIC in uppercase should still match *epic*.md pattern
            const document = mockDoc(content, '/workspace/MY-EPIC-FILE.MD');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });

        it('escapes regex special characters in pattern', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return true;
                    if (key === 'epicFilePattern') return 'epic[1].md';  // [ ] are regex special chars
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epic[1].md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });

        it('extracts filename pattern from full path pattern', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return true;
                    if (key === 'epicFilePattern') return 'docs/planning/*epic*.md';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // File matches *epic*.md portion
            const document = mockDoc(content, '/workspace/my-epic.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });
    });

    describe('6.1.6 - ReDoS protection (backtracking guard)', () => {
        it('collapses consecutive asterisks to prevent ReDoS', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return true;
                    // Pattern with many consecutive asterisks - potential ReDoS
                    if (key === 'epicFilePattern') return '****epic****.md';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/test-epic-file.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            // This should complete quickly without hanging
            const startTime = Date.now();
            const codeLenses = await provider.provideCodeLenses(document);
            const elapsed = Date.now() - startTime;

            expect(codeLenses).toHaveLength(1);
            // Should complete in reasonable time (under 100ms)
            expect(elapsed).toBeLessThan(100);
        });

        it('handles pathological input without hanging', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return true;
                    if (key === 'epicFilePattern') return '*a*a*a*a*.md';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // Input with many 'a's that could cause backtracking
            const document = mockDoc(content, '/workspace/aaaaaaaaaaaaaaaa.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const startTime = Date.now();
            const codeLenses = await provider.provideCodeLenses(document);
            const elapsed = Date.now() - startTime;

            // Should complete in reasonable time
            expect(elapsed).toBeLessThan(100);
        });
    });

    describe('Configuration handling', () => {
        it('returns empty array when CodeLens is disabled', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => {
                    if (key === 'enableCodeLens') return false;
                    if (key === 'epicFilePattern') return '**/*epic*.md';
                    return defaultValue;
                }),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('uses default value when config not set', async () => {
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            } as unknown as ReturnType<typeof workspace.getConfiguration>);

            const content = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready
`;
            // Default pattern is **/*epic*.md
            const document = mockDoc(content, '/workspace/test-epic.md');

            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/implementation');
            vi.mocked(workspace.fs.readDirectory).mockResolvedValue([]);

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(1);
        });
    });

    describe('Event handling', () => {
        it('fires event when refresh is called', () => {
            const listener = vi.fn();
            provider.onDidChangeCodeLenses(listener);

            provider.refresh();

            expect(listener).toHaveBeenCalled();
        });

        it('can dispose and cleanup', () => {
            const listener = vi.fn();
            provider.onDidChangeCodeLenses(listener);
            provider.dispose();

            // After dispose, firing should not call listener
            // (or should throw, depending on implementation)
            expect(() => provider.refresh()).not.toThrow();
        });
    });

    describe('resolveCodeLens', () => {
        it('returns the same CodeLens unchanged', () => {
            const range = new Range(new Position(0, 0), new Position(0, 10));
            const codeLens = new CodeLens(range, {
                title: 'Test',
                command: 'test.command'
            });

            const resolved = provider.resolveCodeLens(asCodeLens(codeLens));

            expect(resolved).toBe(asCodeLens(codeLens));
        });
    });

    describe('Edge cases', () => {
        it('handles empty document', async () => {
            const document = mockDoc('', '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('handles document with no stories', async () => {
            const content = `## Epic 1: Test Epic

Just some description without any stories.
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            expect(codeLenses).toHaveLength(0);
        });

        it('handles document with epics but stories have no status', async () => {
            const content = `## Epic 1: Test Epic

### Story 1.1: First Story

No status line here.
`;
            const document = mockDoc(content, '/workspace/epics.md');

            const codeLenses = await provider.provideCodeLenses(document);

            // Story without status is not "ready", so no CodeLens
            expect(codeLenses).toHaveLength(0);
        });
    });
});
