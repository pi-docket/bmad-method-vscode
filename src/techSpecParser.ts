export interface ParsedTechSpecTask {
    taskNumber: string;      // e.g., "1.2"
    taskTitle: string;       // e.g., "Add config helper"
    status: 'done' | 'todo';
    lineNumber: number;      // 0-based line number in file
}

export interface ParsedTechSpecFile {
    filePath: string;         // Absolute path to the file
    tasks: ParsedTechSpecTask[];
}

const TASK_SECTION_HEADER_PATTERN = /^###\s+Tasks\b/;
const TASK_LINE_PATTERN = /^\s*-\s*(?:\[( |x|X)\]\s*)?Task\s+(\d+(?:\.\d+)*)\s*:\s*(.+)\s*$/;

function stripMarkdown(text: string): string {
    let cleaned = text;
    cleaned = cleaned.replace(/\*\*/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    return cleaned.trim();
}

/**
 * Parse tech spec tasks from a markdown file
 * @param text The full text content of the file
 * @param filePath The absolute path to the file
 * @returns ParsedTechSpecFile with tasks from the first ### Tasks section
 */
export function parseTechSpecTasksFromText(text: string, filePath: string): ParsedTechSpecFile {
    const tasks: ParsedTechSpecTask[] = [];

    try {
        const lines = text.split('\n');
        const taskSectionIndices: number[] = [];

        for (let i = 0; i < lines.length; i++) {
            if (TASK_SECTION_HEADER_PATTERN.test(lines[i])) {
                taskSectionIndices.push(i);
            }
        }

        if (taskSectionIndices.length > 1) {
            console.log(`[BMAD] Warning: Multiple ### Tasks sections found in ${filePath}; parsing the first only`);
        }

        if (taskSectionIndices.length === 0) {
            return { filePath, tasks };
        }

        const startIndex = taskSectionIndices[0] + 1;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];

            if (i > startIndex && /^#{1,3}\s+/.test(line)) {
                break;
            }

            const lineForMatch = line.replace(/\*\*/g, '');
            const match = lineForMatch.match(TASK_LINE_PATTERN);
            if (!match) {
                continue;
            }

            const status = match[1] && match[1].toLowerCase() === 'x' ? 'done' : 'todo';
            const taskNumber = match[2];
            const taskTitle = stripMarkdown(match[3]);

            tasks.push({
                taskNumber,
                taskTitle,
                status,
                lineNumber: i
            });
        }
    } catch (error) {
        console.log(`[BMAD] Error parsing file ${filePath}: ${error}`);
    }

    return {
        filePath,
        tasks
    };
}
