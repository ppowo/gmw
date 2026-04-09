import micromatch from 'micromatch';
import simpleGit from 'simple-git';

const RESTART_STATUSES = Object.freeze({
  REQUIRED: 'required',
  RECOMMENDED: 'recommended',
  NOT_REQUIRED: 'not-required',
  UNKNOWN: 'unknown'
});

async function evaluateRestartDecision(moduleInfo, restartRules, options = {}) {
  if (moduleInfo.isGlobalModule) {
    return createRestartDecision(RESTART_STATUSES.REQUIRED, 'Global module deployment');
  }

  if (moduleInfo.packaging === 'war') {
    return createRestartDecision(RESTART_STATUSES.NOT_REQUIRED, 'WAR hot-deployment');
  }

  if (!restartRules || !restartRules.patterns) {
    return createRestartDecision(RESTART_STATUSES.UNKNOWN, 'No restart rules configured');
  }

  try {
    const modifiedFiles = await getModifiedFiles(moduleInfo, options);
    if (modifiedFiles.length === 0) {
      return createRestartDecision(RESTART_STATUSES.NOT_REQUIRED, 'No files modified');
    }

    const moduleFiles = filterFilesToModule(modifiedFiles, moduleInfo);
    if (moduleFiles.length === 0) {
      return createRestartDecision(RESTART_STATUSES.NOT_REQUIRED, 'No files modified in target module');
    }

    const matches = matchRestartRules(moduleFiles, restartRules.patterns);
    if (matches.length === 0) {
      return createRestartDecision(RESTART_STATUSES.NOT_REQUIRED, 'No critical files modified');
    }

    const status = matches.some((match) => match.severity === 'required')
      ? RESTART_STATUSES.REQUIRED
      : RESTART_STATUSES.RECOMMENDED;

    return createRestartDecision(status, 'Restart rules matched', { matches, modifiedFiles: moduleFiles });
  } catch {
    return createRestartDecision(RESTART_STATUSES.UNKNOWN, 'Unable to detect file changes');
  }
}

function createRestartDecision(status, reason, extras = {}) {
  return {
    status,
    reason,
    matches: [],
    modifiedFiles: [],
    ...extras
  };
}

async function getModifiedFiles(moduleInfo, options = {}) {
  if (options.getModifiedFiles) {
    return options.getModifiedFiles(moduleInfo);
  }

  const gitFactory = options.gitFactory || simpleGit;
  const git = gitFactory(moduleInfo.path);
  const diff = await git.diff(['--name-only', 'HEAD']);

  return diff.trim().split('\n').filter(Boolean);
}

function filterFilesToModule(modifiedFiles, moduleInfo) {
  const moduleRelativePath = moduleInfo.relativePath || '';

  return modifiedFiles.filter((file) => {
    if (moduleRelativePath) {
      return file.startsWith(`${moduleRelativePath}/`);
    }

    return true;
  });
}

function matchRestartRules(files, patterns) {
  const matchesByFile = new Map();
  const severityOrder = { required: 1, recommended: 2 };

  for (const file of files) {
    for (const rule of patterns) {
      if (!matchesRule(file, rule.match)) {
        continue;
      }

      const existing = matchesByFile.get(file);
      if (!existing || severityOrder[rule.severity] < severityOrder[existing.severity]) {
        matchesByFile.set(file, { file, ...rule });
      }
    }
  }

  return Array.from(matchesByFile.values());
}
function matchesRule(file, pattern) {
  if (micromatch.isMatch(file, pattern)) {
    return true;
  }

  try {
    return new RegExp(pattern).test(file);
  } catch {
    return false;
  }
}

export {
  RESTART_STATUSES,
  evaluateRestartDecision,
  createRestartDecision,
  getModifiedFiles,
  filterFilesToModule,
  matchRestartRules
};
