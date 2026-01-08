import path from 'path';
import { $ } from 'bun';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import { globbySync } from 'globby';
import micromatch from 'micromatch';
import logSymbols from 'log-symbols';
import { confirm } from './utils.js';

/**
 * Build a Maven module
 */
async function buildModule(detection, profile, options = {}) {
  const { project, projectConfig, restartRules, module: moduleInfo } = detection;
  const skipTests = options.skipTests || projectConfig.skip_tests || false;

  console.log(chalk.blue('=== Build Plan ==='));
  console.log(`Project: ${project}`);
  console.log(`Module: ${moduleInfo.artifactId}`);
  console.log(`Packaging: ${moduleInfo.packaging}`);
  console.log(`Path: ${moduleInfo.path}`);
  console.log('');

  // Show profile
  const effectiveProfile = profile || projectConfig.default_profile || 'none';
  console.log(`Profile: ${effectiveProfile}`);

  // Build Maven command
  const cmdArgs = buildMavenCommand(moduleInfo, effectiveProfile, skipTests, projectConfig);

  console.log(chalk.yellow('Command:'), 'mvn', cmdArgs.join(' '));
  console.log('');

  // Confirm build
  const confirmed = await confirm('Proceed with build?');
  if (!confirmed) {
    console.log(logSymbols.error, chalk.red('Build cancelled'));
    return;
  }

  // Execute build
  try {
    const cwd = moduleInfo.isReactorBuild ? projectConfig.base_path : moduleInfo.path;

    // Execute Maven command with Bun's $ shell
    await $`cd ${cwd} && mvn ${cmdArgs}`;

    console.log(logSymbols.success, chalk.green('Build completed successfully'));

    // Show artifacts, restart guidance, and get artifact path
    const artifactPath = await showArtifactsAndGuidance(moduleInfo, restartRules);

    // Return the artifact path for caller to use
    return artifactPath;

  } catch (error) {
    console.error(chalk.red('Build failed:'), error.message);
    throw error;
  }
}

/**
 * Build Maven command arguments
 */
function buildMavenCommand(moduleInfo, profile, skipTests, projectConfig) {
  const args = [];

  // Always start with clean
  args.push('clean');

  // Lifecycle phase based on packaging type
  // WAR: final deployable, just package
  // JAR: library that other modules depend on, install to local repo
  if (moduleInfo.packaging === 'war') {
    args.push('package');
  } else {
    args.push('install');
  }

  // Reactor build specific - use relative path for -pl
  if (moduleInfo.isReactorBuild) {
    args.push('-pl', moduleInfo.relativePath);
    args.push('-am'); // Also make dependencies
  }

  // Profiles - keep new syntax with comma separation
  const profiles = getProfiles(profile, projectConfig);
  if (profiles.length > 0) {
    args.push('-P', profiles.join(','));
  }

  // Skip tests
  if (skipTests) {
    args.push('-DskipTests=true');
  }

  return args;
}

/**
 * Get Maven profiles for a project
 */
function getProfiles(profile, projectConfig) {
  // Normalize profile to empty string if none/null
  const normalizedProfile = (!profile || profile === 'none') ? '' : profile;

  // Check maven_profiles first (including empty string key for default behavior)
  const profiles = projectConfig.maven_profiles;
  if (profiles && profiles[normalizedProfile]) {
    return profiles[normalizedProfile];
  }

  // If no profile specified and no mapping, return empty array
  if (normalizedProfile === '') {
    return [];
  }

  // Return the profile as-is (let Maven validate it)
  return [normalizedProfile];
}

/**
 * Show restart guidance based on modified files and restart rules
 */
async function showRestartGuidance(moduleInfo, restartRules) {
  console.log(chalk.blue('=== Restart Guidance ==='));

  // Check if it's a global module
  if (moduleInfo.isGlobalModule) {
    console.log(chalk.red('Restart required: YES'));
    console.log('Reason: Global module deployment');
    return;
  }

  // For WAR files, typically hot deployment (no restart needed)
  if (moduleInfo.packaging === 'war') {
    console.log(chalk.yellow('Restart required: NO'));
    console.log('Reason: WAR hot-deployment');
    return;
  }

  // For JAR/EJB files, check restart rules if configured
  if (!restartRules || !restartRules.patterns) {
    console.log(chalk.yellow('Restart required: CHECK MANUALLY'));
    console.log('Reason: No restart rules configured');
    return;
  }

  try {
    // Get modified files from git
    const git = simpleGit(moduleInfo.path);
    const diff = await git.diff(['--name-only', 'HEAD']);
    const modifiedFiles = diff.trim().split('\n').filter(f => f);

    if (modifiedFiles.length === 0) {
      console.log(chalk.green('Restart required: NO'));
      console.log('Reason: No files modified');
      return;
    }

    // Filter to only files in the target module
    const moduleRelativePath = moduleInfo.relativePath || '';
    const filteredFiles = modifiedFiles.filter(file => {
      // For multi-module projects, filter by module's relative path
      if (moduleRelativePath) {
        return file.startsWith(moduleRelativePath + '/');
      }
      // For single-module, all files in the repo belong to the module
      return true;
    });

    if (filteredFiles.length === 0) {
      console.log(chalk.green('Restart required: NO'));
      console.log('Reason: No files modified in target module');
      return;
    }

    // Check files against restart patterns, deduplicating by file (highest severity wins)
    const matchesByFile = new Map();
    const severityOrder = { required: 1, recommended: 2 };

    for (const file of filteredFiles) {
      for (const rule of restartRules.patterns) {
        if (micromatch.isMatch(file, rule.match)) {
          const existing = matchesByFile.get(file);
          if (!existing || severityOrder[rule.severity] < severityOrder[existing.severity]) {
            matchesByFile.set(file, { file, ...rule });
          }
        }
      }
    }

    const matches = Array.from(matchesByFile.values());

    if (matches.length === 0) {
      console.log(chalk.green('Restart required: NO'));
      console.log('Reason: No critical files modified');
      return;
    }

    // Show restart requirement
    const hasRequired = matches.some(m => m.severity === 'required');
    if (hasRequired) {
      console.log(chalk.red('Restart required: YES'));
    } else {
      console.log(chalk.yellow('Restart required: RECOMMENDED'));
    }

    // Show matched files and reasons
    matches.forEach(match => {
      const severity = match.severity === 'required' ? chalk.red('[REQUIRED]') : chalk.yellow('[RECOMMENDED]');
      console.log(`  ${severity} ${match.file}`);
      console.log(`    Reason: ${match.reason}`);
    });
    console.log('');

  } catch (error) {
    // Git not available or not a git repo
    console.log(chalk.yellow('Restart required: CHECK MANUALLY'));
    console.log('Reason: Unable to detect file changes');
    console.log('');
  }
}

/**
 * Show built artifacts
 */
function showArtifacts(moduleInfo) {
  console.log(chalk.blue('=== Artifacts ==='));

  const targetPath = path.join(moduleInfo.path, 'target');
  const artifacts = findArtifacts(targetPath, moduleInfo.packaging);

  if (artifacts.length === 0) {
    console.log('No artifacts found');
    return null;
  }

  artifacts.forEach(artifact => {
    console.log(`  ${chalk.green(artifact)}`);
  });

  // Return the first artifact path
  return artifacts[0];
}

/**
 * Show artifacts and restart guidance
 */
async function showArtifactsAndGuidance(moduleInfo, restartRules) {
  const artifactPath = showArtifacts(moduleInfo);
  await showRestartGuidance(moduleInfo, restartRules);
  return artifactPath;
}

/**
 * Find artifacts in target directory
 */
function findArtifacts(targetPath, packaging) {
  const extensionMap = { ejb: 'jar', war: 'war', jar: 'jar', ear: 'ear', pom: 'pom' };
  const ext = extensionMap[packaging] || packaging;
  return globbySync(`*.${ext}`, { cwd: targetPath, absolute: true });
}

export {
  buildModule,
  buildMavenCommand,
  getProfiles,
  showArtifacts,
  findArtifacts
};
