import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { findUpSync } from 'find-up';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ''
});

function detectProject(config, cwd = process.cwd()) {
  const currentPath = path.resolve(cwd);
  const matchedProject = findProjectConfig(config, currentPath);

  if (!matchedProject) {
    throw new Error('Current directory is not within any configured project');
  }

  const pomPath = findPomXml(currentPath);
  if (!pomPath) {
    throw new Error('No pom.xml found in current directory or parent directories');
  }

  const pom = parsePom(pomPath);
  const module = detectModule(pomPath, pom, matchedProject.config);

  return {
    project: matchedProject.name,
    projectConfig: matchedProject.config,
    restartRules: config.restart_rules,
    pomPath,
    module
  };
}

function findProjectConfig(config, currentPath) {
  for (const [projectName, projectConfig] of Object.entries(config.projects)) {
    if (currentPath.startsWith(projectConfig.base_path)) {
      return { name: projectName, config: projectConfig };
    }
  }

  return null;
}

function findPomXml(startPath) {
  return findUpSync('pom.xml', { cwd: startPath }) ?? null;
}

function parsePom(pomPath) {
  try {
    const content = fs.readFileSync(pomPath, 'utf8');
    return parser.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse pom.xml: ${error.message}`);
  }
}

function detectModule(pomPath, pom, projectConfig) {
  const artifactId = pom.project?.artifactId;
  const packaging = pom.project?.packaging || 'jar';

  if (!artifactId) {
    throw new Error('artifactId not found in pom.xml');
  }

  const modulePath = path.dirname(pomPath);
  const relativePath = path.relative(projectConfig.base_path, modulePath);
  const dirName = path.basename(modulePath);
  const moduleConfig = projectConfig.global_modules?.[artifactId] ?? projectConfig.global_modules?.[dirName];

  return {
    artifactId,
    packaging,
    path: modulePath,
    relativePath,
    isGlobalModule: Boolean(moduleConfig),
    deploymentPath: moduleConfig || '',
    isReactorBuild: projectConfig.reactor_build === true
  };
}

export {
  detectProject,
  findProjectConfig,
  findPomXml,
  parsePom,
  detectModule
};
