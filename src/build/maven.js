import path from 'node:path';
import { spawn } from 'node:child_process';

function createBuildPlan(detection, profile, options = {}) {
  const { project, projectConfig, module: moduleInfo } = detection;
  const skipTests = options.skipTests || projectConfig.skip_tests || false;
  const effectiveProfile = profile || projectConfig.default_profile || 'none';
  const commandArgs = buildMavenCommand(moduleInfo, effectiveProfile, skipTests, projectConfig);

  return {
    project,
    module: moduleInfo,
    projectConfig,
    cwd: moduleInfo.isReactorBuild ? projectConfig.base_path : moduleInfo.path,
    effectiveProfile,
    skipTests,
    command: getMavenExecutable(),
    commandArgs
  };
}

function getMavenExecutable() {
  return process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function executeBuildPlan(plan, run = runCommand) {
  await run(plan.command, plan.commandArgs, { cwd: plan.cwd });
  return plan;
}

function buildMavenCommand(moduleInfo, profile, skipTests, projectConfig) {
  const args = ['clean'];

  if (moduleInfo.packaging === 'war') {
    args.push('package');
  } else {
    args.push('install');
  }

  const reactorSelector = getReactorSelector(moduleInfo.relativePath);
  if (moduleInfo.isReactorBuild && reactorSelector) {
    args.push('-pl', reactorSelector);
    args.push('-am');
  }

  const profiles = getProfiles(profile, projectConfig);
  if (profiles.length > 0) {
    args.push('-P', profiles.join(','));
  }

  if (skipTests) {
    args.push('-DskipTests=true');
  }

  return args;
}

function getReactorSelector(relativePath) {
  if (!relativePath) {
    return null;
  }

  const normalizedPath = String(relativePath).trim();
  if (!normalizedPath || normalizedPath === '.') {
    return null;
  }

  if (path.isAbsolute(normalizedPath) || normalizedPath === '..' || normalizedPath.startsWith(`..${path.sep}`)) {
    throw new Error(`Invalid reactor module path: ${normalizedPath}`);
  }

  return normalizedPath;
}

function getProfiles(profile, projectConfig) {
  const normalizedProfile = !profile || profile === 'none' ? '' : profile;
  const profiles = projectConfig.maven_profiles;

  if (profiles && profiles[normalizedProfile]) {
    return profiles[normalizedProfile];
  }

  if (normalizedProfile === '') {
    return [];
  }

  return [normalizedProfile];
}

export {
  createBuildPlan,
  getMavenExecutable,
  runCommand,
  executeBuildPlan,
  buildMavenCommand,
  getReactorSelector,
  getProfiles
};
