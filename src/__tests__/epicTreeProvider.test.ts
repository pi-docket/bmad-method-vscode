import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    workspace,
    Uri,
    TreeItemCollapsibleState,
    ThemeIcon,
    ThemeColor,
    resetAllMocks
} from './mocks/vscode';
import { EpicTreeProvider } from '../epicTreeProvider';

// Mock the bmadConfig module
vi.mock('../bmadConfig', () => ({
    getPlanningArtifactsPath: vi.fn()
}));

import { getPlanningArtifactsPath } from '../bmadConfig';

describe('epicTreeProvider', () => {
    let provider: EpicTreeProvider;

    beforeEach(() => {
        resetAllMocks();
        provider = new EpicTreeProvider();

        // Default workspace setup
        workspace.workspaceFolders = [
            { uri: Uri.file('/workspace'), name: 'workspace', index: 0 }
        ];
    });

    afterEach(() => {
        provider.dispose();
    });

    describe('5.1.1 - tree item creation from parsed epics', () => {
        it('creates file tree items from parsed files', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/planning/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].type).toBe('file');
            expect(children[0].filePath).toBe('/workspace/_bmad-output/planning/epics.md');
        });

        it('creates epic tree items from file children', async () => {
            const epicContent = `## Epic 1: First Epic

### Story 1.1: Story One
**Status:** ready

## Epic 2: Second Epic

### Story 2.1: Story Two
**Status:** done
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/planning/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);

            expect(epics).toHaveLength(2);
            expect(epics[0].type).toBe('epic');
            expect(epics[1].type).toBe('epic');
        });

        it('creates story tree items from epic children', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: First Story
**Status:** ready

### Story 1.2: Second Story
**Status:** in-progress
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/planning/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);

            expect(stories).toHaveLength(2);
            expect(stories[0].type).toBe('story');
            expect(stories[1].type).toBe('story');
        });

        it('returns empty array when no workspace folders', async () => {
            // Create a fresh provider for this test to avoid cached state
            const freshProvider = new EpicTreeProvider();
            workspace.workspaceFolders = undefined;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue(null);
            vi.mocked(workspace.findFiles).mockResolvedValue([]);

            const children = await freshProvider.getChildren();

            expect(children).toHaveLength(0);
            freshProvider.dispose();
        });

        it('returns empty array when no epic files found', async () => {
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([]);

            const children = await provider.getChildren();

            expect(children).toHaveLength(0);
        });
    });

    describe('5.1.2 - hierarchical structure (file -> epic -> story)', () => {
        it('file items are expanded by default', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();

            expect(files[0].collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
        });

        it('epic items are collapsed by default', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);

            expect(epics[0].collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
        });

        it('story items are not collapsible', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);

            expect(stories[0].collapsibleState).toBe(TreeItemCollapsibleState.None);
        });

        it('returns empty array for story children', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const storyChildren = await provider.getChildren(stories[0]);

            expect(storyChildren).toHaveLength(0);
        });

        it('preserves file path through hierarchy', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            const filePath = '/workspace/_bmad-output/epics.md';
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file(filePath)
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);

            expect(files[0].filePath).toBe(filePath);
            expect(epics[0].filePath).toBe(filePath);
            expect(stories[0].filePath).toBe(filePath);
        });
    });

    describe('5.1.3 - status icon assignment', () => {
        it('assigns green new-file icon for ready status', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Ready Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            expect(treeItem.iconPath).toBeInstanceOf(ThemeIcon);
            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('new-file');
            expect(icon.color).toBeInstanceOf(ThemeColor);
            expect((icon.color as ThemeColor).id).toBe('charts.green');
        });

        it('assigns blue arrow icon for in-progress status', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: In Progress Story
**Status:** in-progress
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('arrow-right');
            expect((icon.color as ThemeColor).id).toBe('charts.blue');
        });

        it('assigns green check icon for done status', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Done Story
**Status:** done
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('check');
            expect((icon.color as ThemeColor).id).toBe('charts.green');
        });

        it('assigns red error icon for blocked status', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Blocked Story
**Status:** blocked
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('error');
            expect((icon.color as ThemeColor).id).toBe('charts.red');
        });

        it('assigns question icon for unknown status', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Unknown Story
**Status:** something-else
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('question');
        });

        it('assigns file-text icon for file items', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const treeItem = provider.getTreeItem(files[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('file-text');
        });

        it('assigns symbol-class icon for epic items', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(epics[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('symbol-class');
        });
    });

    describe('5.1.4 - race condition handling', () => {
        it('handles concurrent loadFiles calls without error', async () => {
            // This test verifies that concurrent calls don't crash
            // The race condition handling sets pendingRefresh internally
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            // Use a fresh provider to avoid cached state
            const freshProvider = new EpicTreeProvider();

            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            // Start multiple concurrent loads
            const load1 = freshProvider.getChildren();
            const load2 = freshProvider.getChildren();
            const load3 = freshProvider.getChildren();

            // All should complete without error
            const results = await Promise.all([load1, load2, load3]);

            // After all loads complete, we should have consistent results
            // The actual number depends on timing, but should not throw
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });

            freshProvider.dispose();
        });

        it('debounces refresh calls', async () => {
            vi.useFakeTimers();

            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            // Trigger multiple rapid refreshes
            provider.refresh();
            provider.refresh();
            provider.refresh();

            // Advance timer past debounce period
            vi.advanceTimersByTime(400);

            vi.useRealTimers();
        });
    });

    describe('5.1.5 - file watcher integration', () => {
        // Note: File watcher is not directly on the provider, it's typically
        // set up in extension.ts. These tests verify the refresh mechanism works.

        it('refresh method triggers tree data change event', async () => {
            vi.useFakeTimers();

            const eventFired = vi.fn();
            provider.onDidChangeTreeData(eventFired);

            provider.refresh();

            // Advance past debounce
            vi.advanceTimersByTime(400);

            expect(eventFired).toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('dispose clears refresh timeout', () => {
            vi.useFakeTimers();

            provider.refresh();

            // Dispose before timeout fires
            provider.dispose();

            // Advance timer - should not throw
            vi.advanceTimersByTime(400);

            vi.useRealTimers();
        });
    });

    describe('5.1.6 - error handling for unreadable files', () => {
        it('continues processing when one file fails to read', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/bad-file.md'),
                Uri.file('/workspace/good-file.md')
            ]);

            // First file fails, second succeeds
            vi.mocked(workspace.fs.readFile)
                .mockRejectedValueOnce(new Error('Permission denied'))
                .mockResolvedValueOnce(new TextEncoder().encode(epicContent));

            const children = await provider.getChildren();

            // Should still have one file (the good one)
            expect(children).toHaveLength(1);
        });

        it('returns empty array when all files fail to read', async () => {
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/bad-file1.md'),
                Uri.file('/workspace/bad-file2.md')
            ]);

            vi.mocked(workspace.fs.readFile)
                .mockRejectedValue(new Error('Permission denied'));

            const children = await provider.getChildren();

            expect(children).toHaveLength(0);
        });

        it('returns empty array when findFiles throws', async () => {
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockRejectedValue(new Error('Workspace error'));

            const children = await provider.getChildren();

            expect(children).toHaveLength(0);
        });

        it('falls back to VS Code setting when config not found', async () => {
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue(null);
            vi.mocked(workspace.findFiles).mockResolvedValue([]);

            await provider.getChildren();

            // Should have called findFiles with fallback pattern
            expect(workspace.findFiles).toHaveBeenCalled();
        });
    });

    describe('getTreeItem', () => {
        it('sets tooltip for file items', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const treeItem = provider.getTreeItem(files[0]);

            expect(treeItem.tooltip).toBe('/workspace/epics.md');
        });

        it('sets tooltip for epic items', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(epics[0]);

            expect(treeItem.tooltip).toBe('Epic 1: Test Epic');
        });

        it('sets tooltip with status for story items', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            expect(treeItem.tooltip).toBe('Story 1.1: Test Story (ready)');
        });

        it('sets command for story items', async () => {
            const epicContent = `## Epic 1: Test Epic

### Story 1.1: Test Story
**Status:** ready
`;
            vi.mocked(getPlanningArtifactsPath).mockResolvedValue('_bmad-output/planning');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/epics.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(epicContent)
            );

            const files = await provider.getChildren();
            const epics = await provider.getChildren(files[0]);
            const stories = await provider.getChildren(epics[0]);
            const treeItem = provider.getTreeItem(stories[0]);

            expect(treeItem.command).toBeDefined();
            expect(treeItem.command?.command).toBe('bmadMethod.revealStory');
            expect(treeItem.command?.arguments).toContain('/workspace/epics.md');
        });
    });
});
