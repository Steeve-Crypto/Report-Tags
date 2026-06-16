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
const POSTHOG_SECRET_KEY = 'postHogProjectApiKey';

let output;
let statusBarItem;
let userId;
let extensionContext;
const repoSnapshots = new Map();
const recentEvents = new Map();
const hookFileOffsets = new Map();

function activate(context) {
  extensionContext = context;
  output = vscode.window.createOutputChannel('Space Report');
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
      await celebrate('test_sound', { source: 'command', command: 'feature ship test sound' });
      vscode.window.showInformationMessage('Space Report test sound played.');
    }),
    vscode.commands.registerCommand('gitSoundReport.toggleEnabled', async () => {
      const config = getConfig();
      const nextValue = !config.get('enabled', true);
      await config.update('enabled', nextValue, vscode.ConfigurationTarget.Global);
      updateStatusBar();
      vscode.window.showInformationMessage(`Space Report is now ${nextValue ? 'enabled' : 'disabled'}.`);
      capture('enabled_toggled', { enabled: nextValue });
    }),
    vscode.commands.registerCommand('gitSoundReport.installGitHooks', installGitHooks),
    vscode.commands.registerCommand('gitSoundReport.openSponsor', () => {
      const url = getConfig().get('sponsorUrl', 'https://github.com/sponsors/Steeve-Crypto');
      vscode.env.openExternal(vscode.Uri.parse(url));
      capture('sponsor_opened');
    }),
    vscode.commands.registerCommand('gitSoundReport.feedbackUp', () => recordFeedback('up')),
    vscode.commands.registerCommand('gitSoundReport.feedbackDown', () => recordFeedback('down')),
    vscode.commands.registerCommand('gitSoundReport.setPostHogApiKey', setPostHogApiKey),
    vscode.commands.registerCommand('gitSoundReport.clearPostHogApiKey', clearPostHogApiKey),
    vscode.commands.registerCommand('gitSoundReport.showStatus', showStatus)
  );
}

function registerStatusBar(context) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'gitSoundReport.showStatus';
  statusBarItem.tooltip = 'Space Report';
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
      exitCode,
      workspacePath: getWorkspacePathForTerminal(event.terminal)
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
        workspacePath: root
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

  vscode.window.showInformationMessage(`Installed Space Report hooks in ${installed} workspace${installed === 1 ? '' : 's'}.`);
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
        const eventName = event.event || 'git_success';
        const workspacePath = getWorkspacePathForFile(filePath);
        celebrate(eventName, { source: event.source || 'git_hook', workspacePath });
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
  const telemetryEnabled = isTelemetryEnabled(config, await getPostHogApiKey(config));
  const message = [
    `Enabled: ${config.get('enabled', true) ? 'yes' : 'no'}`,
    `Telemetry: ${telemetryEnabled ? 'enabled' : 'disabled'}`,
    `Sound: ${getSoundPath(config) || 'adaptive bundled sound'}`
  ].join(' | ');

  const choice = await vscode.window.showInformationMessage(
    message,
    'Play Test',
    'Install Hooks',
    'Like Sound',
    'Dislike Sound',
    'Sponsor',
  );

  if (choice === 'Play Test') {
    vscode.commands.executeCommand('gitSoundReport.playTestSound');
  } else if (choice === 'Install Hooks') {
    vscode.commands.executeCommand('gitSoundReport.installGitHooks');
  } else if (choice === 'Like Sound') {
    vscode.commands.executeCommand('gitSoundReport.feedbackUp');
  } else if (choice === 'Dislike Sound') {
    vscode.commands.executeCommand('gitSoundReport.feedbackDown');
  } else if (choice === 'Sponsor') {
    vscode.commands.executeCommand('gitSoundReport.openSponsor');
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

  const analysis = await playSound(config, {
    eventName,
    command: properties.command,
    workspacePath: properties.workspacePath
  });

  const telemetryProperties = {
    gitEvent: eventName,
    source: properties.source,
    exitCode: properties.exitCode,
    soundProfile: analysis && analysis.profile,
    soundProfileLabel: analysis && analysis.profileLabel,
    intent: analysis && analysis.intent,
    risk: analysis && analysis.risk,
    scale: analysis && analysis.scale,
    fileCount: analysis && analysis.fileCount,
    filesChanged: analysis && analysis.filesChanged,
    insertions: analysis && analysis.insertions,
    deletions: analysis && analysis.deletions,
    riskyFileCount: analysis && analysis.riskyFileCount,
    testFileCount: analysis && analysis.testFileCount,
    hasDependencyChange: analysis && analysis.hasDependencyChange,
    hasCiChange: analysis && analysis.hasCiChange
  };

  capture('git_success_detected', telemetryProperties);
}

async function setPostHogApiKey() {
  const key = await vscode.window.showInputBox({
    prompt: 'Enter your PostHog project token/API key. It will be stored in VS Code SecretStorage, not in the repo.',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => value && value.trim().length > 0 ? null : 'API key is required.'
  });

  if (!key) {
    return;
  }

  await extensionContext.secrets.store(POSTHOG_SECRET_KEY, key.trim());
  vscode.window.showInformationMessage('PostHog project token saved securely in VS Code SecretStorage.');
}

async function clearPostHogApiKey() {
  await extensionContext.secrets.delete(POSTHOG_SECRET_KEY);
  vscode.window.showInformationMessage('PostHog project token removed from VS Code SecretStorage.');
}

async function recordFeedback(direction) {
  const config = getConfig();
  const result = await runPythonControl(config, ['--feedback', direction]);
  if (result) {
    vscode.window.showInformationMessage(`Space Report ${direction === 'up' ? 'liked' : 'disliked'} ${result.profile} sound.`);
    capture('sound_feedback_recorded', {
      direction,
      soundProfile: result.profile,
      feedbackScore: result.feedbackScore
    });
  }
}

function isAllowedEvent(eventName, config) {
  const enabledEvents = config.get('enabledEvents', ['commit', 'push', 'merge', 'checkout', 'test_sound']);
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

function playSound(config, eventContext) {
  const scriptPath = path.join(__dirname, 'play_sound.py');
  const soundPath = getSoundPath(config);
  const pythonCandidates = getPythonCandidates(config);
  return runPythonSound(scriptPath, soundPath, pythonCandidates, 0, eventContext);
}

function runPythonSound(scriptPath, soundPath, candidates, index, eventContext) {
  const executable = candidates[index];
  if (!executable) {
    log('No Python executable worked. Using VS Code notification only.');
    return Promise.resolve(null);
  }

  const args = executable === 'py' ? ['-3', scriptPath] : [scriptPath];
  args.push('--event', eventContext.eventName || 'git_success');
  args.push('--extension-dir', __dirname);
  args.push('--intelligent', String(getConfig().get('intelligentSound.enabled', true)));
  args.push('--state-path', getStatePath());
  args.push('--voice', String(getConfig().get('voice.enabled', false)));
  args.push('--team-enabled', String(getConfig().get('teamDeploy.enabled', false)));
  const teamWebhookUrl = getConfig().get('teamDeploy.webhookUrl', '');
  if (teamWebhookUrl) {
    args.push('--team-webhook-url', teamWebhookUrl);
  }
  if (eventContext.workspacePath) {
    args.push('--workspace', eventContext.workspacePath);
  }
  if (eventContext.command) {
    args.push('--command', eventContext.command);
  }
  if (soundPath) {
    args.push('--sound-path', soundPath);
  }

  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn(executable, args, {
      cwd: __dirname,
      windowsHide: true,
      shell: false
    });

    child.stdout.on('data', (data) => {
      stdout += String(data);
    });

    child.stderr.on('data', (data) => log(String(data).trim()));

    child.on('error', (error) => {
      log(`Python sound failed with ${executable}: ${error.message}`);
      runPythonSound(scriptPath, soundPath, candidates, index + 1, eventContext).then(resolve);
    });

    child.on('close', () => {
      resolve(parsePythonAnalysis(stdout));
    });
  });
}

function runPythonControl(config, extraArgs) {
  const scriptPath = path.join(__dirname, 'play_sound.py');
  const pythonCandidates = getPythonCandidates(config);
  return runPythonControlAttempt(scriptPath, pythonCandidates, 0, extraArgs);
}

function runPythonControlAttempt(scriptPath, candidates, index, extraArgs) {
  const executable = candidates[index];
  if (!executable) {
    log('No Python executable worked for control command.');
    return Promise.resolve(null);
  }

  const args = executable === 'py' ? ['-3', scriptPath] : [scriptPath];
  args.push('--state-path', getStatePath());
  args.push('--no-play');
  args.push(...extraArgs);

  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn(executable, args, {
      cwd: __dirname,
      windowsHide: true,
      shell: false
    });
    child.stdout.on('data', (data) => {
      stdout += String(data);
    });
    child.stderr.on('data', (data) => log(String(data).trim()));
    child.on('error', (error) => {
      log(`Python control failed with ${executable}: ${error.message}`);
      runPythonControlAttempt(scriptPath, candidates, index + 1, extraArgs).then(resolve);
    });
    child.on('close', () => {
      resolve(parsePythonAnalysis(stdout));
    });
  });
}

function getPythonCandidates(config) {
  const configured = config.get('pythonPath', '');
  return [configured, process.platform === 'win32' ? 'py' : '', 'python3', 'python']
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function parsePythonAnalysis(stdout) {
  const lines = String(stdout || '').trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Ignore non-JSON output such as terminal bell fallback.
    }
  }
  return null;
}

function getSoundPath(config) {
  const configuredPath = config.get('soundPath', '');
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }
  return '';
}

async function capture(event, properties = {}) {
  const config = getConfig();
  const apiKey = await getPostHogApiKey(config);
  if (!isTelemetryEnabled(config, apiKey)) {
    return;
  }

  const host = config.get('postHogHost', DEFAULT_POSTHOG_HOST).replace(/\/$/, '');
  const payload = JSON.stringify({
    token: apiKey,
    event,
    properties: {
      distinct_id: userId,
      extensionVersion: getExtensionVersion(),
      vscodeVersion: vscode.version,
      platform: process.platform,
      ...properties
    }
  });

  const request = https.request(`${host}/i/v0/e/`, {
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

async function getPostHogApiKey(config) {
  const secretKey = extensionContext ? await extensionContext.secrets.get(POSTHOG_SECRET_KEY) : '';
  return secretKey || config.get('postHogProjectApiKey', '');
}

function isTelemetryEnabled(config, apiKey) {
  return Boolean(config.get('telemetry.enabled', false) && apiKey);
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

function getWorkspacePathForTerminal(terminal) {
  const cwd = terminal && terminal.creationOptions && terminal.creationOptions.cwd;
  if (typeof cwd === 'string') {
    return cwd;
  }
  if (cwd && cwd.fsPath) {
    return cwd.fsPath;
  }
  return getFirstWorkspacePath();
}

function getWorkspacePathForFile(filePath) {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  return folder ? folder.uri.fsPath : getFirstWorkspacePath();
}

function getFirstWorkspacePath() {
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.length > 0 ? folders[0].uri.fsPath : '';
}

function getStatePath() {
  const storageUri = extensionContext && extensionContext.globalStorageUri;
  const storagePath = storageUri ? storageUri.fsPath : path.join(os.homedir(), '.git-sound-report');
  ensureDir(storagePath);
  return path.join(storagePath, 'ai-state.json');
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
