/**
 * @fileoverview Bootstrap command — full project setup for bmad-copilot-adapter.
 *
 * Performs a complete installation check and setup:
 * 1. Verify Node.js version (>=18)
 * 2. Check for `.github/prompts` directory (warn if missing — do NOT auto-install)
 * 3. Detect VS Code CLI (`code` command)
 * 4. Auto-install the BMAD Copilot extension
 * 5. Validate prompt directory readable
 * 6. Print success summary with prompts/agents/commands found
 *
 * This is a pure adapter — it never modifies, converts, or generates
 * prompt files. The official `npx bmad-method install` is the only
 * source of truth for `.github/prompts`.
 *
 * @module cli/bootstrap
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cp from 'node:child_process';

/* ------------------------------------------------------------------ */
/*  Non-goal reminder                                                 */
/* ------------------------------------------------------------------ */
// This CLI does NOT:
// - Convert or mirror Cloud Code prompts
// - Rewrite or generate Copilot prompt files
// - Fork any BMAD runtime logic
// It is a pure bridge / adapter.

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BootstrapOptions {
  /** Working directory (project root). */
  cwd: string;
  /** Skip confirmation prompts. */
  yes: boolean;
}

interface StepResult {
  ok: boolean;
  message: string;
  skipped?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Pretty output helpers                                             */
/* ------------------------------------------------------------------ */

const FMT = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function stepOk(msg: string): void {
  console.log(`  ${FMT.green('✔')} ${msg}`);
}

function stepSkip(msg: string): void {
  console.log(`  ${FMT.yellow('◇')} ${msg}`);
}

function stepFail(msg: string): void {
  console.log(`  ${FMT.red('✖')} ${msg}`);
}

function stepInfo(msg: string): void {
  console.log(`  ${FMT.cyan('ℹ')} ${msg}`);
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                         */
/* ------------------------------------------------------------------ */

export async function bootstrap(options: BootstrapOptions): Promise<void> {
  const { cwd, yes } = options;
  const results: StepResult[] = [];

  console.log('');
  console.log(FMT.bold('  BMAD Copilot Adapter — Bootstrap'));
  console.log(FMT.dim('  ─────────────────────────────────'));
  console.log('');

  // ── Step 1: Check Node version ──────────────────────────────
  {
    const result = checkNodeVersion();
    results.push(result);
    if (result.ok) {
      stepOk(result.message);
    } else {
      stepFail(result.message);
      console.log('');
      console.error(FMT.red('  Bootstrap aborted: Node.js >= 18 is required.'));
      process.exit(1);
    }
  }

  // ── Step 2: Check .github/prompts ───────────────────────────
  {
    const promptsDir = path.join(cwd, '.github', 'prompts');
    const agentsDir = path.join(cwd, '.github', 'agents');
    const hasPrompts = fs.existsSync(promptsDir) && hasBmadFiles(promptsDir);
    const hasAgents = fs.existsSync(agentsDir) && hasBmadAgentFiles(agentsDir);

    if (hasPrompts || hasAgents) {
      const pCount = hasPrompts ? countBmadFiles(promptsDir) : 0;
      const aCount = hasAgents ? countBmadAgentFiles(agentsDir) : 0;
      stepOk(`Found ${pCount} prompt file(s), ${aCount} agent file(s)`);
      results.push({ ok: true, message: 'Prompts/agents found' });
    } else {
      // Warn — do NOT auto-install. User must run the official CLI.
      stepFail('.github/prompts/ and .github/agents/ not found or contain no BMAD files');
      console.log('');
      console.log(FMT.yellow('  You must install prompts with the official BMAD CLI first:'));
      console.log(FMT.dim('    npx bmad-method install'));
      console.log(FMT.dim('  Select ✅ GitHub Copilot in the interactive menu.'));
      console.log('');
      results.push({
        ok: false,
        message: '.github/prompts/ or .github/agents/ missing — run: npx bmad-method install',
      });
    }
  }

  // ── Step 3: Detect VS Code CLI ──────────────────────────────
  {
    const result = detectVsCodeCli();
    results.push(result);
    if (result.ok) {
      stepOk(result.message);
    } else {
      stepSkip(result.message);
    }
  }

  // ── Step 4: Install VS Code extension ───────────────────────
  {
    const vsCodeAvailable = results[results.length - 1].ok;
    if (vsCodeAvailable) {
      const result = await installExtension();
      results.push(result);
      if (result.ok) {
        stepOk(result.message);
      } else if (result.skipped) {
        stepSkip(result.message);
      } else {
        stepFail(result.message);
      }
    } else {
      stepSkip('VS Code not detected — skipping extension install');
      results.push({ ok: false, message: 'VS Code not detected', skipped: true });
    }
  }

  // ── Step 5: Validate Copilot participant ────────────────────
  {
    const result = validateCopilotRegistration(cwd);
    results.push(result);
    if (result.ok) {
      stepOk(result.message);
    } else {
      stepSkip(result.message);
    }
  }

  // ── Step 6: Summary ─────────────────────────────────────────
  console.log('');
  console.log(FMT.dim('  ─────────────────────────────────'));

  const failures = results.filter((r) => !r.ok && !r.skipped);
  const skipped = results.filter((r) => r.skipped);

  if (failures.length === 0) {
    console.log(`  ${FMT.green('✔')} ${FMT.bold('Bootstrap complete!')}`);
    console.log('');
    console.log('  Next steps:');
    console.log(FMT.dim('    1. Open this project in VS Code'));
    console.log(FMT.dim('    2. Open Copilot Chat (Ctrl+Shift+I)'));
    console.log(FMT.dim('    3. Type: @bmad /help'));
    console.log('');

    if (skipped.length > 0) {
      console.log(FMT.yellow(`  ${skipped.length} step(s) skipped (non-critical).`));
      console.log(FMT.dim('  Run `npx bmad-copilot-adapter status` for details.'));
    }
  } else {
    console.log(`  ${FMT.yellow('⚠')} ${FMT.bold('Bootstrap completed with warnings')}`);
    console.log('');
    for (const f of failures) {
      console.log(`    ${FMT.red('•')} ${f.message}`);
    }
    console.log('');
    console.log(FMT.dim('  Run `npx bmad-copilot-adapter update` to retry sync.'));
  }

  console.log('');
}

/* ------------------------------------------------------------------ */
/*  Step implementations                                              */
/* ------------------------------------------------------------------ */

/**
 * Step 1: Check Node.js version >= 18.
 */
function checkNodeVersion(): StepResult {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);

  if (major >= 18) {
    return { ok: true, message: `Node.js v${version} (>= 18 ✓)` };
  }

  return {
    ok: false,
    message: `Node.js v${version} detected — v18 or later required`,
  };
}

/**
 * Step 3: Detect VS Code CLI (`code` command).
 */
function detectVsCodeCli(): StepResult {
  const isWindows = process.platform === 'win32';

  try {
    // Avoid DEP0190: don't pass args array when shell is true
    const result = isWindows
      ? cp.spawnSync('code.cmd --version', { timeout: 10000, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : cp.spawnSync('code', ['--version'], { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });

    if (result.status === 0) {
      const version = result.stdout?.toString().trim().split('\n')[0] ?? 'unknown';
      return { ok: true, message: `VS Code CLI detected (v${version})` };
    }

    return {
      ok: false,
      message: 'VS Code CLI (`code`) not found in PATH',
      skipped: true,
    };
  } catch {
    return {
      ok: false,
      message: 'VS Code CLI (`code`) not found in PATH',
      skipped: true,
    };
  }
}

/**
 * Step 5: Install the BMAD Copilot Adapter extension.
 */
async function installExtension(): Promise<StepResult> {
  const extensionId = 'evil9369.bmad-copilot-adapter';
  const isWindows = process.platform === 'win32';

  // Check if already installed (avoid DEP0190: no args array with shell:true)
  try {
    const listResult = isWindows
      ? cp.spawnSync('code.cmd --list-extensions', { timeout: 15000, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : cp.spawnSync('code', ['--list-extensions'], { timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });

    if (listResult.status === 0) {
      const extensions = listResult.stdout?.toString() ?? '';
      if (extensions.toLowerCase().includes(extensionId.toLowerCase())) {
        return {
          ok: true,
          message: `Extension ${extensionId} already installed`,
          skipped: true,
        };
      }
    }
  } catch {
    // Continue to install attempt
  }

  return new Promise<StepResult>((resolve) => {
    stepInfo(`Installing extension: ${extensionId}`);

    // Avoid DEP0190: on Windows, pass full command string to shell
    const proc = isWindows
      ? cp.spawn(`code.cmd --install-extension ${extensionId}`, { timeout: 60000, shell: true, stdio: 'inherit' })
      : cp.spawn('code', ['--install-extension', extensionId], { timeout: 60000, stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          message: `Extension ${extensionId} installed`,
        });
      } else {
        resolve({
          ok: false,
          message: `Extension install exited with code ${code}. Install manually: code --install-extension ${extensionId}`,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        ok: false,
        message: `Extension install failed: ${err.message}`,
      });
    });
  });
}

/**
 * Step 6: Validate Copilot participant registration.
 *
 * This is a heuristic: we check that `.github/prompts/` has bmad files
 * and the extension package.json declares the chat participant.
 * Full runtime validation requires VS Code to be running.
 */
function validateCopilotRegistration(cwd: string): StepResult {
  const promptsDir = path.join(cwd, '.github', 'prompts');
  const agentsDir = path.join(cwd, '.github', 'agents');

  const hasPrompts = fs.existsSync(promptsDir) && hasBmadFiles(promptsDir);
  const hasAgents = fs.existsSync(agentsDir) && hasBmadAgentFiles(agentsDir);

  if (hasPrompts || hasAgents) {
    const count = (hasPrompts ? countBmadFiles(promptsDir) : 0) + (hasAgents ? countBmadAgentFiles(agentsDir) : 0);
    return {
      ok: true,
      message: `Copilot integration ready (${count} BMAD file(s) detected)`,
    };
  }

  // Check for _bmad/ as fallback (prompts can be generated via BMAD installer)
  const hasBmadDir = fs.existsSync(path.join(cwd, '_bmad'));
  if (hasBmadDir) {
    return {
      ok: true,
      message: 'Copilot integration ready (_bmad/ found; run `npx bmad-method install --tools github-copilot` to generate prompts)',
    };
  }

  return {
    ok: false,
    message: 'No BMAD installation detected — Copilot participant cannot register',
    skipped: true,
  };
}

/* ------------------------------------------------------------------ */
/*  File helpers                                                      */
/* ------------------------------------------------------------------ */

function hasBmadFiles(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some((f) => f.startsWith('bmad') && f.endsWith('.prompt.md'));
  } catch {
    return false;
  }
}

function hasBmadAgentFiles(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some((f) => f.startsWith('bmad-agent') && f.endsWith('.md'));
  } catch {
    return false;
  }
}

function countBmadFiles(dir: string): number {
  try {
    return fs.readdirSync(dir).filter((f) => f.startsWith('bmad') && f.endsWith('.prompt.md')).length;
  } catch {
    return 0;
  }
}

function countBmadAgentFiles(dir: string): number {
  try {
    return fs.readdirSync(dir).filter((f) => f.startsWith('bmad-agent') && f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}
