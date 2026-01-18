import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    workspace,
    window,
    Uri,
    TreeItemCollapsibleState,
    ThemeIcon,
    ThemeColor,
    resetAllMocks
} from './mocks/vscode';
import { TechSpecTreeProvider } from '../techSpecTreeProvider';

// Mock the bmadConfig module
vi.mock('../bmadConfig', () => ({
    getImplementationArtifactsPath: vi.fn()
}));

import { getImplementationArtifactsPath } from '../bmadConfig';

describe('techSpecTreeProvider', () => {
    let provider: TechSpecTreeProvider;

    beforeEach(() => {
        resetAllMocks();
        provider = new TechSpecTreeProvider();

        // Default workspace setup
        workspace.workspaceFolders = [
            { uri: Uri.file('/workspace'), name: 'workspace', index: 0 }
        ];
    });

    afterEach(() => {
        provider.dispose();
    });

    describe('5.2.1 - tree item creation from parsed tasks', () => {
        it('creates file tree items from parsed tech spec files', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: First task
- [x] Task 1.2: Second task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/impl/tech-spec-1.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const children = await provider.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].type).toBe('file');
            expect(children[0].filePath).toBe('/workspace/_bmad-output/impl/tech-spec-1.md');
        });

        it('creates task tree items from file children', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: First task
- [x] Task 1.2: Second task
- [ ] Task 1.3: Third task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/impl/tech-spec-1.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);

            expect(tasks).toHaveLength(3);
            expect(tasks[0].type).toBe('task');
            expect(tasks[1].type).toBe('task');
            expect(tasks[2].type).toBe('task');
        });

        it('returns empty array for task children', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: First task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/impl/tech-spec-1.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const taskChildren = await provider.getChildren(tasks[0]);

            expect(taskChildren).toHaveLength(0);
        });

        it('returns empty array when no tech spec files found', async () => {
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([]);

            const children = await provider.getChildren();

            expect(children).toHaveLength(0);
        });

        it('handles multiple tech spec files', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: A task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/_bmad-output/impl/tech-spec-1.md'),
                Uri.file('/workspace/_bmad-output/impl/tech-spec-2.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const children = await provider.getChildren();

            expect(children).toHaveLength(2);
        });
    });

    describe('5.2.2 - config path resolution with fallback', () => {
        it('falls back to VS Code setting when config path is null', async () => {
            const freshProvider = new TechSpecTreeProvider();
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue(null);
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn(() => '**/custom-tech-spec-*.md'),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            });

            await freshProvider.getChildren();

            expect(workspace.findFiles).toHaveBeenCalledWith('**/custom-tech-spec-*.md');
            expect(window.showWarningMessage).not.toHaveBeenCalled();

            freshProvider.dispose();
        });

        it('uses default pattern when config setting is missing', async () => {
            const freshProvider = new TechSpecTreeProvider();
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue(null);
            vi.mocked(workspace.getConfiguration).mockReturnValue({
                get: vi.fn((_key, defaultValue) => defaultValue),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            });

            await freshProvider.getChildren();

            expect(workspace.findFiles).toHaveBeenCalledWith('**/tech-spec-*.md');

            freshProvider.dispose();
        });

        it('uses implementation_artifacts path from config', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: A task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('custom/impl/path');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/custom/impl/path/tech-spec-1.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            await provider.getChildren();

            // Verify findFiles was called with the correct pattern
            expect(workspace.findFiles).toHaveBeenCalledWith('custom/impl/path/**/tech-spec-*.md');
        });

        it('handles error when findFiles fails', async () => {
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockRejectedValue(new Error('Workspace error'));

            const children = await provider.getChildren();

            expect(children).toHaveLength(0);
        });
    });

    describe('5.2.3 - checkbox status display', () => {
        it('assigns check icon with green color for done tasks', async () => {
            const techSpecContent = `### Tasks

- [x] Task 1.1: Done task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('check');
            expect(icon.color).toBeInstanceOf(ThemeColor);
            expect((icon.color as ThemeColor).id).toBe('charts.green');
        });

        it('assigns play icon for todo tasks', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Todo task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('play');
        });

        it('assigns file-text icon for file items', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: A task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const treeItem = provider.getTreeItem(files[0]);

            const icon = treeItem.iconPath as ThemeIcon;
            expect(icon.id).toBe('file-text');
        });
    });

    describe('5.2.4 - reveal command arguments', () => {
        it('sets revealTask command on task items', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            expect(treeItem.command).toBeDefined();
            expect(treeItem.command?.command).toBe('bmadMethod.revealTask');
        });

        it('passes file path as first argument', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            const filePath = '/workspace/_bmad-output/impl/tech-spec-story.md';
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file(filePath)
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            expect(treeItem.command?.arguments?.[0]).toBe(filePath);
        });

        it('passes line number as second argument', async () => {
            const techSpecContent = `# Tech Spec

## Overview

Description here.

### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            // Line number should be present and be a number
            expect(typeof treeItem.command?.arguments?.[1]).toBe('number');
        });

        it('does not set command on file items', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const treeItem = provider.getTreeItem(files[0]);

            expect(treeItem.command).toBeUndefined();
        });
    });

    describe('getTreeItem', () => {
        it('sets tooltip for file items', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            const filePath = '/workspace/tech-spec.md';
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file(filePath)
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const treeItem = provider.getTreeItem(files[0]);

            expect(treeItem.tooltip).toBe(filePath);
        });

        it('sets tooltip with status for task items', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            expect(treeItem.tooltip).toBe('Task 1.1: Test task (todo)');
        });

        it('sets correct tooltip for done task', async () => {
            const techSpecContent = `### Tasks

- [x] Task 1.1: Completed task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);
            const treeItem = provider.getTreeItem(tasks[0]);

            expect(treeItem.tooltip).toBe('Task 1.1: Completed task (done)');
        });
    });

    describe('collapsible state', () => {
        it('file items are expanded by default', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();

            expect(files[0].collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
        });

        it('task items are not collapsible', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/tech-spec.md')
            ]);
            vi.mocked(workspace.fs.readFile).mockResolvedValue(
                new TextEncoder().encode(techSpecContent)
            );

            const files = await provider.getChildren();
            const tasks = await provider.getChildren(files[0]);

            expect(tasks[0].collapsibleState).toBe(TreeItemCollapsibleState.None);
        });
    });

    describe('refresh and dispose', () => {
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

        it('debounces refresh calls', async () => {
            vi.useFakeTimers();

            const eventFired = vi.fn();
            provider.onDidChangeTreeData(eventFired);

            // Multiple rapid refreshes
            provider.refresh();
            provider.refresh();
            provider.refresh();

            // Advance past debounce
            vi.advanceTimersByTime(400);

            // Should only fire once
            expect(eventFired).toHaveBeenCalledTimes(1);

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

    describe('error handling', () => {
        it('continues processing when one file fails to read', async () => {
            const techSpecContent = `### Tasks

- [ ] Task 1.1: Test task
`;
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/bad-file.md'),
                Uri.file('/workspace/good-file.md')
            ]);

            // First file fails, second succeeds
            vi.mocked(workspace.fs.readFile)
                .mockRejectedValueOnce(new Error('Permission denied'))
                .mockResolvedValueOnce(new TextEncoder().encode(techSpecContent));

            const children = await provider.getChildren();

            // Should still have one file (the good one)
            expect(children).toHaveLength(1);
        });

        it('returns empty array when all files fail to read', async () => {
            vi.mocked(getImplementationArtifactsPath).mockResolvedValue('_bmad-output/impl');
            vi.mocked(workspace.findFiles).mockResolvedValue([
                Uri.file('/workspace/bad-file1.md'),
                Uri.file('/workspace/bad-file2.md')
            ]);

            vi.mocked(workspace.fs.readFile)
                .mockRejectedValue(new Error('Permission denied'));

            const children = await provider.getChildren();

            expect(children).toHaveLength(0);
        });
    });
});
