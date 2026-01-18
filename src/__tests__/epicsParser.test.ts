import { describe, it, expect } from 'vitest';
import {
    parseEpicsFromText,
    EPIC_HEADER_PATTERN,
    STORY_HEADER_PATTERN,
    STATUS_PATTERN,
    ParsedFile,
    ParsedEpic,
    ParsedStory
} from '../epicsParser';

describe('epicsParser', () => {
    const TEST_FILE_PATH = '/test/epics.md';

    describe('regex patterns', () => {
        describe('EPIC_HEADER_PATTERN', () => {
            it('matches valid epic header', () => {
                const match = '## Epic 1: Core Features'.match(EPIC_HEADER_PATTERN);
                expect(match).not.toBeNull();
                expect(match![1]).toBe('1');
                expect(match![2]).toBe('Core Features');
            });

            it('matches epic with multi-digit number', () => {
                const match = '## Epic 12: Advanced Features'.match(EPIC_HEADER_PATTERN);
                expect(match).not.toBeNull();
                expect(match![1]).toBe('12');
            });

            it('does not match without Epic keyword', () => {
                expect('## 1: Core Features'.match(EPIC_HEADER_PATTERN)).toBeNull();
            });

            it('does not match with wrong heading level', () => {
                expect('# Epic 1: Core Features'.match(EPIC_HEADER_PATTERN)).toBeNull();
                expect('### Epic 1: Core Features'.match(EPIC_HEADER_PATTERN)).toBeNull();
            });

            it('does not match without colon', () => {
                expect('## Epic 1 Core Features'.match(EPIC_HEADER_PATTERN)).toBeNull();
            });
        });

        describe('STORY_HEADER_PATTERN', () => {
            it('matches valid story header', () => {
                const match = '### Story 1.1: User Login'.match(STORY_HEADER_PATTERN);
                expect(match).not.toBeNull();
                expect(match![1]).toBe('1.1');
                expect(match![2]).toBe('User Login');
            });

            it('matches story with multi-digit numbers', () => {
                const match = '### Story 12.34: Complex Feature'.match(STORY_HEADER_PATTERN);
                expect(match).not.toBeNull();
                expect(match![1]).toBe('12.34');
            });

            it('does not match without Story keyword', () => {
                expect('### 1.1: User Login'.match(STORY_HEADER_PATTERN)).toBeNull();
            });

            it('does not match with wrong heading level', () => {
                expect('## Story 1.1: User Login'.match(STORY_HEADER_PATTERN)).toBeNull();
                expect('#### Story 1.1: User Login'.match(STORY_HEADER_PATTERN)).toBeNull();
            });

            it('does not match story number without dot', () => {
                expect('### Story 1: User Login'.match(STORY_HEADER_PATTERN)).toBeNull();
            });
        });

        describe('STATUS_PATTERN', () => {
            it('matches valid status line', () => {
                const match = '**Status:** ready'.match(STATUS_PATTERN);
                expect(match).not.toBeNull();
                expect(match![1]).toBe('ready');
            });

            it('matches status with different values', () => {
                expect('**Status:** in-progress'.match(STATUS_PATTERN)![1]).toBe('in-progress');
                expect('**Status:** done'.match(STATUS_PATTERN)![1]).toBe('done');
                expect('**Status:** blocked'.match(STATUS_PATTERN)![1]).toBe('blocked');
            });

            it('does not match without bold markers', () => {
                expect('Status: ready'.match(STATUS_PATTERN)).toBeNull();
            });
        });
    });

    describe('parseEpicsFromText', () => {
        describe('2.1.1 - valid epic/story structure parsing', () => {
            it('parses single epic with single story', () => {
                const text = `## Epic 1: Core Features

### Story 1.1: User Login
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.filePath).toBe(TEST_FILE_PATH);
                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].epicNumber).toBe(1);
                expect(result.epics[0].epicTitle).toBe('Core Features');
                expect(result.epics[0].stories).toHaveLength(1);
                expect(result.epics[0].stories[0].storyNumber).toBe('1.1');
                expect(result.epics[0].stories[0].storyTitle).toBe('User Login');
                expect(result.epics[0].stories[0].status).toBe('ready');
            });

            it('parses single epic with multiple stories', () => {
                const text = `## Epic 1: Core Features

### Story 1.1: User Login
**Status:** done

### Story 1.2: User Registration
**Status:** in-progress

### Story 1.3: Password Reset
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].stories).toHaveLength(3);
                expect(result.epics[0].stories[0].storyNumber).toBe('1.1');
                expect(result.epics[0].stories[1].storyNumber).toBe('1.2');
                expect(result.epics[0].stories[2].storyNumber).toBe('1.3');
            });

            it('parses multiple epics with multiple stories', () => {
                const text = `## Epic 1: Authentication

### Story 1.1: Login
**Status:** done

### Story 1.2: Logout
**Status:** done

## Epic 2: Dashboard

### Story 2.1: Overview Page
**Status:** in-progress

### Story 2.2: Analytics
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(2);

                expect(result.epics[0].epicNumber).toBe(1);
                expect(result.epics[0].epicTitle).toBe('Authentication');
                expect(result.epics[0].stories).toHaveLength(2);

                expect(result.epics[1].epicNumber).toBe(2);
                expect(result.epics[1].epicTitle).toBe('Dashboard');
                expect(result.epics[1].stories).toHaveLength(2);
            });

            it('parses epic with title containing special characters', () => {
                const text = `## Epic 1: User Auth & Session (v2.0)

### Story 1.1: OAuth 2.0 Integration
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics[0].epicTitle).toBe('User Auth & Session (v2.0)');
                expect(result.epics[0].stories[0].storyTitle).toBe('OAuth 2.0 Integration');
            });

            it('trims whitespace from titles', () => {
                const text = `## Epic 1:   Spaced Title

### Story 1.1:   Story With Spaces
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics[0].epicTitle).toBe('Spaced Title');
                expect(result.epics[0].stories[0].storyTitle).toBe('Story With Spaces');
            });
        });

        describe('2.1.2 - invalid epic numbers', () => {
            it('skips epic with non-numeric number in header', () => {
                // Note: The regex requires \d+ so non-numeric won't match at all
                const text = `## Epic ABC: Invalid Epic

### Story ABC.1: Some Story
**Status:** ready

## Epic 1: Valid Epic

### Story 1.1: Valid Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // Only the valid epic should be parsed
                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].epicNumber).toBe(1);
            });

            it('handles epic with zero as number', () => {
                const text = `## Epic 0: Zero Epic

### Story 0.1: Zero Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // Epic 0 should be rejected (epicNumber < 0 check catches === 0 incorrectly,
                // but the code uses < 0 so 0 is actually accepted)
                // Looking at the code: if (isNaN(epicNumber) || epicNumber < 0)
                // So epicNumber 0 will pass the check
                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].epicNumber).toBe(0);
            });

            it('parses epic with very large number', () => {
                const text = `## Epic 9999: Large Number Epic

### Story 9999.1: Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].epicNumber).toBe(9999);
            });
        });

        describe('2.1.3 - stories without parent epic', () => {
            it('handles story appearing before any epic', () => {
                const text = `### Story 1.1: Orphan Story
**Status:** ready

## Epic 1: First Epic

### Story 1.2: Valid Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // The orphan story should be logged but not crash
                // Only the epic should be in results, with its one valid story
                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].stories).toHaveLength(1);
                expect(result.epics[0].stories[0].storyNumber).toBe('1.2');
            });

            it('handles file with only stories and no epics', () => {
                const text = `### Story 1.1: First Story
**Status:** ready

### Story 1.2: Second Story
**Status:** done
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // No epics should be parsed - stories without epics are orphans
                expect(result.epics).toHaveLength(0);
            });
        });

        describe('2.1.4 - status variations', () => {
            it('parses "ready" status', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('ready');
            });

            it('parses "in-progress" status', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** in-progress
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('in-progress');
            });

            it('parses "done" status', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** done
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('done');
            });

            it('parses "blocked" status', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** blocked
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('blocked');
            });

            it('parses "draft" status', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** draft
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('draft');
            });

            it('converts status to lowercase', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** READY
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('ready');
            });

            it('converts mixed case status to lowercase', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** In-Progress
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('in-progress');
            });

            it('defaults to "unknown" when status line is missing', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test Without Status

### Story 1.2: Next Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('unknown');
                expect(result.epics[0].stories[1].status).toBe('ready');
            });

            it('handles custom/unknown status values', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** custom-status
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                expect(result.epics[0].stories[0].status).toBe('custom-status');
            });
        });

        describe('2.1.5 - malformed markdown', () => {
            it('handles missing header markers', () => {
                const text = `Epic 1: No Hash Marks

Story 1.1: Also No Hash
**Status:** ready

## Epic 2: Valid Epic

### Story 2.1: Valid Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // Only valid epic should be parsed
                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].epicNumber).toBe(2);
            });

            it('handles broken status format', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
Status: ready

### Story 1.2: Another
**Status:** done
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // First story should have unknown status (no bold markers)
                expect(result.epics[0].stories[0].status).toBe('unknown');
                expect(result.epics[0].stories[1].status).toBe('done');
            });

            it('handles status on same line as story (should not match)', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test **Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // Status embedded in title line won't be parsed as status
                expect(result.epics[0].stories[0].status).toBe('unknown');
                expect(result.epics[0].stories[0].storyTitle).toBe('Test **Status:** ready');
            });

            it('handles extra whitespace in headers', () => {
                // The regex /^##\s+Epic\s+(\d+):\s*(.+)$/ uses \s+ which matches multiple spaces
                // So extra whitespace IS allowed and will match
                const text = `##   Epic   1:   Test

###   Story   1.1:   Test
**Status:**   ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // Extra whitespace is allowed by the regex pattern
                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].epicNumber).toBe(1);
            });

            it('handles content between headers', () => {
                const text = `## Epic 1: Test

Some description text here.
More description.

### Story 1.1: Test

Story description here.
With multiple lines.

**Status:** ready

More content after status.
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].stories).toHaveLength(1);
                expect(result.epics[0].stories[0].status).toBe('ready');
            });
        });

        describe('2.1.6 - edge cases', () => {
            it('handles empty file', () => {
                const result = parseEpicsFromText('', TEST_FILE_PATH);

                expect(result.filePath).toBe(TEST_FILE_PATH);
                expect(result.epics).toHaveLength(0);
            });

            it('handles file with only whitespace', () => {
                const result = parseEpicsFromText('   \n\n   \t\n   ', TEST_FILE_PATH);

                expect(result.epics).toHaveLength(0);
            });

            it('handles file with no epics but other content', () => {
                const text = `# Project Documentation

This is a markdown file but has no epics.

## Some Other Section

Content here.
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(0);
            });

            it('handles epic with no stories', () => {
                const text = `## Epic 1: Empty Epic

Some description but no stories.

## Epic 2: Also Empty

More description.
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(2);
                expect(result.epics[0].stories).toHaveLength(0);
                expect(result.epics[1].stories).toHaveLength(0);
            });

            it('handles very long file', () => {
                let text = '';
                for (let i = 1; i <= 100; i++) {
                    text += `## Epic ${i}: Epic Number ${i}\n\n`;
                    for (let j = 1; j <= 10; j++) {
                        text += `### Story ${i}.${j}: Story ${i}.${j}\n`;
                        text += `**Status:** ready\n\n`;
                    }
                }

                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(100);
                expect(result.epics[0].stories).toHaveLength(10);
                expect(result.epics[99].stories).toHaveLength(10);
            });

            it('does not parse Windows line endings (CRLF) - known limitation', () => {
                // The parser splits on \n but \r remains at end of line
                // This breaks regex matching since patterns end with $ which won't match before \r
                // This documents the current behavior - CRLF files won't parse correctly
                const text = '## Epic 1: Test\r\n\r\n### Story 1.1: Test\r\n**Status:** ready\r\n';
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                // Current behavior: CRLF breaks parsing (the \r at line end prevents regex match)
                expect(result.epics).toHaveLength(0);
            });

            it('handles file ending without newline', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** ready`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics).toHaveLength(1);
                expect(result.epics[0].stories[0].status).toBe('ready');
            });
        });

        describe('2.1.7 - line number tracking accuracy', () => {
            it('tracks epic line numbers correctly (0-based)', () => {
                // Line 0: ## Epic 1: First Epic
                // Line 1: (empty)
                // Line 2: ### Story 1.1: First Story
                // Line 3: **Status:** ready
                // Line 4: (empty)
                // Line 5: ## Epic 2: Second Epic
                // Line 6: (empty)
                // Line 7: ### Story 2.1: Second Story
                // Line 8: **Status:** ready
                const text = `## Epic 1: First Epic

### Story 1.1: First Story
**Status:** ready

## Epic 2: Second Epic

### Story 2.1: Second Story
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics[0].lineNumber).toBe(0); // Line 1 = index 0
                expect(result.epics[1].lineNumber).toBe(5); // Line 6 = index 5
            });

            it('tracks story line numbers correctly (0-based)', () => {
                const text = `## Epic 1: Test

### Story 1.1: First
**Status:** ready

### Story 1.2: Second
**Status:** ready

### Story 1.3: Third
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics[0].stories[0].lineNumber).toBe(2); // Line 3 = index 2
                expect(result.epics[0].stories[1].lineNumber).toBe(5); // Line 6 = index 5
                expect(result.epics[0].stories[2].lineNumber).toBe(8); // Line 9 = index 8
            });

            it('tracks line numbers with blank lines correctly', () => {
                const text = `

## Epic 1: Test



### Story 1.1: Test


**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics[0].lineNumber).toBe(2); // After 2 blank lines
                expect(result.epics[0].stories[0].lineNumber).toBe(6); // After 3 more blank lines
            });

            it('tracks line numbers in complex document', () => {
                const text = `# Document Header

Some preamble text.

## Epic 1: First

Description of epic.

### Story 1.1: First Story

Description of story.

**Status:** ready

## Epic 2: Second

### Story 2.1: Second Story
**Status:** done
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result.epics[0].lineNumber).toBe(4); // "## Epic 1: First"
                expect(result.epics[0].stories[0].lineNumber).toBe(8); // "### Story 1.1: First Story"
                expect(result.epics[1].lineNumber).toBe(14); // "## Epic 2: Second"
                expect(result.epics[1].stories[0].lineNumber).toBe(16); // "### Story 2.1: Second Story"
            });
        });

        describe('return structure', () => {
            it('returns correct ParsedFile structure', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** ready
`;
                const result: ParsedFile = parseEpicsFromText(text, TEST_FILE_PATH);

                expect(result).toHaveProperty('filePath');
                expect(result).toHaveProperty('epics');
                expect(Array.isArray(result.epics)).toBe(true);
            });

            it('returns correct ParsedEpic structure', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                const epic: ParsedEpic = result.epics[0];

                expect(epic).toHaveProperty('epicNumber');
                expect(epic).toHaveProperty('epicTitle');
                expect(epic).toHaveProperty('lineNumber');
                expect(epic).toHaveProperty('stories');
                expect(typeof epic.epicNumber).toBe('number');
                expect(typeof epic.epicTitle).toBe('string');
                expect(typeof epic.lineNumber).toBe('number');
                expect(Array.isArray(epic.stories)).toBe(true);
            });

            it('returns correct ParsedStory structure', () => {
                const text = `## Epic 1: Test

### Story 1.1: Test
**Status:** ready
`;
                const result = parseEpicsFromText(text, TEST_FILE_PATH);
                const story: ParsedStory = result.epics[0].stories[0];

                expect(story).toHaveProperty('storyNumber');
                expect(story).toHaveProperty('storyTitle');
                expect(story).toHaveProperty('status');
                expect(story).toHaveProperty('lineNumber');
                expect(typeof story.storyNumber).toBe('string');
                expect(typeof story.storyTitle).toBe('string');
                expect(typeof story.status).toBe('string');
                expect(typeof story.lineNumber).toBe('number');
            });
        });
    });
});
