import { describe, it, expect } from 'vitest';
import {
    parseTechSpecTasksFromText,
    ParsedTechSpecFile,
    ParsedTechSpecTask
} from '../techSpecParser';

describe('techSpecParser', () => {
    const TEST_FILE_PATH = '/test/tech-spec.md';

    describe('parseTechSpecTasksFromText', () => {
        describe('2.2.1 - task parsing with [ ] checkbox format', () => {
            it('parses unchecked task with space in checkbox', () => {
                const text = `### Tasks

- [ ] Task 1.1: First task
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].taskNumber).toBe('1.1');
                expect(result.tasks[0].taskTitle).toBe('First task');
                expect(result.tasks[0].status).toBe('todo');
            });

            it('parses multiple unchecked tasks', () => {
                const text = `### Tasks

- [ ] Task 1.1: First task
- [ ] Task 1.2: Second task
- [ ] Task 1.3: Third task
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(3);
                expect(result.tasks[0].status).toBe('todo');
                expect(result.tasks[1].status).toBe('todo');
                expect(result.tasks[2].status).toBe('todo');
            });

            it('parses task without checkbox as todo', () => {
                const text = `### Tasks

- Task 1.1: Task without checkbox
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].status).toBe('todo');
                expect(result.tasks[0].taskTitle).toBe('Task without checkbox');
            });
        });

        describe('2.2.2 - task parsing with [x] and [X] completed formats', () => {
            it('parses lowercase [x] as done', () => {
                const text = `### Tasks

- [x] Task 1.1: Completed task
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].status).toBe('done');
            });

            it('parses uppercase [X] as done', () => {
                const text = `### Tasks

- [X] Task 1.1: Completed task
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].status).toBe('done');
            });

            it('parses mixed checked and unchecked tasks', () => {
                const text = `### Tasks

- [x] Task 1.1: Done task
- [ ] Task 1.2: Pending task
- [X] Task 1.3: Also done
- [ ] Task 1.4: Another pending
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(4);
                expect(result.tasks[0].status).toBe('done');
                expect(result.tasks[1].status).toBe('todo');
                expect(result.tasks[2].status).toBe('done');
                expect(result.tasks[3].status).toBe('todo');
            });
        });

        describe('2.2.3 - multiple ### Tasks sections in one file', () => {
            it('only parses tasks from the first Tasks section', () => {
                const text = `### Tasks

- [ ] Task 1.1: First section task 1
- [ ] Task 1.2: First section task 2

### Other Section

Some content here.

### Tasks

- [ ] Task 2.1: Second section task (should be ignored)
- [ ] Task 2.2: Another ignored task
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(2);
                expect(result.tasks[0].taskNumber).toBe('1.1');
                expect(result.tasks[1].taskNumber).toBe('1.2');
            });

            it('stops parsing at next heading', () => {
                const text = `### Tasks

- [ ] Task 1.1: Task before heading

### Notes

- [ ] Task 1.2: This should not be parsed (after Notes heading)
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].taskNumber).toBe('1.1');
            });

            it('stops at h1 heading', () => {
                const text = `### Tasks

- [ ] Task 1.1: First task

# New Section

- [ ] Task 1.2: Should not be parsed
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
            });

            it('stops at h2 heading', () => {
                const text = `### Tasks

- [ ] Task 1.1: First task

## New Section

- [ ] Task 1.2: Should not be parsed
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
            });

            it('stops at h3 heading', () => {
                const text = `### Tasks

- [ ] Task 1.1: First task

### New Section

- [ ] Task 1.2: Should not be parsed
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
            });
        });

        describe('2.2.4 - task numbering patterns', () => {
            it('parses single digit task numbers', () => {
                const text = `### Tasks

- [ ] Task 1: Single digit
- [ ] Task 2: Another single
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(2);
                expect(result.tasks[0].taskNumber).toBe('1');
                expect(result.tasks[1].taskNumber).toBe('2');
            });

            it('parses two-level task numbers (1.1, 1.2)', () => {
                const text = `### Tasks

- [ ] Task 1.1: First subtask
- [ ] Task 1.2: Second subtask
- [ ] Task 2.1: New group
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(3);
                expect(result.tasks[0].taskNumber).toBe('1.1');
                expect(result.tasks[1].taskNumber).toBe('1.2');
                expect(result.tasks[2].taskNumber).toBe('2.1');
            });

            it('parses three-level task numbers (1.1.1)', () => {
                const text = `### Tasks

- [ ] Task 1.1.1: Deep subtask
- [ ] Task 1.1.2: Another deep subtask
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(2);
                expect(result.tasks[0].taskNumber).toBe('1.1.1');
                expect(result.tasks[1].taskNumber).toBe('1.1.2');
            });

            it('parses multi-digit numbers in each level', () => {
                const text = `### Tasks

- [ ] Task 12.34: Multi-digit numbers
- [ ] Task 100.200.300: Very large numbers
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(2);
                expect(result.tasks[0].taskNumber).toBe('12.34');
                expect(result.tasks[1].taskNumber).toBe('100.200.300');
            });

            it('preserves task number order from file', () => {
                const text = `### Tasks

- [ ] Task 3.1: Third group first
- [ ] Task 1.1: First group first
- [ ] Task 2.1: Second group first
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].taskNumber).toBe('3.1');
                expect(result.tasks[1].taskNumber).toBe('1.1');
                expect(result.tasks[2].taskNumber).toBe('2.1');
            });
        });

        describe('2.2.5 - markdown cleanup', () => {
            it('removes bold markers from task title', () => {
                const text = `### Tasks

- [ ] Task 1.1: **Bold title**
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].taskTitle).toBe('Bold title');
            });

            it('removes inline code backticks from task title', () => {
                const text = `### Tasks

- [ ] Task 1.1: Add \`configHelper\` function
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].taskTitle).toBe('Add configHelper function');
            });

            it('removes markdown links but keeps text', () => {
                const text = `### Tasks

- [ ] Task 1.1: See [documentation](https://example.com) for details
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].taskTitle).toBe('See documentation for details');
            });

            it('handles multiple markdown elements in one title', () => {
                const text = `### Tasks

- [ ] Task 1.1: **Bold** with \`code\` and [link](url)
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].taskTitle).toBe('Bold with code and link');
            });

            it('trims whitespace from task title', () => {
                const text = `### Tasks

- [ ] Task 1.1:    Spaced title
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].taskTitle).toBe('Spaced title');
            });

            it('handles bold Task keyword in line', () => {
                const text = `### Tasks

- [ ] **Task 1.1**: Bold task keyword
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].taskNumber).toBe('1.1');
                expect(result.tasks[0].taskTitle).toBe('Bold task keyword');
            });

            it('handles bold around entire task definition', () => {
                const text = `### Tasks

- [ ] **Task 1.1: Entire bold line**
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].taskTitle).toBe('Entire bold line');
            });
        });

        describe('2.2.6 - edge cases', () => {
            it('returns empty tasks array for empty file', () => {
                const result = parseTechSpecTasksFromText('', TEST_FILE_PATH);

                expect(result.filePath).toBe(TEST_FILE_PATH);
                expect(result.tasks).toHaveLength(0);
            });

            it('returns empty tasks array for file with only whitespace', () => {
                const result = parseTechSpecTasksFromText('   \n\n   \t\n', TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(0);
            });

            it('returns empty tasks array when no Tasks section exists', () => {
                const text = `# Tech Spec

## Overview

Some content here.

### Implementation

More content.
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(0);
            });

            it('returns empty tasks array for empty Tasks section', () => {
                const text = `### Tasks

### Next Section

Content here.
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(0);
            });

            it('returns empty tasks array for Tasks section with non-task content', () => {
                const text = `### Tasks

Some description text.
- Regular bullet point
- Another bullet

### Next Section
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(0);
            });

            it('handles Tasks section at end of file', () => {
                const text = `# Tech Spec

### Tasks

- [ ] Task 1.1: Last section task`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
                expect(result.tasks[0].taskNumber).toBe('1.1');
            });

            it('handles file ending without newline', () => {
                const text = `### Tasks

- [ ] Task 1.1: No trailing newline`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
            });

            it('handles indented task lines', () => {
                const text = `### Tasks

  - [ ] Task 1.1: Indented with spaces
    - [ ] Task 1.2: More indented
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(2);
            });

            it('ignores lines that almost match task pattern', () => {
                const text = `### Tasks

- [ ] Task: Missing number
- [ ] 1.1: Missing Task keyword
Task 1.1: Missing leading dash
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(0);
            });

            it('parses task line without colon after number (title becomes rest of line)', () => {
                // The regex pattern is: Task\s+(\d+(?:\.\d+)*)\s*:\s*(.+)
                // This requires a colon, so "Task 1.1 Missing colon" should NOT match
                const text = `### Tasks

- [ ] Task 1.1 Missing colon
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                // Actually testing - the regex requires : so this should fail
                expect(result.tasks).toHaveLength(0);
            });

            it('handles Tasks header with extra text', () => {
                const text = `### Tasks for Phase 1

- [ ] Task 1.1: Should still be parsed
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks).toHaveLength(1);
            });
        });

        describe('line number tracking', () => {
            it('tracks task line numbers correctly (0-based)', () => {
                // Line 0: ### Tasks
                // Line 1: (empty)
                // Line 2: - [ ] Task 1.1: First
                // Line 3: - [ ] Task 1.2: Second
                const text = `### Tasks

- [ ] Task 1.1: First
- [ ] Task 1.2: Second
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].lineNumber).toBe(2);
                expect(result.tasks[1].lineNumber).toBe(3);
            });

            it('tracks line numbers with content before Tasks section', () => {
                // Line 0: # Tech Spec
                // Line 1: (empty)
                // Line 2: ## Overview
                // Line 3: (empty)
                // Line 4: Some content.
                // Line 5: (empty)
                // Line 6: ### Tasks
                // Line 7: (empty)
                // Line 8: - [ ] Task 1.1: First
                const text = `# Tech Spec

## Overview

Some content.

### Tasks

- [ ] Task 1.1: First
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result.tasks[0].lineNumber).toBe(8);
            });
        });

        describe('return structure', () => {
            it('returns correct ParsedTechSpecFile structure', () => {
                const text = `### Tasks

- [ ] Task 1.1: Test
`;
                const result: ParsedTechSpecFile = parseTechSpecTasksFromText(text, TEST_FILE_PATH);

                expect(result).toHaveProperty('filePath');
                expect(result).toHaveProperty('tasks');
                expect(result.filePath).toBe(TEST_FILE_PATH);
                expect(Array.isArray(result.tasks)).toBe(true);
            });

            it('returns correct ParsedTechSpecTask structure', () => {
                const text = `### Tasks

- [x] Task 1.1: Test task
`;
                const result = parseTechSpecTasksFromText(text, TEST_FILE_PATH);
                const task: ParsedTechSpecTask = result.tasks[0];

                expect(task).toHaveProperty('taskNumber');
                expect(task).toHaveProperty('taskTitle');
                expect(task).toHaveProperty('status');
                expect(task).toHaveProperty('lineNumber');
                expect(typeof task.taskNumber).toBe('string');
                expect(typeof task.taskTitle).toBe('string');
                expect(['done', 'todo']).toContain(task.status);
                expect(typeof task.lineNumber).toBe('number');
            });
        });
    });
});
