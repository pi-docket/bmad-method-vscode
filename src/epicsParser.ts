// Shared parsing interfaces and functions for epics.md files
// VS Code-agnostic - can be used by both TreeProvider and CodeLensProvider

export interface ParsedStory {
    storyNumber: string;      // e.g., "1.1"
    storyTitle: string;       // e.g., "Scan Workspace for Epics Files"
    status: string;           // e.g., "ready", "in-progress", "done", "blocked", "unknown"
    lineNumber: number;       // 0-based line number in file
}

export interface ParsedEpic {
    epicNumber: number;       // e.g., 1
    epicTitle: string;        // e.g., "Core Story Discovery & Display"
    lineNumber: number;       // 0-based line number in file
    stories: ParsedStory[];
}

export interface ParsedFile {
    filePath: string;         // Absolute path to the file
    epics: ParsedEpic[];
}

// Regex patterns for parsing
export const EPIC_HEADER_PATTERN = /^##\s+Epic\s+(\d+):\s*(.+)$/;
export const STORY_HEADER_PATTERN = /^###\s+Story\s+(\d+\.\d+):\s*(.+)$/;
export const STATUS_PATTERN = /^\*\*Status:\*\*\s*(\S+)/;

/**
 * Parse an epics.md file and return structured data
 * @param text The full text content of the file
 * @param filePath The absolute path to the file
 * @returns ParsedFile with nested epics and stories
 */
export function parseEpicsFromText(text: string, filePath: string): ParsedFile {
    const epics: ParsedEpic[] = [];

    try {
        const lines = text.split('\n');

        let currentEpic: ParsedEpic | null = null;
        let currentStory: ParsedStory | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for Epic header
            const epicMatch = line.match(EPIC_HEADER_PATTERN);
            if (epicMatch) {
                // Save previous epic if exists
                if (currentEpic) {
                    epics.push(currentEpic);
                }

                // Validate epic number
                const epicNumber = parseInt(epicMatch[1], 10);
                if (isNaN(epicNumber) || epicNumber < 0) {
                    console.log(`[BMAD] Warning: Invalid epic number '${epicMatch[1]}' at line ${i + 1} in ${filePath}`);
                    continue;
                }

                // Start new epic
                currentEpic = {
                    epicNumber,
                    epicTitle: epicMatch[2].trim(),
                    lineNumber: i,
                    stories: []
                };
                currentStory = null;
                continue;
            }

            // Check for Story header
            const storyMatch = line.match(STORY_HEADER_PATTERN);
            if (storyMatch) {
                // Create new story
                currentStory = {
                    storyNumber: storyMatch[1],
                    storyTitle: storyMatch[2].trim(),
                    status: 'unknown',
                    lineNumber: i
                };

                // Add to current epic if exists
                if (currentEpic) {
                    currentEpic.stories.push(currentStory);
                } else {
                    // Story without epic - log warning but don't crash
                    console.log(`[BMAD] Warning: Story ${currentStory.storyNumber} found without an epic at line ${i + 1} in ${filePath}`);
                }
                continue;
            }

            // Check for Status if we're in a story
            if (currentStory) {
                const statusMatch = line.match(STATUS_PATTERN);
                if (statusMatch) {
                    currentStory.status = statusMatch[1].toLowerCase();
                    currentStory = null; // Done parsing this story
                }
            }
        }

        // Save final epic if exists
        if (currentEpic) {
            epics.push(currentEpic);
        }
    } catch (error) {
        console.log(`[BMAD] Error parsing file ${filePath}: ${error}`);
        // Return empty result on parse error - graceful degradation
    }

    return {
        filePath,
        epics
    };
}
