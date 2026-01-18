import * as vscode from 'vscode';
import { ParsedFile, ParsedEpic, ParsedStory, parseEpicsFromText } from './epicsParser';
import { getPlanningArtifactsPath } from './bmadConfig';

type TreeNodeType = 'file' | 'epic' | 'story';

class EpicTreeItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeNodeType,
        public readonly data: ParsedFile | ParsedEpic | ParsedStory,
        public readonly filePath: string,
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
    }
}

export class EpicTreeProvider implements vscode.TreeDataProvider<EpicTreeItem>, vscode.Disposable {
    private _onDidChangeTreeData = new vscode.EventEmitter<EpicTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private parsedFiles: ParsedFile[] = [];
    private isLoading = false;
    private pendingRefresh = false;
    private refreshTimeout: NodeJS.Timeout | undefined;

    dispose(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = undefined;
        }
        this._onDidChangeTreeData.dispose();
    }

    refresh(): void {
        // Debounce refresh to prevent rapid re-parsing
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
            this._onDidChangeTreeData.fire();
            this.refreshTimeout = undefined;
        }, 300);
    }

    async getChildren(element?: EpicTreeItem): Promise<EpicTreeItem[]> {
        if (!element) {
            // Root level: return files
            await this.loadFiles();
            return this.parsedFiles.map(file => {
                const fileUri = vscode.Uri.file(file.filePath);
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
                const relativePath = workspaceFolder
                    ? vscode.workspace.asRelativePath(fileUri)
                    : file.filePath;

                return new EpicTreeItem(
                    'file',
                    file,
                    file.filePath,
                    relativePath,
                    vscode.TreeItemCollapsibleState.Expanded
                );
            });
        }

        if (element.type === 'file') {
            // File level: return epics
            const file = element.data as ParsedFile;
            return file.epics.map(epic => {
                return new EpicTreeItem(
                    'epic',
                    epic,
                    element.filePath,
                    `Epic ${epic.epicNumber}: ${epic.epicTitle}`,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
            });
        }

        if (element.type === 'epic') {
            // Epic level: return stories
            const epic = element.data as ParsedEpic;
            return epic.stories.map(story => {
                return new EpicTreeItem(
                    'story',
                    story,
                    element.filePath,
                    `Story ${story.storyNumber}: ${story.storyTitle}`,
                    vscode.TreeItemCollapsibleState.None
                );
            });
        }

        return [];
    }

    getTreeItem(element: EpicTreeItem): vscode.TreeItem {
        const item = element;

        // Set icons based on type
        if (element.type === 'file') {
            item.iconPath = new vscode.ThemeIcon('file-text');
            item.tooltip = element.filePath;
        } else if (element.type === 'epic') {
            const epic = element.data as ParsedEpic;
            item.iconPath = new vscode.ThemeIcon('symbol-class');
            item.tooltip = `Epic ${epic.epicNumber}: ${epic.epicTitle}`;
        } else if (element.type === 'story') {
            const story = element.data as ParsedStory;

            // Set icon and color based on status
            const iconInfo = this.getStoryIcon(story.status);
            item.iconPath = iconInfo.icon;
            item.tooltip = `Story ${story.storyNumber}: ${story.storyTitle} (${story.status})`;

            // Set command for click-to-reveal
            item.command = {
                command: 'bmadMethod.revealStory',
                title: 'Reveal Story',
                arguments: [element.filePath, story.lineNumber]
            };
        }

        return item;
    }

    private getStoryIcon(status: string): { icon: vscode.ThemeIcon } {
        switch (status) {
            case 'ready':
                return { icon: new vscode.ThemeIcon('new-file', new vscode.ThemeColor('charts.green')) };
            case 'in-progress':
                return { icon: new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('charts.blue')) };
            case 'done':
                return { icon: new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green')) };
            case 'blocked':
                return { icon: new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')) };
            default:
                return { icon: new vscode.ThemeIcon('question') };
        }
    }

    private async loadFiles(): Promise<void> {
        // If already loading, mark that a refresh is pending
        if (this.isLoading) {
            this.pendingRefresh = true;
            return;
        }

        this.isLoading = true;

        try {
            // Get planning_artifacts path from BMAD config, fall back to VS Code setting
            const planningPath = await getPlanningArtifactsPath();
            let pattern: string;

            if (planningPath) {
                // Scope search to the planning artifacts directory
                pattern = `${planningPath}/**/*epic*.md`;
                console.log(`[BMAD] Using planning_artifacts path from config: ${planningPath}`);
            } else {
                // Fall back to VS Code setting if config not found
                const config = vscode.workspace.getConfiguration('bmad');
                pattern = config.get<string>('epicFilePattern', '**/*epic*.md');
                console.log(`[BMAD] No BMAD config found, using VS Code setting`);
            }

            try {
                const files = await vscode.workspace.findFiles(pattern);
                console.log(`[BMAD] Found ${files.length} epics files matching pattern: ${pattern}`);

                this.parsedFiles = [];

                for (const fileUri of files) {
                    try {
                        const content = await vscode.workspace.fs.readFile(fileUri);
                        const text = Buffer.from(content).toString('utf8');
                        const parsed = parseEpicsFromText(text, fileUri.fsPath);
                        this.parsedFiles.push(parsed);
                    } catch (error: unknown) {
                        console.log(`[BMAD] Error parsing file ${fileUri.fsPath}: ${error}`);
                        // Continue with other files - graceful degradation
                    }
                }
            } catch (error: unknown) {
                console.log(`[BMAD] Error finding epics files: ${error}`);
                this.parsedFiles = [];
            }
        } finally {
            this.isLoading = false;
            // If a refresh was requested while loading, trigger another load
            if (this.pendingRefresh) {
                this.pendingRefresh = false;
                await this.loadFiles();
            }
        }
    }
}
