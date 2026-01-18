import * as vscode from 'vscode';

const CONFIG_PATH = '_bmad/bmm/config.yaml';

/**
 * Read a path value from BMAD config.yaml by field name.
 * Handles both {project-root}/path and plain path formats.
 * Returns the resolved path relative to workspace root, or null if not found.
 */
async function getConfigPath(fieldName: string): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const workspaceRoot = workspaceFolders[0].uri;
    const configUri = vscode.Uri.joinPath(workspaceRoot, CONFIG_PATH);

    try {
        const content = await vscode.workspace.fs.readFile(configUri);
        const text = Buffer.from(content).toString('utf8');

        // Look for: fieldName: "{project-root}/some/path" or fieldName: "some/path"
        const pattern = new RegExp(`^${fieldName}:\\s*["']?(.+?)["']?\\s*$`, 'm');
        const match = text.match(pattern);

        if (match) {
            // Strip {project-root}/ prefix if present
            return match[1].replace(/^\{project-root\}\//, '');
        }

        return null;
    } catch (error: unknown) {
        console.log(`[BMAD] Could not read config at ${configUri.fsPath}: ${error}`);
        return null;
    }
}

/**
 * Read the planning_artifacts path from BMAD config.yaml
 * Returns the resolved path relative to workspace root, or null if not found
 */
export async function getPlanningArtifactsPath(): Promise<string | null> {
    return getConfigPath('planning_artifacts');
}

/**
 * Read the implementation_artifacts path from BMAD config.yaml
 * Returns the resolved path relative to workspace root, or null if not found
 */
export async function getImplementationArtifactsPath(): Promise<string | null> {
    return getConfigPath('implementation_artifacts');
}
