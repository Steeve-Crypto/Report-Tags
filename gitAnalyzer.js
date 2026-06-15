const { execFile } = require('child_process');
const path = require('path');

const RISKY_FILE_PATTERNS = [
  /(^|[/\\])package(-lock)?\.json$/i,
  /(^|[/\\])pnpm-lock\.yaml$/i,
  /(^|[/\\])yarn\.lock$/i,
  /(^|[/\\])Dockerfile$/i,
  /(^|[/\\])docker-compose\./i,
  /(^|[/\\])\.github[/\\]workflows[/\\]/i,
  /(^|[/\\])migrations?[/\\]/i,
  /(^|[/\\])(auth|security|billing|payment|stripe|database|db)[/\\]/i,
  /(^|[/\\]).*\.sql$/i
];

const TEST_FILE_PATTERNS = [
  /(^|[/\\])(__tests__|tests?|spec)[/\\]/i,
  /\.(test|spec)\.[jt]sx?$/i,
  /\.(test|spec)\.py$/i
];

function classifyGitEvent(input = {}) {
  const eventName = input.eventName || 'git_success';
  const command = String(input.command || '');
  const message = String(input.message || '').toLowerCase();
  const files = Array.isArray(input.files) ? input.files : [];
  const stats = normalizeStats(input.stats);
  const text = `${command} ${message}`.toLowerCase();

  const fileInsights = inspectFiles(files);
  const intent = inferIntent(text, eventName, fileInsights);
  const risk = inferRisk(text, stats, fileInsights);
  const scale = inferScale(stats, files.length);
  const profile = chooseProfile({ eventName, intent, risk, scale, fileInsights, text });

  return {
    profile,
    intent,
    risk,
    scale,
    stats,
    fileCount: files.length,
    riskyFileCount: fileInsights.riskyFileCount,
    testFileCount: fileInsights.testFileCount,
    hasDependencyChange: fileInsights.hasDependencyChange,
    hasCiChange: fileInsights.hasCiChange
  };
}

function normalizeStats(stats = {}) {
  return {
    filesChanged: Number(stats.filesChanged || 0),
    insertions: Number(stats.insertions || 0),
    deletions: Number(stats.deletions || 0)
  };
}

function inspectFiles(files) {
  let riskyFileCount = 0;
  let testFileCount = 0;
  let hasDependencyChange = false;
  let hasCiChange = false;

  for (const file of files) {
    const normalized = String(file || '');
    if (RISKY_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      riskyFileCount += 1;
    }
    if (TEST_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      testFileCount += 1;
    }
    if (/package(-lock)?\.json$|pnpm-lock\.yaml$|yarn\.lock$/i.test(normalized)) {
      hasDependencyChange = true;
    }
    if (/\.github[/\\]workflows[/\\]|azure-pipelines|circleci|gitlab-ci/i.test(normalized)) {
      hasCiChange = true;
    }
  }

  return { riskyFileCount, testFileCount, hasDependencyChange, hasCiChange };
}

function inferIntent(text, eventName, fileInsights) {
  if (/\b(revert|rollback|backout)\b/.test(text)) return 'recovery';
  if (/\b(hotfix|urgent|prod|production|incident)\b/.test(text)) return 'hotfix';
  if (/\b(deploy|release|ship|publish|launch)\b/.test(text) || eventName === 'push') return 'deploy';
  if (/\b(fix|bug|patch|repair|resolve)\b/.test(text)) return 'fix';
  if (/\b(feat|feature|add|new|initial)\b/.test(text)) return 'feature';
  if (/\b(refactor|cleanup|rework|rewrite)\b/.test(text)) return 'refactor';
  if (/\b(perf|performance|optimi[sz]e|speed)\b/.test(text)) return 'performance';
  if (/\b(test|spec|coverage)\b/.test(text) || fileInsights.testFileCount > 0) return 'test';
  if (/\b(doc|docs|readme|comment)\b/.test(text)) return 'docs';
  return eventName;
}

function inferRisk(text, stats, fileInsights) {
  let score = 0;
  if (/\b(auth|security|payment|billing|stripe|database|migration|prod|production|hotfix|incident)\b/.test(text)) score += 3;
  if (fileInsights.riskyFileCount > 0) score += 2;
  if (fileInsights.hasDependencyChange) score += 1;
  if (stats.filesChanged >= 12) score += 1;
  if (stats.insertions + stats.deletions >= 500) score += 1;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function inferScale(stats, fallbackFileCount) {
  const filesChanged = stats.filesChanged || fallbackFileCount;
  const churn = stats.insertions + stats.deletions;
  if (filesChanged >= 20 || churn >= 1000) return 'major';
  if (filesChanged >= 6 || churn >= 200) return 'medium';
  return 'small';
}

function chooseProfile({ eventName, intent, risk, scale, fileInsights, text }) {
  if (risk === 'high') return 'risky_change';
  if (intent === 'recovery' || intent === 'hotfix') return 'bug_fix';
  if (intent === 'deploy') return scale === 'major' || /\b(release|launch)\b/.test(text) ? 'major_release' : 'deploy_win';
  if (intent === 'test' || fileInsights.testFileCount > 0) return 'test_green';
  if (intent === 'fix') return 'bug_fix';
  if (intent === 'feature') return scale === 'major' ? 'major_release' : 'feature_ship';
  if (intent === 'performance') return 'feature_ship';
  if (scale === 'major') return 'major_release';
  if (eventName === 'add' || intent === 'docs') return 'tiny_win';
  return 'feature_ship';
}

async function analyzeRepository(workspacePath, eventName, command) {
  if (!workspacePath) {
    return classifyGitEvent({ eventName, command });
  }

  const [message, stats, files] = await Promise.all([
    getLastCommitMessage(workspacePath),
    getLastCommitStats(workspacePath),
    getChangedFiles(workspacePath, eventName)
  ]);

  return classifyGitEvent({ eventName, command, message, stats, files });
}

function getLastCommitMessage(cwd) {
  return runGit(cwd, ['log', '-1', '--pretty=%B']).catch(() => '');
}

async function getLastCommitStats(cwd) {
  const output = await runGit(cwd, ['show', '--shortstat', '--format=', 'HEAD']).catch(() => '');
  const stats = { filesChanged: 0, insertions: 0, deletions: 0 };
  const filesMatch = output.match(/(\d+)\s+files?\s+changed/);
  const insertionsMatch = output.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = output.match(/(\d+)\s+deletions?\(-\)/);
  if (filesMatch) stats.filesChanged = Number(filesMatch[1]);
  if (insertionsMatch) stats.insertions = Number(insertionsMatch[1]);
  if (deletionsMatch) stats.deletions = Number(deletionsMatch[1]);
  return stats;
}

async function getChangedFiles(cwd, eventName) {
  const args = eventName === 'commit' || eventName === 'push'
    ? ['show', '--name-only', '--format=', 'HEAD']
    : ['diff', '--name-only', '--cached'];
  const output = await runGit(cwd, args).catch(() => '');
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => path.normalize(file));
}

function runGit(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, windowsHide: true, timeout: 2500 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

module.exports = {
  analyzeRepository,
  classifyGitEvent
};
