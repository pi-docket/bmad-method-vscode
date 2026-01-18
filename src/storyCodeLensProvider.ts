import * as vscode from 'vscode';
import * as path from 'path';
import { parseEpicsFromText, ParsedStory } from './epicsParser';
import { getImplementationArtifactsPath } from './bmadConfig';

interface StoryInfo {
    storyNumber: string;
    storyTitle: string;
    status: string;
    line: vscode.TextLine;
}

export class StoryCodeLensProvider extends vscode.EventEmitter<void> implements vscode.CodeLensProvider {

    onDidChangeCodeLenses: vscode.Event<void> = this.event;

    refresh(): void {
        this.fire();
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const config = vscode.workspace.getConfiguration('bmad');
        const enableCodeLens = config.get<boolean>('enableCodeLens', true);

        if (!enableCodeLens) {
            return [];
        }

        if (!this.isEpicFile(document)) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const stories = this.parseStories(document);

        for (const story of stories) {
            const codeLens = await this.createCodeLensForStory(story, document);
            if (codeLens) {
                codeLenses.push(codeLens);
            }
        }

        return codeLenses;
    }

    private parseStories(document: vscode.TextDocument): StoryInfo[] {
        const text = document.getText();
        const parsed = parseEpicsFromText(text, document.uri.fsPath);

        // Flatten all stories from all epics and convert to StoryInfo with TextLine
        const stories: StoryInfo[] = [];
        for (const epic of parsed.epics) {
            for (const story of epic.stories) {
                const line = document.lineAt(story.lineNumber);
                stories.push({
                    storyNumber: story.storyNumber,
                    storyTitle: story.storyTitle,
                    status: story.status,
                    line
                });
            }
        }

        return stories;
    }

    private async createCodeLensForStory(story: StoryInfo, document: vscode.TextDocument): Promise<vscode.CodeLens | null> {
        const { storyNumber, storyTitle, status, line } = story;

        // Only show CodeLens for "ready" status
        if (status !== 'ready') {
            return null;
        }

        const storyFileExists = await this.checkStoryFileExists(storyNumber, document);

        if (storyFileExists) {
            // Story file exists and status is ready -> Start Developing
            return new vscode.CodeLens(line.range, {
                title: '$(play) Start Developing Story',
                tooltip: `Run dev-story workflow for ${storyNumber}: ${storyTitle}`,
                command: 'bmadMethod.developStory',
                arguments: [storyNumber]
            });
        } else {
            // Status is ready but no story file -> Create Story
            return new vscode.CodeLens(line.range, {
                title: '$(new-file) Create Story',
                tooltip: `Create story file for ${storyNumber}: ${storyTitle}`,
                command: 'bmadMethod.createStory',
                arguments: [storyNumber]
            });
        }
    }

    private async checkStoryFileExists(storyNumber: string, document: vscode.TextDocument): Promise<boolean> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            console.log(`[BMAD] No workspace folder for document: ${document.uri.fsPath}`);
            return false;
        }

        const implementationPath = await getImplementationArtifactsPath();
        if (!implementationPath) {
            console.log(`[BMAD] No implementation_artifacts path configured`);
            return false;
        }

        const artifactsUri = vscode.Uri.joinPath(workspaceFolder.uri, implementationPath);
        // Story files use dashes (1-1) but headers use dots (1.1)
        const storyNumberWithDashes = storyNumber.replace(/\./g, '-');
        const pattern = `${storyNumberWithDashes}*.md`;

        console.log(`[BMAD] Checking for story ${storyNumber} in: ${artifactsUri.fsPath}`);
        console.log(`[BMAD] Pattern: ${pattern}`);

        try {
            const entries = await vscode.workspace.fs.readDirectory(artifactsUri);
            const files = entries.map(([name]) => name);
            console.log(`[BMAD] Files found: ${JSON.stringify(files)}`);
            // Simple glob match: pattern is "{number}*.md", check if file starts with the number prefix
            const prefix = storyNumberWithDashes;
            const match = files.some(file => file.startsWith(prefix) && file.endsWith('.md'));
            console.log(`[BMAD] Match result: ${match}`);
            return match;
        } catch (error: unknown) {
            console.log(`[BMAD] Error reading directory: ${error}`);
            return false;
        }
    }

    resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens {
        return codeLens;
    }

    private isEpicFile(document: vscode.TextDocument): boolean {
        const config = vscode.workspace.getConfiguration('bmad');
        const pattern = config.get<string>('epicFilePattern', '**/*epic*.md');
        const fileName = path.basename(document.fileName).toLowerCase();

        // Extract just the filename pattern from the glob (e.g., "*epic*.md" from "**/*epic*.md")
        const filePattern = pattern.split('/').pop() || pattern;

        // Convert simple glob pattern to regex
        // Supports: * (any chars), ? (single char)
        const regexPattern = filePattern
            .toLowerCase()
            .replace(/\*+/g, '*')                   // Collapse consecutive * to prevent ReDoS
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars except * and ?
            .replace(/\*/g, '.*')                   // * -> .*
            .replace(/\?/g, '.');                   // ? -> .

        return new RegExp(`^${regexPattern}$`).test(fileName);
    }
}
