/**
 * VS Code API mocks for unit testing
 *
 * This file provides mock implementations of the VS Code API types
 * used by this extension. Import this in tests that need VS Code mocks.
 */

import { vi } from 'vitest';

// Mock Uri class
export class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query: string;
    readonly fragment: string;
    readonly fsPath: string;

    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
        this.fsPath = path;
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    static parse(value: string): Uri {
        // Simple parse - just handle file:// URIs for now
        if (value.startsWith('file://')) {
            return Uri.file(value.slice(7));
        }
        return new Uri('', '', value, '', '');
    }

    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        // Simple path joining - combine base path with segments
        let path = base.path;
        for (const segment of pathSegments) {
            if (path.endsWith('/')) {
                path += segment;
            } else {
                path += '/' + segment;
            }
        }
        return new Uri(base.scheme, base.authority, path, base.query, base.fragment);
    }

    toString(): string {
        return `${this.scheme}://${this.path}`;
    }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment
        );
    }

    toJSON(): unknown {
        return {
            scheme: this.scheme,
            authority: this.authority,
            path: this.path,
            query: this.query,
            fragment: this.fragment,
            fsPath: this.fsPath
        };
    }
}

// Mock Range class
export class Range {
    readonly start: Position;
    readonly end: Position;

    constructor(startLine: number, startChar: number, endLine: number, endChar: number);
    constructor(start: Position, end: Position);
    constructor(startLineOrPos: number | Position, startCharOrEnd: number | Position, endLine?: number, endChar?: number) {
        if (typeof startLineOrPos === 'number') {
            this.start = new Position(startLineOrPos, startCharOrEnd as number);
            this.end = new Position(endLine!, endChar!);
        } else {
            this.start = startLineOrPos;
            this.end = startCharOrEnd as Position;
        }
    }

    get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    get isSingleLine(): boolean {
        return this.start.line === this.end.line;
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Position) {
            return positionOrRange.line >= this.start.line && positionOrRange.line <= this.end.line;
        }
        return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }

    isEqual(other: Range): boolean {
        return this.start.isEqual(other.start) && this.end.isEqual(other.end);
    }

    intersection(other: Range): Range | undefined {
        const start = this.start.isAfter(other.start) ? this.start : other.start;
        const end = this.end.isBefore(other.end) ? this.end : other.end;
        if (start.isAfter(end)) {
            return undefined;
        }
        return new Range(start, end);
    }

    union(other: Range): Range {
        const start = this.start.isBefore(other.start) ? this.start : other.start;
        const end = this.end.isAfter(other.end) ? this.end : other.end;
        return new Range(start, end);
    }

    with(startOrChange?: Position | { start?: Position; end?: Position }, end?: Position): Range {
        if (startOrChange && typeof startOrChange === 'object' && !('line' in startOrChange)) {
            return new Range(startOrChange.start ?? this.start, startOrChange.end ?? this.end);
        }
        return new Range((startOrChange as Position | undefined) ?? this.start, end ?? this.end);
    }
}

// Mock Position class
export class Position {
    readonly line: number;
    readonly character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    isBefore(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character < other.character);
    }

    isAfter(other: Position): boolean {
        return this.line > other.line || (this.line === other.line && this.character > other.character);
    }

    isBeforeOrEqual(other: Position): boolean {
        return this.isBefore(other) || this.isEqual(other);
    }

    isAfterOrEqual(other: Position): boolean {
        return this.isAfter(other) || this.isEqual(other);
    }

    compareTo(other: Position): number {
        if (this.isBefore(other)) return -1;
        if (this.isAfter(other)) return 1;
        return 0;
    }

    translate(lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number }, characterDelta?: number): Position {
        if (typeof lineDeltaOrChange === 'object') {
            return new Position(
                this.line + (lineDeltaOrChange.lineDelta ?? 0),
                this.character + (lineDeltaOrChange.characterDelta ?? 0)
            );
        }
        return new Position(this.line + (lineDeltaOrChange ?? 0), this.character + (characterDelta ?? 0));
    }

    with(lineOrChange?: number | { line?: number; character?: number }, character?: number): Position {
        if (typeof lineOrChange === 'object') {
            return new Position(lineOrChange.line ?? this.line, lineOrChange.character ?? this.character);
        }
        return new Position(lineOrChange ?? this.line, character ?? this.character);
    }
}

// Mock Selection class
export class Selection extends Range {
    readonly anchor: Position;
    readonly active: Position;

    constructor(anchorLine: number, anchorChar: number, activeLine: number, activeChar: number);
    constructor(anchor: Position, active: Position);
    constructor(anchorLineOrPos: number | Position, anchorCharOrActive: number | Position, activeLine?: number, activeChar?: number) {
        if (typeof anchorLineOrPos === 'number') {
            const anchor = new Position(anchorLineOrPos, anchorCharOrActive as number);
            const active = new Position(activeLine!, activeChar!);
            super(anchor, active);
            this.anchor = anchor;
            this.active = active;
        } else {
            super(anchorLineOrPos, anchorCharOrActive as Position);
            this.anchor = anchorLineOrPos;
            this.active = anchorCharOrActive as Position;
        }
    }

    get isReversed(): boolean {
        return this.anchor.isAfter(this.active);
    }
}

// Mock CodeLens class
export class CodeLens {
    range: Range;
    command?: Command;
    readonly isResolved: boolean;

    constructor(range: Range, command?: Command) {
        this.range = range;
        this.command = command;
        this.isResolved = !!command;
    }
}

// Command interface
export interface Command {
    title: string;
    command: string;
    tooltip?: string;
    arguments?: unknown[];
}

// Mock TreeItem class
export class TreeItem {
    label?: string | TreeItemLabel;
    id?: string;
    iconPath?: ThemeIcon | Uri | { light: Uri; dark: Uri };
    description?: string | boolean;
    tooltip?: string | MarkdownString;
    command?: Command;
    collapsibleState?: TreeItemCollapsibleState;
    contextValue?: string;

    constructor(label: string | TreeItemLabel, collapsibleState?: TreeItemCollapsibleState);
    constructor(resourceUri: Uri, collapsibleState?: TreeItemCollapsibleState);
    constructor(labelOrUri: string | TreeItemLabel | Uri, collapsibleState?: TreeItemCollapsibleState) {
        if (labelOrUri instanceof Uri) {
            this.label = labelOrUri.fsPath;
        } else {
            this.label = labelOrUri;
        }
        this.collapsibleState = collapsibleState;
    }
}

export interface TreeItemLabel {
    label: string;
    highlights?: [number, number][];
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}

// Mock ThemeIcon class
export class ThemeIcon {
    static readonly File = new ThemeIcon('file');
    static readonly Folder = new ThemeIcon('folder');

    readonly id: string;
    readonly color?: ThemeColor;

    constructor(id: string, color?: ThemeColor) {
        this.id = id;
        this.color = color;
    }
}

// Mock ThemeColor class
export class ThemeColor {
    readonly id: string;

    constructor(id: string) {
        this.id = id;
    }
}

// Mock MarkdownString class
export class MarkdownString {
    value: string;
    isTrusted?: boolean | { enabledCommands: readonly string[] };
    supportThemeIcons?: boolean;

    constructor(value?: string, supportThemeIcons?: boolean) {
        this.value = value ?? '';
        this.supportThemeIcons = supportThemeIcons;
    }

    appendText(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendMarkdown(value: string): MarkdownString {
        this.value += value;
        return this;
    }

    appendCodeblock(value: string, language?: string): MarkdownString {
        this.value += `\`\`\`${language ?? ''}\n${value}\n\`\`\``;
        return this;
    }
}

// Mock EventEmitter class
export class EventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];

    readonly event = (listener: (e: T) => void): Disposable => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    };

    fire(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }

    dispose(): void {
        this.listeners = [];
    }
}

// Mock Disposable interface
export interface Disposable {
    dispose(): void;
}

// Mock workspace namespace
export const workspace = {
    workspaceFolders: undefined as { uri: Uri; name: string; index: number }[] | undefined,
    getConfiguration: vi.fn((section?: string) => ({
        get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
        has: vi.fn(() => false),
        inspect: vi.fn(),
        update: vi.fn()
    })),
    findFiles: vi.fn(async (_include: unknown, _exclude?: unknown, _maxResults?: number) => [] as Uri[]),
    openTextDocument: vi.fn(),
    createFileSystemWatcher: vi.fn(() => ({
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn()
    })),
    fs: {
        readFile: vi.fn(async (_uri: Uri) => new Uint8Array()),
        readDirectory: vi.fn(async () => [] as [string, number][]),
        stat: vi.fn(),
        writeFile: vi.fn(),
        delete: vi.fn(),
        rename: vi.fn(),
        copy: vi.fn(),
        createDirectory: vi.fn()
    },
    getWorkspaceFolder: vi.fn((uri: Uri) => {
        if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            return workspace.workspaceFolders[0];
        }
        return undefined;
    }),
    asRelativePath: vi.fn((pathOrUri: string | Uri) => {
        const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
        return path;
    }),
    onDidChangeConfiguration: vi.fn((_listener: (e: { affectsConfiguration: (section: string) => boolean }) => unknown) => ({ dispose: vi.fn() }))
};

// Mock window namespace
export const window = {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
    createTreeView: vi.fn(() => ({
        dispose: vi.fn(),
        reveal: vi.fn()
    })),
    createTerminal: vi.fn(() => ({
        name: 'Mock Terminal',
        show: vi.fn(),
        sendText: vi.fn(),
        dispose: vi.fn()
    })),
    terminals: [] as { name: string }[],
    createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        append: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn()
    }))
};

// Mock languages namespace
export const languages = {
    registerCodeLensProvider: vi.fn(() => ({ dispose: vi.fn() })),
    createDiagnosticCollection: vi.fn(() => ({
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        dispose: vi.fn()
    }))
};

// Mock commands namespace
export const commands = {
    registerCommand: vi.fn((_command: string, _callback: (...args: unknown[]) => unknown) => ({ dispose: vi.fn() })),
    executeCommand: vi.fn(async (_command: string, ..._args: unknown[]) => undefined)
};

// EndOfLine enum
export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

// Mock TextDocument interface
export interface TextDocument {
    uri: Uri;
    fileName: string;
    languageId: string;
    version: number;
    isDirty: boolean;
    isClosed: boolean;
    isUntitled: boolean;
    encoding: string;
    eol: EndOfLine;
    lineCount: number;
    getText(range?: Range): string;
    lineAt(line: number): TextLine;
    positionAt(offset: number): Position;
    offsetAt(position: Position): number;
    save(): Promise<boolean>;
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
    validatePosition(position: Position): Position;
    validateRange(range: Range): Range;
}

// Mock TextLine interface
export interface TextLine {
    lineNumber: number;
    text: string;
    range: Range;
    rangeIncludingLineBreak: Range;
    firstNonWhitespaceCharacterIndex: number;
    isEmptyOrWhitespace: boolean;
}

// Text editor reveal type enum
export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3
}

// Helper to create mock TextDocument
// Returns unknown to allow casting to vscode.TextDocument in tests
export function createMockTextDocument(content: string, uriOrPath?: Uri | string): unknown {
    const lines = content.split('\n');
    // Handle both Uri objects and string paths
    const resolvedUri = typeof uriOrPath === 'string' ? Uri.file(uriOrPath) : (uriOrPath ?? Uri.file('/mock/document.md'));
    return {
        uri: resolvedUri,
        fileName: resolvedUri.fsPath,
        languageId: 'markdown',
        version: 1,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        encoding: 'utf8',
        eol: EndOfLine.LF,
        lineCount: lines.length,
        getText: (range?: Range) => {
            if (!range) return content;
            const startLine = range.start.line;
            const endLine = range.end.line;
            return lines.slice(startLine, endLine + 1).join('\n');
        },
        lineAt: (line: number) => ({
            lineNumber: line,
            text: lines[line] ?? '',
            range: new Range(line, 0, line, (lines[line] ?? '').length),
            rangeIncludingLineBreak: new Range(line, 0, line + 1, 0),
            firstNonWhitespaceCharacterIndex: (lines[line] ?? '').search(/\S/),
            isEmptyOrWhitespace: !(lines[line] ?? '').trim()
        }),
        positionAt: (offset: number) => {
            let remaining = offset;
            for (let i = 0; i < lines.length; i++) {
                if (remaining <= lines[i].length) {
                    return new Position(i, remaining);
                }
                remaining -= lines[i].length + 1; // +1 for newline
            }
            return new Position(lines.length - 1, lines[lines.length - 1].length);
        },
        offsetAt: (position: Position) => {
            let offset = 0;
            for (let i = 0; i < position.line; i++) {
                offset += lines[i].length + 1;
            }
            return offset + position.character;
        },
        save: async () => true,
        getWordRangeAtPosition: (_position: Position, _regex?: RegExp) => undefined,
        validatePosition: (position: Position) => position,
        validateRange: (range: Range) => range
    };
}

// Reset all mocks helper
export function resetAllMocks(): void {
    vi.clearAllMocks();
    workspace.workspaceFolders = undefined;
    window.terminals = [];
}

// Default export matching vscode module structure
export default {
    Uri,
    Range,
    Position,
    Selection,
    CodeLens,
    TreeItem,
    TreeItemCollapsibleState,
    ThemeIcon,
    ThemeColor,
    MarkdownString,
    EventEmitter,
    TextEditorRevealType,
    EndOfLine,
    workspace,
    window,
    languages,
    commands,
    createMockTextDocument,
    resetAllMocks
};
