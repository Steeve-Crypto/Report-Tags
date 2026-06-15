const vscode = require('vscode');
const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const EXTENSION_ID = 'git-sound-report';
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const GIT_EVENT_DIR = path.join('.git', 'git-sound-report');
const GIT_EVENT_FILE = path.join(GIT_EVENT_DIR, 'events.log');

let output;
let statusBarItem;
let userId;
const repoSnapshots = new Map();
const recentEvents = new Map();
const hookFileOffsets = new Map();

function activate(context) {
  output = vscode.window.createOutputChannel('Git Sound Report');
  context.subscriptions.push(output);

  userId = getOrCreateUserId(context);

  registerCommands(context);
  registerStatusBar(context);
  registerTerminalDetection(context);
  registerGitHookWatchers(context);
  registerGitApiDetection(context);

  capture('extension_activated');
  log('Activated');
}

function registerCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('gitSoundReport.playTestSound', async () => {
      await celebrate('test_sound', { source: 'command' });
      vscode.window.showInformationMessage('Git Sound Report test sound played.');
    }),
    vscode.commands.registerCommand('gitSoundReport.toggleEnabled', async () => {
      const config = getConfig();
      const nextValue = !config.get('enabled', true);
      await config.update('enabled', nextValue, vscode.ConfigurationTarget.Global);
      updateStatusBar();
      vscode.window.showInformationMessage(`Git Sound Report is now ${nextValue ? 'enabled' : 'disabled'}.`);
      capture('enabled_toggled', { enabled: nextValue });
    }),
    vscode.commands.registerCommand('gitSoundReport.installGitHooks', installGitHooks),
    vscode.commands.registerCommand('gitSoundReport.openSponsor', () => {
      const url = getConfig().get('sponsorUrl', 'https://github.com/sponsors/athena-devtools');
      vscode.env.openExternal(vscode.Uri.parse(url));
      capture('sponsor_opened');
    }),
    vscode.commands.registerCommand('gitSoundReport.openEnterprise', () => {
      const url = getConfig().get('enterpriseUrl', 'https://github.com/athena-devtools/git-sound-report');
      vscode.env.openExternal(vscode.Uri.parse(url));
      capture('enterprise_opened');
    }),
    vscode.commands.registerCommand('gitSoundReport.showStatus', showStatus)
  );
}

function registerStatusBar(context) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'gitSoundReport.showStatus';
  statusBarItem.tooltip = 'Git Sound Report';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();
  statusBarItem.show();
}

function updateStatusBar() {
  const enabled = getConfig().get('enabled', true);
  statusBarItem.text = enabled ? '$(megaphone) Git Sound' : '$(mute) Git Sound';
}

function registerTerminalDetection(context) {
  const endShellExecution = vscode.window.onDidEndTerminalShellExecution;
  if (typeof endShellExecution !== 'function') {
    log('Terminal shell integration API is unavailable in this VS Code version. Git hook detection remains available.');
    return;
  }

  context.subscriptions.push(endShellExecution(async (event) => {
    const commandLine = getCommandLine(event);
    const exitCode = typeof event.exitCode === 'number' ? event.exitCode : undefined;
    const gitEvent = parseGitCommand(commandLine);

    if (!gitEvent || exitCode !== 0) {
      return;
    }

    await celebrate(gitEvent, {
      source: 'terminal',
      command: sanitizeCommand(commandLine),
      exitCode
    });
  }));
}

function registerGitHookWatchers(context) {
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const eventPath = path.join(folder.uri.fsPath, GIT_EVENT_FILE);
    if (fs.existsSync(eventPath)) {
      hookFileOffsets.set(eventPath, fs.statSync(eventPath).size);
    }

    const pattern = new vscode.RelativePattern(folder, GIT_EVENT_FILE.replace(/\\/g, '/'));
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const onChange = (uri) => readGitHookEvents(uri.fsPath);
    watcher.onDidCreate(onChange);
    watcher.onDidChange(onChange);
    context.subscriptions.push(watcher);
  }
}

async function registerGitApiDetection(context) {
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    log('VS Code Git extension is unavailable.');
    return;
  }

  try {
    const exports = await gitExtension.activate();
    const gitApi = exports.getAPI(1);

    for (const repo of gitApi.repositories) {
      observeRepository(context, repo);
    }

    context.subscriptions.push(gitApi.onDidOpenRepository((repo) => observeRepository(context, repo)));
  } catch (error) {
    log(`Git API activation failed: ${error.message}`);
  }
}

function observeRepository(context, repo) {
  const root = repo.rootUri.fsPath;
  if (repoSnapshots.has(root)) {
    return;
  }

  repoSnapshots.set(root, snapshotRepo(repo));

  const disposable = repo.state.onDidChange(async () => {
    const previous = repoSnapshots.get(root);
    const next = snapshotRepo(repo);
    repoSnapshots.set(root, next);

    if (!previous) {
      return;
    }

    if (previous.head !== next.head && next.head) {
      await celebrate('commit', {
        source: 'vscode_git_api',
        repository: path.basename(root)
      });
    }
  });

  context.subscriptions.push(disposable);
}

function snapshotRepo(repo) {
  const head = repo.state.HEAD;
  return {
    head: head && head.commit,
    upstream: head && head.upstream && head.upstream.name
  };
}

async function installGitHooks() {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    vscode.window.showWarningMessage('Open a Git workspace before installing hooks.');
    return;
  }

  let installed = 0;
  for (const folder of folders) {
    const gitDir = path.join(folder.uri.fsPath, '.git');
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      continue;
    }

    ensureDir(path.join(folder.uri.fsPath, GIT_EVENT_DIR));
    installHook(folder.uri.fsPath, 'post-commit', 'commit');
    installHook(folder.uri.fsPath, 'post-merge', 'merge');
    installHook(folder.uri.fsPath, 'post-checkout', 'checkout');
    installed += 1;
  }

  if (installed === 0) {
    vscode.window.showWarningMessage('No workspace .git directory found.');
    return;
  }

  vscode.window.showInformationMessage(`Installed Git Sound Report hooks in ${installed} workspace${installed === 1 ? '' : 's'}.`);
  capture('git_hooks_installed', { workspaceCount: installed });
}

function installHook(workspacePath, hookName, eventName) {
  const hookPath = path.join(workspacePath, '.git', 'hooks', hookName);
  const markerStart = '# >>> git-sound-report';
  const markerEnd = '# <<< git-sound-report';
  const snippet = [
    markerStart,
    'mkdir -p .git/git-sound-report',
    `printf '{"event":"${eventName}","time":"%s","source":"git_hook"}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .git/git-sound-report/events.log`,
    markerEnd
  ].join(os.EOL);

  let current = '';
  if (fs.existsSync(hookPath)) {
    current = fs.readFileSync(hookPath, 'utf8');
    if (current.includes(markerStart)) {
      return;
    }
  }

  const prefix = current.trim().length > 0 ? `${current.trimEnd()}${os.EOL}${os.EOL}` : '#!/bin/sh' + os.EOL;
  fs.writeFileSync(hookPath, `${prefix}${snippet}${os.EOL}`, { mode: 0o755 });
}

function readGitHookEvents(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const previousOffset = hookFileOffsets.get(filePath) || 0;
    const nextOffset = Buffer.byteLength(content);
    const unread = content.slice(previousOffset);
    hookFileOffsets.set(filePath, nextOffset);

    const lines = unread.trim().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        celebrate(event.event || 'git_success', { source: event.source || 'git_hook' });
      } catch {
        log(`Ignored malformed hook event: ${line}`);
      }
    }
  } catch (error) {
    log(`Unable to read hook events: ${error.message}`);
  }
}

async function showStatus() {
  const config = getConfig();
  const telemetryEnabled = isTelemetryEnabled(config);
  const message = [
    `Enabled: ${config.get('enabled', true) ? 'yes' : 'no'}`,
    `Telemetry: ${telemetryEnabled ? 'enabled' : 'disabled'}`,
    `Sound: ${getSoundPath(config) || 'system fallback'}`
  ].join(' | ');

  const choice = await vscode.window.showInformationMessage(
    message,
    'Play Test',
    'Install Hooks',
    'Sponsor',
    'Enterprise'
  );

  if (choice === 'Play Test') {
    vscode.commands.executeCommand('gitSoundReport.playTestSound');
  } else if (choice === 'Install Hooks') {
    vscode.commands.executeCommand('gitSoundReport.installGitHooks');
  } else if (choice === 'Sponsor') {
    vscode.commands.executeCommand('gitSoundReport.openSponsor');
  } else if (choice === 'Enterprise') {
    vscode.commands.executeCommand('gitSoundReport.openEnterprise');
  }
}

async function celebrate(eventName, properties = {}) {
  const config = getConfig();
  if (!config.get('enabled', true)) {
    return;
  }

  if (!isAllowedEvent(eventName, config)) {
    return;
  }

  const dedupeKey = `${eventName}:${properties.source || 'unknown'}:${properties.command || ''}`;
  if (isRecentDuplicate(dedupeKey)) {
    return;
  }

  playSound(config);
  capture('git_success_detected', {
    gitEvent: eventName,
    ...properties
  });
}

function isAllowedEvent(eventName, config) {
  const enabledEvents = config.get('enabledEvents', ['add', 'commit', 'push', 'merge', 'checkout', 'test_sound']);
  return enabledEvents.includes(eventName);
}

function isRecentDuplicate(key) {
  const now = Date.now();
  const previous = recentEvents.get(key) || 0;
  recentEvents.set(key, now);
  return now - previous < 1500;
}

function parseGitCommand(commandLine) {
  const command = String(commandLine || '').trim().toLowerCase();
  const match = command.match(/(?:^|\s)git(?:\.exe)?\s+([a-z-]+)/);
  if (!match) {
    return null;
  }

  const verb = match[1];
  if (verb === 'add' || verb === 'commit' || verb === 'push' || verb === 'merge' || verb === 'checkout') {
    return verb;
  }

  return null;
}

function getCommandLine(event) {
  const commandLine = event && event.execution && event.execution.commandLine;
  if (typeof commandLine === 'string') {
    return commandLine;
  }

  if (commandLine && typeof commandLine.value === 'string') {
    return commandLine.value;
  }

  return '';
}

function sanitizeCommand(commandLine) {
  return String(commandLine || '')
    .replace(/https:\/\/[^:\s]+:[^@\s]+@/g, 'https://[redacted]@')
    .replace(/--password(?:=|\s+)\S+/gi, '--password [redacted]');
}

function playSound(config) {
  const scriptPath = path.join(__dirname, 'play_sound.py');
  const soundPath = getSoundPath(config);
  const pythonCandidates = getPythonCandidates(config);
  runPythonSound(scriptPath, soundPath, pythonCandidates, 0);
}

function runPythonSound(scriptPath, soundPath, candidates, index) {
  const executable = candidates[index];
  if (!executable) {
    log('No Python executable worked. Using VS Code notification only.');
    return;
  }

  const args = executable === 'py' ? ['-3', scriptPath] : [scriptPath];
  if (soundPath) {
    args.push(soundPath);
  }

  const child = spawn(executable, args, {
    cwd: __dirname,
    windowsHide: true,
    shell: false
  });

  child.on('error', (error) => {
    log(`Python sound failed with ${executable}: ${error.message}`);
    runPythonSound(scriptPath, soundPath, candidates, index + 1);
  });

  child.stderr.on('data', (data) => log(String(data).trim()));
}

function getPythonCandidates(config) {
  const configured = config.get('pythonPath', '');
  return [configured, process.platform === 'win32' ? 'py' : '', 'python3', 'python']
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function getSoundPath(config) {
  const configuredPath = config.get('soundPath', '');
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const bundled = path.join(__dirname, 'report_tag_success.mp3');
  return fs.existsSync(bundled) ? bundled : '';
}

function capture(event, properties = {}) {
  const config = getConfig();
  if (!isTelemetryEnabled(config)) {
    return;
  }

  const apiKey = config.get('postHogProjectApiKey', '');
  const host = config.get('postHogHost', DEFAULT_POSTHOG_HOST).replace(/\/$/, '');
  const payload = JSON.stringify({
    api_key: apiKey,
    event,
    distinct_id: userId,
    properties: {
      extensionVersion: getExtensionVersion(),
      vscodeVersion: vscode.version,
      platform: process.platform,
      ...properties
    }
  });

  const request = https.request(`${host}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 2500
  }, (response) => {
    response.resume();
  });

  request.on('error', (error) => log(`PostHog capture failed: ${error.message}`));
  request.write(payload);
  request.end();
}

function isTelemetryEnabled(config) {
  return Boolean(config.get('telemetry.enabled', false) && config.get('postHogProjectApiKey', ''));
}

function getConfig() {
  return vscode.workspace.getConfiguration(EXTENSION_ID);
}

function getExtensionVersion() {
  try {
    const manifest = require(path.join(__dirname, 'package.json'));
    return manifest.version;
  } catch {
    return 'unknown';
  }
}

function getOrCreateUserId(context) {
  const key = 'anonymousUserId';
  const existing = context.globalState.get(key);
  if (existing) {
    return existing;
  }

  const next = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  context.globalState.update(key, next);
  return next;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function log(message) {
  output.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function deactivate() {}

exports.activate = activate;
exports.deactivate = deactivate;
