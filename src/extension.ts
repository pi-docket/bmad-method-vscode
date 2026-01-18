import * as vscode from 'vscode';
import { StoryCodeLensProvider } from './storyCodeLensProvider';
import { EpicTreeProvider } from './epicTreeProvider';
import { TechSpecTreeProvider } from './techSpecTreeProvider';
import { execFile } from 'child_process';
import {
    buildCliCommand,
    getWhichCommand,
    isSafeCliTool,
    normalizeCliTool
} from './cliTool';
import { getImplementationArtifactsPath } from './bmadConfig';

let cliChecked = false;
let cliAvailable = true;

export function activate(context: vscode.ExtensionContext) {
    const provider = new StoryCodeLensProvider();

    // Register CodeLens provider for markdown files
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: 'markdown', scheme: 'file' },
            provider
        )
    );

    // Register TreeView provider
    const treeProvider = new EpicTreeProvider();
    const treeView = vscode.window.createTreeView('bmadStories', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView, treeProvider);

    // Register Tech Specs TreeView provider
    const techSpecProvider = new TechSpecTreeProvider();
    const techSpecView = vscode.window.createTreeView('bmadTechSpecs', {
        treeDataProvider: techSpecProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(techSpecView, techSpecProvider);

    // Register the create story command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bmadMethod.createStory',
            (storyNumber: string) => {
                executeInTerminal(storyNumber, 'create-story');
            }
        )
    );

    // Register the develop story command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bmadMethod.developStory',
            (storyNumber: string) => {
                executeInTerminal(storyNumber, 'dev-story');
            }
        )
    );

    // Register the refresh stories command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bmadMethod.refreshStories',
            () => {
                treeProvider.refresh();
            }
        )
    );

    // Register the refresh tech specs command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bmadMethod.refreshTechSpecs',
            () => {
                techSpecProvider.refresh();
            }
        )
    );

    // Register the reveal story command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bmadMethod.revealStory',
            async (filePath: string, lineNumber: number) => {
                try {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    const editor = await vscode.window.showTextDocument(document);

                    // Validate lineNumber is within document bounds
                    if (lineNumber < 0 || lineNumber >= document.lineCount) {
                        vscode.window.showWarningMessage(`Story line ${lineNumber + 1} not found in file (file may have been edited)`);
                        return;
                    }

                    const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                } catch (error: unknown) {
                    vscode.window.showErrorMessage(`Failed to open story: ${error}`);
                }
            }
        )
    );

    // Register the reveal task command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'bmadMethod.revealTask',
            async (filePath: string, lineNumber: number) => {
                try {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    const editor = await vscode.window.showTextDocument(document);

                    if (lineNumber < 0 || lineNumber >= document.lineCount) {
                        vscode.window.showWarningMessage(`Task line ${lineNumber + 1} not found in file (file may have been edited)`);
                        return;
                    }

                    const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                } catch (error: unknown) {
                    vscode.window.showErrorMessage(`Failed to open task: ${error}`);
                }
            }
        )
    );

    // FileSystemWatcher for auto-refresh of TreeView
    let watcher: vscode.FileSystemWatcher | undefined;
    let techSpecWatcher: vscode.FileSystemWatcher | undefined;
    let configWatcher: vscode.FileSystemWatcher | undefined;

    const createWatcher = () => {
        // Dispose old watcher if exists
        if (watcher) {
            watcher.dispose();
        }

        const config = vscode.workspace.getConfiguration('bmad');
        const pattern = config.get<string>('epicFilePattern', '**/*epic*.md');
        watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidChange(() => treeProvider.refresh());
        watcher.onDidCreate(() => treeProvider.refresh());
        watcher.onDidDelete(() => treeProvider.refresh());

        context.subscriptions.push(watcher);
    };

    createWatcher();

    const createTechSpecWatcher = async () => {
        if (techSpecWatcher) {
            techSpecWatcher.dispose();
        }

        const implementationPath = await getImplementationArtifactsPath();
        const config = vscode.workspace.getConfiguration('bmad');
        const pattern = implementationPath
            ? `${implementationPath}/**/tech-spec-*.md`
            : config.get<string>('techSpecFilePattern', '**/tech-spec-*.md');

        techSpecWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        techSpecWatcher.onDidChange(() => techSpecProvider.refresh());
        techSpecWatcher.onDidCreate(() => techSpecProvider.refresh());
        techSpecWatcher.onDidDelete(() => techSpecProvider.refresh());

        context.subscriptions.push(techSpecWatcher);
    };

    const createConfigWatcher = () => {
        if (configWatcher) {
            configWatcher.dispose();
        }

        configWatcher = vscode.workspace.createFileSystemWatcher('_bmad/bmm/config.yaml');
        const onConfigChange = () => {
            techSpecProvider.refresh();
            createTechSpecWatcher().catch(() => {
                // Silently ignore - watcher is optional enhancement
            });
        };

        configWatcher.onDidChange(onConfigChange);
        configWatcher.onDidCreate(onConfigChange);
        configWatcher.onDidDelete(onConfigChange);

        context.subscriptions.push(configWatcher);
    };

    createTechSpecWatcher().catch(() => {
        // Silently ignore - watcher is optional enhancement
    });
    createConfigWatcher();

    // Listen for configuration changes to refresh CodeLens and TreeView
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('bmad')) {
                provider.refresh();
                treeProvider.refresh();
                techSpecProvider.refresh();

                // Recreate watcher if pattern changed
                if (event.affectsConfiguration('bmad.epicFilePattern')) {
                    createWatcher();
                }
                if (event.affectsConfiguration('bmad.techSpecFilePattern')) {
                    createTechSpecWatcher().catch(() => {
                        // Silently ignore - watcher is optional enhancement
                    });
                }

                if (event.affectsConfiguration('bmad.cliTool')) {
                    cliChecked = false;
                }
            }
        })
    );
}

async function executeInTerminal(storyNumber: string | undefined, workflow: 'create-story' | 'dev-story'): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const config = vscode.workspace.getConfiguration('bmad');
    const cliTool = normalizeCliTool(config.get<string>('cliTool'));

    if (!workspaceFolder) {
        vscode.window.showErrorMessage(
            'No workspace folder open. Please open a folder to execute stories.'
        );
        return;
    }

    if (!isSafeCliTool(cliTool)) {
        vscode.window.showErrorMessage(
            `Invalid CLI tool name "${cliTool}". Use a simple tool name or path without shell metacharacters.`
        );
        return;
    }

    // Check for CLI availability on first invocation
    if (!cliChecked) {
        cliChecked = true;
        cliAvailable = await checkCliAvailable(cliTool);
        if (!cliAvailable) {
            vscode.window.showWarningMessage(
                `CLI tool "${cliTool}" not found on PATH. Update bmad.cliTool or install the tool.`
            );
        }
    }

    const terminalName = storyNumber ? `Story ${storyNumber}` : `BMAD ${workflow}`;

    // Check if terminal with this name already exists
    let terminal = vscode.window.terminals.find(t => t.name === terminalName);

    if (!terminal) {
        terminal = vscode.window.createTerminal({
            name: terminalName,
            cwd: workspaceFolder
        });
    }

    terminal.show();
    const command = buildCliCommand(cliTool, workflow, storyNumber);
    terminal.sendText(command);
}

function checkCliAvailable(toolName: string): Promise<boolean> {
    return new Promise((resolve) => {
        const { cmd, args } = getWhichCommand(process.platform, toolName);

        execFile(cmd, args, (error) => {
            resolve(!error);
        });
    });
}

export function deactivate() {}
