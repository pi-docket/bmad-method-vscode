export const DEFAULT_CLI_TOOL = 'claude';

const SAFE_TOOL_PATTERN = /^[A-Za-z0-9._\\/: -]+$/;

export function normalizeCliTool(configuredTool: string | undefined): string {
    const trimmedTool = configuredTool?.trim();

    return trimmedTool ? trimmedTool : DEFAULT_CLI_TOOL;
}

export function isSafeCliTool(tool: string): boolean {
    return SAFE_TOOL_PATTERN.test(tool);
}

export function quoteCliTool(tool: string): string {
    if (!/[\s"]/u.test(tool)) {
        return tool;
    }

    const escaped = tool.replace(/(["\\])/g, '\\$1');
    return `"${escaped}"`;
}

export function buildCliCommand(tool: string, workflow: 'create-story' | 'dev-story', storyNumber?: string): string {
    const prompt = storyNumber
        ? `/bmad:bmm:workflows:${workflow} ${storyNumber}`
        : `/bmad:bmm:workflows:${workflow}`;

    return `${quoteCliTool(tool)} "${prompt}"`;
}

export function getWhichCommand(platform: NodeJS.Platform, tool: string): { cmd: string; args: string[] } {
    const cmd = platform === 'win32' ? 'where' : 'which';

    return { cmd, args: [tool] };
}
