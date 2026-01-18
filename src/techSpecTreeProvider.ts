import * as vscode from 'vscode';
import {
    ParsedTechSpecFile,
    ParsedTechSpecTask,
    parseTechSpecTasksFromText
} from './techSpecParser';
import { getImplementationArtifactsPath } from './bmadConfig';

type TreeNodeType = 'file' | 'task';

class TechSpecTreeItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeNodeType,
        public readonly data: ParsedTechSpecFile | ParsedTechSpecTask,
        public readonly filePath: string,
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
    }
}

export class TechSpecTreeProvider implements vscode.TreeDataProvider<TechSpecTreeItem>, vscode.Disposable {
    private _onDidChangeTreeData = new vscode.EventEmitter<TechSpecTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private parsedFiles: ParsedTechSpecFile[] = [];
    private isLoading = false;
    private refreshTimeout: NodeJS.Timeout | undefined;

    dispose(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = undefined;
        }
        this._onDidChangeTreeData.dispose();
    }

    refresh(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
            this._onDidChangeTreeData.fire();
            this.refreshTimeout = undefined;
        }, 300);
    }

    async getChildren(element?: TechSpecTreeItem): Promise<TechSpecTreeItem[]> {
        if (!element) {
            await this.loadFiles();
            return this.parsedFiles.map(file => {
                const fileUri = vscode.Uri.file(file.filePath);
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
                const relativePath = workspaceFolder
                    ? vscode.workspace.asRelativePath(fileUri)
                    : file.filePath;

                return new TechSpecTreeItem(
                    'file',
                    file,
                    file.filePath,
                    relativePath,
                    vscode.TreeItemCollapsibleState.Expanded
                );
            });
        }

        if (element.type === 'file') {
            const file = element.data as ParsedTechSpecFile;
            return file.tasks.map(task => {
                return new TechSpecTreeItem(
                    'task',
                    task,
                    element.filePath,
                    `Task ${task.taskNumber}: ${task.taskTitle}`,
                    vscode.TreeItemCollapsibleState.None
                );
            });
        }

        return [];
    }

    getTreeItem(element: TechSpecTreeItem): vscode.TreeItem {
        const item = element;

        if (element.type === 'file') {
            item.iconPath = new vscode.ThemeIcon('file-text');
            item.tooltip = element.filePath;
        } else if (element.type === 'task') {
            const task = element.data as ParsedTechSpecTask;
            item.iconPath = this.getTaskIcon(task.status);
            item.tooltip = `Task ${task.taskNumber}: ${task.taskTitle} (${task.status})`;
            item.command = {
                command: 'bmadMethod.revealTask',
                title: 'Reveal Task',
                arguments: [element.filePath, task.lineNumber]
            };
        }

        return item;
    }

    private getTaskIcon(status: 'done' | 'todo'): vscode.ThemeIcon {
        if (status === 'done') {
            return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }

        return new vscode.ThemeIcon('play');
    }

    private async loadFiles(): Promise<void> {
        if (this.isLoading) {
            return;
        }

        this.isLoading = true;

        try {
            const implementationPath = await getImplementationArtifactsPath();
            let pattern: string;

            if (implementationPath) {
                pattern = `${implementationPath}/**/tech-spec-*.md`;
                console.log(`[BMAD] Using implementation_artifacts path from config: ${implementationPath}`);
            } else {
                const config = vscode.workspace.getConfiguration('bmad');
                pattern = config.get<string>('techSpecFilePattern', '**/tech-spec-*.md');
                console.log(`[BMAD] No BMAD config found, using VS Code setting`);
            }

            try {
                const files = await vscode.workspace.findFiles(pattern);
                console.log(`[BMAD] Found ${files.length} tech spec files matching pattern: ${pattern}`);

                this.parsedFiles = [];

                for (const fileUri of files) {
                    try {
                        const content = await vscode.workspace.fs.readFile(fileUri);
                        const text = Buffer.from(content).toString('utf8');
                        const parsed = parseTechSpecTasksFromText(text, fileUri.fsPath);
                        this.parsedFiles.push(parsed);
                    } catch (error) {
                        console.log(`[BMAD] Error parsing file ${fileUri.fsPath}: ${error}`);
                    }
                }
            } catch (error) {
                console.log(`[BMAD] Error finding tech spec files: ${error}`);
                this.parsedFiles = [];
            }
        } finally {
            this.isLoading = false;
        }
    }
}
