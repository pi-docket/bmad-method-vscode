# BMad Method for VS Code

A VS Code extension for the BMad Method that displays CodeLens actions above story headers in epic markdown files, enabling one-click story creation and development via Claude Code CLI.

## Features

- Detects BMAD epic files by configurable filename pattern (default: `*epic*.md`)
- Displays CodeLens actions above story headers matching `### Story N.N: Title`
- Context-aware actions based on story status and file existence:
  - **Create Story**: When status is `ready` but no story file exists
  - **Start Developing Story**: When status is `ready` and story file exists
  - No CodeLens for stories with other statuses (`in-progress`, `completed`, etc.)

## Requirements

- VS Code 1.80.0 or higher
- [Claude Code CLI](https://claude.ai/claude-code) installed and authenticated (or configure `bmad.cliTool`)
- BMAD Method workflows configured in your project

## Story File Detection

The extension looks for story files in `_bmad-output/implementation-artifacts/` with the naming pattern `{story-number}*.md` where dots in the story number are converted to dashes (e.g., story `1.1` looks for files matching `1-1*.md`).

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `bmad.enableCodeLens` | `true` | Enable/disable CodeLens for BMAD story files |
| `bmad.epicFilePattern` | `**/*epic*.md` | Glob pattern for BMAD epic files |
| `bmad.techSpecFilePattern` | `**/tech-spec-*.md` | Glob pattern for BMAD tech spec files |
| `bmad.cliTool` | `claude` | CLI tool binary used to run BMAD story workflows |

## Compatibility / Known Limitations

- **Codex is not supported.** The `codex` CLI has known issues and is incompatible with the extension's workflow; do not set `bmad.cliTool` to `codex`. See https://github.com/openai/codex/issues/3641 for details.

## Usage

1. Open an epic file (e.g., `epic-1-authentication.md`)
2. Look for stories with `**Status:** ready`
3. Click the CodeLens action above the story header:
   - "Create Story" runs `/bmad:bmm:workflows:create-story {storyNumber}`
   - "Start Developing Story" runs `/bmad:bmm:workflows:dev-story {storyNumber}`

## Expected Story Format

```markdown
### Story 1.1: Implement User Login

**Status:** ready
**Priority:** P0
**Estimated Effort:** 3 points
```

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Test in VS Code
# Open src/extension.ts and press F5 to launch Extension Development Host
```

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration testing.

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Test files are located in `src/__tests__/` and follow the `*.test.ts` naming convention.

Coverage reports showing which lines of code were not executed during the tests are generated in `coverage/`:

- HTML report: open `coverage/index.html`
- LCOV report: `coverage/lcov.info` (for CI or uploading to coverage services)

## Local Installation

To package and install the extension locally:

1. Install the VS Code Extension Manager:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Package the extension:
   ```bash
   vsce package
   ```
   This creates a `.vsix` file in the project directory.

3. Install in VS Code:
   - Open Extensions view (Cmd+Shift+X)
   - Click the `...` menu at the top of the sidebar
   - Select "Install from VSIX..."
   - Choose the generated `.vsix` file

   Or from the command line:
   ```bash
   code --install-extension bmad-method-0.0.1-pre.vsix
   ```

## License

MIT
